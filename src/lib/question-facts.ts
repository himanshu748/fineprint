import { z } from 'zod';
import { dossierSchema, factLabels, type Dossier, type FactKey, type RulePack } from './model';
import type { FactResult } from './agent-schema';

export const extractableFacts = [
  'track',
  'origin',
  'startedAt',
  'teamSize',
  'adultTeam',
  'eligibleResidency',
  'devMembership',
  'excludedAffiliation',
  'priorWorkCredited',
  'substantialNewWork',
  'usesSanity',
  'usesContext',
  'usesKnowledgeBase',
  'aiBuilt',
  'supportedFrontend',
  'entriesPerPath',
  'separatePosts',
  'englishSubmission',
  'requiresLogin',
  'judgeAccess',
  'projectIdentifier',
  'publishedPost',
  'hasChallengeTag',
  'seeksMultiplePrizes',
] as const satisfies readonly FactKey[];

export type ExtractableFact = (typeof extractableFacts)[number];
export type RejectedFact = { key: string; reason: string };
type Normalized = { value: string | number | boolean; note?: string } | { reject: string };

const valueGuide: Partial<Record<ExtractableFact, string>> = {
  track: '"path-one", "path-two" or "both"',
  origin:
    '"new" (a new application), "components" (a new application reusing earlier components) or "existing" (the application itself existed before the event)',
  startedAt:
    '{"year":null,"month":8,"day":null,"time":null,"utcOffset":null} with null for every part not stated; time is "HH:MM", utcOffset is "Z" or "+05:30"',
  teamSize: 'an integer',
  entriesPerPath: 'an integer: separate entries planned in the same path',
  projectIdentifier: 'the Sanity project ID or public dataset URL exactly as written',
};

/** The fact keys and value formats the agent may use, keyed like the dossier. */
export function factGuide(): Record<ExtractableFact, string> {
  return Object.fromEntries(
    extractableFacts.map((key) => [
      key,
      `${factLabels[key]}. Value: ${valueGuide[key] ?? 'true or false'}`,
    ]),
  ) as Record<ExtractableFact, string>;
}

const proposalSchema = z.object({
  key: z.string().max(60),
  value: z.unknown(),
  quote: z.string().max(300),
});
const datePartsSchema = z.object({
  year: z.number().int().min(1990).max(2100).nullish(),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31).nullish(),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullish(),
  utcOffset: z
    .string()
    .regex(/^(Z|[+-](0\d|1[0-4]):[0-5]\d)$/)
    .nullish(),
});
type DateParts = z.infer<typeof datePartsSchema>;

const months = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];
const numberWords = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
  'twenty',
];
const trackWords: Record<Dossier['track'], RegExp> = {
  'path-one': /\bpath\s*(one|1)\b/,
  'path-two': /\bpath\s*(two|2)\b/,
  both: /\b(both|each)\b|\b(two|all) paths\b/,
};
const originWords: Record<NonNullable<Dossier['origin']>, RegExp> = {
  new: /\bnew\b|from scratch|\bfresh\b/,
  components:
    /\breus|\bcomponents?\b|\blibrar(y|ies)\b|\btemplates?\b|\bboilerplate\b|\bprior work\b/,
  existing:
    /\bexisting\b|\balready\b|\bexisted\b|\bold(er)?\b|\bprevious(ly)?\b|\bbefore the (event|challenge|contest|competition|hackathon)\b/,
};
const factWords: Partial<Record<ExtractableFact, RegExp>> = {
  adultTeam: /\b(adults?|age|aged|years? old|18|minors?|legal)\b/,
  eligibleResidency: /\b(resid\w*|live|lives|living|based|countr(y|ies)|citizens?|sanction\w*)\b/,
  devMembership: /\b(dev|accounts?|members?|membership)\b/,
  excludedAffiliation:
    /\b(employ\w*|work(s|ed)? (at|for)|affiliat\w*|family|household|relatives?|organi[sz]ers?)\b/,
  priorWorkCredited: /\b(credit\w*|attribut\w*|acknowledg\w*|cite[sd]?)\b/,
  substantialNewWork:
    /\b(new work|substantial\w*|significant\w*|rewr\w*|rebuil\w*|changes?|new features?)\b/,
  usesSanity: /\bsanity\b/,
  usesContext: /\b(context|mcp)\b/,
  usesKnowledgeBase: /\bknowledge ?base\b|\bkb\b/,
  aiBuilt: /\b(ai|copilot|cursor|claude|codex|agents?|llms?|gpt|vibe[- ]?cod\w*)\b/,
  supportedFrontend: /\b(next(\.?js)?|astro|frontend|front-end)\b/,
  separatePosts: /\b(posts?|articles?|write-?ups?|submissions?)\b/,
  englishSubmission:
    /\b(english|language|spanish|french|german|hindi|portuguese|japanese|chinese|translat\w*)\b/,
  requiresLogin: /\b(login|log in|sign ?in|sign ?up|accounts?|passwords?|auth\w*)\b/,
  judgeAccess:
    /\b(judges?|credentials?|test accounts?|demo accounts?|access|passwords?|instructions)\b/,
  publishedPost: /\b(publish\w*|posted|drafts?|submitted)\b/,
  hasChallengeTag: /\b(tags?|tagged|sanitychallenge)\b/,
  seeksMultiplePrizes: /\b(prizes?|win|winning|awards?)\b/,
};

