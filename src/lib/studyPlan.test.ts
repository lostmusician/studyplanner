import { describe, it, expect } from 'vitest';
import type { Major, PlacedModule, SecondaryProgramme, StudentSemester, WaivedModule } from '@shared/types';
import {
  matchesFulfiller,
  courseLevel,
  computeStats,
  computeRequirements,
  computeDoubleCount,
  computeTripleCountedCodes,
  computeFocusAreas,
  computeBreadthDepth,
  computeProgrammeElectives,
  applyNocAdjustment,
  autoCategoryId,
  createEmptySemesters,
  defaultPlanToSemesters,
  getPlanTemplateEntries,
  upsertModule,
  removeModule,
  isModuleLocked,
  renameModule,
  moveLinkedModules,
  getCompletedCodesUpTo,
  recategorizeModule,
  recategorizeWaivedModule,
} from './studyPlan';

interface FixtureModule {
  code: string;
  name: string;
  mcs: number;
  categoryId: string;
  year: number;
  sem: number;
}

const semesters = (modules: FixtureModule[]): StudentSemester[] => {
  const grid: StudentSemester[] = [1, 2, 3, 4].flatMap((year) => [1, 2].map((sem) => ({ year, sem, modules: [] })));
  for (const m of modules) {
    const target = grid.find((s) => s.year === m.year && s.sem === m.sem)!;
    target.modules.push({ code: m.code, name: m.name, mcs: m.mcs, categoryId: m.categoryId });
  }
  return grid;
};

describe('matchesFulfiller', () => {
  it('matches an exact code', () => {
    expect(matchesFulfiller('CS1101S', 'CS1101S')).toBe(true);
    expect(matchesFulfiller('CS1101', 'CS1101S')).toBe(false);
  });

  it('matches a prefix when the fulfiller ends in *', () => {
    expect(matchesFulfiller('NHS2001', 'NHS*')).toBe(true);
    expect(matchesFulfiller('NST2001', 'NHS*')).toBe(false);
  });

  it('matches any code when the fulfiller is bare "*" (empty-string prefix always matches)', () => {
    // slice(0, -1) on '*' gives '', and every string startsWith(''); an
    // unusual config, but the matcher shouldn't crash on it.
    expect(matchesFulfiller('CS1101S', '*')).toBe(true);
    expect(matchesFulfiller('', '*')).toBe(true);
  });
});

describe('courseLevel', () => {
  it('derives the thousand-level from a course code', () => {
    expect(courseLevel('CS4231')).toBe(4000);
    expect(courseLevel('CS2103T')).toBe(2000);
    expect(courseLevel('MA1521')).toBe(1000);
  });

  it('returns 0 for a malformed code with no digits, instead of throwing', () => {
    expect(courseLevel('ABC')).toBe(0);
  });
});

describe('computeStats', () => {
  it('sums MC per category and overall', () => {
    const major = { totalMcTarget: 160 } as Major;
    const sems = semesters([
      { code: 'CS1101S', name: 'Programming Methodology', mcs: 4, categoryId: 'cs-foundation', year: 1, sem: 1 },
      { code: 'MA1521', name: 'Calculus', mcs: 4, categoryId: 'math-sciences', year: 1, sem: 1 },
      { code: 'CS2030S', name: 'Programming Methodology II', mcs: 4, categoryId: 'cs-foundation', year: 1, sem: 2 },
    ]);
    const stats = computeStats(major, sems);
    expect(stats.totalMc).toBe(12);
    expect(stats.byCategory['cs-foundation']).toBe(8);
    expect(stats.byCategory['math-sciences']).toBe(4);
  });

  it('does not include waived modules in total MCs or category totals', () => {
    const major = { totalMcTarget: 160 } as Major;
    const sems = semesters([
      { code: 'CS1101S', name: 'Programming Methodology', mcs: 4, categoryId: 'cs-foundation', year: 1, sem: 1 },
    ]);
    const waived = [{ code: 'CS1010X', name: 'Programming Methodology', mcs: 4, categoryId: 'cs-foundation' }];
    const stats = computeStats(major, sems, waived);
    expect(stats.totalMc).toBe(4);
    expect(stats.byCategory['cs-foundation']).toBe(4);
  });
});

