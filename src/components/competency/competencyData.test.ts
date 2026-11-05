import { describe, expect, it } from 'vitest';
import type { Major, PlacedModule, StudentSemester, WaivedModule } from '@shared/types';
import {
  buildSemesterTimeline,
  computeGraphLineage,
  extractGraphNodesAndLinks,
  extractRiverData,
  getDiscipline,
  getKnownPrerequisites,
  getKnownUnlocks,
  hexToRgba,
  KNOWN_PREREQUISITES,
} from './competencyData';
import type { CompetencyGraph } from './competencyTypes';

const module = (code: string, name: string, mcs = 4, categoryId = 'cs-foundation'): PlacedModule => ({
  code,
  name,
  mcs,
  categoryId,
});

const emptySemesters = (): StudentSemester[] =>
  [1, 2, 3, 4].flatMap((year) => [1, 2].map((sem) => ({ year, sem, modules: [] })));

const place = (semesters: StudentSemester[], year: number, sem: number, placed: PlacedModule): void => {
  const target = semesters.find((candidate) => candidate.year === year && candidate.sem === sem);
  if (!target) throw new Error(`Missing semester ${year}-${sem}`);
  target.modules.push(placed);
};

const buildFixture = (): {
  major: Major;
  semesters: StudentSemester[];
  waivedModules: WaivedModule[];
} => {
  const semesters = emptySemesters();
  place(semesters, 1, 1, module('CS1101S', 'Programming Methodology', 4, 'soc-common'));
  place(semesters, 1, 1, module('CS1231S', 'Discrete Structures', 4, 'cs-foundation'));
  place(semesters, 1, 1, module('MA1521', 'Calculus for Computing', 4, 'math-sciences'));
  place(semesters, 1, 2, module('CS2030S', 'Programming Methodology II', 4, 'cs-foundation'));
  place(semesters, 2, 1, module('CS2103T', 'Software Engineering', 4, 'cs-foundation'));
  place(semesters, 2, 2, module('CS3203', 'Software Engineering Project', 4, 'breadth-depth'));
  place(semesters, 3, 1, module('CS3230', 'Design and Analysis of Algorithms', 4, 'breadth-depth'));

  const waivedModules: WaivedModule[] = [
    module('MA1301', 'Introductory Mathematics', 4, 'cs-foundation'),
  ];

  const catalog = {
    CS1101S: { code: 'CS1101S', name: 'Programming Methodology', mcs: 4 },
    CS1231S: { code: 'CS1231S', name: 'Discrete Structures', mcs: 4 },
    MA1521: { code: 'MA1521', name: 'Calculus for Computing', mcs: 4 },
    CS2030S: { code: 'CS2030S', name: 'Programming Methodology II', mcs: 4 },
    CS2103T: { code: 'CS2103T', name: 'Software Engineering', mcs: 4 },
    CS3203: { code: 'CS3203', name: 'Software Engineering Project', mcs: 4 },
    CS3230: { code: 'CS3230', name: 'Design and Analysis of Algorithms', mcs: 4 },
    MA1301: { code: 'MA1301', name: 'Introductory Mathematics', mcs: 4 },
    CS2109S: { code: 'CS2109S', name: 'Introduction to AI and Machine Learning', mcs: 4 },
  };

  const major: Major = {
    id: 'test-major',
    label: 'Test Computing',
    school: 'NUS School of Computing',
    batches: ['AY2025/2026'],
    totalMcTarget: 160,
    categories: [
      { id: 'cs-foundation', label: 'CS Foundation', mcTarget: 32, color: '#d4c9b8' },
      { id: 'breadth-depth', label: 'Breadth & Depth', mcTarget: 32, color: '#c9d4b8' },
      { id: 'math-sciences', label: 'Math & Sciences', mcTarget: 12, color: '#c6d0ca' },
      { id: 'soc-common', label: 'SoC Common Curriculum', mcTarget: 8, color: '#abb89b' },
    ],
    requirements: [
      { name: 'Programming Methodology', fulfilledBy: ['CS1101S'], categoryId: 'soc-common' },
      {
        name: 'Software Engineering',
        fulfilledBy: ['CS2103T', 'CS3203'],
        categoryId: 'cs-foundation',
      },
    ],
    focusAreas: [
      {
        id: 'software-engineering',
        label: 'Software Engineering',
        primaries: ['CS1101S', 'CS2030S', 'CS2103T'],
      },
    ],
    moduleCatalog: catalog,
    defaultPlan: [
      { year: 1, sem: 1, moduleCode: 'CS1101S', categoryId: 'soc-common' },
      { year: 1, sem: 1, moduleCode: 'CS1231S', categoryId: 'cs-foundation' },
      { year: 1, sem: 2, moduleCode: 'CS2030S', categoryId: 'cs-foundation' },
      { year: 2, sem: 1, moduleCode: 'CS2103T', categoryId: 'cs-foundation' },
      { year: 3, sem: 2, moduleCode: 'CS2109S', categoryId: 'cs-foundation' },
    ],
  };

  return { major, semesters, waivedModules };
};

