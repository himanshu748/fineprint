import { dossierSchema } from '@/lib/model';
import { eventCatalog, factsForEvent, trackMatchesEvent } from '@/lib/events';
import { loadRulePack } from '@/lib/sanity';
import { checkDossier } from '@/lib/engine';
import { readRequestJson, RequestBodyError } from '@/lib/request-body';
import { sameOrigin } from '@/lib/request-origin';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: 'Open FinePrint directly to compare events.' }, { status: 403 });
  try {
    const parsed = dossierSchema.safeParse(await readRequestJson(request, 16_000));
    if (!parsed.success || !trackMatchesEvent(parsed.data))
      return Response.json(
        { error: 'Check the project facts and selected event before comparing.' },
        { status: 400 },
      );
    const checkedAt = new Date().toISOString();
    const results = await Promise.allSettled(
      eventCatalog.map(async (event) => {
        const { pack, mode } = await loadRulePack(event.id);
        return checkDossier(factsForEvent(parsed.data, event.id), pack, checkedAt, mode);
      }),
    );
    return Response.json(
      {
        reports: results.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : [])),
        unavailable: results.flatMap((result, i) =>
          result.status === 'rejected' ? [eventCatalog[i].id] : [],
        ),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof RequestBodyError
            ? error.message
            : 'The comparison could not be completed.',
      },
      { status: error instanceof RequestBodyError ? error.status : 503 },
    );
  }
}