describe('computeRequirements', () => {
  const source = {
    requirements: [
      { name: 'Programming Methodology', fulfilledBy: ['CS1101S'] },
      { name: 'Making Connections', fulfilledBy: ['NHS*', 'NST*'], count: 2 },
    ],
  };

  it('marks a single-count requirement fulfilled once its code is placed', () => {
    const sems = semesters([{ code: 'CS1101S', name: 'x', mcs: 4, categoryId: 'soc-common', year: 1, sem: 1 }]);
    const [prog] = computeRequirements(source, sems);
    expect(prog.fulfilled).toBe(true);
    expect(prog.have).toBe(1);
    expect(prog.need).toBe(1);
  });

  it('requires `count` distinct matches for a multi-count requirement', () => {
    const sems = semesters([{ code: 'NHS2001', name: 'x', mcs: 4, categoryId: 'nus-college', year: 1, sem: 1 }]);
    const [, mce] = computeRequirements(source, sems);
    expect(mce.have).toBe(1);
    expect(mce.fulfilled).toBe(false);
  });

  it('does not grant MCE credit merely from selecting GEx', () => {
    const sems = semesters([]);
    const [, mce] = computeRequirements(source, sems, [], {}, 'gex');
    expect(mce.have).toBe(0);
    expect(mce.fulfilled).toBe(false);
  });

  it('counts only approved placed courses when SEP is selected', () => {
    const mceSource = {
      requirements: [
        {
          name: 'Making Connections',
          fulfilledBy: ['NHS*', 'NFB*', 'NST*', 'NFC*', 'NHT*'],
          count: 6,
          categoryId: 'nus-college',
        },
      ],
    };
    // Four actual courses remain four courses; selecting SEP does not add two more.
    const sems = semesters([
      { code: 'NHS2001', name: 'HSS 1', mcs: 4, categoryId: 'nus-college', year: 2, sem: 1 },
      { code: 'NFC2001', name: 'HSS 2', mcs: 4, categoryId: 'nus-college', year: 2, sem: 2 },
      { code: 'NST2001', name: 'ST 1', mcs: 4, categoryId: 'nus-college', year: 3, sem: 1 },
      { code: 'NFB2001', name: 'ST 2', mcs: 4, categoryId: 'nus-college', year: 3, sem: 2 },
    ]);
    const [mce] = computeRequirements(mceSource, sems, [], {}, 'sep');
    expect(mce.have).toBe(4);
    expect(mce.fulfilled).toBe(false);
    expect(mce.info).toBeUndefined();
  });

  it('fulfills the Global Pathways requirement when any special programme is declared', () => {
    const gpSource = {
      requirements: [
        {
          name: 'Global Pathways (NOC / SEP / GEx / Regional IEx / SIIP)',
          fulfilledBy: [],
          count: 1,
          categoryId: 'nus-college',
        },
      ],
    };
    const empty = semesters([]);
    const [unfulfilled] = computeRequirements(gpSource, empty, [], {}, null);
    expect(unfulfilled.fulfilled).toBe(false);
    expect(unfulfilled.info).toContain('Select a Global Pathway');

    const [sepFulfilled] = computeRequirements(gpSource, empty, [], {}, 'sep');
    expect(sepFulfilled.fulfilled).toBe(true);
    expect(sepFulfilled.have).toBe(1);

    const [nocFulfilled] = computeRequirements(gpSource, empty, [], {}, 'noc-6-month');
    expect(nocFulfilled.fulfilled).toBe(true);
  });

  it('recognizes NFB as HSS and NFC as ST without treating Creative as HSS', () => {
    const mceSource = {
      requirements: [
        {
          name: 'Making Connections',
          fulfilledBy: ['NHS*', 'NFB*', 'NST*', 'NFC*', 'NHT*'],
          count: 4,
          categoryId: 'nus-college',
        },
      ],
    };
    const sems = semesters([
      { code: 'NFC2001', name: 'HSS 1', mcs: 4, categoryId: 'nus-college', year: 2, sem: 1 },
      { code: 'NHT2001', name: 'HSS 2', mcs: 4, categoryId: 'nus-college', year: 2, sem: 2 },
      { code: 'NFB2001', name: 'ST 1', mcs: 4, categoryId: 'nus-college', year: 3, sem: 1 },
      { code: 'NST2001', name: 'ST 2', mcs: 4, categoryId: 'nus-college', year: 3, sem: 2 },
    ]);
    const [mce] = computeRequirements(mceSource, sems);
    expect(mce.fulfilled).toBe(false);
    expect(mce.info).toContain('1 HSS, 2 ST');
  });

  it('counts a manually mapped code only while it is actually placed', () => {
    const placed = semesters([{ code: 'CS2101', name: 'x', mcs: 4, categoryId: 'cs-foundation', year: 2, sem: 2 }]);
    const mappings = { 'Programming Methodology': ['CS2101'] };
    const [placedResult] = computeRequirements(source, placed, [], mappings);
    expect(placedResult.fulfilled).toBe(true);

    const empty = semesters([]);
    const [removedResult] = computeRequirements(source, empty, [], mappings);
    expect(removedResult.fulfilled).toBe(false);
  });

  it('is fulfilled via an altGroups alternative even without meeting fulfilledBy/count', () => {
    const withAlt = {
      requirements: [
        { name: 'Capstone', fulfilledBy: ['IFS4205'], altGroups: [['CS4238', 'IFS4103']] },
      ],
    };

    const onlyOneAltCode = semesters([{ code: 'CS4238', name: 'x', mcs: 4, categoryId: 'security-requirements', year: 4, sem: 1 }]);
    expect(computeRequirements(withAlt, onlyOneAltCode)[0].fulfilled).toBe(false);

    const bothAltCodes = semesters([
      { code: 'CS4238', name: 'x', mcs: 4, categoryId: 'security-requirements', year: 4, sem: 1 },
      { code: 'IFS4103', name: 'y', mcs: 4, categoryId: 'security-requirements', year: 4, sem: 1 },
    ]);
    expect(computeRequirements(withAlt, bothAltCodes)[0].fulfilled).toBe(true);

    const primaryCode = semesters([{ code: 'IFS4205', name: 'z', mcs: 8, categoryId: 'security-requirements', year: 4, sem: 1 }]);
    expect(computeRequirements(withAlt, primaryCode)[0].fulfilled).toBe(true);
  });
});

describe('computeDoubleCount', () => {
  const secondary: SecondaryProgramme = {
    id: 'statistics',
    label: 'Statistics',
    kind: 'minor',
    mcTarget: 20,
    requirements: [{ name: 'Probability', fulfilledBy: ['ST2334'] }],
    moduleCatalog: {},
  };

  it('stays under cap when double-counted MC is below mcTarget * 0.4', () => {
    const sems = semesters([{ code: 'ST2334', name: 'x', mcs: 4, categoryId: 'math-sciences', year: 2, sem: 1 }]);
    const result = computeDoubleCount(secondary, sems);
    expect(result.doubleCountMc).toBe(4);
    expect(result.capMc).toBe(8);
    expect(result.warn).toBe(false);
  });

  it('warns once double-counted MC exceeds the cap', () => {
    const sems = semesters([
      { code: 'ST2334', name: 'x', mcs: 4, categoryId: 'math-sciences', year: 2, sem: 1 },
      { code: 'ST2334B', name: 'y', mcs: 8, categoryId: 'math-sciences', year: 2, sem: 2 },
    ]);
    const wideSecondary: SecondaryProgramme = {
      ...secondary,
      requirements: [{ name: 'Probability', fulfilledBy: ['ST2334', 'ST2334B'] }],
    };
    const result = computeDoubleCount(wideSecondary, sems);
    expect(result.doubleCountMc).toBe(12);
    expect(result.warn).toBe(true);
  });

  it('does not treat modules under unrestricted-electives as double-counted against the primary major', () => {
    const sems = semesters([
      { code: 'ST2334', name: 'x', mcs: 4, categoryId: 'unrestricted-electives', year: 2, sem: 1 },
    ]);
    const result = computeDoubleCount(secondary, sems);
    expect(result.doubleCountMc).toBe(0);
    expect(result.doubleCountedCodes).toEqual([]);
    expect(result.warn).toBe(false);
  });

  it('returns the zero baseline for an empty plan (nothing placed, nothing waived)', () => {
    const result = computeDoubleCount(secondary, semesters([]));
    expect(result.doubleCountMc).toBe(0);
    expect(result.warn).toBe(false);
    expect(result.doubleCountedCodes).toEqual([]);
  });
});

