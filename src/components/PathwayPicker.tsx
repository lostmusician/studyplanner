import type { SpecialProgramme } from '@shared/types';
import { PATHWAY_OPTIONS, getMceWaiverCount } from '@shared/pathways';

export const PathwayPicker = ({ selected, onToggle }: { selected: SpecialProgramme[]; onToggle: (programme: SpecialProgramme) => void }) => {
  const waivers = getMceWaiverCount(selected);
  return <div className="flex flex-col gap-5">
    <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Global Pathways</h3><span className="text-xs text-muted">{selected.length ? `${selected.length} selected` : 'Choose at least one'}</span></div>
    <fieldset className="space-y-3"><legend className="mb-3 text-sm font-medium text-muted">Study abroad & experiences</legend><div className="flex flex-wrap gap-2">{PATHWAY_OPTIONS.filter(p => !p.id.startsWith('noc-')).map(p => <PathwayChip key={p.id} label={p.label} selected={selected.includes(p.id)} onClick={() => onToggle(p.id)} />)}</div></fieldset>
    <fieldset className="space-y-3"><legend className="mb-3 text-sm font-medium text-muted">NUS Overseas Colleges · one duration</legend><div className="flex flex-wrap gap-2">{PATHWAY_OPTIONS.filter(p => p.id.startsWith('noc-')).map(p => <PathwayChip key={p.id} label={p.label} selected={selected.includes(p.id)} onClick={() => onToggle(p.id)} />)}</div></fieldset>
    {waivers > 0 && <p className="text-xs leading-relaxed text-muted">NOC waives {waivers} of 6 MCEs. HSS/ST and taught-course minimums still apply.</p>}
    {(selected.includes('sep') || selected.includes('gex') || selected.some(p => p.startsWith('noc-'))) && <p className="text-xs leading-relaxed text-muted">Add your GEx course, approved SEP mappings, or approved NOC internship courses to track course credit.</p>}
    <a href="https://nuscollege.nus.edu.sg/academics/the-nusc-curriculum/nusc-academic-info/" target="_blank" rel="noreferrer" className="text-xs text-muted underline underline-offset-2">NUSC pathway requirements ↗</a>
  </div>;
};

const PathwayChip = ({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) => <button type="button" aria-pressed={selected} onClick={onClick} className={`min-h-11 rounded-full border px-4 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${selected ? 'border-ink bg-ink text-canvas' : 'border-line/60 bg-canvas text-ink active:bg-paper'}`}>{selected && <span aria-hidden="true">✓ </span>}{label}</button>;
