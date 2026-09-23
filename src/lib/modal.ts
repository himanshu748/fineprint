import { spawn } from 'node:child_process';
import { z } from 'zod';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};
export type ToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};
export type ModelTool = {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
};
const responseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable().optional(),
          tool_calls: z
            .array(
              z.object({
                id: z.string(),
                type: z.literal('function'),
                function: z.object({ name: z.string(), arguments: z.string() }),
              }),
            )
            .nullish(),
        }),
      }),
    )
    .min(1),
});

export function modalConfigured() {
  return !!(
    process.env.MODAL_BASE_URL &&
    process.env.MODAL_MODEL &&
    (process.env.MODAL_API_KEY ||
      (process.env.MODAL_PROXY_TOKEN_ID && process.env.MODAL_PROXY_TOKEN_SECRET) ||
      (process.env.MODAL_USE_CLI === 'true' && process.env.NODE_ENV !== 'production'))
  );
}
export function modalUrl(path: string) {
  const base = new URL(process.env.MODAL_BASE_URL || 'https://not-configured.invalid');
  if (
    base.protocol !== 'https:' ||
    !['.modal.direct', '.modal.run'].some((suffix) => base.hostname.endsWith(suffix)) ||
    base.username ||
    base.password
  )
    throw new Error('Use a verified HTTPS Modal endpoint.');
  return `${base.href.replace(/\/$/, '')}/${path}`;
}

// For a local preview, Modal's official CLI exchanges the existing login for request auth.
// No shell, user-controlled arguments, or credential output. Hosted deployments use a proxy token.
async function localCliRequest(url: string, body: string): Promise<unknown> {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Modal CLI authentication is only available for local development.');
  return new Promise((resolve, reject) => {
    const child = spawn(
      'modal',
      [
        'curl',
        '-fsS',
        '--max-time',
        '90',
        '-X',
        'POST',
        url,
        '-H',
        'Content-Type: application/json',
        '--data-binary',
        '@-',
      ],
      { stdio: ['pipe', 'pipe', 'pipe'], shell: false },
    );
    let output = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('Modal request timed out.'));
    }, 95_000);
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
      if (output.length > 120_000) {
        child.kill();
        reject(new Error('Modal returned an oversized response.'));
      }
    });
    // Provider stderr may include credentials or a submitted prompt. Never expose it.
    child.stderr.resume();
    child.on('error', () => {
      clearTimeout(timer);
      reject(new Error('The Modal CLI could not start.'));
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error('Modal authentication or inference failed.'));
      try {
        resolve(JSON.parse(output));
      } catch {
        reject(new Error('Modal returned an invalid response.'));
      }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(body);
  });
}

export async function modalChat(
  messages: ChatMessage[],
  tools?: ModelTool[],
  requireTool = false,
  maxTokens = 1200,
) {
  if (!modalConfigured()) throw new Error('Modal is not configured.');
  const body = JSON.stringify({
    model: process.env.MODAL_MODEL,
    messages,
    temperature: 0.1,
    max_tokens: Math.min(4000, Math.max(256, maxTokens)),
    reasoning_effort: 'none',
    ...(tools?.length ? { tools, tool_choice: requireTool ? 'required' : 'auto' } : {}),
  });
  let raw: unknown;
  if (
    process.env.MODAL_USE_CLI === 'true' &&
    !process.env.MODAL_API_KEY &&
    !process.env.MODAL_PROXY_TOKEN_ID
  ) {
    raw = await localCliRequest(modalUrl('chat/completions'), body);
  } else {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (process.env.MODAL_API_KEY) headers.Authorization = `Bearer ${process.env.MODAL_API_KEY}`;
    else
      headers.Authorization = `Bearer ${process.env.MODAL_PROXY_TOKEN_ID}.${process.env.MODAL_PROXY_TOKEN_SECRET}`;
    const response = await fetch(modalUrl('chat/completions'), {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(90_000),
      cache: 'no-store',
      redirect: 'error',
    });
    if (!response.ok) throw new Error(`Modal inference failed (${response.status}).`);
    const text = await response.text();
    if (text.length > 120_000) throw new Error('Modal returned an oversized response.');
    raw = JSON.parse(text);
  }
  const message = responseSchema.parse(raw).choices[0].message;
  return {
    role: 'assistant' as const,
    content: message.content ?? null,
    ...(message.tool_calls ? { tool_calls: message.tool_calls } : {}),
  };
}