describe('computeTripleCountedCodes', () => {
  const secondA: SecondaryProgramme = {
    id: 'a', label: 'A', kind: 'second-major', mcTarget: 40,
    requirements: [{ name: 'Req A', fulfilledBy: ['MA2001'] }], moduleCatalog: {},
  };

  it('flags a code that satisfies two or more declared secondary programmes', () => {
    const secondB: SecondaryProgramme = {
      id: 'b', label: 'B', kind: 'minor', mcTarget: 20,
      requirements: [{ name: 'Req B', fulfilledBy: ['MA2001'] }], moduleCatalog: {},
    };
    const sems = semesters([{ code: 'MA2001', name: 'x', mcs: 4, categoryId: 'math-sciences', year: 2, sem: 1 }]);
    expect(computeTripleCountedCodes([secondA, secondB], sems)).toEqual(['MA2001']);
  });

  it('does not flag a code that only satisfies one secondary programme', () => {
    const secondB: SecondaryProgramme = {
      id: 'b', label: 'B', kind: 'minor', mcTarget: 20,
      requirements: [{ name: 'Req B', fulfilledBy: ['ST2334'] }], moduleCatalog: {},
    };
    const sems = semesters([{ code: 'MA2001', name: 'x', mcs: 4, categoryId: 'math-sciences', year: 2, sem: 1 }]);
    expect(computeTripleCountedCodes([secondA, secondB], sems)).toEqual([]);
  });
});

describe('computeFocusAreas', () => {
  const major: Major = {
    id: 'cs', label: 'CS', school: 'SoC', batches: [], totalMcTarget: 160,
    categories: [], requirements: [], moduleCatalog: {}, defaultPlan: [],
    focusAreas: [
      { id: 'ai', label: 'Artificial Intelligence', primaries: ['CS3243', 'CS3244', 'CS4246', 'CS4248'], minCourses: 3, minSeniorCourses: 1 },
    ],
  };

  it('is not fulfilled below the required primary count', () => {
    const sems = semesters([
      { code: 'CS3243', name: 'x', mcs: 4, categoryId: 'breadth-depth', year: 3, sem: 1 },
      { code: 'CS3244', name: 'x', mcs: 4, categoryId: 'breadth-depth', year: 3, sem: 2 },
    ]);
    const { areas, anyFulfilled } = computeFocusAreas(major, sems);
    expect(areas[0].matched.length).toBe(2);
    expect(anyFulfilled).toBe(false);
  });

  it('is fulfilled once enough primaries are matched, including one at level-4000+', () => {
    const sems = semesters([
      { code: 'CS3243', name: 'x', mcs: 4, categoryId: 'breadth-depth', year: 3, sem: 1 },
      { code: 'CS3244', name: 'x', mcs: 4, categoryId: 'breadth-depth', year: 3, sem: 2 },
      { code: 'CS4246', name: 'x', mcs: 4, categoryId: 'breadth-depth', year: 4, sem: 1 },
    ]);
    const { anyFulfilled } = computeFocusAreas(major, sems);
    expect(anyFulfilled).toBe(true);
  });

  it('counts a focus-area primary satisfied via waivedModules, not just placed semesters', () => {
    const sems = semesters([
      { code: 'CS3243', name: 'x', mcs: 4, categoryId: 'breadth-depth', year: 3, sem: 1 },
      { code: 'CS3244', name: 'x', mcs: 4, categoryId: 'breadth-depth', year: 3, sem: 2 },
    ]);
    const waived: WaivedModule[] = [{ code: 'CS4246', name: 'Neuro', mcs: 4, categoryId: 'breadth-depth' }];
    const { areas, anyFulfilled } = computeFocusAreas(major, sems, waived);
    expect(areas[0].matched).toContain('CS4246');
    expect(anyFulfilled).toBe(true);
  });
});

