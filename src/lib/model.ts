import { z } from 'zod';

export const triState = z.boolean().nullable();
export const eventIdSchema = z.enum(['sanity-2026', 'gibc-v2-2026']);
export type EventId = z.infer<typeof eventIdSchema>;
export const monthInput = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const dateInput = z.union([monthInput, z.iso.date(), z.iso.datetime({ offset: true })]);
export const dossierSchema = z
  .object({
    eventId: eventIdSchema.default('sanity-2026'),
    name: z.string().trim().min(1).max(100),
    track: z.enum(['path-one', 'path-two', 'both', 'open-invention']),
    origin: z.enum(['new', 'components', 'existing']).nullable(),
    startedAt: z
      .string()
      .max(40)
      .nullable()
      .refine(
        (v) => v === null || v === '' || dateInput.safeParse(v).success,
        'Use a month, a real calendar date or a date-time with a timezone.',
      ),
    teamSize: z.number().int().min(1).max(100).nullable(),
    adultTeam: triState,
    eligibleResidency: triState,
    devMembership: triState,
    excludedAffiliation: triState,
    priorWorkCredited: triState,
    substantialNewWork: triState,
    usesSanity: triState,
    usesContext: triState,
    usesKnowledgeBase: triState,
    aiBuilt: triState,
    supportedFrontend: triState,
    entriesPerPath: z.number().int().min(1).max(100).nullable(),
    separatePosts: triState,
    englishSubmission: triState,
    requiresLogin: triState,
    judgeAccess: triState,
    projectIdentifier: z.string().trim().max(300).nullable(),
    publishedPost: triState,
    hasChallengeTag: triState,
    seeksMultiplePrizes: triState,
    evidenceNote: z.string().max(2000),
    allStudents: triState.default(null),
    minimumAge: z.number().int().min(1).max(120).nullable().default(null),
    guardianConsent: triState.default(null),
    oneTeam: triState.default(null),
    workingPrototype: triState.default(null),
    technicalNovelty: triState.default(null),
    priorHackathonEntry: triState.default(null),
    publicRepository: triState.default(null),
    setupInstructions: triState.default(null),
    videoMinutes: z.number().min(0).max(120).nullable().default(null),
    videoAccessible: triState.default(null),
    screenshotsCount: z.number().int().min(0).max(100).nullable().default(null),
    devpostComplete: triState.default(null),
    aiUseDisclosed: triState.default(null),
  })
  .strict();

export type Dossier = z.infer<typeof dossierSchema>;
export type FactKey = keyof Dossier;
export type Scope = 'entry' | 'path' | 'prize' | 'combination' | 'submission';
export type Status = 'supported' | 'blocked' | 'missing' | 'unclear' | 'not-applicable';

export const expressionSchema: z.ZodType<Expression> = z.lazy(() =>
  z.union([
    z.object({
      op: z.enum(['eq', 'neq', 'lte', 'gte', 'present', 'date-after']),
      fact: z.string(),
      value: z.union([z.string(), z.number(), z.boolean()]).optional(),
    }),
    z.object({ op: z.enum(['all', 'any']), expressions: z.array(expressionSchema).min(1).max(12) }),
    z.object({ op: z.literal('unresolved') }),
  ]),
);

export type Expression =
  | {
      op: 'eq' | 'neq' | 'lte' | 'gte' | 'present' | 'date-after';
      fact: string;
      value?: string | number | boolean;
    }
  | { op: 'all' | 'any'; expressions: Expression[] }
  | { op: 'unresolved' };

export const sourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.url(),
  publisher: z.string(),
  capturedAt: z.string(),
  version: z.string(),
  authority: z.string(),
  quote: z.string(),
  summary: z.string(),
});
export type Source = z.infer<typeof sourceSchema>;

export const requirementSchema = z.object({
  id: z.string(),
  title: z.string(),
  scope: z.enum(['entry', 'path', 'prize', 'combination', 'submission']),
  category: z.enum(['participation', 'prior-work', 'sponsor', 'artifacts', 'prize-compatibility']),
  summary: z.string(),
  sources: z.array(z.string()).min(1),
  check: expressionSchema,
  appliesWhen: expressionSchema.optional(),
  question: z.string(),
  correction: z.string(),
  review: z.enum(['curated', 'needs-organizer']),
  rationale: z.string(),
});
export type Requirement = z.infer<typeof requirementSchema>;
export const rulePackSchema = z.object({
  id: eventIdSchema,
  version: z.string(),
  title: z.string(),
  start: z.string(),
  deadline: z.string(),
  updatedAt: z.string(),
  reviewNote: z.string(),
  sources: z.array(sourceSchema),
  requirements: z.array(requirementSchema),
});
export type RulePack = z.infer<typeof rulePackSchema>;

