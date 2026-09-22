import { writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { rulePackSchema, dossierSchema } from '../src/lib/model';
await writeFile(
  'sanity/rule-pack.schema.json',
  JSON.stringify(z.toJSONSchema(rulePackSchema), null, 2) + '\n',
);
await writeFile(
  'sanity/dossier.schema.json',
  JSON.stringify(z.toJSONSchema(dossierSchema), null, 2) + '\n',
);
console.log(
  'Exported the schema for the dereferenced public rule pack and private local dossiers.',
);
