import type {
  Major,
  NocDuration,
  SecondaryProgramme,
  SpecialProgramme,
  StudentSemester,
  WaivedModule,
} from '@shared/types';
import { getMceWaiverCount } from '@shared/pathways';
import { programmeRestriction } from './programmes';
import { applyNocAdjustment, computeRequirements, computeUeTarget } from './studyPlan';

/** NUS caps a declared minor count at three; keep this in sync with the
 * `MAX_MINORS` guard inside useStudyPlan so the gallery never offers an
 * addition the hook would silently drop. */
export const GALLERY_MINOR_CAP = 3;

export type GalleryKind = 'major' | 'second-major' | 'minor' | 'overseas';

export const GALLERY_KINDS: { id: GalleryKind; label: string }[] = [
  { id: 'major', label: 'Primary majors' },
  { id: 'second-major', label: 'Second majors' },
  { id: 'minor', label: 'Minors' },
  { id: 'overseas', label: 'Overseas & global' },
];

export const programmeKindLabel = (programme: Pick<SecondaryProgramme, 'kind'>): string =>
  programme.kind === 'second-major' ? 'Second major' : 'Minor';

interface SearchableProgramme {
  label: string;
  school?: string;
}

/** Title + faculty search shared by the major, second-major and minor lists. */
export const filterProgrammes = <T extends SearchableProgramme>(
  programmes: T[],
  query: string,
  school = '',
): T[] => {
  const needle = query.trim().toLowerCase();
  return programmes.filter((programme) => {
    if (school && programme.school !== school) return false;
    if (!needle) return true;
    return `${programme.label} ${programme.school ?? ''}`.toLowerCase().includes(needle);
  });
};

export interface MajorRequirementItem {
  name: string;
  /** Course-count or unit target, shown only when it adds information. */
  amount?: string;
  /** Codes from `fulfilledBy`, omitting a lone code already named in the label. */
  courses: string[];
  /** Each `altGroups` entry as a human-readable "A + B" alternative. */
  alternatives: string[];
  /** A requirement with no course list, such as the Global Pathway choice. */
  nonCourse: boolean;
  globalPathway: boolean;
}

export interface MajorRequirementGroup {
  id: string;
  label: string;
  mcTarget?: number;
  requirements: MajorRequirementItem[];
}

/** Groups a primary major's real requirement rules by their curriculum
 * category for the Explore details view. Only categories that actually carry
 * named requirement rows are returned; the UI shows the full category/MC
 * breakdown separately from the major's own data. */
export const buildMajorRequirementGroups = (major: Major): MajorRequirementGroup[] => {
  const groups = new Map<string, MajorRequirementGroup>();
  for (const category of major.categories) {
    groups.set(category.id, {
      id: category.id,
      label: category.label,
      mcTarget: category.mcTarget,
      requirements: [],
    });
  }
  const fallback: MajorRequirementGroup = {
    id: 'other',
    label: 'Other requirements',
    requirements: [],
  };

  for (const requirement of major.requirements) {
    let group = requirement.categoryId ? groups.get(requirement.categoryId) : undefined;
    if (!group) {
      group = groups.get('other');
      if (!group) {
        group = fallback;
        groups.set('other', fallback);
      }
    }
    const courses = requirement.fulfilledBy.filter(Boolean);
    const amount =
      requirement.minUnits !== undefined
        ? `${requirement.minUnits} units`
        : (requirement.count ?? 1) > 1
          ? `${requirement.count} courses`
          : undefined;
    group.requirements.push({
      name: requirement.name,
      amount,
      courses: courses.filter((code) => !requirement.name.includes(code)),
      alternatives: (requirement.altGroups ?? []).map((codes) => codes.join(' + ')),
      nonCourse: courses.length === 0,
      globalPathway: /global pathway/i.test(requirement.name),
    });
  }

  return [...groups.values()].filter((group) => group.requirements.length > 0);
};

export interface FacultyOption {
  value: string;
  label: string;
  count: number;
}

