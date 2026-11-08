import { normalizeAllocationPreferences } from '@shared/allocationPreferences';
import { normalizeSpecialProgrammes, getNocDuration, toggleSpecialProgramme } from '@shared/pathways';
import { expandProgrammes, normalizeDoubleDegreeId } from '../lib/programmes';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type {
  Major,
  StudentPlan,
  StudentSemester,
  PlacedModule,
  WaivedModule,
  SecondaryProgramme,
  NocDuration,
  SpecialProgramme,
} from '@shared/types';
import {
  createEmptySemesters,
  defaultPlanToSemesters,
  upsertModule,
  removeModule,
  renameModule,
  moveLinkedModules,
  computeRequirements,
  computeStats,
  getCompletedCodesUpTo,
  autoCategoryId,
  isModuleLocked,
  applyNocAdjustment,
  recategorizeModule,
  recategorizeWaivedModule,
  type PlanTemplate,
} from '../lib/studyPlan';

const majorModules = import.meta.glob('../../shared/data/majors/*.json', { eager: true });
const secondMajorModules = import.meta.glob('../../shared/data/second-majors/*.json', { eager: true });
const minorModules = import.meta.glob('../../shared/data/minors/*.json', { eager: true });

/** Major selected on first load, before the user picks one. */
const DEFAULT_MAJOR_ID = 'computer-science-nusc';

/** How long a deleted module stays undoable before the toast dismisses itself. */
const UNDO_DELETE_MS = 6000;

export const loadMajors = (): Major[] =>
  Object.values(majorModules).map((m) => (m as { default: Major }).default);

export const loadSecondMajors = (): SecondaryProgramme[] =>
  expandProgrammes('second-major', Object.values(secondMajorModules).map((m) => (m as { default: SecondaryProgramme }).default));

export const loadMinors = (): SecondaryProgramme[] =>
  expandProgrammes('minor', Object.values(minorModules).map((m) => (m as { default: SecondaryProgramme }).default));

/** NUS caps a student at 1 declared second major and 3 declared minors. */
const MAX_MINORS = 3;

const planKey = (majorId: string) => `studyplan:${majorId}`;

export interface SavedPlanState {
  doubleDegreeId: string | null;
  semesters: StudentSemester[];
  waivedModules: WaivedModule[];
  secondMajorId: string | null;
  minorIds: string[];
  requirementMappings: Record<string, string[]>;
  nocDuration: NocDuration | null;
  specialProgrammes: SpecialProgramme[];
  polytechnicApcUnits?: number;
}

const normalizeNocDuration = (value: unknown): NocDuration | null =>
  value === '3-month' || value === '6-month' || value === '1-year' ? value as NocDuration : null;

const normalizeRequirementMappings = (value: unknown): Record<string, string[]> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string, string[]> = {};
  for (const [name, codes] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(codes)) continue;
    const cleaned = codes.filter((code): code is string => typeof code === 'string');
    if (cleaned.length > 0) result[name] = cleaned;
  }
  return result;
};

type PlanMode = 'personal' | 'review';

/** Rebuild the same category list for a saved/imported plan as for the editor. */
export const buildPlanMajor = (
  rawMajor: Major,
  secondMajorId: string | null,
  minorIds: string[],
  nocDuration: NocDuration | null,
  secondMajors = loadSecondMajors(),
  minors = loadMinors(),
): Major => {
  const adjusted = applyNocAdjustment(rawMajor, nocDuration);
  const second = secondMajors.find(programme => programme.id === secondMajorId);
  const selectedMinors = minorIds.flatMap(id => {
    const programme = minors.find(item => item.id === id);
    return programme ? [programme] : [];
  });
  return {
    ...adjusted,
    categories: [
      ...adjusted.categories,
      ...(second ? [{ id: `second-major-${second.id}`, label: `${second.label} (2nd Major)`, mcTarget: second.mcTarget, color: '#d48c8c' }] : []),
      ...selectedMinors.map(programme => ({ id: `minor-${programme.id}`, label: `${programme.label} (Minor)`, mcTarget: programme.mcTarget, color: '#8cbcd4' })),
    ],
  };
};

