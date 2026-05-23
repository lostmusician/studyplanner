import type { Major, StudentSemester, PlacedModule } from '@shared/types';

export const semesterLabel = (year: number, sem: number): string => `Y${year}S${sem}`;

export const createEmptySemesters = (): StudentSemester[] =>
  [1, 2, 3, 4].flatMap((year) => [1, 2].map((sem) => ({ year, sem, modules: [] })));

export const defaultPlanToSemesters = (major: Major): StudentSemester[] => {
  const semesters = createEmptySemesters();
  for (const entry of major.defaultPlan) {
    const sem = semesters.find((s) => s.year === entry.year && s.sem === entry.sem);
    if (!sem) continue;
    const mod = major.moduleCatalog[entry.moduleCode];
    if (!mod) continue;
    sem.modules.push({ ...mod, categoryId: entry.categoryId });
  }
  return semesters;
};

export const upsertModule = (
  semesters: StudentSemester[],
  year: number,
  sem: number,
  module: PlacedModule,
): StudentSemester[] => {
  const withoutModule = semesters.map((s) => ({
    ...s,
    modules: s.modules.filter((m) => m.code !== module.code),
  }));
  return withoutModule.map((s) =>
    s.year === year && s.sem === sem ? { ...s, modules: [...s.modules, module] } : s,
  );
};

export const removeModule = (semesters: StudentSemester[], moduleCode: string): StudentSemester[] =>
  semesters.map((s) => ({ ...s, modules: s.modules.filter((m) => m.code !== moduleCode) }));

export const computeRequirements = (
  major: Major,
  semesters: StudentSemester[],
): Array<{ name: string; fulfilled: boolean }> => {
  const allCodes = new Set(semesters.flatMap((s) => s.modules.map((m) => m.code)));
  return major.requirements.map((req) => ({
    name: req.name,
    fulfilled: req.fulfilledBy.some((code) => allCodes.has(code)),
  }));
};

export interface Stats {
  totalMc: number;
  byCategory: Record<string, number>;
}

export const computeStats = (major: Major, semesters: StudentSemester[]): Stats => {
  const byCategory: Record<string, number> = {};
  let totalMc = 0;
  for (const sem of semesters) {
    for (const mod of sem.modules) {
      totalMc += mod.mcs;
      byCategory[mod.categoryId] = (byCategory[mod.categoryId] ?? 0) + mod.mcs;
    }
  }
  return { totalMc, byCategory };
};

export const getCompletedCodesUpTo = (semesters: StudentSemester[], year: number, sem: number): string[] =>
  semesters
    .filter((s) => s.year < year || (s.year === year && s.sem < sem))
    .flatMap((s) => s.modules.map((m) => m.code));
