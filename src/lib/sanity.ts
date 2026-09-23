import { createClient } from '@sanity/client';
import {
  dossierSchema,
  rulePackSchema,
  type RulePack,
  type Expression,
  type EventId,
} from './model';
import { savedPacks } from './events';
import { modalConfigured } from './modal';

export function sanityClient(write = false) {
  const projectId = process.env.SANITY_PROJECT_ID;
  const dataset = process.env.SANITY_DATASET;
  if (!projectId || !dataset) throw new Error('Sanity project and dataset are not configured.');
  if (write && !process.env.SANITY_WRITE_TOKEN)
    throw new Error('A server-side Sanity write token is required.');
  return createClient({
    projectId,
    dataset,
    apiVersion: '2026-09-01',
    useCdn: false,
    token: write ? process.env.SANITY_WRITE_TOKEN : process.env.SANITY_READ_TOKEN,
    perspective: 'published',
  });
}

export function validateRulePack(raw: unknown): RulePack {
  const pack = rulePackSchema.parse(raw);
  if (!pack.requirements.length || pack.requirements.length > 80)
    throw new Error('Unexpected requirement count.');
  const sources = new Set(pack.sources.map((source) => source.id));
  if (
    new Set(pack.requirements.map((r) => r.id)).size !== pack.requirements.length ||
    sources.size !== pack.sources.length
  )
    throw new Error('Duplicate rule or source identifiers.');
  for (const source of pack.sources) {
    const url = new URL(source.url);
    const host = pack.id === 'sanity-2026' ? 'dev.to' : 'gibc-v2.devpost.com';
    if (url.protocol !== 'https:' || url.hostname !== host || url.username || url.password)
      throw new Error('The curated pack references an unapproved source.');
  }
  const facts = new Set([
    ...Object.keys(dossierSchema.shape),
    '$now',
    '$start',
    '$deadline',
    '$startedAt',
  ]);
  function validateExpression(expression: Expression, depth = 0) {
    if (depth > 8) throw new Error('A rule is nested too deeply.');
    if ('fact' in expression && !facts.has(expression.fact))
      throw new Error('A rule references an unknown fact.');
    if ('expressions' in expression)
      expression.expressions.forEach((child) => validateExpression(child, depth + 1));
  }
  for (const rule of pack.requirements) {
    if (rule.sources.some((id) => !sources.has(id)))
      throw new Error('A rule has an unknown source.');
    validateExpression(rule.check);
    if (rule.appliesWhen) validateExpression(rule.appliesWhen);
  }
  return pack;
}

export async function loadRulePack(
  eventId: EventId = 'sanity-2026',
): Promise<{ pack: RulePack; mode: 'snapshot' | 'sanity' }> {
  if (!process.env.SANITY_PROJECT_ID || !process.env.SANITY_DATASET)
    return { pack: savedPacks[eventId], mode: 'snapshot' };
  const record = await sanityClient().fetch(
    `*[_type == "competition" && _id == $documentId && eventId == $eventId][0]{
    "id": eventId, version, title, start, deadline, updatedAt, reviewNote,
    "sources": sourceVersions[]->{"id":sourceId,title,url,publisher,capturedAt,version,authority,quote,summary},
    "requirements": requirements[]->{"id":ruleId,title,scope,category,summary,"sources":sources[]->sourceId,check,appliesWhen,question,correction,review,rationale}
  }`,
    { documentId: `fineprint-${eventId}`, eventId },
    { timeout: 15_000 },
  );
  if (!record) throw new Error('FinePrint’s curated Sanity rule pack has not been seeded.');
  // Sanity represents missing optional fields as null; the typed pack represents them as absent.
  for (const requirement of record.requirements ?? [])
    if (requirement.appliesWhen === null) delete requirement.appliesWhen;
  const pack = validateRulePack(record);
  if (pack.id !== eventId) throw new Error('The returned event does not match the request.');
  return { pack, mode: 'sanity' };
}

export function connectionState() {
  return {
    rules: !!(process.env.SANITY_PROJECT_ID && process.env.SANITY_DATASET),
    context: !!(process.env.SANITY_CONTEXT_URL && process.env.SANITY_CONTEXT_TOKEN),
    model: modalConfigured(),
    persistence: !!process.env.SANITY_WRITE_TOKEN,
  };
}
