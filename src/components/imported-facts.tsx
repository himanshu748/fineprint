'use client';
import { ChevronDown } from 'lucide-react';
import {
  factLabels,
  type Dossier,
  type Expression,
  type FactKey,
  type RulePack,
} from '@/lib/model';
import type { ImportedEvent } from '@/lib/imported-event';

const numeric = new Set<FactKey>([
  'teamSize',
  'minimumAge',
  'videoMinutes',
  'screenshotsCount',
  'entriesPerPath',
]);

function factsIn(expression: Expression | undefined, into: Set<FactKey>) {
  if (!expression || expression.op === 'unresolved') return;
  if ('expressions' in expression) {
    expression.expressions.forEach((child) => factsIn(child, into));
    return;
  }
  for (const key of [expression.fact, expression.value])
    if (typeof key === 'string' && key.startsWith('$') && key.slice(1) in factLabels)
      into.add(key.slice(1) as FactKey);
  if (expression.fact in factLabels) into.add(expression.fact as FactKey);
}

/** The facts an imported pack actually checks, in the order its rules use them. */
export function importedFactKeys(pack: RulePack) {
  const keys = new Set<FactKey>();
  for (const rule of pack.requirements) {
    factsIn(rule.appliesWhen, keys);
    factsIn(rule.check, keys);
  }
  keys.delete('importedTrack');
  return [...keys];
}

export function ImportedFacts({
  dossier,
  update,
  event,
  pack,
}: {
  dossier: Dossier;
  update: (key: FactKey, value: unknown) => void;
  event: ImportedEvent;
  pack: RulePack;
}) {
  const keys = importedFactKeys(pack);
  return (
    <details className="fact-section" open>
      <summary>
        Facts these rules check
        <ChevronDown size={15} />
      </summary>
      {event.tracks.length > 0 && (
        <label className="field" data-field="importedTrack">
          <span>{factLabels.importedTrack}</span>
          <select
            value={dossier.importedTrack ?? 'unknown'}
            onChange={(e) =>
              update('importedTrack', e.target.value === 'unknown' ? null : e.target.value)
            }
          >
            <option value="unknown">Not sure yet</option>
            {event.tracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.title}
              </option>
            ))}
          </select>
        </label>
      )}
      {keys.map((key) =>
        key === 'origin' ? (
          <label key={key} className="field" data-field="origin">
            <span>What existed before the event?</span>
            <select
              value={dossier.origin ?? 'unknown'}
              onChange={(e) =>
                update('origin', e.target.value === 'unknown' ? null : e.target.value)
              }
            >
              <option value="unknown">Not sure yet</option>
              <option value="new">Nothing · a new entry</option>
              <option value="components">Components I’m reusing</option>
              <option value="existing">The application itself</option>
            </select>
          </label>
        ) : key === 'startedAt' ? (
          <label key={key} className="field" data-field="startedAt">
            <span>{factLabels.startedAt}</span>
            <input
              type="text"
              placeholder="YYYY-MM-DD"
              value={dossier.startedAt ?? ''}
              onChange={(e) => update('startedAt', e.target.value || null)}
            />
            <small>On the opening day, add the time and timezone.</small>
          </label>
        ) : numeric.has(key) ? (
          <label key={key} className="field" data-field={key}>
            <span>{factLabels[key]}</span>
            <input
              type="number"
              min={0}
              max={120}
              step={key === 'videoMinutes' ? 0.1 : 1}
              value={(dossier[key] as number | null) ?? ''}
              onChange={(e) => update(key, e.target.value ? Number(e.target.value) : null)}
            />
          </label>
        ) : (
          <label key={key} className="field" data-field={key}>
            <span>{factLabels[key]}</span>
            <select
              value={dossier[key] === null ? 'unknown' : dossier[key] ? 'yes' : 'no'}
              onChange={(e) =>
                update(key, e.target.value === 'unknown' ? null : e.target.value === 'yes')
              }
            >
              <option value="unknown">Not sure yet</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
        ),
      )}
      <small className="imported-facts-note">
        Rules marked “check yourself” have no fact here. Read their quotes in the findings.
      </small>
    </details>
  );
}
