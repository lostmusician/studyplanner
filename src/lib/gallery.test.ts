import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Major, SecondaryProgramme, SpecialProgramme, StudentSemester } from '@shared/types';
import { toggleSpecialProgramme } from '@shared/pathways';
import economicsSm from '@shared/data/second-majors/economics.json';
import { applyNocAdjustment, computeUeTarget } from './studyPlan';
import { expandProgrammes } from './programmes';
import {
  PATHWAY_INFO,
  buildMajorRequirementGroups,
  buildNocPreviews,
  buildProgrammeCoverage,
  collectFaculties,
  filterProgrammes,
  matchesPathwayQuery,
  secondarySelectionBlock,
} from './gallery';
import { ExploreGallery } from '../components/ExploreGallery';
import { ExploreDetailDialog } from '../components/ExploreDetailDialog';

const majors = Object.values(import.meta.glob('../../shared/data/majors/*.json', { eager: true }))
  .map((module) => (module as { default: Major }).default);
const secondMajors = expandProgrammes('second-major', [economicsSm as SecondaryProgramme]);
const minors = expandProgrammes('minor', []);
const economics = secondMajors.find((programme) => programme.id === 'economics')!;
const anthropology = minors.find((programme) => programme.id === 'anthropology')!;

const planned = (codes: string[]): StudentSemester[] => [
  {
    year: 1,
    sem: 1,
    modules: codes.map((code) => ({ code, name: code, mcs: 4, categoryId: 'unrestricted-electives' })),
  },
];

const galleryProps = {
  majors,
  majorId: 'computer-science-nusc',
  secondMajors,
  minors,
  secondMajorId: null,
  minorIds: [],
  specialProgrammes: ['sep' as const],
  semesters: [],
  waivedModules: [],
  onRequestSwitchMajor: () => {},
  setSecondMajorId: () => {},
  toggleMinorId: () => {},
  togglePathway: () => {},
};

const detailProps = {
  majorId: 'computer-science-nusc',
  secondMajorId: null,
  minorIds: [],
  specialProgrammes: [] as SpecialProgramme[],
  semesters: [],
  waivedModules: [],
  nocPreviews: [],
  onClose: () => {},
  onRequestSwitchMajor: () => {},
  setSecondMajorId: () => {},
  toggleMinorId: () => {},
  togglePathway: () => {},
};

describe('Explore gallery catalogue', () => {
  it('searches titles and faculty and derives faculty counts', () => {
    expect(filterProgrammes(secondMajors, 'econ').map((programme) => programme.id)).toContain('economics');
    expect(filterProgrammes(secondMajors, '  SCHOOL OF COMPUTING ').map((programme) => programme.id)).toContain('computer-science');
    expect(filterProgrammes(secondMajors, 'zzzz-no-match')).toEqual([]);

    const science = filterProgrammes(secondMajors, '', 'Faculty of Science');
    expect(science.length).toBeGreaterThan(0);
    expect(science.every((programme) => programme.school === 'Faculty of Science')).toBe(true);
    expect(collectFaculties(secondMajors).find((faculty) => faculty.value === 'Faculty of Science')?.count).toBe(science.length);
  });

  it('only exposes the five supported primary majors', () => {
    expect(majors.map((major) => major.id).sort()).toEqual([
      'artificial-intelligence-nusc',
      'business-ai-systems-nusc',
      'business-analytics-nusc',
      'computer-science-nusc',
      'information-security-nusc',
    ]);
  });

  it('describes overseas pathways with official links and NOC-specific effects', () => {
    expect(PATHWAY_INFO).toHaveLength(7);
    expect(PATHWAY_INFO.every((info) => info.links.every((link) => link.url.startsWith('https://')))).toBe(true);
    expect(PATHWAY_INFO.find((info) => info.id === 'noc-6-month')?.shortEffect).toBe('Waives 2 MCEs');
    expect(PATHWAY_INFO.find((info) => info.id === 'sep')?.effects.join(' ')).toContain('does not award course credits');
    expect(matchesPathwayQuery(PATHWAY_INFO.find((info) => info.id === 'gex')!, 'gex')).toBe(true);
    expect(matchesPathwayQuery(PATHWAY_INFO[0], 'no-such-pathway')).toBe(false);
  });
});

