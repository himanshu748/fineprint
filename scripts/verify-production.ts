import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { SignJWT } from 'jose';
import { examples } from '../src/lib/rules';

// Smoke-test the compiled server with disposable credentials and no providers.
const code = randomBytes(24).toString('base64url');
const secret = randomBytes(32).toString('base64url');
const env: NodeJS.ProcessEnv = {
  ...process.env,
  NODE_ENV: 'production',
  VERCEL: '',
  FINEPRINT_REQUIRE_ACCESS_CODE: 'true',
  FINEPRINT_AGENT_ACCESS_KEY: code,
  FINEPRINT_SESSION_SECRET: secret,
  FINEPRINT_RATE_LIMIT_ID: '',
  FINEPRINT_FIREWALL_HOST: '',
  RATE_LIMIT_SECRET: '',
  SANITY_PROJECT_ID: '',
  SANITY_DATASET: '',
  SANITY_CONTEXT_URL: '',
  SANITY_CONTEXT_TOKEN: '',
  MODAL_BASE_URL: '',
  MODAL_MODEL: '',
  MODAL_API_KEY: '',
  MODAL_PROXY_TOKEN_ID: '',
  MODAL_PROXY_TOKEN_SECRET: '',
  MODAL_USE_CLI: 'false',
};
const child = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3001'],
  { env, stdio: 'ignore' },
);
const base = 'http://127.0.0.1:3001';
const checks: string[] = [];
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error('Temporary production server could not start.');
    try {
      if ((await fetch(`${base}/api/access`)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(ready, 'Temporary production server did not become ready.');
  assert.deepEqual(await (await fetch(`${base}/api/access`)).json(), {
    required: true,
    available: true,
    authorized: false,
  });
  checks.push('Production starts locked');
  const body = JSON.stringify({ dossier: examples[0].dossier, ruleId: 'origin' });
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Origin: base };
  assert.equal((await fetch(`${base}/api/explain`, { method: 'POST', headers, body })).status, 401);
  checks.push('Unauthenticated explanation returns 401');
  const unlock = await fetch(`${base}/api/access`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ code }),
  });
  assert.equal(unlock.status, 503);
  assert.equal(unlock.headers.get('set-cookie'), null);
  checks.push('Missing Firewall configuration prevents unlock');
  const token = await new SignJWT({ scope: 'explain' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('fineprint')
    .setAudience('fineprint-source-agent')
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(new TextEncoder().encode(secret));
  headers.Cookie = `__Host-fineprint-agent=${token}`;
  assert.equal((await (await fetch(`${base}/api/access`, { headers })).json()).authorized, true);
  checks.push('Signed session is recognized by the production server');
  const denied = await fetch(`${base}/api/explain`, { method: 'POST', headers, body });
  assert.equal(denied.status, 503);
  assert.match((await denied.json()).error, /request limit could not be verified/);
  checks.push('Missing Firewall configuration prevents authenticated explanation');
  assert.equal(
    (
      await fetch(`${base}/api/explain`, {
        method: 'POST',
        headers: { ...headers, Origin: 'https://other.example' },
        body,
      })
    ).status,
    403,
  );
  checks.push('Cross-origin explanation returns 403');
  const logout = await fetch(`${base}/api/access`, { method: 'DELETE', headers });
  assert.equal(logout.status, 200);
  assert.equal(
    logout.headers.get('set-cookie'),
    '__Host-fineprint-agent=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Secure',
  );
  checks.push('Production logout clears the secure host-only cookie');
  await writeFile(
    'evidence/production-smoke.json',
    JSON.stringify(
      {
        runAt: new Date().toISOString(),
        environment: 'Local next start with disposable credentials and providers disabled',
        checks,
        passed: checks.length,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `${checks.length} production-server checks passed; no cloud provider requests were enabled.`,
  );
} finally {
  child.kill('SIGTERM');
}
