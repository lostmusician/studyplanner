import { useEffect, useRef, useState } from 'react';
import type { Major, PlacedModule, SecondaryProgramme } from '@shared/types';
import { withAllocationChoice } from '@shared/allocationPreferences';
import type { AllocatedRequirement, AllocationReport, ProgrammeAllocation } from '../lib/requirementAllocation';

type UpdateModule = (code: string, updates: PlacedModule) => { ok: true } | { ok: false; error: string };

/** Course usage is disclosed beside a course, rather than in a separate audit. */
export const CourseUsageDetails = ({ code, report, manual = false }: { code: string; report: AllocationReport; manual?: boolean }) => {
  const uses = report.courseUses[code] ?? [];
  const shared = uses.length > 1;
  return <details className="min-w-0 max-w-full">
    <summary aria-label={`How ${code} is used`} className={`min-h-8 cursor-pointer list-none rounded-lg px-2 py-1.5 font-mono text-[10px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink ${shared ? 'bg-ink text-canvas' : 'bg-ink/10 text-ink'}`}>
      {code}{shared ? ' · shared' : ''}{manual ? ' · manual' : ''}
    </summary>
    <ul className="mt-2 flex max-w-sm flex-col gap-2 rounded-xl bg-paper p-3 text-xs text-ink">
      {uses.map(use => <li key={use.programmeKey}>
        <p className="font-semibold">{use.programmeLabel}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">{use.rows.join(' · ')}</p>
      </li>)}
    </ul>
  </details>;
};

