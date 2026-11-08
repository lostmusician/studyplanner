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
import { autoCategoryId } from './studyPlan';
import { callSoclaasChat } from './soclaas';
import {
  collectCandidateCourseCodes,
  enrichCandidateModules,
} from './recommendationData';

/**
 * Strips markdown code blocks (e.g. ```json ... ```) from LLM output.
 */
export const cleanJsonResponse = (text: string): string => {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  return cleaned;
};

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

interface AdvisorResponse {
  trackTitle?: string;
  trackRationale?: string;
  recommendedMinorId?: string | null;
  recommendedMinorRationale?: string;
  recommendedElectives?: RecommendationResult['recommendedElectives'];
  futureSemesterPlacements?: Array<{ year: number; sem: number; moduleCodes: string[] }>;
}

const parseAdvisorResponse = (raw: string): AdvisorResponse => {
  const value = JSON.parse(cleanJsonResponse(raw));
  if (!value || typeof value !== 'object' || Array.isArray(value) || !['futureSemesterPlacements', 'recommendedElectives', 'recommendedMinorId', 'trackTitle'].some(key => key in value)) throw new Error('Invalid advisor response');
  if (value.futureSemesterPlacements !== undefined && (!Array.isArray(value.futureSemesterPlacements) || value.futureSemesterPlacements.some((p: unknown) =>
    !p || typeof p !== 'object' || !Number.isInteger((p as { year: number }).year) || !Number.isInteger((p as { sem: number }).sem) ||
    !Array.isArray((p as { moduleCodes: unknown }).moduleCodes) || (p as { moduleCodes: unknown[] }).moduleCodes.some(code => typeof code !== 'string')))) {
    throw new Error('Invalid advisor placements');
  }
  for (const key of ['trackTitle', 'trackRationale', 'recommendedMinorRationale']) {
    if (value[key] !== undefined && typeof value[key] !== 'string') throw new Error(`Invalid advisor ${key}`);
  }
  if (value.recommendedMinorId !== undefined && value.recommendedMinorId !== null && typeof value.recommendedMinorId !== 'string') throw new Error('Invalid advisor minor');
  if (value.recommendedElectives !== undefined && (!Array.isArray(value.recommendedElectives) || value.recommendedElectives.some((e: unknown) =>
    !e || typeof e !== 'object' || ['code', 'title', 'reason'].some(key => typeof (e as Record<string, unknown>)[key] !== 'string')))) throw new Error('Invalid advisor electives');
  return value;
};

const auditPlan = (updated: StudentSemester[], original: StudentSemester[], waived: WaivedModule[], standing: { year: number; sem: number }) => {
  const addedModules: RecommendationResult['addedModules'] = [];
  const warnings: string[] = [];
  const completed = new Set(waived.map(m => m.code));
  for (const sem of [...updated].sort((a, b) => a.year - b.year || a.sem - b.sem)) {
    if (!isSemesterPast(sem.year, sem.sem, standing.year, standing.sem)) {
      const originalCodes = new Set(original.flatMap(s => s.modules.map(m => m.code)));
      for (const module of sem.modules) {
        if (!originalCodes.has(module.code)) addedModules.push({ code: module.code, year: sem.year, sem: sem.sem });
        const detail = getCachedModuleDetail(module.code);
        if (!detail) {
          warnings.push(`${module.code}: course details unavailable; verify credits, prerequisites and semester availability.`);
          continue;
        }
        const assessment = assessPrerequisiteConflict(detail, completed);
        if (assessment.missingRequirement) warnings.push(`${module.code} in Y${sem.year}S${sem.sem} is missing: ${assessment.missingRequirement}`);
        const available = checkSemesterAvailability(detail, sem.sem);
        if (!available.isAvailable && available.warning) warnings.push(`${module.code}: ${available.warning}`);
      }
      if (sem.year === 1 && sem.sem === 1 && sem.modules.reduce((sum, m) => sum + m.mcs, 0) > 26) warnings.push('Y1S1 exceeds the 26 MC limit.');
    }
    sem.modules.forEach(m => completed.add(m.code));
  }
  return { addedModules, warnings: [...new Set(warnings)] };
};

