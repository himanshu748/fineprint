import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseRepository, reviewablePath, boundedText } from '../src/lib/github-review';
import { validateEvidence, groundedFindings } from '../src/lib/repository-assessment';
import { rubrics } from '../src/lib/rubrics';
describe('public repository boundary', () => {
  it('accepts only GitHub repository roots', () => {
    expect(parseRepository('https://github.com/team/project.git')).toEqual({
      owner: 'team',
      repo: 'project',
    });
    for (const url of [
      'http://github.com/team/repo',
      'https://evil.test/team/repo',
      'https://github.com@evil.test/team/repo',
      'https://github.com/team/repo/tree/main',
      'https://github.com/team/repo?token=x',
      'https://github.com/team/repo#main',
    ])
      expect(() => parseRepository(url)).toThrow();
  });
  it('excludes sensitive, generated and binary files', () => {
    for (const path of [
      '.env.local',
      'src/credentials.json',
      'node_modules/a/index.ts',
      'image.png',
      'package-lock.json',
      'dist/main.js',
      '.github/workflows/build.yml',
      'evaluation/answers.json',
    ])
      expect(reviewablePath(path)).toBe(false);
    expect(reviewablePath('src/lib/checker.ts')).toBe(true);
  });
  it('bounds streamed responses', async () => {
    await expect(boundedText(new Response('too much'), 3)).rejects.toThrow('size limit');
  });
});
describe('line evidence', () => {
  const files = [
    { path: 'src/app.ts', text: 'const x = 1;\nexport const answer = x;\n', truncated: false },
  ];
  const citation = {
    path: 'src/app.ts',
    start: 2,
    end: 2,
    quote: 'export const answer = x;',
    kind: 'implementation' as const,
  };
  it('rejects invented files, quotes and wrong line ranges', () => {
    expect(validateEvidence(citation, files)).toBe(true);
    for (const change of [
      { path: 'src/fake.ts' },
      { start: 1, end: 1 },
      { quote: 'passed all tests' },
      { end: 90 },
      { start: 3, end: 2 },
    ])
      expect(validateEvidence({ ...citation, ...change }, files)).toBe(false);
  });
  const findings = () =>
    rubrics[0].criteria.map((c) => ({
      criterionId: c.id,
      status: 'evidence-found',
      summary: 'The inspected code provides evidence.',
      nextStep: 'Run a live workflow to verify the behavior.',
      evidence: [citation],
    }));
  it('requires all and only the chosen rubric criteria', () => {
    const raw = findings();
    raw[3].criterionId = raw[0].criterionId;
    expect(() =>
      groundedFindings(
        { findings: raw },
        rubrics[0],
        files,
        'https://github.com/a/b',
        'a'.repeat(40),
      ),
    ).toThrow();
  });
  it('discards invalid citations and downgrades unsupported evidence', () => {
    const raw = findings();
    raw[0].evidence[0] = { ...citation, quote: 'invented quote' };
    const report = groundedFindings(
      { findings: raw },
      rubrics[0],
      files,
      'https://github.com/a/b',
      'a'.repeat(40),
    );
    expect(report[0].status).toBe('not-found');
    expect(report[0].discardedEvidence).toBe(1);
    expect(report[1].evidence[0].url).toContain(`/blob/${'a'.repeat(40)}/src/app.ts#L2-L2`);
  });
  it('does not treat documentation alone as substantial implementation', () => {
    const raw = findings().map((f) => ({
      ...f,
      evidence: [{ ...citation, kind: 'documentation' }],
    }));
    expect(
      groundedFindings(
        { findings: raw },
        rubrics[0],
        files,
        'https://github.com/a/b',
        'a'.repeat(40),
      )[0].status,
    ).toBe('partial');
  });
});

it('forces README evidence to documentation even when the model calls it implementation', () => {
  const files = [{ path: 'README.md', text: 'We use a knowledge base.', truncated: false }];
  const raw = {
    findings: rubrics[0].criteria.map((c) => ({
      criterionId: c.id,
      status: 'evidence-found',
      summary: 'The README claims this is implemented.',
      nextStep: 'Inspect source and verify the running application.',
      evidence: [
        { path: 'README.md', start: 1, end: 1, quote: files[0].text, kind: 'implementation' },
      ],
    })),
  };
  const result = groundedFindings(raw, rubrics[0], files, 'https://github.com/a/b', 'a'.repeat(40));
  expect(
    result.every((f) => f.status === 'partial' && f.evidence[0].kind === 'documentation'),
  ).toBe(true);
});

