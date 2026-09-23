import { z } from 'zod';
import { sanityClient } from './sanity';
import { rubricIdSchema, rubricSchema, rubrics } from './rubrics';
export async function loadRubric(id: z.infer<typeof rubricIdSchema>) {
  const record = await sanityClient().fetch(
    '*[_type == "reviewRubric" && rubricId == $id] | order(version desc)[0]',
    { id },
    { timeout: 15000 },
  );
  const result = rubricSchema.parse(record && { ...record, id: record.rubricId });
  const expected = rubrics.find((r) => r.id === id)!;
  if (
    result.eventId !== expected.eventId ||
    result.sourceUrl !== expected.sourceUrl ||
    new Set(result.criteria.map((c) => c.id)).size !== 4
  )
    throw new Error('Invalid published rubric.');
  return result;
}
