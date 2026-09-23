import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ chat: vi.fn(), call: vi.fn(), tools: vi.fn(), close: vi.fn() }));
vi.mock('../src/lib/modal', () => ({ modalChat: mocks.chat }));
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: class {
    connect = vi.fn();
    callTool = mocks.call;
    listTools = mocks.tools;
    close = mocks.close;
  },
}));
vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: class {},
}));
import { explainWithSources } from '../src/lib/source-agent';
import { checkDossier } from '../src/lib/engine';
import { examples, rulePack } from '../src/lib/rules';
const report = checkDossier(examples[2].dossier, rulePack, '2026-09-20T12:00:00Z');
const finding = report.findings.find((f) => f.rule.id === 'entry-limit')!;
const tool = (name = 'knowledge_base_read', paths = ['rules/entries']) => ({
  role: 'assistant',
  content: null,
  tool_calls: [
    {
      id: 'read1',
      type: 'function',
      function: { name, arguments: JSON.stringify({ knowledgeBase: 'kbtest', paths }) },
    },
  ],
});
describe('source-agent evidence boundary', () => {
  beforeEach(() => {
    vi.stubEnv(
      'SANITY_CONTEXT_URL',
      'https://api.sanity.io/v1/context/organizations/test/mcp/fineprint',
    );
    vi.stubEnv('SANITY_CONTEXT_TOKEN', 'test-only');
    mocks.chat.mockReset();
    mocks.call.mockReset();
    mocks.close.mockResolvedValue(undefined);
    mocks.tools.mockResolvedValue({ tools: [{ name: 'knowledge_base_read' }] });
    mocks.call.mockImplementation(async ({ name }) => ({
      content: [
        {
          type: 'text',
          text:
            name === 'initial_context'
              ? 'Knowledge base id: kbtest\nOutline:\nrules/entries'
              : 'The FAQ allows one entry, but the contest rules state unlimited entries. The conflict remains unresolved.\n## Sources\n1. Sanity contest rules',
        },
      ],
    }));
  });
  afterEach(() => vi.unstubAllEnvs());
  it('requires a real read and preserves the engine status', async () => {
    mocks.chat.mockResolvedValueOnce(tool()).mockResolvedValueOnce({
      role: 'assistant',
      content: JSON.stringify({
        explanation:
          'The official pages disagree about the entry limit. Ask the organizer which limit governs this case.',
        citations: ['rules/entries'],
      }),
    });
    const result = await explainWithSources(report, finding);
    expect(result.mode).toBe('live');
    expect(result.status).toBe('unclear');
    expect(result.paths).toEqual(['rules/entries']);
    expect(mocks.call).toHaveBeenCalledWith(
      {
        name: 'knowledge_base_read',
        arguments: { knowledgeBase: 'kbtest', paths: ['rules/entries'] },
      },
      undefined,
      { timeout: 25_000 },
    );
  });
  it('rejects an invented path before calling the source', async () => {
    mocks.chat.mockResolvedValueOnce(tool('knowledge_base_read', ['invented/path']));
    await expect(explainWithSources(report, finding)).rejects.toThrow('outside');
    expect(mocks.call).toHaveBeenCalledTimes(1);
  });
  it('cannot call a write tool', async () => {
    mocks.chat.mockResolvedValueOnce(tool('delete_document'));
    await expect(explainWithSources(report, finding)).rejects.toThrow('unavailable tool');
  });
  it('cannot label an answer live without retrieval', async () => {
    mocks.chat.mockResolvedValueOnce({ role: 'assistant', content: 'Everyone is eligible.' });
    await expect(explainWithSources(report, finding)).rejects.toThrow('did not retrieve');
  });
  it('rejects citations that were not retrieved', async () => {
    mocks.chat.mockResolvedValueOnce(tool()).mockResolvedValueOnce({
      role: 'assistant',
      content: JSON.stringify({
        explanation:
          'The official pages disagree about the entry limit and an organizer decision is necessary.',
        citations: ['invented/path'],
      }),
    });
    await expect(explainWithSources(report, finding)).rejects.toThrow('did not retrieve');
  });
  it('does not pass a dataset-only endpoint as a Knowledge Base', async () => {
    mocks.tools.mockResolvedValue({ tools: [{ name: 'groq_query' }] });
    mocks.call.mockResolvedValue({
      content: [{ type: 'text', text: 'Dataset schema: documents can be queried with GROQ.' }],
    });
    await expect(explainWithSources(report, finding)).rejects.toThrow('Knowledge Base');
  });
  it('rejects a retrieved citation belonging only to the other event', async () => {
    mocks.call.mockImplementation(async ({ name }) => ({
      content: [
        {
          type: 'text',
          text:
            name === 'initial_context'
              ? 'Knowledge base id: kbtest\nOutline:\nrules/entries'
              : 'GIBC permits one project in one track.\n## Sources\n1. GIBC V2 official rules',
        },
      ],
    }));
    mocks.chat.mockResolvedValueOnce(tool()).mockResolvedValueOnce({
      role: 'assistant',
      content: JSON.stringify({
        explanation: 'You may submit one project in one track according to the retrieved rules.',
        citations: ['rules/entries'],
      }),
    });
    await expect(explainWithSources(report, finding)).rejects.toThrow('do not identify this event');
  });
});
