import type {
  Major,
  Module,
  PlacedModule,
  StudentSemester,
  WaivedModule,
} from '@shared/types';
import { semesterLabel } from '../../lib/studyPlan';
import type {
  CompetencyGraph,
  DisciplineId,
  DisciplineInfo,
  DisciplineMC,
  GraphLineage,
  GraphLink,
  GraphLinkKind,
  GraphNode,
  ModuleNodeStatus,
  RiverData,
  RiverPebble,
  RiverSemesterColumn,
  SemesterTimelineStep,
} from './competencyTypes';

/* ------------------------------------------------------------------ */
/* Disciplines                                                         */
/* ------------------------------------------------------------------ */

export const DISCIPLINE_ORDER: DisciplineId[] = [
  'theory',
  'systems',
  'software',
  'ai_data',
  'math_sci',
  'inquiry',
  'general',
];

export const DISCIPLINES: Record<DisciplineId, DisciplineInfo> = {
  theory: {
    id: 'theory',
    label: 'Theory & Algorithms',
    shortLabel: 'Theory',
    color: '#b45309',
    wash: '#f4e6cf',
    description: 'Discrete mathematics, algorithms, logic and complexity.',
  },
  systems: {
    id: 'systems',
    label: 'Systems & Networks',
    shortLabel: 'Systems',
    color: '#c2410c',
    wash: '#f6dfd3',
    description: 'Architecture, operating systems, networks, security and hardware.',
  },
  software: {
    id: 'software',
    label: 'Software & Craft',
    shortLabel: 'Software',
    color: '#3f6212',
    wash: '#e2ead3',
    description: 'Programming, software engineering, databases, graphics and HCI.',
  },
  ai_data: {
    id: 'ai_data',
    label: 'AI & Data Science',
    shortLabel: 'AI & Data',
    color: '#0f766e',
    wash: '#d6e9e5',
    description: 'Artificial intelligence, machine learning, vision, NLP and analytics.',
  },
  math_sci: {
    id: 'math_sci',
    label: 'Mathematics & Science',
    shortLabel: 'Math & Sci',
    color: '#334155',
    wash: '#dfe3e8',
    description: 'Calculus, linear algebra, statistics, physics and the natural sciences.',
  },
  inquiry: {
    id: 'inquiry',
    label: 'Inquiry & Society',
    shortLabel: 'Inquiry',
    color: '#9f1239',
    wash: '#f0dde2',
    description: 'NUS College seminars, ethics, writing, narratives and science & society.',
  },
  general: {
    id: 'general',
    label: 'General & Electives',
    shortLabel: 'General',
    color: '#57534e',
    wash: '#e5e2dc',
    description: 'Unrestricted electives, minors, internships and NOC pathways.',
  },
};

export const getDisciplineInfo = (id: DisciplineId): DisciplineInfo => DISCIPLINES[id];

/** Normalise a module code for lookups (trim, uppercase, strip whitespace). */
export const normalizeCourseCode = (code: string): string =>
  code.trim().toUpperCase().replace(/\s+/g, '');

/** NUS codes are usually PREFIX + four digits + optional suffix letter. */
export const courseBaseCode = (code: string): string => {
  const normalized = normalizeCourseCode(code);
  const match = normalized.match(/^([A-Z]+\d{4})[A-Z]?$/);
  return match ? match[1] : normalized;
};