const byCode = (graph: CompetencyGraph, code: string) => graph.nodes.find((node) => node.code === code);

const linkKey = (source: string, target: string): string =>
  source < target ? `${source}|${target}` : `${target}|${source}`;

describe('getDiscipline', () => {
  it.each([
    ['CS1231S', 'theory'],
    ['CS3230', 'theory'],
    ['CS2100', 'systems'],
    ['CS2106', 'systems'],
    ['IFS4103', 'systems'],
    ['CS1101S', 'software'],
    ['CS2103T', 'software'],
    ['CS2102', 'software'],
    ['CS2109S', 'ai_data'],
    ['CS3244', 'ai_data'],
    ['ST2334', 'ai_data'],
    ['MA1521', 'math_sci'],
    ['PC1201', 'math_sci'],
    ['NTW2035', 'inquiry'],
    ['IS1108', 'inquiry'],
    ['ES2660', 'inquiry'],
    ['ETP3201L', 'general'],
    ['GEN2001', 'general'],
    ['CP3107', 'general'],
    ['TR3202', 'general'],
  ])('maps %s to %s', (code, discipline) => {
    expect(getDiscipline(code).id).toBe(discipline);
  });

  it('falls back to the planner category when the code is unfamiliar', () => {
    expect(getDiscipline('XX9999', 'nus-college').id).toBe('inquiry');
    expect(getDiscipline('XX9999', 'unrestricted-electives').id).toBe('general');
    expect(getDiscipline('XX9999', 'math-sciences').id).toBe('math_sci');
    expect(getDiscipline('XX9999', 'ai-breadth-depth').id).toBe('ai_data');
  });

  it('returns general for a truly unknown code', () => {
    expect(getDiscipline('ZZ0000').id).toBe('general');
  });
});

describe('prerequisite dictionary helpers', () => {
  it('finds known prerequisites by reverse lookup', () => {
    expect(getKnownPrerequisites('CS3203')).toEqual(['CS2030S', 'CS2103T']);
    expect(getKnownPrerequisites('cs3230')).toEqual(['CS1231S', 'CS2040S', 'ST2334']);
  });

  it('finds known unlocks', () => {
    expect(getKnownUnlocks('CS1101S')).toEqual(['CS2030S', 'CS2040S', 'CS2100']);
  });

  it('contains the curriculum spine requested by the visualiser spec', () => {
    expect(KNOWN_PREREQUISITES.CS1101S).toContain('CS2030S');
    expect(KNOWN_PREREQUISITES.CS1231S).toContain('CS3230');
    expect(KNOWN_PREREQUISITES.MA1521).toContain('ST2334');
    expect(KNOWN_PREREQUISITES.NTW2000).toEqual(['NSW2001', 'NGN2001', 'NSS2001']);
    expect(KNOWN_PREREQUISITES.IS1108.length).toBeGreaterThan(0);
  });
});

describe('buildSemesterTimeline', () => {
  it('sorts semesters chronologically and labels them consistently', () => {
    const timeline = buildSemesterTimeline([
      { year: 2, sem: 1, modules: [] },
      { year: 1, sem: 2, modules: [] },
      { year: 1, sem: 1, modules: [] },
      { year: 2, sem: 3, modules: [] },
    ]);
    expect(timeline.map((step) => step.label)).toEqual(['Y1S1', 'Y1S2', 'Y2S1', 'Y2 ST I']);
    expect(timeline.map((step) => step.index)).toEqual([0, 1, 2, 3]);
  });
});

