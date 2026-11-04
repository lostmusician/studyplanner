/** Shared types for the Competency & Pathways Visualizer.
 *
 * The visualiser deliberately keeps its own small domain model instead of
 * reaching into planner internals: a graph of modules and the "river" of
 * credits over time are both derived from the same placed/waived module data,
 * and both views consume these types. */

export type DisciplineId =
  | 'theory'
  | 'systems'
  | 'software'
  | 'ai_data'
  | 'math_sci'
  | 'inquiry'
  | 'general';

export interface DisciplineInfo {
  id: DisciplineId;
  /** Full human label used in tooltips and legends. */
  label: string;
  /** Compact label for filter chips. */
  shortLabel: string;
  /** Parchment-calibrated ink used for strokes, dots and graph fills. */
  color: string;
  /** Lighter watercolour wash used behind the ink. */
  wash: string;
  description: string;
}

export type ModuleNodeStatus = 'completed' | 'planned' | 'waived' | 'unplaced';

export interface GraphNode {
  id: string;
  code: string;
  name: string;
  mcs: number;
  categoryId?: string;
  discipline: DisciplineId;
  status: ModuleNodeStatus;
  /** Populated for modules that have a real or suggested semester. */
  semesterLabel?: string;
  year?: number;
  sem?: number;
  /** Index into the chronological semester timeline, or -1 for waived/unplaced. */
  semesterIndex: number;
  /** Prerequisite in-degree (courses this module depends on). */
  inDegree: number;
  /** Prerequisite out-degree (courses this module unlocks). */
  outDegree: number;
  /** Total number of graph links touching this node (used for radius). */
  degree: number;
  /** Matching focus area, when we can infer one. */
  focusArea?: string;
}

export type GraphLinkKind = 'prerequisite' | 'affinity';

export interface GraphLink {
  source: string;
  target: string;
  kind: GraphLinkKind;
  /** 0..1 visual/physics strength. Prerequisites are strongest. */
  strength: number;
}

export interface CompetencyGraph {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface SemesterTimelineStep {
  index: number;
  key: string;
  label: string;
  year: number;
  sem: number;
}

export interface RiverPebble {
  code: string;
  name: string;
  mcs: number;
  discipline: DisciplineId;
  year: number;
  sem: number;
  semesterLabel: string;
  /** MCs in the same discipline earlier in this semester. */
  semesterBefore: number;
  /** MCs in the same discipline accumulated before this module. */
  cumulativeBefore: number;
}

export type DisciplineMC = Record<DisciplineId, number>;

export interface RiverSemesterColumn extends SemesterTimelineStep {
  totalMcs: number;
  byDiscipline: DisciplineMC;
  cumulativeByDiscipline: DisciplineMC;
  pebbles: RiverPebble[];
}

export interface RiverData {
  columns: RiverSemesterColumn[];
  disciplines: DisciplineInfo[];
  /** Total MCs placed in the plan (waived modules are reported separately). */
  totalMcs: number;
  waivedMcs: number;
  cumulativeTotals: DisciplineMC;
  maxColumnMcs: number;
  /** Waived / advanced-standing modules, with no semester column. */
  waivedPebbles: RiverPebble[];
}

export interface GraphLineage {
  ancestors: Set<string>;
  descendants: Set<string>;
}
