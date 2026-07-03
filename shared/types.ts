export type Category = string;

export interface Module {
  code: string;
  name: string;
  mcs: number;
}

export interface MajorCategory {
  id: string;
  label: string;
  mcTarget?: number;
  color: string;
}

export interface RequirementRule {
  name: string;
  /** Module codes that satisfy this requirement. An entry ending in "*" matches by prefix
   * (e.g. "NTW*" matches any NTW-coded section); other entries match exactly. */
  fulfilledBy: string[];
  /** Number of distinct matching modules needed to satisfy this requirement. Defaults to 1. */
  count?: number;
  /** Groups this requirement under a MajorCategory (by id) in the requirements checklist.
   * Rows without one are rendered under a fallback "Other" group. */
  categoryId?: string;
}

export interface FocusArea {
  id: string;
  label: string;
  /** Primary courses. Completing the focus area draws from this list. */
  primaries: string[];
  /** Related courses that indicate the area but do not count toward completion. */
  electives?: string[];
  /** Distinct primaries needed to complete the area. Defaults to 3. */
  minCourses?: number;
  /** Of those, how many must be at level-4000 or above. Defaults to 1. */
  minSeniorCourses?: number;
}

export interface IndustryExperienceRule {
  minUnits: number;
  maxUnits: number;
  /** Exact course codes that count as Industry Experience. */
  courses: string[];
  /** Dissertation course that may replace Industry Experience (GPA/Honours gated). */
  dissertationAlternative?: string;
}

/** The multi-constraint Breadth & Depth requirement (e.g. NUS CS). Checked over
 * courses the student has tagged with `categoryId`. Focus areas live separately
 * on the major and satisfy the first constraint. */
export interface BreadthDepthConfig {
  categoryId: string;
  totalUnits: number;
  minLevel4000Units: number;
  industryExperience: IndustryExperienceRule;
  /** Allowed code prefixes for every non-Industry-Experience course. */
  allowedPrefixes: string[];
  /** Max units of courses matching `cpPrefix`, excluding Industry Experience. */
  maxCpUnits: number;
  cpPrefix: string;
}

export interface DefaultPlanEntry {
  year: number;
  sem: number;
  moduleCode: string;
  categoryId: string;
  locked?: boolean;
}

export interface PlacedModule extends Module {
  categoryId: string;
}

export type WaivedModule = PlacedModule;

export interface Major {
  id: string;
  label: string;
  school: string;
  specialisation?: string;
  /** Matriculation batches this major's data applies to, e.g. ["AY2025/2026"]
   * or ["AY2023/2024", "AY2024/2025", "AY2025/2026"] for a curriculum that
   * hasn't changed across multiple intakes. */
  batches: string[];
  totalMcTarget: number;
  categories: MajorCategory[];
  requirements: RequirementRule[];
  focusAreas?: FocusArea[];
  breadthDepth?: BreadthDepthConfig;
  moduleCatalog: Record<string, Module>;
  defaultPlan: DefaultPlanEntry[];
  defaultWaivedModules?: WaivedModule[];
}

/** A second major or minor a student can additionally declare alongside their
 * primary major. Deliberately lean compared to `Major`: no `school`,
 * `batches`, `defaultPlan`, `categories`, or `breadthDepth` — a secondary
 * programme never owns semester placement or a per-category MC bar, it is
 * only ever checked against whichever modules the student has already
 * placed for their primary major. */
export interface SecondaryProgramme {
  id: string;
  label: string;
  kind: 'second-major' | 'minor';
  /** 40 MC for a second major, 20 MC for a minor at NUS's standard sizes.
   * Also drives the double-counting cap: `mcTarget * 0.4`. */
  mcTarget: number;
  requirements: RequirementRule[];
  moduleCatalog: Record<string, Module>;
}

export interface StudentSemester {
  year: number;
  sem: number;
  modules: PlacedModule[];
}

export interface StudentPlan {
  majorId: string;
  /** At most 1 declared second major. */
  secondMajorId?: string;
  /** At most 3 declared minors. */
  minorIds?: string[];
  /** Manual links from a requirement (by its `RequirementRule.name`) to planner
   * module codes that should count toward it even though they don't match its
   * `fulfilledBy` list. A mapped code only counts while that module is actually
   * placed (or waived) in the plan. */
  requirementMappings?: Record<string, string[]>;
  semesters: StudentSemester[];
  waivedModules?: WaivedModule[];
  lastUpdated: string;
}