describe('computeBreadthDepth', () => {
  const major: Major = {
    id: 'cs', label: 'CS', school: 'SoC', batches: [], totalMcTarget: 160,
    categories: [], requirements: [], moduleCatalog: {}, defaultPlan: [],
    breadthDepth: {
      categoryId: 'breadth-depth',
      totalUnits: 32,
      minLevel4000Units: 12,
      industryExperience: { minUnits: 6, maxUnits: 12, courses: ['CP3880'] },
      allowedPrefixes: ['CS', 'IFS', 'CP'],
      maxCpUnits: 12,
      cpPrefix: 'CP',
    },
  };

  it('returns null when the major has no breadthDepth config', () => {
    expect(computeBreadthDepth({ ...major, breadthDepth: undefined }, [])).toBeNull();
  });

  it('flags a coding-restriction violation for a non-allowed prefix', () => {
    const sems = semesters([{ code: 'GEA1000N', name: 'x', mcs: 4, categoryId: 'breadth-depth', year: 3, sem: 1 }]);
    const result = computeBreadthDepth(major, sems);
    expect(result?.codingViolations).toEqual(['GEA1000N']);
  });

  it('flags the cp-cap constraint once CP-prefixed units exceed the max', () => {
    const sems = semesters([
      { code: 'CP3200', name: 'x', mcs: 8, categoryId: 'breadth-depth', year: 3, sem: 1 },
      { code: 'CP3202', name: 'y', mcs: 8, categoryId: 'breadth-depth', year: 3, sem: 2 },
    ]);
    const result = computeBreadthDepth(major, sems);
    const cpConstraint = result?.constraints.find((c) => c.id === 'cp-cap');
    expect(cpConstraint?.warn).toBe(true);
  });

  it('uses a technical-electives constraint instead of focus-area when the major has no focusAreas', () => {
    const aiMajor: Major = {
      ...major,
      id: 'ai',
      focusAreas: undefined,
      breadthDepth: {
        ...major.breadthDepth!,
        totalUnits: 20,
        technicalElectives: { minUnits: 12, courses: ['CS4246'] },
      },
    };

    const empty = computeBreadthDepth(aiMajor, []);
    expect(empty?.constraints.find((c) => c.id === 'focus-area')).toBeUndefined();
    expect(empty?.constraints.find((c) => c.id === 'technical-electives')?.fulfilled).toBe(false);

    const sems = semesters([{ code: 'CS4246', name: 'x', mcs: 12, categoryId: 'breadth-depth', year: 3, sem: 1 }]);
    const met = computeBreadthDepth(aiMajor, sems);
    expect(met?.constraints.find((c) => c.id === 'technical-electives')?.fulfilled).toBe(true);
  });

  it('has neither a focus-area nor a technical-electives constraint when the major configures neither mechanism', () => {
    // `major` here has no `focusAreas` and its `breadthDepth` has no `technicalElectives` —
    // a real, if unusual, config state that should degrade to "no depth-mechanism
    // constraint" rather than crashing or defaulting to one incorrectly.
    const result = computeBreadthDepth(major, []);
    expect(result?.constraints.find((c) => c.id === 'focus-area')).toBeUndefined();
    expect(result?.constraints.find((c) => c.id === 'technical-electives')).toBeUndefined();
    expect(result?.constraints.map((c) => c.id)).toEqual([
      'level-4000',
      'industry-experience',
      'coding',
      'cp-cap',
      'total',
    ]);
  });
});

describe('autoCategoryId', () => {
  const major: Major = {
    id: 'cs', label: 'CS', school: 'SoC', batches: [], totalMcTarget: 160,
    categories: [
      { id: 'cs-foundation', label: 'CS Foundation', color: '#fff' },
      { id: 'math-sciences', label: 'Math & Sciences', color: '#fff' },
      { id: 'unrestricted-electives', label: 'Unrestricted Electives', color: '#fff' },
    ],
    requirements: [],
    moduleCatalog: {},
    defaultPlan: [{ year: 1, sem: 1, moduleCode: 'CS1101S', categoryId: 'cs-foundation' }],
  };

  it('prefers the default-plan category for a fixed course', () => {
    expect(autoCategoryId(major, 'CS1101S')).toBe('cs-foundation');
  });

  it('falls back to math-sciences by prefix', () => {
    expect(autoCategoryId(major, 'MA1521')).toBe('math-sciences');
  });

  it('falls back to unrestricted electives for anything else', () => {
    expect(autoCategoryId(major, 'GET1234')).toBe('unrestricted-electives');
  });

  it('routes a programme-electives course to its configured category', () => {
    const withPe: Major = {
      ...major,
      categories: [...major.categories, { id: 'ba-electives', label: 'Programme Electives', color: '#fff' }],
      programmeElectives: {
        categoryId: 'ba-electives',
        totalUnits: 20,
        minCourses: 5,
        categories: [{ id: 'analytics-methods', label: 'Analytics Methods', courses: ['BT4221'] }],
      },
    };
    expect(autoCategoryId(withPe, 'BT4221')).toBe('ba-electives');
  });
});

describe('computeProgrammeElectives', () => {
  const major: Major = {
    id: 'ba', label: 'Business Analytics', school: 'SoC', batches: [], totalMcTarget: 160,
    categories: [], requirements: [], moduleCatalog: {}, defaultPlan: [],
    programmeElectives: {
      categoryId: 'ba-electives',
      totalUnits: 20,
      minCourses: 5,
      minLevel4000Courses: 3,
      minPrefixCourses: [{ prefix: 'BT', minCourses: 3 }],
      categories: [
        { id: 'business-applications', label: 'Business Applications', courses: ['BT4013', 'BT4016'] },
        { id: 'analytics-methods', label: 'Analytics Methods', courses: ['BT4221', 'CS3244', 'CS4248'] },
      ],
      specialisations: [
        { id: 'financial-analytics', label: 'Financial Analytics', courses: ['BT4013', 'BT4221'], minCourses: 2 },
      ],
    },
  };

  it('returns null when the major has no programmeElectives config', () => {
    expect(computeProgrammeElectives({ ...major, programmeElectives: undefined }, [])).toBeNull();
  });

  it('is not fulfilled below the required course count', () => {
    const sems = semesters([
      { code: 'BT4013', name: 'x', mcs: 4, categoryId: 'ba-electives', year: 3, sem: 1 },
      { code: 'BT4221', name: 'y', mcs: 4, categoryId: 'ba-electives', year: 3, sem: 2 },
    ]);
    const result = computeProgrammeElectives(major, sems);
    expect(result?.constraints.find((c) => c.id === 'course-count')?.fulfilled).toBe(false);
  });

  it('flags the BT-prefix constraint once enough BT-coded courses are placed', () => {
    const sems = semesters([
      { code: 'BT4013', name: 'a', mcs: 4, categoryId: 'ba-electives', year: 3, sem: 1 },
      { code: 'BT4016', name: 'b', mcs: 4, categoryId: 'ba-electives', year: 3, sem: 1 },
      { code: 'BT4221', name: 'c', mcs: 4, categoryId: 'ba-electives', year: 3, sem: 2 },
      { code: 'CS3244', name: 'd', mcs: 4, categoryId: 'ba-electives', year: 3, sem: 2 },
      { code: 'CS4248', name: 'e', mcs: 4, categoryId: 'ba-electives', year: 4, sem: 1 },
    ]);
    const result = computeProgrammeElectives(major, sems);
    expect(result?.constraints.find((c) => c.id === 'prefix-BT')?.fulfilled).toBe(true);
    expect(result?.constraints.find((c) => c.id === 'course-count')?.fulfilled).toBe(true);
  });

  it('tracks specialisation progress independently of the hard requirement', () => {
    const sems = semesters([
      { code: 'BT4013', name: 'a', mcs: 4, categoryId: 'ba-electives', year: 3, sem: 1 },
      { code: 'BT4221', name: 'b', mcs: 4, categoryId: 'ba-electives', year: 3, sem: 2 },
    ]);
    const result = computeProgrammeElectives(major, sems);
    expect(result?.specialisations[0].fulfilled).toBe(true);
  });

  it('defaults specialisations to [] when the config omits the field entirely, rather than crashing', () => {
    const noSpecialisations: Major = {
      ...major,
      programmeElectives: { ...major.programmeElectives!, specialisations: undefined },
    };
    const result = computeProgrammeElectives(noSpecialisations, []);
    expect(result?.specialisations).toEqual([]);
  });
});

