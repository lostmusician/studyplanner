import { useEffect, useRef, useState } from 'react';
import type { Major, MajorCategory, Module, PlacedModule, StudentSemester, WaivedModule } from '@shared/types';
import type { ConstraintStatus, FocusAreaStatus, RequirementStatus, Stats } from '../lib/studyPlan';
import { computeBreadthDepth, computeFocusAreas, computeProgrammeElectives, matchesFulfiller } from '../lib/studyPlan';
import { FocusAreaExplorer } from './FocusAreaExplorer';
import { ProgrammeElectivesExplorer } from './ProgrammeElectivesExplorer';

interface Props {
  major: Major;
  stats: Stats;
  semesters: StudentSemester[];
  waivedModules: WaivedModule[];
  requirements: RequirementStatus[];
  requirementMappings: Record<string, string[]>;
  addRequirementMapping: (requirementName: string, moduleCode: string) => void;
  removeRequirementMapping: (requirementName: string, moduleCode: string) => void;
}

export const StatsSummary = ({
  major,
  stats,
  semesters,
  waivedModules,
  requirements,
  requirementMappings,
  addRequirementMapping,
  removeRequirementMapping,
}: Props) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const openCategory = major.categories.find((cat) => cat.id === openId) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <TotalStatCard
          value={stats.totalMc}
          target={major.totalMcTarget}
        />
        {major.categories.map((cat) => (
          <StatCard
            key={cat.id}
            label={cat.label}
            value={stats.byCategory[cat.id] ?? 0}
            target={cat.mcTarget}
            color={cat.color}
            isOpen={openId === cat.id}
            controlsId={`category-panel-${cat.id}`}
            onClick={() => setOpenId((current) => (current === cat.id ? null : cat.id))}
          />
        ))}
      </div>

      {openCategory && (
        <CategoryPanel
          id={`category-panel-${openCategory.id}`}
          category={openCategory}
          major={major}
          stats={stats}
          semesters={semesters}
          waivedModules={waivedModules}
          requirements={requirements}
          requirementMappings={requirementMappings}
          addRequirementMapping={addRequirementMapping}
          removeRequirementMapping={removeRequirementMapping}
        />
      )}
    </div>
  );
};

