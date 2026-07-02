import { useState, useEffect, useCallback } from 'react';
import type { Major, StudentPlan, StudentSemester, PlacedModule, WaivedModule } from '@shared/types';
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

/** Major selected on first load, before the user picks one. */
const DEFAULT_MAJOR_ID = 'computer-science-nusc';

export const loadMajors = (): Major[] =>
  Object.values(majorModules).map((m) => (m as { default: Major }).default);

const planKey = (majorId: string) => `studyplan:${majorId}`;

interface SavedPlanState {
  semesters: StudentSemester[];
  waivedModules: WaivedModule[];
}

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
    };
  } catch {
    return null;
  }
};

const jsonDefaultPlan = (major: Major): SavedPlanState => ({
  semesters: defaultPlanToSemesters(major),
  waivedModules: normalizeWaivedModules(major, major.defaultWaivedModules),
});

const loadPlanForMajor = (major: Major): SavedPlanState => {
  const savedPlan = loadSavedPlan(major);
  const defaultPlan = jsonDefaultPlan(major);
  return {
    semesters: savedPlan?.semesters ?? defaultPlan.semesters,
    waivedModules: savedPlan?.waivedModules ?? defaultPlan.waivedModules,
  };
};

const writeSavedPlan = (majorId: string, state: SavedPlanState) => {
  const plan: StudentPlan = {
    majorId,
    semesters: state.semesters,
    waivedModules: state.waivedModules,
    lastUpdated: new Date().toISOString(),
  };
  localStorage.setItem(planKey(majorId), JSON.stringify(plan));
};

export const useStudyPlan = () => {
  const majors = loadMajors();
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

  useEffect(() => {
    if (!major || mode !== 'personal') return;
    writeSavedPlan(major.id, { semesters, waivedModules });
  }, [semesters, waivedModules, major, mode]);

  const switchMajor = useCallback(
    (newMajorId: string) => {
      const newMajor = majors.find((m) => m.id === newMajorId);
      if (!newMajor) return;
      const nextPlan = mode === 'personal' ? loadPlanForMajor(newMajor) : jsonDefaultPlan(newMajor);
      setSemesters(nextPlan.semesters);
      setWaivedModules(nextPlan.waivedModules);
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
  }, [major]);

  const importSharedPlan = useCallback(
    (newMajorId: string, importedSemesters: StudentSemester[], importedWaived: WaivedModule[]) => {
      const newMajor = majors.find((m) => m.id === newMajorId);
      if (!newMajor) return false;
      setMode('personal');
      setSemesters(normalizeSemesters(newMajor, importedSemesters));
      setWaivedModules(normalizeWaivedModules(newMajor, importedWaived));
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
    setMajorId(personalMajor.id);
  }, [majors, personalMajorId, defaultMajor]);

  const requirements = major ? computeRequirements(major, semesters, waivedModules) : [];
  const stats = major ? computeStats(major, semesters) : { totalMc: 0, byCategory: {} };

  return {
    majors,
    major,
    majorId,
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