import { useEffect, useRef, useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { useIsMobile } from '../hooks/useIsMobile';
import { Dropdown } from './Dropdown';
import type { Major, PlacedModule, StudentSemester, WaivedModule } from '@shared/types';
import { searchNusModsModules, fetchNusModsModuleDetail } from '@shared/nusmods';
import type { NusModsModuleSummary } from '@shared/nusmods';
import { autoCategoryId, semesterLabel } from '../lib/studyPlan';
import { ModuleCard } from './ModuleCard';
import { WaivedCourses } from './WaivedCourses';
import { AppDialog } from './AppDialog';
import { PlusIcon, XIcon } from './Icons';

const UNDERLOAD_MCS = 18;
const OVERLOAD_MCS = 20;
const YEAR_ONE_MAX_MCS = 26;

interface Props {
  semesters: StudentSemester[];
  major: Major;
  waivedModules: WaivedModule[];
  addOrMoveModule: (year: number, sem: number, module: PlacedModule, insertBeforeCode?: string) => void;
  deleteModule: (code: string, year?: number, sem?: number) => void;
  updateModule: (
    oldCode: string,
    updates: { code: string; name: string; mcs: number; categoryId: string },
  ) => { ok: true } | { ok: false; error: string };
  addWaivedModule: (module: WaivedModule) => void;
  deleteWaivedModule: (code: string) => void;
  getCompletedCodes: (year: number, sem: number) => string[];
  addSpecialTerm: (year: number, sem: number) => void;
  deleteSpecialTerm: (year: number, sem: number) => void;
}

export const SemesterGrid = ({
  semesters,
  major,
  waivedModules,
  addOrMoveModule,
  deleteModule,
  updateModule,
  addWaivedModule,
  deleteWaivedModule,
  getCompletedCodes,
  addSpecialTerm,
  deleteSpecialTerm,
}: Props) => {
  const [activeDrag, setActiveDrag] = useState<PlacedModule | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Press-and-hold to drag on touch, so a normal swipe still scrolls the page.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const moveModule = (module: PlacedModule, year: number, sem: number, insertBeforeCode?: string) => {
    const target = semesters.find((s) => s.year === year && s.sem === sem);
    if (!target) return;
    if (!canPlaceModule(target, module)) {
      setMoveError('Y1S1 cannot exceed 26 MC.');
      return;
    }
    addOrMoveModule(year, sem, module, insertBeforeCode);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const module = event.active.data.current?.module as PlacedModule | undefined;
    setActiveDrag(module ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;
    const module = active.data.current?.module as PlacedModule;
    const dropData = over.data.current as ModuleDropData | undefined;
    if (dropData?.type === 'module-card') {
      if (dropData.moduleCode === module.code) return;
      moveModule(module, dropData.year, dropData.sem, dropData.moduleCode);
      return;
    }
    const [year, sem] = (over.id as string).split('-').map(Number);
    moveModule(module, year, sem);
  };

  const waivedCodes = waivedModules.map((module) => module.code);
  const moveTargets = semesters.map((s) => ({
    year: s.year,
    sem: s.sem,
    label: semesterLabel(s.year, s.sem),
  }));

  // Mobile shows one semester at a time; 'waived' selects the waived panel.
  const [selectedKey, setSelectedKey] = useState<string>(
    semesters[0] ? `${semesters[0].year}-${semesters[0].sem}` : 'waived',
  );

  const possibleSpecialTerms = [1, 2, 3, 4].flatMap((year) =>
    [3, 4].map((sem) => ({
      year,
      sem,
      label: `Y${year} ${sem === 3 ? 'Special Term I' : 'Special Term II'}`,
    }))
  ).filter((term) => !semesters.some((s) => s.year === term.year && s.sem === term.sem));

  const chips = [
    { key: 'waived', label: 'Waived', warn: false },
    ...semesters.map((s) => {
      const mcs = getSemesterMcs(s);
      return {
        key: `${s.year}-${s.sem}`,
        label: `${semesterLabel(s.year, s.sem)} · ${mcs} MC`,
        warn: Boolean(getLoadWarning(s.year, s.sem, mcs)),
      };
    }),
  ];
  const selectedSemester = semesters.find((s) => `${s.year}-${s.sem}` === selectedKey) ?? null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {isMobile ? (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setSelectedKey(chip.key)}
                className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedKey === chip.key ? 'bg-ink text-canvas' : 'bg-paper text-ink/70'
                }`}
              >
                {chip.label}
                {chip.warn && <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />}
              </button>
            ))}
            {possibleSpecialTerms.length > 0 && (
              <div className="relative flex flex-shrink-0 items-center">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      const [y, s] = e.target.value.split('-').map(Number);
                      addSpecialTerm(y, s);
                      setSelectedKey(`${y}-${s}`);
                      e.target.value = '';
                    }
                  }}
                  className="appearance-none rounded-full bg-paper border border-ink/10 px-3 py-1.5 text-xs font-medium text-ink/70 pr-8 focus:outline-none focus:ring-2 focus:ring-ink/20"
                  defaultValue=""
                >
                  <option value="" disabled>+ Special Term</option>
                  {possibleSpecialTerms.map((term) => (
                    <option key={`${term.year}-${term.sem}`} value={`${term.year}-${term.sem}`}>
                      {term.label}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-2.5 text-ink/40 text-[10px]" aria-hidden="true">▼</span>
              </div>
            )}
          </div>

          {selectedKey === 'waived' ? (
            <WaivedCourses
              major={major}
              waivedModules={waivedModules}
              onAdd={addWaivedModule}
              onDelete={deleteWaivedModule}
              fullWidth
            />
          ) : selectedSemester ? (
            <SemesterColumn
              key={selectedKey}
              semester={selectedSemester}
              major={major}
              addOrMoveModule={addOrMoveModule}
              deleteModule={deleteModule}
              updateModule={updateModule}
              completedCodes={Array.from(new Set([...waivedCodes, ...getCompletedCodes(selectedSemester.year, selectedSemester.sem)]))}
              isMobile={isMobile}
              moveTargets={moveTargets}
              onMoveModule={moveModule}
              onDeleteSpecialTerm={deleteSpecialTerm}
              fullWidth
            />
          ) : null}
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3">
          <WaivedCourses
            major={major}
            waivedModules={waivedModules}
            onAdd={addWaivedModule}
            onDelete={deleteWaivedModule}
          />
          {semesters.map((semester) => (
            <SemesterColumn
              key={`${semester.year}-${semester.sem}`}
              semester={semester}
              major={major}
              addOrMoveModule={addOrMoveModule}
              deleteModule={deleteModule}
              updateModule={updateModule}
              completedCodes={Array.from(new Set([...waivedCodes, ...getCompletedCodes(semester.year, semester.sem)]))}
              isMobile={isMobile}
              moveTargets={moveTargets}
              onMoveModule={moveModule}
              onDeleteSpecialTerm={deleteSpecialTerm}
            />
          ))}
          {possibleSpecialTerms.length > 0 && (
            <div className="w-56 flex-shrink-0 flex flex-col gap-2 rounded-3xl border border-dashed border-ink/20 p-4 justify-center items-center text-center bg-paper/30">
              <span className="text-xs font-semibold text-ink/70">Special Term</span>
              <p className="text-[10px] text-muted max-w-[150px]">Plan Orbital, internship, winter/summer school, etc.</p>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    const [y, s] = e.target.value.split('-').map(Number);
                    addSpecialTerm(y, s);
                    e.target.value = '';
                  }
                }}
                className="mt-1 w-full rounded-xl border border-ink/10 bg-paper px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
                defaultValue=""
              >
                <option value="" disabled>+ Add Special Term</option>
                {possibleSpecialTerms.map((term) => (
                  <option key={`${term.year}-${term.sem}`} value={`${term.year}-${term.sem}`}>
                    {term.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {moveError && (
        <AppDialog
          title="Move unavailable"
          onClose={() => setMoveError(null)}
          actions={[{ label: 'OK', onClick: () => setMoveError(null), variant: 'primary' }]}
        >
          {moveError}
        </AppDialog>
      )}

      <DragOverlay dropAnimation={null}>
        {activeDrag && (
          <ModuleCard
            module={activeDrag}
            major={major}
            completedCodes={[]}
            fromYear={0}
            fromSem={0}
            onDelete={() => undefined}
            isOverlay
          />
        )}
      </DragOverlay>
    </DndContext>
  );
};


interface ModuleDropData {
  type: 'module-card';
  year: number;
  sem: number;
  moduleCode: string;
}

interface ColumnProps {
  semester: StudentSemester;
  major: Major;
  addOrMoveModule: (year: number, sem: number, module: PlacedModule, insertBeforeCode?: string) => void;
  deleteModule: (code: string, year?: number, sem?: number) => void;
  updateModule: (
    oldCode: string,
    updates: { code: string; name: string; mcs: number; categoryId: string },
  ) => { ok: true } | { ok: false; error: string };
  completedCodes: string[];
  isMobile: boolean;
  moveTargets: { year: number; sem: number; label: string }[];
  onMoveModule: (module: PlacedModule, year: number, sem: number, insertBeforeCode?: string) => void;
  onDeleteSpecialTerm?: (year: number, sem: number) => void;
  fullWidth?: boolean;
}

const SemesterColumn = ({ semester, major, addOrMoveModule, deleteModule, updateModule, completedCodes, isMobile, moveTargets, onMoveModule, onDeleteSpecialTerm, fullWidth = false }: ColumnProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const id = `${semester.year}-${semester.sem}`;
  const { setNodeRef, isOver } = useDroppable({ id });

  const totalMcs = getSemesterMcs(semester);
  const loadWarning = getLoadWarning(semester.year, semester.sem, totalMcs);

  return (
    <div
      ref={setNodeRef}
      className="relative flex flex-col flex-shrink-0 rounded-3xl p-3 transition-colors"
      style={{
        minWidth: fullWidth ? undefined : '172px',
        width: fullWidth ? '100%' : '172px',
        minHeight: '280px',
        backgroundColor: isOver ? 'rgb(210,203,190)' : 'rgb(225,218,205)',
        outline: 'none',
        outlineOffset: '-2px',
      }}
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-semibold text-ink">{semesterLabel(semester.year, semester.sem)}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted">{totalMcs} MC</span>
          {(semester.sem === 3 || semester.sem === 4) && onDeleteSpecialTerm && (
            <button
              type="button"
              onClick={() => {
                if (semester.modules.length === 0 || window.confirm(`Delete ${semesterLabel(semester.year, semester.sem)} and all its modules?`)) {
                  onDeleteSpecialTerm(semester.year, semester.sem);
                }
              }}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-ink/20 text-ink/75 transition-colors hover:bg-red-50 hover:text-red-700 hover:border-red-200"
              aria-label={`Delete ${semesterLabel(semester.year, semester.sem)}`}
            >
              <XIcon />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setAddError(null);
              setIsAdding((open) => !open);
            }}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-canvas transition-colors hover:bg-ink/80"
            aria-label={isAdding ? `Close add module for ${semesterLabel(semester.year, semester.sem)}` : `Add module to ${semesterLabel(semester.year, semester.sem)}`}
            aria-expanded={isAdding}
          >
            {isAdding ? <XIcon /> : <PlusIcon />}
          </button>
        </div>
      </div>

      {loadWarning && <LoadWarningChip warning={loadWarning} />}

      <div className="flex flex-col gap-2 flex-1">
        {isAdding && (
          <SemesterAddModuleForm
            major={major}
            year={semester.year}
            sem={semester.sem}
            error={addError}
            onAdd={(year, sem, module) => {
              if (!canPlaceModule(semester, module)) {
                setAddError('Y1S1 max is 26 MC.');
                return;
              }
              addOrMoveModule(year, sem, module);
              setAddError(null);
              setIsAdding(false);
            }}
          />
        )}

        {semester.modules.length === 0 && !isAdding && (
          <p className="px-1 py-6 text-center text-[10px] leading-snug text-muted">
            No modules yet.
            <br />
            Tap + to add one or drag one in.
          </p>
        )}

        {semester.modules.map((module) => (
          <ModuleCard
            key={module.code}
            module={module}
            major={major}
            completedCodes={completedCodes}
            fromYear={semester.year}
            fromSem={semester.sem}
            onDelete={deleteModule}
            onEditModule={updateModule}
            moveTargets={moveTargets}
            onMove={(year, sem) => onMoveModule(module, year, sem)}
          />
        ))}
        {isOver && (
          <div className="pointer-events-none mx-2 my-1 h-1 rounded-full bg-ink shadow-soft" />
        )}
      </div>
    </div>
  );
};

interface AddFormState {
  query: string;
  code: string;
  name: string;
  mcs: string;
  categoryId: string;
}

const SemesterAddModuleForm = ({
  major,
  year,
  sem,
  error,
  onAdd,
}: {
  major: Major;
  year: number;
  sem: number;
  error: string | null;
  onAdd: (year: number, sem: number, module: PlacedModule) => void;
}) => {
  const [form, setForm] = useState<AddFormState>({
    query: '',
    code: '',
    name: '',
    mcs: '4',
    categoryId: AUTO_CATEGORY,
  });
  const [suggestions, setSuggestions] = useState<NusModsModuleSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleQueryChange = (value: string) => {
    setForm((current) => ({ ...current, query: value, code: value.toUpperCase(), name: '', mcs: '4' }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { items } = await searchNusModsModules(value, 8);
        setSuggestions(items);
        setShowSuggestions(items.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleSelectSuggestion = async (item: NusModsModuleSummary) => {
    setShowSuggestions(false);
    setLoading(true);
    try {
      const { detail } = await fetchNusModsModuleDetail(item.moduleCode, item.acadYear);
      setForm((current) => ({
        ...current,
        query: item.moduleCode,
        code: item.moduleCode,
        name: item.title,
        mcs: detail.moduleCredit ?? '4',
      }));
    } catch {
      setForm((current) => ({
        ...current,
        query: item.moduleCode,
        code: item.moduleCode,
        name: item.title,
      }));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const code = form.code.trim().toUpperCase();
    const name = form.name.trim() || major.moduleCatalog[code]?.name || code;
    const mcs = parseInt(form.mcs, 10) || major.moduleCatalog[code]?.mcs || 4;
    if (!code) return;
    const categoryId =
      form.categoryId === AUTO_CATEGORY ? autoCategoryId(major, code) : form.categoryId;

    onAdd(year, sem, { code, name, mcs, categoryId });
  };

  const inferredLabel =
    major.categories.find((cat) => cat.id === autoCategoryId(major, form.code))?.label ?? '—';

  const handleToggleCustomMode = (next: boolean) => {
    setCustomMode(next);
    if (next) {
      setForm((current) => ({ ...current, query: '' }));
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  return (
    <form ref={containerRef} onSubmit={handleSubmit} className="relative rounded-2xl bg-canvas/60 p-2">
      {!customMode && (
        <>
          <input
            type="text"
            value={form.query}
            onChange={(event) => handleQueryChange(event.target.value)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Module code"
            className="w-full rounded-xl bg-paper border border-ink/10 px-2 py-1.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/20"
            autoComplete="off"
          />
          {loading && <span className="absolute right-4 top-4 text-muted text-xs">...</span>}

          {showSuggestions && (
            <ul className="absolute z-40 top-10 left-0 right-0 bg-ink rounded-2xl overflow-hidden shadow-soft max-h-60 overflow-y-auto">
              {suggestions.map((item) => (
                <li key={item.moduleCode}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-canvas/10 transition-colors"
                    onClick={() => handleSelectSuggestion(item)}
                  >
                    <span className="block text-xs font-mono font-bold text-canvas">{item.moduleCode}</span>
                    <span className="block truncate text-[10px] text-canvas/60">{item.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {form.name && <p className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-muted">{form.name}</p>}
          {error && <p className="mt-1.5 text-[10px] font-medium leading-snug text-red-700">{error}</p>}

          <button
            type="button"
            onClick={() => handleToggleCustomMode(true)}
            className="mt-1.5 text-[10px] font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            + Add custom module
          </button>
        </>
      )}

      {customMode && (
        <>
          <input
            type="text"
            value={form.code}
            onChange={(event) =>
              setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))
            }
            placeholder="Module code"
            className="w-full rounded-xl bg-paper border border-ink/10 px-2 py-1.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/20"
            autoComplete="off"
          />

          <div className="mt-2 flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wide text-muted">Module Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="e.g. Special Topics in..."
              className="w-full rounded-xl bg-paper border border-ink/10 px-2 py-1.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/20"
              autoComplete="off"
            />
          </div>

          {error && <p className="mt-1.5 text-[10px] font-medium leading-snug text-red-700">{error}</p>}

          <button
            type="button"
            onClick={() => handleToggleCustomMode(false)}
            className="mt-1.5 text-[10px] font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
          >
            ← Search instead
          </button>
        </>
      )}

      <div className="mt-2 flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wide text-muted">MCs</label>
        <input
          type="number"
          min="1"
          max="20"
          value={form.mcs}
          onChange={(event) => setForm((current) => ({ ...current, mcs: event.target.value }))}
          className="w-full rounded-xl bg-paper border border-ink/10 px-2 py-1.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
        />
      </div>

      <Dropdown
        variant="field"
        ariaLabel="Category"
        value={form.categoryId}
        onChange={(value) => setForm((current) => ({ ...current, categoryId: value }))}
        className="mt-2 w-full rounded-xl bg-paper border border-ink/10 px-2 py-1.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
        options={[
          { value: AUTO_CATEGORY, label: `Auto → ${inferredLabel}` },
          ...major.categories.map((cat) => ({ value: cat.id, label: cat.label })),
        ]}
      />

      <button
        type="submit"
        className="mt-2 w-full rounded-xl bg-ink px-3 py-1.5 text-xs font-medium text-canvas transition-colors hover:bg-ink/80 disabled:opacity-40"
        disabled={!form.code.trim()}
      >
        Add
      </button>
    </form>
  );
};

interface LoadWarning {
  label: string;
  detail: string;
  className: string;
}

const LoadWarningChip = ({ warning }: { warning: LoadWarning }) => (
  // mb-4 (not mb-2): the first module card's corner controls (edit/delete/move)
  // sit on negative offsets that poke above the card's own top edge on
  // hover/focus, so this needs enough clearance to not collide with them.
  <div className={`${warning.className} mb-4 rounded-xl px-2.5 py-1.5 text-[10px] font-medium leading-tight`}>
    <span className="block">{warning.label}</span>
    <span className="block font-normal opacity-75">{warning.detail}</span>
  </div>
);

const getSemesterMcs = (semester: StudentSemester): number =>
  semester.modules.reduce((sum, module) => sum + module.mcs, 0);

const getProjectedSemesterMcs = (semester: StudentSemester, module: PlacedModule): number =>
  semester.modules
    .filter((existingModule) => existingModule.code !== module.code)
    .reduce((sum, existingModule) => sum + existingModule.mcs, module.mcs);

const canPlaceModule = (semester: StudentSemester, module: PlacedModule): boolean =>
  semester.year !== 1 || semester.sem !== 1 || getProjectedSemesterMcs(semester, module) <= YEAR_ONE_MAX_MCS;

const getLoadWarning = (year: number, sem: number, totalMcs: number): LoadWarning | null => {
  if (year === 1 && sem === 1 && totalMcs > YEAR_ONE_MAX_MCS) {
    return {
      label: 'Y1S1 cap exceeded',
      detail: `Max ${YEAR_ONE_MAX_MCS} MC`,
      className: 'bg-red-100 text-red-800',
    };
  }

  if (totalMcs > OVERLOAD_MCS) {
    return {
      label: 'Overload',
      detail: `Above ${OVERLOAD_MCS} MC`,
      className: 'bg-orange-100 text-orange-800',
    };
  }

  if (totalMcs > 0 && totalMcs < UNDERLOAD_MCS) {
    return {
      label: 'Underload',
      detail: `${UNDERLOAD_MCS - totalMcs} MC short of a full load — add electives`,
      className: 'bg-sky-100 text-sky-800',
    };
  }

  return null;
};

const AUTO_CATEGORY = '__auto__';