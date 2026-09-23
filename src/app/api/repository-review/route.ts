import { z } from 'zod';
import { rubricIdSchema } from '@/lib/rubrics';
import { assessRepository } from '@/lib/repository-assessment';
import { parseRepository } from '@/lib/github-review';
import { agentAccess } from '@/lib/agent-access';
import { reserveAgentRun } from '@/lib/agent-budget';
import { checkAgentLimit } from '@/lib/agent-rate-limit';
import { readRequestJson, RequestBodyError } from '@/lib/request-body';
import { sameOrigin } from '@/lib/request-origin';
export const runtime = 'nodejs';
export const maxDuration = 300;
const inputSchema = z
  .object({ repository: z.string().max(240), rubricId: rubricIdSchema })
  .strict();
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return json({ error: 'Open FinePrint directly to review a repository.' }, 403);
  const access = await agentAccess(request);
  if (!access.available || !access.authorized)
    return json(
      { error: 'Repository review requires source-agent access on this deployment.' },
      access.available ? 401 : 503,
    );
  let release: (() => void) | null = null;
  try {
    const input = inputSchema.safeParse(await readRequestJson(request, 2000));
    if (!input.success)
      return json({ error: 'Choose a supported rubric and a public GitHub repository URL.' }, 400);
    try {
      parseRepository(input.data.repository);
    } catch {
      return json(
        { error: 'Use https://github.com/owner/repository without a branch, file path or query.' },
        400,
      );
    }
    const limit = await checkAgentLimit(request, 'explain');
    if (!limit.allowed) return json({ error: limit.error }, limit.status);
    release = reserveAgentRun();
    if (!release) return json({ error: 'The shared AI allowance is busy. Try again later.' }, 429);
    return json(await assessRepository(input.data.repository, input.data.rubricId));
  } catch (error) {
    if (error instanceof RequestBodyError) return json({ error: error.message }, error.status);
    // Provider and parsing errors may contain submitted source code. Never return raw errors.
    return json(
      {
        error:
          'The repository review could not be completed. Check that the repository is public and try again later. GitHub or the shared AI service may be unavailable. No partial verdict was saved.',
      },
      503,
    );
  } finally {
    release?.();
  }
}
