import { checkRateLimit } from '@vercel/firewall';
import { isIP } from 'node:net';

type LimitResult = { allowed: true } | { allowed: false; status: 429 | 503; error: string };
const clientWindowMs = 10 * 60 * 1000;
const requestTimeoutMs = 5000;
const unavailable: LimitResult = {
  allowed: false,
  status: 503,
  error:
    'The source agent’s request limit could not be verified. Try later; your rule report is still available.',
};

export async function checkAgentLimit(
  request: Request,
  action: 'login' | 'explain' | 'read' | 'model',
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
  if (ip && isIP(ip)) {
    headers.set('x-real-ip', ip);
    headers.set('x-forwarded-for', ip);
  }
  if (!ip || !isIP(ip)) return unavailable;
  const startedAt = Date.now();
  const clientWindow = Math.floor(startedAt / clientWindowMs);
  const deadline = startedAt + requestTimeoutMs;
  const clientKey = `fineprint:client:${clientWindow}:${ip}`;
  let expired = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const requireCurrent = () => {
    if (
      expired ||
      Date.now() >= deadline ||
      Math.floor(Date.now() / clientWindowMs) !== clientWindow
    )
      throw new Error('Rate-limit check expired.');
  };
  const debit = async (rateLimitKey: string) => {
    // The SDK cannot cancel an in-flight request. Never start a later debit after expiry.
    requireCurrent();
    const result = await checkRateLimit(id, { headers, rateLimitKey });
    requireCurrent();
    return result;
  };
  try {
    const result = await Promise.race([
      (async () => {
        // One five-credit SDK policy supports independent namespaced buckets.
        // Each client attempt needs two credits before it can spend a model credit.
        // Partial/concurrent attempts can leave fewer than two usable client attempts.
        if (action !== 'model') {
          for (let charge = 0; charge < 2; charge++) {
            const client = await debit(clientKey);
            if (client.error || client.rateLimited) return client;
          }
        }
        if (action === 'login' || action === 'read') return { rateLimited: false };
        return debit('fineprint:source-agent');
      })(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          expired = true;
          reject(new Error('Rate limit timed out.'));
        }, requestTimeoutMs);
      }),
    ]);
    requireCurrent();
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
    expired = true;
    if (timeout) clearTimeout(timeout);
  }
}
