import { blankDossier, rulePack } from './rules';
import { gibcRulePack } from './gibc-rules';
import type { Dossier, EventId, FactKey, RulePack } from './model';

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
  eventDetails(dossier.eventId).tracks.some((track) => track.id === dossier.track);
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