const inferCategoryId = (major: Major, moduleCode: string, categoryId?: string): string => {
  if (categoryId && major.categories.some(cat => cat.id === categoryId)) return categoryId;
  return autoCategoryId(major, moduleCode);
};

const normalizeModule = (major: Major, module: Partial<PlacedModule>): PlacedModule | null => {
  const code = module.code?.trim().toUpperCase();
  if (!code) return null;

  const catalogModule = major.moduleCatalog[code];
  return {
    code,
    name: module.name?.trim() || catalogModule?.name || code,
    mcs: Number.isFinite(module.mcs) && module.mcs ? module.mcs : catalogModule?.mcs ?? 0,
    categoryId: inferCategoryId(major, code, module.categoryId),
    allocationPreferences: normalizeAllocationPreferences(module.allocationPreferences),
    excludedProgrammeIds: Array.isArray(module.excludedProgrammeIds)
      ? module.excludedProgrammeIds.filter((id): id is string => typeof id === 'string')
      : undefined,
  };
};

const normalizeSemesters = (major: Major, semesters: StudentSemester[]): StudentSemester[] => {
  const normalized = createEmptySemesters();
  for (const semester of semesters) {
    let target = normalized.find((item) => item.year === semester.year && item.sem === semester.sem);
    if (!target) {
      if (semester.sem === 3 || semester.sem === 4) {
        target = { year: semester.year, sem: semester.sem, modules: [] };
        normalized.push(target);
      } else {
        continue;
      }
    }
    target.modules = (semester.modules ?? [])
      .map((module) => normalizeModule(major, module))
      .filter((module): module is PlacedModule => Boolean(module));
  }
  return normalized.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.sem - b.sem;
  });
};

const normalizeWaivedModules = (major: Major, modules: WaivedModule[] = []): WaivedModule[] =>
  modules
    .map((module) => normalizeModule(major, module))
    .filter((module): module is WaivedModule => Boolean(module));

export const loadSavedPlan = (major: Major): SavedPlanState | null => {
  try {
    const raw = localStorage.getItem(planKey(major.id));
    if (!raw) return null;
    const plan = JSON.parse(raw) as StudentPlan;
    if (!Array.isArray(plan.semesters)) return null;
    const secondMajorId = typeof plan.secondMajorId === 'string' ? plan.secondMajorId : null;
    const minorIds = Array.isArray(plan.minorIds) ? plan.minorIds.slice(0, MAX_MINORS) : [];
    const specialProgrammes = normalizeSpecialProgrammes(plan.specialProgrammes, plan.specialProgramme, plan.nocDuration);
    const restoredMajor = buildPlanMajor(major, secondMajorId, minorIds, getNocDuration(specialProgrammes));
    return {
      doubleDegreeId: normalizeDoubleDegreeId(plan.doubleDegreeId),
      semesters: normalizeSemesters(restoredMajor, plan.semesters),
      waivedModules: normalizeWaivedModules(restoredMajor, plan.waivedModules),
      secondMajorId, minorIds, specialProgrammes,
      requirementMappings: normalizeRequirementMappings(plan.requirementMappings),
      nocDuration: normalizeNocDuration(plan.nocDuration),
      polytechnicApcUnits: typeof plan.polytechnicApcUnits === 'number' && plan.polytechnicApcUnits > 0 ? plan.polytechnicApcUnits : 0,
    };
  } catch {
    return null;
  }
};

const jsonDefaultPlan = (major: Major): SavedPlanState => ({
  doubleDegreeId: null,
  semesters: defaultPlanToSemesters(major),
  waivedModules: normalizeWaivedModules(major, major.defaultWaivedModules),
  secondMajorId: null,
  minorIds: [],
  requirementMappings: {},
  nocDuration: null,
  specialProgrammes: [],
  polytechnicApcUnits: 0,
});