describe('secondary programme coverage', () => {
  it('reports authored checklist rows as covered, partial or remaining', () => {
    const coverage = buildProgrammeCoverage(economics, planned(['EC1101E', 'EC2101']));
    expect(coverage.authored).toBe(true);
    expect(coverage.rows).toHaveLength(10);
    expect(coverage.covered).toBe(2);
    expect(coverage.partial).toBe(1);
    expect(coverage.remaining).toBe(7);
    expect(coverage.allCovered).toBe(false);
    expect(coverage.rows.find((row) => row.name === 'Introduction to Economic Analysis (EC1101E)')?.status).toBe('covered');
    expect(coverage.rows.find((row) => row.name.startsWith('Economics courses toward 40 MC'))?.status).toBe('partial');
  });

  it('marks all authored rows without claiming graduation', () => {
    const allCodes = ['EC1101E', 'EC2101', 'EC2102', 'EC2104', 'EC2303', 'EC3101', 'EC3102', 'EC3303', 'EC3304', 'EC4301'];
    const coverage = buildProgrammeCoverage(economics, planned(allCodes));
    expect(coverage.allCovered).toBe(true);
    expect(coverage.rows.every((row) => row.status === 'covered')).toBe(true);
  });

  it('keeps directory-only programmes explicitly unauthored', () => {
    const coverage = buildProgrammeCoverage(anthropology, planned(['EC1101E']));
    expect(coverage).toMatchObject({ authored: false, rows: [], covered: 0, partial: 0, remaining: 0, allCovered: false });
  });
});

describe('primary major requirements', () => {
  it('groups real requirement rules by curriculum category', () => {
    const cs = majors.find((major) => major.id === 'computer-science-nusc')!;
    const groups = buildMajorRequirementGroups(cs);
    const common = groups.find((group) => group.id === 'soc-common')!;
    expect(common.requirements.map((requirement) => requirement.name)).toContain('Programming Methodology (CS1101S)');
    expect(common.mcTarget).toBe(8);

    const college = groups.find((group) => group.id === 'nus-college')!;
    expect(college.requirements.find((requirement) => requirement.name === 'Making Connections')).toMatchObject({
      amount: '6 courses',
      nonCourse: false,
    });
    expect(college.requirements.find((requirement) => requirement.globalPathway)).toMatchObject({
      nonCourse: true,
      name: 'Global Pathways (NOC / SEP / GEx / Regional IEx / SIIP)',
    });
  });
});

describe('selection guards', () => {
  const mathematicsMinor = minors.find((programme) => programme.id === 'mathematics')!;

  it('blocks same-subject conflicts and minor caps but allows removal', () => {
    expect(secondarySelectionBlock(mathematicsMinor, {
      majorId: 'computer-science-nusc', secondMajorId: 'mathematics', minorIds: [],
    })).toContain('second major');
    expect(secondarySelectionBlock(mathematicsMinor, {
      majorId: 'computer-science-nusc', secondMajorId: null, minorIds: ['psychology', 'economics', 'statistics'],
    })).toContain('3 minors');
    expect(secondarySelectionBlock(mathematicsMinor, {
      majorId: 'computer-science-nusc', secondMajorId: null, minorIds: ['psychology', 'economics', 'statistics', 'mathematics'],
    })).toBeUndefined();
  });

  it('blocks programmes excluded by the primary major', () => {
    const computingMinor = minors.find((programme) => programme.id === 'computer-science')!;
    expect(secondarySelectionBlock(computingMinor, {
      majorId: 'computer-science-nusc', secondMajorId: null, minorIds: [],
    })).toBeTruthy();
  });
});

