import { CourseSharingBadge } from '../components/CourseSharingBadge';
import { withAllocationChoice } from '@shared/allocationPreferences';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Major, PlacedModule, SecondaryProgramme, StudentSemester } from '@shared/types';
import { allocateRequirements } from './requirementAllocation';
import { computeStats } from './studyPlan';
import { RequirementAllocationPanel, CourseUsageDetails } from '../components/RequirementAllocationPanel';
import { StatsSummary } from '../components/StatsSummary';
import { PrintView } from '../components/PrintView';

const primary: Major = { id: 'primary', label: 'Primary', school: '', batches: [], totalMcTarget: 160,
  categories: [{ id: 'foundation', label: 'Foundation', color: '#aaa', mcTarget: 8 },
    { id: 'minor-statistics', label: 'Statistics minor', color: '#aaa', mcTarget: 20 }],
  requirements: [], moduleCatalog: {}, defaultPlan: [] };
const secondary: SecondaryProgramme = { id: 'statistics', label: 'Statistics', kind: 'minor', mcTarget: 20,
  requirements: [{ name: 'Five electives', fulfilledBy: ['A', 'D', 'E', 'F', 'G'], count: 5 }], moduleCatalog: {} };
const modules: PlacedModule[] = ['A', 'B', 'D', 'E', 'F', 'G'].map(code => ({ code, name: `Course ${code}`, mcs: 4, categoryId: ['A', 'B'].includes(code) ? 'foundation' : 'unrestricted-electives' }));
const semesters: StudentSemester[] = [{ year: 1, sem: 1, modules }];
const allocation = allocateRequirements(primary, [secondary], semesters);
const text = (markup: string) => markup.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('allocation interface integration', () => {
  it('shows actual sharing and names the courses used for each requirement', () => {
    const markup = renderToStaticMarkup(createElement(RequirementAllocationPanel, {
      source: secondary, allocation: allocation.programmes[1], report: allocation, modules, onUpdateModule: () => ({ ok: true } as const),
    }));
    expect(text(markup)).toContain('Shared credits 4 / 8 MC');
    expect(text(markup)).toContain('A · shared');
    expect(markup).toContain('Choose courses for Statistics: Five electives');
    const detail = renderToStaticMarkup(createElement(CourseUsageDetails, { code: 'A', report: allocation }));
    expect(detail).toContain('How A is used');
    expect(text(detail)).toContain('Primary');
    expect(text(detail)).toContain('Foundation credits');
    expect(text(detail)).toContain('Five electives');
  });

  it('uses allocated credits in the top programme card rather than category-only credits', () => {
    const stats = computeStats(primary, semesters);
    expect(stats.byCategory['minor-statistics']).toBeUndefined();
    const markup = renderToStaticMarkup(createElement(StatsSummary, {
      major: primary, semesters, waivedModules: [], stats, requirements: [], requirementMappings: {},
      addRequirementMapping: () => {}, removeRequirementMapping: () => {}, programmeAllocations: allocation.programmes,
      onOpenProgrammeAllocation: () => {},
    }));
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(text(markup)).toContain('Statistics minor 20 / 20 MC assigned · 4/8 shared');
  });

  it('flags a programme whose sharing allowance is exceeded', () => {
    const programmes = allocation.programmes.map(p => p.kind === 'minor' ? { ...p, sharedMc: 12 } : p);
    const markup = renderToStaticMarkup(createElement(StatsSummary, {
      major: primary, semesters, waivedModules: [], stats: computeStats(primary, semesters), requirements: [], requirementMappings: {},
      addRequirementMapping: () => {}, removeRequirementMapping: () => {}, programmeAllocations: programmes,
      onOpenProgrammeAllocation: () => {},
    }));
    expect(text(markup)).toContain('Statistics minor Review');
    expect(text(markup)).toContain('12/8 shared');
  });

  it('prints the same selected courses and sharing totals', () => {
    const markup = renderToStaticMarkup(createElement(PrintView, {
      studentName: 'Test', matricNumber: '', studentYear: 'Year 1', major: primary,
      stats: computeStats(primary, semesters), requirements: [], allocation, semesters, waivedModules: [],
      secondMajors: [], minors: [secondary], doubleDegreeId: null, secondMajorId: null, minorIds: ['statistics'],
      nocDuration: null, specialProgrammes: [],
    }));
    expect(text(markup)).toContain('4/8 MC shared with other programmes.');
    expect(text(markup)).toContain('A, D, E, F, G');
  });
});


describe('grid sharing badges', () => {
  it('labels courses used by multiple programmes', () => {
    const markup = renderToStaticMarkup(createElement(CourseSharingBadge, { code: 'A', allocation }));
    expect(markup).toContain('Shared course A');
    expect(markup).toContain('aria-haspopup="dialog"');
  });

  it('leaves primary-only and minor-only courses unlabelled', () => {
    expect(renderToStaticMarkup(createElement(CourseSharingBadge, { code: 'B', allocation }))).toBe('');
    expect(renderToStaticMarkup(createElement(CourseSharingBadge, { code: 'D', allocation }))).toBe('');
    expect(renderToStaticMarkup(createElement(CourseSharingBadge, { code: 'MISSING', allocation }))).toBe('');
  });

  it('marks a real over-allowance assignment as a conflict', () => {
    const constrained = { ...secondary, mcTarget: 8, requirements: [{ name: 'Required pair', fulfilledBy: ['A', 'D'], count: 2 }] };
    const pinned = modules.map(module => module.code === 'A'
      ? withAllocationChoice(module, 'minor:statistics', 'requirement:Required pair', 'include') : module);
    const report = allocateRequirements(primary, [constrained], [{ year: 1, sem: 1, modules: pinned }]);
    expect(report.programmes[1].sharedMc).toBeGreaterThan(report.programmes[1].capMc!);
    expect(renderToStaticMarkup(createElement(CourseSharingBadge, { code: 'A', allocation: report }))).toContain('Conflict course A');
  });
});
