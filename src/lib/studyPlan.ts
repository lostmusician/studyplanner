import type {
  Major,
  StudentSemester,
  PlacedModule,
  WaivedModule,
  FocusArea,
} from '@shared/types';

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
  insertBeforeCode?: string,
): StudentSemester[] => {
  const withoutModule = semesters.map((s) => ({
    ...s,
    modules: s.modules.filter((m) => m.code !== module.code),
  }));
  return withoutModule.map((s) => {
    if (s.year !== year || s.sem !== sem) return s;
    const modules = [...s.modules];
    const insertIndex = insertBeforeCode
      ? modules.findIndex((m) => m.code === insertBeforeCode)
      : -1;
    if (insertIndex >= 0) modules.splice(insertIndex, 0, module);
    else modules.push(module);
    return { ...s, modules };
  });
};

export const removeModule = (
  semesters: StudentSemester[],
  moduleCode: string,
  target?: { year: number; sem: number },
): StudentSemester[] =>
  semesters.map((s) => {
    if (target && (s.year !== target.year || s.sem !== target.sem)) return s;
    return { ...s, modules: s.modules.filter((m) => m.code !== moduleCode) };
  });

export const isModuleLocked = (major: Major, moduleCode: string): boolean =>
  major.defaultPlan.some((entry) => entry.moduleCode === moduleCode && entry.locked);

export const renameModule = (
  semesters: StudentSemester[],
  oldCode: string,
  updates: PlacedModule,
): StudentSemester[] =>
  semesters.map((s) => ({
    ...s,
    modules: s.modules.map((m) => (m.code === oldCode ? { ...updates } : m)),
  }));

const matchesFulfiller = (moduleCode: string, fulfiller: string): boolean =>
  fulfiller.endsWith('*') ? moduleCode.startsWith(fulfiller.slice(0, -1)) : moduleCode === fulfiller;

/**
 * Best-effort category for a module code, derived from the major's own structure:
 * default plan → requirement mapping → Breadth & Depth (focus areas, Industry
 * Experience, CS/IFS/CP depth) → prefix heuristics → Unrestricted Electives. Used
 * to auto-fill the category picker; the user can still override.
 */
export const autoCategoryId = (major: Major, code: string): string => {
  const c = code.trim().toUpperCase();
  const categoryExists = (id: string): string | undefined =>
    major.categories.find((cat) => cat.id === id)?.id;
  const fallback = major.categories[0]?.id ?? '';
  if (!c) return fallback;

  // 1. Fixed courses the plan already places in a bucket.
  const planned = major.defaultPlan.find((entry) => entry.moduleCode === c);
  if (planned) return planned.categoryId;

  // 2. Courses named by a requirement rule.
  const req = major.requirements.find(
    (r) => r.categoryId && r.fulfilledBy.some((f) => matchesFulfiller(c, f)),
  );
  if (req?.categoryId && categoryExists(req.categoryId)) return req.categoryId;

  // 3. Breadth & Depth: focus-area courses, Industry Experience, or CS/IFS/CP depth.
  const bd = major.breadthDepth;
  if (bd && categoryExists(bd.categoryId)) {
    const inFocusArea = major.focusAreas?.some(
      (a) => a.primaries.includes(c) || a.electives?.includes(c),
    );
    const isIndustryExperience = bd.industryExperience.courses.includes(c);
    const isDepth = bd.allowedPrefixes.some((p) => c.startsWith(p)) && courseLevel(c) >= 3000;
    if (inFocusArea || isIndustryExperience || isDepth) return bd.categoryId;
  }

  // 4. Maths & sciences by prefix.
  if (/^(MA|ST|PC|LSM|CM|PH)\d/.test(c)) {
    const math = categoryExists('math-sciences');
    if (math) return math;
  }

  // 5. Anything else is an unrestricted elective.
  return categoryExists('unrestricted-electives') ?? fallback;
};

export interface RequirementStatus {
  name: string;
  fulfilled: boolean;
  categoryId?: string;
  have: number;
  need: number;
}

