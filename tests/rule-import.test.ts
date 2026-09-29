import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkDossier } from '../src/lib/engine';
import { buildImportedPack, importedEventSchema, importSummary } from '../src/lib/imported-event';
import { htmlToText } from '../src/lib/page-fetch';
import { questionDossier } from '../src/lib/question-agent';
import {
  assembleImport,
  cachedImport,
  clearImportCache,
  extractImport,
  ImportError,
  prepareImport,
  rememberImport,
  supportsKind,
} from '../src/lib/rule-import';
import { modelOutput, prepared, rulesHtml } from './import-fixtures';

const text = htmlToText(rulesHtml).text;
const meta = { model: 'test-model', elapsedMs: 1234, importedAt: '2026-09-24T10:00:00.000Z' };
const imported = () => assembleImport(prepared(text), modelOutput(), meta);
const facts = (patch: Record<string, unknown> = {}) => ({
  ...questionDossier('imported', imported().id),
  ...patch,
});

describe('quote validation', () => {
  it('drops a requirement whose quote is not in the fetched text and reports it', () => {
    const event = imported();
    expect(event.requirements.map((r) => r.title)).not.toContain('Invented approval');
    expect(event.dropped).toEqual([
      {
        title: 'Invented approval',
        quote: 'Existing projects are welcome if they add one feature.',
      },
    ]);
    expect(importSummary(event)).toEqual({
      found: 6,
      kept: 5,
      mapped: 4,
      checkYourself: 1,
      dropped: 1,
    });
  });

  it('matches quotes across whitespace differences only', () => {
    const output = modelOutput();
    output.requirements[0].quote = 'Teams  may have\nup to four members.';
    output.requirements[1].quote = 'participants must be at least 18 years old.';
    const event = assembleImport(prepared(text), output, meta);
    expect(event.requirements[0].title).toBe('Team size');
    expect(event.dropped.map((d) => d.title)).toContain('Minimum age');
  });

  it('records source URL, fetch time and a content hash as the source version', () => {
    const pack = buildImportedPack(imported());
    expect(pack.sources[0]).toMatchObject({
      url: 'https://example.devpost.com/rules',
      version: `sha256:${'b'.repeat(16)}`,
      authority: 'Imported from example.devpost.com, not reviewed',
    });
    expect(pack.requirements[0].quote).toBe('Teams may have up to four members.');
  });

  it('keeps a stated deadline only when its quote and day are on the page', () => {
    expect(imported().deadline).toBe('2026-10-20T17:00:00.000Z');
    const output = modelOutput();
    output.event.deadline = { iso: '2026-10-21T17:00:00+00:00', quote: 'close on October 20' };
    expect(assembleImport(prepared(text), output, meta).deadline).toBeNull();
  });

  it('refuses an import when no quote survives', () => {
    const output = modelOutput();
    output.requirements = [output.requirements[5]];
    expect(() => assembleImport(prepared(text), output, meta)).toThrow('Nothing was imported');
  });
});

describe('schema rejection', () => {
  it.each([
    ['an unknown kind', { kind: 'free-pizza' }],
    ['a missing quote', { quote: undefined }],
    ['an extra field', { verdict: 'eligible' }],
    ['an unknown track', { track: 'Space' }],
  ])('rejects %s instead of keeping a partial pack', (_, patch) => {
    const output = modelOutput();
    Object.assign(output.requirements[0], patch);
    expect(() => assembleImport(prepared(text), output, meta)).toThrow(ImportError);
  });

  it('rejects output that is not JSON from the model', async () => {
    await expect(
      extractImport(prepared(text), async () => ({ role: 'assistant', content: 'Sorry.' })),
    ).rejects.toThrow('expected format');
  });

  it('rejects a stored imported event with an invented condition', () => {
    const event = structuredClone(imported()) as Record<string, unknown>;
    (event.requirements as Record<string, unknown>[])[0].kind = 'eval';
    expect(importedEventSchema.safeParse(event).success).toBe(false);
  });
});

