import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useStudyPlan } from '../hooks/useStudyPlan';
import { Draggable } from './Draggable';
import { Droppable } from './Droppable';
import { categoryBadgeTone, semesterLabel } from '../lib/studyPlan';
import {
  assessPrerequisiteConflict,
  fetchNusModsModuleDetail,
  formatPrerequisiteSummary,
  searchNusModsModules,
  type NusModsModuleDetail,
  type NusModsModuleSummary,
} from '../lib/nusmods';
import type { Category, Module, SemesterKey } from '../types';

const emptyDraft = {
  code: '',
  name: '',
  mcs: 4,
  category: 'Primary Major' as Category,
  year: 4,
  sem: 1,
};

const semesterOptions = Array.from({ length: 8 }, (_, index) => {
  const year = Math.floor(index / 2) + 1;
  const sem = (index % 2) + 1;
  return { key: `${year}-${sem}`, label: `Y${year}S${sem}`, year, sem };
});

const buildSemesterKey = (year: number, sem: number): SemesterKey => `${year}-${sem}` as SemesterKey;

const draggableId = (semesterKey: SemesterKey, moduleCode: string): string => `drag::${semesterKey}::${moduleCode}`;
const droppableId = (columnIndex: number): string => `drop::col${columnIndex}`;

const getCategoryColor = (category: Category): string => {
  switch (category) {
    case 'SOC/NUSC':
      return 'bg-[rgb(198,208,202)] hover:bg-[rgb(188,198,192)] focus-within:bg-[rgb(188,198,192)]';
    case 'University Requirements':
      return 'bg-[rgb(171,184,155)] hover:bg-[rgb(161,174,145)] focus-within:bg-[rgb(161,174,145)]';
    case 'Unrestricted Electives':
      return 'bg-[rgb(195,186,210)] hover:bg-[rgb(185,176,200)] focus-within:bg-[rgb(185,176,200)]';
    case 'Primary Major':
      return 'bg-canvas';
    case 'Other Programmes':
      return 'bg-canvas';
    default:
      return 'bg-canvas';
  }
};

