import { useState, useEffect, useCallback } from 'react';
import type { Major, StudentPlan, StudentSemester, PlacedModule, WaivedModule } from '@shared/types';
import {
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

const loadSavedPlan = (majorId: string): SavedPlanState | null => {
  try {
    const raw = localStorage.getItem(planKey(majorId));
    if (!raw) return null;
    const plan = JSON.parse(raw) as StudentPlan;
    return { semesters: plan.semesters, waivedModules: plan.waivedModules ?? [] };
  } catch {
    return null;
  }
};

export const useStudyPlan = () => {
  const majors = loadMajors();
  const [majorId, setMajorId] = useState<string>(majors[0]?.id ?? '');
  const major = majors.find((m) => m.id === majorId) ?? majors[0];

  const savedInitialPlan = major ? loadSavedPlan(major.id) : null;
  const [semesters, setSemesters] = useState<StudentSemester[]>(() => {
    if (!major) return [];
    return savedInitialPlan?.semesters ?? defaultPlanToSemesters(major);
  });
  const [waivedModules, setWaivedModules] = useState<WaivedModule[]>(() => savedInitialPlan?.waivedModules ?? []);

  useEffect(() => {
    if (!major) return;
    const plan: StudentPlan = {
      majorId: major.id,
      semesters,
      waivedModules,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(planKey(major.id), JSON.stringify(plan));
  }, [semesters, waivedModules, major]);

  const switchMajor = useCallback(
    (newMajorId: string) => {
      const newMajor = majors.find((m) => m.id === newMajorId);
      if (!newMajor) return;
      const savedPlan = loadSavedPlan(newMajorId);
      setSemesters(savedPlan?.semesters ?? defaultPlanToSemesters(newMajor));
      setWaivedModules(savedPlan?.waivedModules ?? []);
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
    setSemesters(defaultPlanToSemesters(major));
    setWaivedModules([]);
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