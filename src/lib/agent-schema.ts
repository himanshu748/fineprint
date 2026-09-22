import { z } from 'zod';
import { reportSchema, statusSchema } from './model';
import { traceStepSchema } from './agent-trace';

const factValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const factResultSchema = z.discriminatedUnion('status', [
  z.object({
    key: z.string(),
    label: z.string(),
    status: z.literal('stated'),
    value: z.union([z.string(), z.number(), z.boolean()]),
    quote: z.string().min(1),
    note: z.string().optional(),
  }),
  z.object({ key: z.string(), label: z.string(), status: z.literal('unknown'), value: z.null() }),
]);

const recordSchema = z.object({
  kind: z.enum(['requirement', 'source', 'competition', 'other']),
  id: z.string().nullable(),
  title: z.string(),
});

export const askResponseSchema = z.object({
  mode: z.literal('live'),
  question: z.string(),
  answer: z.string().min(1),
  citations: z.array(z.string()).min(1),
  citationsRemoved: z.array(z.string()),
  facts: z.array(factResultSchema),
  rejectedFacts: z.array(z.object({ key: z.string(), reason: z.string() })),
  comparison: z.array(
    z.object({
      ruleId: z.string(),
      title: z.string(),
      agent: statusSchema,
      engine: statusSchema,
      agrees: z.boolean(),
      groundedIn: z.array(z.string()),
      facts: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          value: factValue,
          from: z.enum(['question', 'form']),
        }),
      ),
    }),
  ),
  engine: z.object({
    summary: z.string(),
    checked: z.number().int().nonnegative(),
    counts: z.record(statusSchema, z.number().int().nonnegative()),
    packVersion: z.string(),
    sourceMode: z.enum(['snapshot', 'sanity']),
    changes: z.array(
      z.object({
        ruleId: z.string(),
        title: z.string(),
        before: statusSchema,
        after: statusSchema,
      }),
    ),
  }),
  report: reportSchema,
  knowledgeBase: z.object({
    id: z.string(),
    entries: z.number().int().nonnegative(),
    read: z.array(z.object({ path: z.string(), records: z.array(recordSchema) })),
  }),
  trace: z.array(traceStepSchema),
  model: z.string(),
  provider: z.literal('Modal'),
  elapsedMs: z.number().int().nonnegative(),
});

export const agentErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  stage: z.enum(['context', 'model', 'validation', 'rules']).optional(),
  trace: z.array(traceStepSchema).optional(),
});

export const explanationSchema = z.object({
  mode: z.enum(['live', 'curated']),
  text: z.string(),
  paths: z.array(z.string()).optional(),
  trace: z.array(traceStepSchema).optional(),
});

export type AskResponse = z.infer<typeof askResponseSchema>;
export type FactResult = z.infer<typeof factResultSchema>;
export type AgentError = z.infer<typeof agentErrorSchema>;
