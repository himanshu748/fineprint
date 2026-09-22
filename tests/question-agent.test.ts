import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { askWithSources, questionDossier } from '../src/lib/question-agent';
import { askResponseSchema } from '../src/lib/agent-schema';
import { readQuestionFacts } from '../src/lib/question-facts';
import { rulePack } from '../src/lib/rules';
import { checkDossier } from '../src/lib/engine';
import { readEntries } from '../src/lib/source-agent';
import { createTrace } from '../src/lib/agent-trace';

const mocks = vi.hoisted(() => ({ model: vi.fn(), callTool: vi.fn() }));
vi.mock('@/lib/modal', () => ({ modalChat: mocks.model }));
vi.mock('@/lib/source-agent', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/lib/source-agent')>();
  return {
    ...original,
    withContext: async <T>(work: (client: Client) => Promise<T>) =>
      work({ callTool: mocks.callTool } as unknown as Client),
  };
});

const path = 'eligibility/development_timing';
const question = 'I started my app in August. Can I enter Path One?';
const tool = (name: string, args: unknown) => ({
  role: 'assistant',
  content: null,
  tool_calls: [{ id: name, type: 'function', function: { name, arguments: JSON.stringify(args) } }],
});
const final = (citations = [path]) => ({
  role: 'assistant',
  content: JSON.stringify({
    answer:
      'The development start check is blocked: August is before this challenge began. Confirm when this entry, rather than its components, started.',
    citations,
  }),
});
beforeEach(() => {
  vi.stubEnv('MODAL_MODEL', 'test-model');
  mocks.model.mockReset();
  mocks.callTool.mockReset().mockImplementation(async ({ name }: { name: string }) => ({
    content: [
      {
        type: 'text',
        text:
          name === 'initial_context'
            ? `Knowledge base id: kbtest\n# FinePrint\n${path} [core]\n  Development timing and prior work.`
            : '# Development timing\nDevelopment must begin during the entry period.\n## Sources\n1. Development start – Requirement',
      },
    ],
  }));
  mocks.model
    .mockResolvedValueOnce(tool('knowledge_base_read', { knowledgeBase: 'kbtest', paths: [path] }))
    .mockResolvedValueOnce(
      tool('check_requirements', {
        facts: [
          {
            key: 'startedAt',
            value: { year: null, month: 8, day: null },
            quote: 'I started my app in August',
          },
        ],
        assessments: [{ ruleId: 'start', status: 'blocked', citations: [path] }],
      }),
    )
    .mockResolvedValueOnce(final());
});
afterEach(() => vi.unstubAllEnvs());

it('reads MCP, extracts a quoted partial date, invokes the checker and validates the complete response', async () => {
  const result = await askWithSources(question, questionDossier('path-one'), rulePack, 'sanity');
  expect(askResponseSchema.safeParse(result).success).toBe(true);
  expect(result.report.dossier).toMatchObject({
    startedAt: '2026-08',
    origin: null,
    englishSubmission: null,
    entriesPerPath: null,
  });
  expect(result.comparison[0]).toMatchObject({
    ruleId: 'start',
    agent: 'blocked',
    engine: 'blocked',
    agrees: true,
  });
  expect(result.facts.find((fact) => fact.key === 'startedAt')).toMatchObject({
    note: expect.stringContaining('Year not stated'),
  });
  expect(result.trace.map((step) => step.kind)).toEqual([
    'mcp',
    'model',
    'mcp',
    'model',
    'check',
    'model',
  ]);
  expect(result.knowledgeBase.read[0].records).toContainEqual({
    kind: 'requirement',
    id: 'start',
    title: 'Development start',
  });
});

