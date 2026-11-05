import type { SecondaryProgramme } from '@shared/types';
import directory from '@shared/data/programme-directory.json';

// Editorial shortcuts, not an enrolment ranking: NUS does not publish one here.
export const FEATURED_PROGRAMMES = ['management', 'economics', 'data-analytics', 'mathematics', 'statistics', 'psychology', 'entrepreneurship', 'public-health', 'quantitative-finance', 'interactive-media-development'];

export const expandProgrammes = (kind: SecondaryProgramme['kind'], existing: SecondaryProgramme[]): SecondaryProgramme[] => {
  const merged = new Map(existing.map(p => [p.id, { ...p, requirementStatus: p.requirementStatus ?? 'partial' } as SecondaryProgramme]));
  for (const entry of directory.filter(p => p.kind === kind)) {
    const previous = merged.get(entry.id);
    merged.set(entry.id, { ...entry, kind, mcTarget: kind === 'minor' ? 20 : 40, requirements: [], moduleCatalog: {}, requirementStatus: 'review-needed', ...previous,
      school: entry.school, admission: entry.admission as 'open' | 'restricted', sourceUrl: previous?.sourceUrl ?? entry.sourceUrl,
      excludedPrimaryIds: 'excludedPrimaryIds' in entry ? entry.excludedPrimaryIds as string[] : previous?.excludedPrimaryIds,
      notes: [entry.notes, previous?.notes].filter(Boolean).join(' ') });
  }
  return [...merged.values()].sort((a, b) => {
    const rank = (id: string) => { const i = FEATURED_PROGRAMMES.indexOf(id); return i < 0 ? 999 : i; };
    return rank(a.id) - rank(b.id) || a.label.localeCompare(b.label);
  });
};

export const programmeRestriction = (programme: SecondaryProgramme, majorId: string, secondMajorId: string | null, minorIds: string[]): string | undefined => {
  if (programme.excludedPrimaryIds?.includes(majorId)) return 'Not offered with your primary major.';
  if (programme.kind === 'minor' && secondMajorId === programme.id) return 'Already selected as your second major.';
  if (programme.kind === 'second-major' && minorIds.includes(programme.id)) return 'Remove the minor in this subject first.';
  if (programme.notes?.includes('Semester 2 AY2026/27')) return 'Offered from Semester 2, AY2026/27.';
  return undefined;
};

export const DDP_SOURCE = 'https://www.nus.edu.sg/registrar/academic-information-policies/undergraduate-students/special-programmes/double-degree-programmes';
export const DDP_FRAMEWORK = `${DDP_SOURCE}/double-degree-programme-framework-and-guidelines`;
export const DOUBLE_DEGREES = [
  ['business-business-analytics', 'Business Administration / Accountancy + Business Analytics', ['business-analytics-nusc']],
  ['business-cnm', 'Business Administration / Accountancy + Communications and New Media', []],
  ['business-computing', 'Business Administration / Accountancy + Computer Science / Information Systems', ['computer-science-nusc']],
  ['business-engineering', 'Business Administration / Accountancy + Engineering', []],
  ['business-law', 'Business Administration / Accountancy + Law', []],
  ['cs-mathematics', 'Computer Science + Mathematics', ['computer-science-nusc']],
  ['ai-mathematics', 'Artificial Intelligence + Mathematics', ['artificial-intelligence-nusc']],
  ['economics-business', 'Economics + Business Administration / Accountancy', []],
  ['economics-business-analytics', 'Economics + Business Analytics', ['business-analytics-nusc']],
  ['economics-law', 'Economics + Law', []],
  ['economics-information-systems', 'Economics + Information Systems', []],
  ['cde-chs', 'Engineering / Design / Architecture + Humanities / Sciences', []],
  ['engineering-design', 'Engineering + Industrial Design / Architecture / Landscape Architecture', []],
  ['design-architecture', 'Industrial Design + Architecture / Landscape Architecture', []],
  ['engineering-engineering', 'Two Engineering degrees', []],
].map(([id, label, primaryIds]) => ({ id: id as string, label: label as string, primaryIds: primaryIds as string[], sourceUrl: DDP_SOURCE }));
export const normalizeDoubleDegreeId = (value: unknown): string | null => typeof value === 'string' && DOUBLE_DEGREES.some(p => p.id === value) ? value : null;