function simplify(text: string) {
  return text
    .toLowerCase()
    .replace(/[‘’`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function inQuestion(question: string, quote: string) {
  const needle = simplify(quote)
    .replace(/^["'\s]+/, '')
    .replace(/["'.,!?;:\s]+$/, '');
  return needle.length >= 2 && simplify(question).includes(needle);
}

function mentionsNumber(text: string, value: number) {
  if (new RegExp(`(^|\\D)${value}(\\D|$)`).test(text)) return true;
  if (numberWords[value] && new RegExp(`\\b${numberWords[value]}\\b`).test(text)) return true;
  return value === 1 && /\b(solo|alone|myself|just me|on my own)\b/.test(text);
}

function mentionsMonth(text: string, month: number) {
  const name = months[month - 1];
  return (
    new RegExp(`\\b${name.slice(0, 3)}(${name.slice(3)}|t)?\\b`).test(text) ||
    new RegExp(`(^|\\D)0?${month}(\\D|$)`).test(text)
  );
}

function dateParts(value: unknown): DateParts | null {
  if (typeof value === 'string') {
    const match =
      /^(\d{4})-(\d{2})(?:-(\d{2})(?:T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?)?$/.exec(
        value.trim(),
      );
    if (!match) return null;
    value = {
      year: Number(match[1]),
      month: Number(match[2]),
      day: match[3] ? Number(match[3]) : null,
      time: match[4] ?? null,
      utcOffset: match[5] ?? null,
    };
  }
  const parsed = datePartsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function normalizeStart(value: unknown, quote: string, pack: RulePack): Normalized {
  const parts = dateParts(value);
  if (!parts) return { reject: 'Not a valid date for this fact' };
  const text = simplify(quote);
  if (parts.year && !text.includes(String(parts.year)) && /\b20\d{2}\b/.test(text))
    return { reject: 'The quoted year differs from the proposed year' };
  if (!mentionsMonth(text, parts.month))
    return { reject: 'The quoted words do not state this month' };
  if (parts.day && !new RegExp(`(^|\\D)0?${parts.day}(st|nd|rd|th)?(\\D|$)`).test(text))
    return { reject: 'The quoted words do not state this day' };
  const notes: string[] = [];
  let year = parts.year && text.includes(String(parts.year)) ? parts.year : null;
  if (year === null) {
    const first = new Date(pack.start).getUTCFullYear();
    if (first !== new Date(pack.deadline).getUTCFullYear())
      return { reject: 'The year is not stated and the entry period spans two years' };
    year = first;
    notes.push(`Year not stated, so ${year} is used: the year of this challenge's entry period.`);
  }
  const month = String(parts.month).padStart(2, '0');
  let result = `${year}-${month}`;
  if (parts.day) {
    result += `-${String(parts.day).padStart(2, '0')}`;
    if (
      parts.time &&
      parts.utcOffset &&
      text.includes(parts.time.toLowerCase()) &&
      text.includes(parts.utcOffset.toLowerCase())
    )
      result += `T${parts.time}:00${parts.utcOffset}`;
    else if (parts.time) notes.push('A time without a time zone was not used.');
  }
  if (!dossierSchema.shape.startedAt.safeParse(result).success)
    return { reject: 'Not a valid date for this fact' };
  return { value: result, ...(notes.length ? { note: notes.join(' ') } : {}) };
}

function coerce(key: ExtractableFact, value: unknown) {
  if (typeof value !== 'string') return value;
  if ((key === 'teamSize' || key === 'entriesPerPath') && /^\d+$/.test(value.trim()))
    return Number(value.trim());
  if (/^(true|false)$/i.test(value.trim()) && key !== 'projectIdentifier')
    return value.trim().toLowerCase() === 'true';
  return value;
}

function normalize(key: ExtractableFact, raw: unknown, quote: string, pack: RulePack): Normalized {
  if (key === 'startedAt') return normalizeStart(raw, quote, pack);
  const value = coerce(key, raw);
  if (value === null || value === undefined || value === '')
    return { reject: 'No value was given' };
  const parsed = (dossierSchema.shape[key] as z.ZodType<Dossier[typeof key]>).safeParse(value);
  if (!parsed.success || parsed.data === null) return { reject: 'Not a valid value for this fact' };
  const result = parsed.data as string | number | boolean;
  const text = simplify(quote);
  if (/\b(unsure|uncertain|not sure|don't know|do not know|might|maybe)\b/.test(text))
    return { reject: 'The quoted words leave this fact uncertain' };
  if (typeof result === 'boolean') {
    if (/^(can|could|should|must|do|does|did|is|are|would|will)\b/.test(text))
      return { reject: 'A question about a requirement does not establish the fact' };
    if (
      result &&
      /\b(not|no|never|without|don't|doesn't|didn't|haven't|hasn't|isn't|aren't|won't|can't)\b/.test(
        text,
      )
    )
      return { reject: 'The quote contains a negation; review this fact manually' };
    if (result && /\b(plan|planning|intend|will|going to|hope)\b/.test(text))
      return { reject: 'A planned action does not establish completed work' };
  }
  if ((key === 'teamSize' || key === 'entriesPerPath') && !mentionsNumber(text, result as number))
    return { reject: 'The quoted words do not state this number' };
  if (key === 'track' && !trackWords[result as Dossier['track']].test(text))
    return { reject: 'The quoted words do not name this path' };
  if (key === 'projectIdentifier' && !text.includes(simplify(String(result))))
    return { reject: 'The quoted words do not contain this identifier' };
  if (key === 'origin' && !originWords[result as NonNullable<Dossier['origin']>].test(text))
    return { reject: 'The quoted words do not describe this project history' };
  if (factWords[key] && !factWords[key].test(text))
    return { reject: 'The quoted words do not mention this fact' };
  if (key === 'englishSubmission' && !/\b(submission|post|article|write-?up)\b/.test(text))
    return { reject: 'The quote does not state the submission language' };
  if (
    key === 'teamSize' &&
    !/\b(team|people|persons?|members?|solo|alone|myself|just me|on my own)\b/.test(text)
  )
    return { reject: 'The quote does not describe the team' };
  if (key === 'entriesPerPath' && !/\b(entries|entry|submissions?|projects?)\b/.test(text))
    return { reject: 'The quote does not describe entries' };
  if (
    key === 'eligibleResidency' &&
    result === true &&
    !/\b(eligible|meet|meets|checked|satisfy|satisfies)\b/.test(text)
  )
    return { reject: 'A location alone does not establish all residency conditions' };
  return { value: result };
}

const isExtractable = (key: string): key is ExtractableFact =>
  (extractableFacts as readonly string[]).includes(key);

/**
 * Keeps only facts the question states: each needs its exact words from the question and a
 * value those words support. Every other fact stays unknown and never overrides the form.
 */
export function readQuestionFacts(question: string, proposals: unknown[], pack: RulePack) {
  const stated = new Map<ExtractableFact, Extract<FactResult, { status: 'stated' }>>();
  const duplicates = new Set<string>();
  const rejected: RejectedFact[] = [];
  for (const proposal of proposals.slice(0, 30)) {
    const parsed = proposalSchema.safeParse(proposal);
    if (!parsed.success) {
      const key =
        typeof (proposal as { key?: unknown })?.key === 'string'
          ? String((proposal as { key: string }).key).slice(0, 60)
          : 'unknown';
      rejected.push({ key, reason: 'Not in the expected fact format' });
      continue;
    }
    const { key, value, quote } = parsed.data;
    if (!isExtractable(key)) {
      rejected.push({ key, reason: 'Not a fact FinePrint tracks' });
      continue;
    }
    if (stated.has(key) || duplicates.has(key)) {
      stated.delete(key);
      duplicates.add(key);
      rejected.push({ key, reason: 'Stated more than once; review this fact manually' });
      continue;
    }
    if (!inQuestion(question, quote)) {
      rejected.push({ key, reason: 'The quoted words are not in the question' });
      continue;
    }
    const normalized = normalize(key, value, quote, pack);
    if ('reject' in normalized) {
      rejected.push({ key, reason: normalized.reject });
      continue;
    }
    stated.set(key, {
      key,
      label: factLabels[key],
      status: 'stated',
      value: normalized.value,
      quote: quote.trim(),
      ...(normalized.note ? { note: normalized.note } : {}),
    });
  }
  const facts: FactResult[] = extractableFacts.map(
    (key) => stated.get(key) ?? { key, label: factLabels[key], status: 'unknown', value: null },
  );
  const patch = Object.fromEntries(
    [...stated.values()].map((fact) => [fact.key, fact.value]),
  ) as Partial<Dossier>;
  return { facts, rejected, patch };
}
