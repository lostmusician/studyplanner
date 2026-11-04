import type { Major, SecondaryProgramme } from '@shared/types';
import { fetchNusModsModuleDetail } from '@shared/nusmods';

export interface EnrichedModuleInfo {
  code: string;
  title: string;
  mcs: number;
  description: string;
  prerequisite?: string;
  semestersOffered: number[];
}

/**
 * Collects all candidate elective, focus area, specialisation, and minor course codes
 * that are relevant to this student's major and potential minor interests.
 */
export const collectCandidateCourseCodes = (
  major: Major,
  availableMinors: SecondaryProgramme[] = [],
  targetMinorIds: string[] = [],
): string[] => {
  const codes = new Set<string>();

  // 1. Focus areas (e.g. Computer Science)
  if (major.focusAreas) {
    for (const fa of major.focusAreas) {
      for (const c of fa.primaries) codes.add(c.trim().toUpperCase());
      for (const c of fa.electives ?? []) codes.add(c.trim().toUpperCase());
    }
  }

  // 2. Programme Electives (e.g. Business Analytics, Business AI Systems)
  if (major.programmeElectives) {
    for (const cat of major.programmeElectives.categories ?? []) {
      for (const c of cat.courses) codes.add(c.trim().toUpperCase());
    }
    for (const spec of major.programmeElectives.specialisations ?? []) {
      for (const c of spec.courses) codes.add(c.trim().toUpperCase());
    }
  }

  // 3. Breadth & Depth Technical Electives (e.g. Artificial Intelligence)
  if (major.breadthDepth?.technicalElectives?.courses) {
    for (const c of major.breadthDepth.technicalElectives.courses) {
      codes.add(c.trim().toUpperCase());
    }
  }

  // 4. Major-specific elective requirements (e.g. Security Electives in InfoSec)
  for (const req of major.requirements ?? []) {
    // If a requirement has many options (e.g. >= 4 fulfilledBy options), it's an elective pool
    if (req.fulfilledBy.length > 2) {
      for (const c of req.fulfilledBy) {
        if (!c.includes('*')) {
          codes.add(c.trim().toUpperCase());
        }
      }
    }
  }

  // 5. Candidate Minors (if requested)
  for (const minorId of targetMinorIds) {
    const minor = availableMinors.find((m) => m.id === minorId);
    if (!minor) continue;
    for (const req of minor.requirements) {
      for (const c of req.fulfilledBy) {
        if (!c.includes('*')) {
          codes.add(c.trim().toUpperCase());
        }
      }
    }
  }

  // Filter out wildcard strings or invalid codes
  return Array.from(codes).filter((code) => /^[A-Z]{2,}[A-Z0-9]*\d[A-Z0-9]*$/.test(code));
};

/**
 * Batched enrichment of candidate course codes with NUSMods descriptions,
 * credits, prerequisites, and semester offerings.
 */
export const enrichCandidateModules = async (
  codes: string[],
  concurrency = 6,
): Promise<EnrichedModuleInfo[]> => {
  const results: EnrichedModuleInfo[] = [];
  const queue = [...codes];

  const worker = async () => {
    while (queue.length > 0) {
      const code = queue.shift();
      if (!code) break;
      try {
        const { detail } = await fetchNusModsModuleDetail(code);
        const mcs = Number.parseFloat(detail.moduleCredit ?? '4') || 4;
        const semestersOffered = detail.semesterData?.map((s) => s.semester) ?? [1, 2];
        const description = (detail.description ?? '').trim().slice(0, 350); // Keep concise for token economy

        results.push({
          code: detail.moduleCode,
          title: detail.title,
          mcs,
          description,
          prerequisite: detail.prerequisite?.trim(),
          semestersOffered,
        });
      } catch {
        // Fallback placeholder if NUSMods API lookup fails or is throttled
        results.push({
          code,
          title: code,
          mcs: 4,
          description: '',
          semestersOffered: [1, 2],
        });
      }
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, codes.length) }, () => worker());
  await Promise.all(workers);

  return results.sort((a, b) => a.code.localeCompare(b.code));
};
