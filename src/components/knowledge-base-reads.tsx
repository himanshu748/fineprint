type ReadEntry = {
  path: string;
  records: { kind: string; id: string | null; title: string }[];
};

export function KnowledgeBaseReads({ entries, id }: { entries: ReadEntry[]; id?: string }) {
  return (
    <details className="knowledge-base-reads">
      <summary>Inspect {entries.length} retrieved entries and their structured records</summary>
      <p>
        These are the entries returned by Sanity Context in this run. The record names connect the
        retrieved text to FinePrint’s curated requirements and sources.
      </p>
      {id && (
        <p>
          Knowledge Base <code>{id}</code>
        </p>
      )}
      {entries.map((entry) => (
        <div className="knowledge-base-entry" key={entry.path}>
          <code>{entry.path}</code>
          {entry.records.length > 0 ? (
            <ul>
              {entry.records.map((record, index) => (
                <li key={`${record.kind}-${record.id ?? index}`}>
                  <strong>{record.title}</strong>
                  <span>{record.kind}</span>
                  {record.id && <code>{record.id}</code>}
                </li>
              ))}
            </ul>
          ) : (
            <p>No linked requirement or source record was identified in this entry.</p>
          )}
        </div>
      ))}
    </details>
  );
}
