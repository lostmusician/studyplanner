import { useState } from 'react';
import type { Major, MajorCategory, Module, StudentSemester, WaivedModule } from '@shared/types';
import type { RequirementStatus, Stats } from '../lib/studyPlan';

interface Props {
  major: Major;
  stats: Stats;
  semesters: StudentSemester[];
  waivedModules: WaivedModule[];
  requirements: RequirementStatus[];
}

export const StatsSummary = ({ major, stats, semesters, waivedModules, requirements }: Props) => {
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
      className="flex min-w-[160px] flex-col gap-1.5 rounded-3xl bg-white px-5 py-4 text-left shadow-soft"
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
  const className = 'flex min-w-[140px] flex-col gap-1.5 rounded-3xl px-5 py-4 text-left transition';
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
}: {
  id: string;
  category: MajorCategory;
  major: Major;
  stats: Stats;
  semesters: StudentSemester[];
  waivedModules: WaivedModule[];
  requirements: RequirementStatus[];
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

      {categoryRequirements.length > 0 ? (
        <div className="flex flex-col gap-4">
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {categoryRequirements.map((req) => (
              <RequirementRow key={req.name} req={req} />
            ))}
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

const RequirementRow = ({ req }: { req: RequirementStatus }) => (
  <li className="flex min-h-10 items-start gap-2.5 rounded-2xl bg-canvas/60 px-3 py-2">
    <StatusDot fulfilled={req.fulfilled} />
    <span
      className="text-xs leading-relaxed"
      style={{ color: req.fulfilled ? 'rgb(20,20,19)' : 'rgb(108,107,104)' }}
    >
      {req.name}
    </span>
    {req.need > 1 && (
      <span className="ml-auto rounded-full bg-ink/10 px-2 py-0.5 text-[10px] text-muted">
        {req.have}/{req.need}
      </span>
    )}
  </li>
);

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

const StatusDot = ({ fulfilled }: { fulfilled: boolean }) => (
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