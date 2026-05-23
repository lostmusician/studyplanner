import { useState, useEffect, useCallback } from 'react';
import type { Major, StudentPlan, StudentSemester, PlacedModule } from '@shared/types';
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

const loadSavedPlan = (majorId: string): StudentSemester[] | null => {
  try {
    const raw = localStorage.getItem(planKey(majorId));
    if (!raw) return null;
    return (JSON.parse(raw) as StudentPlan).semesters;
  } catch {
    return null;
  }
};

export const useStudyPlan = () => {
  const majors = loadMajors();
  const [majorId, setMajorId] = useState<string>(majors[0]?.id ?? '');
  const major = majors.find((m) => m.id === majorId) ?? majors[0];

  const [semesters, setSemesters] = useState<StudentSemester[]>(() => {
    if (!major) return [];
    return loadSavedPlan(major.id) ?? defaultPlanToSemesters(major);
  });

  useEffect(() => {
    if (!major) return;
    const plan: StudentPlan = {
      majorId: major.id,
      semesters,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(planKey(major.id), JSON.stringify(plan));
  }, [semesters, major]);

  const switchMajor = useCallback(
    (newMajorId: string) => {
      const newMajor = majors.find((m) => m.id === newMajorId);
      if (!newMajor) return;
      setSemesters(loadSavedPlan(newMajorId) ?? defaultPlanToSemesters(newMajor));
      setMajorId(newMajorId);
    },
    [majors],
  );

  const addOrMoveModule = useCallback((year: number, sem: number, module: PlacedModule) => {
    setSemesters((prev) => upsertModule(prev, year, sem, module));
  }, []);

  const deleteModule = useCallback((moduleCode: string) => {
    setSemesters((prev) => removeModule(prev, moduleCode));
  }, []);

  const resetPlan = useCallback(() => {
    if (!major) return;
    setSemesters(defaultPlanToSemesters(major));
  }, [major]);

  const requirements = major ? computeRequirements(major, semesters) : [];
  const stats = major ? computeStats(major, semesters) : { totalMc: 0, byCategory: {} };

  return {
    majors,
    major,
    majorId,
    semesters,
    stats,
    requirements,
    switchMajor,
    addOrMoveModule,
    deleteModule,
    resetPlan,
    getCompletedCodes: (year: number, sem: number) => getCompletedCodesUpTo(semesters, year, sem),
  };
};
