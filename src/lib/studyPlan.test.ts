import { describe, it, expect } from 'vitest';
import type { Major, SecondaryProgramme, StudentSemester } from '@shared/types';
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
});

describe('courseLevel', () => {
  it('derives the thousand-level from a course code', () => {
    expect(courseLevel('CS4231')).toBe(4000);
    expect(courseLevel('CS2103T')).toBe(2000);
    expect(courseLevel('MA1521')).toBe(1000);
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

  it('waives 2 Making Connections electives and shifts 8 MC for a 6-month NOC', () => {
    const adjusted = applyNocAdjustment(major, '6-month');
    expect(adjusted.requirements[0].count).toBe(4);
    expect(adjusted.categories.find((c) => c.id === 'nus-college')?.mcTarget).toBe(44);
    expect(adjusted.categories.find((c) => c.id === 'unrestricted-electives')?.mcTarget).toBe(28);
  });

  it('waives 4 Making Connections electives and shifts 16 MC for a 1-year NOC', () => {
    const adjusted = applyNocAdjustment(major, '1-year');
    expect(adjusted.requirements[0].count).toBe(2);
    expect(adjusted.categories.find((c) => c.id === 'nus-college')?.mcTarget).toBe(36);
    expect(adjusted.categories.find((c) => c.id === 'unrestricted-electives')?.mcTarget).toBe(36);
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
});
