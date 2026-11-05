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

  const selectedInterest = survey.interests[0] || 'Artificial Intelligence & ML';
  let trackTitle = 'Artificial Intelligence & Machine Learning';
  let trackRationale =
    'Aligns with your indicated interests in AI/ML and intelligent decision systems. Focuses on foundational machine learning models followed by deep learning and practical applied computer vision.';
  let candidateElectives: Array<{ code: string; title: string; reason: string }> = [];

  if (selectedInterest.includes('Cybersecurity') || selectedInterest.includes('Security')) {
    trackTitle = 'Cybersecurity & Systems Defense';
    trackRationale =
      'Focuses on vulnerability research, software defense, secure protocol design, and modern cryptography.';
    candidateElectives = [
      { code: 'CS2107', title: 'Introduction to Information Security', reason: 'Essential security principles, authentication, access control, and crypto.' },
      { code: 'CS3235', title: 'Computer Security', reason: 'Operating system and runtime defenses against memory safety exploitation.' },
      { code: 'CS4239', title: 'Software Security', reason: 'Binary exploitation, vulnerability auditing, and program analysis.' },
      { code: 'CS4236', title: 'Cryptography Theory and Practice', reason: 'Mathematical foundations of modern encryption and public key infrastructure.' },
    ];
  } else if (selectedInterest.includes('Cloud') || selectedInterest.includes('Distributed') || selectedInterest.includes('Systems')) {
    trackTitle = 'Cloud, Networks & Distributed Systems';
    trackRationale =
      'Prepares you to design fault-tolerant, high-concurrency networked services and distributed infrastructure.';
    candidateElectives = [
      { code: 'CS2105', title: 'Introduction to Computer Networks', reason: 'Network protocols, transport mechanisms, and internet architecture.' },
      { code: 'CS2106', title: 'Introduction to Operating Systems', reason: 'Kernel architecture, virtualization, threads, and memory hierarchy.' },
      { code: 'CS3210', title: 'Parallel Computing', reason: 'High-performance shared and distributed memory programming.' },
      { code: 'CS3219', title: 'Software Engineering Principles and Patterns', reason: 'DevOps, CI/CD pipelines, and cloud microservices.' },
    ];
  } else if (selectedInterest.includes('Software Engineering') || selectedInterest.includes('Fullstack')) {
    trackTitle = 'Software Engineering & Enterprise Architecture';
    trackRationale =
      'Emphasizes clean architectural patterns, robust test-driven design, and large-scale application lifecycle management.';
    candidateElectives = [
      { code: 'CS2103T', title: 'Software Engineering', reason: 'Team software engineering, design patterns, and automated CI testing.' },
      { code: 'CS3203', title: 'Software Engineering Project', reason: 'Milestone-driven implementation of an industrial-grade system.' },
      { code: 'CS3219', title: 'Software Engineering Principles and Patterns', reason: 'Scalable service patterns and modern architectural styles.' },
      { code: 'CS4211', title: 'Formal Methods for Software Engineering', reason: 'High-assurance validation and program verification.' },
    ];
  } else if (selectedInterest.includes('Fintech') || selectedInterest.includes('Trading')) {
    trackTitle = 'Financial Technology & Quantitative Analytics';
    trackRationale =
      'Bridges quantitative modeling, algorithmic execution algorithms, and decentralized blockchain systems.';
    candidateElectives = [
      { code: 'BT4013', title: 'Analytics for Capital Market Trading', reason: 'Algorithmic trading strategies, market microstructure, and quantitative alpha backtesting.' },
      { code: 'BT4016', title: 'Risk Analytics for Financial Services', reason: 'Credit risk estimation, default modeling, and portfolio risk management.' },
      { code: 'CS3244', title: 'Machine Learning', reason: 'Predictive statistical models for financial time-series analysis.' },
      { code: 'IFS4102', title: 'Digital Currency and Blockchain Technologies', reason: 'Distributed ledgers, smart contracts, and decentralized finance protocols.' },
    ];
  } else if (selectedInterest.includes('Algorithms') || selectedInterest.includes('Theory')) {
    trackTitle = 'Algorithms & Theoretical Computing';
    trackRationale =
      'Deep dive into rigorous computational complexity, algorithmic optimization, and graph theories.';
    candidateElectives = [
      { code: 'CS3230', title: 'Design and Analysis of Algorithms', reason: 'Core algorithmic design techniques: greedy, dynamic programming, and NP-completeness.' },
      { code: 'CS3231', title: 'Theory of Computation', reason: 'Automata, grammars, Turing machines, and undecidability.' },
      { code: 'CS4231', title: 'Parallel and Distributed Algorithms', reason: 'Concurrent consensus and distributed graph algorithms.' },
      { code: 'CS4234', title: 'Optimisation Algorithms', reason: 'Approximation algorithms and linear programming relaxations.' },
    ];
  } else if (selectedInterest.includes('Graphics') || selectedInterest.includes('Gaming')) {
    trackTitle = 'Computer Graphics & Interactive Media';
    trackRationale =
      'Covers GPU rendering pipelines, 3D geometric modeling, animation, and real-time interactive game mechanics.';
    candidateElectives = [
      { code: 'CS3241', title: 'Computer Graphics', reason: 'Real-time rendering, shaders, and geometric coordinate transforms.' },
      { code: 'CS3242', title: '3D Modeling and Animation', reason: 'Spline curves, character rigging, and kinematic simulation.' },
      { code: 'CS4247', title: 'Advanced Computer Graphics', reason: 'Ray tracing, global illumination, and physically based shaders.' },
      { code: 'CS4350', title: 'Game Development Project', reason: 'Engine design and interdisciplinary team game production.' },
    ];
  } else if (selectedInterest.includes('Data Science') || selectedInterest.includes('Analytics')) {
    trackTitle = 'Data Science & Big Data Systems';
    trackRationale =
      'Prepares you for large-scale data transformation, statistical inference, and big data platform engineering.';
    candidateElectives = [
      { code: 'CS3244', title: 'Machine Learning', reason: 'Foundations of statistical learning and predictive model evaluation.' },
      { code: 'BT4221', title: 'Big Data Techniques and Technologies', reason: 'Scalable data processing with Spark, Hadoop, and streaming engines.' },
      { code: 'ST3131', title: 'Regression Analysis', reason: 'Parametric and non-parametric statistical regression modeling.' },
      { code: 'CS4248', title: 'Natural Language Processing', reason: 'Mining insights from unstructured text and language models.' },
    ];
  } else {
    candidateElectives = [
      { code: 'CS3243', title: 'Introduction to Artificial Intelligence', reason: 'Core gateway into advanced reasoning, heuristic search, and constraint satisfaction.' },
      { code: 'CS3244', title: 'Machine Learning', reason: 'Foundational theory for statistical learning algorithms and neural networks.' },
      { code: 'CS4243', title: 'Computer Vision and Pattern Recognition', reason: 'Deep dive into visual perception and convolutional networks.' },
      { code: 'CS4248', title: 'Natural Language Processing', reason: 'Covers modern language representations, transformer architectures, and LLMs.' },
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
    throw error;
  }
};

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface IterationResult {
  reply: string;
  result: RecommendationResult;
}