/** Explicit discipline assignments take precedence over heuristics. */
const EXACT_DISCIPLINE: Record<string, DisciplineId> = {
  /* Theory, logic and algorithms */
  CS1231: 'theory',
  CS1231S: 'theory',
  CS2040: 'theory',
  CS2040C: 'theory',
  CS2040S: 'theory',
  CS3230: 'theory',
  CS3231: 'theory',
  CS3233: 'theory',
  CS3234: 'theory',
  CS3236: 'theory',
  CS4231: 'theory',
  CS4232: 'theory',
  CS4234: 'theory',

  /* Systems, networks, security and hardware */
  CS2100: 'systems',
  CS2105: 'systems',
  CS2106: 'systems',
  CS2107: 'systems',
  CS3210: 'systems',
  CS3211: 'systems',
  CS3220: 'systems',
  CS3235: 'systems',
  CS4222: 'systems',
  CS4223: 'systems',
  CS4226: 'systems',
  CS4230: 'systems',
  CS4235: 'systems',
  CS4236: 'systems',
  CS4238: 'systems',
  CS4239: 'systems',
  CS4257: 'systems',
  CS4276: 'systems',
  CS5231: 'systems',
  CS5321: 'systems',
  CS5322: 'systems',
  CS5331: 'systems',
  CS5332: 'systems',

  /* Software engineering, databases, graphics and HCI */
  CS1010: 'software',
  CS1010A: 'software',
  CS1010E: 'software',
  CS1010S: 'software',
  CS1010X: 'software',
  CS1101: 'software',
  CS1101S: 'software',
  CS2030: 'software',
  CS2030S: 'software',
  CS2102: 'software',
  CS2103: 'software',
  CS2103T: 'software',
  CS3203: 'software',
  CS3216: 'software',
  CS3217: 'software',
  CS3219: 'software',
  CS3223: 'software',
  CS3226: 'software',
  CS3240: 'software',
  CS3241: 'software',
  CS3242: 'software',
  CS3247: 'software',
  CS4211: 'software',
  CS4212: 'software',
  CS4218: 'software',
  CS4221: 'software',
  CS4224: 'software',
  CS4247: 'software',
  CS4277: 'software',
  CS4278: 'software',
  CS4350: 'software',
  CS4352: 'ai_data',

  /* AI, machine learning and data science */
  CS2109: 'ai_data',
  CS2109S: 'ai_data',
  CS2251: 'ai_data',
  CS3243: 'ai_data',
  CS3244: 'ai_data',
  CS3245: 'ai_data',
  CS3263: 'ai_data',
  CS3264: 'ai_data',
  CS3268: 'ai_data',
  CS4220: 'ai_data',
  CS4225: 'ai_data',
  CS4240: 'ai_data',
  CS4242: 'ai_data',
  CS4243: 'ai_data',
  CS4244: 'ai_data',
  CS4246: 'ai_data',
  CS4248: 'ai_data',
  CS4261: 'ai_data',
  CS4262: 'ai_data',
  CS4347: 'ai_data',
  ST2334: 'ai_data',

  /* Mathematics and natural sciences */
  MA1101R: 'math_sci',
  MA1102R: 'math_sci',
  MA1301: 'math_sci',
  MA1521: 'math_sci',
  MA1522: 'math_sci',
  MA2001: 'math_sci',
  MA2104: 'math_sci',
  MA2213: 'math_sci',
  MA2216: 'math_sci',
  MA3110: 'math_sci',
  MA3201: 'math_sci',
  MA4261: 'math_sci',
  MA4262: 'math_sci',
  MA4270: 'math_sci',
  ST2131: 'math_sci',
  ST2132: 'math_sci',
  PC1141: 'math_sci',
  PC1142: 'math_sci',
  PC1201: 'math_sci',
  PC1221: 'math_sci',
  PC1431: 'math_sci',
  PC1432: 'math_sci',

  /* Inquiry, ethics, writing and NUS College */
  CS2101: 'inquiry',
  ES2660: 'inquiry',
  GEA1000: 'inquiry',
  GEA1000N: 'inquiry',
  IS1108: 'inquiry',
  IS2101: 'inquiry',

  /* Information systems electives lean software, with analytics exceptions */
  IS3107: 'ai_data',
  IS4226: 'ai_data',
  IS4241: 'ai_data',
  IS4242: 'ai_data',
  IS4246: 'ai_data',
  DBA4811: 'ai_data',
};

