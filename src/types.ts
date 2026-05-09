export type Category =
  | 'Primary Major'
  | 'SOC/NUSC'
  | 'Other Programmes'
  | 'University Requirements'
  | 'Unrestricted Electives';

export interface Module {
  code: string;
  name: string;
  mcs: number;
  category: Category;
}

export interface Semester {
  year: number;
  sem: number;
  modules: Module[];
}

export interface Requirement {
  name: string;
  fulfilledBy: string[];
  isFulfilled: boolean;
}

export interface RequirementRule {
  name: string;
  fulfilledBy: string[];
}

export interface CareerTrackItem {
  code: string;
  name: string;
  mcs: number;
}

export interface MajorDefinition {
  id: string;
  label: string;
  school: string;
  specialisation: string;
  studentName: string;
  matricNo: string;
  categories: Category[];
  requirements: RequirementRule[];
  careerTracks: CareerTrackItem[];
  moduleCatalog: Record<string, Module>;
  initialSemesters: Semester[];
}

export interface StudyPlanStats {
  totalMc: number;
  primaryMajorMc: number;
  socMc: number;
  byCategory: Record<Category, number>;
  bySemester: Record<string, number>;
}

export type SemesterKey = `${number}-${number}`;