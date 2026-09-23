'use client';
import { ChevronDown } from 'lucide-react';
import { factLabels, type Dossier, type FactKey } from '@/lib/model';

export function GibcFacts({
  dossier,
  update,
}: {
  dossier: Dossier;
  update: (key: FactKey, value: unknown) => void;
}) {
  const boolean = (key: FactKey, help?: string) => (
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
      {help && <small>{help}</small>}
    </label>
  );
  const number = (
    key: 'teamSize' | 'minimumAge' | 'videoMinutes' | 'screenshotsCount' | 'entriesPerPath',
    min: number,
    max: number,
    step = 1,
  ) => (
    <label key={key} className="field" data-field={key}>
      <span>{factLabels[key]}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={dossier[key] ?? ''}
        onChange={(e) => update(key, e.target.value ? Number(e.target.value) : null)}
      />
    </label>
  );
  return (
    <>
      <details className="fact-section" open>
        <summary>
          Project history
          <ChevronDown size={15} />
        </summary>
        <label className="field" data-field="origin">
          <span>What existed before July 11, 2026?</span>
          <select
            value={dossier.origin ?? 'unknown'}
            onChange={(e) => update('origin', e.target.value === 'unknown' ? null : e.target.value)}
          >
            <option value="unknown">Not sure yet</option>
            <option value="new">Nothing · a new entry</option>
            <option value="components">Components I’m reusing</option>
            <option value="existing">The application itself</option>
          </select>
        </label>
        <label className="field" data-field="startedAt">
          <span>Entry development began</span>
          <input
            type="text"
            placeholder="YYYY-MM-DD"
            value={dossier.startedAt ?? ''}
            onChange={(e) => update('startedAt', e.target.value || null)}
          />
          <small>July 11 needs a time and timezone.</small>
        </label>
        {boolean('priorHackathonEntry')}
      </details>
      <details className="fact-section">
        <summary>
          Team & participation
          <ChevronDown size={15} />
        </summary>
        {number('teamSize', 1, 100)}
        {boolean('allStudents')}
        {number('minimumAge', 1, 120)}
        {boolean('guardianConsent')}
        {boolean('oneTeam')}
        {number('entriesPerPath', 1, 100)}
        {boolean('eligibleResidency', 'Check GIBC’s residency restrictions in its official rules.')}
        {boolean(
          'excludedAffiliation',
          'Organizer, judge or immediate family affiliation for GIBC.',
        )}
      </details>
      <details className="fact-section">
        <summary>
          Open Invention
          <ChevronDown size={15} />
        </summary>
        {boolean('workingPrototype')}
        {boolean('technicalNovelty', 'Your declaration; the judges assess technical novelty.')}
        {boolean('aiBuilt')}
        {boolean('aiUseDisclosed')}
      </details>
      <details className="fact-section">
        <summary>
          Submission materials
          <ChevronDown size={15} />
        </summary>
        {boolean('publicRepository')}
        {boolean('setupInstructions')}
        {number('videoMinutes', 0, 120, 0.1)}
        {boolean(
          'videoAccessible',
          'Accessible to judges on YouTube, Vimeo or Youku; shows the project running.',
        )}
        {number('screenshotsCount', 0, 100)}
        {boolean('devpostComplete')}
        {boolean(
          'englishSubmission',
          'English description and documentation; demo has English audio or subtitles.',
        )}
      </details>
    </>
  );
}
