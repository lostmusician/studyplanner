import { useEffect, useRef, useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import type { Major, PlacedModule, StudentSemester, WaivedModule } from '@shared/types';
import { searchNusModsModules, fetchNusModsModuleDetail } from '@shared/nusmods';
import type { NusModsModuleSummary } from '@shared/nusmods';
import { semesterLabel } from '../lib/studyPlan';
import { ModuleCard } from './ModuleCard';
import { WaivedCourses } from './WaivedCourses';
import { PlusIcon, XIcon } from './Icons';

const UNDERLOAD_MCS = 16;
const OVERLOAD_MCS = 20;
const YEAR_ONE_MAX_MCS = 26;

interface Props {
  semesters: StudentSemester[];
  major: Major;
  waivedModules: WaivedModule[];
  addOrMoveModule: (year: number, sem: number, module: PlacedModule) => void;
  deleteModule: (code: string) => void;
  addWaivedModule: (module: WaivedModule) => void;
  deleteWaivedModule: (code: string) => void;
  getCompletedCodes: (year: number, sem: number) => string[];
}

export const SemesterGrid = ({
  semesters,
  major,
  waivedModules,
  addOrMoveModule,
  deleteModule,
  addWaivedModule,
  deleteWaivedModule,
  getCompletedCodes,
}: Props) => {
  const [activeDrag, setActiveDrag] = useState<PlacedModule | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const module = event.active.data.current?.module as PlacedModule | undefined;
    setActiveDrag(module ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;
    const module = active.data.current?.module as PlacedModule;
    const [year, sem] = (over.id as string).split('-').map(Number);
    const targetSemester = semesters.find((semester) => semester.year === year && semester.sem === sem);
    if (!targetSemester) return;
    if (!canPlaceModule(targetSemester, module)) {
      alert('Year 1 semesters cannot exceed 26 MC.');
      return;
    }
    addOrMoveModule(year, sem, module);
  };

  const waivedCodes = waivedModules.map((module) => module.code);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
            completedCodes={Array.from(new Set([...waivedCodes, ...getCompletedCodes(semester.year, semester.sem)]))}
          />
        ))}
      </div>

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

interface ColumnProps {
  semester: StudentSemester;
  major: Major;
  addOrMoveModule: (year: number, sem: number, module: PlacedModule) => void;
  deleteModule: (code: string) => void;
  completedCodes: string[];
}

const SemesterColumn = ({ semester, major, addOrMoveModule, deleteModule, completedCodes }: ColumnProps) => {
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const id = `${semester.year}-${semester.sem}`;
  const { setNodeRef, isOver } = useDroppable({ id });

  const totalMcs = getSemesterMcs(semester);
  const loadWarning = getLoadWarning(semester.year, totalMcs);

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col flex-shrink-0 rounded-3xl p-3 transition-colors"
      style={{
        minWidth: '172px',
        width: '172px',
        minHeight: '280px',
        backgroundColor: isOver ? 'rgb(210,203,190)' : 'rgb(225,218,205)',
        outline: isOver ? '2px dashed rgb(108,107,104)' : 'none',
        outlineOffset: '-2px',
      }}
    >
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-semibold text-ink">{semesterLabel(semester.year, semester.sem)}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted">{totalMcs} MC</span>
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
                setAddError('Y1 max is 26 MC.');
                return;
              }
              addOrMoveModule(year, sem, module);
              setAddError(null);
              setIsAdding(false);
            }}
          />
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
          />
        ))}
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
    categoryId: major.categories[0]?.id ?? '',
  });
  const [suggestions, setSuggestions] = useState<NusModsModuleSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
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
        categoryId: inferCategoryId(major, item.moduleCode),
      }));
    } catch {
      setForm((current) => ({
        ...current,
        query: item.moduleCode,
        code: item.moduleCode,
        name: item.title,
        categoryId: inferCategoryId(major, item.moduleCode),
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
    if (!code || !form.categoryId) return;

    onAdd(year, sem, { code, name, mcs, categoryId: form.categoryId });
  };

  return (
    <form ref={containerRef} onSubmit={handleSubmit} className="relative rounded-2xl bg-canvas/60 p-2">
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

      <select
        value={form.categoryId}
        onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}
        className="mt-2 w-full rounded-xl bg-paper border border-ink/10 px-2 py-1.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-ink/20"
      >
        {major.categories.map((cat) => (
          <option key={cat.id} value={cat.id}>{cat.label}</option>
        ))}
      </select>

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
  <div className={`${warning.className} mb-2 rounded-xl px-2.5 py-1.5 text-[10px] font-medium leading-tight`}>
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
  semester.year !== 1 || getProjectedSemesterMcs(semester, module) <= YEAR_ONE_MAX_MCS;

const getLoadWarning = (year: number, totalMcs: number): LoadWarning | null => {
  if (year === 1 && totalMcs > YEAR_ONE_MAX_MCS) {
    return {
      label: 'Y1 cap exceeded',
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
      detail: `Below ${UNDERLOAD_MCS} MC`,
      className: 'bg-sky-100 text-sky-800',
    };
  }

  return null;
};

const inferCategoryId = (major: Major, moduleCode: string): string => {
  const defaultEntry = major.defaultPlan.find((entry) => entry.moduleCode === moduleCode);
  if (defaultEntry) return defaultEntry.categoryId;

  const requirement = major.requirements.find((req) =>
    req.categoryId && req.fulfilledBy.some((fulfiller) => matchesFulfiller(moduleCode, fulfiller)),
  );
  return requirement?.categoryId ?? major.categories[0]?.id ?? '';
};

const matchesFulfiller = (moduleCode: string, fulfiller: string): boolean =>
  fulfiller.endsWith('*') ? moduleCode.startsWith(fulfiller.slice(0, -1)) : moduleCode === fulfiller;