it('removes invented citation paths and reports that it did so', async () => {
  mocks.model
    .mockReset()
    .mockResolvedValueOnce(tool('knowledge_base_read', { knowledgeBase: 'kbtest', paths: [path] }))
    .mockResolvedValueOnce(
      tool('check_requirements', {
        facts: [],
        assessments: [{ ruleId: 'start', status: 'supported', citations: [path] }],
      }),
    )
    .mockResolvedValueOnce(final([path, 'imaginary/approval']));
  const result = await askWithSources(question, questionDossier('path-one'), rulePack, 'sanity');
  expect(result.citations).toEqual([path]);
  expect(result.citationsRemoved).toEqual(['imaginary/approval']);
  expect(result.comparison[0]).toMatchObject({
    agent: 'supported',
    engine: 'missing',
    agrees: false,
  });
});

it('refuses answers before retrieval and checking', async () => {
  mocks.model.mockReset().mockResolvedValue(final());
  await expect(
    askWithSources(question, questionDossier('path-one'), rulePack, 'sanity'),
  ).rejects.toMatchObject({ stage: 'validation' });
});

it('keeps provider failure visible with a failed trace and no synthetic success', async () => {
  mocks.model.mockReset().mockRejectedValue(new Error('provider-secret-sensitive-detail'));
  try {
    await askWithSources(question, questionDossier('path-one'), rulePack, 'sanity');
    throw new Error('Expected failure');
  } catch (error) {
    expect(error).toMatchObject({
      stage: 'model',
      message: 'The model on Modal did not complete this run.',
    });
    expect(JSON.stringify(error)).not.toContain('provider-secret');
  }
});

it('refuses an entry absent from the advertised outline before making an RPC', async () => {
  mocks.callTool.mockClear();
  await expect(
    readEntries(
      { callTool: mocks.callTool } as unknown as Client,
      createTrace(),
      [{ id: 'kbtest', title: '', entries: [{ path, tag: 'core', summary: '' }] }],
      JSON.stringify({ knowledgeBase: 'kbtest', paths: ['forged'] }),
      new Map(),
      6,
    ),
  ).rejects.toThrow('outside');
  expect(mocks.callTool).not.toHaveBeenCalled();
});

describe('conservative facts', () => {
  it.each([
    ['An English question', 'englishSubmission', true, 'An English question'],
    ['I do not use Sanity', 'usesSanity', true, 'I do not use Sanity'],
    ['I plan to use Sanity', 'usesSanity', true, 'I plan to use Sanity'],
    ['Do I need Sanity?', 'usesSanity', true, 'Do I need Sanity?'],
    ['I use React', 'supportedFrontend', true, 'I use React'],
    ['I am not sure about my age', 'adultTeam', true, 'I am not sure about my age'],
    ['I started in August', 'origin', 'existing', 'I started in August'],
    ['I use Sanity', 'adultTeam', true, 'Everyone is over 18'],
  ])('keeps unsupported facts unknown: %s', (text, key, value, quote) => {
    const result = readQuestionFacts(text, [{ key, value, quote }], rulePack);
    expect(result.patch).not.toHaveProperty(key);
    expect(result.rejected).toHaveLength(1);
  });
  it('rejects conflicting duplicate proposals instead of silently keeping the first', () => {
    const result = readQuestionFacts(
      'I use Sanity. I do not use Sanity.',
      [
        { key: 'usesSanity', value: true, quote: 'I use Sanity' },
        { key: 'usesSanity', value: false, quote: 'I do not use Sanity' },
      ],
      rulePack,
    );
    expect(result.patch.usesSanity).toBeUndefined();
  });
  it('preserves an overlapping start month as missing rather than inventing its day', () => {
    const result = readQuestionFacts(
      'I started in September',
      [{ key: 'startedAt', value: { month: 9 }, quote: 'I started in September' }],
      rulePack,
    );
    expect(result.patch.startedAt).toBe('2026-09');
    expect(
      checkDossier({ ...questionDossier('path-one'), ...result.patch }, rulePack).findings.find(
        (row) => row.rule.id === 'start',
      )?.status,
    ).toBe('missing');
  });
});
