import { z } from 'zod';
import { acceptsAccessKey, agentAccess, agentCookie, createAgentSession } from '@/lib/agent-access';
import { checkAgentLimit } from '@/lib/agent-rate-limit';
import { readRequestJson, RequestBodyError } from '@/lib/request-body';
import { sameOrigin } from '@/lib/request-origin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };
const schema = z.object({ code: z.string().min(1).max(160) }).strict();

export async function GET(request: Request) {
  return Response.json(await agentAccess(request), { headers });
}

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json(
      { error: 'Open FinePrint directly to unlock the source agent.' },
      { status: 403, headers },
    );
  const state = await agentAccess(request);
  if (!state.available)
    return Response.json(
      { error: 'Source-agent access is not configured on this deployment.' },
      { status: 503, headers },
    );
  if (state.authorized) return Response.json(state, { headers });
  const limit = await checkAgentLimit(request, 'login');
  if (!limit.allowed)
    return Response.json({ error: limit.error }, { status: limit.status, headers });
  try {
    const input = schema.safeParse(await readRequestJson(request, 512));
    if (!input.success)
      return Response.json({ error: 'Enter the demo access code.' }, { status: 400, headers });
    if (!acceptsAccessKey(input.data.code))
      return Response.json(
        { error: 'That access code was not accepted.' },
        { status: 401, headers },
      );
    const token = await createAgentSession();
    return Response.json(
      { required: true, available: true, authorized: true },
      { headers: { ...headers, 'Set-Cookie': agentCookie(token) } },
    );
  } catch (error) {
    if (error instanceof RequestBodyError)
      return Response.json({ error: error.message }, { status: error.status, headers });
    return Response.json(
      { error: 'The source agent could not be unlocked. Please retry.' },
      { status: 503, headers },
    );
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request))
    return Response.json(
      { error: 'Open FinePrint directly to lock the source agent.' },
      { status: 403, headers },
    );
  return Response.json(
    { authorized: false },
    { headers: { ...headers, 'Set-Cookie': agentCookie('', true) } },
  );
}
