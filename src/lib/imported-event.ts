import { z } from 'zod';
import {
  importedEventIdSchema,
  rulePackSchema,
  type Expression,
  type Requirement,
  type RulePack,
} from './model';

const eq = (fact: string, value: string | number | boolean): Expression => ({
  op: 'eq',
  fact,
  value,
});
const reused: Expression = {
  op: 'any',
  expressions: [eq('origin', 'components'), eq('origin', 'existing')],
};

type Kind = {
  label: string;
  category: Requirement['category'];
  needsValue?: boolean;
  question: string;
  correction: string;
  build: (value: number, pack: { start: string | null }) => Expression | null;
  appliesWhen?: Expression;
};

/**
 * The only conditions an imported rule may use. The model picks a kind and a number;
 * FinePrint builds the typed condition, so an imported pack cannot invent a fact.
 */
export const importKinds = {
  'team-size-max': {
    label: 'Maximum team size',
    category: 'participation',
    needsValue: true,
    question: 'How many people are on this team?',
    correction: 'A larger team does not satisfy this requirement.',
    build: (n) => ({ op: 'lte', fact: 'teamSize', value: n }),
  },
  'team-size-min': {
    label: 'Minimum team size',
    category: 'participation',
    needsValue: true,
    question: 'How many people are on this team?',
    correction: 'A smaller team does not satisfy this requirement.',
    build: (n) => ({ op: 'gte', fact: 'teamSize', value: n }),
  },
  'minimum-age': {
    label: 'Minimum age',
    category: 'participation',
    needsValue: true,
    question: 'How old is the youngest team member?',
    correction: 'A member below the stated age does not satisfy this requirement.',
    build: (n) => ({ op: 'gte', fact: 'minimumAge', value: n }),
  },
  'age-requirement': {
    label: 'Age requirement',
    category: 'participation',
    question: 'Does every team member meet the stated age requirement?',
    correction: 'Resolve the ineligible team member before treating the team as eligible.',
    build: () => eq('adultTeam', true),
  },
  residency: {
    label: 'Residency or location',
    category: 'participation',
    question: 'Has every member checked their residence against the stated restrictions?',
    correction: 'A member outside the stated residency conditions is not eligible.',
    build: () => eq('eligibleResidency', true),
  },
  'students-only': {
    label: 'Students only',
    category: 'participation',
    question: 'Is every team member a student?',
    correction: 'This event is limited to students.',
    build: () => eq('allStudents', true),
  },
  'guardian-consent': {
    label: 'Guardian consent for minors',
    category: 'participation',
    question: 'Do members under 18 have a parent or guardian’s permission?',
    correction: 'Get the required permission before entering.',
    build: () => eq('guardianConsent', true),
    appliesWhen: { op: 'lte', fact: 'minimumAge', value: 17 },
  },
  'one-team-only': {
    label: 'One team per person',
    category: 'participation',
    question: 'Is every member on only one submitting team?',
    correction: 'A person on more than one team does not satisfy this requirement.',
    build: () => eq('oneTeam', true),
  },
  'no-excluded-affiliation': {
    label: 'Excluded affiliations',
    category: 'participation',
    question: 'Does any member have an excluded organizer, sponsor or judge relationship?',
    correction: 'Review the relationship with the organizer before proceeding.',
    build: () => eq('excludedAffiliation', false),
  },
  'entries-max': {
    label: 'Number of entries',
    category: 'participation',
    needsValue: true,
    question: 'How many separate entries are you planning?',
    correction: 'More entries than the stated limit do not satisfy this requirement.',
    build: (n) => ({ op: 'lte', fact: 'entriesPerPath', value: n }),
  },
  'build-window': {
    label: 'Built during the event',
    category: 'prior-work',
    question: 'When did development of this entry start? Include the time and time zone.',
    correction: 'A start before the event does not satisfy the development-window requirement.',
    build: (_, pack) =>
      pack.start
        ? {
            op: 'all',
            expressions: [
              { op: 'date-after', fact: 'startedAt', value: pack.start },
              { op: 'date-after', fact: '$deadline', value: '$startedAt' },
            ],
          }
        : null,
  },
  'new-work': {
    label: 'New work',
    category: 'prior-work',
    question: 'Did the submitted project already exist before the event?',
    correction: 'An existing project does not satisfy a new-work requirement.',
    build: () => ({ op: 'any', expressions: [eq('origin', 'new'), eq('origin', 'components')] }),
  },
  'credit-prior-work': {
    label: 'Credit reused work',
    category: 'prior-work',
    question: 'Have you credited the earlier work you reused?',
    correction: 'Document the reused material and its author in the submission.',
    build: () => eq('priorWorkCredited', true),
    appliesWhen: reused,
  },
  'substantial-new-work': {
    label: 'Substantial changes to reused work',
    category: 'prior-work',
    question: 'Have you described the substantial changes made during the event?',
    correction: 'Describe the new work. The organizer decides whether it is enough.',
    build: () => eq('substantialNewWork', true),
    appliesWhen: reused,
  },
  'not-previous-entry': {
    label: 'Not a previous hackathon entry',
    category: 'prior-work',
    question: 'Is this project substantially the same as an entry to another hackathon?',
    correction: 'A resubmitted hackathon project does not satisfy this requirement.',
    build: () => eq('priorHackathonEntry', false),
  },
  'working-prototype': {
    label: 'Working project',
    category: 'artifacts',
    question: 'Is a working version of the project available?',
    correction: 'Prepare a working version before submitting.',
    build: () => eq('workingPrototype', true),
  },
  'public-repository': {
    label: 'Source code repository',
    category: 'artifacts',
    question: 'Is the source code in a repository the judges can open?',
    correction: 'Publish the repository or give the judges access.',
    build: () => eq('publicRepository', true),
  },
  'setup-instructions': {
    label: 'Setup instructions',
    category: 'artifacts',
    question: 'Does the README explain how to set up and use the project?',
    correction: 'Add setup and usage instructions.',
    build: () => eq('setupInstructions', true),
  },
  'demo-video': {
    label: 'Demo video',
    category: 'artifacts',
    question: 'Is there a demo video the judges can open that shows the project running?',
    correction: 'Record and share a demo video.',
    build: () => eq('videoAccessible', true),
  },
  'video-max-minutes': {
    label: 'Video length',
    category: 'artifacts',
    needsValue: true,
    question: 'How long is the demo video in minutes?',
    correction: 'Shorten the video to the stated limit.',
    build: (n) => ({ op: 'lte', fact: 'videoMinutes', value: n }),
  },
  'screenshots-min': {
    label: 'Screenshots',
    category: 'artifacts',
    needsValue: true,
    question: 'How many screenshots are in the submission?',
    correction: 'Add the stated number of screenshots.',
    build: (n) => ({ op: 'gte', fact: 'screenshotsCount', value: n }),
  },
  'demo-link': {
    label: 'Demo link',
    category: 'artifacts',
    question: 'Does the submission include a public link to try the project?',
    correction: 'Add a public demo link to the submission.',
    build: () => eq('demoLink', true),
  },
  english: {
    label: 'Submission language',
    category: 'artifacts',
    question: 'Is the submission written in English?',
    correction: 'Provide the submission in English.',
    build: () => eq('englishSubmission', true),
  },
  'judge-access': {
    label: 'Judge access',
    category: 'artifacts',
    question: 'If the project needs a login, have you given the judges a way in?',
    correction: 'Supply test credentials or another way for judges to try it.',
    build: () => eq('judgeAccess', true),
    appliesWhen: eq('requiresLogin', true),
  },
  'ai-use-disclosed': {
    label: 'AI use disclosed',
    category: 'artifacts',
    question: 'Have you disclosed the AI tools used to build the project?',
    correction: 'List the AI tools in the submission.',
    build: () => eq('aiUseDisclosed', true),
  },
  'published-submission': {
    label: 'Submission published',
    category: 'artifacts',
    question: 'Is the submission published before the deadline?',
    correction: 'Publish the submission before the deadline.',
    build: () => eq('publishedPost', true),
  },
  'check-yourself': {
    label: 'Check yourself',
    category: 'artifacts',
    question: 'Read the quoted rule and confirm your project meets it.',
    correction: 'Read the quoted rule and confirm your project meets it.',
    build: () => ({ op: 'unresolved' }),
  },
} satisfies Record<string, Kind>;