const loadPlanForMajor = (major: Major): SavedPlanState => {
  const savedPlan = loadSavedPlan(major);
  const defaultPlan = jsonDefaultPlan(major);
  return {
    doubleDegreeId: savedPlan?.doubleDegreeId ?? null,
    semesters: savedPlan?.semesters ?? defaultPlan.semesters,
    waivedModules: savedPlan?.waivedModules ?? defaultPlan.waivedModules,
    secondMajorId: savedPlan?.secondMajorId ?? defaultPlan.secondMajorId,
    minorIds: savedPlan?.minorIds ?? defaultPlan.minorIds,
    requirementMappings: savedPlan?.requirementMappings ?? defaultPlan.requirementMappings,
    nocDuration: savedPlan?.nocDuration ?? defaultPlan.nocDuration,
    specialProgrammes: savedPlan?.specialProgrammes ?? defaultPlan.specialProgrammes,
    polytechnicApcUnits: savedPlan?.polytechnicApcUnits ?? defaultPlan.polytechnicApcUnits,
  };
};

export const writeSavedPlan = (majorId: string, state: SavedPlanState) => {
  const plan: StudentPlan = {
    majorId,
    doubleDegreeId: state.doubleDegreeId,
    semesters: state.semesters,
    waivedModules: state.waivedModules,
    secondMajorId: state.secondMajorId ?? undefined,
    minorIds: state.minorIds,
    requirementMappings: state.requirementMappings,

    specialProgrammes: state.specialProgrammes,
    polytechnicApcUnits: state.polytechnicApcUnits && state.polytechnicApcUnits > 0 ? state.polytechnicApcUnits : undefined,
    lastUpdated: new Date().toISOString(),
  };
  localStorage.setItem(planKey(majorId), JSON.stringify(plan));
};

const LAST_MAJOR_KEY = 'studyplan:lastMajorId';

const getInitialMajorId = (majors: Major[], fallback: string): string => {
  const stored = localStorage.getItem(LAST_MAJOR_KEY);
  return stored && majors.some((m) => m.id === stored) ? stored : fallback;
};

