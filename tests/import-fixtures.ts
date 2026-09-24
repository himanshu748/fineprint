import type { Getter, RawResponse } from '../src/lib/page-fetch';
import type { PreparedImport } from '../src/lib/rule-import';

export const rulesHtml = `<!doctype html><html><head><title>Example Hack · Rules</title>
<style>.x{color:red}</style><script>window.secret = "not rules text";</script></head>
<body><nav>Home</nav><main><h1>Example Hack Official Rules</h1>
<p>The hackathon opens on October 1, 2026 at 9:00 AM UTC and submissions close on October 20, 2026 at 5:00 PM UTC.</p>
<ul><li>Teams may have up to four members.</li>
<li>Participants must be at least 18 years old.</li>
<li>Projects must be newly created during the submission period.</li>
<li>Submit a public code repository and a demo video no longer than 3 minutes.</li>
<li>Entrants in the Climate track must use an open climate dataset.</li>
<li>Be kind to the volunteers &amp; mentors.</li></ul>
<p>Judging considers creativity, impact and polish. Additional filler text keeps this page long enough to be treated as readable content by the importer.</p>
</main></body></html>`;

export function response(
  status: number,
  headers: Record<string, string>,
  body = '',
): RawResponse & { cancelled: () => boolean } {
  let cancelled = false;
  return {
    status,
    headers,
    body: (async function* () {
      yield new TextEncoder().encode(body);
    })(),
    cancel: () => {
      cancelled = true;
    },
    cancelled: () => cancelled,
  };
}

export const htmlGetter =
  (html = rulesHtml): Getter =>
  async () =>
    response(200, { 'content-type': 'text/html; charset=utf-8' }, html);

export const publicResolver = async () => [{ address: '93.184.215.14', family: 4 }];

export function modelOutput(overrides: Record<string, unknown> = {}) {
  return {
    event: {
      name: 'Example Hack',
      start: {
        iso: '2026-10-01T09:00:00+00:00',
        quote: 'The hackathon opens on October 1, 2026 at 9:00 AM UTC',
      },
      deadline: {
        iso: '2026-10-20T17:00:00+00:00',
        quote: 'submissions close on October 20, 2026 at 5:00 PM UTC',
      },
      tracks: ['Climate'],
    },
    requirements: [
      {
        title: 'Team size',
        quote: 'Teams may have up to four members.',
        kind: 'team-size-max',
        value: 4,
        track: null,
        scope: 'entry',
      },
      {
        title: 'Minimum age',
        quote: 'Participants must be at least 18 years old.',
        kind: 'minimum-age',
        value: 18,
        track: null,
        scope: 'entry',
      },
      {
        title: 'Built during the event',
        quote: 'Projects must be newly created during the submission period.',
        kind: 'build-window',
        value: null,
        track: null,
        scope: 'entry',
      },
      {
        title: 'Video length',
        quote: 'Submit a public code repository and a demo video no longer than 3 minutes.',
        kind: 'video-max-minutes',
        value: 3,
        track: null,
        scope: 'submission',
      },
      {
        title: 'Climate dataset',
        quote: 'Entrants in the Climate track must use an open climate dataset.',
        kind: 'check-yourself',
        value: null,
        track: 'Climate',
        scope: 'path',
      },
      {
        title: 'Invented approval',
        quote: 'Existing projects are welcome if they add one feature.',
        kind: 'new-work',
        value: null,
        track: null,
        scope: 'entry',
      },
    ],
    ...overrides,
  };
}

export function prepared(text: string): PreparedImport {
  return {
    host: 'example.devpost.com',
    contentHash: 'a'.repeat(64),
    pages: [
      {
        id: 'p1',
        url: 'https://example.devpost.com/rules',
        fetchedAt: '2026-09-24T10:00:00.000Z',
        title: 'Example Hack · Rules',
        text,
        modelText: text,
        contentHash: 'b'.repeat(64),
        truncated: false,
      },
    ],
  };
}
