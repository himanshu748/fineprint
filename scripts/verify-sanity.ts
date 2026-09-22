import { loadRulePack } from '../src/lib/sanity';
const { pack, mode } = await loadRulePack();
if (mode !== 'sanity')
  throw new Error(
    'A local snapshot is not a live Sanity verification. Configure the project and dataset first.',
  );
console.log(
  `Verified Sanity Content Lake: ${pack.requirements.length} requirements, ${pack.sources.length} sources, version ${pack.version}. Context MCP must be verified separately.`,
);
