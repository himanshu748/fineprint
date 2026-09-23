/** Publish public rule records only. Existing version records are immutable. */
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { createClient } from '@sanity/client';
import { eventIdSchema } from '../src/lib/model';
import { savedPacks } from '../src/lib/events';
import { validateRulePack } from '../src/lib/sanity';

const eventId = eventIdSchema.parse(process.argv[2]);
const pack = validateRulePack(savedPacks[eventId]);
let token = process.env.SANITY_WRITE_TOKEN;
if (!token && process.argv.includes('--use-cli-auth')) {
  const auth = JSON.parse(await readFile(`${homedir()}/.config/sanity/config.json`, 'utf8'));
  token = auth.authToken;
}
if (!token) throw new Error('Use a write token or explicitly select existing CLI authentication.');
const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  apiVersion: '2026-09-01',
  useCdn: false,
  token,
});
const prefix = `fineprint-${eventId}`;
const suffix = pack.version.replaceAll('.', '-');
const ref = (_ref: string) => ({ _type: 'reference', _ref, _key: _ref });
const versions: { _id: string; _type: string; [key: string]: unknown }[] = [];
for (const { id, ...fields } of pack.sources)
  versions.push({
    _id: `${prefix}-source-${id}-${suffix}`,
    _type: 'sourceVersion',
    sourceId: id,
    eventId,
    packVersion: pack.version,
    ...fields,
  });
for (const { id, sources, ...fields } of pack.requirements)
  versions.push({
    _id: `${prefix}-rule-${id}-${suffix}`,
    _type: 'requirement',
    ruleId: id,
    eventId,
    packVersion: pack.version,
    ...fields,
    sources: sources.map((id) => ref(`${prefix}-source-${id}-${suffix}`)),
  });
const { id, sources, requirements, ...fields } = pack;
const competition = {
  _id: prefix,
  _type: 'competition',
  eventId: id,
  ...fields,
  sourceVersions: sources.map((s) => ref(`${prefix}-source-${s.id}-${suffix}`)),
  requirements: requirements.map((r) => ref(`${prefix}-rule-${r.id}-${suffix}`)),
};
const canonical = (value: unknown) =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item)
            .filter(([key]) => !['_rev', '_createdAt', '_updatedAt'].includes(key))
            .sort(([a], [b]) => a.localeCompare(b)),
        )
      : item,
  );
const existing = await client.getDocuments(versions.map((document) => document._id));
for (let i = 0; i < existing.length; i++)
  if (existing[i] && canonical(existing[i]) !== canonical(versions[i]))
    throw new Error(
      'A published source version differs. Increment the pack version; never overwrite its history.',
    );
let transaction = client.transaction();
for (const document of versions) transaction = transaction.createIfNotExists(document);
await transaction.createOrReplace(competition).commit();
console.log(
  `Published ${eventId} / ${pack.version}: ${requirements.length} requirements and ${sources.length} sources. No project facts were uploaded.`,
);