describe('applyNocAdjustment', () => {
  const major: Major = {
    id: 'cs', label: 'CS', school: 'SoC', batches: [], totalMcTarget: 160,
    categories: [
      { id: 'nus-college', label: 'NUS College', mcTarget: 52, color: '#fff' },
      { id: 'unrestricted-electives', label: 'Unrestricted Electives', mcTarget: 20, color: '#fff' },
    ],
    requirements: [
      { name: 'Making Connections', fulfilledBy: ['NHS*'], count: 6, categoryId: 'nus-college' },
    ],
    moduleCatalog: {},
    defaultPlan: [],
  };

  it('returns the major unchanged when no duration is declared', () => {
    expect(applyNocAdjustment(major, null)).toBe(major);
    expect(applyNocAdjustment(major, undefined)).toBe(major);
  });

  it('waives 2 Making Connections electives without altering faculty targets for a 6-month NOC', () => {
    const adjusted = applyNocAdjustment(major, '6-month');
    expect(adjusted.requirements[0].count).toBe(4);
    expect(adjusted.categories.find((c) => c.id === 'nus-college')?.mcTarget).toBe(44);
    expect(adjusted.categories.find((c) => c.id === 'noc')).toBeUndefined();
  });

  it('waives 4 Making Connections electives without altering faculty targets for a 1-year NOC', () => {
    const adjusted = applyNocAdjustment(major, '1-year');
    expect(adjusted.requirements[0].count).toBe(2);
    expect(adjusted.categories.find((c) => c.id === 'nus-college')?.mcTarget).toBe(36);
    expect(adjusted.categories.find((c) => c.id === 'noc')).toBeUndefined();
  });

  it('never touches soc-common (NOC waives NUSC requirements only)', () => {
    const withSocCommon: Major = {
      ...major,
      categories: [...major.categories, { id: 'soc-common', label: 'SoC Common', mcTarget: 8, color: '#fff' }],
    };
    const adjusted = applyNocAdjustment(withSocCommon, '1-year');
    expect(adjusted.categories.find((c) => c.id === 'soc-common')?.mcTarget).toBe(8);
  });

  it('returns the major unchanged when it has no nus-college category', () => {
    const noNusCollege: Major = { ...major, categories: [], requirements: [] };
    expect(applyNocAdjustment(noNusCollege, '1-year')).toBe(noNusCollege);
  });

  it('keeps categories unchanged when there is no UE category to redistribute to', () => {
    const noUnrestricted: Major = {
      ...major,
      categories: major.categories.filter((c) => c.id !== 'unrestricted-electives'),
    };
    const adjusted = applyNocAdjustment(noUnrestricted, '6-month');
    expect(adjusted.categories.find((c) => c.id === 'nus-college')?.mcTarget).toBe(44);
    expect(adjusted.categories.find((c) => c.id === 'unrestricted-electives')).toBeUndefined();
    expect(adjusted.categories.find((c) => c.id === 'noc')).toBeUndefined();
    expect(adjusted.categories).toHaveLength(1);
  });
});

describe('createEmptySemesters', () => {
  it('returns all 8 year/sem combinations for years 1-4, in UI-rendering order, each with an empty modules array', () => {
    const result = createEmptySemesters();
    expect(result.map((s) => [s.year, s.sem])).toEqual([
      [1, 1], [1, 2],
      [2, 1], [2, 2],
      [3, 1], [3, 2],
      [4, 1], [4, 2],
    ]);
    expect(result.every((s) => s.modules.length === 0)).toBe(true);
  });
});