const loadPlanDetails = async (plan: StudentSemester[], standing: { year: number; sem: number }) => {
  const codes = [...new Set(plan.filter(s => !isSemesterPast(s.year, s.sem, standing.year, standing.sem)).flatMap(s => s.modules.map(m => m.code)))];
  await enrichCandidateModules(codes.filter(code => !getCachedModuleDetail(code)));
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
    : undefined;

  // Build updated semesters preserving past semesters
  const updatedSemesters: StudentSemester[] = currentSemesters.map((s) => {
    // If past semester, freeze exactly as-is
    if (isSemesterPast(s.year, s.sem, survey.standingYear, survey.standingSem)) {
      return { ...s, modules: [...s.modules] };
    }
    return { ...s, modules: [...s.modules] };
  });

  const addedModules: Array<{ code: string; year: number; sem: number }> = [];

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
          mcs: major.moduleCatalog[elective.code]?.mcs ?? (Number(getCachedModuleDetail(elective.code)?.moduleCredit) || 4),
          categoryId: autoCategoryId(major, elective.code),
        };
        if (currentMcs + placed.mcs > survey.targetMcsPerSem) break;
        sem.modules.push(placed);
        addedModules.push({ code: elective.code, year: sem.year, sem: sem.sem });
        currentMcs += placed.mcs;
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
    warnings: auditPlan(updatedSemesters, currentSemesters, waivedModules, { year: survey.standingYear, sem: survey.standingSem }).warnings,
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
4. Additional courses for their REMAINING future semesters, respecting prerequisites and semester availability. Keep existing course placements fixed. Use only the supplied candidate or degree catalogue; do not propose moving or removing courses.

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
      categories: major.categories,
      requirements: major.requirements,
      breadthDepth: major.breadthDepth,
      programmeElectives: major.programmeElectives,
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

    const parsed = parseAdvisorResponse(rawContent);

    // Track placed modules across all semesters to prevent duplicates
    const globallyPlacedCodes = new Set<string>([...waivedCodes, ...currentSemesters.flatMap(s => s.modules.map(m => m.code))]);

    // Reconcile and validate against ModStack's studyPlan rules
    // Non-destructive merge: preserve existing user modules, fill/slot proposed electives
    const updatedSemesters: StudentSemester[] = currentSemesters.map((s) => {
      // Past semester: freeze exactly as-is
      if (isSemesterPast(s.year, s.sem, survey.standingYear, survey.standingSem)) {
        return { ...s, modules: [...s.modules] };
      }

      const existingModules = [...s.modules];
      for (const m of existingModules) {
        globallyPlacedCodes.add(m.code);
      }

      // Check if SoCLaaS proposed modules for this semester
      const proposed = parsed.futureSemesterPlacements?.find(
        (p) => p.year === s.year && p.sem === s.sem,
      );

      if (!proposed || !Array.isArray(proposed.moduleCodes) || proposed.moduleCodes.length === 0) {
        return { ...s, modules: existingModules };
      }

      const mergedModules = [...existingModules];
      for (const rawCode of proposed.moduleCodes) {
        const code = (rawCode || '').trim().toUpperCase();
        if (!code || globallyPlacedCodes.has(code) || (!enrichedModules.some(m => m.code === code) && !major.moduleCatalog[code] && !minors.some(minor => minor.moduleCatalog[code]))) continue;

        const enriched = enrichedModules.find((e) => e.code === code);
        const existing = s.modules.find((m) => m.code === code);
        const placed: PlacedModule = {
          code,
          name: existing?.name ?? major.moduleCatalog[code]?.name ?? enriched?.title ?? minors.find(m => m.moduleCatalog[code])?.moduleCatalog[code]?.name ?? code,
          mcs: existing?.mcs ?? major.moduleCatalog[code]?.mcs ?? enriched?.mcs ?? minors.find(m => m.moduleCatalog[code])?.moduleCatalog[code]?.mcs ?? 4,
          categoryId: existing?.categoryId ?? autoCategoryId(major, code),
        };
        mergedModules.push(placed);
        globallyPlacedCodes.add(code);
      }

      return {
        ...s,
        modules: mergedModules,
      };
    });

    await loadPlanDetails(updatedSemesters, { year: survey.standingYear, sem: survey.standingSem });
    const { addedModules, warnings } = auditPlan(updatedSemesters, currentSemesters, waivedModules, { year: survey.standingYear, sem: survey.standingSem });
    const skipped = (parsed.futureSemesterPlacements ?? []).flatMap(p => p.moduleCodes).map(code => code.trim().toUpperCase())
      .filter(code => code && !globallyPlacedCodes.has(code));
    if (skipped.length) warnings.push(`Not placed: ${[...new Set(skipped)].join(', ')}. Choose a course from the catalogue and an existing future semester.`);

    return {
      trackTitle: parsed.trackTitle || 'Recommended Specialisation Track',
      trackRationale: parsed.trackRationale || 'Custom plan generated based on your interests.',
      recommendedMinorId: minors.some(m => m.id === parsed.recommendedMinorId) ? parsed.recommendedMinorId : null,
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
Suggest additional courses while keeping all existing placements fixed. Use only supplied candidates. Moving, removing courses or redistributing workload requires manual editing; explain this limitation instead of claiming it was done.
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

    const parsed = parseAdvisorResponse(raw);

    const globallyPlacedCodes = new Set<string>([...waivedCodes, ...currentSemesters.flatMap(s => s.modules.map(m => m.code)), ...currentResult.updatedSemesters.flatMap(s => s.modules.map(m => m.code))]);

    const updatedSemesters: StudentSemester[] = currentResult.updatedSemesters.map((s) => {
      if (isSemesterPast(s.year, s.sem, standing.year, standing.sem)) {
        return { ...s, modules: [...(currentSemesters.find(original => original.year === s.year && original.sem === s.sem)?.modules ?? s.modules)] };
      }

      const existingModules = [...s.modules];
      for (const m of existingModules) {
        globallyPlacedCodes.add(m.code);
      }

      const proposed = parsed.futureSemesterPlacements?.find((p) => p.year === s.year && p.sem === s.sem);
      if (!proposed || !Array.isArray(proposed.moduleCodes) || proposed.moduleCodes.length === 0) {
        return { ...s, modules: existingModules };
      }

      const mergedModules = [...existingModules];
      for (const rawCode of proposed.moduleCodes) {
        const code = (rawCode || '').trim().toUpperCase();
        if (!code || globallyPlacedCodes.has(code) || (!enrichedModules.some(m => m.code === code) && !major.moduleCatalog[code] && !minors.some(minor => minor.moduleCatalog[code]))) continue;

        const enriched = enrichedModules.find((e) => e.code === code);
        const existing = s.modules.find((m) => m.code === code);
        const placed: PlacedModule = {
          code,
          name: existing?.name ?? major.moduleCatalog[code]?.name ?? enriched?.title ?? minors.find(m => m.moduleCatalog[code])?.moduleCatalog[code]?.name ?? code,
          mcs: existing?.mcs ?? major.moduleCatalog[code]?.mcs ?? enriched?.mcs ?? minors.find(m => m.moduleCatalog[code])?.moduleCatalog[code]?.mcs ?? 4,
          categoryId: existing?.categoryId ?? autoCategoryId(major, code),
        };
        mergedModules.push(placed);
        globallyPlacedCodes.add(code);
      }

      return { ...s, modules: mergedModules };
    });

    await loadPlanDetails(updatedSemesters, standing);
    const { addedModules, warnings } = auditPlan(updatedSemesters, currentSemesters, waivedModules, standing);
    const skipped = (parsed.futureSemesterPlacements ?? []).flatMap(p => p.moduleCodes).map(code => code.trim().toUpperCase())
      .filter(code => code && !globallyPlacedCodes.has(code));
    if (skipped.length) warnings.push(`Not placed: ${[...new Set(skipped)].join(', ')}. Choose a course from the catalogue and an existing future semester.`);

    return {
      reply: addedModules.length ? `The recommendation includes ${addedModules.map(m => m.code).join(', ')}. Existing course placements were kept.` : 'No new courses were placed. Existing course placements were kept.',
      result: {
        trackTitle: parsed.trackTitle || currentResult.trackTitle,
        trackRationale: parsed.trackRationale || currentResult.trackRationale,
        recommendedMinorId: parsed.recommendedMinorId === null ? null : minors.some(m => m.id === parsed.recommendedMinorId) ? parsed.recommendedMinorId : currentResult.recommendedMinorId,
        recommendedMinorRationale: parsed.recommendedMinorId === null ? undefined : parsed.recommendedMinorRationale ?? currentResult.recommendedMinorRationale,
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

/**
 * Deterministic iteration engine when offline or when SoCLaaS is not configured.
 * Adjusts study plan electives, minors, and workload according to student feedback.
 */
export const iterateMockRecommendation = (
  major: Major,
  currentResult: RecommendationResult,
  currentSemesters: StudentSemester[],
  waivedModules: WaivedModule[],
  userPrompt: string,
  minors: SecondaryProgramme[] = [],
  standing: { year: number; sem: number } = { year: 1, sem: 1 },
): IterationResult => {
  const normalized = userPrompt.toLowerCase();
  const updatedSemesters = currentResult.updatedSemesters.map(s => ({ ...s, modules: [...(isSemesterPast(s.year, s.sem, standing.year, standing.sem)
    ? currentSemesters.find(original => original.year === s.year && original.sem === s.sem)?.modules ?? s.modules : s.modules)] }));
  let reply = 'Offline adjustments support adding a course or recommending a named minor. Move courses or change workloads in the grid.';
  let recommendedMinorId = currentResult.recommendedMinorId;
  let recommendedMinorRationale = currentResult.recommendedMinorRationale;
  const recommendedElectives = [...currentResult.recommendedElectives];
  const pastCodes = new Set(waivedModules.map(m => m.code));
  currentSemesters.filter(s => isSemesterPast(s.year, s.sem, standing.year, standing.sem)).forEach(s => s.modules.forEach(m => pastCodes.add(m.code)));

  const place = (code: string, title: string) => {
    if (pastCodes.has(code) || updatedSemesters.some(s => s.modules.some(m => m.code === code))) {
      reply = `${code} is already in your study plan or completed.`;
      return;
    }
    const detail = getCachedModuleDetail(code);
    const mcs = major.moduleCatalog[code]?.mcs ?? (Number(detail?.moduleCredit) || 4);
    const target = [...updatedSemesters].sort((a, b) => a.year - b.year || a.sem - b.sem).find(sem =>
      !isSemesterPast(sem.year, sem.sem, standing.year, standing.sem) &&
      sem.modules.reduce((sum, m) => sum + m.mcs, 0) + mcs <= 20 &&
      (!detail || (!assessPrerequisiteConflict(detail, new Set([...pastCodes, ...updatedSemesters.filter(s => isSemesterPast(s.year, s.sem, sem.year, sem.sem)).flatMap(s => s.modules.map(m => m.code))])).missingRequirement && checkSemesterAvailability(detail, sem.sem).isAvailable)));
    if (!target) { reply = `No suitable future semester has room for ${code}. Choose a semester manually or free up credits first.`; return; }
    target.modules.push({ code, name: major.moduleCatalog[code]?.name ?? detail?.title ?? title, mcs, categoryId: autoCategoryId(major, code) });
    if (!recommendedElectives.some(e => e.code === code)) recommendedElectives.push({ code, title, reason: 'Requested course' });
    reply = `Added ${code} to Y${target.year}S${target.sem} in the recommendation.`;
  };

  // Do not interpret a request to remove/avoid a course as an instruction to add it.
  if (!/\b(remove|drop|avoid|without|swap|replace|lighter|reduce|redistribute|move|sep|exchange)\b|\bno\b|\bnot\b|don['’]?t|do not/i.test(userPrompt)) {
    const code = userPrompt.match(/\b([A-Z]{2,4}\d{4}[A-Z]{0,2})\b/i)?.[1].toUpperCase();
    if (code) place(code, code);
    else if (/\bminor\b/.test(normalized)) {
      const matched = minors.find(m => normalized.includes(m.label.toLowerCase()) || normalized.includes(m.id.toLowerCase()));
      if (matched) {
        recommendedMinorId = matched.id;
        recommendedMinorRationale = 'Selected from your request.';
        reply = `Recommended ${matched.label}. Course placements are unchanged; choose its courses in the planner.`;
      } else reply = 'Which minor would you like? Name a minor from Settings.';
    } else if (/nlp|natural language/.test(normalized)) place('CS4248', 'Natural Language Processing');
    else if (/security|crypto/.test(normalized)) place('CS3235', 'Computer Security');
    else if (/cloud|distributed/.test(normalized)) place('CS3210', 'Parallel Computing');
  }
  const audited = auditPlan(updatedSemesters, currentSemesters, waivedModules, standing);
  return { reply, result: { ...currentResult, recommendedMinorId, recommendedMinorRationale, recommendedElectives, updatedSemesters,
    addedModules: audited.addedModules, warnings: audited.warnings, usedMock: true } };
};
