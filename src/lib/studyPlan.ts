import type { Category, MajorDefinition, Requirement, Semester, SemesterKey, StudyPlanStats } from '../types';

export const semesterKey = (semester: Semester): SemesterKey => `${semester.year}-${semester.sem}`;

export const semesterLabel = (semester: Semester): string => `Y${semester.year}S${semester.sem}`;

export const createEmptySemesters = (): Semester[] =>
  Array.from({ length: 4 }, (_, yearIndex) =>
    Array.from({ length: 2 }, (_, semIndex) => ({
      year: yearIndex + 1,
      sem: semIndex + 1,
      modules: [],
    })),
  ).flat();

export const mergePlan = (base: Semester[], seed: Semester[]): Semester[] => {
  const lookup = new Map<SemesterKey, Semester>();

  for (const semester of base) {
    lookup.set(semesterKey(semester), {
      ...semester,
      modules: [...semester.modules],
    });
  }

  for (const semester of seed) {
    const key = semesterKey(semester);
    const current = lookup.get(key);

    if (!current) {
      lookup.set(key, {
        ...semester,
        modules: [...semester.modules],
      });
      continue;
    }

    current.modules = [...semester.modules];
  }

  return Array.from(lookup.values()).sort((left, right) => (left.year - right.year) || (left.sem - right.sem));
};

export const cloneSemesters = (semesters: Semester[]): Semester[] =>
  semesters.map((semester) => ({
    ...semester,
    modules: [...semester.modules],
  }));

export const computeRequirements = (
  semesters: Semester[],
  rules: MajorDefinition['requirements'],
): Requirement[] => {
  const codes = new Set(semesters.flatMap((semester) => semester.modules.map((module) => module.code)));

  return rules.map((rule) => {
    const fulfilledBy = rule.fulfilledBy.filter((code) => codes.has(code));

    return {
      name: rule.name,
      fulfilledBy,
      isFulfilled: fulfilledBy.length > 0,
    };
  });
};

export const computeStats = (semesters: Semester[]): StudyPlanStats => {
  const byCategory = {
    'Primary Major': 0,
    'SOC/NUSC': 0,
    'Other Programmes': 0,
    'University Requirements': 0,
    'Unrestricted Electives': 0,
  } satisfies Record<Category, number>;

  const bySemester: Record<string, number> = {};

  let totalMc = 0;

  for (const semester of semesters) {
    const key = semesterKey(semester);
    const semesterMc = semester.modules.reduce((sum, module) => sum + module.mcs, 0);

    bySemester[key] = semesterMc;
    totalMc += semesterMc;

    for (const module of semester.modules) {
      byCategory[module.category] += module.mcs;
    }
  }

  return {
    totalMc,
    primaryMajorMc: byCategory['Primary Major'],
    socMc: byCategory['SOC/NUSC'],
    byCategory,
    bySemester,
  };
};

export const findModuleSemester = (semesters: Semester[], code: string): Semester | undefined =>
  semesters.find((semester) => semester.modules.some((module) => module.code === code));

export const upsertModule = (
  semesters: Semester[],
  targetKey: SemesterKey,
  module: { code: string; name: string; mcs: number; category: Category },
): Semester[] => {
  const next = cloneSemesters(semesters);

  for (const semester of next) {
    semester.modules = semester.modules.filter((entry) => entry.code !== module.code);
  }

  const target = next.find((semester) => semesterKey(semester) === targetKey);

  if (!target) {
    return next;
  }

  target.modules = [...target.modules, module];
  return next;
};

export const removeModule = (semesters: Semester[], code: string): Semester[] => {
  const next = cloneSemesters(semesters);

  return next.map((semester) => ({
    ...semester,
    modules: semester.modules.filter((module) => module.code !== code),
  }));
};

export const categoryBadgeTone = (category: Category): string => {
  switch (category) {
    case 'Primary Major':
      return 'bg-ink text-canvas';
    case 'SOC/NUSC':
      return 'bg-accent text-canvas';
    case 'Other Programmes':
      return 'bg-[#b7a88f] text-canvas';
    case 'University Requirements':
      return 'bg-[#8f8b7f] text-canvas';
    case 'Unrestricted Electives':
      return 'bg-[#d1cabd] text-ink';
    default:
      return 'bg-ink text-canvas';
  }
};