export const RequirementAllocationPanel = ({ source, allocation, report, modules, onUpdateModule }: {
  source: Major | SecondaryProgramme;
  allocation: ProgrammeAllocation;
  report: AllocationReport;
  modules: PlacedModule[];
  onUpdateModule: UpdateModule;
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const editorHeading = useRef<HTMLHeadingElement>(null);
  const chooseButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  const previousEditingId = useRef<string | null>(null);
  const editing = allocation.rows.find(row => row.id === editingId);
  useEffect(() => {
    if (editingId) editorHeading.current?.focus();
    else if (previousEditingId.current) chooseButtons.current[previousEditingId.current]?.focus();
    previousEditingId.current = editingId;
  }, [editingId]);
  const byCode = new Map(modules.map(m => [m.code, m]));
  const fulfilled = allocation.rows.filter(row => row.fulfilled).length;
  const overCap = allocation.capMc !== null && allocation.sharedMc > allocation.capMc;
  const kind = allocation.kind === 'primary' ? 'Primary major' : allocation.kind === 'minor' ? 'Minor' : 'Second major';
  const manual = modules.some(m => m.allocationPreferences?.[allocation.key] ||
    (allocation.kind !== 'primary' && m.excludedProgrammeIds?.includes(source.id)));
  const conflicts = report.conflicts.filter(code => allocation.usedCodes.includes(code));
  const issues = report.manualIssues.filter(issue => issue.includes(source.label));
  const save = (module: PlacedModule) => {
    const result = onUpdateModule(module.code, module);
    setError(result.ok ? null : result.error);
  };
  const resetChoices = () => {
    for (const module of modules) {
      if (!module.allocationPreferences?.[allocation.key] && !module.excludedProgrammeIds?.includes(source.id)) continue;
      const preferences = { ...module.allocationPreferences };
      delete preferences[allocation.key];
      const result = onUpdateModule(module.code, { ...module, allocationPreferences: preferences,
        excludedProgrammeIds: (module.excludedProgrammeIds ?? []).filter(id => id !== source.id) });
      if (!result.ok) { setError(result.error); return; }
    }
    setError(null);
  };
  const setChoice = (row: AllocatedRequirement, code: string, included: boolean) => {
    const module = byCode.get(code)!;
    const updated = withAllocationChoice(module, allocation.key, row.id, included ? 'include' : 'exclude');
    if (included && allocation.kind !== 'primary') updated.excludedProgrammeIds = (module.excludedProgrammeIds ?? []).filter(id => id !== source.id);
    save(updated);
  };
  const otherUses = (code: string) => (report.courseUses[code] ?? []).filter(use => use.programmeKey !== allocation.key);
  const programmeLabel = (key: string) => {
    const programme = report.programmes.find(p => p.key === key);
    return programme?.kind === 'primary' ? 'primary major' : programme?.label ?? key;
  };

  return (
    <section className="flex flex-col gap-3" aria-label={`${source.label} requirement allocation`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">{kind} · {fulfilled}/{allocation.rows.length} checks met</p>
        {manual && <button type="button" onClick={resetChoices} className="min-h-10 rounded-xl px-3 text-xs font-medium text-ink hover:bg-ink/5">Reset choices</button>}
      </div>
      {!editing && 'kind' in source && source.sourceUrl && <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="self-start text-xs text-muted underline underline-offset-2">Requirements ↗</a>}
      {!allocation.rows.length && <p className="text-xs text-muted">Requirements unavailable</p>}
      {allocation.capMc !== null && (
        <div className="rounded-2xl bg-paper/70 p-3">
          <div className="flex items-center justify-between gap-3 text-xs font-semibold">
            <span>Shared credits</span>
            <span className={overCap ? 'text-amber-800' : 'text-ink'}>{allocation.sharedMc} / {allocation.capMc} MC</span>
          </div>
          <div role="meter" aria-label={`${source.label} sharing allowance`} aria-valuenow={Math.min(allocation.sharedMc, allocation.capMc)} aria-valuemin={0} aria-valuemax={allocation.capMc}
            aria-valuetext={`${allocation.sharedMc} of ${allocation.capMc} MC shared`} className="my-2 h-2 overflow-hidden rounded-full bg-ink/10">
            <div className={`h-full rounded-full ${overCap ? 'bg-amber-600' : 'bg-ink/60'}`} style={{ width: `${Math.min(100, allocation.sharedMc / (allocation.capMc || 1) * 100)}%` }} />
          </div>
          {allocation.sharedCodes.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">
            {allocation.sharedCodes.map(code => <CourseUsageDetails key={code} code={code} report={report} />)}
          </div>}
          {overCap && <p role="alert" className="text-xs text-amber-800">{allocation.sharedMc - allocation.capMc} MC over allowance · Change a choice or reset to automatic.</p>}
        </div>
      )}
      {conflicts.length > 0 && <p role="alert" className="text-xs text-amber-800">Used by more than two programmes: {conflicts.join(', ')}. Change a choice to resolve.</p>}
      {issues.map(issue => <p role="alert" key={issue} className="text-xs text-amber-800">{issue}</p>)}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      {editing ? <div>
        <h3 ref={editorHeading} tabIndex={-1} className="text-sm font-medium text-ink focus:outline-none">{editing.name}</h3>
        <div className="mt-3 divide-y divide-ink/10">
          {editing.eligibleCodes.map(code => {
            const module = byCode.get(code)!;
            const choice = module.allocationPreferences?.[allocation.key]?.[editing.id];
            const selected = editing.codes.includes(code);
            const others = otherUses(code);
            const usage = others.length ? `${selected ? 'Shared with' : 'Also used by'} ${others.map(use => programmeLabel(use.programmeKey)).join(' + ')}`
              : selected ? `Used only by this ${allocation.kind === 'minor' ? 'minor' : 'major'}` : 'No shared credits';
            return <div key={code} className="flex items-center gap-2 py-2">
              <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3">
                <input type="checkbox" checked={choice === 'include' || (choice !== 'exclude' && selected)} onChange={event => setChoice(editing, code, event.target.checked)} className="h-4 w-4 shrink-0 accent-ink" aria-label={`Use ${code} for ${editing.name}`} />
                <span className="min-w-0">
                  <span className="block font-mono text-xs font-semibold">{code} · {module.mcs} MC</span>
                  <span className="block text-xs text-muted">{module.name}</span>
                  <span className="mt-1 block text-[11px] text-muted">{usage}{choice ? ` · Manual: ${choice === 'include' ? 'use' : 'leave out'}` : ''}</span>
                </span>
              </label>
              {choice && <button type="button" aria-label={`Choose ${code} automatically for ${editing.name}`} onClick={() => save(withAllocationChoice(module, allocation.key, editing.id))} className="min-h-11 shrink-0 rounded-xl px-3 text-xs font-medium hover:bg-ink/5">Auto</button>}
            </div>;
          })}
        </div>
        <button type="button" onClick={() => setEditingId(null)} className="mt-4 min-h-11 w-full rounded-2xl bg-ink px-4 text-sm font-medium text-canvas">Done</button>
      </div> : <ul className="flex flex-col gap-2">
        {allocation.rows.map(row => <li key={row.id} className="rounded-2xl bg-paper/60 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium leading-relaxed text-ink"><span aria-label={row.fulfilled ? 'Met' : 'Incomplete'} className={row.fulfilled ? 'mr-1.5 text-ink' : 'mr-1.5 text-amber-800'}>{row.fulfilled ? '✓' : '○'}</span>{row.name}</p>
              <p className="mt-1 text-[11px] text-muted" title={row.categoryBased ? 'Uses your category assignments' : undefined}>{row.have}/{row.need} {row.unit}</p>
            </div>
            {row.eligibleCodes.length > 0 && <button type="button" ref={el => { chooseButtons.current[row.id] = el; }} onClick={() => { setEditingId(row.id); setError(null); }}
              aria-label={`Choose courses for ${source.label}: ${row.name}`} className="min-h-10 shrink-0 rounded-xl px-2 text-xs font-medium text-ink hover:bg-ink/5">Choose</button>}
          </div>
          {row.info && !row.fulfilled && <p className="mt-1 text-xs leading-relaxed text-amber-800">{row.info}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {row.codes.map(code => <CourseUsageDetails key={code} code={code} report={report} manual={byCode.get(code)?.allocationPreferences?.[allocation.key]?.[row.id] === 'include'} />)}
          </div>
        </li>)}
      </ul>}
    </section>
  );
};