export type ImportKind = keyof typeof importKinds;
export const importKindSchema = z.enum(Object.keys(importKinds) as [ImportKind, ...ImportKind[]]);

const offsetDate = z.iso.datetime({ offset: true });
export const importedPageSchema = z
  .object({
    id: z.string().regex(/^p[1-3]$/),
    url: z.url({ protocol: /^https$/ }),
    fetchedAt: z.iso.datetime(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    characters: z.number().int().nonnegative(),
    truncated: z.boolean(),
  })
  .strict();
export const importedRequirementSchema = z
  .object({
    id: z.string().regex(/^r\d{1,2}$/),
    title: z.string().trim().min(3).max(120),
    quote: z.string().min(8).max(600),
    kind: importKindSchema,
    value: z.number().min(0).max(1000).nullable(),
    track: z
      .string()
      .regex(/^t[1-8]$/)
      .nullable(),
    scope: z.enum(['entry', 'path', 'prize', 'submission']),
    page: z.string().regex(/^p[1-3]$/),
  })
  .strict();
export const importedEventSchema = z
  .object({
    format: z.literal('fineprint-imported-event'),
    version: z.literal(1),
    id: importedEventIdSchema,
    title: z.string().trim().min(2).max(140),
    host: z.string().min(1).max(253),
    pages: z.array(importedPageSchema).min(1).max(3),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/),
    importedAt: z.iso.datetime(),
    start: offsetDate.nullable(),
    startQuote: z.string().max(300).nullable(),
    deadline: offsetDate.nullable(),
    deadlineQuote: z.string().max(300).nullable(),
    tracks: z
      .array(z.object({ id: z.string().regex(/^t[1-8]$/), title: z.string().min(1).max(80) }))
      .max(8),
    requirements: z.array(importedRequirementSchema).min(1).max(30),
    dropped: z.array(z.object({ title: z.string().max(120), quote: z.string().max(600) })).max(40),
    model: z.string().max(120),
    elapsedMs: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((event, context) => {
    const pages = new Set(event.pages.map((page) => page.id));
    const tracks = new Set(event.tracks.map((track) => track.id));
    if (new Set(event.requirements.map((r) => r.id)).size !== event.requirements.length)
      context.addIssue({ code: 'custom', message: 'Requirement IDs must be unique.' });
    for (const rule of event.requirements) {
      if (!pages.has(rule.page))
        context.addIssue({ code: 'custom', message: 'A requirement cites an unknown page.' });
      if (rule.track && !tracks.has(rule.track))
        context.addIssue({ code: 'custom', message: 'A requirement names an unknown track.' });
      if ((importKinds[rule.kind] as Kind).needsValue && rule.value === null)
        context.addIssue({ code: 'custom', message: 'A numeric requirement has no number.' });
      if (rule.kind === 'build-window' && !event.start)
        context.addIssue({ code: 'custom', message: 'A build window needs a start time.' });
    }
    if (event.pages.some((page) => hostOf(page.url) !== event.host))
      context.addIssue({ code: 'custom', message: 'Imported pages must share one site.' });
  });
export type ImportedEvent = z.infer<typeof importedEventSchema>;
export type ImportedRequirement = z.infer<typeof importedRequirementSchema>;

export const hostOf = (url: string) => new URL(url).hostname.replace(/^www\./, '');

export function isMapped(rule: Pick<ImportedRequirement, 'kind'>) {
  return rule.kind !== 'check-yourself';
}

export function importSummary(event: ImportedEvent) {
  const mapped = event.requirements.filter(isMapped).length;
  return {
    found: event.requirements.length + event.dropped.length,
    kept: event.requirements.length,
    mapped,
    checkYourself: event.requirements.length - mapped,
    dropped: event.dropped.length,
  };
}

export const importedLabel = (event: Pick<ImportedEvent, 'host'>) =>
  `Imported from ${event.host}, not reviewed`;

/** Builds the typed rule pack from a validated import. Client and server share this. */
export function buildImportedPack(event: ImportedEvent): RulePack {
  const trackTitle = (id: string | null) => event.tracks.find((t) => t.id === id)?.title;
  const requirements = event.requirements.map((rule): Requirement => {
    const kind = importKinds[rule.kind] as Kind;
    const check = kind.build(rule.value ?? 0, event) ?? { op: 'unresolved' as const };
    const conditions = [
      ...(kind.appliesWhen ? [kind.appliesWhen] : []),
      ...(rule.track ? [eq('importedTrack', rule.track)] : []),
    ];
    const selfCheck = check.op === 'unresolved';
    return {
      id: rule.id,
      title: rule.title,
      scope: rule.track ? 'path' : rule.scope,
      category: kind.category,
      summary: selfCheck
        ? 'Check this yourself against the quoted rule.'
        : `${kind.label}${rule.value !== null && kind.needsValue ? `: ${rule.value}` : ''}${rule.track ? ` · ${trackTitle(rule.track)}` : ''}`,
      sources: [rule.page],
      check,
      ...(conditions.length === 1
        ? { appliesWhen: conditions[0] }
        : conditions.length
          ? { appliesWhen: { op: 'all' as const, expressions: conditions } }
          : {}),
      question: selfCheck ? importKinds['check-yourself'].question : kind.question,
      correction: selfCheck ? importKinds['check-yourself'].correction : kind.correction,
      review: selfCheck ? 'needs-organizer' : 'imported',
      rationale: selfCheck
        ? 'FinePrint has no structured fact for this rule, so it never reports it as supported. Read the quote and decide.'
        : 'A model mapped this quoted rule to a FinePrint check. Nobody has reviewed the mapping. Read the quote before relying on it.',
      quote: rule.quote,
    };
  });
  return rulePackSchema.parse({
    id: event.id,
    version: `imported-${event.contentHash.slice(0, 12)}`,
    title: event.title,
    start: event.start ?? '',
    deadline: event.deadline ?? '',
    updatedAt: event.importedAt,
    reviewNote: `${importedLabel(event)}. Captured ${event.importedAt}.`,
    sources: event.pages.map((page) => ({
      id: page.id,
      title: `${event.title} · ${new URL(page.url).pathname}`,
      url: page.url,
      publisher: event.host,
      capturedAt: page.fetchedAt.slice(0, 10),
      version: `sha256:${page.contentHash.slice(0, 16)}`,
      authority: importedLabel(event),
      quote: event.requirements.find((rule) => rule.page === page.id)?.quote ?? '',
      summary: `Fetched ${page.fetchedAt}. ${page.characters.toLocaleString('en-US')} characters of text${page.truncated ? ', truncated for the model' : ''}.`,
    })),
    requirements,
  });
}
