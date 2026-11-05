import { useState } from 'react';
import type { SecondaryProgramme } from '@shared/types';
import { programmeRestriction } from '../lib/programmes';

export const ProgrammePicker = ({ programmes, selectedIds, onToggle, majorId, secondMajorId, minorIds, max, label }: {
  programmes: SecondaryProgramme[]; selectedIds: string[]; onToggle: (id: string) => void;
  majorId: string; secondMajorId: string | null; minorIds: string[]; max: number; label: string;
}) => {
  const [query, setQuery] = useState('');
  const filtered = programmes.filter(p => `${p.label} ${p.school ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="flex flex-col gap-2">
    <div className="flex items-center justify-between gap-2 text-sm font-medium"><span>{label}</span><span className="text-muted">{selectedIds.length}/{max}</span></div>
    {selectedIds.length > 0 && <div className="flex flex-wrap gap-1">{programmes.filter(p => selectedIds.includes(p.id)).map(p => <button type="button" key={p.id} onClick={() => onToggle(p.id)} className="min-h-11 rounded-lg bg-ink px-3 py-2 text-sm text-canvas" aria-label={`Remove ${p.label}`}>{p.label} ×</button>)}</div>}
    <input type="search" aria-label={`Search ${label.toLowerCase()}`} placeholder={`Search ${programmes.length} programmes…`} value={query} onChange={e => setQuery(e.target.value)} className="w-full rounded-xl border border-line/40 bg-canvas px-3 py-2.5 text-base sm:text-sm text-ink" />
    <div className="max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-line/30">
      {filtered.length === 0 && <p className="p-3 text-xs text-muted" role="status">No matching programmes.</p>}
      {filtered.map(p => {
        const selected = selectedIds.includes(p.id);
        const restriction = programmeRestriction(p, majorId, secondMajorId, minorIds);
        const disabled = !selected && (Boolean(restriction) || max > 1 && selectedIds.length >= max);
        return <div key={p.id} className="border-b border-line/20 px-3 py-1 last:border-0">
          <div className="flex items-center gap-2">
          <button type="button" aria-pressed={selected} disabled={disabled} onClick={() => onToggle(p.id)} className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 rounded-lg py-2 text-left text-sm text-ink disabled:opacity-45">
            <span className="min-w-0 break-words font-medium">{p.label}</span><span className="shrink-0 text-muted">{selected ? '✓' : '+'}</span>
          </button>
          {p.sourceUrl && <a href={p.sourceUrl} target="_blank" rel="noreferrer" aria-label={`NUS requirements for ${p.label}`} title="NUS requirements" className="flex min-h-11 w-9 shrink-0 items-center justify-center rounded-lg text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink">↗</a>}
          </div>
          {restriction && <p className="pb-2 text-xs leading-relaxed text-amber-800">{restriction}</p>}
        </div>;
      })}
    </div>
  </div>;
};