/** Prefix fallbacks, checked in order after exact matches. */
const PREFIX_DISCIPLINE: Array<[string, DisciplineId]> = [
  ['NTW', 'inquiry'],
  ['NSW', 'inquiry'],
  ['NSS', 'inquiry'],
  ['NGN', 'inquiry'],
  ['NHS', 'inquiry'],
  ['NFB', 'inquiry'],
  ['NST', 'inquiry'],
  ['NFC', 'inquiry'],
  ['NHT', 'inquiry'],
  ['NEP', 'inquiry'],
  ['NUS', 'inquiry'],
  ['NUC', 'inquiry'],
  ['GEA', 'inquiry'],
  ['GEH', 'inquiry'],
  ['GES', 'inquiry'],
  ['GEQ', 'inquiry'],
  ['GER', 'inquiry'],
  ['GET', 'inquiry'],
  ['IFS', 'systems'],
  ['BT', 'ai_data'],
  ['DBA', 'ai_data'],
  ['DSC', 'ai_data'],
  ['MA', 'math_sci'],
  ['ST', 'math_sci'],
  ['PC', 'math_sci'],
  ['PH', 'math_sci'],
  ['CM', 'math_sci'],
  ['LSM', 'math_sci'],
  ['MB', 'math_sci'],
  ['QF', 'math_sci'],
  ['IS', 'software'],
  ['CP', 'general'],
  ['ETP', 'general'],
  ['TR', 'general'],
  ['GEN', 'general'],
  ['NOC', 'general'],
  ['SPM', 'general'],
  ['IE', 'general'],
  ['ACC', 'general'],
  ['BSP', 'general'],
  ['CS', 'software'],
];

const categoryDiscipline = (categoryId?: string): DisciplineId | null => {
  if (!categoryId) return null;
  const id = categoryId.toLowerCase();
  if (id.includes('nus-college') || id.includes('soc-common') || id.includes('inquiry')) {
    return 'inquiry';
  }
  if (id.includes('math')) return 'math_sci';
  if (id.includes('unrestricted') || id.includes('ue')) return 'general';
  if (id.includes('security')) return 'systems';
  if (id.includes('ai') || id.includes('data') || id.includes('analytic') || id.startsWith('ba-')) {
    return 'ai_data';
  }
  if (id.includes('system') || id.includes('network')) return 'systems';
  if (id.includes('theory') || id.includes('algorithm')) return 'theory';
  if (id.includes('software') || id.includes('programming')) return 'software';
  return null;
};

/** Resolve the scholarly discipline for any module code. */
export const getDiscipline = (code: string, categoryId?: string): DisciplineInfo => {
  const normalized = normalizeCourseCode(code);
  const base = courseBaseCode(normalized);

  const exact = EXACT_DISCIPLINE[normalized] ?? EXACT_DISCIPLINE[base];
  if (exact) return DISCIPLINES[exact];

  for (const [prefix, discipline] of PREFIX_DISCIPLINE) {
    if (normalized.startsWith(prefix)) return DISCIPLINES[discipline];
  }

  const byCategory = categoryDiscipline(categoryId);
  if (byCategory) return DISCIPLINES[byCategory];

  return DISCIPLINES.general;
};

/* ------------------------------------------------------------------ */
/* Prerequisite knowledge                                              */
/* ------------------------------------------------------------------ */

/** A pragmatic, embedded prerequisite dictionary. It is intentionally not a
 * complete NUSMods mirror: it captures the spine of the SoC/NUSC curriculum so
 * the constellation has recognisable ancestry, while affinity links add the
 * softer discipline clustering. */
export const KNOWN_PREREQUISITES: Record<string, string[]> = {
  CS1101S: ['CS2030S', 'CS2040S', 'CS2100'],
  CS1231S: ['CS2040S', 'CS3230', 'CS2109S', 'CS3231', 'CS3234'],
  CS2030S: ['CS2103T', 'CS3203', 'CS3219'],
  CS2040S: ['CS3230', 'CS2109S', 'CS3243', 'CS3244', 'CS2102', 'CS3223', 'CS3245'],
  CS2100: ['CS2106', 'CS2105', 'CS3210'],
  CS2106: ['CS3210', 'CS4223', 'CS3220'],
  CS2105: ['CS4226', 'CS4222'],
  CS2103T: ['CS3203', 'CS3216', 'CS3217'],
  CS2109S: ['CS3244', 'CS3243', 'CS4248', 'CS4243', 'CS4246', 'CS4225'],
  CS2102: ['CS4221', 'CS4224'],
  CS3230: ['CS4231', 'CS4234', 'CS4232'],
  CS3244: ['CS4243', 'CS4248', 'CS4246', 'CS4225', 'CS4347'],
  MA1521: ['MA2001', 'ST2334', 'CS2109S', 'CS3244'],
  ST2334: ['CS2109S', 'CS3244', 'CS3230', 'CS4248'],
  NTW2000: ['NSW2001', 'NGN2001', 'NSS2001'],
  IS1108: ['CS2109S', 'CS3243', 'CS3244', 'CS4243', 'CS4248'],
};

