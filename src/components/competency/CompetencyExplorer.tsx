import { useMemo, useState } from 'react';
import type { Major, StudentSemester, WaivedModule } from '@shared/types';
import type { RequirementStatus } from '../../lib/studyPlan';
import {
  DISCIPLINES,
  DISCIPLINE_ORDER,
  buildSemesterTimeline,
  extractGraphNodesAndLinks,
  extractRiverData,
  hexToRgba,
} from './competencyData';
import type { DisciplineId } from './competencyTypes';
import { ForceGraphView } from './ForceGraphView';
import { RiverView } from './RiverView';

interface Props {
  major: Major;
  semesters: StudentSemester[];
  waivedModules: WaivedModule[];
  requirements: RequirementStatus[];
  onClose: () => void;
  /** Optional profile year ("Year 2") used to mark earlier years completed. */
  studentYear?: string;
}

type ExplorerView = 'graph' | 'river';

export const CompetencyExplorer = ({
  major,
  semesters,
  waivedModules,
  requirements,
  onClose,
  studentYear,
}: Props) => {
  const [activeView, setActiveView] = useState<ExplorerView>('graph');

  const currentYear = useMemo(() => {
    const match = studentYear?.match(/\d+/);
    if (!match) return undefined;
    const parsed = Number.parseInt(match[0], 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }, [studentYear]);

  const timeline = useMemo(() => buildSemesterTimeline(semesters), [semesters]);
  const graph = useMemo(
    () => extractGraphNodesAndLinks(major, semesters, waivedModules, { currentYear }),
    [major, semesters, waivedModules, currentYear],
  );
  const river = useMemo(
    () => extractRiverData(major, semesters, waivedModules),
    [major, semesters, waivedModules],
  );

  const mappedNodes = graph.nodes.filter((node) => node.status !== 'unplaced');
  const mappedMc = mappedNodes.reduce((sum, node) => sum + node.mcs, 0);
  const prerequisiteLinks = graph.links.filter((link) => link.kind === 'prerequisite').length;
  const requirementsMet = requirements.filter((requirement) => requirement.fulfilled).length;
  const unplacedNodes = graph.nodes.filter((node) => node.status === 'unplaced').length;

  const strongest = DISCIPLINE_ORDER.reduce<{ id: DisciplineId; total: number }>(
    (best, id) => {
      const total = river.cumulativeTotals[id];
      return total > best.total ? { id, total } : best;
    },
    { id: 'theory', total: 0 },
  );
  const strongestInfo = DISCIPLINES[strongest.id];

  return (
    <section className="flex min-h-[620px] flex-col gap-3 rounded-3xl border border-ink/10 bg-paper/35 p-3 sm:p-4 print:hidden lg:h-[calc(100vh-190px)] lg:min-h-[650px]">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-base font-bold leading-tight text-ink sm:text-lg">
          Competency Visualiser
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-xl border border-ink/10 bg-[#f8f5ee]/80 p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setActiveView('graph')}
              aria-pressed={activeView === 'graph'}
              className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
                activeView === 'graph'
                  ? 'bg-ink text-canvas shadow-xs'
                  : 'text-muted hover:bg-white/50 hover:text-ink'
              }`}
            >
              Graph
            </button>
            <button
              type="button"
              onClick={() => setActiveView('river')}
              aria-pressed={activeView === 'river'}
              className={`rounded-lg px-2.5 py-1 font-medium transition-colors ${
                activeView === 'river'
                  ? 'bg-ink text-canvas shadow-xs'
                  : 'text-muted hover:bg-white/50 hover:text-ink'
              }`}
            >
              River
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-xl border border-ink/15 bg-canvas px-3 py-1.5 text-[11px] font-medium text-ink transition-colors hover:bg-paper"
          >
            <span aria-hidden="true">←</span>
            <span>Back to Grid</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <StatTile
          label="Total MCs"
          value={String(mappedMc)}
          detail={river.waivedMcs > 0 ? `incl. ${river.waivedMcs} waived` : 'across placed modules'}
        />
        <StatTile
          label="Modules Mapped"
          value={String(mappedNodes.length)}
          detail={unplacedNodes > 0 ? `${unplacedNodes} unplaced` : 'all modules on the planner'}
        />
        <StatTile
          label="Prerequisites"
          value={String(prerequisiteLinks)}
          detail="dependency links traced"
        />
        <div className="flex flex-col justify-between rounded-2xl border border-ink/10 bg-[#f8f5ee]/70 px-3 py-2.5">
          <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">
            Strongest Discipline
          </span>
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: strongestInfo.color }}
            />
            <span className="truncate text-sm font-bold leading-tight text-ink">
              {strongest.total > 0 ? strongestInfo.shortLabel : '—'}
            </span>
          </div>
          <span className="mt-0.5 text-[10px] text-muted">
            {strongest.total > 0 ? `${strongest.total} MC accumulated` : 'place modules to begin'}
          </span>
        </div>
        <div className="flex flex-col justify-between rounded-2xl border border-ink/10 bg-[#f8f5ee]/70 px-3 py-2.5">
          <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">
            Requirements Met
          </span>
          <div className="mt-1 text-sm font-bold leading-tight text-ink">
            {requirements.length > 0 ? `${requirementsMet}/${requirements.length}` : '—'}
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-ink/10">
            <div
              className="h-full rounded-full bg-ink/55 transition-all duration-300"
              style={{
                width: requirements.length > 0 ? `${(requirementsMet / requirements.length) * 100}%` : '0%',
              }}
            />
          </div>
        </div>
      </div>

      <div className="h-[480px] shrink-0 lg:h-auto lg:min-h-0 lg:flex-1">
        {graph.nodes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-ink/20 bg-[#f8f5ee]/55 px-6 text-center">
            <div>
              <h2 className="text-sm font-semibold text-ink">No modules placed yet</h2>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-muted">
                Add modules to your semester plan to view the graph and river.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-ink px-3 py-1.5 text-xs font-medium text-canvas transition-opacity hover:opacity-85"
            >
              Return to Semester Grid
            </button>
          </div>
        ) : activeView === 'graph' ? (
          <ForceGraphView graph={graph} timeline={timeline} />
        ) : (
          <RiverView data={river} />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-0.5 text-[10px] text-muted">
        <div className="flex flex-wrap items-center gap-2">
          {DISCIPLINE_ORDER.map((id) => {
            const info = DISCIPLINES[id];
            return (
              <span key={id} className="inline-flex items-center gap-1">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: hexToRgba(info.color, 0.9) }}
                />
                {info.shortLabel}
              </span>
            );
          })}
        </div>
        <span className="hidden sm:inline">
          {activeView === 'graph'
            ? 'Hover for lineage · drag nodes · scroll to zoom · scrub the timeline'
            : 'Hover a discipline for semester summary · hover a module for details'}
        </span>
      </div>
    </section>
  );
};

const StatTile = ({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) => (
  <div className="flex flex-col justify-between rounded-2xl border border-ink/10 bg-[#f8f5ee]/70 px-3 py-2.5">
    <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</span>
    <span className="mt-1 text-lg font-bold leading-none text-ink">{value}</span>
    <span className="mt-1 truncate text-[10px] text-muted">{detail}</span>
  </div>
);
