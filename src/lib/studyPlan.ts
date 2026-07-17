import type {
  Major,
  StudentSemester,
  PlacedModule,
  WaivedModule,
  FocusArea,
  SecondaryProgramme,
  RequirementRule,
  NocDuration,
  SpecialProgramme,
} from '@shared/types';

export const semesterLabel = (year: number, sem: number): string => {
  if (sem === 1) return `Y${year}S1`;
  if (sem === 2) return `Y${year}S2`;
  if (sem === 3) return `Y${year} ST I`;
  if (sem === 4) return `Y${year} ST II`;
  return `Y${year}S${sem}`;
};

export const createEmptySemesters = (): StudentSemester[] =>
  [1, 2, 3, 4].flatMap((year) => [1, 2].map((sem) => ({ year, sem, modules: [] })));

export const defaultPlanToSemesters = (
  major: Major,
  options: { lockedOnly?: boolean } = {},
): StudentSemester[] => {
  const semesters = createEmptySemesters();
  for (const entry of major.defaultPlan) {
    if (options.lockedOnly && !entry.locked) continue;
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

/** Moves a module and any same-semester linked modules together as one group.
 * The module being moved stays first in the target semester; linked modules are
 * appended after it so the semester order stays stable and predictable. */
export const moveLinkedModules = (
  major: Major,
  semesters: StudentSemester[],
  year: number,
  sem: number,
  module: PlacedModule,
  insertBeforeCode?: string,
): StudentSemester[] => {
  const group = major.sameSemesterGroups?.find((codes) => codes.includes(module.code));
  const codesToMove = group ? [module.code, ...group.filter((code) => code !== module.code)] : [module.code];
  let next = semesters;

  for (const code of codesToMove) {
    const currentModule = code === module.code
      ? module
      : next.flatMap((semester) => semester.modules).find((placed) => placed.code === code);
    if (!currentModule) continue;
    next = upsertModule(next, year, sem, currentModule, code === module.code ? insertBeforeCode : undefined);
  }

  return next;
};

/** Reassigns a placed module's `categoryId` in place, wherever it's currently
 * scheduled. Used when a manual requirement mapping links a module to a
 * requirement row (see `StudentPlan.requirementMappings`) — without this, a
 * module auto-categorized as Unrestricted Electives on first add (because its
 * code didn't match any `RequirementRule.fulfilledBy`) would stay tagged that
 * way even after being manually linked to satisfy a SoC Common Curriculum
 * requirement, so its MC would count toward the wrong category's target while
 * the requirement checklist shows it fulfilled. No-op if the code isn't
 * currently placed. */
export const recategorizeModule = (
  semesters: StudentSemester[],
  moduleCode: string,
  categoryId: string,
): StudentSemester[] =>
  semesters.map((s) => ({
    ...s,
    modules: s.modules.map((m) => (m.code === moduleCode ? { ...m, categoryId } : m)),
  }));

/** Same as {@link recategorizeModule} but for the waived-modules list, which
 * isn't shaped as `StudentSemester[]`. */
export const recategorizeWaivedModule = (
  waivedModules: WaivedModule[],
  moduleCode: string,
  categoryId: string,
): WaivedModule[] => waivedModules.map((m) => (m.code === moduleCode ? { ...m, categoryId } : m));

export const matchesFulfiller = (moduleCode: string, fulfiller: string): boolean =>
  fulfiller.endsWith('*') ? moduleCode.startsWith(fulfiller.slice(0, -1)) : moduleCode === fulfiller;

const matchesAnyRequirement = (requirements: RequirementRule[], code: string): boolean =>
  requirements.some((req) => req.fulfilledBy.some((fulfiller) => matchesFulfiller(code, fulfiller)));

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

  // 1b. NOC courses (starts with ETP or TR) when NOC is declared
  if (categoryExists('noc') && /^(ETP|TR)\d/.test(c)) {
    return 'noc';
  }

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

  // 3b. Programme Electives: named elective categories or specialisation tracks.
  const pe = major.programmeElectives;
  if (pe && categoryExists(pe.categoryId)) {
    const inCategory = pe.categories.some((cat) => cat.courses.includes(c));
    const inSpecialisation = pe.specialisations?.some((s) => s.courses.includes(c));
    if (inCategory || inSpecialisation) return pe.categoryId;
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
  info?: string;
}

export const computeRequirements = (
  source: Pick<Major, 'requirements'>,
  semesters: StudentSemester[],
  waivedModules: WaivedModule[] = [],
  requirementMappings: Record<string, string[]> = {},
  specialProgramme: SpecialProgramme | null = null,
): RequirementStatus[] => {
  const plannedCodes = semesters.flatMap((s) => s.modules.map((m) => m.code));
  const waivedCodes = waivedModules.map((m) => m.code);
  const allCodes = Array.from(new Set([...plannedCodes, ...waivedCodes]));
  return source.requirements.map((req) => {
    // Scanning `allCodes` keeps a mapped-but-removed module dormant: the link
    // survives in the plan, but only counts while the module is placed/waived.
    const mappedCodes = requirementMappings[req.name] ?? [];
    const matchCount = allCodes.filter(
      (code) =>
        req.fulfilledBy.some((fulfiller) => matchesFulfiller(code, fulfiller)) ||
        mappedCodes.includes(code),
    ).length;
    const need = req.count ?? 1;
    const codeSet = new Set(allCodes);
    const altGroupSatisfied = (req.altGroups ?? []).some((group) => group.every((code) => codeSet.has(code)));
    const specialProgrammeBonus =
      specialProgramme === 'gex' && req.name === 'Making Connections'
        ? 1
        : 0;
    const have = matchCount + specialProgrammeBonus;
    
    const nocSatisfied =
      (req.name.toLowerCase().includes('industry') || req.name.toLowerCase().includes('industrial')) &&
      Boolean(specialProgramme && specialProgramme.startsWith('noc'));
    let fulfilled = have >= need || altGroupSatisfied || nocSatisfied;
    let info: string | undefined = undefined;

    if (req.name.startsWith('Making Connections')) {
      const hssCount = allCodes.filter((code) =>
        ['NHS', 'NFB', 'NHT'].some((p) => code.startsWith(p))
      ).length;
      const stCount = allCodes.filter((code) =>
        ['NST', 'NFC'].some((p) => code.startsWith(p))
      ).length;
      const isNoc = specialProgramme && specialProgramme.startsWith('noc');
      const minHss = isNoc ? 1 : 2;
      const minSt = isNoc ? 1 : 2;

      if (hssCount < minHss || stCount < minSt) {
        fulfilled = false;
        info = `Need at least ${minHss} HSS & ${minSt} ST courses (${hssCount} HSS, ${stCount} ST on plan)`;
      }
    }

    return {
      name: req.name,
      fulfilled,
      categoryId: req.categoryId,
      have: nocSatisfied ? need : have,
      need,
      info,
    };
  });
};

export interface DoubleCountStatus {
  doubleCountMc: number;
  /** secondary.mcTarget * 0.4 — 16 MC for a second major, 8 MC for a minor
   * at NUS's standard 40/20 MC sizes. Derived, never hard-coded. */
  capMc: number;
  warn: boolean;
  doubleCountedCodes: string[];
}

/** Whether each already-placed module (which belongs to the primary major by
 * construction) also satisfies the secondary programme's own requirements.
 * There is deliberately no `primary: Major` parameter here: many primary
 * categories (e.g. math-sciences, unrestricted electives) carry an MC target
 * but no named RequirementRule row, so "satisfies a primary requirement"
 * would silently miss legitimate double-counting. */
export const computeDoubleCount = (
  secondary: SecondaryProgramme,
  semesters: StudentSemester[],
  waivedModules: WaivedModule[] = [],
): DoubleCountStatus => {
  const allModules = [...semesters.flatMap((s) => s.modules), ...waivedModules];
  const byCode = new Map<string, PlacedModule>();
  for (const m of allModules) if (!byCode.has(m.code)) byCode.set(m.code, m);

  const doubleCountedCodes = [...byCode.keys()].filter((code) =>
    matchesAnyRequirement(secondary.requirements, code),
  );
  const doubleCountMc = doubleCountedCodes.reduce((sum, code) => sum + (byCode.get(code)?.mcs ?? 0), 0);
  const capMc = secondary.mcTarget * 0.4;

  return { doubleCountMc, capMc, warn: doubleCountMc > capMc, doubleCountedCodes };
};

/** Codes that satisfy ≥1 requirement in 2 or more declared secondary
 * programmes at once (1 implicit primary count + 2 secondary counts = 3).
 * NUS explicitly forbids this. */
export const computeTripleCountedCodes = (
  secondaries: SecondaryProgramme[],
  semesters: StudentSemester[],
  waivedModules: WaivedModule[] = [],
): string[] => {
  const allModules = [...semesters.flatMap((s) => s.modules), ...waivedModules];
  const codes = Array.from(new Set(allModules.map((m) => m.code)));
  return codes.filter(
    (code) => secondaries.filter((secondary) => matchesAnyRequirement(secondary.requirements, code)).length >= 2,
  );
};

/** NOC waives Making Connections Electives (MCEs) only — 4 UT each, confirmed
 * uniform across NUSC-wide and SoC/NUSC-specific curricula alike. Waiver
 * counts and freed MC are NUS-wide constants, independent of a major's own
 * `nus-college` MC total (52 for SoC/NUSC majors, 56 generically) — the
 * waived count is what shrinks, the per-elective 4 MC weight is fixed. */
const NOC_MCE_WAIVERS: Record<NocDuration, { wavered: number; freedMc: number }> = {
  '3-month': { wavered: 0, freedMc: 0 },
  '6-month': { wavered: 2, freedMc: 8 },
  '1-year': { wavered: 4, freedMc: 16 },
};

/** Applies NOC (NUS Overseas Colleges) Programme-With-Waivers adjustments to a
 * major: reduces the "Making Connections" requirement's `count` by the waived
 * amount, and moves the freed MC from `nus-college` to `unrestricted-electives`
 * so `totalMcTarget` stays fixed. NOC waives NUSC requirements ONLY — SoC/
 * Faculty common curriculum (`soc-common`) is untouched, per the official NUSC
 * FAQ: "the waiver ... is for NUSC requirements only." A major with no
 * `nus-college` category or no "Making Connections" row (i.e. not modeled with
 * the NUSC block at all) is returned unchanged. Returns `major` unchanged
 * when `duration` is nullish (3-month NOC waives nothing, so it isn't a
 * distinct `NocDuration` value — see the type's own doc comment). */
export const applyNocAdjustment = (major: Major, duration?: NocDuration | null): Major => {
  if (!duration) return major;
  const rule = NOC_MCE_WAIVERS[duration];
  const mceIndex = major.requirements.findIndex(
    (r) => r.categoryId === 'nus-college' && r.name.startsWith('Making Connections'),
  );
  const hasNusCollege = major.categories.some((c) => c.id === 'nus-college');
  if (!rule || mceIndex === -1 || !hasNusCollege) return major;

  const mceReq = major.requirements[mceIndex];
  const newCount = Math.max(0, (mceReq.count ?? 1) - rule.wavered);

  const nocTarget = duration === '3-month' ? 6 : (duration === '6-month' ? 12 : 36);
  const bdReduction = duration === '1-year' ? 12 : 6;

  let categories = major.categories.map((cat) => {
    if (cat.id === 'nus-college' && cat.mcTarget !== undefined) {
      return { ...cat, mcTarget: Math.max(0, cat.mcTarget - rule.freedMc) };
    }
    if ((cat.id === 'breadth-depth' || cat.id === 'ai-breadth-depth' || cat.id === 'industry-experience') && cat.mcTarget !== undefined) {
      return { ...cat, mcTarget: Math.max(0, cat.mcTarget - bdReduction) };
    }
    return cat;
  });

  if (!categories.some((c) => c.id === 'noc')) {
    categories.push({
      id: 'noc',
      label: 'NUS Overseas Colleges (NOC)',
      mcTarget: nocTarget,
      color: '#e07a5f',
    });
  }

  return {
    ...major,
    categories,
    requirements: major.requirements.map((r, i) => (i === mceIndex ? { ...r, count: newCount } : r)),
  };
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

  const dissCode = cfg.industryExperience.dissertationAlternative;
  const hasDissertation = dissCode ? all.some((m) => m.code === dissCode) : false;
  const { minUnits, maxUnits } = cfg.industryExperience;

  const constraints: ConstraintStatus[] = [];

  // A major uses exactly one of these two mechanisms to gate its "pick technical
  // depth" constraint: named Focus Areas (CS) or a flat technical-electives list (AI).
  if (major.focusAreas?.length) {
    const { anyFulfilled: focusDone } = computeFocusAreas(major, semesters, waivedModules);
    constraints.push({
      id: 'focus-area',
      label: 'Complete a CS Focus Area',
      short: 'Focus area',
      fulfilled: focusDone,
    });
  } else if (cfg.technicalElectives) {
    const teCodes = new Set(cfg.technicalElectives.courses);
    const teUnits = sum(all.filter((m) => teCodes.has(m.code)));
    constraints.push({
      id: 'technical-electives',
      label: `≥ ${cfg.technicalElectives.minUnits} units from the Technical Electives list`,
      short: 'Tech electives',
      detail: `${teUnits}/${cfg.technicalElectives.minUnits}u`,
      fulfilled: teUnits >= cfg.technicalElectives.minUnits,
    });
  }

  constraints.push(
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
  );

  return { totalUnits, targetUnits: cfg.totalUnits, constraints, codingViolations };
};

export interface SpecialisationStatus {
  id: string;
  label: string;
  matched: string[];
  need: number;
  fulfilled: boolean;
}

export interface ElectiveCategoryStatus {
  id: string;
  label: string;
  matched: string[];
}

export interface ProgrammeElectivesStatus {
  totalUnits: number;
  targetUnits: number;
  /** Distinct codes tagged to the electives category that match a named category. */
  matchedCourses: string[];
  minCourses: number;
  constraints: ConstraintStatus[];
  categories: ElectiveCategoryStatus[];
  specialisations: SpecialisationStatus[];
}

/** Evaluates the named-elective-category Programme Electives requirement
 * (e.g. NUS Business Analytics, Business AI Systems). Distinct from
 * {@link computeBreadthDepth}: courses are pooled across named `categories`
 * rather than checked against a Focus Area / Industry Experience split, and
 * `specialisations` are informational progress tracks, not a hard gate. */
export const computeProgrammeElectives = (
  major: Major,
  semesters: StudentSemester[],
  waivedModules: WaivedModule[] = [],
): ProgrammeElectivesStatus | null => {
  const cfg = major.programmeElectives;
  if (!cfg) return null;

  const tagged = [...semesters.flatMap((s) => s.modules), ...waivedModules].filter(
    (m) => m.categoryId === cfg.categoryId,
  );
  const byCode = new Map<string, PlacedModule>();
  for (const m of tagged) if (!byCode.has(m.code)) byCode.set(m.code, m);
  const all = [...byCode.values()];

  const namedCodes = new Set(cfg.categories.flatMap((cat) => cat.courses));
  const matched = all.filter((m) => namedCodes.has(m.code));
  const matchedCourses = matched.map((m) => m.code);
  const totalUnits = all.reduce((n, m) => n + m.mcs, 0);
  const level4000Count = matched.filter((m) => courseLevel(m.code) >= 4000).length;

  const constraints: ConstraintStatus[] = [
    {
      id: 'course-count',
      label: `${cfg.minCourses} distinct elective courses`,
      short: 'Courses',
      detail: `${matched.length}/${cfg.minCourses}`,
      fulfilled: matched.length >= cfg.minCourses,
    },
  ];

  if (cfg.minLevel4000Courses) {
    constraints.push({
      id: 'level-4000',
      label: `≥ ${cfg.minLevel4000Courses} courses at level-4000+`,
      short: 'L4000+',
      detail: `${level4000Count}/${cfg.minLevel4000Courses}`,
      fulfilled: level4000Count >= cfg.minLevel4000Courses,
    });
  }

  for (const rule of cfg.minPrefixCourses ?? []) {
    const count = matched.filter((m) => m.code.startsWith(rule.prefix)).length;
    constraints.push({
      id: `prefix-${rule.prefix}`,
      label: `≥ ${rule.minCourses} ${rule.prefix}-coded courses`,
      short: `${rule.prefix} ≥${rule.minCourses}`,
      detail: `${count}/${rule.minCourses}`,
      fulfilled: count >= rule.minCourses,
    });
  }

  constraints.push({
    id: 'total',
    label: `${cfg.totalUnits} units total`,
    short: 'Total',
    detail: `${totalUnits}/${cfg.totalUnits}u`,
    fulfilled: totalUnits >= cfg.totalUnits,
  });

  const categories: ElectiveCategoryStatus[] = cfg.categories.map((cat) => ({
    id: cat.id,
    label: cat.label,
    matched: cat.courses.filter((code) => byCode.has(code)),
  }));

  const specialisations: SpecialisationStatus[] = (cfg.specialisations ?? []).map((s) => {
    const specMatched = s.courses.filter((code) => byCode.has(code));
    const need = s.minCourses ?? s.courses.length;
    return { id: s.id, label: s.label, matched: specMatched, need, fulfilled: specMatched.length >= need };
  });

  return { totalUnits, targetUnits: cfg.totalUnits, matchedCourses, minCourses: cfg.minCourses, constraints, categories, specialisations };
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