const TotalStatCard = ({
  value,
  target,
}: {
  value: number;
  target: number;
}) => {
  const pct = Math.min(100, (value / target) * 100);

  return (
    <div
      className="flex min-w-0 grow basis-[calc(50%-0.375rem)] flex-col gap-1.5 rounded-3xl bg-white px-4 py-3 text-left shadow-soft sm:grow-0 sm:basis-auto sm:min-w-[160px] sm:px-5 sm:py-4"
      style={{ border: '1px solid rgba(20,20,19,0.08)' }}
    >
      <span className="text-xs text-ink/60 font-medium tracking-wide uppercase">Total MCs</span>
      <span className="text-2xl font-bold text-ink leading-none">
        {value}
        <span className="text-sm font-normal text-ink/50 ml-1">/ {target}</span>
      </span>
      <div className="h-1 rounded-full bg-ink/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-ink/40 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

const StatCard = ({
  label,
  value,
  target,
  color,
  isOpen = false,
  controlsId,
  onClick,
}: {
  label: string;
  value: number;
  target?: number;
  color: string;
  isOpen?: boolean;
  controlsId?: string;
  onClick?: () => void;
}) => {
  const pct = target ? Math.min(100, (value / target) * 100) : null;
  const className =
    'flex min-w-0 grow basis-[calc(50%-0.375rem)] flex-col gap-1.5 rounded-3xl px-4 py-3 text-left transition sm:grow-0 sm:basis-auto sm:min-w-[140px] sm:px-5 sm:py-4';
  const style = {
    backgroundColor: color,
    boxShadow: isOpen ? `0 0 0 2px ${color}, 0 0 0 5px rgba(20,20,19,0.16)` : 'none',
  };
  const content = (
    <>
      <span className="text-xs text-ink/60 font-medium tracking-wide uppercase">{label}</span>
      <span className="text-2xl font-bold text-ink leading-none">
        {value}
        {target && <span className="text-sm font-normal text-ink/50 ml-1">/ {target}</span>}
      </span>
      {pct !== null && (
        <div className="h-1 rounded-full bg-ink/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-ink/30 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </>
  );

  if (!onClick) {
    return (
      <div className={className} style={style}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`${className} hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/30`}
      style={style}
      onClick={onClick}
      aria-expanded={isOpen}
      aria-controls={controlsId}
    >
      {content}
    </button>
  );
};

const CategoryPanel = ({
  id,
  category,
  major,
  stats,
  semesters,
  waivedModules,
  requirements,
  requirementMappings,
  addRequirementMapping,
  removeRequirementMapping,
}: {
  id: string;
  category: MajorCategory;
  major: Major;
  stats: Stats;
  semesters: StudentSemester[];
  waivedModules: WaivedModule[];
  requirements: RequirementStatus[];
  requirementMappings: Record<string, string[]>;
  addRequirementMapping: (requirementName: string, moduleCode: string) => void;
  removeRequirementMapping: (requirementName: string, moduleCode: string) => void;
}) => {
  const categoryRequirements = requirements.filter((req) => req.categoryId === category.id);
  const expectedModules = major.defaultPlan
    .filter((entry) => entry.categoryId === category.id)
    .map((entry) => major.moduleCatalog[entry.moduleCode])
    .filter((module): module is Module => Boolean(module));
  const placedModules = semesters.flatMap((semester) =>
    semester.modules.filter((module) => module.categoryId === category.id),
  );
  const waivedForCategory = waivedModules.filter((module) => module.categoryId === category.id);
  const placedCodes = new Set(placedModules.map((module) => module.code));
  const waivedCodes = new Set(waivedForCategory.map((module) => module.code));
  const placedMc = stats.byCategory[category.id] ?? 0;
  const remainingMc = Math.max(0, (category.mcTarget ?? 0) - placedMc);
  const showFocusAreas =
    category.id === major.breadthDepth?.categoryId && Boolean(major.focusAreas?.length);
  const showProgrammeElectives = category.id === major.programmeElectives?.categoryId;

  // All modules currently on the planner (any category) plus waived ones, deduped by
  // code — the pool a requirement row can pick a manual mapping candidate from.
  const plannerModules: PlacedModule[] = [];
  const seenPlannerCodes = new Set<string>();
  for (const module of [...semesters.flatMap((s) => s.modules), ...waivedModules]) {
    if (seenPlannerCodes.has(module.code)) continue;
    seenPlannerCodes.add(module.code);
    plannerModules.push(module);
  }
  const allPlacedCodes = new Set(plannerModules.map((module) => module.code));

  return (
    <section
      id={id}
      className="rounded-4xl bg-paper p-5 shadow-soft"
      style={{ borderTop: `5px solid ${category.color}` }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <h2 className="text-sm font-semibold text-ink">{category.label}</h2>
        {category.mcTarget && (
          <span className="text-xs text-muted">{placedMc}/{category.mcTarget} MC</span>
        )}
      </div>

      {showFocusAreas && (
        <BreadthDepthPanel major={major} semesters={semesters} waivedModules={waivedModules} />
      )}

      {showProgrammeElectives && (
        <ProgrammeElectivesPanel major={major} semesters={semesters} waivedModules={waivedModules} />
      )}

      {categoryRequirements.length > 0 ? (
        <div className="flex flex-col gap-4">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {categoryRequirements.map((req) => {
              const rule = major.requirements.find((r) => r.name === req.name);
              const mappedCodes = requirementMappings[req.name] ?? [];
              const candidates = rule
                ? plannerModules.filter(
                    (module) =>
                      !rule.fulfilledBy.some((fulfiller) => matchesFulfiller(module.code, fulfiller)) &&
                      !mappedCodes.includes(module.code),
                  )
                : [];
              return (
                <RequirementRow
                  key={req.name}
                  req={req}
                  mappedCodes={mappedCodes}
                  placedCodes={allPlacedCodes}
                  candidates={candidates}
                  onAddMapping={(code) => addRequirementMapping(req.name, code)}
                  onRemoveMapping={(code) => removeRequirementMapping(req.name, code)}
                />
              );
            })}
          </ul>
          {waivedForCategory.length > 0 && <WaivedInlineList modules={waivedForCategory} />}
        </div>
      ) : expectedModules.length > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {expectedModules.map((module) => (
            <ModuleStatusRow
              key={module.code}
              module={module}
              fulfilled={placedCodes.has(module.code) || waivedCodes.has(module.code)}
              status={waivedCodes.has(module.code) ? 'Waived' : undefined}
            />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col gap-3">
          {placedModules.length > 0 || waivedForCategory.length > 0 ? (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {placedModules.map((module) => (
                <ModuleStatusRow key={module.code} module={module} fulfilled />
              ))}
              {waivedForCategory.map((module) => (
                <ModuleStatusRow key={module.code} module={module} fulfilled status="Waived" />
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">No modules added yet.</p>
          )}
          {category.mcTarget && (
            <p className="text-xs font-medium text-ink">{remainingMc} MC remaining to target</p>
          )}
        </div>
      )}
    </section>
  );
};

const BreadthDepthPanel = ({
  major,
  semesters,
  waivedModules,
}: {
  major: Major;
  semesters: StudentSemester[];
  waivedModules: WaivedModule[];
}) => {
  const bd = computeBreadthDepth(major, semesters, waivedModules);
  const metCount = bd ? bd.constraints.filter((c) => c.fulfilled).length : 0;

  return (
    <div className="mb-4 flex flex-col gap-3">
      {bd && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-semibold text-ink">
            Constraints
            <span className="ml-1 font-normal text-muted">{metCount}/{bd.constraints.length}</span>
          </span>
          {bd.constraints.map((constraint) => (
            <ConstraintChip key={constraint.id} constraint={constraint} />
          ))}
        </div>
      )}

      <FocusAreaTracker major={major} semesters={semesters} waivedModules={waivedModules} />
    </div>
  );
};

const ProgrammeElectivesPanel = ({
  major,
  semesters,
  waivedModules,
}: {
  major: Major;
  semesters: StudentSemester[];
  waivedModules: WaivedModule[];
}) => {
  const [explorerOpen, setExplorerOpen] = useState(false);
  const pe = computeProgrammeElectives(major, semesters, waivedModules);
  const metCount = pe ? pe.constraints.filter((c) => c.fulfilled).length : 0;

  return (
    <div className="mb-4 flex flex-col gap-3">
      {pe && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-semibold text-ink">
            Constraints
            <span className="ml-1 font-normal text-muted">{metCount}/{pe.constraints.length}</span>
          </span>
          {pe.constraints.map((constraint) => (
            <ConstraintChip key={constraint.id} constraint={constraint} />
          ))}
        </div>
      )}

      {pe && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] font-semibold text-ink">
            Categories
            <span className="ml-1 font-normal text-muted">
              {pe.matchedCourses.length}/{pe.minCourses} courses
            </span>
          </span>
          {pe.categories.map((cat) => (
            <span
              key={cat.id}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] leading-none"
              style={{ backgroundColor: 'rgba(20,20,19,0.06)', color: 'rgb(108,107,104)' }}
            >
              <span className="font-medium">{cat.label}</span>
              <span className="opacity-70">{cat.matched.length}</span>
            </span>
          ))}
          <button
            type="button"
            onClick={() => setExplorerOpen(true)}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-ink underline-offset-2 transition-colors hover:bg-ink/5 hover:underline"
          >
            Browse categories
            <span aria-hidden="true">→</span>
          </button>
        </div>
      )}

      {explorerOpen && (
        <ProgrammeElectivesExplorer
          major={major}
          semesters={semesters}
          waivedModules={waivedModules}
          onClose={() => setExplorerOpen(false)}
        />
      )}
    </div>
  );
};

export const ConstraintChip = ({ constraint }: { constraint: ConstraintStatus }) => {
  const bg = constraint.warn
    ? 'rgb(254,243,199)'
    : constraint.fulfilled
      ? 'rgb(20,20,19)'
      : 'rgba(20,20,19,0.06)';
  const fg = constraint.warn
    ? 'rgb(180,83,9)'
    : constraint.fulfilled
      ? 'rgb(239,238,231)'
      : 'rgb(108,107,104)';
  return (
    <span
      title={constraint.label}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] leading-none"
      style={{ backgroundColor: bg, color: fg }}
    >
      {constraint.fulfilled && !constraint.warn && (
        <svg viewBox="0 0 10 8" fill="none" stroke={fg} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-2 w-2.5">
          <path d="M1 4l2.5 2.5L9 1" />
        </svg>
      )}
      <span className="font-medium">{constraint.short}</span>
      {constraint.detail && <span className="opacity-70">{constraint.detail}</span>}
    </span>
  );
};

const FocusAreaTracker = ({
  major,
  semesters,
  waivedModules,
}: {
  major: Major;
  semesters: StudentSemester[];
  waivedModules: WaivedModule[];
}) => {
  const [explorerOpen, setExplorerOpen] = useState(false);
  const { areas, anyFulfilled } = computeFocusAreas(major, semesters, waivedModules);
  const started = areas.filter((area) => area.matched.length > 0);
  const untouched = areas.length - started.length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className="mr-1 text-[11px] font-semibold text-ink"
        title="Satisfy one focus area: 3 primaries with at least one at level-4000."
      >
        Focus area
        <span className="ml-1 font-normal text-muted">
          {anyFulfilled ? 'done' : 'pick 1'}
        </span>
      </span>

      {started.length > 0 &&
        started.map((area) => <FocusAreaChip key={area.id} area={area} />)}

      <button
        type="button"
        onClick={() => setExplorerOpen(true)}
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-ink underline-offset-2 transition-colors hover:bg-ink/5 hover:underline"
      >
        {started.length > 0
          ? untouched > 0
            ? `+${untouched} more`
            : 'View all'
          : 'Browse focus areas'}
        <span aria-hidden="true">→</span>
      </button>

      {explorerOpen && (
        <FocusAreaExplorer
          major={major}
          semesters={semesters}
          waivedModules={waivedModules}
          onClose={() => setExplorerOpen(false)}
        />
      )}
    </div>
  );
};

const FocusAreaChip = ({ area }: { area: FocusAreaStatus }) => {
  const needSenior =
    !area.fulfilled && area.matched.length >= area.need && area.seniorMatched.length < area.needSenior;
  const bg = area.fulfilled ? 'rgb(20,20,19)' : needSenior ? 'rgb(254,243,199)' : 'rgba(20,20,19,0.06)';
  const fg = area.fulfilled ? 'rgb(239,238,231)' : needSenior ? 'rgb(180,83,9)' : 'rgb(108,107,104)';
  return (
    <span
      title={needSenior ? `${area.label} — needs a level-4000 course` : area.label}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] leading-none"
      style={{ backgroundColor: bg, color: fg }}
    >
      <span className="font-medium">{area.label}</span>
      <span className="opacity-70">
        {needSenior ? 'need L4000' : `${area.matched.length}/${area.need}`}
      </span>
    </span>
  );
};

export const RequirementRow = ({
  req,
  mappedCodes,
  placedCodes,
  candidates,
  onAddMapping,
  onRemoveMapping,
}: {
  req: RequirementStatus;
  mappedCodes?: string[];
  placedCodes?: Set<string>;
  candidates?: PlacedModule[];
  onAddMapping?: (code: string) => void;
  onRemoveMapping?: (code: string) => void;
}) => {
  const [pickerOpen, setPickerOpen] = useState(false);
  const containerRef = useRef<HTMLLIElement>(null);
  const showMappingUi = Boolean(onAddMapping && onRemoveMapping);
  const hasCandidates = Boolean(candidates && candidates.length > 0);

  useEffect(() => {
    if (!pickerOpen) return;
    const handleMouseDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPickerOpen(false);
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [pickerOpen]);

  return (
    <li
      ref={containerRef}
      className="relative flex min-h-10 flex-col gap-1.5 rounded-2xl bg-canvas/60 px-3 py-2"
    >
      <div className="flex items-start gap-2.5">
        <StatusDot fulfilled={req.fulfilled} />
        <span
          className="text-xs leading-relaxed"
          style={{ color: req.fulfilled ? 'rgb(20,20,19)' : 'rgb(108,107,104)' }}
        >
          {req.name}
        </span>
        {req.need > 1 && (
          <span className="ml-auto flex-shrink-0 rounded-full bg-ink/10 px-2 py-0.5 text-[10px] text-muted">
            {req.have}/{req.need}
          </span>
        )}
        {showMappingUi && (
          <button
            type="button"
            onClick={() => setPickerOpen((open) => !open)}
            disabled={!hasCandidates}
            title="Link a module from your plan to this requirement"
            aria-label="Link a module from your plan to this requirement"
            className={`flex-shrink-0 text-sm leading-none transition-colors ${
              hasCandidates ? 'text-muted hover:text-ink' : 'cursor-not-allowed text-muted/30'
            } ${req.need <= 1 ? 'ml-auto' : ''}`}
          >
            ⊕
          </button>
        )}
      </div>

      {showMappingUi && mappedCodes && mappedCodes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 pl-[1.625rem]">
          {mappedCodes.map((code) => {
            const dormant = !placedCodes?.has(code);
            return (
              <span
                key={code}
                title={dormant ? 'Not currently on your planner — not counting' : undefined}
                className={`inline-flex items-center gap-1 rounded-full bg-ink/10 px-2 py-0.5 text-[10px] ${
                  dormant ? 'opacity-40' : ''
                }`}
              >
                <span className="font-mono">{code}</span>
                <button
                  type="button"
                  onClick={() => onRemoveMapping?.(code)}
                  aria-label={`Remove ${code} from this requirement`}
                  className="text-muted hover:text-ink"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      {pickerOpen && hasCandidates && (
        <div className="absolute right-0 top-full z-40 mt-1 max-h-48 w-56 overflow-y-auto rounded-2xl border border-ink/10 bg-paper shadow-soft">
          {candidates?.map((module) => (
            <button
              key={module.code}
              type="button"
              onClick={() => {
                onAddMapping?.(module.code);
                setPickerOpen(false);
              }}
              className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-canvas"
            >
              <span className="font-mono text-xs font-bold text-ink">{module.code}</span>
              <span className="truncate text-[11px] text-muted">{module.name}</span>
            </button>
          ))}
        </div>
      )}
    </li>
  );
};

const WaivedInlineList = ({ modules }: { modules: WaivedModule[] }) => (
  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
    <span>Waived:</span>
    {modules.map((module) => (
      <span key={module.code} className="rounded-full bg-canvas px-2 py-1 font-mono text-ink/70">
        {module.code}
      </span>
    ))}
  </div>
);

const ModuleStatusRow = ({
  module,
  fulfilled,
  status,
}: {
  module: Module;
  fulfilled: boolean;
  status?: string;
}) => (
  <li className="flex min-h-10 items-start gap-2.5 rounded-2xl bg-canvas/60 px-3 py-2">
    <StatusDot fulfilled={fulfilled} />
    <div className="flex min-w-0 flex-col">
      <span
        className="font-mono text-xs font-bold leading-relaxed"
        style={{ color: fulfilled ? 'rgb(20,20,19)' : 'rgb(108,107,104)' }}
      >
        {module.code}
      </span>
      <span className="truncate text-[11px] text-muted">{module.name}</span>
    </div>
    <span className="ml-auto flex-shrink-0 text-[10px] text-muted">{status ?? `${module.mcs} MC`}</span>
  </li>
);

export const StatusDot = ({ fulfilled }: { fulfilled: boolean }) => (
  <span
    className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[10px]"
    style={{
      backgroundColor: fulfilled ? 'rgb(20,20,19)' : 'transparent',
      border: fulfilled ? 'none' : '1.5px solid rgb(108,107,104)',
    }}
  >
    {fulfilled && (
      <svg
        viewBox="0 0 10 8"
        fill="none"
        stroke="rgb(239,238,231)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-2 w-2.5"
      >
        <path d="M1 4l2.5 2.5L9 1" />
      </svg>
    )}
  </span>
);