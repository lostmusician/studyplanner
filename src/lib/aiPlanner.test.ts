import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Major, StudentSemester, WaivedModule, SecondaryProgramme } from '@shared/types';
import {
  generateMockRecommendation,
  generateAiStudyPlanRecommendation,
  iterateAiStudyPlanRecommendation,
  iterateMockRecommendation,
  cleanJsonResponse,
  type SurveyInput,
  type RecommendationResult,
} from './aiPlanner';
import * as soclaas from './soclaas';
import * as nusmods from '@shared/nusmods';

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

  const emptyResult = (): RecommendationResult => ({
    trackTitle: 'Existing track', trackRationale: 'Existing rationale', recommendedMinorId: null,
    recommendedElectives: [], updatedSemesters: initialSemesters.map(s => ({ ...s, modules: s.modules.map(m => ({ ...m })) })),
    addedModules: [], warnings: [], usedMock: true,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(nusmods, 'getCachedModuleDetail').mockReturnValue(undefined);
    vi.spyOn(nusmods, 'fetchNusModsModuleDetail').mockImplementation(async code => ({ acadYear: '2026-2027', detail: { moduleCode: code, title: code, moduleCredit: '4', semesterData: [{ semester: 1 }, { semester: 2 }] } }));
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

  it('throws an error when SoCLaaS call fails or is unconfigured', async () => {
    vi.spyOn(soclaas, 'callSoclaasChat').mockRejectedValue(new Error('Unauthorized'));
    await expect(
      generateAiStudyPlanRecommendation(
        dummyMajor,
        initialSemesters,
        waivedModules,
        survey,
        [],
      ),
    ).rejects.toThrow('Unauthorized');
  });

  it('iterates on the plan when the student communicates follow-up adjustments', async () => {
    vi.spyOn(soclaas, 'callSoclaasChat').mockResolvedValue(
      JSON.stringify({
        trackTitle: 'Artificial Intelligence & Machine Learning',
        trackRationale: 'Updated with NLP focus.',
        recommendedElectives: [{ code: 'CS4248', title: 'NLP', reason: 'Focus on language models' }],
        futureSemesterPlacements: [{ year: 2, sem: 1, moduleCodes: ['CS4248'] }],
        reply: "I've added CS4248 Natural Language Processing to your Year 2 Semester 1 schedule.",
      }),
    );

    const initialResult = emptyResult();

    const iteration = await iterateAiStudyPlanRecommendation(
      dummyMajor,
      initialResult,
      initialSemesters,
      waivedModules,
      'Can you add CS4248 for NLP?',
      [{ role: 'assistant', content: 'Initial plan prepared.' }],
      [],
      { year: survey.standingYear, sem: survey.standingSem },
    );

    expect(iteration.reply).toContain('CS4248');
    expect(iteration.result.updatedSemesters[0].modules.map((m) => m.code)).toEqual(['CS1101S', 'CS1231S']);
    const allCodes = iteration.result.updatedSemesters.flatMap((s) => s.modules.map((m) => m.code));
    expect(allCodes).toContain('CS4248');
  });

  it('cleanJsonResponse strips markdown code fences correctly', () => {
    expect(cleanJsonResponse('{"key": "value"}')).toBe('{"key": "value"}');
    expect(cleanJsonResponse('```json\n{"key": "value"}\n```')).toBe('{"key": "value"}');
    expect(cleanJsonResponse('```\n{"key": "value"}\n```')).toBe('{"key": "value"}');
  });

  it('preserves pre-existing modules in future semesters during AI generation', async () => {
    // Semester 2 in initialSemesters is Y2S1. Let's pre-place CS2100 in it.
    const customSemesters: StudentSemester[] = initialSemesters.map((s, idx) => {
      if (idx === 2) {
        return {
          ...s,
          modules: [{ code: 'CS2100', name: 'Computer Organisation', mcs: 4, categoryId: 'cs-foundation' }],
        };
      }
      return s;
    });

    vi.spyOn(soclaas, 'callSoclaasChat').mockResolvedValue(
      '```json\n' +
      JSON.stringify({
        trackTitle: 'Artificial Intelligence',
        trackRationale: 'AI track with CS3243',
        recommendedElectives: [{ code: 'CS3243', title: 'Intro to AI', reason: 'Gateway module' }],
        futureSemesterPlacements: [
          { year: 2, sem: 1, moduleCodes: ['CS3243'] },
        ],
      }) +
      '\n```'
    );

    const result = await generateAiStudyPlanRecommendation(
      dummyMajor,
      customSemesters,
      waivedModules,
      survey,
      [],
    );

    // Y2S1 should contain BOTH the pre-existing CS2100 AND the proposed CS3243
    const y2s1Codes = result.updatedSemesters[2].modules.map((m) => m.code);
    expect(y2s1Codes).toContain('CS2100');
    expect(y2s1Codes).toContain('CS3243');
    // Added modules should specifically record CS3243, not CS2100
    expect(result.addedModules).toEqual([{ code: 'CS3243', year: 2, sem: 1 }]);
  });

  const dummyMinor: SecondaryProgramme = {
    id: 'minor-economics',
    label: 'Economics Minor',
    kind: 'minor',
    mcTarget: 20,
    school: 'CHS',
    requirements: [],
    moduleCatalog: {},
  };

  it('handles offline / mock deterministic iteration correctly', () => {
    const initialResult = generateMockRecommendation(
      dummyMajor,
      initialSemesters,
      waivedModules,
      survey,
      [dummyMinor],
    );

    // Test NLP adjustment
    const nlpIter = iterateMockRecommendation(
      dummyMajor,
      initialResult,
      initialSemesters,
      waivedModules,
      'Can we add NLP?',
      [],
      { year: survey.standingYear, sem: survey.standingSem },
    );
    expect(nlpIter.reply).toContain('CS4248');
    expect(nlpIter.result.updatedSemesters.flatMap((s) => s.modules.map((m) => m.code))).toContain('CS4248');

    // Test Minor adjustment
    const minorIter = iterateMockRecommendation(
      dummyMajor,
      initialResult,
      initialSemesters,
      waivedModules,
      'Add an Economics minor please',
      [dummyMinor],
      { year: survey.standingYear, sem: survey.standingSem },
    );
    expect(minorIter.reply).toContain('Economics');
    expect(minorIter.result.recommendedMinorId).toBe('minor-economics');

    // Test specific course code placement
    const codeIter = iterateMockRecommendation(
      dummyMajor,
      initialResult,
      initialSemesters,
      waivedModules,
      'I would like to take CS3219',
      [],
      { year: survey.standingYear, sem: survey.standingSem },
    );
    expect(codeIter.reply).toContain('CS3219');
    expect(codeIter.result.updatedSemesters.flatMap((s) => s.modules.map((m) => m.code))).toContain('CS3219');
  });
  it('does not duplicate a course already placed in a later future semester', async () => {
    const original = initialSemesters.map(s => ({ ...s, modules: [...s.modules] }));
    const course = { code: 'CS2100', name: 'Existing course', mcs: 4, categoryId: 'cs-foundation', allocationPreferences: { 'minor:test': { row: 'include' as const } } };
    original[3].modules.push(course);
    vi.spyOn(soclaas, 'callSoclaasChat').mockResolvedValue(JSON.stringify({ futureSemesterPlacements: [{ year: 2, sem: 1, moduleCodes: ['CS2100'] }] }));
    const result = await generateAiStudyPlanRecommendation({ ...dummyMajor, moduleCatalog: { CS2100: course } }, original, [], survey);
    expect(result.updatedSemesters.flatMap(s => s.modules).filter(m => m.code === 'CS2100')).toEqual([course]);
    expect(result.updatedSemesters[3].modules).toContainEqual(course);
    expect(result.addedModules).toEqual([]);
  });

  it('does not duplicate a later recommendation when iterating', async () => {
    const current = emptyResult();
    current.updatedSemesters[3].modules.push({ code: 'CS4248', name: 'NLP', mcs: 4, categoryId: 'breadth-depth' });
    vi.spyOn(soclaas, 'callSoclaasChat').mockResolvedValue(JSON.stringify({ futureSemesterPlacements: [{ year: 2, sem: 1, moduleCodes: ['CS4248'] }] }));
    const iteration = await iterateAiStudyPlanRecommendation(dummyMajor, current, initialSemesters, [], 'Move NLP earlier', [], [], { year: 2, sem: 1 });
    expect(iteration.result.updatedSemesters.flatMap(s => s.modules).filter(m => m.code === 'CS4248')).toHaveLength(1);
    expect(iteration.result.updatedSemesters[3].modules[0].code).toBe('CS4248');
    expect(iteration.reply).toContain('placements were kept');
  });

  it.each([null, [], { futureSemesterPlacements: 'bad' }, { futureSemesterPlacements: [{ year: 2, sem: 1, moduleCodes: [123] }] }])('rejects malformed response %j', async response => {
    vi.spyOn(soclaas, 'callSoclaasChat').mockResolvedValue(JSON.stringify(response));
    await expect(generateAiStudyPlanRecommendation(dummyMajor, initialSemesters, [], survey)).rejects.toThrow('Invalid advisor');
  });

  it('honours an explicit null minor when iterating', async () => {
    const current = { ...emptyResult(), recommendedMinorId: 'minor-economics' };
    vi.spyOn(soclaas, 'callSoclaasChat').mockResolvedValue(JSON.stringify({ recommendedMinorId: null }));
    const result = await iterateAiStudyPlanRecommendation(dummyMajor, current, initialSemesters, [], 'No minor', [], [dummyMinor], { year: 2, sem: 1 });
    expect(result.result.recommendedMinorId).toBeNull();
  });

  it('does not invent offline changes for unsupported or negated requests', () => {
    for (const request of ['Lighter workload in Year 2', 'Plan for SEP', 'Do not add NLP', 'Remove CS4248']) {
      const current = emptyResult();
      const result = iterateMockRecommendation(dummyMajor, current, initialSemesters, [], request, [], { year: 2, sem: 1 });
      expect(result.result.updatedSemesters).toEqual(current.updatedSemesters);
      expect(result.reply).not.toMatch(/I.ve (added|redistributed|refined)/);
    }
  });

  it('distinguishes a full timetable from an already placed course', () => {
    const current = emptyResult();
    current.updatedSemesters[2].modules = [{ code: 'FULL1', name: 'Full', mcs: 20, categoryId: 'breadth-depth' }];
    current.updatedSemesters[3].modules = [{ code: 'FULL2', name: 'Full', mcs: 20, categoryId: 'breadth-depth' }];
    const result = iterateMockRecommendation(dummyMajor, current, initialSemesters, [], 'Add NLP', [], { year: 2, sem: 1 });
    expect(result.reply).toContain('No suitable future semester');
    expect(result.result.updatedSemesters).toEqual(current.updatedSemesters);
    expect(result.result.recommendedElectives).toEqual([]);
  });

  it('does not recommend an unsolicited minor or guess a different named minor', () => {
    expect(generateMockRecommendation(dummyMajor, initialSemesters, [], survey, [dummyMinor]).recommendedMinorId).toBeNull();
    const result = iterateMockRecommendation(dummyMajor, emptyResult(), initialSemesters, [], 'Add an astronomy minor', [dummyMinor], { year: 2, sem: 1 });
    expect(result.result.recommendedMinorId).toBeNull();
  });

  it('warns when offline course details have not been verified', () => {
    const result = iterateMockRecommendation(dummyMajor, emptyResult(), initialSemesters, [], 'Add CS4248', [], { year: 2, sem: 1 });
    expect(result.result.warnings).toContain('CS4248: course details unavailable; verify credits, prerequisites and semester availability.');
  });

  it('respects cached prerequisites and actual course credits in offline placement', () => {
    vi.mocked(nusmods.getCachedModuleDetail).mockImplementation(code => code === 'CS4248' ? {
      moduleCode: code, title: 'NLP', moduleCredit: '6', prereqTree: 'CS3244', semesterData: [{ semester: 2 }],
    } : undefined);
    const current = emptyResult();
    current.updatedSemesters[2].modules.push({ code: 'CS3244', name: 'ML', mcs: 4, categoryId: 'breadth-depth' });
    const result = iterateMockRecommendation(dummyMajor, current, initialSemesters, [], 'Add NLP', [], { year: 2, sem: 1 });
    expect(result.result.updatedSemesters[2].modules.some(m => m.code === 'CS4248')).toBe(false);
    expect(result.result.updatedSemesters[3].modules).toContainEqual(expect.objectContaining({ code: 'CS4248', mcs: 6 }));
  });

  it('does not overshoot the selected load when generating offline suggestions', () => {
    const current = initialSemesters.map(s => s.year === 2 ? { ...s, modules: [{ code: `FULL${s.sem}`, name: 'Existing', mcs: 18, categoryId: 'breadth-depth' }] } : s);
    const result = generateMockRecommendation(dummyMajor, current, [], survey);
    expect(result.addedModules).toEqual([]);
    expect(result.updatedSemesters.filter(s => s.year === 2).every(s => s.modules.reduce((sum, m) => sum + m.mcs, 0) <= 20)).toBe(true);
  });

});