export const collectFaculties = (programmes: SearchableProgramme[]): FacultyOption[] => {
  const counts = new Map<string, number>();
  for (const programme of programmes) {
    if (!programme.school) continue;
    counts.set(programme.school, (counts.get(programme.school) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((a, b) => a.label.localeCompare(b.label));
};

export type CoverageStatus = 'covered' | 'partial' | 'remaining';

export interface ProgrammeCoverageRow {
  name: string;
  status: CoverageStatus;
  have: number;
  need: number;
  /** True when the rule is measured in course units rather than course count. */
  units: boolean;
  info?: string;
}

export interface ProgrammeCoverage {
  /** False for directory-only entries, which carry no authored course rules. */
  authored: boolean;
  rows: ProgrammeCoverageRow[];
  covered: number;
  partial: number;
  remaining: number;
  /** Every authored row is covered — still a checklist result, not a graduation claim. */
  allCovered: boolean;
}

/** Maps the authored requirement rows of a secondary programme onto the
 * courses currently placed or waived in the plan. Row counts are reported as
 * checklist progress; they are deliberately not converted into a percentage,
 * a "completed" state, or an exact total of additional units. */
export const buildProgrammeCoverage = (
  programme: SecondaryProgramme,
  semesters: StudentSemester[],
  waivedModules: WaivedModule[] = [],
): ProgrammeCoverage => {
  const authored = programme.requirements.length > 0;
  const statuses = authored ? computeRequirements(programme, semesters, waivedModules) : [];
  const rows = statuses.map<ProgrammeCoverageRow>((row) => {
    const rule = programme.requirements.find((candidate) => candidate.name === row.name);
    const status: CoverageStatus = row.fulfilled ? 'covered' : row.have > 0 ? 'partial' : 'remaining';
    return {
      name: row.name,
      status,
      have: row.have,
      need: row.need,
      units: rule?.minUnits !== undefined,
      info: row.info,
    };
  });
  return {
    authored,
    rows,
    covered: rows.filter((row) => row.status === 'covered').length,
    partial: rows.filter((row) => row.status === 'partial').length,
    remaining: rows.filter((row) => row.status === 'remaining').length,
    allCovered: rows.length > 0 && rows.every((row) => row.status === 'covered'),
  };
};

export const coverageStatusLabel: Record<CoverageStatus, string> = {
  covered: 'Covered by plan',
  partial: 'Partly covered',
  remaining: 'Not covered yet',
};

export interface SecondarySelectionContext {
  majorId: string;
  secondMajorId: string | null;
  minorIds: string[];
  minorCap?: number;
}

/** Why a secondary programme cannot be added right now. Selected programmes
 * are always removable, even if they have become unavailable (for example an
 * imported plan combining a minor with a second major in the same subject). */
export const secondarySelectionBlock = (
  programme: SecondaryProgramme,
  context: SecondarySelectionContext,
): string | undefined => {
  const cap = context.minorCap ?? GALLERY_MINOR_CAP;
  const selected =
    programme.kind === 'minor'
      ? context.minorIds.includes(programme.id)
      : context.secondMajorId === programme.id;
  if (selected) return undefined;

  const restriction = programmeRestriction(
    programme,
    context.majorId,
    context.secondMajorId,
    context.minorIds,
  );
  if (restriction) return restriction;
  if (programme.kind === 'minor' && context.minorIds.length >= cap) {
    return `You already have ${cap} minors selected. Remove one first.`;
  }
  return undefined;
};

const NOC_DURATIONS: NocDuration[] = ['3-month', '6-month', '1-year'];

export const NOC_DURATION_LABELS: Record<NocDuration, string> = {
  '3-month': 'NOC · 3 months',
  '6-month': 'NOC · 6 months',
  '1-year': 'NOC · 12 months',
};

export interface NocPreview {
  duration: NocDuration;
  label: string;
  waiverCount: number;
  defaultMceNeed: number;
  mceNeed: number;
  nusCollegeTarget: number | null;
  adjustedNusCollegeTarget: number | null;
  ueTarget: number;
  adjustedUeTarget: number;
}

/** Previews each NOC duration against the *unadjusted* base major found by id.
 * The plan's display major is already NOC-adjusted, so adjusting that one again
 * would stack waivers. Taking the catalogue and id here makes that mistake
 * impossible for callers. */
export const buildNocPreviews = (majors: Major[], majorId: string): NocPreview[] => {
  const baseMajor = majors.find((major) => major.id === majorId);
  if (!baseMajor) return [];

  const defaultMceNeed =
    baseMajor.requirements.find((requirement) => requirement.name.startsWith('Making Connections'))
      ?.count ?? 0;
  const baseNusCollegeTarget =
    baseMajor.categories.find((category) => category.id === 'nus-college')?.mcTarget;
  const ueTarget = computeUeTarget(baseMajor);

  return NOC_DURATIONS.map((duration) => {
    const waiverCount = getMceWaiverCount([`noc-${duration}` as SpecialProgramme]);
    const adjusted = applyNocAdjustment(baseMajor, duration);
    return {
      duration,
      label: NOC_DURATION_LABELS[duration],
      waiverCount,
      defaultMceNeed,
      mceNeed:
        adjusted.requirements.find((requirement) => requirement.name.startsWith('Making Connections'))
          ?.count ?? defaultMceNeed,
      nusCollegeTarget: baseNusCollegeTarget ?? null,
      adjustedNusCollegeTarget:
        adjusted.categories.find((category) => category.id === 'nus-college')?.mcTarget ?? null,
      ueTarget,
      adjustedUeTarget: computeUeTarget(adjusted),
    };
  });
};

export interface PathwayLink {
  label: string;
  url: string;
}

export interface PathwayInfo {
  id: SpecialProgramme;
  label: string;
  kind: 'experience' | 'noc';
  /** One-line plan effect shown on the gallery card. */
  shortEffect: string;
  /** Concrete plan effects, one sentence each. */
  effects: string[];
  links: PathwayLink[];
}

export const NUSC_ACADEMIC_INFO_URL =
  'https://nuscollege.nus.edu.sg/academics/the-nusc-curriculum/nusc-academic-info/';
export const NUSC_PWW_CURRICULUM_URL =
  'https://nuscollege.nus.edu.sg/wp-content/uploads/2025/07/NUSC-curriculum-requirements_AY2025onwards_v2.pdf';
export const NOC_INTERNSHIP_URL =
  'https://enterprise.nus.edu.sg/education-programmes/nus-overseas-colleges/programmes/curriculum-overview/internship-courses-cde-soc/';

const EXPERIENCE_LINKS: PathwayLink[] = [
  { label: 'NUSC academic information', url: NUSC_ACADEMIC_INFO_URL },
];

const NOC_LINKS: PathwayLink[] = [
  { label: 'NUSC academic information', url: NUSC_ACADEMIC_INFO_URL },
  { label: 'NUSC Programme-With-Waivers curriculum', url: NUSC_PWW_CURRICULUM_URL },
  { label: 'NOC internship courses', url: NOC_INTERNSHIP_URL },
];

const experienceEffects = (selection: string): string[] => [
  `Selecting ${selection} satisfies the planned Global Pathway requirement in your plan.`,
  `${selection} selection does not award course credits on its own.`,
  'Approved course mappings or a placed NEX course (GEx) are needed before courses count toward Making Connections.',
];

export const PATHWAY_INFO: PathwayInfo[] = [
  {
    id: 'sep',
    label: 'SEP',
    kind: 'experience',
    shortEffect: 'No course credit automatically',
    effects: [
      ...experienceEffects('SEP'),
      'SEP selection does not relax the Making Connections HSS/ST domain minimums.',
    ],
    links: EXPERIENCE_LINKS,
  },
  {
    id: 'gex',
    label: 'GEx',
    kind: 'experience',
    shortEffect: 'NEX course needed for credit',
    effects: [
      'Selecting GEx satisfies the planned Global Pathway requirement in your plan.',
      'GEx selection alone does not award course credit.',
      'A placed NEX course counts once toward Making Connections.',
    ],
    links: EXPERIENCE_LINKS,
  },
  {
    id: 'regional-iex',
    label: 'Regional IEx',
    kind: 'experience',
    shortEffect: 'No course credit automatically',
    effects: experienceEffects('Regional IEx'),
    links: EXPERIENCE_LINKS,
  },
  {
    id: 'siip',
    label: 'SIIP',
    kind: 'experience',
    shortEffect: 'No course credit automatically',
    effects: experienceEffects('SIIP'),
    links: EXPERIENCE_LINKS,
  },
  {
    id: 'noc-3-month',
    label: NOC_DURATION_LABELS['3-month'],
    kind: 'noc',
    shortEffect: 'No MCE waiver',
    effects: [
      'Selecting NOC satisfies the planned Global Pathway requirement in your plan.',
      'A 3-month NOC waives no Making Connections electives (MCEs).',
      'Industry Experience credit needs an approved internship course placed on the plan.',
    ],
    links: NOC_LINKS,
  },
  {
    id: 'noc-6-month',
    label: NOC_DURATION_LABELS['6-month'],
    kind: 'noc',
    shortEffect: 'Waives 2 MCEs',
    effects: [
      'Selecting NOC satisfies the planned Global Pathway requirement in your plan.',
      'A 6-month NOC reduces Making Connections from 6 to 4 MCEs.',
      'HSS/ST domain and taught-course minimums still apply; approved internship courses are needed for industry credit.',
    ],
    links: NOC_LINKS,
  },
  {
    id: 'noc-1-year',
    label: NOC_DURATION_LABELS['1-year'],
    kind: 'noc',
    shortEffect: 'Waives 4 MCEs',
    effects: [
      'Selecting NOC satisfies the planned Global Pathway requirement in your plan.',
      'A 12-month NOC reduces Making Connections from 6 to 2 MCEs.',
      'HSS/ST domain and taught-course minimums still apply; approved internship courses are needed for industry credit.',
    ],
    links: NOC_LINKS,
  },
];

export const getPathwayInfo = (id: SpecialProgramme): PathwayInfo | undefined =>
  PATHWAY_INFO.find((info) => info.id === id);

export const matchesPathwayQuery = (info: PathwayInfo, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return `${info.label} ${info.kind === 'noc' ? 'NUS Overseas Colleges NOC overseas' : 'global pathway exchange'} ${info.shortEffect}`
    .toLowerCase()
    .includes(needle);
};

/** The current NOC duration carried by a plan, if any. */
export const getSelectedNocDuration = (programmes: SpecialProgramme[]): NocDuration | null => {
  const noc = programmes.find((programme) => programme.startsWith('noc-'));
  return noc ? (noc.slice(4) as NocDuration) : null;
};