describe('extractGraphNodesAndLinks', () => {
  it('gathers placed, waived and unplaced mandatory modules', () => {
    const { major, semesters, waivedModules } = buildFixture();
    const graph = extractGraphNodesAndLinks(major, semesters, waivedModules);

    expect(graph.nodes).toHaveLength(9);
    expect(byCode(graph, 'CS1101S')?.status).toBe('planned');
    expect(byCode(graph, 'MA1301')?.status).toBe('waived');
    expect(byCode(graph, 'CS2109S')?.status).toBe('unplaced');
    expect(byCode(graph, 'CS2109S')?.semesterIndex).toBe(-1);
    expect(byCode(graph, 'CS1101S')?.semesterIndex).toBe(0);
    expect(byCode(graph, 'CS2030S')?.semesterIndex).toBe(1);
  });

  it('marks earlier-year modules completed when a current year is supplied', () => {
    const { major, semesters, waivedModules } = buildFixture();
    const graph = extractGraphNodesAndLinks(major, semesters, waivedModules, { currentYear: 2 });

    expect(byCode(graph, 'CS1101S')?.status).toBe('completed');
    expect(byCode(graph, 'CS1231S')?.status).toBe('completed');
    expect(byCode(graph, 'CS2030S')?.status).toBe('completed');
    expect(byCode(graph, 'CS2103T')?.status).toBe('planned');
    expect(byCode(graph, 'CS3230')?.status).toBe('planned');
    expect(byCode(graph, 'MA1301')?.status).toBe('waived');
  });

  it('supports an explicit semester cut-off for completed modules', () => {
    const { major, semesters, waivedModules } = buildFixture();
    const graph = extractGraphNodesAndLinks(major, semesters, waivedModules, {
      completedThroughIndex: 1,
    });
    expect(byCode(graph, 'CS2030S')?.status).toBe('completed');
    expect(byCode(graph, 'CS2103T')?.status).toBe('planned');
  });

  it('creates explicit prerequisite links between placed modules', () => {
    const { major, semesters, waivedModules } = buildFixture();
    const graph = extractGraphNodesAndLinks(major, semesters, waivedModules);
    const prerequisitePairs = graph.links
      .filter((link) => link.kind === 'prerequisite')
      .map((link) => `${link.source}->${link.target}`);

    expect(prerequisitePairs).toContain('CS1101S->CS2030S');
    expect(prerequisitePairs).toContain('CS1231S->CS3230');
    expect(prerequisitePairs).toContain('CS2030S->CS2103T');
    expect(prerequisitePairs).toContain('CS2103T->CS3203');
  });

  it('adds affinity links so disciplines cluster even without prerequisites', () => {
    const { major, semesters, waivedModules } = buildFixture();
    const graph = extractGraphNodesAndLinks(major, semesters, waivedModules);
    const affinityPairs = graph.links
      .filter((link) => link.kind === 'affinity')
      .map((link) => linkKey(link.source, link.target));

    expect(affinityPairs).toContain(linkKey('CS1101S', 'CS2103T'));
    expect(affinityPairs).toContain(linkKey('CS1101S', 'CS3203'));
  });

  it('never creates duplicate pairs or self links', () => {
    const { major, semesters, waivedModules } = buildFixture();
    const graph = extractGraphNodesAndLinks(major, semesters, waivedModules);
    const seen = new Set<string>();
    for (const link of graph.links) {
      expect(link.source).not.toBe(link.target);
      const key = linkKey(link.source, link.target);
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('computes in/out degree and total degree from the links', () => {
    const { major, semesters, waivedModules } = buildFixture();
    const graph = extractGraphNodesAndLinks(major, semesters, waivedModules);
    const cs1101s = byCode(graph, 'CS1101S');
    const cs3203 = byCode(graph, 'CS3203');

    expect(cs1101s?.outDegree).toBe(1);
    expect(cs1101s?.inDegree).toBe(0);
    expect(cs1101s?.degree).toBeGreaterThanOrEqual(2);
    expect(cs3203?.inDegree).toBe(2);
    expect(cs3203?.degree).toBeGreaterThanOrEqual(2);
  });

  it('returns an empty graph for an empty plan', () => {
    const major = { defaultPlan: [], moduleCatalog: {} } as unknown as Major;
    const graph = extractGraphNodesAndLinks(major, emptySemesters(), []);
    expect(graph.nodes).toEqual([]);
    expect(graph.links).toEqual([]);
  });
});

describe('computeGraphLineage', () => {
  it('walks prerequisite ancestry and descendancy without crossing affinity links', () => {
    const { major, semesters, waivedModules } = buildFixture();
    const graph = extractGraphNodesAndLinks(major, semesters, waivedModules);
    const lineage = computeGraphLineage(graph);

    expect(Array.from(lineage.get('CS3203')?.ancestors ?? []).sort()).toEqual([
      'CS1101S',
      'CS2030S',
      'CS2103T',
    ]);
    expect(Array.from(lineage.get('CS1101S')?.descendants ?? []).sort()).toEqual([
      'CS2030S',
      'CS2103T',
      'CS3203',
    ]);
    expect(lineage.get('CS3203')?.descendants.size).toBe(0);
  });
});

describe('extractRiverData', () => {
  it('builds one column per semester with per-discipline MCs', () => {
    const { major, semesters, waivedModules } = buildFixture();
    const river = extractRiverData(major, semesters, waivedModules);

    expect(river.columns).toHaveLength(8);
    expect(river.columns[0].label).toBe('Y1S1');
    expect(river.columns[0].totalMcs).toBe(12);
    expect(river.columns[0].byDiscipline.software).toBe(4);
    expect(river.columns[0].byDiscipline.theory).toBe(4);
    expect(river.columns[0].byDiscipline.math_sci).toBe(4);
    expect(river.totalMcs).toBe(28);
    expect(river.maxColumnMcs).toBe(12);
  });

  it('reports cumulative knowledge monotonically', () => {
    const { major, semesters, waivedModules } = buildFixture();
    const river = extractRiverData(major, semesters, waivedModules);
    const software = river.columns.map((column) => column.cumulativeByDiscipline.software);

    expect(software).toEqual([4, 8, 12, 16, 16, 16, 16, 16]);
    for (let index = 1; index < software.length; index += 1) {
      expect(software[index]).toBeGreaterThanOrEqual(software[index - 1]);
    }
    expect(river.cumulativeTotals.theory).toBe(8);
  });

  it('associates pebbles with their semester and discipline', () => {
    const { major, semesters, waivedModules } = buildFixture();
    const river = extractRiverData(major, semesters, waivedModules);
    const firstColumn = river.columns[0];

    expect(firstColumn.pebbles.map((pebble) => pebble.code).sort()).toEqual([
      'CS1101S',
      'CS1231S',
      'MA1521',
    ]);
    const cs1231s = firstColumn.pebbles.find((pebble) => pebble.code === 'CS1231S');
    expect(cs1231s?.discipline).toBe('theory');
    expect(cs1231s?.semesterLabel).toBe('Y1S1');
    expect(cs1231s?.semesterBefore).toBe(0);
    expect(cs1231s?.cumulativeBefore).toBe(0);
  });

  it('tracks waived modules separately from semester MCs', () => {
    const { major, semesters, waivedModules } = buildFixture();
    const river = extractRiverData(major, semesters, waivedModules);

    expect(river.waivedMcs).toBe(4);
    expect(river.waivedPebbles).toHaveLength(1);
    expect(river.waivedPebbles[0].code).toBe('MA1301');
    expect(river.waivedPebbles[0].semesterLabel).toBe('Waived / Advanced Standing');
    expect(river.totalMcs).toBe(28);
  });

  it('handles a plan with no semesters', () => {
    const major = { defaultPlan: [], moduleCatalog: {} } as unknown as Major;
    const river = extractRiverData(major, [], []);
    expect(river.columns).toEqual([]);
    expect(river.totalMcs).toBe(0);
    expect(river.maxColumnMcs).toBe(0);
  });
});

describe('hexToRgba', () => {
  it('converts six-digit hex colours', () => {
    expect(hexToRgba('#b45309', 0.5)).toBe('rgba(180, 83, 9, 0.5)');
  });

  it('expands three-digit hex colours', () => {
    expect(hexToRgba('#abc', 1)).toBe('rgba(170, 187, 204, 1)');
  });

  it('falls back to ink for invalid input', () => {
    expect(hexToRgba('not-a-colour', 0.4)).toBe('rgba(20, 20, 19, 0.4)');
  });
});