describe('defaultPlanToSemesters', () => {
  const major: Major = {
    id: 'cs', label: 'CS', school: 'SoC', batches: [], totalMcTarget: 160,
    categories: [], requirements: [],
    moduleCatalog: {
      CS1101S: { code: 'CS1101S', name: 'Programming Methodology', mcs: 4 },
      MA1521: { code: 'MA1521', name: 'Calculus', mcs: 4 },
      CS2030S: { code: 'CS2030S', name: 'Programming Methodology II', mcs: 4 },
    },
    defaultPlan: [
      { year: 1, sem: 1, moduleCode: 'CS1101S', categoryId: 'cs-foundation' },
      { year: 1, sem: 1, moduleCode: 'MA1521', categoryId: 'math-sciences' },
      // Typo'd/removed code, not in moduleCatalog — should degrade gracefully.
      { year: 1, sem: 1, moduleCode: 'CS9999X', categoryId: 'cs-foundation' },
      { year: 1, sem: 2, moduleCode: 'CS2030S', categoryId: 'cs-foundation' },
    ],
  };

  it("places a defaultPlan entry's module into its matching {year, sem} semester, tagged with the entry's categoryId", () => {
    const sems = defaultPlanToSemesters(major);
    const y1s2 = sems.find((s) => s.year === 1 && s.sem === 2)!;
    expect(y1s2.modules).toEqual([
      { code: 'CS2030S', name: 'Programming Methodology II', mcs: 4, categoryId: 'cs-foundation' },
    ]);
  });

  it('silently skips a defaultPlan entry whose moduleCode is not in moduleCatalog, instead of crashing', () => {
    const sems = defaultPlanToSemesters(major);
    const allCodes = sems.flatMap((s) => s.modules.map((m) => m.code));
    expect(allCodes).not.toContain('CS9999X');
  });

  it('places multiple defaultPlan entries targeting the same {year, sem}, not just the last one', () => {
    const sems = defaultPlanToSemesters(major);
    const y1s1 = sems.find((s) => s.year === 1 && s.sem === 1)!;
    expect(y1s1.modules.map((m) => m.code)).toEqual(['CS1101S', 'MA1521']);
  });

  it('with lockedOnly: true, places only entries marked locked', () => {
    const major: Major = {
      id: 'cs', label: 'CS', school: 'SoC', batches: [], totalMcTarget: 160,
      categories: [], requirements: [],
      moduleCatalog: {
        CS1101S: { code: 'CS1101S', name: 'Programming Methodology', mcs: 4 },
        NEP2001A: { code: 'NEP2001A', name: 'Impact Experience Project', mcs: 2 },
      },
      defaultPlan: [
        { year: 1, sem: 1, moduleCode: 'CS1101S', categoryId: 'soc-common' },
        { year: 1, sem: 2, moduleCode: 'NEP2001A', categoryId: 'nus-college', locked: true },
      ],
    };
    const result = defaultPlanToSemesters(major, { lockedOnly: true });
    const allCodes = result.flatMap((s) => s.modules.map((m) => m.code));
    expect(allCodes).toEqual(['NEP2001A']);
  });

  it('generates poly-balanced plan omitting generic UE modules', () => {
    const major: Major = {
      id: 'computer-science-nusc', label: 'CS NUSC', school: 'SoC', batches: [], totalMcTarget: 160,
      categories: [{ id: 'cs-foundation', label: 'CS Foundation', color: '#000' }, { id: 'unrestricted-electives', label: 'UE', color: '#fff' }],
      requirements: [],
      moduleCatalog: {
        CS1101S: { code: 'CS1101S', name: 'Programming', mcs: 4 },
        GEN2001: { code: 'GEN2001', name: 'UE I', mcs: 4 },
      },
      defaultPlan: [
        { year: 1, sem: 1, moduleCode: 'CS1101S', categoryId: 'cs-foundation' },
        { year: 3, sem: 2, moduleCode: 'GEN2001', categoryId: 'unrestricted-electives' },
      ],
    };
    const entries = getPlanTemplateEntries(major, 'poly-balanced');
    expect(entries.some((e) => e.moduleCode === 'GEN2001')).toBe(false);
    expect(entries.some((e) => e.moduleCode === 'CS1101S')).toBe(true);
  });

  it('generates poly-accelerated plan leaving Year 4 Semester 2 free', () => {
    const major: Major = {
      id: 'computer-science-nusc', label: 'CS NUSC', school: 'SoC', batches: [], totalMcTarget: 160,
      categories: [], requirements: [],
      moduleCatalog: {
        CS1101S: { code: 'CS1101S', name: 'Programming', mcs: 4 },
        NHS2030: { code: 'NHS2030', name: 'NHS Course', mcs: 4 },
        NST2015: { code: 'NST2015', name: 'NST Course', mcs: 4 },
      },
      defaultPlan: [
        { year: 1, sem: 1, moduleCode: 'CS1101S', categoryId: 'cs-foundation' },
        { year: 4, sem: 2, moduleCode: 'NHS2030', categoryId: 'nus-college' },
        { year: 4, sem: 2, moduleCode: 'NST2015', categoryId: 'nus-college' },
      ],
    };
    const sems = defaultPlanToSemesters(major, { template: 'poly-accelerated' });
    const y4s2 = sems.find((s) => s.year === 4 && s.sem === 2)!;
    const y4s1 = sems.find((s) => s.year === 4 && s.sem === 1)!;
    expect(y4s2.modules).toHaveLength(0);
    expect(y4s1.modules.map((m) => m.code)).toEqual(['NHS2030', 'NST2015']);
  });
});