const prerequisiteSourcesByTarget = (): Map<string, string[]> => {
  const reverse = new Map<string, string[]>();
  for (const [source, targets] of Object.entries(KNOWN_PREREQUISITES)) {
    for (const target of targets) {
      const list = reverse.get(normalizeCourseCode(target)) ?? [];
      list.push(normalizeCourseCode(source));
      reverse.set(normalizeCourseCode(target), list);
    }
  }
  return reverse;
};

const REVERSE_PREREQUISITES = prerequisiteSourcesByTarget();

/** Known prerequisite codes for a module (reverse lookup into the dictionary). */
export const getKnownPrerequisites = (code: string): string[] => {
  const normalized = normalizeCourseCode(code);
  const direct = REVERSE_PREREQUISITES.get(normalized) ?? [];
  const viaBase = REVERSE_PREREQUISITES.get(courseBaseCode(normalized)) ?? [];
  return Array.from(new Set([...direct, ...viaBase])).sort();
};

export const getKnownUnlocks = (code: string): string[] => {
  const normalized = normalizeCourseCode(code);
  const direct = KNOWN_PREREQUISITES[normalized] ?? [];
  const viaBase = KNOWN_PREREQUISITES[courseBaseCode(normalized)] ?? [];
  return Array.from(new Set([...direct, ...viaBase])).sort();
};

/* ------------------------------------------------------------------ */
/* Small shared helpers                                                */
/* ------------------------------------------------------------------ */

export const emptyDisciplineMC = (): DisciplineMC => ({
  theory: 0,
  systems: 0,
  software: 0,
  ai_data: 0,
  math_sci: 0,
  inquiry: 0,
  general: 0,
});

export const hexToRgba = (hex: string, alpha: number): string => {
  const normalized = hex.replace('#', '').trim();
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized;
  const value = Number.parseInt(full, 16);
  if (!Number.isFinite(value) || full.length !== 6) {
    return `rgba(20, 20, 19, ${alpha})`;
  }
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const semesterKey = (year: number, sem: number): string => `${year}-${sem}`;

/** Chronological semester columns used by both views. */
export const buildSemesterTimeline = (semesters: StudentSemester[]): SemesterTimelineStep[] =>
  [...semesters]
    .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.sem - b.sem))
    .map((semester, index) => ({
      index,
      key: semesterKey(semester.year, semester.sem),
      label: semesterLabel(semester.year, semester.sem),
      year: semester.year,
      sem: semester.sem,
    }));

const semesterIndexLookup = (timeline: SemesterTimelineStep[]): Map<string, number> =>
  new Map(timeline.map((step) => [step.key, step.index]));

const statusOrder = (status: ModuleNodeStatus): number => {
  if (status === 'completed') return 0;
  if (status === 'planned') return 1;
  if (status === 'waived') return 2;
  return 3;
};

const matchesFulfillerCode = (code: string, fulfiller: string): boolean => {
  const normalizedCode = normalizeCourseCode(code);
  const normalizedFulfiller = normalizeCourseCode(fulfiller);
  if (normalizedFulfiller.endsWith('*')) {
    return normalizedCode.startsWith(normalizedFulfiller.slice(0, -1));
  }
  return normalizedCode === normalizedFulfiller;
};

/* ------------------------------------------------------------------ */
/* Graph extraction                                                    */
/* ------------------------------------------------------------------ */

export interface ExtractGraphOptions {
  /** Students in Year 2+ have their earlier-year modules marked completed. */
  currentYear?: number;
  /** Explicit timeline cut-off (index into the chronological semester list). */
  completedThroughIndex?: number;
}

interface NodeSeed {
  code: string;
  name: string;
  mcs: number;
  categoryId?: string;
  status: ModuleNodeStatus;
  year?: number;
  sem?: number;
  semesterIndex: number;
  semesterLabel?: string;
}

