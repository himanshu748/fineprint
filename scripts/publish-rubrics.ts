import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { createClient } from '@sanity/client';
import { rubrics } from '../src/lib/rubrics';
if (!process.argv.includes('--use-cli-auth'))
  throw new Error('Explicit CLI authentication required.');
const auth = JSON.parse(await readFile(`${homedir()}/.config/sanity/config.json`, 'utf8'));
const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: process.env.SANITY_DATASET,
  apiVersion: '2026-09-01',
  useCdn: false,
  token: auth.authToken,
});
let tx = client.transaction();
for (const { id, ...rubric } of rubrics)
  tx = tx.createIfNotExists({
    _id: `fineprint-rubric-${id}-${rubric.version.replaceAll('.', '-')}`,
    _type: 'reviewRubric',
    rubricId: id,
    ...rubric,
    title: `${rubric.title} judging rubric`,
    competition: { _type: 'reference', _ref: `fineprint-${rubric.eventId}` },
    note: 'Criterion names are official. Guidance is FinePrint editorial guidance, not additional organizer requirements.',
  });
await tx.commit();
console.log('Published three public rubric records. No repository content uploaded.');