describe('mapping into conditions', () => {
  it('builds typed conditions from the fixed vocabulary', () => {
    const pack = buildImportedPack(imported());
    const [team, age, window, video, climate] = pack.requirements;
    expect(team.check).toEqual({ op: 'lte', fact: 'teamSize', value: 4 });
    expect(age.check).toEqual({ op: 'gte', fact: 'minimumAge', value: 18 });
    expect(window.check).toMatchObject({ op: 'all' });
    expect(JSON.stringify(window.check)).toContain('2026-10-01T09:00:00.000Z');
    expect(video.check).toEqual({ op: 'lte', fact: 'videoMinutes', value: 3 });
    expect(climate.check).toEqual({ op: 'unresolved' });
    expect(climate.appliesWhen).toEqual({ op: 'eq', fact: 'importedTrack', value: 't1' });
  });

  it('turns a number the quote does not state into a check-yourself rule', () => {
    const output = modelOutput();
    output.requirements[0].value = 5;
    const event = assembleImport(prepared(text), output, meta);
    expect(event.requirements[0]).toMatchObject({ kind: 'check-yourself', value: null });
  });

  it('turns a build window without a quoted start into a check-yourself rule', () => {
    const output = modelOutput();
    (output.event as { start: unknown }).start = null;
    const event = assembleImport(prepared(text), output, meta);
    expect(event.requirements[2].kind).toBe('check-yourself');
  });

  it('runs the typed checker exactly like a curated pack', () => {
    const pack = buildImportedPack(imported());
    const unknown = checkDossier(facts(), pack, undefined, 'imported');
    expect(unknown.findings.find((f) => f.rule.id === 'r1')?.status).toBe('missing');
    const big = checkDossier(facts({ teamSize: 6 }), pack, undefined, 'imported');
    expect(big.findings.find((f) => f.rule.id === 'r1')?.status).toBe('blocked');
    const fine = checkDossier(
      facts({ teamSize: 3, minimumAge: 19, startedAt: '2026-10-02', videoMinutes: 2 }),
      pack,
      undefined,
      'imported',
    );
    expect(fine.findings.slice(0, 4).map((f) => f.status)).toEqual([
      'supported',
      'supported',
      'supported',
      'supported',
    ]);
    expect(fine.coverage).toContain('Imported rules, not reviewed');
  });

  it('never reports a check-yourself rule as supported, whatever the facts', () => {
    const pack = buildImportedPack(imported());
    const everything = Object.fromEntries(
      Object.entries(facts()).map(([key, value]) => [key, value === null ? true : value]),
    );
    for (const track of [null, 't1']) {
      const report = checkDossier(
        { ...facts(), ...everything, importedTrack: track, teamSize: 2, minimumAge: 30 },
        pack,
        undefined,
        'imported',
      );
      const climate = report.findings.find((f) => f.rule.id === 'r5')!;
      expect(climate.status).not.toBe('supported');
      expect(['missing', 'unclear']).toContain(climate.status);
    }
  });
});

