import type { RulePack } from './model';

export type OutlineEntry = { path: string; tag: 'core' | 'peripheral' | null; summary: string };
export type KnowledgeBaseOutline = { id: string; title: string; entries: OutlineEntry[] };
export type EntryRecord = {
  kind: 'requirement' | 'source' | 'competition' | 'other';
  id: string | null;
  title: string;
};

const idLine = /^Knowledge base id:\s*`?(kb[\w-]+)`?\s*$/i;
const entryLine = /^([A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)(?:\s+\[(core|peripheral)\])?\s*$/;
const detailLine = /^\s*(topics|excludes|related):/i;
const dashes = String.fromCharCode(0x2013, 0x2014);
const sourceSuffix = new RegExp(`\\s+[${dashes}-]\\s*[A-Za-z ]+$`);

/** Reads the Knowledge Base sections of an initial_context payload. Paths are kept verbatim. */
export function parseOutline(text: string): KnowledgeBaseOutline[] {
  const outlines: KnowledgeBaseOutline[] = [];
  let current: KnowledgeBaseOutline | null = null;
  let last: OutlineEntry | null = null;
  for (const line of text.split(/\r?\n/)) {
    const id = idLine.exec(line.trim());
    if (id) {
      current = { id: id[1], title: '', entries: [] };
      outlines.push(current);
      last = null;
      continue;
    }
    if (!current) continue;
    if (!current.title && !current.entries.length && line.startsWith('#')) {
      current.title = line.replace(/^#+\s*/, '').trim();
      continue;
    }
    const entry = entryLine.exec(line);
    if (entry) {
      last = { path: entry[1], tag: (entry[2] as OutlineEntry['tag']) ?? null, summary: '' };
      if (!current.entries.some((item) => item.path === last!.path)) current.entries.push(last);
      continue;
    }
    if (last && !last.summary && /^\s+\S/.test(line) && !detailLine.test(line))
      last.summary = line.trim();
  }
  return outlines;
}

/**
 * Maps the numbered Sources list at the end of a Knowledge Base entry back to the
 * Content Lake records it was built from. Titles are matched exactly against the rule pack.
 */
export function entryRecords(entryText: string, pack: RulePack): EntryRecord[] {
  const heading = entryText.search(/^#{1,6}\s*Sources\s*$/m);
  if (heading < 0) return [];
  const records: EntryRecord[] = [];
  for (const line of entryText.slice(heading).split(/\r?\n/).slice(1)) {
    const item = /^\s*\d+\.\s+(.+?)\s*$/.exec(line);
    if (!item) {
      if (line.trim() && records.length) break;
      continue;
    }
    const title = item[1].replace(sourceSuffix, '').trim();
    const requirement = pack.requirements.find((rule) => rule.title === title);
    const source = pack.sources.find((entry) => entry.title === title);
    const record: EntryRecord = requirement
      ? { kind: 'requirement', id: requirement.id, title }
      : source
        ? { kind: 'source', id: source.id, title }
        : title === pack.title
          ? { kind: 'competition', id: pack.id, title }
          : { kind: 'other', id: null, title };
    if (!records.some((existing) => existing.title === record.title)) records.push(record);
  }
  return records;
}