/**
 * Continues an interactive advising dialogue to iterate on the study plan.
 */
export const iterateAiStudyPlanRecommendation = async (
  major: Major,
  currentResult: RecommendationResult,
  currentSemesters: StudentSemester[],
  waivedModules: WaivedModule[],
  userPrompt: string,
  history: ChatTurn[],
  minors: SecondaryProgramme[] = [],
  standing: { year: number; sem: number } = { year: 1, sem: 1 },
): Promise<IterationResult> => {
  const candidateCodes = collectCandidateCourseCodes(major, minors, minors.map((m) => m.id).slice(0, 3));
  const enrichedModules = await enrichCandidateModules(candidateCodes.slice(0, 40));

  const pastSemesters = currentSemesters.filter((s) =>
    isSemesterPast(s.year, s.sem, standing.year, standing.sem),
  );
  const pastModules = pastSemesters.flatMap((s) => s.modules.map((m) => m.code));
  const waivedCodes = waivedModules.map((m) => m.code);
  const futureSemesters = currentResult.updatedSemesters.filter(
    (s) => !isSemesterPast(s.year, s.sem, standing.year, standing.sem),
  );

  const systemPrompt = `You are the NUS School of Computing academic advising engine pair-planning with a student.
The student is continuing a dialogue to iterate on their study plan.
Incorporate their requested changes, respect NUS SoC prerequisites, and maintain a realistic workload.
Output JSON only:
{
  "assistantMessage": "string explaining exactly what changes were made in response to the student's request",
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

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    {
      role: 'user',
      content: `Current Plan Context:
Major: ${major.label}
Frozen Completed/Waived Modules: ${[...waivedCodes, ...pastModules].join(', ')}
Current Future Plan:
${futureSemesters.map((s) => `Y${s.year}S${s.sem}: ${s.modules.map((m) => m.code).join(', ')}`).join('\n')}

Student Request:
"${userPrompt}"

Candidate Modules Available:
${enrichedModules.slice(0, 30).map((m) => `${m.code}: ${m.title} (Sem ${m.semestersOffered.join('/')})`).join(', ')}`,
    },
  ];

  try {
    const raw = await callSoclaasChat({
      messages,
      responseFormat: 'json_object',
      temperature: 0.2,
    });

    const parsed = JSON.parse(raw) as {
      assistantMessage?: string;
      reply?: string;
      trackTitle?: string;
      trackRationale?: string;
      recommendedMinorId?: string | null;
      recommendedMinorRationale?: string;
      recommendedElectives?: Array<{ code: string; title: string; reason: string }>;
      futureSemesterPlacements?: Array<{ year: number; sem: number; moduleCodes: string[] }>;
    };

    const updatedSemesters: StudentSemester[] = currentResult.updatedSemesters.map((s) => {
      if (isSemesterPast(s.year, s.sem, standing.year, standing.sem)) {
        return { ...s, modules: [...s.modules] };
      }
      const proposed = parsed.futureSemesterPlacements?.find((p) => p.year === s.year && p.sem === s.sem);
      if (!proposed) return { ...s, modules: [...s.modules] };

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

      return { ...s, modules: newModules };
    });

    const addedModules: Array<{ code: string; year: number; sem: number }> = [];
    const warnings: string[] = [];
    const completedSoFar = new Set<string>([...waivedCodes, ...pastModules]);

    for (const sem of updatedSemesters) {
      if (!isSemesterPast(sem.year, sem.sem, standing.year, standing.sem)) {
        for (const mod of sem.modules) {
          addedModules.push({ code: mod.code, year: sem.year, sem: sem.sem });
          const detail = getCachedModuleDetail(mod.code);
          if (detail) {
            const prereqCheck = assessPrerequisiteConflict(detail, completedSoFar);
            if (prereqCheck.missingRequirement) {
              warnings.push(`${mod.code} in Y${sem.year}S${sem.sem} is missing: ${prereqCheck.missingRequirement}`);
            }
          }
        }
      }
      for (const mod of sem.modules) {
        completedSoFar.add(mod.code);
      }
    }

    return {
      reply: parsed.assistantMessage || parsed.reply || 'I have updated your study plan according to your feedback.',
      result: {
        trackTitle: parsed.trackTitle || currentResult.trackTitle,
        trackRationale: parsed.trackRationale || currentResult.trackRationale,
        recommendedMinorId: parsed.recommendedMinorId ?? currentResult.recommendedMinorId,
        recommendedMinorRationale: parsed.recommendedMinorRationale ?? currentResult.recommendedMinorRationale,
        recommendedElectives: parsed.recommendedElectives ?? currentResult.recommendedElectives,
        updatedSemesters,
        addedModules,
        warnings,
        usedMock: false,
      },
    };
  } catch (error) {
    throw error;
  }
};
