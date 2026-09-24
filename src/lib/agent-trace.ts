import { z } from 'zod';

const timing = {
  startedMs: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  ok: z.boolean(),
  detail: z.string().max(200).optional(),
};

export const traceStepSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('mcp'),
    tool: z.string().max(60),
    arguments: z.record(z.string(), z.unknown()),
    ...timing,
  }),
  z.object({
    kind: z.literal('model'),
    round: z.number().int().positive(),
    ...timing,
  }),
  z.object({ kind: z.literal('check'), tool: z.literal('check_requirements'), ...timing }),
  z.object({
    kind: z.literal('imported'),
    tool: z.literal('imported_rules_read'),
    host: z.string().max(253),
    ids: z.array(z.string().max(12)).max(30),
    ...timing,
  }),
]);

export type TraceStep = z.infer<typeof traceStepSchema>;

export class AgentRunError extends Error {
  constructor(
    public stage: 'context' | 'model' | 'validation',
    message: string,
    public trace: TraceStep[],
  ) {
    super(message);
  }
}

/** Records each MCP call and model round with its timing, including failed ones. */
export function createTrace(clock: () => number = Date.now) {
  const origin = clock();
  const steps: TraceStep[] = [];

  async function time<T>(
    step:
      | { kind: 'mcp'; tool: string; arguments: Record<string, unknown> }
      | { kind: 'model'; round: number }
      | { kind: 'check'; tool: 'check_requirements' }
      | { kind: 'imported'; tool: 'imported_rules_read'; host: string; ids: string[] },
    work: () => Promise<T>,
    describe?: (result: T) => string,
  ): Promise<T> {
    const started = clock();
    const base = { startedMs: Math.max(0, started - origin) };
    try {
      const result = await work();
      steps.push({
        ...step,
        ...base,
        durationMs: Math.max(0, clock() - started),
        ok: true,
        ...(describe ? { detail: describe(result) } : {}),
      });
      return result;
    } catch (error) {
      steps.push({
        ...step,
        ...base,
        durationMs: Math.max(0, clock() - started),
        ok: false,
        detail: 'Failed',
      });
      throw error;
    }
  }

  return {
    steps,
    elapsed: () => Math.max(0, clock() - origin),
    mcp: <T>(
      tool: string,
      args: Record<string, unknown>,
      work: () => Promise<T>,
      describe?: (result: T) => string,
    ) => time({ kind: 'mcp', tool, arguments: args }, work, describe),
    model: <T>(round: number, work: () => Promise<T>, describe?: (result: T) => string) =>
      time({ kind: 'model', round }, work, describe),
    check: <T>(work: () => Promise<T>, describe?: (result: T) => string) =>
      time({ kind: 'check', tool: 'check_requirements' }, work, describe),
    imported: <T>(
      host: string,
      ids: string[],
      work: () => Promise<T>,
      describe?: (result: T) => string,
    ) => time({ kind: 'imported', tool: 'imported_rules_read', host, ids }, work, describe),
  };
}

export type Trace = ReturnType<typeof createTrace>;