describe('upsertModule', () => {
  const mod = (code: string): PlacedModule => ({ code, name: code, mcs: 4, categoryId: 'cs-foundation' });

  it('adds a brand-new module to an empty semester', () => {
    const empty = createEmptySemesters();
    const result = upsertModule(empty, 1, 1, mod('CS1101S'));
    const y1s1 = result.find((s) => s.year === 1 && s.sem === 1)!;
    expect(y1s1.modules.map((m) => m.code)).toEqual(['CS1101S']);
  });

  it('moving an existing module to a different {year, sem} removes it from the old semester and adds it to the new one, never placed twice', () => {
    const sems = semesters([{ code: 'CS1101S', name: 'x', mcs: 4, categoryId: 'cs-foundation', year: 1, sem: 1 }]);
    const result = upsertModule(sems, 1, 2, mod('CS1101S'));
    const y1s1 = result.find((s) => s.year === 1 && s.sem === 1)!;
    const y1s2 = result.find((s) => s.year === 1 && s.sem === 2)!;
    expect(y1s1.modules).toEqual([]);
    expect(y1s2.modules.map((m) => m.code)).toEqual(['CS1101S']);
    expect(result.flatMap((s) => s.modules).filter((m) => m.code === 'CS1101S')).toHaveLength(1);
  });

  it('insertBeforeCode inserts the module at that position rather than appending it', () => {
    const sems = semesters([
      { code: 'CS1101S', name: 'x', mcs: 4, categoryId: 'cs-foundation', year: 1, sem: 1 },
      { code: 'MA1521', name: 'y', mcs: 4, categoryId: 'math-sciences', year: 1, sem: 1 },
    ]);
    const result = upsertModule(sems, 1, 1, mod('CS2030S'), 'MA1521');
    const y1s1 = result.find((s) => s.year === 1 && s.sem === 1)!;
    expect(y1s1.modules.map((m) => m.code)).toEqual(['CS1101S', 'CS2030S', 'MA1521']);
  });

  it('falls back to appending at the end when insertBeforeCode is not found in the target semester', () => {
    const sems = semesters([{ code: 'CS1101S', name: 'x', mcs: 4, categoryId: 'cs-foundation', year: 1, sem: 1 }]);
    const result = upsertModule(sems, 1, 1, mod('MA1521'), 'NONEXISTENT');
    const y1s1 = result.find((s) => s.year === 1 && s.sem === 1)!;
    expect(y1s1.modules.map((m) => m.code)).toEqual(['CS1101S', 'MA1521']);
  });

  it('re-adding the same module code to the same semester it is already in is a no-op (no duplicate)', () => {
    const sems = semesters([{ code: 'CS1101S', name: 'x', mcs: 4, categoryId: 'cs-foundation', year: 1, sem: 1 }]);
    const result = upsertModule(sems, 1, 1, mod('CS1101S'));
    const y1s1 = result.find((s) => s.year === 1 && s.sem === 1)!;
    expect(y1s1.modules.map((m) => m.code)).toEqual(['CS1101S']);
  });
});

describe('removeModule', () => {
  it('with no target argument, removes the module from every semester it appears in (defensive full-plan sweep)', () => {
    // Shouldn't happen via the normal UI, but the function doesn't assume uniqueness.
    const sems = semesters([
      { code: 'CS1101S', name: 'x', mcs: 4, categoryId: 'cs-foundation', year: 1, sem: 1 },
      { code: 'CS1101S', name: 'x', mcs: 4, categoryId: 'cs-foundation', year: 2, sem: 1 },
    ]);
    const result = removeModule(sems, 'CS1101S');
    expect(result.flatMap((s) => s.modules).some((m) => m.code === 'CS1101S')).toBe(false);
  });

  it('with a target argument, removes the module only from that specific semester, leaving other copies untouched', () => {
    const sems = semesters([
      { code: 'CS1101S', name: 'x', mcs: 4, categoryId: 'cs-foundation', year: 1, sem: 1 },
      { code: 'CS1101S', name: 'x', mcs: 4, categoryId: 'cs-foundation', year: 2, sem: 1 },
    ]);
    const result = removeModule(sems, 'CS1101S', { year: 1, sem: 1 });
    const y1s1 = result.find((s) => s.year === 1 && s.sem === 1)!;
    const y2s1 = result.find((s) => s.year === 2 && s.sem === 1)!;
    expect(y1s1.modules).toEqual([]);
    expect(y2s1.modules.map((m) => m.code)).toEqual(['CS1101S']);
  });

  it('removing a code that is not placed anywhere is a no-op', () => {
    const sems = semesters([{ code: 'CS1101S', name: 'x', mcs: 4, categoryId: 'cs-foundation', year: 1, sem: 1 }]);
    const result = removeModule(sems, 'MA1521');
    expect(result).toEqual(sems);
  });
});

describe('isModuleLocked', () => {
  const major: Major = {
    id: 'cs', label: 'CS', school: 'SoC', batches: [], totalMcTarget: 160,
    categories: [], requirements: [], moduleCatalog: {},
    defaultPlan: [
      { year: 1, sem: 1, moduleCode: 'CS1101S', categoryId: 'cs-foundation', locked: true },
      { year: 1, sem: 2, moduleCode: 'CS2030S', categoryId: 'cs-foundation' },
    ],
  };

  it("is true for a code whose defaultPlan entry has locked: true", () => {
    expect(isModuleLocked(major, 'CS1101S')).toBe(true);
  });

  it('is false for a code present in defaultPlan but without locked set', () => {
    expect(isModuleLocked(major, 'CS2030S')).toBe(false);
  });

  it('is false for a code not present in defaultPlan at all', () => {
    expect(isModuleLocked(major, 'MA1521')).toBe(false);
  });
});

describe('renameModule', () => {
  it("updates a module's code/name/mcs/categoryId in place, wherever it is currently placed", () => {
    const sems = semesters([{ code: 'CS1101S', name: 'old name', mcs: 4, categoryId: 'cs-foundation', year: 1, sem: 1 }]);
    const result = renameModule(sems, 'CS1101S', {
      code: 'CS1101', name: 'new name', mcs: 5, categoryId: 'math-sciences',
    });
    const y1s1 = result.find((s) => s.year === 1 && s.sem === 1)!;
    expect(y1s1.modules).toEqual([{ code: 'CS1101', name: 'new name', mcs: 5, categoryId: 'math-sciences' }]);
  });

  it('is a no-op (no crash, no phantom insertion) for a module code that is not currently placed anywhere', () => {
    const sems = semesters([{ code: 'CS1101S', name: 'x', mcs: 4, categoryId: 'cs-foundation', year: 1, sem: 1 }]);
    const result = renameModule(sems, 'MA1521', { code: 'MA1521B', name: 'y', mcs: 4, categoryId: 'math-sciences' });
    expect(result).toEqual(sems);
  });
});