describe('GitHub authenticated public reads', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  async function fresh() {
    vi.resetModules();
    return import('../src/lib/github-review');
  }
  const sha = 'a'.repeat(40);
  const metadata = { private: false, default_branch: 'main' };
  const tree = { tree: [{ path: 'README.md', type: 'blob', mode: '100644', size: 25 }] };
  const response = (data: unknown) => new Response(JSON.stringify(data));
  it('pins authenticated API requests and reads raw files without credentials', async () => {
    vi.stubEnv('GITHUB_TOKEN', 'mock-read-only-token');
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response(metadata))
      .mockResolvedValueOnce(response({ sha }))
      .mockResolvedValueOnce(response(tree))
      .mockResolvedValueOnce(new Response('Public repository documentation.'));
    vi.stubGlobal('fetch', fetcher);
    const github = await fresh();
    const repo = await github.repositoryTree('https://github.com/team/public');
    await github.readRepositoryFiles(repo, ['README.md']);
    for (const [url, init] of fetcher.mock.calls.slice(0, 3)) {
      expect(new URL(url).origin).toBe('https://api.github.com');
      expect(url).not.toContain('mock-read-only-token');
      expect(init.headers.Authorization).toBe('Bearer mock-read-only-token');
      expect(init.redirect).toBe('error');
    }
    const [url, init] = fetcher.mock.calls[3];
    expect(url).toBe(`https://raw.githubusercontent.com/team/public/${sha}/README.md`);
    expect(init.headers).toBeUndefined();
    expect(init.redirect).toBe('error');
    expect(JSON.stringify(repo)).not.toContain('mock-read-only-token');
  });
  it.each([true, undefined])(
    'refuses non-public metadata (%s), even with token access',
    async (privateFlag) => {
      vi.stubEnv('GITHUB_TOKEN', 'mock-read-only-token');
      const fetcher = vi
        .fn()
        .mockResolvedValue(response({ private: privateFlag, default_branch: 'main' }));
      vi.stubGlobal('fetch', fetcher);
      const github = await fresh();
      await expect(github.repositoryTree('https://github.com/team/private')).rejects.toThrow(
        'Only public',
      );
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it('works without a token and does not follow API redirects', async () => {
    vi.stubEnv('GITHUB_TOKEN', '');
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response('', { status: 302, headers: { Location: 'https://evil.test/' } }),
      );
    vi.stubGlobal('fetch', fetcher);
    const github = await fresh();
    await expect(github.repositoryTree('https://github.com/team/public')).rejects.toThrow(
      'could not read',
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBeUndefined();
    expect(fetcher.mock.calls[0][1].redirect).toBe('error');
  });
  it('refuses browser execution before reading credentials or making requests', async () => {
    vi.stubEnv('GITHUB_TOKEN', 'mock-read-only-token');
    vi.stubGlobal('window', {});
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const github = await fresh();
    await expect(github.repositoryTree('https://github.com/team/public')).rejects.toThrow(
      'server-only',
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('caches immutable trees briefly while rechecking visibility and current SHA', async () => {
    vi.stubEnv('GITHUB_TOKEN', '');
    vi.useFakeTimers();
    const fetcher = vi
      .fn()
      .mockImplementation(async (url: string) =>
        response(
          url.includes('/git/trees/') ? tree : url.includes('/commits/') ? { sha } : metadata,
        ),
      );
    vi.stubGlobal('fetch', fetcher);
    const github = await fresh();
    await github.repositoryTree('https://github.com/team/public');
    await github.repositoryTree('https://github.com/team/public');
    expect(fetcher).toHaveBeenCalledTimes(5);
    const updatedSha = 'b'.repeat(40);
    fetcher
      .mockResolvedValueOnce(response(metadata))
      .mockResolvedValueOnce(response({ sha: updatedSha }))
      .mockResolvedValueOnce(response(tree));
    const updated = await github.repositoryTree('https://github.com/team/public');
    expect(updated.sha).toBe(updatedSha);
    expect(fetcher.mock.calls[7][0]).toContain(`/git/trees/${updatedSha}`);
    vi.advanceTimersByTime(60_001);
    await github.repositoryTree('https://github.com/team/public');
    expect(fetcher).toHaveBeenCalledTimes(11);
    fetcher.mockResolvedValueOnce(response({ private: true, default_branch: 'main' }));
    await expect(github.repositoryTree('https://github.com/team/public')).rejects.toThrow(
      'Only public',
    );
    expect(fetcher).toHaveBeenCalledTimes(12);
  });
});

it('filters short or whitespace-padded evidence without discarding valid findings', () => {
  const text = 'export const substantiveEvidence = true;\nconst x = 1;\n                 x;';
  const raw = {
    findings: rubrics[0].criteria.map((c, i) => ({
      criterionId: c.id,
      status: 'evidence-found',
      summary: 'The inspected code provides evidence.',
      nextStep: 'Verify behavior in the running application.',
      evidence: [
        {
          path: 'src/app.ts',
          start: 1,
          end: 3,
          kind: 'implementation',
          quote: [
            'x;',
            '                 x;',
            'const x = 1;',
            'export const substantiveEvidence = true;',
          ][i],
        },
      ],
    })),
  };
  const result = groundedFindings(
    raw,
    rubrics[0],
    [{ path: 'src/app.ts', text, truncated: false }],
    'https://github.com/a/b',
    'a'.repeat(40),
  );
  expect(
    result.slice(0, 3).every((f) => f.status === 'not-found' && f.discardedEvidence === 1),
  ).toBe(true);
  expect(result[3].status).toBe('evidence-found');
});