export const computeRequirements = (
  major: Major,
  semesters: StudentSemester[],
  waivedModules: WaivedModule[] = [],
): RequirementStatus[] => {
  const plannedCodes = semesters.flatMap((s) => s.modules.map((m) => m.code));
  const waivedCodes = waivedModules.map((m) => m.code);
  const allCodes = Array.from(new Set([...plannedCodes, ...waivedCodes]));
  return major.requirements.map((req) => {
    const matchCount = allCodes.filter((code) =>
      req.fulfilledBy.some((fulfiller) => matchesFulfiller(code, fulfiller)),
    ).length;
    const need = req.count ?? 1;
    return {
      name: req.name,
      fulfilled: matchCount >= need,
      categoryId: req.categoryId,
      have: matchCount,
      need,
    };
  });
};

/** Derives the NUS course level from a code, e.g. "CS4231" -> 4000, "CS2103T" -> 2000. */
export const courseLevel = (code: string): number => {
  const digits = code.toUpperCase().replace(/^[A-Z]+/, '').match(/^\d+/)?.[0];
  return digits ? Math.floor(parseInt(digits, 10) / 1000) * 1000 : 0;
};

export interface FocusAreaStatus {
  id: string;
  label: string;
  /** Distinct primaries the student has placed or waived, in code order. */
  matched: string[];
  /** Of the matched primaries, those at level-4000 or above. */
  seniorMatched: string[];
  need: number;
  needSenior: number;
  fulfilled: boolean;
}

const computeFocusAreaStatus = (area: FocusArea, codes: Set<string>): FocusAreaStatus => {
  const need = area.minCourses ?? 3;
  const needSenior = area.minSeniorCourses ?? 1;
  const matched = area.primaries.filter((code) => codes.has(code));
  const seniorMatched = matched.filter((code) => courseLevel(code) >= 4000);
  return {
    id: area.id,
    label: area.label,
    matched,
    seniorMatched,
    need,
    needSenior,
    fulfilled: matched.length >= need && seniorMatched.length >= needSenior,
  };
};

/**
 * Progress toward each focus area, sorted most-complete first. A CS student needs to
 * satisfy just one, so `anyFulfilled` reflects the overall Focus Area requirement.
 */
export const computeFocusAreas = (
  major: Major,
  semesters: StudentSemester[],
  waivedModules: WaivedModule[] = [],
): { areas: FocusAreaStatus[]; anyFulfilled: boolean } => {
  if (!major.focusAreas?.length) return { areas: [], anyFulfilled: false };
  const codes = new Set([
    ...semesters.flatMap((s) => s.modules.map((m) => m.code)),
    ...waivedModules.map((m) => m.code),
  ]);
  const areas = major.focusAreas
    .map((area) => computeFocusAreaStatus(area, codes))
    .sort((a, b) => {
      if (a.fulfilled !== b.fulfilled) return a.fulfilled ? -1 : 1;
      if (b.matched.length !== a.matched.length) return b.matched.length - a.matched.length;
      return b.seniorMatched.length - a.seniorMatched.length;
    });
  return { areas, anyFulfilled: areas.some((a) => a.fulfilled) };
};

export interface ConstraintStatus {
  id: string;
  /** Full descriptive label (used for tooltips/accessibility). */
  label: string;
  /** Compact label for chip display, e.g. "L4000+". */
  short: string;
  /** Short progress/context string, e.g. "8/12u". */
  detail?: string;
  fulfilled: boolean;
  /** True when the constraint is actively violated (e.g. a cap exceeded). */
  warn?: boolean;
}

export interface BreadthDepthStatus {
  totalUnits: number;
  targetUnits: number;
  constraints: ConstraintStatus[];
  /** Codes tagged to Breadth & Depth that break the coding restriction. */
  codingViolations: string[];
}

