import { z } from 'zod';
export type RepoFile = { path: string; text: string; truncated: boolean };
export function parseRepository(input: string) {
  const url = new URL(input);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'github.com' ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('Use a public https://github.com/owner/repository URL.');
  const parts = url.pathname.replace(/\/$/, '').split('/').slice(1);
  if (
    parts.length !== 2 ||
    !parts.every((x) => /^[A-Za-z0-9_.-]{1,100}$/.test(x)) ||
    parts.some((x) => x === '.' || x === '..')
  )
    throw new Error('Use the repository homepage URL, without a branch or file path.');
  return { owner: parts[0], repo: parts[1].replace(/\.git$/, '') };
}
export async function boundedText(response: Response, limit: number) {
  if (!response.ok)
    throw new Error(
      response.status === 403 || response.status === 429
        ? 'GitHub request limit reached. Try again later.'
        : 'GitHub could not read this public repository. Check the URL and try again.',
    );
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Empty GitHub response.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw new Error('GitHub response exceeds the review size limit.');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks).toString('utf8');
}
async function api(path: string) {
  return JSON.parse(
    await boundedText(
      await fetch(`https://api.github.com${path}`, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'FinePrint' },
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
        cache: 'no-store',
      }),
      2_000_000,
    ),
  );
}
export function reviewablePath(path: string) {
  return (
    path.length < 240 &&
    !path
      .split('/')
      .some(
        (p) =>
          p === '..' ||
          p.startsWith('.') ||
          /^(node_modules|vendor|dist|build|coverage|evaluation|fixtures)$/i.test(p),
      ) &&
    !/(lock|\.min)\./i.test(path) &&
    !/(secret|credential|private[-_]?key|\.env)/i.test(path) &&
    /\.(md|mdx|txt|json|ts|tsx|js|jsx|py|go|rs|java|sql|yaml|yml|toml|svelte|vue|html|css)$/i.test(
      path,
    )
  );
}
export async function repositoryTree(url: string) {
  const { owner, repo } = parseRepository(url);
  const root = `/repos/${owner}/${repo}`;
  const meta = await api(root);
  if (meta.private || !meta.default_branch)
    throw new Error('Only public, non-empty repositories are supported.');
  const commit = await api(`${root}/commits/${encodeURIComponent(meta.default_branch)}`);
  const sha = z
    .string()
    .regex(/^[a-f0-9]{40}$/)
    .parse(commit.sha);
  const tree = await api(`${root}/git/trees/${sha}?recursive=1`);
  const entries = z
    .array(
      z.object({
        path: z.string(),
        type: z.string(),
        size: z.number().optional(),
        mode: z.string(),
      }),
    )
    .parse(tree.tree);
  const eligible = entries.filter(
    (e) =>
      e.type === 'blob' &&
      ['100644', '100755'].includes(e.mode) &&
      (e.size ?? Infinity) <= 50000 &&
      reviewablePath(e.path),
  );
  const priority = (p: string) =>
    /(^|\/)readme\.md$/i.test(p)
      ? 0
      : /schema|sanity|context|agent|route|test|package\.json|app\./i.test(p)
        ? 1
        : 2;
  eligible.sort((a, b) => priority(a.path) - priority(b.path) || a.path.localeCompare(b.path));
  return {
    owner,
    repo,
    sha,
    url: `https://github.com/${owner}/${repo}`,
    paths: eligible.slice(0, 500).map((e) => e.path),
    totalFiles: entries.filter((e) => e.type === 'blob').length,
    eligibleFiles: eligible.length,
    treeTruncated: Boolean(tree.truncated),
  };
}
export async function readRepositoryFiles(
  repo: Awaited<ReturnType<typeof repositoryTree>>,
  paths: string[],
) {
  if (paths.length > 10 || paths.some((p) => !repo.paths.includes(p)))
    throw new Error('Invalid repository file selection.');
  const files: RepoFile[] = [];
  const skipped: string[] = [];
  let budget = 60000;
  for (const path of [...new Set(paths)]) {
    if (budget <= 0) {
      skipped.push(path);
      continue;
    }
    try {
      const text = await boundedText(
        await fetch(
          `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${repo.sha}/${path.split('/').map(encodeURIComponent).join('/')}`,
          { redirect: 'error', signal: AbortSignal.timeout(12000), cache: 'no-store' },
        ),
        50000,
      );
      if (text.includes('\0')) {
        skipped.push(path);
        continue;
      }
      const limited = text.slice(0, Math.min(10000, budget)).split('\n').slice(0, 300).join('\n');
      budget -= limited.length;
      files.push({ path, text: limited, truncated: limited.length < text.length });
    } catch {
      skipped.push(path);
    }
  }
  if (!files.length) throw new Error('No readable source files were available.');
  return { files, skipped };
}
