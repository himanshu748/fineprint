import { z } from 'zod';
import { agentAccess } from '@/lib/agent-access';
import { reserveAgentRun } from '@/lib/agent-budget';
import { checkAgentLimit } from '@/lib/agent-rate-limit';
import { AgentRunError } from '@/lib/agent-trace';
import { dossierSchema, eventIdSchema } from '@/lib/model';
import { trackMatchesEvent } from '@/lib/events';
import { modalConfigured } from '@/lib/modal';
import { askWithSources, questionDossier } from '@/lib/question-agent';
import { readRequestJson, RequestBodyError } from '@/lib/request-body';
import { sameOrigin } from '@/lib/request-origin';
import { loadRulePack } from '@/lib/sanity';

export const runtime = 'nodejs';
export const maxDuration = 300;
const inputSchema = z
  .object({
    eventId: eventIdSchema.default('sanity-2026'),
    question: z.string().trim().min(10).max(1800),
    track: dossierSchema.shape.track,
    dossier: dossierSchema.optional(),
  })
  .strict();
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return json({ error: 'Open FinePrint directly to ask a question.' }, 403);
  const access = await agentAccess(request);
  if (!access.available)
    return json({ error: 'The source agent is not enabled on this deployment.' }, 503);
  if (!access.authorized)
    return json(
      { error: 'Enter the demo access code to use this deployment.', code: 'ACCESS_REQUIRED' },
      401,
    );
  let release: (() => void) | null = null;
  try {
    const input = inputSchema.safeParse(await readRequestJson(request, 16_000));
    if (!input.success)
      return json(
        { error: 'Write a question of 10 to 1,800 characters and select a review path.' },
        400,
      );
    const base = input.data.dossier
      ? { ...input.data.dossier, track: input.data.track, evidenceNote: '' }
      : questionDossier(input.data.track);
    if (base.eventId !== input.data.eventId || !trackMatchesEvent(base))
      return json({ error: 'Choose a supported track for this event.' }, 400);
    const limit = await checkAgentLimit(request, 'explain');
    if (!limit.allowed) return json({ error: limit.error }, limit.status);
    if (!process.env.SANITY_CONTEXT_URL || !process.env.SANITY_CONTEXT_TOKEN || !modalConfigured())
      return json(
        {
          error:
            'Live questions need both Sanity Context and Modal. The manual review desk is still available.',
        },
        503,
      );
    release = reserveAgentRun();
    if (!release)
      return json(
        { error: 'The agent is at its request limit. Try later or use the manual review desk.' },
        429,
      );
    const { pack, mode } = await loadRulePack(input.data.eventId);
    return json(await askWithSources(input.data.question, base, pack, mode));
  } catch (error) {
    if (error instanceof RequestBodyError) return json({ error: error.message }, error.status);
    if (error instanceof AgentRunError)
      return json({ error: error.message, stage: error.stage, trace: error.trace }, 503);
    return json(
      {
        error:
          'The live run could not be completed. Try again or use the manual review desk. No agent answer was saved.',
      },
      503,
    );
  } finally {
    release?.();
  }
}
