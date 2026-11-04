import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Major, SecondaryProgramme } from '@shared/types';
import { collectCandidateCourseCodes, enrichCandidateModules } from './recommendationData';
import * as nusmods from '@shared/nusmods';

describe('recommendationData', () => {
  const dummyMajor: Major = {
    id: 'test-major',
    label: 'Test Major',
    school: 'SoC',
    batches: ['AY2026/2027'],
    totalMcTarget: 160,
    categories: [],
    requirements: [
      {
        name: 'Electives Pool',
        fulfilledBy: ['CS3241', 'CS3242', 'CS3243', 'CS3244'],
      },
    ],
    defaultPlan: [],
    moduleCatalog: {},
    focusAreas: [
      {
        id: 'fa-ai',
        label: 'Artificial Intelligence',
        primaries: ['CS3243', 'CS3244'],
        electives: ['CS4243', 'CS4248'],
      },
    ],
  };

  const dummyMinor: SecondaryProgramme = {
    id: 'minor-econ',
    label: 'Minor in Economics',
    kind: 'minor',
    mcTarget: 20,
    requirements: [
      {
        name: 'Econ intro',
        fulfilledBy: ['EC1101E', 'EC2101'],
      },
    ],
    moduleCatalog: {},
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('collects candidate codes from focus areas, pools, and minors', () => {
    const codes = collectCandidateCourseCodes(dummyMajor, [dummyMinor], ['minor-econ']);
    expect(codes).toContain('CS3241');
    expect(codes).toContain('CS3243');
    expect(codes).toContain('CS4243');
    expect(codes).toContain('EC1101E');
    expect(codes).toContain('EC2101');
  });

  it('enriches modules with NUSMods descriptions', async () => {
    vi.spyOn(nusmods, 'fetchNusModsModuleDetail').mockImplementation(async (code) => ({
      acadYear: '2026-2027',
      detail: {
        moduleCode: code,
        title: `${code} Title`,
        description: `Description for ${code}`,
        moduleCredit: '4',
        semesterData: [{ semester: 1 }, { semester: 2 }],
      },
    }));

    const enriched = await enrichCandidateModules(['CS3243', 'CS3244'], 2);
    expect(enriched).toHaveLength(2);
    expect(enriched[0].code).toBe('CS3243');
    expect(enriched[0].description).toBe('Description for CS3243');
    expect(enriched[0].semestersOffered).toEqual([1, 2]);
  });
});
