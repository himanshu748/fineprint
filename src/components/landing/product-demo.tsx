'use client';
import { StatusTag, statusLabels } from '../status-tag';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, Check, RotateCcw, ShieldQuestion } from 'lucide-react';
import type { Status } from '@/lib/model';

export function RecordedAnswer({
  scenario,
  status,
  answer,
  paths,
  recordedOn,
}: {
  scenario: string;
  status: Status;
  answer: string;
  paths: string[];
  recordedOn: string;
}) {
  const [replay, setReplay] = useState(0);
  const [seen, setSeen] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    if (stage.current) observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="recorded-demo" ref={stage} data-seen={seen}>
      <div className="recorded-heading">
        <span>Ask FinePrint</span>
        <button
          onClick={() => setReplay((value) => value + 1)}
          aria-label="Replay recorded example"
        >
          <RotateCcw size={14} />
          Replay
        </button>
      </div>
      <div key={replay} className="recorded-content">
        <div className="recorded-question">
          <span>Example scenario</span>
          <p>{scenario}</p>
        </div>
        <div className="recorded-reads">
          <span>
            <Check size={14} />
            Read the Knowledge Base outline
          </span>
          {paths.map((path, index) => (
            <span key={path} style={{ animationDelay: `${1.2 + index * 0.18}s` }}>
              <Check size={14} />
              <code>{path.replaceAll('_', ' ')}</code>
            </span>
          ))}
        </div>
        <div className="recorded-result">
          <div>
            <ShieldQuestion size={19} />
            <strong>{statusLabels[status]}</strong>
          </div>
          <p>{answer}</p>
          <a href="#recorded-source">
            See the rule and source
            <ArrowDown size={14} />
          </a>
        </div>
      </div>
      <p className="recorded-caption">
        Recorded source explanation · {recordedOn}
        <br />
        Replay is an illustration. No live request is made here.
      </p>
    </div>
  );
}

export function FactChange({
  rows,
}: {
  rows: { id: string; title: string; before: Status; after: Status }[];
}) {
  const [changed, setChanged] = useState(false);
  return (
    <div className="change-demo">
      <div className="change-control">
        <span>What existed before the event?</span>
        <div role="group" aria-label="Illustrative project history">
          <button aria-pressed={!changed} onClick={() => setChanged(false)}>
            The application
          </button>
          <button aria-pressed={changed} onClick={() => setChanged(true)}>
            Only components
          </button>
        </div>
      </div>
      <div className="change-date">
        <span>Development began</span>
        <strong>August 23, 2026</strong>
        <span>Unchanged</span>
      </div>
      <ul aria-live="polite">
        {rows.map((row) => (
          <li key={row.id} className={changed && row.before !== row.after ? 'demo-changed' : ''}>
            <span>
              {row.title}
              {changed && row.before !== row.after && <small>Changed</small>}
            </span>
            <StatusTag status={changed ? row.after : row.before} />
          </li>
        ))}
      </ul>
      <p>Illustrative facts, computed by FinePrint’s rule checker.</p>
    </div>
  );
}
