import { z } from 'zod';
import { traceStepSchema } from './agent-trace';
import { rubricSchema } from './rubrics';
export const citationSchema = z.object({
  path: z.string().max(240),
  start: z.number().int().positive(),
  end: z.number().int().positive(),
  quote: z
    .string()
    .min(3)
    .max(2000)
    .transform((value) => value.slice(0, 400)),
  kind: z.enum(['implementation', 'documentation', 'test']),
});
export const findingSchema = z.object({
  criterionId: z.string(),
  status: z.enum(['evidence-found', 'partial', 'not-found']),
  summary: z.string().min(10).max(700),
  nextStep: z.string().min(10).max(500),
  evidence: z.array(citationSchema).max(3),
});
export const repositoryReportSchema = z.object({
  repository: z.string().url(),
  commit: z.string().regex(/^[a-f0-9]{40}$/),
  reviewedAt: z.string(),
  rubric: rubricSchema,
  findings: z
    .array(
      findingSchema.extend({
        evidence: z.array(citationSchema.extend({ url: z.string().url() })),
        discardedEvidence: z.number(),
      }),
    )
    .length(4),
  coverage: z.object({
    totalFiles: z.number(),
    eligibleFiles: z.number(),
    listedFiles: z.number(),
    treeTruncated: z.boolean(),
    inspected: z.array(z.object({ path: z.string(), lines: z.number(), truncated: z.boolean() })),
    skipped: z.array(z.string()),
  }),
  contextPaths: z.array(z.string()).min(1),
  trace: z.array(traceStepSchema),
  elapsedMs: z.number(),
});
export type RepositoryReport = z.infer<typeof repositoryReportSchema>;
