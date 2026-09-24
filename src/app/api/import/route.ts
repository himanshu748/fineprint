import { agentAccess } from '@/lib/agent-access';
import { reserveAgentRun } from '@/lib/agent-budget';
import { checkAgentLimit } from '@/lib/agent-rate-limit';
import { importSummary } from '@/lib/imported-event';
import { modalConfigured } from '@/lib/modal';
import { PageFetchError } from '@/lib/page-fetch';
import { readRequestJson, RequestBodyError } from '@/lib/request-body';
import { sameOrigin } from '@/lib/request-origin';
import {
  cachedImport,
  extractImport,
  ImportError,
  importInputSchema,
  prepareImport,
  rememberImport,
} from '@/lib/rule-import';

export const runtime = 'nodejs';
export const maxDuration = 300;
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'Open FinePrint directly to import rules.' }, 403);
  const access = await agentAccess(request);
  if (!access.available)
    return json({ error: 'Rule import is not enabled on this deployment.' }, 503);
  if (!access.authorized)
    return json(
      { error: 'Enter the demo access code to use this deployment.', code: 'ACCESS_REQUIRED' },
      401,
    );
  let release: (() => void) | null = null;
  try {
    const input = importInputSchema.safeParse(await readRequestJson(request, 8_000));
    if (!input.success)
      return json({ error: 'Paste one rules link and at most two extra pages.' }, 400);
    const limit = await checkAgentLimit(request, 'explain');
    if (!limit.allowed) return json({ error: limit.error }, limit.status);
    if (!modalConfigured())
      return json(
        { error: 'Rule import needs the Modal model. The two curated events still work.' },
        503,
      );
    const prepared = await prepareImport(input.data);
    const cached = cachedImport(prepared.contentHash);
    if (cached) return json({ event: cached, summary: importSummary(cached), cached: true });
    release = reserveAgentRun();
    if (!release) return json({ error: 'The shared AI allowance is busy. Try again later.' }, 429);
    const event = await extractImport(prepared);
    rememberImport(event);
    return json({ event, summary: importSummary(event), cached: false });
  } catch (error) {
    if (error instanceof RequestBodyError) return json({ error: error.message }, error.status);
    if (error instanceof PageFetchError || error instanceof ImportError)
      return json({ error: error.message }, 422);
    return json(
      {
        error:
          'The rules could not be imported. The model may be unavailable; try again later. Nothing was saved.',
      },
      503,
    );
  } finally {
    release?.();
  }
}