const seedFromPlacedModule = (
  module: PlacedModule,
  semester: StudentSemester,
  timelineIndex: number,
): NodeSeed => ({
  code: normalizeCourseCode(module.code),
  name: module.name,
  mcs: module.mcs,
  categoryId: module.categoryId,
  status: 'planned',
  year: semester.year,
  sem: semester.sem,
  semesterIndex: timelineIndex,
  semesterLabel: semesterLabel(semester.year, semester.sem),
});

const addModuleIfMissing = (
  seeds: Map<string, NodeSeed>,
  module: PlacedModule | WaivedModule,
  status: ModuleNodeStatus,
  extra: Partial<NodeSeed> = {},
): void => {
  const code = normalizeCourseCode(module.code);
  if (!code || seeds.has(code)) return;
  seeds.set(code, {
    code,
    name: module.name || code,
    mcs: Number.isFinite(module.mcs) ? module.mcs : 0,
    categoryId: module.categoryId,
    status,
    semesterIndex: -1,
    ...extra,
  });
};

/** Build the constellation graph from the planner's current state. */
export const extractGraphNodesAndLinks = (
  major: Major,
  semesters: StudentSemester[],
  waivedModules: WaivedModule[],
  options: ExtractGraphOptions = {},
): CompetencyGraph => {
  const timeline = buildSemesterTimeline(semesters);
  const indexes = semesterIndexLookup(timeline);
  const seeds = new Map<string, NodeSeed>();

  for (const semester of semesters) {
    const index = indexes.get(semesterKey(semester.year, semester.sem)) ?? -1;
    for (const module of semester.modules) {
      const seed = seedFromPlacedModule(module, semester, index);
      const existing = seeds.get(seed.code);
      if (!existing || statusOrder(seed.status) < statusOrder(existing.status)) {
        seeds.set(seed.code, seed);
      }
    }
  }

  for (const module of waivedModules) {
    addModuleIfMissing(seeds, module, 'waived', {
      semesterLabel: 'Waived / Advanced Standing',
    });
  }

  /* Unplaced mandatory modules from the curriculum's default plan. */
  for (const entry of major.defaultPlan ?? []) {
    const code = normalizeCourseCode(entry.moduleCode);
    if (!code || seeds.has(code)) continue;
    const catalogModule: Module | undefined = major.moduleCatalog[entry.moduleCode] ??
      major.moduleCatalog[code];
    addModuleIfMissing(
      seeds,
      {
        code,
        name: catalogModule?.name ?? code,
        mcs: catalogModule?.mcs ?? 4,
        categoryId: entry.categoryId,
      },
      'unplaced',
      {
        year: entry.year,
        sem: entry.sem,
        semesterLabel: `${semesterLabel(entry.year, entry.sem)} · not placed`,
      },
    );
  }

  /* Apply completion status once, after all seeds are known. */
  for (const seed of seeds.values()) {
    if (seed.status !== 'planned') continue;
    const completed =
      options.completedThroughIndex !== undefined
        ? seed.semesterIndex >= 0 && seed.semesterIndex <= options.completedThroughIndex
        : options.currentYear !== undefined &&
          seed.year !== undefined &&
          seed.year < options.currentYear;
    if (completed) seed.status = 'completed';
  }

  const focusAreaByCode = new Map<string, string>();
  for (const area of major.focusAreas ?? []) {
    for (const code of [...area.primaries, ...(area.electives ?? [])]) {
      const normalized = normalizeCourseCode(code);
      if (!focusAreaByCode.has(normalized)) focusAreaByCode.set(normalized, area.label);
    }
  }

  const nodes: GraphNode[] = Array.from(seeds.values()).map((seed) => ({
    id: seed.code,
    code: seed.code,
    name: seed.name,
    mcs: seed.mcs,
    categoryId: seed.categoryId,
    discipline: getDiscipline(seed.code, seed.categoryId).id,
    status: seed.status,
    semesterLabel: seed.semesterLabel,
    year: seed.year,
    sem: seed.sem,
    semesterIndex: seed.semesterIndex,
    inDegree: 0,
    outDegree: 0,
    degree: 0,
    focusArea: focusAreaByCode.get(seed.code),
  }));

  const nodeByCode = new Map(nodes.map((node) => [node.code, node]));
  const nodeByBase = new Map<string, GraphNode>();
  for (const node of nodes) {
    const base = courseBaseCode(node.code);
    if (!nodeByBase.has(base)) nodeByBase.set(base, node);
  }

  const resolveNode = (rawCode: string): GraphNode | null => {
    const normalized = normalizeCourseCode(rawCode);
    return (
      nodeByCode.get(normalized) ??
      nodeByCode.get(courseBaseCode(normalized)) ??
      nodeByBase.get(courseBaseCode(normalized)) ??
      null
    );
  };

  const links: GraphLink[] = [];
  const linkPairs = new Set<string>();
  const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

  const addLink = (
    sourceCode: string,
    targetCode: string,
    kind: GraphLinkKind,
    strength: number,
  ): void => {
    const source = resolveNode(sourceCode);
    const target = resolveNode(targetCode);
    if (!source || !target || source.id === target.id) return;
    const key = pairKey(source.id, target.id);
    if (linkPairs.has(key)) return;
    linkPairs.add(key);
    links.push({ source: source.id, target: target.id, kind, strength });
  };

  /* 1. Explicit prerequisites. */
  for (const [source, targets] of Object.entries(KNOWN_PREREQUISITES)) {
    for (const target of targets) addLink(source, target, 'prerequisite', 1);
  }

  const orderKey = (node: GraphNode): [number, number, string] => [
    node.semesterIndex >= 0 ? node.semesterIndex : 900 + (node.year ?? 0),
    node.year ?? 99,
    node.code,
  ];

  const sortedNodes = (list: GraphNode[]): GraphNode[] =>
    [...list].sort((a, b) => {
      const [ai, ay, ac] = orderKey(a);
      const [bi, by, bc] = orderKey(b);
      if (ai !== bi) return ai - bi;
      if (ay !== by) return ay - by;
      return ac.localeCompare(bc);
    });

  /** Connect a group with a single hub to keep the graph legible. */
  const addSpokes = (group: GraphNode[], strength: number, maxSpokes = 10): void => {
    if (group.length < 2) return;
    const ordered = sortedNodes(group);
    const anchor = ordered[0];
    for (const member of ordered.slice(1, maxSpokes + 1)) {
      addLink(anchor.code, member.code, 'affinity', strength);
    }
  };

  /* 2. Focus areas: the strongest semantic affinity after prerequisites. */
  for (const area of major.focusAreas ?? []) {
    const areaNodes = [...area.primaries, ...(area.electives ?? [])]
      .map(resolveNode)
      .filter((node): node is GraphNode => Boolean(node));
    addSpokes(Array.from(new Map(areaNodes.map((node) => [node.id, node])).values()), 0.38, 8);
  }

  /* 3. Requirement groups (e.g. all NTW seminars) keep their cohorts together. */
  for (const requirement of major.requirements ?? []) {
    const group = nodes.filter((node) =>
      (requirement.fulfilledBy ?? []).some((fulfiller) =>
        matchesFulfillerCode(node.code, fulfiller),
      ),
    );
    if (group.length >= 2 && group.length <= 10) addSpokes(group, 0.3, 9);
  }

  /* 4. Category cohorts. These are broad, so use a gentle strength. */
  const byCategory = new Map<string, GraphNode[]>();
  for (const node of nodes) {
    if (!node.categoryId) continue;
    const list = byCategory.get(node.categoryId) ?? [];
    list.push(node);
    byCategory.set(node.categoryId, list);
  }
  for (const group of byCategory.values()) {
    if (group.length >= 2 && group.length <= 14) addSpokes(group, 0.2, 10);
  }

  /* 5. A discipline spine guarantees every scholarly cluster is anchored,
   * even for electives with no explicit prerequisite or category cohort. */
  const byDiscipline = new Map<DisciplineId, GraphNode[]>();
  for (const node of nodes) {
    const list = byDiscipline.get(node.discipline) ?? [];
    list.push(node);
    byDiscipline.set(node.discipline, list);
  }
  for (const group of byDiscipline.values()) addSpokes(group, 0.18, 12);

  for (const link of links) {
    const source = nodeByCode.get(link.source);
    const target = nodeByCode.get(link.target);
    if (!source || !target) continue;
    source.degree += 1;
    target.degree += 1;
    if (link.kind === 'prerequisite') {
      source.outDegree += 1;
      target.inDegree += 1;
    }
  }

  return { nodes, links };
};

