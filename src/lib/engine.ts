import {
  factLabels,
  type Dossier,
  type Expression,
  type FactKey,
  type Finding,
  type Report,
  type RulePack,
  type Status,
} from './model';
import { trackMatchesEvent } from './events';

type Evaluation = { value: boolean | null | 'unresolved'; missing: string[]; facts: Set<string> };
const unique = (values: string[]) => [...new Set(values)];

function dateRange(value: unknown): [number, number] | null {
  if (typeof value !== 'string' || !value) return null;
  const month = /^(\d{4})-(\d{2})$/.exec(value);
  if (month) {
    const year = Number(month[1]),
      index = Number(month[2]) - 1;
    return [Date.UTC(year, index, 1), Date.UTC(year, index + 1, 1) - 1];
  }
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? [time, time + 86_400_000 - 1] : [time, time];
}

export function evaluateExpression(
  expression: Expression,
  dossier: Dossier,
  now: string,
  deadline: string,
): Evaluation {
  if (expression.op === 'unresolved') return { value: 'unresolved', missing: [], facts: new Set() };
  if (expression.op === 'all' || expression.op === 'any') {
    const parts = expression.expressions.map((part) =>
      evaluateExpression(part, dossier, now, deadline),
    );
    const facts = new Set(parts.flatMap((part) => [...part.facts]));
    const missing = unique(parts.flatMap((part) => part.missing));
    if (expression.op === 'all' && parts.some((part) => part.value === false))
      return { value: false, missing: [], facts };
    if (expression.op === 'any' && parts.some((part) => part.value === true))
      return { value: true, missing: [], facts };
    if (parts.some((part) => part.value === 'unresolved'))
      return { value: 'unresolved', missing, facts };
    if (parts.some((part) => part.value === null)) return { value: null, missing, facts };
    return { value: expression.op === 'all', missing: [], facts };
  }
  const atom = expression as Extract<Expression, { fact: string }>;
  const resolve = (key: string): unknown =>
    key === '$now'
      ? now
      : key === '$deadline'
        ? deadline
        : dossier[key.replace(/^\$/, '') as FactKey];
  const actual = resolve(atom.fact);
  const expected =
    typeof atom.value === 'string' && atom.value.startsWith('$') ? resolve(atom.value) : atom.value;
  const keys = [atom.fact.replace(/^\$/, '')];
  if (typeof atom.value === 'string' && atom.value.startsWith('$')) keys.push(atom.value.slice(1));
  const facts = new Set(keys.filter((key) => key in dossier));
  if (
    actual === null ||
    actual === undefined ||
    (atom.op === 'date-after' && (!actual || !expected))
  ) {
    return { value: null, missing: [...facts], facts };
  }
  switch (atom.op) {
    case 'eq':
      return { value: actual === expected, missing: [], facts };
    case 'neq':
      return { value: actual !== expected, missing: [], facts };
    case 'lte':
      return {
        value:
          typeof actual === 'number' && typeof expected === 'number' ? actual <= expected : null,
        missing: [],
        facts,
      };
    case 'gte':
      return {
        value:
          typeof actual === 'number' && typeof expected === 'number' ? actual >= expected : null,
        missing: [],
        facts,
      };
    case 'present':
      return { value: typeof actual === 'string' && actual.trim().length > 0, missing: [], facts };
    case 'date-after': {
      const left = dateRange(actual),
        right = dateRange(expected);
      if (!left || !right) return { value: null, missing: [...facts], facts };
      if (left[0] >= right[1]) return { value: true, missing: [], facts };
      if (left[1] < right[0]) return { value: false, missing: [], facts };
      return { value: null, missing: [...facts], facts };
    }
  }
}

