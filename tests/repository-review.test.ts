import { describe, it, expect } from 'vitest';
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
