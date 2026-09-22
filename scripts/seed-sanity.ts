import { sanityClient } from '../src/lib/sanity';
import { rulePack } from '../src/lib/rules';
const client = sanityClient(true);
const ref = (_ref: string) => ({ _type: 'reference', _ref, _key: _ref.replaceAll('.', '-') });
let tx = client.transaction();
for (const source of rulePack.sources) {
  const { id, ...fields } = source;
  tx = tx.createOrReplace({
    _id: `fineprint-source-${id}-${rulePack.version.replaceAll('.', '-')}`,
    _type: 'sourceVersion',
    sourceId: id,
    ...fields,
  });
}
for (const rule of rulePack.requirements) {
  const { id, sources, ...fields } = rule;
  tx = tx.createOrReplace({
    _id: `fineprint-rule-${id}-${rulePack.version.replaceAll('.', '-')}`,
    _type: 'requirement',
    ruleId: id,
    ...fields,
    sources: sources.map((id) =>
      ref(`fineprint-source-${id}-${rulePack.version.replaceAll('.', '-')}`),
    ),
  });
}
const { id, sources, requirements, ...fields } = rulePack;
tx = tx.createOrReplace({
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
await tx.commit();
console.log(
  `Seeded ${sources.length} source versions and ${requirements.length} linked requirements. No user dossiers were uploaded.`,
);
