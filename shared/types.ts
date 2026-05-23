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
  fulfilledBy: string[];
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
