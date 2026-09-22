import { expect, it } from 'vitest';
import { readRequestJson } from '../src/lib/request-body';
function request(body: string) {
  return new Request('http://localhost/api/check', { method: 'POST', body });
}
it('reads valid JSON', async () =>
  expect(await readRequestJson(request('{"code":"value"}'), 32)).toEqual({ code: 'value' }));
it('bounds UTF-8 bytes rather than JavaScript character count', async () => {
  await expect(readRequestJson(request('{"x":"😀😀"}'), 12)).rejects.toMatchObject({ status: 413 });
});
it('rejects malformed JSON', async () => {
  await expect(readRequestJson(request('{bad'), 32)).rejects.toMatchObject({ status: 400 });
});
it('rejects a missing body', async () => {
  await expect(readRequestJson(new Request('http://localhost'), 32)).rejects.toMatchObject({
    status: 400,
  });
});
