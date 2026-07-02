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

export interface DefaultPlanEntry {
  year: number;
  sem: number;
  moduleCode: string;
  categoryId: string;
}

export interface Major {
  id: string;
  label: string;
  school: string;
  specialisation?: string;
  totalMcTarget: number;
  categories: MajorCategory[];
  requirements: RequirementRule[];
  moduleCatalog: Record<string, Module>;
  defaultPlan: DefaultPlanEntry[];
}

export interface PlacedModule extends Module {
  categoryId: string;
}

export interface StudentSemester {
  year: number;
  sem: number;
  modules: PlacedModule[];
}

export interface StudentPlan {
  majorId: string;
  semesters: StudentSemester[];
  lastUpdated: string;
}
