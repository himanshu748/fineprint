import { blankDossier, rulePack } from './rules';
import { gibcRulePack } from './gibc-rules';
import { isImportedId, type Dossier, type EventId, type FactKey, type RulePack } from './model';
import { importedLabel, importSummary, type ImportedEvent } from './imported-event';

export const eventCatalog = [
  {
    id: 'sanity-2026',
    title: 'DEV × Sanity Challenge',
    shortTitle: 'Sanity Challenge',
    url: 'https://dev.to/challenges/sanity-2026-09-16',
    mark: 'S',
    coverage: 'Both paths · 19 selected checks',
    tracks: [
      { id: 'path-one', title: 'Path One · agent' },
      { id: 'path-two', title: 'Path Two · app' },
      { id: 'both', title: 'Both paths · separate posts' },
    ],
  },
  {
    id: 'gibc-v2-2026',
    title: 'Global Innovation Build Challenge V2',
    shortTitle: 'GIBC V2',
    url: 'https://gibc-v2.devpost.com/',
    mark: 'G',
    coverage: 'Open Invention only · 18 selected checks',
    tracks: [{ id: 'open-invention', title: 'Track 03 · Open Invention' }],
  },
] as const;
export const eventDetails = (id: EventId) => eventCatalog.find((event) => event.id === id)!;
export const savedPacks: Record<EventId, RulePack> = {
  'sanity-2026': rulePack,
  'gibc-v2-2026': gibcRulePack,
};
export const trackMatchesEvent = (dossier: Dossier) =>
  isImportedId(dossier.eventId)
    ? dossier.track === 'imported'
    : eventDetails(dossier.eventId).tracks.some((track) => track.id === dossier.track);

export type EventView = {
  id: string;
  title: string;
  shortTitle: string;
  url: string;
  mark: string;
  coverage: string;
  tracks: readonly { id: Dossier['track']; title: string }[];
  imported: ImportedEvent | null;
};
/** Display details for a curated or an imported event. Imported events are never curated. */
export function describeEvent(id: Dossier['eventId'], imports: ImportedEvent[]): EventView {
  if (!isImportedId(id)) return { ...eventDetails(id), imported: null };
  const event = imports.find((item) => item.id === id) ?? null;
  const counts = event ? importSummary(event) : null;
  return {
    id,
    title: event?.title ?? 'Imported event',
    shortTitle: event?.title ?? 'Imported rules missing',
    url: event?.pages[0].url ?? 'https://example.invalid/',
    mark: '↗',
    coverage: event
      ? `${importedLabel(event)} · ${counts!.mapped} checks, ${counts!.checkYourself} to check yourself`
      : 'The imported rules for this review are not on this device. Import the page again.',
    tracks: [{ id: 'imported', title: 'Whole event' }],
    imported: event,
  };
}
export function eventPhase(pack: RulePack, now = Date.now()) {
  return now < Date.parse(pack.start)
    ? 'Upcoming'
    : now > Date.parse(pack.deadline)
      ? 'Closed'
      : 'Open';
}

// Only facts whose meaning is independent of the event travel into a comparison.
// In particular, origin is relative to each opening date, and restrictions/submissions differ.
export const portableFacts: FactKey[] = [
  'name',
  'startedAt',
  'teamSize',
  'allStudents',
  'minimumAge',
  'workingPrototype',
  'usesSanity',
  'usesContext',
  'usesKnowledgeBase',
  'aiBuilt',
  'supportedFrontend',
];
export function factsForEvent(dossier: Dossier, target: EventId): Dossier {
  if (dossier.eventId === target) return { ...dossier };
  return {
    ...blankDossier,
    ...Object.fromEntries(portableFacts.map((key) => [key, dossier[key]])),
    eventId: target,
    track: target === 'sanity-2026' ? 'path-one' : 'open-invention',
    entriesPerPath: null,
    seeksMultiplePrizes: null,
    evidenceNote: '',
  };
}
