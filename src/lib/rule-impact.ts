import type { Report, RulePack } from './model';

export type RuleChange = {
  id: string;
  title: string;
  kind: 'added' | 'removed' | 'changed';
  detail: string;
};
// Dates of capture alone are provenance refreshes, not changed conditions.
const sourceContent = (source: Report['sources'][number]) =>
  JSON.stringify([source.id, source.url, source.authority, source.quote, source.summary]);
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
export function ruleImpact(report: Report, pack: RulePack) {
  if (report.packId !== pack.id) return null;
  const changes: RuleChange[] = [];
  for (const rule of pack.requirements) {
    const previous = report.findings.find((finding) => finding.rule.id === rule.id);
    if (!previous) {
      changes.push({
        id: rule.id,
        title: rule.title,
        kind: 'added',
        detail: 'New requirement in the curated pack.',
      });
      continue;
    }
    const changedSources = rule.sources.some((id) => {
      const before = report.sources.find((source) => source.id === id);
      const after = pack.sources.find((source) => source.id === id);
      return !before || !after || sourceContent(before) !== sourceContent(after);
    });
    const scheduleChanged =
      report.packSchedule?.deadline !== pack.deadline &&
      (report.packSchedule !== undefined || report.packVersion !== pack.version) &&
      canonical(rule).includes('$deadline');
    const ruleChanged = canonical(previous.rule) !== canonical(rule);
    if (ruleChanged || changedSources || scheduleChanged)
      changes.push({
        id: rule.id,
        title: rule.title,
        kind: 'changed',
        detail: changedSources
          ? ruleChanged
            ? 'Requirement and linked source content changed.'
            : 'Linked source content changed.'
          : scheduleChanged
            ? 'Event timing changed or the older timing record is unavailable.'
            : 'Requirement or applicability changed.',
      });
  }
  for (const finding of report.findings)
    if (!pack.requirements.some((rule) => rule.id === finding.rule.id))
      changes.push({
        id: finding.rule.id,
        title: finding.rule.title,
        kind: 'removed',
        detail:
          'No longer included in this curated pack; this does not establish organizer permission.',
      });
  return {
    from: report.packVersion,
    to: pack.version,
    changes,
    needsRecheck: changes.length > 0,
    versionChanged: report.packVersion !== pack.version,
  };
}
