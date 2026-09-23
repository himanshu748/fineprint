import { z } from 'zod';
import { dossierSchema } from '@/lib/model';
import { checkDossier } from '@/lib/engine';
import { loadRulePack } from '@/lib/sanity';
import { modalConfigured } from '@/lib/modal';
import { explainWithSources } from '@/lib/source-agent';
import { sameOrigin } from '@/lib/request-origin';
import { agentAccess } from '@/lib/agent-access';
import { checkAgentLimit } from '@/lib/agent-rate-limit';
import { readRequestJson, RequestBodyError } from '@/lib/request-body';
import { reserveAgentRun } from '@/lib/agent-budget';
import { AgentRunError } from '@/lib/agent-trace';
import { trackMatchesEvent } from '@/lib/events';
export const runtime = 'nodejs';
export const maxDuration = 300;

const requestSchema = z.object({ dossier: dossierSchema, ruleId: z.string().max(80) }).strict();
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json(
      { error: 'Open FinePrint directly to request a source explanation.' },
      { status: 403 },
    );
  const access = await agentAccess(request);
  if (!access.available)
    return Response.json(
      { error: 'Live source explanations are not enabled on this deployment.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  if (!access.authorized)
    return Response.json(
      { error: 'Unlock the source agent with the demo access code.', code: 'ACCESS_REQUIRED' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  let release: (() => void) | null = null;
  try {
    const input = requestSchema.safeParse(await readRequestJson(request, 16_000));
    if (!input.success || !trackMatchesEvent(input.data.dossier))
      return Response.json({ error: 'Supply a valid dossier and finding.' }, { status: 400 });
    const limit = await checkAgentLimit(request, 'explain');
    if (!limit.allowed)
      return Response.json(
        { error: limit.error },
        { status: limit.status, headers: { 'Cache-Control': 'no-store' } },
      );
    const { pack, mode } = await loadRulePack(input.data.dossier.eventId);
    const report = checkDossier(input.data.dossier, pack, undefined, mode);
    const finding = report.findings.find((f) => f.rule.id === input.data.ruleId);
    if (!finding)
      return Response.json(
        { error: 'This finding is not part of the curated rule pack.' },
        { status: 404 },
      );
    const contextConfigured = Boolean(
      process.env.SANITY_CONTEXT_URL || process.env.SANITY_CONTEXT_TOKEN,
    );
    if (contextConfigured) {
      if (!modalConfigured())
        return Response.json(
          { error: 'Sanity Context is configured, but the Modal model connection is incomplete.' },
          { status: 503 },
        );
      release = reserveAgentRun();
      if (!release)
        return Response.json(
          {
            error:
              'The source agent reached this server’s request limit. Try later; the rule report is still available.',
          },
          { status: 429 },
        );
      return Response.json(await explainWithSources(report, finding), {
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    return Response.json({
      mode: 'curated',
      text: `${finding.rule.rationale}\n\n${finding.reason}\n\n${finding.status === 'supported' ? 'This support is limited to the facts supplied. It does not verify implementation or grant organizer approval.' : finding.rule.correction}`,
    });
  } catch (error) {
    if (error instanceof AgentRunError)
      return Response.json(
        { error: error.message, stage: error.stage, trace: error.trace },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    if (error instanceof RequestBodyError)
      return Response.json({ error: error.message }, { status: error.status });
    return Response.json(
      {
        error:
          'The live source explanation could not be verified. Check Modal, the Sanity organization token, and Knowledge Base mode, then retry. The rule report has not changed.',
      },
      { status: 503 },
    );
  } finally {
    release?.();
  }
}
