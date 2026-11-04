import type {
  Major,
  StudentSemester,
  WaivedModule,
  SecondaryProgramme,
  PlacedModule,
} from '@shared/types';
import {
  assessPrerequisiteConflict,
  checkSemesterAvailability,
  getCachedModuleDetail,
} from '@shared/nusmods';
import { callSoclaasChat } from './soclaas';
import {
  collectCandidateCourseCodes,
  enrichCandidateModules,
  type EnrichedModuleInfo,
} from './recommendationData';

export interface SurveyInput {
  standingYear: number;
  standingSem: number;
  interests: string[];
  careerGoal: string;
  targetMcsPerSem: number;
  selectedMinorId?: string | null;
  interestedInNoc: boolean;
  nocDuration: '3-month' | '6-month' | '1-year' | null;
  customNotes?: string;
}

export interface RecommendationResult {
  trackTitle: string;
  trackRationale: string;
  recommendedMinorId?: string | null;
  recommendedMinorRationale?: string;
  recommendedElectives: Array<{
    code: string;
    title: string;
    reason: string;
  }>;
  updatedSemesters: StudentSemester[];
  addedModules: Array<{ code: string; year: number; sem: number }>;
  warnings: string[];
  usedMock: boolean;
}

const isSemesterPast = (
  year: number,
  sem: number,
  standingYear: number,
  standingSem: number,
): boolean => {
  if (year < standingYear) return true;
  if (year === standingYear && sem < standingSem) return true;
  return false;
};

/**
 * Generates an intelligent mock recommendation when the SoCLaaS API key is not configured.
 */
export const generateMockRecommendation = (
  major: Major,
  currentSemesters: StudentSemester[],
  waivedModules: WaivedModule[],
  survey: SurveyInput,
  minors: SecondaryProgramme[] = [],
): RecommendationResult => {
  const pastCodes = new Set<string>([
    ...waivedModules.map((m) => m.code),
    ...currentSemesters
      .filter((s) => isSemesterPast(s.year, s.sem, survey.standingYear, survey.standingSem))
      .flatMap((s) => s.modules.map((m) => m.code)),
  ]);

  let trackTitle = 'Artificial Intelligence & Machine Learning';
  let trackRationale =
    'Aligns with your indicated interests in AI/ML, intelligent systems, and software engineering. Focuses on foundational machine learning models followed by deep learning and practical applied computer vision.';
  let candidateElectives: Array<{ code: string; title: string; reason: string }> = [];

  if (major.id.includes('computer-science')) {
    candidateElectives = [
      { code: 'CS3243', title: 'Introduction to Artificial Intelligence', reason: 'Core gateway into advanced reasoning, heuristic search, and constraint satisfaction.' },
      { code: 'CS3244', title: 'Machine Learning', reason: 'Foundational theory for statistical learning algorithms and neural networks.' },
      { code: 'CS4243', title: 'Computer Vision and Pattern Recognition', reason: 'Deep dive into visual perception and convolutional networks.' },
      { code: 'CS4248', title: 'Natural Language Processing', reason: 'Covers modern language representations, transformer architectures, and LLMs.' },
    ];
  } else if (major.id.includes('business-analytics')) {
    trackTitle = 'Financial Analytics & Machine Learning';
    trackRationale =
      'Bridges data analytics with quantitative financial decision making and algorithmic valuation.';
    candidateElectives = [
      { code: 'BT4013', title: 'Analytics for Capital Market Trading and Investment', reason: 'Teaches algorithmic strategy design and financial market data analysis.' },
      { code: 'BT4221', title: 'Big Data Techniques and Technologies', reason: 'Scalable data processing essential for high-throughput enterprise pipelines.' },
      { code: 'BT4016', title: 'Risk Analytics for Financial Services', reason: 'Risk scoring and predictive credit modeling.' },
    ];
  } else if (major.id.includes('information-security')) {
    trackTitle = 'Offensive & Defensive Systems Security';
    trackRationale =
      'Provides practical capabilities in vulnerability analysis, software exploitation, and network defence.';
    candidateElectives = [
      { code: 'CS4239', title: 'Software Security', reason: 'In-depth binary exploitation, memory safety, and modern mitigations.' },
      { code: 'CS4236', title: 'Cryptography Theory and Practice', reason: 'Foundational cryptography for secure protocols and primitives.' },
      { code: 'IS4231', title: 'Information Security Management', reason: 'Enterprise governance, incident response, and risk management.' },
    ];
  } else {
    candidateElectives = [
      { code: 'CS3243', title: 'Introduction to Artificial Intelligence', reason: 'Broad coverage of search algorithms and intelligent decision-making.' },
      { code: 'CS3244', title: 'Machine Learning', reason: 'Key machine learning principles and statistical inference.' },
    ];
  }

  // Determine Minor
  const recommendedMinor = survey.selectedMinorId
    ? minors.find((m) => m.id === survey.selectedMinorId)
    : minors.find((m) => m.id.includes('economics') || m.id.includes('management') || m.id.includes('statistics'));

  // Build updated semesters preserving past semesters
  const updatedSemesters: StudentSemester[] = currentSemesters.map((s) => {
    // If past semester, freeze exactly as-is
    if (isSemesterPast(s.year, s.sem, survey.standingYear, survey.standingSem)) {
      return { ...s, modules: [...s.modules] };
    }
    return { ...s, modules: [...s.modules] };
  });

  const addedModules: Array<{ code: string; year: number; sem: number }> = [];
  const warnings: string[] = [];

  // Distribute candidate electives that aren't already taken into future semesters
  const electivesToPlace = candidateElectives.filter((e) => !pastCodes.has(e.code));
  let electiveIdx = 0;

  for (const sem of updatedSemesters) {
    if (isSemesterPast(sem.year, sem.sem, survey.standingYear, survey.standingSem)) continue;
    // Calculate current MCs in this semester
    let currentMcs = sem.modules.reduce((sum, m) => sum + m.mcs, 0);

    while (currentMcs < survey.targetMcsPerSem && electiveIdx < electivesToPlace.length) {
      const elective = electivesToPlace[electiveIdx];
      // Check if code is already placed anywhere in the plan
      const alreadyPlaced = updatedSemesters.some((s) => s.modules.some((m) => m.code === elective.code));
      if (!alreadyPlaced) {
        const placed: PlacedModule = {
          code: elective.code,
          name: elective.title,
          mcs: 4,
          categoryId: major.categories[1]?.id ?? major.categories[0]?.id ?? 'unrestricted-electives',
        };
        sem.modules.push(placed);
        addedModules.push({ code: elective.code, year: sem.year, sem: sem.sem });
        currentMcs += 4;
      }
      electiveIdx++;
    }
  }

  return {
    trackTitle,
    trackRationale,
    recommendedMinorId: recommendedMinor?.id ?? null,
    recommendedMinorRationale: recommendedMinor
      ? `A ${recommendedMinor.label} provides valuable complementary skills aligned with ${survey.careerGoal || 'your career aspirations'}.`
      : undefined,
    recommendedElectives: candidateElectives,
    updatedSemesters,
    addedModules,
    warnings,
    usedMock: true,
  };
};

