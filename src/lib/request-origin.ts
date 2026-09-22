/** Match the browser origin against the requested host, not Next's internal URL. */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // Non-browser callers still face the same request budgets.
  try {
    const source = new URL(origin);
    const host = request.headers.get('host') ?? new URL(request.url).host;
    return (
      ['http:', 'https:'].includes(source.protocol) &&
      source.host.toLowerCase() === host.toLowerCase() &&
      source.origin === origin
    );
  } catch {
    return false;
  }
}