const RequirementChecklist = ({
  title,
  requirements,
}: {
  title: string;
  requirements: { name: string; fulfilledBy: string[]; isFulfilled: boolean }[];
}) => (
  <section className="rounded-[28px] border border-line bg-paper/85 p-5 shadow-soft backdrop-blur-sm">
    <h3 className="text-lg font-semibold text-ink">{title}</h3>
    <div className="mt-4 space-y-3">
      {requirements.map((requirement) => (
        <div key={requirement.name} className="rounded-2xl border border-line bg-canvas/80 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-ink">{requirement.name}</p>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                requirement.isFulfilled ? 'bg-ink text-canvas' : 'bg-[#d8d2c6] text-ink'
              }`}
            >
              {requirement.isFulfilled ? 'Fulfilled' : 'Pending'}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {requirement.fulfilledBy.length > 0 ? (
              requirement.fulfilledBy.map((code) => (
                <span key={code} className="rounded-full bg-[#efe8d9] px-2.5 py-1 text-xs text-ink">
                  {code}
                </span>
              ))
            ) : (
              <span className="text-xs text-muted">Add matching modules to fulfill this requirement.</span>
            )}
          </div>
        </div>
      ))}
    </div>
  </section>
);

const ModuleCard = ({
  module,
  onRemove,
  onSelect,
  prerequisiteWarning,
  selected,
}: {
  module: Module;
  onRemove: (code: string) => void;
  onSelect?: (code: string) => void;
  prerequisiteWarning?: { summary: string; missingRequirement: string } | null;
  selected?: boolean;
}) => (
  <div
    onClick={() => onSelect && onSelect(module.code)}
    className={`group relative z-10 rounded-2xl border px-3 py-3 shadow-sm transition hover:z-40 hover:-translate-y-0.5 hover:shadow-md focus-within:z-40 focus-within:-translate-y-0.5 focus-within:shadow-md ${
      prerequisiteWarning
        ? 'border-[#cc7d60]'
        : 'border-line'
    } ${getCategoryColor(module.category)} ${
      selected ? 'ring-2 ring-ink/30' : ''
    }`}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{module.code}</p>
        <p className="mt-1 text-xs leading-5 text-muted">{module.name}</p>
      </div>
      <button
        type="button"
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onRemove(module.code);
        }}
        className="rounded-full border border-line px-2 py-1 text-[9px] font-medium text-muted transition hover:border-ink hover:text-ink"
      >
        ✘
      </button>
    </div>

    <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-56 -translate-x-1/2 rounded-2xl border border-line bg-paper/95 p-3 text-left opacity-0 shadow-soft transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Module details</p>
      <div className="mt-2 space-y-2">
        {prerequisiteWarning && (
          <div className="rounded-xl border border-[#cc7d60]/30 bg-[rgba(204,125,96,0.12)] p-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8b3d2f]">Prerequisite conflict</p>
            <p className="mt-1 text-[11px] leading-5 text-ink">Missing: {prerequisiteWarning.missingRequirement}</p>
            <p className="mt-1 text-[11px] leading-5 text-muted">{prerequisiteWarning.summary}</p>
          </div>
        )}
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Category</p>
          <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${categoryBadgeTone(module.category)}`}>
            {module.category}
          </span>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">MCs</p>
          <p className="mt-1 text-sm font-semibold text-ink">{module.mcs} MCs</p>
        </div>
      </div>
    </div>
  </div>
);

export const StudyPlan = () => {
  const {
    major,
    majors,
    majorId,
    semesters,
    stats,
    requirements,
    allModules,
    addOrMoveModule,
    deleteModule,
    switchMajor,
    resetPlan,
  } = useStudyPlan();

  const [draft, setDraft] = useState(emptyDraft);
  const [moduleQuery, setModuleQuery] = useState('');
  const [moduleSearchResults, setModuleSearchResults] = useState<NusModsModuleSummary[]>([]);
  const [moduleSearchLoading, setModuleSearchLoading] = useState(false);
  const [moduleSearchError, setModuleSearchError] = useState<string | null>(null);
  const [selectedModuleMeta, setSelectedModuleMeta] = useState<{
    acadYear: string;
    semesters: number[];
    prerequisiteSummary: string;
  } | null>(null);
  const [nusModsModuleDetails, setNusModsModuleDetails] = useState<Record<string, { acadYear: string; detail: NusModsModuleDetail }>>({});

  const careerProgress = useMemo(
    () =>
      major.careerTracks.map((track) => ({
        ...track,
        matched: allModules.some((module) => module.code === track.code),
      })),
    [allModules, major.careerTracks],
  );

  const completedCodesBySemester = useMemo(() => {
    const completedCodes = new Set<string>();

    return semesters.map((semester) => {
      const snapshot = new Set(completedCodes);

      for (const module of semester.modules) {
        completedCodes.add(module.code);
      }

      return snapshot;
    });
  }, [semesters]);

  const missingModuleDetails = useMemo(
    () => Array.from(new Set(allModules.map((module) => module.code))).filter((code) => !nusModsModuleDetails[code]),
    [allModules, nusModsModuleDetails],
  );

  useEffect(() => {
    if (missingModuleDetails.length === 0) {
      return;
    }

    let canceled = false;

    const loadModuleDetails = async () => {
      const results = await Promise.all(
        missingModuleDetails.map(async (code) => {
          try {
            return [code, await fetchNusModsModuleDetail(code)] as const;
          } catch {
            return null;
          }
        }),
      );

      if (canceled) {
        return;
      }

      setNusModsModuleDetails((current) => {
        const next = { ...current };

        for (const result of results) {
          if (!result) {
            continue;
          }

          const [code, payload] = result;
          next[code] = payload;
        }

        return next;
      });
    };

    void loadModuleDetails();

    return () => {
      canceled = true;
    };
  }, [missingModuleDetails]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!draft.code.trim() || !draft.name.trim()) {
      return;
    }

    const category = draft.category;
    addOrMoveModule(buildSemesterKey(draft.year, draft.sem), {
      code: draft.code.trim().toUpperCase(),
      name: draft.name.trim(),
      mcs: Number(draft.mcs),
      category,
    });

    setDraft(emptyDraft);
  };

  const onCodeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const code = event.target.value.toUpperCase();
    setDraft((current) => ({ ...current, code }));
  };

  useEffect(() => {
    const trimmed = moduleQuery.trim();

    if (trimmed.length < 2) {
      setModuleSearchResults([]);
      setModuleSearchLoading(false);
      setModuleSearchError(null);
      return;
    }

    let canceled = false;
    const timer = window.setTimeout(async () => {
      setModuleSearchLoading(true);
      setModuleSearchError(null);

      try {
        const response = await searchNusModsModules(trimmed, 12);

        if (!canceled) {
          setModuleSearchResults(response.items);
        }
      } catch (error) {
        if (!canceled) {
          setModuleSearchError(error instanceof Error ? error.message : 'Unable to search NUSMods modules.');
          setModuleSearchResults([]);
        }
      } finally {
        if (!canceled) {
          setModuleSearchLoading(false);
        }
      }
    }, 250);

    return () => {
      canceled = true;
      window.clearTimeout(timer);
    };
  }, [moduleQuery]);

  const onSelectModuleSuggestion = async (item: NusModsModuleSummary) => {
    setModuleSearchLoading(true);
    setModuleSearchError(null);

    try {
      const { acadYear, detail } = await fetchNusModsModuleDetail(item.moduleCode, item.acadYear);
      const parsedMc = Number.parseFloat(detail.moduleCredit ?? '4');
      const semesters = Array.from(new Set((detail.semesterData ?? []).map((entry) => entry.semester))).sort((a, b) => a - b);

      setDraft((current) => ({
        ...current,
        code: detail.moduleCode,
        name: detail.title,
        mcs: Number.isFinite(parsedMc) ? parsedMc : 4,
      }));

      setModuleQuery(`${detail.moduleCode} ${detail.title}`);
      setModuleSearchResults([]);
      setSelectedModuleMeta({
        acadYear,
        semesters: semesters.length > 0 ? semesters : item.semesters,
        prerequisiteSummary: formatPrerequisiteSummary(detail),
      });
      setNusModsModuleDetails((current) => ({
        ...current,
        [detail.moduleCode]: { acadYear, detail },
      }));
    } catch (error) {
      setModuleSearchError(error instanceof Error ? error.message : 'Unable to fetch module details from NUSMods.');
    } finally {
      setModuleSearchLoading(false);
    }
  };

  const [selected, setSelected] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<Module | null>(null);

  const pointer = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 6,
    },
  });
  const sensors = useSensors(pointer);

  const handleDragEnd = (event: DragEndEvent) => {
    const active = event.active;
    const over = event.over;
    if (!active || !over) {
      clearActiveDrag();
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    const activeParts = activeId.split('::');
    const overParts = overId.split('::');

    if (activeParts.length < 3 || overParts.length < 2) {
      clearActiveDrag();
      return;
    }
    if (activeParts[0] !== 'drag' || overParts[0] !== 'drop') {
      clearActiveDrag();
      return;
    }

    const sourceSemester = activeParts[1] as SemesterKey;
    const moduleCode = activeParts.slice(2).join('::');
    const colIndexStr = overParts[1]?.replace('col', '');
    const colIndex = parseInt(colIndexStr || '-1');
    
    if (colIndex < 0 || colIndex >= semesters.length) {
      clearActiveDrag();
      return;
    }
    
    const targetSemester = buildSemesterKey(semesters[colIndex].year, semesters[colIndex].sem);

    if (!moduleCode) {
      clearActiveDrag();
      return;
    }
    if (sourceSemester === targetSemester) {
      clearActiveDrag();
      return;
    }

    const moduleObj = allModules.find((m) => m.code === moduleCode);
    if (!moduleObj) {
      clearActiveDrag();
      return;
    }

    addOrMoveModule(targetSemester, moduleObj);
    setSelected(null);
    clearActiveDrag();
  };

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = String(event.active.id);
    const activeParts = activeId.split('::');

    if (activeParts.length < 3 || activeParts[0] !== 'drag') {
      setActiveDragId(null);
      setActiveModule(null);
      return;
    }

    const moduleCode = activeParts.slice(2).join('::');
    const moduleObj = allModules.find((m) => m.code === moduleCode) ?? null;

    setActiveDragId(activeId);
    setActiveModule(moduleObj);
  };

  const clearActiveDrag = () => {
    setActiveDragId(null);
    setActiveModule(null);
  };

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8">
        <div className="absolute inset-x-0 top-0 -z-10 h-[360px] bg-[radial-gradient(circle_at_top_left,_rgba(225,218,205,0.85),_transparent_55%),radial-gradient(circle_at_top_right,_rgba(176,166,145,0.35),_transparent_50%)]" />

        <header className="rounded-[32px] border border-line bg-paper/80 p-6 shadow-soft backdrop-blur-sm lg:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">SOC Study Planner</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink lg:text-5xl">Study plan maker</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
                Plan eight semesters horizontally, track School of Computing requirements, and keep the data model ready for
                future majors beyond SoC.
              </p>
            </div>

            <div className="grid gap-3 text-sm text-ink sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-line bg-canvas px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted">Student</p>
                <p className="mt-1 font-semibold">{major.studentName}</p>
              </div>
              <div className="rounded-2xl border border-line bg-canvas px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted">Matric No</p>
                <p className="mt-1 font-semibold">{major.matricNo}</p>
              </div>
              <div className="rounded-2xl border border-line bg-canvas px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted">Major</p>
                <p className="mt-1 font-semibold">{major.label}</p>
              </div>
              <div className="rounded-2xl border border-line bg-canvas px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted">Specialisation</p>
                <p className="mt-1 font-semibold">{major.specialisation}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium text-muted">
                Major
                <select
                  value={majorId}
                  onChange={(event) => switchMajor(event.target.value)}
                  className="ml-3 rounded-full border border-line bg-canvas px-4 py-2 text-sm text-ink outline-none transition focus:border-ink"
                >
                  {majors.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={resetPlan}
                className="rounded-full border border-line bg-canvas px-4 py-2 text-sm font-medium text-ink transition hover:border-ink"
              >
                Reset to seed
              </button>
            </div>

            <p className="text-sm text-muted">
              Targets: 160 total MCs, 80 primary major MCs, 60 SOC/NUSC MCs.
            </p>
          </div>
        </header>

        <section className="mt-6 grid gap-4 xl:grid-cols-3">
          {[
            { label: 'Total MCs', value: stats.totalMc, target: 160 },
            { label: 'Primary Major MCs', value: stats.primaryMajorMc, target: 80 },
            { label: 'SOC/NUSC MCs', value: stats.socMc, target: 60 },
          ].map((item) => (
            <div key={item.label} className="rounded-[28px] border border-line bg-paper/85 p-5 shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">{item.label}</p>
              <div className="mt-3 flex items-end justify-between gap-4">
                <p className="text-4xl font-semibold tracking-tight text-ink">{item.value}</p>
                <p className="text-sm text-muted">Target {item.target}</p>
              </div>
            </div>
          ))}
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="space-y-6">
            <section className="rounded-[28px] border border-line bg-paper/85 p-5 shadow-soft">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Quick add</p>
                  <h2 className="mt-2 text-2xl font-semibold text-ink">Add or move a module</h2>
                  <p className="mt-2 text-sm text-muted">
                    Custom majors can extend this same flow by registering new catalog entries and requirements.
                  </p>
                </div>
              </div>

              <form onSubmit={onSubmit} className="mt-5 grid gap-3 lg:grid-cols-6">
                <div className="relative lg:col-span-6">
                  <input
                    value={moduleQuery}
                    onChange={(event) => setModuleQuery(event.target.value)}
                    placeholder="Search NUSMods module code or title (e.g. CS1010S)"
                    className="w-full rounded-2xl border border-line bg-canvas px-4 py-3 text-sm outline-none transition placeholder:text-muted focus:border-ink"
                  />
                  {moduleSearchLoading && (
                    <p className="mt-2 text-xs text-muted">Searching NUSMods...</p>
                  )}
                  {moduleSearchError && (
                    <p className="mt-2 text-xs text-[#8b3d2f]">{moduleSearchError}</p>
                  )}
                  {moduleSearchResults.length > 0 && (
                    <div className="absolute z-50 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-line bg-paper p-2 shadow-soft">
                      {moduleSearchResults.map((item) => (
                        <button
                          key={item.moduleCode}
                          type="button"
                          onClick={() => {
                            void onSelectModuleSuggestion(item);
                          }}
                          className="flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-canvas"
                        >
                          <span>
                            <span className="block text-sm font-semibold text-ink">{item.moduleCode}</span>
                            <span className="block text-xs text-muted">{item.title}</span>
                          </span>
                          <span className="text-[11px] uppercase tracking-[0.16em] text-muted">S{item.semesters.join(', ') || '-'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <input
                  value={draft.code}
                  onChange={onCodeChange}
                  placeholder="Module code"
                  className="rounded-2xl border border-line bg-canvas px-4 py-3 text-sm outline-none transition placeholder:text-muted focus:border-ink lg:col-span-1"
                />
                <input
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Module name"
                  className="rounded-2xl border border-line bg-canvas px-4 py-3 text-sm outline-none transition placeholder:text-muted focus:border-ink lg:col-span-2"
                />
                <input
                  type="number"
                  min={0}
                  max={8}
                  value={draft.mcs}
                  onChange={(event) => setDraft((current) => ({ ...current, mcs: Number(event.target.value) }))}
                  className="rounded-2xl border border-line bg-canvas px-4 py-3 text-sm outline-none transition focus:border-ink lg:col-span-1"
                />
                <select
                  value={buildSemesterKey(draft.year, draft.sem)}
                  onChange={(event) => {
                    const [year, sem] = event.target.value.split('-').map(Number);
                    setDraft((current) => ({ ...current, year, sem }));
                  }}
                  className="rounded-2xl border border-line bg-canvas px-4 py-3 text-sm outline-none transition focus:border-ink lg:col-span-1"
                >
                  {semesterOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-canvas transition hover:opacity-90 lg:col-span-1"
                >
                  Add module
                </button>

                <select
                  value={draft.category}
                  onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value as Category }))}
                  className="rounded-2xl border border-line bg-canvas px-4 py-3 text-sm outline-none transition focus:border-ink lg:col-span-2"
                >
                  {major.categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>

                {selectedModuleMeta && (
                  <div className="rounded-2xl border border-line bg-canvas px-4 py-3 text-xs text-muted lg:col-span-6">
                    <p className="font-semibold text-ink">NUSMods {selectedModuleMeta.acadYear}</p>
                    <p className="mt-1">Offered in semesters: {selectedModuleMeta.semesters.length > 0 ? selectedModuleMeta.semesters.join(', ') : 'Not listed'}</p>
                    <p className="mt-1">Prerequisites: {selectedModuleMeta.prerequisiteSummary}</p>
                  </div>
                )}
              </form>
            </section>

            <section className="rounded-[28px] border border-line bg-paper/85 p-5 shadow-soft">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Semester grid</p>
                  <h2 className="mt-2 text-2xl font-semibold text-ink">8-semester study plan</h2>
                </div>
              </div>

              <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={clearActiveDrag}>
              <div className="overflow-x-auto pb-2">
                <div className="grid grid-cols-[repeat(8,minmax(140px,1fr))] gap-3 items-start" style={{ width: 'fit-content' }}>
                  {/* Header row */}
                  {semesterOptions.map((semester, idx) => {
                    const semesterData = semesters[idx];
                    const semesterMc = semesterData?.modules.reduce((sum, module) => sum + module.mcs, 0) ?? 0;
                    return (
                      <div key={semester.key} className="rounded-2xl border border-line bg-canvas px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                        <div className="text-ink">{semester.label}</div>
                        <div className="mt-1 text-xs font-normal text-muted">{semesterMc} MCs</div>
                      </div>
                    );
                  })}

                  {/* Data columns */}
                  {semesters.map((semester, columnIndex) => {
                    const modules = semester.modules;
                    const completedCodes = completedCodesBySemester[columnIndex] ?? new Set<string>();

                    return (
                      <Droppable 
                        id={droppableId(columnIndex)} 
                        key={`droppable-${columnIndex}`}
                      >
                        <div className="rounded-2xl border border-line bg-paper p-3 space-y-2">
                          {modules.length > 0 ? (
                            modules.map((module) => {
                              const moduleDetail = nusModsModuleDetails[module.code];
                              const prerequisiteConflict = moduleDetail
                                ? assessPrerequisiteConflict(moduleDetail.detail, completedCodes)
                                : null;
                              const prerequisiteWarning =
                                moduleDetail && prerequisiteConflict?.missingRequirement
                                  ? {
                                      summary: formatPrerequisiteSummary(moduleDetail.detail),
                                      missingRequirement: prerequisiteConflict.missingRequirement,
                                    }
                                  : null;

                              return (
                                <Draggable id={draggableId(buildSemesterKey(semester.year, semester.sem), module.code)} key={module.code}>
                                  <ModuleCard
                                    module={module}
                                    onRemove={deleteModule}
                                    onSelect={(code) => {
                                      const id = draggableId(buildSemesterKey(semester.year, semester.sem), code);
                                      setSelected((curr) => (curr === id ? null : id));
                                    }}
                                    prerequisiteWarning={prerequisiteWarning}
                                    selected={selected === draggableId(buildSemesterKey(semester.year, semester.sem), module.code)}
                                  />
                                </Draggable>
                              );
                            })
                          ) : (
                            <div className="rounded-2xl border border-dashed border-line px-3 py-5 text-center text-xs text-muted">
                              No modules yet.
                            </div>
                          )}
                        </div>
                      </Droppable>
                    );
                  })}
                </div>
              </div>
              <DragOverlay zIndex={99999}>
                {activeDragId && activeModule ? (
                  <ModuleCard module={activeModule} onRemove={() => {}} selected={false} />
                ) : null}
              </DragOverlay>
              </DndContext>
            </section>
          </main>

          <aside className="space-y-6">
            <RequirementChecklist title="SOC / NUSC checklist" requirements={requirements} />

            <section className="rounded-[28px] border border-line bg-paper/85 p-5 shadow-soft">
              <h3 className="text-lg font-semibold text-ink">Career guidance</h3>
              <p className="mt-2 text-sm text-muted">Tracks non-credit and low-credit career modules alongside the main degree plan.</p>
              <div className="mt-4 space-y-3">
                {careerProgress.map((item) => (
                  <div key={item.code} className="rounded-2xl border border-line bg-canvas p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">{item.code}</p>
                        <p className="mt-1 text-xs text-muted">{item.name}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${item.matched ? 'bg-ink text-canvas' : 'bg-[#d8d2c6] text-ink'}`}>
                        {item.matched ? 'Tracked' : 'Optional'}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted">{item.mcs} MCs</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-line bg-paper/85 p-5 shadow-soft">
              <h3 className="text-lg font-semibold text-ink">Expansion ready</h3>
              <p className="mt-2 text-sm leading-6 text-muted">
                The current plan engine is built around a major registry, requirement rules, and semester seeds so you can add
                new majors later by registering their own catalog, requirements, and semester defaults.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
};