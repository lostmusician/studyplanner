import { useMemo, useState } from 'react';
import { availableMajors, majorCatalog } from '../data/majors';
import type { Category, Module, SemesterKey } from '../types';
import {
  computeRequirements,
  computeStats,
  createEmptySemesters,
  mergePlan,
  removeModule,
  semesterKey,
  upsertModule,
} from '../lib/studyPlan';

const defaultMajorId = availableMajors[0]?.id ?? 'computer-science';

export const useStudyPlan = () => {
  const [majorId, setMajorId] = useState(defaultMajorId);
  const [semesters, setSemesters] = useState(() => {
    const major = majorCatalog[defaultMajorId];
    return mergePlan(createEmptySemesters(), major.initialSemesters);
  });
  const [collapsedCategories, setCollapsedCategories] = useState<Record<Category, boolean>>({
    'Primary Major': false,
    'SOC/NUSC': false,
    'Other Programmes': false,
    'University Requirements': false,
    'Unrestricted Electives': false,
  });

  const major = majorCatalog[majorId] ?? majorCatalog[defaultMajorId];

  const stats = useMemo(() => computeStats(semesters), [semesters]);
  const requirements = useMemo(() => computeRequirements(semesters, major.requirements), [major.requirements, semesters]);

  const addOrMoveModule = (semesterKeyValue: SemesterKey, module: Module) => {
    setSemesters((current) => upsertModule(current, semesterKeyValue, module));
  };

  const deleteModule = (code: string) => {
    setSemesters((current) => removeModule(current, code));
  };

  const toggleCategory = (category: Category) => {
    setCollapsedCategories((current) => ({
      ...current,
      [category]: !current[category],
    }));
  };

  const switchMajor = (nextMajorId: string) => {
    const nextMajor = majorCatalog[nextMajorId];

    if (!nextMajor) {
      return;
    }

    setMajorId(nextMajorId);
    setSemesters(mergePlan(createEmptySemesters(), nextMajor.initialSemesters));
  };

  const resetPlan = () => {
    setSemesters(mergePlan(createEmptySemesters(), major.initialSemesters));
  };

  const allModules = semesters.flatMap((semester) => semester.modules);

  const findModuleLocation = (code: string) =>
    semesters.find((semester) => semester.modules.some((module) => module.code === code));

  return {
    major,
    majors: availableMajors,
    majorId,
    semesters,
    stats,
    requirements,
    collapsedCategories,
    allModules,
    addOrMoveModule,
    deleteModule,
    toggleCategory,
    switchMajor,
    resetPlan,
    findModuleLocation,
    semesterKey,
  };
};