describe('fetching and caching', () => {
  beforeEach(() => clearImportCache());

  it('refuses extra pages from another website before fetching', async () => {
    const fetchPage = vi.fn();
    await expect(
      prepareImport(
        { url: 'https://example.devpost.com/', extra: ['https://evil.example/rules'] },
        fetchPage,
      ),
    ).rejects.toThrow('same website');
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it('hashes page text and reuses a cached import for 24 hours', async () => {
    const fetchPage = async (url: string) => ({
      url,
      contentType: 'text/html',
      body: rulesHtml,
    });
    const first = await prepareImport(
      { url: 'https://example.devpost.com/rules', extra: [] },
      fetchPage,
    );
    const second = await prepareImport(
      { url: 'https://example.devpost.com/rules', extra: [] },
      fetchPage,
    );
    expect(first.contentHash).toBe(second.contentHash);
    const event = assembleImport(first, modelOutput(), meta);
    rememberImport(event, 0);
    expect(cachedImport(second.contentHash, 1000)).toBe(event);
    expect(cachedImport(second.contentHash, 24 * 60 * 60 * 1000 + 1)).toBeNull();
  });
});

describe('mapping guards from live imports', () => {
  it.each([
    ['team-size-max', 4, 'Teams must have at least four members.', { teamSize: 3 }],
    ['team-size-min', 4, 'Teams may have up to four members.', { teamSize: 10 }],
    ['team-size-max', 2, 'Teams must have 2 to 4 members.', { teamSize: 3 }],
    ['team-size-max', 4, 'Teams must have fewer than four members.', { teamSize: 4 }],
    ['minimum-age', 18, 'Participants must be under 18 years old.', { minimumAge: 25 }],
    ['video-max-minutes', 3, 'Submit a video at least 3 minutes long.', { videoMinutes: 1 }],
    ['screenshots-min', 3, 'Submit no more than 3 screenshots.', { screenshotsCount: 4 }],
    ['public-repository', null, 'A public repository is not required.', { publicRepository: true }],
    [
      'public-repository',
      null,
      'You must provide a video; a public repository is optional.',
      { publicRepository: true },
    ],
    ['students-only', null, 'Students and professionals may enter.', { allStudents: true }],
    ['new-work', null, 'Existing applications must include a new feature.', { origin: 'new' }],
  ])('does not certify an unsupported %s mapping', (kind, value, quote, patch) => {
    const output = modelOutput();
    output.requirements = output.requirements.slice(0, 1);
    Object.assign(output.requirements[0], { kind, value, quote });
    const event = assembleImport(prepared(`${text} ${quote}`), output, meta);
    expect(event.requirements[0]).toMatchObject({ kind: 'check-yourself', value: null });
    const report = checkDossier(
      facts(patch as Record<string, unknown>),
      buildImportedPack(event),
      undefined,
      'imported',
    );
    expect(report.findings[0].status).not.toBe('supported');
  });

  it.each([
    ['team-size-max', 4, 'Teams must have 2 to 4 members.'],
    ['team-size-min', 2, 'Teams must have 2 to 4 members.'],
    ['team-size-min', 4, 'Teams must have at least four members.'],
    ['public-repository', null, 'You must submit a public repository.'],
    ['students-only', null, 'Only students may enter.'],
  ] as const)('keeps grounded %s bounds and obligations', (kind, value, quote) => {
    const output = modelOutput();
    output.requirements = output.requirements.slice(0, 1);
    Object.assign(output.requirements[0], { kind, value, quote });
    const event = assembleImport(prepared(`${text} ${quote}`), output, meta);
    expect(event.requirements[0]).toMatchObject({ kind, value });
  });

  it.each([
    '2027-12-01T23:59:00-05:00',
    '2026-12-01T09:00:00+00:00',
    '2027-10-01T09:00:00+00:00',
    '2026-10-01T23:59:00+00:00',
    '2026-10-01T09:00:00-05:00',
    '2026-10-01T09:00:30+00:00',
  ])('rejects a date with unquoted calendar, time or offset: %s', (iso) => {
    const output = modelOutput();
    output.event.start.iso = iso;
    const event = assembleImport(prepared(text), output, meta);
    expect(event.start).toBeNull();
    expect(event.startQuote).toBeNull();
    expect(event.requirements[2].kind).toBe('check-yourself');
  });

  it('does not combine calendar fields and times from different dates in one quote', () => {
    const quote =
      'Starts October 1, 2026 at 9:00 AM UTC and ends December 1, 2027 at 11:59 PM UTC.';
    const output = modelOutput();
    output.event.start = { iso: '2026-10-01T23:59:00+00:00', quote };
    expect(assembleImport(prepared(`${text} ${quote}`), output, meta).start).toBeNull();
  });

  it('leaves an inverted event window to manual review', () => {
    const output = modelOutput();
    [output.event.start, output.event.deadline] = [output.event.deadline, output.event.start];
    const event = assembleImport(prepared(text), output, meta);
    expect(event.start).toBeNull();
    expect(event.deadline).toBeNull();
    expect(event.requirements[2].kind).toBe('check-yourself');
  });

  it.each([
    [
      'ai-use-disclosed',
      'AI tools, APIs, open-source libraries and cloud platforms are permitted.',
    ],
    ['build-window', 'All entries must be submitted during the contest period.'],
    ['one-team-only', 'Please only publish one submission per team.'],
    ['public-repository', 'It is recommended, that at least one team member has a Github account.'],
    ['judge-access', 'All required files and videos must be accessible to judges.'],
    ['ai-use-disclosed', 'You must credit all prior work.'],
    ['demo-link', 'You must provide a link to your source code repository.'],
    ['published-submission', 'You must publish a demo video.'],
    ['working-prototype', 'You must include screenshots of the prototype.'],
    ['guardian-consent', 'All minors must enter on a team.'],
    ['setup-instructions', 'You must include a README.'],
    ['demo-video', 'A demo video may be submitted; you must provide a public repository.'],
    ['public-repository', 'A public repository may be submitted; you must provide a demo video.'],
    ['demo-video', 'A demo video may be submitted and you must provide a public repository.'],
    ['no-excluded-affiliation', 'Employees are not ineligible to enter.'],
    ['no-excluded-affiliation', 'Employees are not not eligible to enter.'],
  ] as const)('leaves %s to the user when the quote does not state it', (kind, quote) => {
    expect(supportsKind(kind, quote)).toBe(false);
  });
  it.each([
    ['team-size-max', 'Yes, you can work on teams of up to four people.'],
    ['one-team-only', 'Teams must have 2 to 4 members, with each participant in only one team.'],
    ['judge-access', 'If your app requires logging in, please provide testing credentials.'],
    ['working-prototype', 'You will need to deliver a working prototype of your project.'],
    ['no-excluded-affiliation', 'Employees are not eligible to enter.'],
    ['no-excluded-affiliation', 'Employees are ineligible to enter.'],
  ] as const)('keeps %s when the quote states it', (kind, quote) => {
    expect(supportsKind(kind, quote)).toBe(true);
  });
  it('drops a date with no timezone while preserving an explicit numeric offset', () => {
    const page =
      'Online Build: 3-8 November 2026. Deadline: Sep 26, 2026 @ 11:00pm UTC+05:30. ' + text;
    const output = modelOutput();
    output.event.start = {
      iso: '2026-11-03T00:00:00+00:00',
      quote: 'Online Build: 3-8 November 2026',
    };
    output.event.deadline = {
      iso: '2026-09-26T23:00:00+05:30',
      quote: 'Deadline: Sep 26, 2026 @ 11:00pm UTC+05:30',
    };
    const event = assembleImport(prepared(page), output, meta);
    expect(event.start).toBeNull();
    expect(event.deadline).toBe('2026-09-26T17:30:00.000Z');
  });

  it.each([
    ['Starts October 1, 2026 UTC', '2026-10-01T00:00:00+00:00'],
    ['Starts October 1, 2026 at 9:00 AM IST', '2026-10-01T09:00:00+05:30'],
    ['Starts 01/10/2026 at 09:00 UTC', '2026-10-01T09:00:00+00:00'],
  ])('leaves incomplete or ambiguous timestamp evidence unverified: %s', (quote, iso) => {
    const output = modelOutput();
    output.event.start = { quote, iso };
    expect(assembleImport(prepared(`${text} ${quote}`), output, meta).start).toBeNull();
  });

  it.each([
    ['Starts 1 October 2026 at 12:00 AM GMT', '2026-10-01T00:00:00Z', '2026-10-01T00:00:00.000Z'],
    [
      'Starts Oct. 1, 2026 at 12:00 PM UTC',
      '2026-10-01T12:00:00+00:00',
      '2026-10-01T12:00:00.000Z',
    ],
    ['Starts 2026-10-01T09:00:00+05:30', '2026-10-01T09:00:00+05:30', '2026-10-01T03:30:00.000Z'],
  ])('retains directly stated calendar and time evidence: %s', (quote, iso, expected) => {
    const output = modelOutput();
    output.event.start = { quote, iso };
    expect(assembleImport(prepared(`${text} ${quote}`), output, meta).start).toBe(expected);
  });

  it('requires both verified boundaries before checking a build window', () => {
    const output = modelOutput();
    (output.event as { deadline: unknown }).deadline = null;
    expect(assembleImport(prepared(text), output, meta).requirements[2].kind).toBe(
      'check-yourself',
    );
  });
});
