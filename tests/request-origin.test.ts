import { describe, it, expect } from 'vitest';
import { sameOrigin } from '../src/lib/request-origin';
const request = (origin?: string, host = '127.0.0.1:3000') =>
  new Request('http://localhost:3000/api/explain', {
    headers: { host, ...(origin ? { origin } : {}) },
  });
describe('browser source request origin', () => {
  it('uses the requested host when Next uses an internal localhost URL', () =>
    expect(sameOrigin(request('http://127.0.0.1:3000'))).toBe(true));
  it('accepts a same-host HTTPS reverse proxy', () =>
    expect(sameOrigin(request('https://fineprint.example', 'fineprint.example'))).toBe(true));
  it('rejects a different origin and an opaque origin', () => {
    expect(sameOrigin(request('https://attacker.example'))).toBe(false);
    expect(sameOrigin(request('null'))).toBe(false);
    expect(sameOrigin(request('http://127.0.0.1:3000.attacker.example'))).toBe(false);
  });
  it('allows a non-browser caller without treating this guard as authentication', () =>
    expect(sameOrigin(request())).toBe(true));
});
