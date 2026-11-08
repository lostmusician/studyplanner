import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AllocationReport } from '../lib/requirementAllocation';
import { ModuleDialog } from './ModuleDialog';
import { FOCUS_RING } from '../lib/colors';

export interface CourseSharingProps {
  allocation?: AllocationReport;
  onManageProgramme?: (programmeKey: string) => void;
}

/** Uses the allocation's actual programme usages, rather than course eligibility. */
export const CourseSharingBadge = ({ code, allocation, onManageProgramme, onInteract, onDetailsChange }: CourseSharingProps & {
  code: string;
  onInteract?: () => void;
  onDetailsChange?: (open: boolean) => void;
}) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [tooltip, setTooltip] = useState<{ left: number; top: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipId = useId();
  const uses = allocation?.courseUses[code] ?? [];
  if (uses.length < 2) return null;
  const overAllowance = allocation?.programmes.filter(programme => programme.capMc !== null && programme.sharedMc > programme.capMc && programme.sharedCodes.includes(code)) ?? [];
  const conflict = uses.length > 2 || overAllowance.length > 0;
  const label = conflict ? 'Conflict' : 'Shared';
  const description = `Used by ${uses.map(use => use.programmeLabel).join(' + ')}`;
  const showTooltip = () => {
    onInteract?.();
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 264)),
      top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 100)) });
  };
  const close = () => { setDetailsOpen(false); setTooltip(null); onDetailsChange?.(false); };

  return <span className="inline-flex shrink-0"
    onPointerDown={event => event.stopPropagation()}
    onMouseDown={event => event.stopPropagation()}
    onTouchStart={event => event.stopPropagation()}>
    <button ref={buttonRef} type="button"
      className={`relative inline-flex h-6 shrink-0 cursor-pointer items-center rounded-full px-2 font-sans text-[9px] font-semibold leading-none ${FOCUS_RING} ${conflict ? 'bg-amber-100 text-amber-900' : 'bg-ink/10 text-ink/80'}`}
      aria-label={`${label} course ${code}`} aria-haspopup="dialog" aria-describedby={tooltip ? tooltipId : undefined}
      onPointerDown={event => event.stopPropagation()}
      onMouseEnter={showTooltip} onMouseLeave={() => setTooltip(null)} onFocus={showTooltip} onBlur={() => setTooltip(null)}
      onClick={event => { event.stopPropagation(); onInteract?.(); setTooltip(null); setDetailsOpen(true); onDetailsChange?.(true); }}>
      {label}
    </button>
    {tooltip && !detailsOpen && createPortal(
      <div id={tooltipId} role="tooltip" style={{ position: 'fixed', left: tooltip.left, top: tooltip.top }}
        className="pointer-events-none z-[10000] w-64 rounded-xl bg-ink px-3 py-2 text-[11px] leading-relaxed text-canvas shadow-soft">
        {description}
      </div>, document.body,
    )}
    {detailsOpen && <ModuleDialog title={`${code} · ${label.toLowerCase()}`} onClose={close}>
      {uses.length > 2 && <p role="alert" className="mb-3 text-xs text-amber-800">Used by more than two programmes.</p>}
      {overAllowance.map(programme => <p role="alert" key={programme.key} className="mb-3 text-xs text-amber-800">{programme.label}: {programme.sharedMc - programme.capMc!} MC over sharing allowance.</p>)}
      <ul className="flex flex-col gap-3">
        {uses.map(use => <li key={use.programmeKey} className="rounded-2xl bg-paper/60 p-3">
          <p className="text-sm font-semibold text-ink">{use.programmeLabel}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{use.rows.join(' · ')}</p>
          {onManageProgramme && allocation?.programmes.find(programme => programme.key === use.programmeKey)?.kind !== 'primary' &&
            <button type="button" className="mt-2 min-h-10 rounded-xl bg-ink/10 px-3 text-xs font-medium text-ink hover:bg-ink/15"
              onClick={() => { close(); onManageProgramme(use.programmeKey); }}>Manage {use.programmeLabel}</button>}
        </li>)}
      </ul>
    </ModuleDialog>}
  </span>;
};