export const useStudyPlan = () => {
  const majors = useMemo(loadMajors, []);
  const secondMajors = useMemo(loadSecondMajors, []);
  const minors = useMemo(loadMinors, []);
  const defaultMajor = majors.find((m) => m.id === DEFAULT_MAJOR_ID) ?? majors[0];
  const [initialMajorId] = useState(() => getInitialMajorId(majors, defaultMajor?.id ?? ''));
  const [majorId, setMajorId] = useState<string>(initialMajorId);
  const [personalMajorId, setPersonalMajorId] = useState<string>(initialMajorId);
  const [mode, setMode] = useState<PlanMode>('personal');
  const rawMajor = majors.find((m) => m.id === majorId) ?? defaultMajor;

  const [initialPlan] = useState(() => rawMajor ? loadPlanForMajor(rawMajor) : null);
  const [semesters, setSemesters] = useState<StudentSemester[]>(() => {
    if (!rawMajor) return [];
    return initialPlan?.semesters ?? [];
  });
  const [waivedModules, setWaivedModules] = useState<WaivedModule[]>(() =>
    initialPlan?.waivedModules ?? [],
  );
  const [secondMajorId, setSecondMajorIdState] = useState<string | null>(
    () => initialPlan?.secondMajorId ?? null,
  );
  const [doubleDegreeId, setDoubleDegreeId] = useState<string | null>(() => initialPlan?.doubleDegreeId ?? null);
  const [minorIds, setMinorIds] = useState<string[]>(() => initialPlan?.minorIds ?? []);
  const [requirementMappings, setRequirementMappings] = useState<Record<string, string[]>>(
    () => initialPlan?.requirementMappings ?? {},
  );
  const [specialProgrammes, setSpecialProgrammesState] = useState<SpecialProgramme[]>(() => initialPlan?.specialProgrammes ?? []);
  const [polytechnicApcUnits, setPolytechnicApcUnitsState] = useState<number>(
    () => initialPlan?.polytechnicApcUnits ?? 0,
  );

  const nocDuration = useMemo(() => getNocDuration(specialProgrammes), [specialProgrammes]);

  const major = useMemo(() => buildPlanMajor(rawMajor, secondMajorId, minorIds, nocDuration, secondMajors, minors),
    [rawMajor, nocDuration, secondMajorId, minorIds, secondMajors, minors]);

  useEffect(() => {
    if (!major || mode !== 'personal') return;
    writeSavedPlan(major.id, {
      semesters, waivedModules, doubleDegreeId, secondMajorId, minorIds,
      requirementMappings, nocDuration, specialProgrammes, polytechnicApcUnits,
    });
  }, [semesters, waivedModules, doubleDegreeId, secondMajorId, minorIds, requirementMappings, nocDuration, specialProgrammes, polytechnicApcUnits, major, mode]);

  const setPolytechnicApcUnits = useCallback((units: number) => {
    setPolytechnicApcUnitsState(units);
  }, []);

  const setSecondMajorId = useCallback((id: string | null) => {
    setSecondMajorIdState(id);
  }, []);

  const togglePathway = useCallback((programme: SpecialProgramme) => {
    setSpecialProgrammesState(current => toggleSpecialProgramme(current, programme));
  }, []);

  const rememberMajorId = (id: string) => {
    localStorage.setItem(LAST_MAJOR_KEY, id);
    setPersonalMajorId(id);
  };

  const toggleMinorId = useCallback((id: string) => {
    setMinorIds((prev) => {
      if (prev.includes(id)) return prev.filter((existing) => existing !== id);
      if (prev.length >= MAX_MINORS) return prev;
      return [...prev, id];
    });
  }, []);

  const addRequirementMapping = useCallback((requirementName: string, moduleCode: string) => {
    setRequirementMappings((prev) => {
      const existing = prev[requirementName] ?? [];
      if (existing.includes(moduleCode)) return prev;
      return { ...prev, [requirementName]: [...existing, moduleCode] };
    });
    // A manually mapped module should visibly move into the requirement's own
    // category (e.g. SoC Common Curriculum), not stay wherever autoCategoryId
    // first guessed (typically Unrestricted Electives, since a manually mapped
    // code by definition didn't match any RequirementRule.fulfilledBy) — otherwise
    // its MC counts toward the wrong category's target even though the
    // requirement checklist shows it fulfilled.
    const categoryId = major?.requirements.find((r) => r.name === requirementName)?.categoryId;
    if (categoryId) {
      setSemesters((prev) => recategorizeModule(prev, moduleCode, categoryId));
      setWaivedModules((prev) => recategorizeWaivedModule(prev, moduleCode, categoryId));
    }
  }, [major]);

  const removeRequirementMapping = useCallback((requirementName: string, moduleCode: string) => {
    setRequirementMappings((prev) => {
      const existing = prev[requirementName] ?? [];
      if (!existing.includes(moduleCode)) return prev;
      const remaining = existing.filter((code) => code !== moduleCode);
      const next = { ...prev };
      if (remaining.length === 0) delete next[requirementName];
      else next[requirementName] = remaining;
      return next;
    });
    // Symmetric with addRequirementMapping: once unmapped, the module no longer
    // has a specific reason to sit in the requirement's category, so recompute
    // a sensible category the same way a freshly-added module would get one.
    if (major) {
      const fallbackCategoryId = autoCategoryId(major, moduleCode);
      setSemesters((prev) => recategorizeModule(prev, moduleCode, fallbackCategoryId));
      setWaivedModules((prev) => recategorizeWaivedModule(prev, moduleCode, fallbackCategoryId));
    }
  }, [major]);

  const switchMajor = useCallback(
    (newMajorId: string) => {
      const newMajor = majors.find((m) => m.id === newMajorId);
      if (!newMajor) return;
      const nextPlan = mode === 'personal' ? loadPlanForMajor(newMajor) : jsonDefaultPlan(newMajor);
      setSemesters(nextPlan.semesters);
      setWaivedModules(nextPlan.waivedModules);
      setSecondMajorIdState(nextPlan.secondMajorId);
      setDoubleDegreeId(nextPlan.doubleDegreeId);
      setMinorIds(nextPlan.minorIds);
      setRequirementMappings(nextPlan.requirementMappings);
      setSpecialProgrammesState(nextPlan.specialProgrammes);
      setMajorId(newMajorId);
      if (mode === 'personal') rememberMajorId(newMajorId);
    },
    [majors, mode],
  );

  const applyOnboardingChoice = useCallback(
    (newMajorId: string, mode: 'example' | 'scratch') => {
      const newMajor = majors.find((m) => m.id === newMajorId);
      if (!newMajor) return;
      setSemesters(defaultPlanToSemesters(newMajor, { lockedOnly: mode === 'scratch' }));
      setWaivedModules(
        mode === 'example' ? normalizeWaivedModules(newMajor, newMajor.defaultWaivedModules) : [],
      );
      setSecondMajorIdState(null);
      setDoubleDegreeId(null);
      setMinorIds([]);
      setRequirementMappings({});
      setSpecialProgrammesState([]);
      setMajorId(newMajorId);
      rememberMajorId(newMajorId);
    },
    [majors],
  );

  const addOrMoveModule = useCallback((year: number, sem: number, module: PlacedModule, insertBeforeCode?: string) => {
    if (major && isModuleLocked(major, module.code)) return;
    setSemesters((prev) => (major ? moveLinkedModules(major, prev, year, sem, module, insertBeforeCode) : upsertModule(prev, year, sem, module, insertBeforeCode)));
    setWaivedModules((prev) => prev.filter((m) => m.code !== module.code));
  }, [major]);

  const addSpecialTerm = useCallback((year: number, sem: number) => {
    setSemesters((prev) => {
      if (prev.some((s) => s.year === year && s.sem === sem)) return prev;
      const next = [...prev, { year, sem, modules: [] }];
      return next.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.sem - b.sem;
      });
    });
  }, []);

  const deleteSpecialTerm = useCallback((year: number, sem: number) => {
    setSemesters((prev) => prev.filter((s) => !(s.year === year && s.sem === sem)));
  }, []);

  const [lastRemovedModule, setLastRemovedModule] = useState<{
    module: PlacedModule;
    year: number;
    sem: number;
    insertBeforeCode?: string;
  } | null>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previousPlanSnapshot, setPreviousPlanSnapshot] = useState<SavedPlanState | null>(null);
  const undoAiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    if (undoAiTimeoutRef.current) clearTimeout(undoAiTimeoutRef.current);
  }, []);

  const deleteModule = useCallback((moduleCode: string, year?: number, sem?: number) => {
    const target = year && sem ? { year, sem } : undefined;
    const semester = target ? semesters.find((s) => s.year === target.year && s.sem === target.sem) : undefined;
    const index = semester?.modules.findIndex((m) => m.code === moduleCode) ?? -1;

    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    if (semester && index >= 0) {
      setLastRemovedModule({
        module: semester.modules[index],
        year: semester.year,
        sem: semester.sem,
        insertBeforeCode: semester.modules[index + 1]?.code,
      });
      undoTimeoutRef.current = setTimeout(() => setLastRemovedModule(null), UNDO_DELETE_MS);
    } else {
      setLastRemovedModule(null);
    }

    setSemesters((prev) => removeModule(prev, moduleCode, target));
  }, [semesters]);

  const undoDelete = useCallback(() => {
    if (!lastRemovedModule) return;
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    setSemesters((prev) =>
      upsertModule(prev, lastRemovedModule.year, lastRemovedModule.sem, lastRemovedModule.module, lastRemovedModule.insertBeforeCode),
    );
    setLastRemovedModule(null);
  }, [lastRemovedModule]);

  const updateModule = useCallback(
    (
      oldCode: string,
      updates: PlacedModule,
      destination?: { year: number; sem: number },
    ): { ok: true } | { ok: false; error: string } => {
      const code = updates.code.trim().toUpperCase();
      if (!code) return { ok: false, error: 'Course code is required.' };
      const existing = [...semesters.flatMap((s) => s.modules), ...waivedModules].find((m) => m.code === oldCode);
      if (major && isModuleLocked(major, oldCode) &&
        (destination || code !== oldCode || updates.name !== existing?.name || updates.mcs !== existing?.mcs || updates.categoryId !== existing?.categoryId)) {
        return { ok: false, error: 'This NEP module is compulsory.' };
      }
      const name = updates.name.trim() || code;
      const mcs = Number.isFinite(updates.mcs) && updates.mcs > 0 ? updates.mcs : existing?.mcs ?? 0;

      if (code !== oldCode) {
        const codeTaken =
          semesters.some((s) => s.modules.some((m) => m.code === code)) ||
          waivedModules.some((m) => m.code === code);
        if (codeTaken) return { ok: false, error: 'Module already in your plan.' };
      }

      if (destination) {
        const target = semesters.find(s => s.year === destination.year && s.sem === destination.sem);
        if (!target) return { ok: false, error: 'Choose an existing semester.' };
        const linked = major.sameSemesterGroups?.find(codes => codes.includes(oldCode)) ?? [oldCode];
        const others = target.modules.filter(m => !linked.includes(m.code)).reduce((sum, m) => sum + m.mcs, 0);
        const linkedMc = semesters.flatMap(s => s.modules).filter(m => linked.includes(m.code) && m.code !== oldCode).reduce((sum, m) => sum + m.mcs, 0);
        if (target.year === 1 && target.sem === 1 && others + mcs + linkedMc > 26) return { ok: false, error: 'Y1S1 max is 26 MC.' };
      }
      const currentSemester = semesters.find(s => s.modules.some(m => m.code === oldCode));
      if (!destination && currentSemester?.year === 1 && currentSemester.sem === 1 && mcs > (existing?.mcs ?? 0) && currentSemester.modules.reduce((sum, m) => sum + (m.code === oldCode ? mcs : m.mcs), 0) > 26) {
        return { ok: false, error: 'Y1S1 max is 26 MC.' };
      }
      const next: PlacedModule = {
        code, name, mcs, categoryId: updates.categoryId,
        ...(updates.allocationPreferences !== undefined
          ? { allocationPreferences: normalizeAllocationPreferences(updates.allocationPreferences) ?? {} } : {}),
        ...(updates.excludedProgrammeIds !== undefined ? { excludedProgrammeIds: updates.excludedProgrammeIds } : {}),
      };
      setSemesters((prev) => {
        const moved = destination && existing ? moveLinkedModules(major, prev, destination.year, destination.sem, existing) : prev;
        return renameModule(moved, oldCode, next);
      });
      setWaivedModules(prev => prev.map(m => m.code === oldCode ? { ...m, ...next } : m));
      return { ok: true };
    },
    [major, semesters, waivedModules],
  );

  const addWaivedModule = useCallback((module: WaivedModule) => {
    if (major && isModuleLocked(major, module.code)) return;
    setWaivedModules((prev) => [...prev.filter((m) => m.code !== module.code), module]);
    setSemesters((prev) => removeModule(prev, module.code));
  }, [major]);

  const deleteWaivedModule = useCallback((moduleCode: string) => {
    setWaivedModules((prev) => prev.filter((m) => m.code !== moduleCode));
  }, []);

  const resetPlan = useCallback(
    (template: PlanTemplate | 'scratch' = 'standard') => {
      if (!major) return;
      if (template === 'scratch') {
        setSemesters(defaultPlanToSemesters(major, { lockedOnly: true }));
        setWaivedModules([]);
        setSecondMajorIdState(null);
        setDoubleDegreeId(null);
        setMinorIds([]);
        setRequirementMappings({});
        setSpecialProgrammesState([]);
        return;
      }

      const nextSemesters = defaultPlanToSemesters(major, { template });
      setSemesters(nextSemesters);
      setWaivedModules(normalizeWaivedModules(major, major.defaultWaivedModules));
      setSecondMajorIdState(null);
      setDoubleDegreeId(null);
      setMinorIds([]);
      setRequirementMappings({});
      setSpecialProgrammesState([]);

      if (template === 'poly-accelerated' || template === 'poly-balanced') {
        setPolytechnicApcUnitsState(20);
      } else if (template === 'standard') {
        setPolytechnicApcUnitsState(0);
      }
    },
    [major],
  );

  const importSharedPlan = useCallback(
    (
      newMajorId: string,
      importedSemesters: StudentSemester[],
      importedWaived: WaivedModule[],
      importedSecondMajorId: string | null = null,
      importedMinorIds: string[] = [],
      importedRequirementMappings: Record<string, string[]> = {},
      importedNocDuration: NocDuration | null = null,
      importedSpecialProgramme: SpecialProgramme[] | SpecialProgramme | null = null,
      importedPolytechnicApcUnits: number = 0,
      importedDoubleDegreeId: string | null = null,
    ) => {
      const newMajor = majors.find((m) => m.id === newMajorId);
      if (!newMajor) return false;
      const importedMajor = buildPlanMajor(newMajor, importedSecondMajorId,
        importedMinorIds.filter(id => minors.some(m => m.id === id)).slice(0, MAX_MINORS),
        getNocDuration(normalizeSpecialProgrammes(importedSpecialProgramme, importedSpecialProgramme, importedNocDuration)), secondMajors, minors);
      setMode('personal');
      setDoubleDegreeId(normalizeDoubleDegreeId(importedDoubleDegreeId));
      setSemesters(normalizeSemesters(importedMajor, importedSemesters));
      setWaivedModules(normalizeWaivedModules(importedMajor, importedWaived));
      setSecondMajorIdState(
        importedSecondMajorId && secondMajors.some((m) => m.id === importedSecondMajorId)
          ? importedSecondMajorId
          : null,
      );
      setMinorIds(importedMinorIds.filter((id) => minors.some((m) => m.id === id)).slice(0, MAX_MINORS));
      setRequirementMappings(normalizeRequirementMappings(importedRequirementMappings));
      setSpecialProgrammesState(normalizeSpecialProgrammes(importedSpecialProgramme, importedSpecialProgramme, importedNocDuration));
      setPolytechnicApcUnitsState(importedPolytechnicApcUnits);
      setMajorId(newMajorId);
      rememberMajorId(newMajorId);
      return true;
    },
    [majors, secondMajors, minors],
  );

  const openReviewPlan = useCallback(
    (
      newMajorId: string,
      importedSemesters: StudentSemester[],
      importedWaived: WaivedModule[],
      importedSecondMajorId: string | null = null,
      importedMinorIds: string[] = [],
      importedRequirementMappings: Record<string, string[]> = {},
      importedNocDuration: NocDuration | null = null,
      importedSpecialProgramme: SpecialProgramme[] | SpecialProgramme | null = null,
      importedPolytechnicApcUnits: number = 0,
      importedDoubleDegreeId: string | null = null,
    ) => {
      const newMajor = majors.find((m) => m.id === newMajorId);
      if (!newMajor) return false;
      const importedMajor = buildPlanMajor(newMajor, importedSecondMajorId,
        importedMinorIds.filter(id => minors.some(m => m.id === id)).slice(0, MAX_MINORS),
        getNocDuration(normalizeSpecialProgrammes(importedSpecialProgramme, importedSpecialProgramme, importedNocDuration)), secondMajors, minors);
      setMode('review');
      setDoubleDegreeId(normalizeDoubleDegreeId(importedDoubleDegreeId));
      setSemesters(normalizeSemesters(importedMajor, importedSemesters));
      setWaivedModules(normalizeWaivedModules(importedMajor, importedWaived));
      setSecondMajorIdState(
        importedSecondMajorId && secondMajors.some((m) => m.id === importedSecondMajorId)
          ? importedSecondMajorId
          : null,
      );
      setMinorIds(importedMinorIds.filter((id) => minors.some((m) => m.id === id)).slice(0, MAX_MINORS));
      setRequirementMappings(normalizeRequirementMappings(importedRequirementMappings));
      setSpecialProgrammesState(normalizeSpecialProgrammes(importedSpecialProgramme, importedSpecialProgramme, importedNocDuration));
      setPolytechnicApcUnitsState(importedPolytechnicApcUnits);
      setMajorId(newMajorId);
      return true;
    },
    [majors, secondMajors, minors],
  );

  const exitReviewMode = useCallback(() => {
    const personalMajor = majors.find((m) => m.id === personalMajorId) ?? defaultMajor;
    if (!personalMajor) return;
    const personalPlan = loadPlanForMajor(personalMajor);
    setMode('personal');
    setSemesters(personalPlan.semesters);
    setWaivedModules(personalPlan.waivedModules);
    setSecondMajorIdState(personalPlan.secondMajorId);
    setDoubleDegreeId(personalPlan.doubleDegreeId);
    setMinorIds(personalPlan.minorIds);
    setRequirementMappings(personalPlan.requirementMappings);
    setSpecialProgrammesState(personalPlan.specialProgrammes);
    setPolytechnicApcUnitsState(personalPlan.polytechnicApcUnits ?? 0);
    setMajorId(personalMajor.id);
  }, [majors, personalMajorId, defaultMajor]);

  const applyAiPlan = useCallback(
    (
      newSemesters: StudentSemester[],
      recommendedMinorId?: string | null,
      recommendedSpecialProgramme?: SpecialProgramme | null,
    ) => {
      if (!major) return;
      if (undoAiTimeoutRef.current) clearTimeout(undoAiTimeoutRef.current);
      setPreviousPlanSnapshot({
        semesters,
        waivedModules,
        doubleDegreeId,
        secondMajorId,
        minorIds,
        requirementMappings,
        nocDuration,
        specialProgrammes,
        polytechnicApcUnits,
      });
      undoAiTimeoutRef.current = setTimeout(() => setPreviousPlanSnapshot(null), 15000);

      setSemesters(newSemesters);
      if (recommendedMinorId && !minorIds.includes(recommendedMinorId)) {
        setMinorIds((prev) => [...prev, recommendedMinorId].slice(0, MAX_MINORS));
      }
      if (recommendedSpecialProgramme) {
        setSpecialProgrammesState(current => normalizeSpecialProgrammes([...current, recommendedSpecialProgramme]));
      }
    },
    [major, semesters, waivedModules, doubleDegreeId, secondMajorId, minorIds, requirementMappings, nocDuration, specialProgrammes, polytechnicApcUnits],
  );

  const undoAiPlan = useCallback(() => {
    if (!previousPlanSnapshot) return;
    if (undoAiTimeoutRef.current) clearTimeout(undoAiTimeoutRef.current);
    setSemesters(previousPlanSnapshot.semesters);
    setWaivedModules(previousPlanSnapshot.waivedModules);
    setSecondMajorIdState(previousPlanSnapshot.secondMajorId);
    setDoubleDegreeId(previousPlanSnapshot.doubleDegreeId);
    setMinorIds(previousPlanSnapshot.minorIds);
    setRequirementMappings(previousPlanSnapshot.requirementMappings);
    setSpecialProgrammesState(previousPlanSnapshot.specialProgrammes);
    setPolytechnicApcUnitsState(previousPlanSnapshot.polytechnicApcUnits ?? 0);
    setPreviousPlanSnapshot(null);
  }, [previousPlanSnapshot]);

  const dismissAiUndo = useCallback(() => {
    if (undoAiTimeoutRef.current) clearTimeout(undoAiTimeoutRef.current);
    setPreviousPlanSnapshot(null);
  }, []);

  const requirements = major
    ? computeRequirements(major, semesters, waivedModules, requirementMappings, specialProgrammes)
    : [];
  const stats = major ? computeStats(major, semesters, waivedModules) : { totalMc: 0, byCategory: {} };

  return {
    doubleDegreeId,
    setDoubleDegreeId,
    majors,
    major,
    majorId,
    secondMajors,
    minors,
    secondMajorId,
    minorIds,
    setSecondMajorId,
    toggleMinorId,
    nocDuration,
    specialProgrammes,
    togglePathway,
    polytechnicApcUnits,
    setPolytechnicApcUnits,
    requirementMappings,
    addRequirementMapping,
    removeRequirementMapping,
    semesters,
    waivedModules,
    stats,
    requirements,
    switchMajor,
    applyOnboardingChoice,
    addOrMoveModule,
    deleteModule,
    lastRemovedModule,
    undoDelete,
    updateModule,
    addWaivedModule,
    deleteWaivedModule,
    addSpecialTerm,
    deleteSpecialTerm,
    resetPlan,
    importSharedPlan,
    applyAiPlan,
    undoAiPlan,
    dismissAiUndo,
    hasAiUndo: previousPlanSnapshot !== null,
    openReviewPlan,
    exitReviewMode,
    isReviewMode: mode === 'review',
    getCompletedCodes: (year: number, sem: number) => getCompletedCodesUpTo(semesters, year, sem),
  };
};
