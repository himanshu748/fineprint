import { dossierSchema } from '@/lib/model';
import { checkDossier } from '@/lib/engine';
import { loadRulePack } from '@/lib/sanity';
import { readRequestJson, RequestBodyError } from '@/lib/request-body';
import { sameOrigin } from '@/lib/request-origin';
import { trackMatchesEvent } from '@/lib/events';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json(
      { error: 'Open FinePrint directly to check your project.' },
      { status: 403 },
    );
  try {
    const parsed = dossierSchema.safeParse(await readRequestJson(request, 16_000));
    if (!parsed.success || !trackMatchesEvent(parsed.data))
      return Response.json(
        { error: 'Some project facts are invalid. Check the date, team size, and project name.' },
        { status: 400 },
      );
    const { pack, mode } = await loadRulePack(parsed.data.eventId);
    return Response.json(checkDossier(parsed.data, pack, undefined, mode), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof RequestBodyError)
      return Response.json({ error: error.message }, { status: error.status });
    return Response.json(
      {
        error:
          'The current rule source could not be loaded. Retry, or choose the dated saved rules to continue. Your project facts are still here.',
      },
      { status: 503 },
    );
  }
}