/**
 * Builds the LLM prompt and invokes SoCLaaS to generate an academically rigorous study plan.
 */
export const generateAiStudyPlanRecommendation = async (
  major: Major,
  currentSemesters: StudentSemester[],
  waivedModules: WaivedModule[],
  survey: SurveyInput,
  minors: SecondaryProgramme[] = [],
): Promise<RecommendationResult> => {
  // 1. Gather candidate pool and fetch module details from NUSMods
  const minorIds = survey.selectedMinorId ? [survey.selectedMinorId] : minors.map((m) => m.id).slice(0, 3);
  const candidateCodes = collectCandidateCourseCodes(major, minors, minorIds);
  const enrichedModules = await enrichCandidateModules(candidateCodes.slice(0, 45));

  // 2. Identify completed / frozen courses
  const pastSemesters = currentSemesters.filter((s) =>
    isSemesterPast(s.year, s.sem, survey.standingYear, survey.standingSem),
  );
  const pastModules = pastSemesters.flatMap((s) => s.modules.map((m) => m.code));
  const waivedCodes = waivedModules.map((m) => m.code);
  const futureSemesters = currentSemesters.filter(
    (s) => !isSemesterPast(s.year, s.sem, survey.standingYear, survey.standingSem),
  );

  // 3. Assemble prompt
  const systemPrompt = `You are the NUS School of Computing academic advising engine.
Given a student's degree rules, academic standing, survey responses, and candidate NUSMods courses, generate:
1. Recommended Track / Specialisation with personalized justification.
2. Recommended Minor or Secondary Programme (if appropriate).
3. 3-5 curated Electives with specific rationales tied to their syllabus.
4. A sequence of modules to place into their REMAINING future semesters, respecting prerequisites and semester availability.

OUTPUT JSON FORMAT ONLY:
{
  "trackTitle": "string",
  "trackRationale": "string",
  "recommendedMinorId": "string or null",
  "recommendedMinorRationale": "string",
  "recommendedElectives": [
    { "code": "string", "title": "string", "reason": "string" }
  ],
  "futureSemesterPlacements": [
    {
      "year": number,
      "sem": number,
      "moduleCodes": ["string"]
    }
  ]
}`;

  const userContext = {
    major: {
      id: major.id,
      label: major.label,
      totalMcTarget: major.totalMcTarget,
    },
    studentStanding: {
      currentYear: survey.standingYear,
      currentSem: survey.standingSem,
      completedOrWaivedCodes: [...waivedCodes, ...pastModules],
    },
    survey: {
      interests: survey.interests,
      careerGoal: survey.careerGoal,
      targetMcsPerSem: survey.targetMcsPerSem,
      selectedMinorId: survey.selectedMinorId,
      interestedInNoc: survey.interestedInNoc,
      nocDuration: survey.nocDuration,
      customNotes: survey.customNotes,
    },
    futureSemestersToPlan: futureSemesters.map((s) => ({
      year: s.year,
      sem: s.sem,
      existingModules: s.modules.map((m) => m.code),
    })),
    candidateModulesCatalog: enrichedModules.map((m) => ({
      code: m.code,
      title: m.title,
      mcs: m.mcs,
      description: m.description,
      prerequisite: m.prerequisite,
      semestersOffered: m.semestersOffered,
    })),
  };

  try {
    const rawContent = await callSoclaasChat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(userContext) },
      ],
      responseFormat: 'json_object',
      temperature: 0.2,
    });

    const parsed = JSON.parse(rawContent) as {
      trackTitle?: string;
      trackRationale?: string;
      recommendedMinorId?: string | null;
      recommendedMinorRationale?: string;
      recommendedElectives?: Array<{ code: string; title: string; reason: string }>;
      futureSemesterPlacements?: Array<{ year: number; sem: number; moduleCodes: string[] }>;
    };

    // Reconcile and validate against ModStack's studyPlan rules
    const updatedSemesters: StudentSemester[] = currentSemesters.map((s) => {
      // Past semester: freeze
      if (isSemesterPast(s.year, s.sem, survey.standingYear, survey.standingSem)) {
        return { ...s, modules: [...s.modules] };
      }

      // Check if SoCLaaS proposed modules for this semester
      const proposed = parsed.futureSemesterPlacements?.find(
        (p) => p.year === s.year && p.sem === s.sem,
      );

      if (!proposed || proposed.moduleCodes.length === 0) {
        return { ...s, modules: [...s.modules] };
      }

      const newModules: PlacedModule[] = proposed.moduleCodes.map((code) => {
        const enriched = enrichedModules.find((e) => e.code === code);
        const existing = s.modules.find((m) => m.code === code);
        return {
          code,
          name: existing?.name ?? enriched?.title ?? code,
          mcs: existing?.mcs ?? enriched?.mcs ?? 4,
          categoryId: existing?.categoryId ?? major.categories[1]?.id ?? major.categories[0]?.id ?? 'unrestricted-electives',
        };
      });

      return {
        ...s,
        modules: newModules,
      };
    });

    const addedModules: Array<{ code: string; year: number; sem: number }> = [];
    const warnings: string[] = [];

    // Run prerequisite and semester availability checks on future semesters
    const completedSoFar = new Set<string>([...waivedCodes, ...pastModules]);
    for (const sem of updatedSemesters) {
      if (!isSemesterPast(sem.year, sem.sem, survey.standingYear, survey.standingSem)) {
        for (const mod of sem.modules) {
          addedModules.push({ code: mod.code, year: sem.year, sem: sem.sem });
          const detail = getCachedModuleDetail(mod.code);
          if (detail) {
            const prereqCheck = assessPrerequisiteConflict(detail, completedSoFar);
            if (prereqCheck.missingRequirement) {
              warnings.push(`${mod.code} in Y${sem.year}S${sem.sem} is missing prerequisite: ${prereqCheck.missingRequirement}`);
            }
            const semCheck = checkSemesterAvailability(detail, sem.sem);
            if (!semCheck.isAvailable && semCheck.warning) {
              warnings.push(`${mod.code}: ${semCheck.warning}`);
            }
          }
        }
      }
      for (const mod of sem.modules) {
        completedSoFar.add(mod.code);
      }
    }

    return {
      trackTitle: parsed.trackTitle || 'Recommended Specialisation Track',
      trackRationale: parsed.trackRationale || 'Custom plan generated based on your interests.',
      recommendedMinorId: parsed.recommendedMinorId ?? null,
      recommendedMinorRationale: parsed.recommendedMinorRationale,
      recommendedElectives: parsed.recommendedElectives ?? [],
      updatedSemesters,
      addedModules,
      warnings,
      usedMock: false,
    };
  } catch (error) {
    // If network or parsing error occurs, fallback gracefully to mock
    console.warn('SoCLaaS call failed, using mock recommendation:', error);
    const mock = generateMockRecommendation(major, currentSemesters, waivedModules, survey, minors);
    mock.warnings.push(
      `Notice: SoCLaaS API request encountered an issue (${error instanceof Error ? error.message : 'Unknown error'}). Generated using fallback recommendation engine.`,
    );
    return mock;
  }
};
