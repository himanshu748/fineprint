import { z } from 'zod';
import { dossierSchema, reportSchema, type Dossier, type Report } from './model';
import { askResponseSchema, type AskResponse } from './agent-schema';
import { blankDossier } from './rules';

export const workspaceKey = 'fineprint.reviews.v1';
export const maxReviews = 30;
export const maxBackupBytes = 512_000;

// Keep unfinished input, including a partly typed date, across reloads. Checking still
// uses the stricter dossier schema; saving a draft does not validate its claims.
export const draftSchema = dossierSchema.extend({
  name: z.string().max(100),
  startedAt: z.string().max(40).nullable(),
  teamSize: z.number().nullable(),
  entriesPerPath: z.number().nullable(),
  minimumAge: z.number().nullable().default(null),
  videoMinutes: z.number().nullable().default(null),
  screenshotsCount: z.number().nullable().default(null),
});
export const reviewSchema = z.object({
  id: z.uuid(),
  importedFrom: z.uuid().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  archived: z.boolean(),
  dossier: draftSchema,
  report: reportSchema.nullable(),
  previousReport: reportSchema.nullable(),
  question: z.string().max(1800),
  answer: askResponseSchema.nullable(),
});
export type PersonalReview = z.infer<typeof reviewSchema>;
export const workspaceSchema = z
  .object({
    version: z.literal(1),
    activeId: z.uuid().nullable(),
    reviews: z.array(reviewSchema).max(maxReviews),
  })
  .superRefine((value, context) => {
    if (new Set(value.reviews.map((r) => r.id)).size !== value.reviews.length)
      context.addIssue({ code: 'custom', message: 'Review IDs must be unique.' });
    if (value.activeId && !value.reviews.some((r) => r.id === value.activeId && !r.archived))
      context.addIssue({ code: 'custom', message: 'The active review is unavailable.' });
  });
export type ReviewWorkspace = z.infer<typeof workspaceSchema>;
export const emptyWorkspace = (): ReviewWorkspace => ({ version: 1, activeId: null, reviews: [] });

export function newReview(
  name: string,
  track: Dossier['track'],
  details: Pick<Dossier, 'origin' | 'startedAt'> & Partial<Dossier> = {
    origin: null,
    startedAt: null,
  },
): PersonalReview {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    archived: false,
    dossier: dossierSchema.parse({
      ...blankDossier,
      ...details,
      eventId: details.eventId ?? (track === 'open-invention' ? 'gibc-v2-2026' : 'sanity-2026'),
      name,
      track,
      entriesPerPath: null,
      seeksMultiplePrizes: null,
    }),
    report: null,
    previousReport: null,
    question: '',
    answer: null,
  };
}

export function updateReview(
  workspace: ReviewWorkspace,
  id: string,
  patch: Partial<
    Pick<PersonalReview, 'dossier' | 'report' | 'previousReport' | 'question' | 'answer'>
  >,
): ReviewWorkspace {
  const current = workspace.reviews.find((r) => r.id === id);
  if (!current || current.archived) return workspace;
  if (
    Object.entries(patch).every(
      ([key, value]) =>
        JSON.stringify(current[key as keyof PersonalReview]) === JSON.stringify(value),
    )
  )
    return workspace;
  return {
    ...workspace,
    reviews: workspace.reviews.map((r) =>
      r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r,
    ),
  };
}

export function reviewIsStale(review: PersonalReview) {
  return Boolean(
    review.report && JSON.stringify(review.dossier) !== JSON.stringify(review.report.dossier),
  );
}

const portableReviewSchema = z
  .object({
    id: z.uuid(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    archived: z.boolean(),
    dossier: draftSchema,
  })
  .strict();
const backupSchema = z
  .object({
    format: z.literal('fineprint-review-backup'),
    version: z.union([z.literal(1), z.literal(2)]),
    event: z.enum(['sanity-2026', 'multiple']),
    exportedAt: z.iso.datetime(),
    reviews: z.array(portableReviewSchema).min(1).max(maxReviews),
  })
  .strict();

export function exportWorkspace(workspace: ReviewWorkspace) {
  return JSON.stringify(
    {
      format: 'fineprint-review-backup',
      version: 2,
      event: 'multiple',
      exportedAt: new Date().toISOString(),
      reviews: workspace.reviews.map(({ id, createdAt, updatedAt, archived, dossier }) => ({
        id,
        createdAt,
        updatedAt,
        archived,
        dossier,
      })),
    },
    null,
    2,
  );
}

export function importWorkspace(raw: string, current: ReviewWorkspace) {
  if (new TextEncoder().encode(raw).length > maxBackupBytes)
    throw new Error('This file is too large. Choose a FinePrint backup under 500 KB.');
  let parsed: z.infer<typeof backupSchema>;
  try {
    parsed = backupSchema.parse(JSON.parse(raw));
  } catch {
    throw new Error('Choose a FinePrint review backup. Your existing reviews have not changed.');
  }
  const next = [...current.reviews];
  let imported = 0;
  for (const item of parsed.reviews) {
    const existing = next.find((r) => r.id === item.id);
    if (
      next.some(
        (r) =>
          (r.id === item.id || r.importedFrom === item.id) &&
          JSON.stringify(r.dossier) === JSON.stringify(item.dossier),
      )
    )
      continue;
    // Keep both copies when facts differ. A backup never overwrites current work.
    next.push({
      ...item,
      id: existing ? crypto.randomUUID() : item.id,
      ...(existing ? { importedFrom: item.id } : {}),
      report: null,
      previousReport: null,
      question: '',
      answer: null,
    });
    imported++;
  }
  if (next.length > maxReviews)
    throw new Error(
      'This import would exceed 30 reviews on this device. No reviews were imported.',
    );
  return { workspace: { ...current, reviews: next }, imported };
}

/** Only valid, explicitly stated facts may replace a user's existing answers. */
export function mergeAnswerFacts(current: Dossier, answer: AskResponse): Dossier {
  if (current.eventId !== answer.report.packId) return current;
  const stated: Record<string, unknown> = {};
  for (const fact of answer.facts) {
    if (
      fact.status !== 'stated' ||
      ['name', 'evidenceNote', 'track'].includes(fact.key) ||
      !Object.hasOwn(dossierSchema.shape, fact.key)
    )
      continue;
    const parsed = dossierSchema.shape[fact.key as keyof Dossier].safeParse(fact.value);
    if (parsed.success) stated[fact.key] = parsed.data;
  }
  return {
    ...current,
    ...stated,
    name: current.name.trim() || 'My project',
    track: answer.report.dossier.track,
  };
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
export function persistWorkspace(
  storage: StorageLike,
  workspace: ReviewWorkspace,
  expected: string | null,
) {
  if (storage.getItem(workspaceKey) !== expected)
    throw new Error(
      'Reviews changed in another tab. Reload to use the latest saved copy, or download a backup of this copy first.',
    );
  const next = JSON.stringify(workspaceSchema.parse(workspace));
  if (next !== expected) storage.setItem(workspaceKey, next);
  return next;
}

export function nextFact(report: Report | null) {
  for (const finding of report?.findings ?? []) {
    if (finding.status !== 'missing') continue;
    const field = finding.missingFacts.find((key) => key in dossierSchema.shape);
    if (field)
      return {
        field: field as keyof Dossier,
        title: finding.rule.title,
        question: finding.rule.question,
      };
  }
  return null;
}
