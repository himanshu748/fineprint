import { writeFile } from 'node:fs/promises';
import { rulePack } from '../src/lib/rules';
const ref = (_ref: string) => ({ _type: 'reference', _ref, _key: _ref.replaceAll('.', '-') });
const documents: unknown[] = [];
for (const { id, ...fields } of rulePack.sources)
  documents.push({
    _id: `fineprint-source-${id}-${rulePack.version.replaceAll('.', '-')}`,
    _type: 'sourceVersion',
    sourceId: id,
    ...fields,
  });
for (const { id, sources, ...fields } of rulePack.requirements)
  documents.push({
    _id: `fineprint-rule-${id}-${rulePack.version.replaceAll('.', '-')}`,
    _type: 'requirement',
    ruleId: id,
    ...fields,
    sources: sources.map((id) =>
      ref(`fineprint-source-${id}-${rulePack.version.replaceAll('.', '-')}`),
    ),
  });
const { id, sources, requirements, ...fields } = rulePack;
documents.push({
  _id: 'fineprint-sanity-2026',
  _type: 'competition',
  eventId: id,
  ...fields,
  sourceVersions: sources.map((s) =>
    ref(`fineprint-source-${s.id}-${rulePack.version.replaceAll('.', '-')}`),
  ),
  requirements: requirements.map((r) =>
    ref(`fineprint-rule-${r.id}-${rulePack.version.replaceAll('.', '-')}`),
  ),
});
await writeFile(
  '../../work/fineprint-seed.ndjson',
  documents.map((d) => JSON.stringify(d)).join('\n') + '\n',
);
console.log(`Prepared ${documents.length} curated rule documents. No project dossiers.`);