export type Finding = {
  rule: Requirement;
  status: Status;
  reason: string;
  facts: { key: string; value: unknown }[];
  missingFacts: string[];
};

export type Report = {
  id: string;
  checkedAt: string;
  dossier: Dossier;
  packVersion: string;
  packId: string;
  packSchedule?: { start: string; deadline: string };
  sourceMode: 'snapshot' | 'sanity';
  sources: Source[];
  findings: Finding[];
  counts: Record<Status, number>;
  summary: string;
  nextQuestion: string | null;
  coverage: string;
  sourceHealth: 'current-snapshot' | 'aging-snapshot';
};

export const statusSchema = z.enum([
  'supported',
  'blocked',
  'missing',
  'unclear',
  'not-applicable',
]);
export const reportSchema = z.object({
  id: z.string().max(100),
  checkedAt: z.iso.datetime(),
  dossier: dossierSchema,
  packVersion: z.string(),
  packId: z.string(),
  packSchedule: z.object({ start: z.string(), deadline: z.string() }).optional(),
  sourceMode: z.enum(['snapshot', 'sanity']),
  sources: z.array(sourceSchema).max(20),
  findings: z
    .array(
      z.object({
        rule: requirementSchema,
        status: statusSchema,
        reason: z.string(),
        facts: z.array(z.object({ key: z.string(), value: z.unknown() })),
        missingFacts: z.array(z.string()),
      }),
    )
    .max(80),
  counts: z.record(statusSchema, z.number().int().nonnegative()),
  summary: z.string(),
  nextQuestion: z.string().nullable(),
  coverage: z.string(),
  sourceHealth: z.enum(['current-snapshot', 'aging-snapshot']),
});
export const savedCaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  savedAt: z.iso.datetime(),
  dossier: dossierSchema,
  report: reportSchema,
});

export const factLabels: Record<FactKey, string> = {
  eventId: 'Event',
  name: 'Project name',
  track: 'Target path',
  origin: 'What existed before the event',
  startedAt: 'Entry development began',
  teamSize: 'Team size',
  adultTeam: 'Every member meets the age requirement',
  eligibleResidency: 'Every member meets residency restrictions',
  devMembership: 'DEV accounts in good standing',
  excludedAffiliation: 'Excluded organizer affiliation',
  priorWorkCredited: 'Prior work credited',
  substantialNewWork: 'Substantial new work described',
  usesSanity: 'Uses Sanity content',
  usesContext: 'Uses Sanity Context MCP',
  usesKnowledgeBase: 'Uses a Knowledge Base',
  aiBuilt: 'Built with an AI coding tool',
  supportedFrontend: 'Next.js or Astro frontend',
  entriesPerPath: 'Entries in the same path',
  separatePosts: 'Separate posts for both paths',
  englishSubmission: 'English prize submission',
  requiresLogin: 'App requires login',
  judgeAccess: 'Judge testing access supplied',
  projectIdentifier: 'Sanity project ID or public dataset URL',
  publishedPost: 'DEV submission published',
  hasChallengeTag: 'Required challenge tag included',
  seeksMultiplePrizes: 'Seeking prizes in both paths',
  evidenceNote: 'Evidence and context',
  allStudents: 'Every member is a student',
  minimumAge: 'Youngest team member’s age',
  guardianConsent: 'Under-18 members have guardian permission',
  oneTeam: 'Every member is on only one submitting team',
  workingPrototype: 'Working prototype available',
  technicalNovelty: 'Technical novelty demonstrated',
  priorHackathonEntry: 'Substantially the same as a previous hackathon entry',
  publicRepository: 'Public, unrestricted source repository',
  setupInstructions: 'README includes setup and usage instructions',
  videoMinutes: 'Demo video length in minutes',
  videoAccessible: 'Demo is accessible and shows the project running',
  screenshotsCount: 'Number of submitted screenshots',
  devpostComplete: 'Devpost description, Built With and full team details complete',
  aiUseDisclosed: 'AI coding tools disclosed in Built With and README',
};
