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
  const manualBody = JSON.stringify(examples[0].dossier);
  const manualCheck = await fetch(`${base}/api/check`, {
    method: 'POST',
    headers,
    body: manualBody,
  });
  assert.equal(manualCheck.status, 200);
  const manualReport = await manualCheck.json();
  assert.equal(manualReport.sourceMode, 'snapshot');
  assert.equal(manualReport.findings.length, 19);
  checks.push('Anonymous manual checks work with dated rules and providers disabled');
  const events = await (await fetch(`${base}/api/events`)).json();
  assert.equal(events.events.length, 2);
  const comparison = await fetch(`${base}/api/compare`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...examples[0].dossier, teamSize: 5, startedAt: '2026-08-23' }),
  });
  assert.equal(comparison.status, 200);
  const compared = await comparison.json();
  assert.deepEqual(
    compared.reports.map((report: { packId: string }) => report.packId),
    ['sanity-2026', 'gibc-v2-2026'],
  );
  assert.equal(
    compared.reports[0].findings.find((f: { rule: { id: string } }) => f.rule.id === 'team').status,
    'blocked',
  );
  assert.equal(
    compared.reports[1].findings.find((f: { rule: { id: string } }) => f.rule.id === 'gibc-team')
      .status,
    'supported',
  );
  assert.equal(compared.reports[1].dossier.eligibleResidency, null);
  checks.push('Public event catalog and comparison keep both events and their facts separate');
  assert.equal(
    (
      await fetch(`${base}/api/compare`, {
        method: 'POST',
        headers: { ...headers, Origin: 'https://other.example' },
        body: manualBody,
      })
    ).status,
    403,
  );
  checks.push('Cross-origin comparison returns 403');

  assert.equal(
    (
      await fetch(`${base}/api/check`, {
        method: 'POST',
        headers: { ...headers, Origin: 'https://other.example' },
        body: manualBody,
      })
    ).status,
    403,
  );
  checks.push('Cross-origin manual check returns 403');
  assert.equal(
    (
      await fetch(`${base}/api/check`, {
        method: 'POST',
        headers,
        body: 'x'.repeat(16_001),
      })
    ).status,
    413,
  );
  checks.push('Oversized manual check returns 413');
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