export function checkDossier(
  dossier: Dossier,
  pack: RulePack,
  now = new Date().toISOString(),
  sourceMode: Report['sourceMode'] = 'snapshot',
): Report {
  if (dossier.eventId !== pack.id || !trackMatchesEvent(dossier))
    throw new Error('The event, track and rule pack must match.');
  const findings = pack.requirements.map((rule): Finding => {
    const applicability = rule.appliesWhen
      ? evaluateExpression(rule.appliesWhen, dossier, now, pack.deadline)
      : null;
    let result = evaluateExpression(rule.check, dossier, now, pack.deadline);
    let status: Status;
    if (applicability?.value === false) status = 'not-applicable';
    else if (applicability && applicability.value !== true) {
      status = 'missing';
      result = applicability;
    } else if (result.value === 'unresolved') status = 'unclear';
    else if (result.value === null) status = 'missing';
    else if (result.value === false)
      status = rule.review === 'needs-organizer' ? 'unclear' : 'blocked';
    else status = 'supported';
    const keys = unique([...result.facts, ...(applicability?.facts ?? [])]);
    const reason =
      status === 'supported'
        ? 'Supported by the supplied facts.'
        : status === 'blocked'
          ? rule.correction
          : status === 'unclear'
            ? rule.question
            : status === 'not-applicable'
              ? 'This condition does not apply to the selected project facts.'
              : applicability && applicability.value !== true
                ? 'One more fact is needed to determine whether this requirement applies.'
                : rule.question;
    return {
      rule,
      status,
      reason,
      facts: keys.map((key) => ({ key, value: dossier[key as FactKey] })),
      missingFacts: result.missing,
    };
  });
  const counts: Report['counts'] = {
    supported: 0,
    blocked: 0,
    missing: 0,
    unclear: 0,
    'not-applicable': 0,
  };
  for (const finding of findings) counts[finding.status]++;
  const eligibility = findings.filter((f) => ['entry', 'path'].includes(f.rule.scope));
  const blockers = eligibility.filter((f) => f.status === 'blocked').length;
  const pending = eligibility.filter(
    (f) => f.status === 'missing' || f.status === 'unclear',
  ).length;
  const summary = blockers
    ? `${blockers} eligibility ${blockers === 1 ? 'blocker' : 'blockers'}`
    : pending
      ? 'Eligibility needs clarification'
      : 'No blockers in covered eligibility checks';
  const next = [...eligibility, ...findings.filter((f) => !eligibility.includes(f))].find(
    (f) => f.status === 'missing' || f.status === 'unclear',
  );
  return {
    id: crypto.randomUUID(),
    checkedAt: now,
    dossier: { ...dossier },
    packVersion: pack.version,
    packId: pack.id,
    packSchedule: { start: pack.start, deadline: pack.deadline },
    sourceMode,
    sources: pack.sources,
    findings,
    counts,
    summary,
    nextQuestion: next?.rule.question ?? null,
    coverage:
      sourceMode === 'imported'
        ? 'Imported rules, not reviewed. A model extracted these requirements from the organizer page and each quote was matched to the fetched text. Facts are declared, not independently verified. A supported check is not an organizer decision or complete eligibility certification.'
        : 'Selected requirements only. Facts are declared, not independently verified. A supported check is not an organizer decision or complete eligibility certification.',
    sourceHealth:
      Date.parse(now) - Date.parse(pack.updatedAt) > 7 * 86_400_000
        ? 'aging-snapshot'
        : 'current-snapshot',
  };
}

export function changedFindings(before: Report, after: Report): string[] {
  if (before.packId !== after.packId) return [];
  return after.findings
    .filter((finding) => {
      const old = before.findings.find((item) => item.rule.id === finding.rule.id);
      return (
        !old ||
        old.status !== finding.status ||
        JSON.stringify(old.facts) !== JSON.stringify(finding.facts) ||
        JSON.stringify(old.rule) !== JSON.stringify(finding.rule)
      );
    })
    .map((f) => f.rule.id);
}

export function formatFact(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not supplied';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const labels: Record<string, string> = {
    new: 'A new entry',
    components: 'Reused components in a new entry',
    existing: 'An existing application',
    'path-one': 'Path One',
    'path-two': 'Path Two',
    both: 'Both paths',
    'open-invention': 'Open Invention',
    imported: 'Whole event, imported rules',
  };
  return labels[String(value)] ?? String(value);
}

const md = (text: unknown) =>
  String(text)
    .replace(/[\\`*_{}\[\]<>#|]/g, '\\$&')
    .replace(/[\r\n]+/g, ' ');
export function reportMarkdown(report: Report): string {
  return `# FinePrint: ${md(report.dossier.name)}\n\n${report.summary}\n\nChecked: ${report.checkedAt}\nSource pack: ${report.packId} / ${report.packVersion} (${report.sourceMode})\n\n${report.coverage}\n${report.sourceHealth === 'aging-snapshot' ? '\nSource snapshot is older than seven days. Recheck the official rules.\n' : ''}\n${report.findings
    .map(
      (f) =>
        `## ${md(f.rule.title)} — ${f.status}\n\nScope: ${f.rule.scope}\n\n${md(f.rule.summary)}\n\n${md(f.reason)}\n\n${f.facts.map((fact) => `- ${md(factLabels[fact.key as FactKey] ?? fact.key)}: ${md(formatFact(fact.value))}`).join('\n')}\n\n${f.rule.sources
          .map((id) => {
            const s = report.sources.find((s) => s.id === id)!;
            return `[${md(s.title)}](${s.url}) · captured ${s.capturedAt}`;
          })
          .join('\n\n')}`,
    )
    .join(
      '\n\n',
    )}\n\n## Project context\n\n${md(report.dossier.evidenceNote || 'No additional evidence supplied.')}\n`;
}