describe('NOC preview', () => {
  it('previews each duration against the unadjusted base major', () => {
    const previews = buildNocPreviews(majors, 'computer-science-nusc');
    expect(previews.map((preview) => preview.duration)).toEqual(['3-month', '6-month', '1-year']);
    expect(previews.find((preview) => preview.duration === '3-month')).toMatchObject({
      waiverCount: 0, defaultMceNeed: 6, mceNeed: 6, nusCollegeTarget: 52, ueTarget: 20, adjustedUeTarget: 20,
    });
    expect(previews.find((preview) => preview.duration === '6-month')).toMatchObject({
      waiverCount: 2, mceNeed: 4, adjustedNusCollegeTarget: 44, adjustedUeTarget: 28,
    });
    expect(previews.find((preview) => preview.duration === '1-year')).toMatchObject({
      waiverCount: 4, mceNeed: 2, adjustedNusCollegeTarget: 36, adjustedUeTarget: 36,
    });
  });

  it('never stacks a second NOC adjustment on an already adjusted major', () => {
    const base = majors.find((major) => major.id === 'computer-science-nusc')!;
    const oneYear = buildNocPreviews(majors, 'computer-science-nusc').find((preview) => preview.duration === '1-year')!;
    expect(oneYear.adjustedUeTarget).toBe(computeUeTarget(applyNocAdjustment(base, '1-year')));
    expect(oneYear.adjustedUeTarget).not.toBe(computeUeTarget(applyNocAdjustment(applyNocAdjustment(base, '6-month'), '1-year')));
  });

  it('keeps NOC replacement exclusive while preserving other pathways', () => {
    expect(toggleSpecialProgramme(['sep', 'noc-6-month'], 'noc-1-year')).toEqual(['sep', 'noc-1-year']);
    expect(toggleSpecialProgramme(['sep', 'noc-1-year'], 'noc-1-year')).toEqual(['sep']);
  });
});

describe('Explore gallery rendering', () => {
  it('renders the primary-major landing view without fake completion states', () => {
    const markup = renderToStaticMarkup(createElement(ExploreGallery, galleryProps));
    expect(markup).toContain('Explore programmes');
    expect(markup).toContain('Find a programme or global experience that fits your plan.');
    expect(markup).toContain('Computer Science (NUS College)');
    expect(markup).toContain('Primary majors');
    expect(markup).toContain('Current plan');
    expect(markup).not.toContain('100%');
    expect(markup).not.toContain('Completed');
  });

  it('renders a directory-only detail as manual review with a source link', () => {
    const markup = renderToStaticMarkup(createElement(ExploreDetailDialog, {
      ...detailProps,
      target: { kind: 'secondary', programme: anthropology },
    }));
    expect(markup).toContain('Manual review required');
    expect(markup).toContain('does not store the course checklist');
    expect(markup).toContain(anthropology.sourceUrl!);
    expect(markup).not.toContain('100%');
    expect(markup).not.toContain('Completed');
  });

  it('renders real primary-major course requirements instead of implementation statistics', () => {
    const cs = majors.find((major) => major.id === 'computer-science-nusc')!;
    const markup = renderToStaticMarkup(createElement(ExploreDetailDialog, {
      ...detailProps,
      target: { kind: 'major', major: cs },
    }));
    expect(markup).toContain('Course requirements');
    expect(markup).toContain('Programming Methodology (CS1101S)');
    expect(markup).toContain('Global Pathways');
    expect(markup).toContain('Non-course requirement');
    expect(markup).not.toContain('Sample plan entries');
    expect(markup).not.toContain('Requirement rows');
    expect(markup).not.toContain('Authored categories');
    expect(markup).not.toContain('authored');
  });

  it('renders checklist coverage and NOC previews without mutating plan data', () => {
    const before = JSON.stringify(planned(['EC1101E', 'EC2101']));
    const authored = renderToStaticMarkup(createElement(ExploreDetailDialog, {
      ...detailProps,
      semesters: planned(['EC1101E', 'EC2101']),
      target: { kind: 'secondary', programme: economics },
    }));
    expect(authored).toContain('course requirements covered by your current plan');
    expect(authored).toContain('Partly covered');
    expect(authored).toContain('need manual review');

    const noc = renderToStaticMarkup(createElement(ExploreDetailDialog, {
      ...detailProps,
      nocPreviews: buildNocPreviews(majors, 'computer-science-nusc'),
      target: { kind: 'pathway', id: 'noc-6-month' },
    }));
    expect(noc).toContain('Making Connections');
    expect(noc).toContain('6 → 4 MCEs');
    expect(noc).toContain('before any NOC adjustment');
    expect(noc).toContain('no partner-university course');
    expect(JSON.stringify(planned(['EC1101E', 'EC2101']))).toBe(before);
  });
});
