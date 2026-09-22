import { writeFile } from 'node:fs/promises';
import { withContext, explainWithSources } from '../src/lib/source-agent';
import { loadRulePack } from '../src/lib/sanity';
import { checkDossier } from '../src/lib/engine';
import { examples } from '../src/lib/rules';
const tools = await withContext(async (client) =>
  (await client.listTools()).tools.map((t) => t.name),
);
console.log(JSON.stringify({ contextTools: tools }));
const { pack, mode } = await loadRulePack();
const results = [];
for (const index of [2, 1]) {
  const report = checkDossier(examples[index].dossier, pack, undefined, mode);
  const finding = report.findings.find(
    (f) => f.rule.id === (index === 2 ? 'entry-limit' : 'origin'),
  )!;
  const answer = await explainWithSources(report, finding);
  if (answer.status !== finding.status || !answer.paths.length)
    throw new Error('The source response did not preserve the check or cite a retrieved entry.');
  const result = {
    scenario: examples[index].name,
    ruleId: finding.rule.id,
    engineStatus: finding.status,
    ...answer,
  };
  results.push(result);
  console.log(JSON.stringify(result, null, 2));
  await writeFile(
    'evaluation/live-context.json',
    JSON.stringify(
      {
        verifiedAt: new Date().toISOString(),
        sourceMode: mode,
        packVersion: pack.version,
        tools,
        results,
      },
      null,
      2,
    ) + '\n',
  );
}
