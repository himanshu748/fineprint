import { checkRateLimit } from '@vercel/firewall';

type LimitResult = { allowed: true } | { allowed: false; status: 429 | 503; error: string };
const unavailable: LimitResult = {
  allowed: false,
  status: 503,
  error:
    'The source agent’s request limit could not be verified. Try later; your rule report is still available.',
};

export async function checkAgentLimit(
  request: Request,
  action: 'login' | 'explain',
): Promise<LimitResult> {
  if (process.env.NODE_ENV !== 'production') return { allowed: true };
  const id = process.env.FINEPRINT_RATE_LIMIT_ID;
  const host = process.env.FINEPRINT_FIREWALL_HOST;
  if (
    process.env.VERCEL !== '1' ||
    !id ||
    !host ||
    !/^[a-z0-9-]+\.vercel\.app$/.test(host) ||
    (process.env.RATE_LIMIT_SECRET?.length ?? 0) < 32
  )
    return unavailable;
  // Pin the Firewall destination and pass only edge-provided network metadata.
  // Session cookies, authorization headers and submitted access codes stay out.
  const headers = new Headers({ host });
  const ip = request.headers.get('x-real-ip');
  if (ip) {
    headers.set('x-real-ip', ip);
    headers.set('x-forwarded-for', ip);
  }
  if (action === 'login' && !ip) return unavailable;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      checkRateLimit(id, {
        headers,
        ...(action === 'explain' ? { rateLimitKey: 'fineprint:source-agent' } : {}),
      }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Rate limit timed out.')), 5000);
      }),
    ]);
    if (result.error) return unavailable;
    if (result.rateLimited)
      return {
        allowed: false,
        status: 429,
        error:
          'The demo request limit has been reached. Try again in ten minutes; the rule report is still available.',
      };
    return { allowed: true };
  } catch {
    return unavailable;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
