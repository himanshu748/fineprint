import { dossierSchema } from '@/lib/model';
import { checkDossier } from '@/lib/engine';
import { loadRulePack } from '@/lib/sanity';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (text.length > 16_000)
      return Response.json({ error: 'This project dossier is too large.' }, { status: 413 });
    const parsed = dossierSchema.safeParse(JSON.parse(text));
    if (!parsed.success)
      return Response.json(
        { error: 'Some project facts are invalid. Check the date, team size, and project name.' },
        { status: 400 },
      );
    const { pack, mode } = await loadRulePack();
    return Response.json(checkDossier(parsed.data, pack, undefined, mode), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof SyntaxError)
      return Response.json({ error: 'Send a valid project dossier.' }, { status: 400 });
    return Response.json(
      {
        error:
          'The configured rule source could not be loaded. Check the Sanity connection and retry; the app has not substituted a local result.',
      },
      { status: 503 },
    );
  }
}