/** Hover ancestry/descendancy, following prerequisite edges only. */
export const computeGraphLineage = (graph: CompetencyGraph): Map<string, GraphLineage> => {
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const link of graph.links) {
    if (link.kind !== 'prerequisite') continue;
    const out = outgoing.get(link.source) ?? [];
    out.push(link.target);
    outgoing.set(link.source, out);
    const inc = incoming.get(link.target) ?? [];
    inc.push(link.source);
    incoming.set(link.target, inc);
  }

  const walk = (start: string, adjacency: Map<string, string[]>): Set<string> => {
    const seen = new Set<string>();
    const queue = [...(adjacency.get(start) ?? [])];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      if (seen.has(current) || current === start) continue;
      seen.add(current);
      for (const next of adjacency.get(current) ?? []) {
        if (!seen.has(next)) queue.push(next);
      }
    }
    return seen;
  };

  const lineage = new Map<string, GraphLineage>();
  for (const node of graph.nodes) {
    lineage.set(node.id, {
      ancestors: walk(node.id, incoming),
      descendants: walk(node.id, outgoing),
    });
  }
  return lineage;
};

/* ------------------------------------------------------------------ */
/* River extraction                                                    */
/* ------------------------------------------------------------------ */

/** Build the semester-by-semester credit river. */
export const extractRiverData = (
  major: Major,
  semesters: StudentSemester[],
  waivedModules: WaivedModule[],
): RiverData => {
  const timeline = buildSemesterTimeline(semesters);
  const cumulative = emptyDisciplineMC();
  const columns: RiverSemesterColumn[] = [];
  let totalMcs = 0;
  let maxColumnMcs = 0;

  for (const step of timeline) {
    const semester = semesters.find(
      (candidate) => candidate.year === step.year && candidate.sem === step.sem,
    );
    const byDiscipline = emptyDisciplineMC();
    const pebbles: RiverPebble[] = [];
    let columnTotal = 0;

    for (const module of semester?.modules ?? []) {
      const discipline = getDiscipline(module.code, module.categoryId).id;
      const semesterBefore = byDiscipline[discipline];
      const cumulativeBefore = cumulative[discipline] + semesterBefore;
      pebbles.push({
        code: module.code,
        name: module.name,
        mcs: module.mcs,
        discipline,
        year: step.year,
        sem: step.sem,
        semesterLabel: step.label,
        semesterBefore,
        cumulativeBefore,
      });
      byDiscipline[discipline] += module.mcs;
      columnTotal += module.mcs;
    }

    for (const discipline of DISCIPLINE_ORDER) {
      cumulative[discipline] += byDiscipline[discipline];
    }

    totalMcs += columnTotal;
    maxColumnMcs = Math.max(maxColumnMcs, columnTotal);
    columns.push({
      ...step,
      totalMcs: columnTotal,
      byDiscipline,
      cumulativeByDiscipline: { ...cumulative },
      pebbles,
    });
  }

  const waivedPebbles: RiverPebble[] = waivedModules.map((module) => ({
    code: module.code,
    name: module.name,
    mcs: module.mcs,
    discipline: getDiscipline(module.code, module.categoryId).id,
    year: 0,
    sem: 0,
    semesterLabel: 'Waived / Advanced Standing',
    semesterBefore: 0,
    cumulativeBefore: 0,
  }));

  const waivedMcs = waivedPebbles.reduce((sum, module) => sum + module.mcs, 0);

  return {
    columns,
    disciplines: DISCIPLINE_ORDER.map((id) => DISCIPLINES[id]),
    totalMcs,
    waivedMcs,
    cumulativeTotals: { ...cumulative },
    maxColumnMcs,
    waivedPebbles,
  };
};