/** Evaluates the full multi-constraint Breadth & Depth requirement. Constraints
 * are checked over courses tagged with the configured category; the focus-area
 * constraint reuses {@link computeFocusAreas}, which scans the whole plan so a
 * foundation course in an area's primaries still counts. */
export const computeBreadthDepth = (
  major: Major,
  semesters: StudentSemester[],
  waivedModules: WaivedModule[] = [],
): BreadthDepthStatus | null => {
  const cfg = major.breadthDepth;
  if (!cfg) return null;

  const tagged = [...semesters.flatMap((s) => s.modules), ...waivedModules].filter(
    (m) => m.categoryId === cfg.categoryId,
  );
  const byCode = new Map<string, PlacedModule>();
  for (const m of tagged) if (!byCode.has(m.code)) byCode.set(m.code, m);
  const all = [...byCode.values()];

  const ieCodes = new Set(cfg.industryExperience.courses);
  const sum = (list: PlacedModule[]) => list.reduce((n, m) => n + m.mcs, 0);
  const ie = all.filter((m) => ieCodes.has(m.code));
  const nonIe = all.filter((m) => !ieCodes.has(m.code));

  const totalUnits = sum(all);
  const level4000Units = sum(all.filter((m) => courseLevel(m.code) >= 4000));
  const ieUnits = sum(ie);
  const cpUnits = sum(nonIe.filter((m) => m.code.startsWith(cfg.cpPrefix)));
  const codingViolations = nonIe
    .filter((m) => !cfg.allowedPrefixes.some((p) => m.code.startsWith(p)))
    .map((m) => m.code);

  const { anyFulfilled: focusDone } = computeFocusAreas(major, semesters, waivedModules);
  const dissCode = cfg.industryExperience.dissertationAlternative;
  const hasDissertation = dissCode ? all.some((m) => m.code === dissCode) : false;
  const { minUnits, maxUnits } = cfg.industryExperience;

  const constraints: ConstraintStatus[] = [
    {
      id: 'focus-area',
      label: 'Complete a CS Focus Area',
      short: 'Focus area',
      fulfilled: focusDone,
    },
    {
      id: 'level-4000',
      label: `≥ ${cfg.minLevel4000Units} units at level-4000+`,
      short: 'L4000+',
      detail: `${level4000Units}/${cfg.minLevel4000Units}u`,
      fulfilled: level4000Units >= cfg.minLevel4000Units,
    },
    {
      id: 'industry-experience',
      label: 'Industry Experience (6–12 units, or CP4101 dissertation)',
      short: 'Industry exp',
      detail: hasDissertation
        ? `via ${dissCode}`
        : `${ieUnits}/${minUnits}–${maxUnits}u`,
      fulfilled: hasDissertation || (ieUnits >= minUnits && ieUnits <= maxUnits),
      warn: !hasDissertation && ieUnits > maxUnits,
    },
    {
      id: 'coding',
      label: `Non-IE courses must be ${cfg.allowedPrefixes.join('/')}-coded`,
      short: `${cfg.allowedPrefixes.join('/')} only`,
      detail: codingViolations.length > 0 ? `${codingViolations.join(', ')} ✕` : undefined,
      fulfilled: codingViolations.length === 0,
      warn: codingViolations.length > 0,
    },
    {
      id: 'cp-cap',
      label: `≤ ${cfg.maxCpUnits} units ${cfg.cpPrefix}-coded (excl. Industry Experience)`,
      short: `${cfg.cpPrefix} ≤${cfg.maxCpUnits}u`,
      detail: `${cpUnits}/${cfg.maxCpUnits}u`,
      fulfilled: cpUnits <= cfg.maxCpUnits,
      warn: cpUnits > cfg.maxCpUnits,
    },
    {
      id: 'total',
      label: `${cfg.totalUnits} units total`,
      short: 'Total',
      detail: `${totalUnits}/${cfg.totalUnits}u`,
      fulfilled: totalUnits >= cfg.totalUnits,
    },
  ];

  return { totalUnits, targetUnits: cfg.totalUnits, constraints, codingViolations };
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