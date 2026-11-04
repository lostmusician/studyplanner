import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Major, StudentSemester, WaivedModule } from '@shared/types';
import {
  generateMockRecommendation,
  generateAiStudyPlanRecommendation,
  type SurveyInput,
} from './aiPlanner';
import * as soclaas from './soclaas';

describe('aiPlanner', () => {
  const dummyMajor: Major = {
    id: 'computer-science-nusc',
    label: 'Computer Science (NUS College)',
    school: 'SoC',
    batches: ['AY2026/2027'],
    totalMcTarget: 160,
    categories: [
      { id: 'cs-foundation', label: 'CS Foundation', color: '#d4c9b8' },
      { id: 'breadth-depth', label: 'Breadth & Depth', color: '#c9d4b8' },
    ],
    requirements: [],
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

  const initialSemesters: StudentSemester[] = [
    {
      year: 1,
      sem: 1,
      modules: [
        { code: 'CS1101S', name: 'Programming Methodology', mcs: 4, categoryId: 'cs-foundation' },
        { code: 'CS1231S', name: 'Discrete Structures', mcs: 4, categoryId: 'cs-foundation' },
      ],
    },
    {
      year: 1,
      sem: 2,
      modules: [
        { code: 'CS2030S', name: 'Programming Methodology II', mcs: 4, categoryId: 'cs-foundation' },
        { code: 'CS2040S', name: 'Data Structures and Algorithms', mcs: 4, categoryId: 'cs-foundation' },
      ],
    },
    {
      year: 2,
      sem: 1,
      modules: [],
    },
    {
      year: 2,
      sem: 2,
      modules: [],
    },
  ];

  const waivedModules: WaivedModule[] = [];

  const survey: SurveyInput = {
    standingYear: 2,
    standingSem: 1, // Student is entering Y2S1 (so Y1S1 & Y1S2 are past/frozen)
    interests: ['Artificial Intelligence', 'Software Engineering'],
    careerGoal: 'AI Software Engineer',
    targetMcsPerSem: 20,
    interestedInNoc: false,
    nocDuration: null,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('freezes past semesters and only updates future semesters', () => {
    const result = generateMockRecommendation(
      dummyMajor,
      initialSemesters,
      waivedModules,
      survey,
      [],
    );

    // Y1S1 and Y1S2 should remain identical
    expect(result.updatedSemesters[0].modules.map((m) => m.code)).toEqual(['CS1101S', 'CS1231S']);
    expect(result.updatedSemesters[1].modules.map((m) => m.code)).toEqual(['CS2030S', 'CS2040S']);

    // Future semesters should have placed electives
    const futureModules = result.updatedSemesters[2].modules;
    expect(futureModules.length).toBeGreaterThan(0);
    expect(result.usedMock).toBe(true);
  });

  it('falls back to mock when SoCLaaS call fails or is unconfigured', async () => {
    vi.spyOn(soclaas, 'callSoclaasChat').mockRejectedValue(new Error('Unauthorized'));
    const result = await generateAiStudyPlanRecommendation(
      dummyMajor,
      initialSemesters,
      waivedModules,
      survey,
      [],
    );

    expect(result.usedMock).toBe(true);
    expect(result.trackTitle).toBeDefined();
    expect(result.updatedSemesters[0].modules.map((m) => m.code)).toEqual(['CS1101S', 'CS1231S']);
  });
});
