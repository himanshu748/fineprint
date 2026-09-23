import { z } from 'zod';
export const rubricIdSchema = z.enum(['sanity-path-one', 'sanity-path-two', 'gibc-open']);
export const rubricSchema = z.object({
  id: rubricIdSchema,
  eventId: z.string(),
  title: z.string(),
  version: z.string(),
  sourceUrl: z.string().url(),
  capturedAt: z.string(),
  criteria: z
    .array(z.object({ id: z.string(), title: z.string(), guidance: z.string() }))
    .length(4),
});
export type Rubric = z.infer<typeof rubricSchema>;
export const rubrics: Rubric[] = [
  {
    id: 'sanity-path-one',
    eventId: 'sanity-2026',
    title: 'Sanity · Path One',
    version: '2026-09-23.1',
    capturedAt: '2026-09-23',
    sourceUrl: 'https://dev.to/challenges/sanity-2026-09-16',
    criteria: [
      {
        id: 'structured-content',
        title: 'Meaningful use of Sanity Context and structured content',
        guidance:
          'Look for content schemas, references and retrieval that change application behavior. A dependency or README claim alone does not demonstrate meaningful use.',
      },
      {
        id: 'technical-quality',
        title: 'Technical implementation and code quality',
        guidance:
          'Inspect implementation, validation, error handling and meaningful tests. Do not claim tests passed or deployed behavior from source alone.',
      },
      {
        id: 'knowledge-bases',
        title: 'Use of Knowledge Bases',
        guidance:
          'Look for actual Knowledge Base retrieval and use of the retrieved entries, with source attribution. Configuration alone is insufficient.',
      },
      {
        id: 'usability',
        title: 'Usability',
        guidance:
          'Inspect task flow, accessibility, loading and failure states. Runtime usability and visual quality still need a live demonstration.',
      },
    ],
  },
  {
    id: 'sanity-path-two',
    eventId: 'sanity-2026',
    title: 'Sanity · Path Two',
    version: '2026-09-23.1',
    capturedAt: '2026-09-23',
    sourceUrl: 'https://dev.to/challenges/sanity-2026-09-16',
    criteria: [
      {
        id: 'build-writeup',
        title: 'Quality and honesty of the build process writeup',
        guidance:
          'Look for specific build decisions, agent contributions, changes and limitations. A repository draft does not prove a published submission.',
      },
      {
        id: 'functionality',
        title: 'Functionality of the finished app',
        guidance:
          'Inspect complete workflows and failure handling. Source code is implementation evidence, not proof of successful live execution.',
      },
      {
        id: 'schema',
        title: 'Thoughtfulness of the schema behind it',
        guidance:
          'Inspect Sanity schemas, relationships, validation and the application behavior these enable.',
      },
      {
        id: 'creativity',
        title: 'Creativity and originality',
        guidance:
          'Identify concrete design decisions and claimed differentiation. Global originality cannot be established by inspecting one repository.',
      },
    ],
  },
  {
    id: 'gibc-open',
    eventId: 'gibc-v2-2026',
    title: 'GIBC V2 · Open Invention',
    version: '2026-09-23.1',
    capturedAt: '2026-09-23',
    sourceUrl: 'https://gibc-v2.devpost.com/',
    criteria: [
      {
        id: 'creativity',
        title: 'Creativity',
        guidance:
          'Identify the concept and distinctive implementation decisions. Originality relative to other projects requires external comparison.',
      },
      {
        id: 'execution',
        title: 'Execution',
        guidance:
          'Inspect technical quality, complete workflows, tests, polish and usability evidence. Do not infer successful execution from code existence.',
      },
      {
        id: 'impact',
        title: 'Impact',
        guidance:
          'Look for a concrete problem, intended users and measured outcomes. Potential or documentation claims are not verified user impact.',
      },
      {
        id: 'presentation',
        title: 'Presentation',
        guidance:
          'Look for setup instructions, demo materials and a clear explanation. A linked video is not proof it was watched or is accessible.',
      },
    ],
  },
];