describe('moveLinkedModules', () => {
  const major: Major = {
    id: 'cs', label: 'CS', school: 'SoC', batches: [], totalMcTarget: 160,
    categories: [], requirements: [], moduleCatalog: {}, defaultPlan: [],
    sameSemesterGroups: [['CS2101', 'CS2103T']],
  };

  it('moves a same-semester linked pair together when either module is relocated', () => {
    const sems = semesters([
      { code: 'CS2101', name: 'x', mcs: 4, categoryId: 'cs-foundation', year: 2, sem: 1 },
      { code: 'CS2103T', name: 'y', mcs: 4, categoryId: 'cs-foundation', year: 2, sem: 2 },
    ]);

    const result = moveLinkedModules(major, sems, 3, 1, { code: 'CS2101', name: 'x', mcs: 4, categoryId: 'cs-foundation' });
    const y2s1 = result.find((s) => s.year === 2 && s.sem === 1)!;
    const y2s2 = result.find((s) => s.year === 2 && s.sem === 2)!;
    const y3s1 = result.find((s) => s.year === 3 && s.sem === 1)!;

    expect(y2s1.modules).toEqual([]);
    expect(y2s2.modules).toEqual([]);
    expect(y3s1.modules.map((m) => m.code)).toEqual(['CS2101', 'CS2103T']);
  });
});

describe('recategorizeModule', () => {
  // Regression test for a real reported bug: a CS student maps CS1010 (not a
  // recognized CS-NUSC code, so autoCategoryId falls back to Unrestricted
  // Electives on first add) to satisfy "Programming Methodology (CS1101S)" via
  // the manual requirement-mapping picker. Without recategorization, CS1010
  // stayed tagged Unrestricted Electives forever — its MC counted toward the
  // wrong category bar even though the SoC Common Curriculum requirement
  // checklist showed it fulfilled.
  it('moves a module into a new category wherever it is currently placed', () => {
    const sems = semesters([{ code: 'CS1010', name: 'Programming Methodology', mcs: 4, categoryId: 'unrestricted-electives', year: 1, sem: 1 }]);
    const result = recategorizeModule(sems, 'CS1010', 'soc-common');
    const y1s1 = result.find((s) => s.year === 1 && s.sem === 1)!;
    expect(y1s1.modules).toEqual([{ code: 'CS1010', name: 'Programming Methodology', mcs: 4, categoryId: 'soc-common' }]);
  });

  it('only changes categoryId, leaving code/name/mcs untouched', () => {
    const sems = semesters([{ code: 'CS1010', name: 'Programming Methodology', mcs: 4, categoryId: 'unrestricted-electives', year: 1, sem: 1 }]);
    const [module] = recategorizeModule(sems, 'CS1010', 'soc-common').find((s) => s.year === 1 && s.sem === 1)!.modules;
    expect(module.code).toBe('CS1010');
    expect(module.name).toBe('Programming Methodology');
    expect(module.mcs).toBe(4);
  });

  it('is a no-op for a module code that is not currently placed anywhere', () => {
    const sems = semesters([{ code: 'CS1101S', name: 'x', mcs: 4, categoryId: 'cs-foundation', year: 1, sem: 1 }]);
    expect(recategorizeModule(sems, 'MA1521', 'math-sciences')).toEqual(sems);
  });

  it('leaves every other placed module untouched', () => {
    const sems = semesters([
      { code: 'CS1010', name: 'x', mcs: 4, categoryId: 'unrestricted-electives', year: 1, sem: 1 },
      { code: 'MA1521', name: 'y', mcs: 4, categoryId: 'math-sciences', year: 1, sem: 1 },
    ]);
    const result = recategorizeModule(sems, 'CS1010', 'soc-common');
    const y1s1 = result.find((s) => s.year === 1 && s.sem === 1)!;
    expect(y1s1.modules.find((m) => m.code === 'MA1521')?.categoryId).toBe('math-sciences');
  });
});

describe('recategorizeWaivedModule', () => {
  const waived: WaivedModule[] = [
    { code: 'CS1010', name: 'Programming Methodology', mcs: 4, categoryId: 'unrestricted-electives' },
  ];

  it('moves a waived module into a new category', () => {
    const result = recategorizeWaivedModule(waived, 'CS1010', 'soc-common');
    expect(result).toEqual([{ code: 'CS1010', name: 'Programming Methodology', mcs: 4, categoryId: 'soc-common' }]);
  });

  it('is a no-op for a code not present in the waived list', () => {
    expect(recategorizeWaivedModule(waived, 'MA1521', 'math-sciences')).toEqual(waived);
  });
});

describe('getCompletedCodesUpTo', () => {
  it('excludes a module placed in the target {year, sem} itself — only strictly earlier terms count as completed', () => {
    const sems = semesters([{ code: 'CS1101S', name: 'x', mcs: 4, categoryId: 'cs-foundation', year: 2, sem: 1 }]);
    expect(getCompletedCodesUpTo(sems, 2, 1)).toEqual([]);
  });

  it('treats an earlier year with a later sem (Y1S2) as before a later year with an earlier sem (Y2S1)', () => {
    // A naive `s.year <= year && s.sem < sem` implementation would wrongly exclude
    // this: sem(2) < sem(1) is false, even though Y1S2 is chronologically earlier.
    const sems = semesters([{ code: 'CS1101S', name: 'x', mcs: 4, categoryId: 'cs-foundation', year: 1, sem: 2 }]);
    expect(getCompletedCodesUpTo(sems, 2, 1)).toEqual(['CS1101S']);
  });

  it('treats the same year with an earlier sem (Y2S1) as before a later sem in the same year (Y2S2)', () => {
    const sems = semesters([{ code: 'CS1101S', name: 'x', mcs: 4, categoryId: 'cs-foundation', year: 2, sem: 1 }]);
    expect(getCompletedCodesUpTo(sems, 2, 2)).toEqual(['CS1101S']);
  });
});
