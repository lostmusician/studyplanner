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
  Object.values(secondMajorModules).map((m) => (m as { default: SecondaryProgramme }).default);

export const loadMinors = (): SecondaryProgramme[] =>
  Object.values(minorModules).map((m) => (m as { default: SecondaryProgramme }).default);

/** NUS caps a student at 1 declared second major and 3 declared minors. */
const MAX_MINORS = 3;

const planKey = (majorId: string) => `studyplan:${majorId}`;

interface SavedPlanState {
  semesters: StudentSemester[];
  waivedModules: WaivedModule[];
  secondMajorId: string | null;
  minorIds: string[];
  requirementMappings: Record<string, string[]>;
  nocDuration: NocDuration | null;
  specialProgramme: SpecialProgramme | null;
}

const normalizeNocDuration = (value: unknown): NocDuration | null =>
  value === '3-month' || value === '6-month' || value === '1-year' ? value as NocDuration : null;

const normalizeSpecialProgramme = (value: unknown): SpecialProgramme | null =>
  value === 'noc-3-month' ||
  value === 'noc-6-month' ||
  value === 'noc-1-year' ||
  value === 'sep' ||
  value === 'gex' ||
  value === 'regional-iex' ||
  value === 'siip'
    ? (value as SpecialProgramme)
    : null;

const specialProgrammeToNocDuration = (value: SpecialProgramme | null): NocDuration | null => {
  if (value === 'noc-3-month') return '3-month';
  if (value === 'noc-6-month') return '6-month';
  if (value === 'noc-1-year') return '1-year';
  return null;
};

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

