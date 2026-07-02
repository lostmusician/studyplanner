import { useState, useEffect, useCallback } from 'react';
import type { Major, StudentPlan, StudentSemester, PlacedModule, WaivedModule } from '@shared/types';
import {
  createEmptySemesters,
  defaultPlanToSemesters,
  upsertModule,
  removeModule,
  computeRequirements,
  computeStats,
  getCompletedCodesUpTo,
} from '../lib/studyPlan';

const majorModules = import.meta.glob('../../shared/data/majors/*.json', { eager: true });

export const loadMajors = (): Major[] =>
  Object.values(majorModules).map((m) => (m as { default: Major }).default);

const planKey = (majorId: string) => `studyplan:${majorId}`;

interface SavedPlanState {
  semesters: StudentSemester[];
  waivedModules: WaivedModule[];
}

const matchesFulfiller = (moduleCode: string, fulfiller: string): boolean =>
  fulfiller.endsWith('*') ? moduleCode.startsWith(fulfiller.slice(0, -1)) : moduleCode === fulfiller;

const inferCategoryId = (major: Major, moduleCode: string, categoryId?: string): string => {
  if (categoryId && major.categories.some((cat) => cat.id === categoryId)) return categoryId;

  const defaultEntry = major.defaultPlan.find((entry) => entry.moduleCode === moduleCode);
  if (defaultEntry) return defaultEntry.categoryId;

  const requirement = major.requirements.find((req) =>
    req.categoryId && req.fulfilledBy.some((fulfiller) => matchesFulfiller(moduleCode, fulfiller)),
  );
  return requirement?.categoryId ?? major.categories[0]?.id ?? '';
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
  const [majorId, setMajorId] = useState<string>(majors[0]?.id ?? '');
  const major = majors.find((m) => m.id === majorId) ?? majors[0];

  const savedInitialPlan = major ? loadSavedPlan(major) : null;
  const defaultInitialPlan = major ? jsonDefaultPlan(major) : null;
  const [semesters, setSemesters] = useState<StudentSemester[]>(() => {
    if (!major) return [];
    return savedInitialPlan?.semesters ?? defaultInitialPlan?.semesters ?? [];
  });
  const [waivedModules, setWaivedModules] = useState<WaivedModule[]>(() =>
    savedInitialPlan?.waivedModules ?? defaultInitialPlan?.waivedModules ?? [],
  );

  useEffect(() => {
    if (!major) return;
    writeSavedPlan(major.id, { semesters, waivedModules });
  }, [semesters, waivedModules, major]);

  const switchMajor = useCallback(
    (newMajorId: string) => {
      const newMajor = majors.find((m) => m.id === newMajorId);
      if (!newMajor) return;
      const savedPlan = loadSavedPlan(newMajor);
      const defaultPlan = jsonDefaultPlan(newMajor);
      setSemesters(savedPlan?.semesters ?? defaultPlan.semesters);
      setWaivedModules(savedPlan?.waivedModules ?? defaultPlan.waivedModules);
      setMajorId(newMajorId);
    },
    [majors],
  );

  const addOrMoveModule = useCallback((year: number, sem: number, module: PlacedModule) => {
    setSemesters((prev) => upsertModule(prev, year, sem, module));
    setWaivedModules((prev) => prev.filter((m) => m.code !== module.code));
  }, []);

  const deleteModule = useCallback((moduleCode: string) => {
    setSemesters((prev) => removeModule(prev, moduleCode));
  }, []);

  const addWaivedModule = useCallback((module: WaivedModule) => {
    setWaivedModules((prev) => [...prev.filter((m) => m.code !== module.code), module]);
    setSemesters((prev) => removeModule(prev, module.code));
  }, []);

  const deleteWaivedModule = useCallback((moduleCode: string) => {
    setWaivedModules((prev) => prev.filter((m) => m.code !== moduleCode));
  }, []);

  const resetPlan = useCallback(() => {
    if (!major) return;
    const defaultPlan = jsonDefaultPlan(major);
    setSemesters(defaultPlan.semesters);
    setWaivedModules(defaultPlan.waivedModules);
  }, [major]);

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
    addWaivedModule,
    deleteWaivedModule,
    resetPlan,
    getCompletedCodes: (year: number, sem: number) => getCompletedCodesUpTo(semesters, year, sem),
  };
};