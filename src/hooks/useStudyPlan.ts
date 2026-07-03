import { useState, useEffect, useCallback } from 'react';
import type { Major, StudentPlan, StudentSemester, PlacedModule, WaivedModule, SecondaryProgramme } from '@shared/types';
import {
  createEmptySemesters,
  defaultPlanToSemesters,
  upsertModule,
  removeModule,
  renameModule,
  computeRequirements,
  computeStats,
  getCompletedCodesUpTo,
  autoCategoryId,
  isModuleLocked,
} from '../lib/studyPlan';

const majorModules = import.meta.glob('../../shared/data/majors/*.json', { eager: true });
const secondMajorModules = import.meta.glob('../../shared/data/second-majors/*.json', { eager: true });
const minorModules = import.meta.glob('../../shared/data/minors/*.json', { eager: true });

/** Major selected on first load, before the user picks one. */
const DEFAULT_MAJOR_ID = 'computer-science-nusc';

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
}

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
    const target = normalized.find((item) => item.year === semester.year && item.sem === semester.sem);
    if (!target) continue;
    target.modules = (semester.modules ?? [])
      .map((module) => normalizeModule(major, module))
      .filter((module): module is PlacedModule => Boolean(module));
  }
  return normalized;
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
    lastUpdated: new Date().toISOString(),
  };
  localStorage.setItem(planKey(majorId), JSON.stringify(plan));
};

export const useStudyPlan = () => {
  const majors = loadMajors();
  const secondMajors = loadSecondMajors();
  const minors = loadMinors();
  const defaultMajor = majors.find((m) => m.id === DEFAULT_MAJOR_ID) ?? majors[0];
  const [majorId, setMajorId] = useState<string>(defaultMajor?.id ?? '');
  const [personalMajorId, setPersonalMajorId] = useState<string>(defaultMajor?.id ?? '');
  const [mode, setMode] = useState<PlanMode>('personal');
  const major = majors.find((m) => m.id === majorId) ?? defaultMajor;

  const initialPlan = major ? loadPlanForMajor(major) : null;
  const [semesters, setSemesters] = useState<StudentSemester[]>(() => {
    if (!major) return [];
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

  useEffect(() => {
    if (!major || mode !== 'personal') return;
    writeSavedPlan(major.id, { semesters, waivedModules, secondMajorId, minorIds, requirementMappings });
  }, [semesters, waivedModules, secondMajorId, minorIds, requirementMappings, major, mode]);

  const setSecondMajorId = useCallback((id: string | null) => {
    setSecondMajorIdState(id);
  }, []);

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
  }, []);

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
  }, []);

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
      setMajorId(newMajorId);
      if (mode === 'personal') setPersonalMajorId(newMajorId);
    },
    [majors, mode],
  );

  const addOrMoveModule = useCallback((year: number, sem: number, module: PlacedModule, insertBeforeCode?: string) => {
    if (major && isModuleLocked(major, module.code)) return;
    setSemesters((prev) => upsertModule(prev, year, sem, module, insertBeforeCode));
    setWaivedModules((prev) => prev.filter((m) => m.code !== module.code));
  }, [major]);

  const deleteModule = useCallback((moduleCode: string, year?: number, sem?: number) => {
    const target = year && sem ? { year, sem } : undefined;
    setSemesters((prev) => removeModule(prev, moduleCode, target));
  }, []);

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
  }, [major]);

  const importSharedPlan = useCallback(
    (newMajorId: string, importedSemesters: StudentSemester[], importedWaived: WaivedModule[]) => {
      const newMajor = majors.find((m) => m.id === newMajorId);
      if (!newMajor) return false;
      setMode('personal');
      setSemesters(normalizeSemesters(newMajor, importedSemesters));
      setWaivedModules(normalizeWaivedModules(newMajor, importedWaived));
      setSecondMajorIdState(null);
      setMinorIds([]);
      setRequirementMappings({});
      setMajorId(newMajorId);
      setPersonalMajorId(newMajorId);
      return true;
    },
    [majors],
  );

  const openReviewPlan = useCallback(
    (newMajorId: string, importedSemesters: StudentSemester[], importedWaived: WaivedModule[]) => {
      const newMajor = majors.find((m) => m.id === newMajorId);
      if (!newMajor) return false;
      setMode('review');
      setSemesters(normalizeSemesters(newMajor, importedSemesters));
      setWaivedModules(normalizeWaivedModules(newMajor, importedWaived));
      setSecondMajorIdState(null);
      setMinorIds([]);
      setRequirementMappings({});
      setMajorId(newMajorId);
      return true;
    },
    [majors],
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
    setMajorId(personalMajor.id);
  }, [majors, personalMajorId, defaultMajor]);

  const requirements = major
    ? computeRequirements(major, semesters, waivedModules, requirementMappings)
    : [];
  const stats = major ? computeStats(major, semesters) : { totalMc: 0, byCategory: {} };

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
    requirementMappings,
    addRequirementMapping,
    removeRequirementMapping,
    semesters,
    waivedModules,
    stats,
    requirements,
    switchMajor,
    addOrMoveModule,
    deleteModule,
    updateModule,
    addWaivedModule,
    deleteWaivedModule,
    resetPlan,
    importSharedPlan,
    openReviewPlan,
    exitReviewMode,
    isReviewMode: mode === 'review',
    getCompletedCodes: (year: number, sem: number) => getCompletedCodesUpTo(semesters, year, sem),
  };
};