const inferCategoryId = (major: Major, moduleCode: string, categoryId?: string): string => {
  if (categoryId && major.categories.some((cat) => cat.id === categoryId)) return categoryId;
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

const loadSavedPlan = (major: Major): SavedPlanState | null => {
  try {
    const raw = localStorage.getItem(planKey(major.id));
    if (!raw) return null;
    const plan = JSON.parse(raw) as StudentPlan;
    if (!Array.isArray(plan.semesters)) return null;
    return {
      semesters: normalizeSemesters(major, plan.semesters),
      waivedModules: normalizeWaivedModules(major, plan.waivedModules),
      secondMajorId: typeof plan.secondMajorId === 'string' ? plan.secondMajorId : null,
      minorIds: Array.isArray(plan.minorIds) ? plan.minorIds.slice(0, MAX_MINORS) : [],
      requirementMappings: normalizeRequirementMappings(plan.requirementMappings),
      specialProgramme: normalizeSpecialProgramme(plan.specialProgramme) ?? (normalizeNocDuration(plan.nocDuration) ? `noc-${normalizeNocDuration(plan.nocDuration)}` as SpecialProgramme : null),
      nocDuration: normalizeNocDuration(plan.nocDuration),
    };
  } catch {
    return null;
  }
};

const jsonDefaultPlan = (major: Major): SavedPlanState => ({
  semesters: defaultPlanToSemesters(major),
  waivedModules: normalizeWaivedModules(major, major.defaultWaivedModules),
  secondMajorId: null,
  minorIds: [],
  requirementMappings: {},
  nocDuration: null,
  specialProgramme: null,
});

const loadPlanForMajor = (major: Major): SavedPlanState => {
  const savedPlan = loadSavedPlan(major);
  const defaultPlan = jsonDefaultPlan(major);
  return {
    semesters: savedPlan?.semesters ?? defaultPlan.semesters,
    waivedModules: savedPlan?.waivedModules ?? defaultPlan.waivedModules,
    secondMajorId: savedPlan?.secondMajorId ?? defaultPlan.secondMajorId,
    minorIds: savedPlan?.minorIds ?? defaultPlan.minorIds,
    requirementMappings: savedPlan?.requirementMappings ?? defaultPlan.requirementMappings,
    nocDuration: savedPlan?.nocDuration ?? defaultPlan.nocDuration,
    specialProgramme: savedPlan?.specialProgramme ?? defaultPlan.specialProgramme,
  };
};

const writeSavedPlan = (majorId: string, state: SavedPlanState) => {
  const plan: StudentPlan = {
    majorId,
    semesters: state.semesters,
    waivedModules: state.waivedModules,
    secondMajorId: state.secondMajorId ?? undefined,
    minorIds: state.minorIds,
    requirementMappings: state.requirementMappings,
    nocDuration: state.nocDuration ?? undefined,
    specialProgramme: state.specialProgramme ?? undefined,
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
  const majors = loadMajors();
  const secondMajors = loadSecondMajors();
  const minors = loadMinors();
  const defaultMajor = majors.find((m) => m.id === DEFAULT_MAJOR_ID) ?? majors[0];
  const initialMajorId = getInitialMajorId(majors, defaultMajor?.id ?? '');
  const [majorId, setMajorId] = useState<string>(initialMajorId);
  const [personalMajorId, setPersonalMajorId] = useState<string>(initialMajorId);
  const [mode, setMode] = useState<PlanMode>('personal');
  const rawMajor = majors.find((m) => m.id === majorId) ?? defaultMajor;

  const initialPlan = rawMajor ? loadPlanForMajor(rawMajor) : null;
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
  const [minorIds, setMinorIds] = useState<string[]>(() => initialPlan?.minorIds ?? []);
  const [requirementMappings, setRequirementMappings] = useState<Record<string, string[]>>(
    () => initialPlan?.requirementMappings ?? {},
  );
  const [specialProgramme, setSpecialProgrammeState] = useState<SpecialProgramme | null>(
    () => initialPlan?.specialProgramme ?? (initialPlan?.nocDuration ? `noc-${initialPlan.nocDuration}` as SpecialProgramme : null),
  );

  const nocDuration = useMemo(() => specialProgrammeToNocDuration(specialProgramme), [specialProgramme]);

  const major = useMemo<Major>(() => {
    let adjusted = applyNocAdjustment(rawMajor, nocDuration);
    
    // Add second major category card
    if (secondMajorId) {
      const sm = secondMajors.find((m) => m.id === secondMajorId);
      if (sm) {
        adjusted = {
          ...adjusted,
          categories: [
            ...adjusted.categories,
            {
              id: `second-major-${sm.id}`,
              label: `${sm.label} (2nd Major)`,
              mcTarget: 40,
              color: '#d48c8c',
            },
          ],
        };
      }
    }
    
    // Add minor category cards
    for (const minorId of minorIds) {
      const m = minors.find((x) => x.id === minorId);
      if (m) {
        adjusted = {
          ...adjusted,
          categories: [
            ...adjusted.categories,
            {
              id: `minor-${m.id}`,
              label: `${m.label} (Minor)`,
              mcTarget: 20,
              color: '#8cbcd4',
            },
          ],
        };
      }
    }
    
    return adjusted;
  }, [rawMajor, nocDuration, secondMajorId, minorIds, secondMajors, minors]);

  useEffect(() => {
    if (!major || mode !== 'personal') return;
    writeSavedPlan(major.id, { semesters, waivedModules, secondMajorId, minorIds, requirementMappings, nocDuration, specialProgramme });
  }, [semesters, waivedModules, secondMajorId, minorIds, requirementMappings, nocDuration, specialProgramme, major, mode]);

  const setSecondMajorId = useCallback((id: string | null) => {
    setSecondMajorIdState(id);
  }, []);

  const setSpecialProgramme = useCallback((programme: SpecialProgramme | null) => {
    setSpecialProgrammeState(programme);
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
      setMinorIds(nextPlan.minorIds);
      setRequirementMappings(nextPlan.requirementMappings);
      setSpecialProgrammeState(nextPlan.specialProgramme ?? (nextPlan.nocDuration ? `noc-${nextPlan.nocDuration}` as SpecialProgramme : null));
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
      setMinorIds([]);
      setRequirementMappings({});
      setSpecialProgrammeState(null);
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

  useEffect(() => () => {
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
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
      updates: { code: string; name: string; mcs: number; categoryId: string },
    ): { ok: true } | { ok: false; error: string } => {
      const code = updates.code.trim().toUpperCase();
      if (!code) return { ok: false, error: 'Course code is required.' };
      if (major && isModuleLocked(major, oldCode)) {
        return { ok: false, error: 'This NEP module is compulsory.' };
      }

      const existing = semesters.flatMap((s) => s.modules).find((m) => m.code === oldCode);
      const name = updates.name.trim() || code;
      const mcs = Number.isFinite(updates.mcs) && updates.mcs > 0 ? updates.mcs : existing?.mcs ?? 0;

      if (code !== oldCode) {
        const codeTaken =
          semesters.some((s) => s.modules.some((m) => m.code === code)) ||
          waivedModules.some((m) => m.code === code);
        if (codeTaken) return { ok: false, error: 'Module already in your plan.' };
      }

      setSemesters((prev) => renameModule(prev, oldCode, { code, name, mcs, categoryId: updates.categoryId }));
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

  const resetPlan = useCallback(() => {
    if (!major) return;
    const defaultPlan = jsonDefaultPlan(major);
    setSemesters(defaultPlan.semesters);
    setWaivedModules(defaultPlan.waivedModules);
    setSecondMajorIdState(defaultPlan.secondMajorId);
    setMinorIds(defaultPlan.minorIds);
    setRequirementMappings(defaultPlan.requirementMappings);
    setSpecialProgrammeState(defaultPlan.specialProgramme ?? (defaultPlan.nocDuration ? `noc-${defaultPlan.nocDuration}` as SpecialProgramme : null));
  }, [major]);

  const importSharedPlan = useCallback(
    (
      newMajorId: string,
      importedSemesters: StudentSemester[],
      importedWaived: WaivedModule[],
      importedSecondMajorId: string | null = null,
      importedMinorIds: string[] = [],
      importedRequirementMappings: Record<string, string[]> = {},
      importedNocDuration: NocDuration | null = null,
      importedSpecialProgramme: SpecialProgramme | null = null,
    ) => {
      const newMajor = majors.find((m) => m.id === newMajorId);
      if (!newMajor) return false;
      setMode('personal');
      setSemesters(normalizeSemesters(newMajor, importedSemesters));
      setWaivedModules(normalizeWaivedModules(newMajor, importedWaived));
      setSecondMajorIdState(
        importedSecondMajorId && secondMajors.some((m) => m.id === importedSecondMajorId)
          ? importedSecondMajorId
          : null,
      );
      setMinorIds(importedMinorIds.filter((id) => minors.some((m) => m.id === id)).slice(0, MAX_MINORS));
      setRequirementMappings(normalizeRequirementMappings(importedRequirementMappings));
      setSpecialProgrammeState(
        normalizeSpecialProgramme(importedSpecialProgramme) ??
          (normalizeNocDuration(importedNocDuration) ? `noc-${normalizeNocDuration(importedNocDuration)}` as SpecialProgramme : null),
      );
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
      importedSpecialProgramme: SpecialProgramme | null = null,
    ) => {
      const newMajor = majors.find((m) => m.id === newMajorId);
      if (!newMajor) return false;
      setMode('review');
      setSemesters(normalizeSemesters(newMajor, importedSemesters));
      setWaivedModules(normalizeWaivedModules(newMajor, importedWaived));
      setSecondMajorIdState(
        importedSecondMajorId && secondMajors.some((m) => m.id === importedSecondMajorId)
          ? importedSecondMajorId
          : null,
      );
      setMinorIds(importedMinorIds.filter((id) => minors.some((m) => m.id === id)).slice(0, MAX_MINORS));
      setRequirementMappings(normalizeRequirementMappings(importedRequirementMappings));
      setSpecialProgrammeState(
        normalizeSpecialProgramme(importedSpecialProgramme) ??
          (normalizeNocDuration(importedNocDuration) ? `noc-${normalizeNocDuration(importedNocDuration)}` as SpecialProgramme : null),
      );
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
    setMinorIds(personalPlan.minorIds);
    setRequirementMappings(personalPlan.requirementMappings);
    setSpecialProgrammeState(
      personalPlan.specialProgramme ?? (personalPlan.nocDuration ? `noc-${personalPlan.nocDuration}` as SpecialProgramme : null),
    );
    setMajorId(personalMajor.id);
  }, [majors, personalMajorId, defaultMajor]);

  const requirements = major
    ? computeRequirements(major, semesters, waivedModules, requirementMappings, specialProgramme)
    : [];
  const stats = major ? computeStats(major, semesters, waivedModules) : { totalMc: 0, byCategory: {} };

  return {
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
    specialProgramme,
    setSpecialProgramme,
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
    openReviewPlan,
    exitReviewMode,
    isReviewMode: mode === 'review',
    getCompletedCodes: (year: number, sem: number) => getCompletedCodesUpTo(semesters, year, sem),
  };
};