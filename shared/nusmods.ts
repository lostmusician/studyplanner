export interface NusModsModuleSummary {
  moduleCode: string;
  title: string;
  semesters: number[];
  acadYear: string;
}

export interface NusModsSemesterData {
  semester: number;
}

export interface NusModsModuleDetail {
  acadYear?: string;
  moduleCode: string;
  title: string;
  description?: string;
  moduleCredit?: string;
  department?: string;
  faculty?: string;
  semesterData?: NusModsSemesterData[];
  prerequisite?: string;
  preclusion?: string;
  corequisite?: string;
  prereqTree?: unknown;
}

export interface NusModsPrerequisiteAssessment {
  hasPrerequisiteData: boolean;
  missingRequirement: string | null;
}

const API_BASE = 'https://api.nusmods.com/v2';
const listCache = new Map<string, NusModsModuleSummary[]>();
const detailCache = new Map<string, { acadYear: string; detail: NusModsModuleDetail }>();

export const clearNusModsCachesForTesting = (): void => {
  listCache.clear();
  detailCache.clear();
};

export const getCachedModuleDetail = (moduleCode: string): NusModsModuleDetail | undefined => {
  return detailCache.get(moduleCode.trim().toUpperCase())?.detail;
};

const toAcadYearSlug = (startYear: number): string => `${startYear}-${startYear + 1}`;

const getLikelyAcadYearStart = (date: Date): number => {
  return date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1;
};

const getAcadYearCandidates = (): string[] => {
  const start = getLikelyAcadYearStart(new Date());
  return [toAcadYearSlug(start), toAcadYearSlug(start - 1), toAcadYearSlug(start + 1)];
};

const uniqNumbers = (values: number[]): number[] => Array.from(new Set(values)).sort((a, b) => a - b);

const extractModuleCode = (value: string): string | null => {
  const match = value.trim().toUpperCase().match(/[A-Z]{2,}[A-Z0-9]*\d[A-Z0-9]*/);
  return match ? match[0] : null;
};

export const normalizePrereqCode = (value: string): string => {
  const normalized = value.trim().toUpperCase();
  const match = normalized.match(/^([A-Z]+\d{4})[A-Z]*$/);
  return match ? match[1] : normalized;
};

const isModuleSummary = (value: unknown): value is { moduleCode: string; title: string; semesters?: number[] } => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.moduleCode === 'string' && typeof candidate.title === 'string';
};

const fetchModuleListForAcadYear = async (acadYear: string): Promise<NusModsModuleSummary[]> => {
  const cached = listCache.get(acadYear);
  if (cached) return cached;

  const response = await fetch(`${API_BASE}/${acadYear}/moduleList.json`);
  if (!response.ok) throw new Error(`Unable to load NUSMods module list for ${acadYear}`);

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error(`Unexpected module list payload for ${acadYear}`);

  const list = payload
    .filter(isModuleSummary)
    .map((entry) => ({
      moduleCode: entry.moduleCode,
      title: entry.title,
      semesters: uniqNumbers(Array.isArray(entry.semesters) ? entry.semesters.filter((sem) => Number.isInteger(sem)) : []),
      acadYear,
    }));

  listCache.set(acadYear, list);
  return list;
};

const fetchWithAcadYearFallback = async <T>(fetcher: (acadYear: string) => Promise<T>): Promise<{ acadYear: string; data: T }> => {
  const candidates = getAcadYearCandidates();
  let lastError: unknown = null;

  for (const acadYear of candidates) {
    try {
      const data = await fetcher(acadYear);
      return { acadYear, data };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to load data from NUSMods API');
};

const formatPrereqTree = (tree: unknown): string | null => {
  if (!tree) return null;
  if (typeof tree === 'string') return tree;
  if (Array.isArray(tree)) {
    const parts = tree.map((child) => formatPrereqTree(child)).filter((part): part is string => Boolean(part));
    return parts.length > 0 ? parts.join(' and ') : null;
  }
  if (typeof tree === 'object') {
    const record = tree as Record<string, unknown>;
    if (Array.isArray(record.and)) {
      const parts = record.and.map((child) => formatPrereqTree(child)).filter((part): part is string => Boolean(part));
      return parts.length > 0 ? `(${parts.join(' and ')})` : null;
    }
    if (Array.isArray(record.or)) {
      const parts = record.or.map((child) => formatPrereqTree(child)).filter((part): part is string => Boolean(part));
      return parts.length > 0 ? `(${parts.join(' or ')})` : null;
    }
  }
  return null;
};

const summarizeMissingPrereqTree = (tree: unknown, completedModuleCodes: Set<string>): string | null => {
  if (!tree) return null;

  if (typeof tree === 'string') {
    const code = extractModuleCode(tree);
    if (!code) return null;
    const normalizedCode = normalizePrereqCode(code);
    const hasCode = Array.from(completedModuleCodes).some((completed) => normalizePrereqCode(completed) === normalizedCode);
    return hasCode ? null : code;
  }

  if (Array.isArray(tree)) {
    const parts = tree
      .map((child) => summarizeMissingPrereqTree(child, completedModuleCodes))
      .filter((part): part is string => Boolean(part));
    return parts.length > 0 ? parts.join(' and ') : null;
  }

  if (typeof tree === 'object') {
    const record = tree as Record<string, unknown>;

    if (Array.isArray(record.and)) {
      const parts = record.and
        .map((child) => summarizeMissingPrereqTree(child, completedModuleCodes))
        .filter((part): part is string => Boolean(part));
      return parts.length > 0 ? parts.join(' and ') : null;
    }

    if (Array.isArray(record.or)) {
      const branchResults = record.or.map((child) => ({
        missing: summarizeMissingPrereqTree(child, completedModuleCodes),
        satisfied: summarizeMissingPrereqTree(child, completedModuleCodes) === null,
      }));

      if (branchResults.some((branch) => branch.satisfied)) return null;

      const parts = branchResults.map((branch) => branch.missing).filter((part): part is string => Boolean(part));
      if (parts.length === 0) return null;
      return parts.length === 1 ? parts[0] : `(${parts.join(' or ')})`;
    }
  }

  return null;
};

export const formatPrerequisiteSummary = (detail: NusModsModuleDetail): string => {
  if (detail.prerequisite && detail.prerequisite.trim().length > 0) return detail.prerequisite.trim();
  const fromTree = formatPrereqTree(detail.prereqTree);
  return fromTree ?? 'No listed prerequisites.';
};

export const assessPrerequisiteConflict = (
  detail: NusModsModuleDetail,
  completedModuleCodes: Iterable<string>,
): NusModsPrerequisiteAssessment => {
  const normalizedCompletedCodes = new Set(Array.from(completedModuleCodes, (code) => code.trim().toUpperCase()));
  const missingRequirement = summarizeMissingPrereqTree(detail.prereqTree, normalizedCompletedCodes);
  return {
    hasPrerequisiteData: Boolean(detail.prereqTree || detail.prerequisite),
    missingRequirement,
  };
};

export const searchNusModsModules = async (
  query: string,
  limit = 20,
): Promise<{ acadYear: string; items: NusModsModuleSummary[] }> => {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 2) return { acadYear: getAcadYearCandidates()[0], items: [] };

  const { acadYear, data } = await fetchWithAcadYearFallback(fetchModuleListForAcadYear);

  const items = data
    .filter((m) => m.moduleCode.toLowerCase().includes(normalized) || m.title.toLowerCase().includes(normalized))
    .slice(0, limit);

  return { acadYear, items };
};

export const fetchNusModsModuleDetail = async (
  moduleCode: string,
  preferredAcadYear?: string,
): Promise<{ acadYear: string; detail: NusModsModuleDetail }> => {
  const normalizedCode = moduleCode.trim().toUpperCase();
  if (!normalizedCode) throw new Error('Module code is required');

  const cached = detailCache.get(normalizedCode);
  if (cached && (!preferredAcadYear || cached.acadYear === preferredAcadYear)) {
    return cached;
  }

  const candidates = preferredAcadYear
    ? [preferredAcadYear, ...getAcadYearCandidates().filter((item) => item !== preferredAcadYear)]
    : getAcadYearCandidates();

  let lastError: unknown = null;

  for (const acadYear of candidates) {
    try {
      const response = await fetch(`${API_BASE}/${acadYear}/modules/${normalizedCode}.json`);
      if (!response.ok) continue;
      const payload = (await response.json()) as NusModsModuleDetail;
      if (!payload || typeof payload !== 'object' || typeof payload.moduleCode !== 'string') continue;
      const result = { acadYear, detail: payload };
      detailCache.set(normalizedCode, result);
      return result;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Module ${normalizedCode} not found in NUSMods`);
};

export interface NusModsSemesterAvailability {
  hasSemesterData: boolean;
  offeredSemesters: number[];
  isAvailable: boolean;
  warning: string | null;
}

export const checkSemesterAvailability = (
  detail: NusModsModuleDetail,
  currentSem: number,
): NusModsSemesterAvailability => {
  const offered = detail.semesterData?.map((s) => s.semester) ?? [];
  if (offered.length === 0) {
    return {
      hasSemesterData: false,
      offeredSemesters: [],
      isAvailable: true,
      warning: null,
    };
  }

  const isAvailable = offered.includes(currentSem);
  if (isAvailable) {
    return {
      hasSemesterData: true,
      offeredSemesters: offered,
      isAvailable: true,
      warning: null,
    };
  }

  const semNames: Record<number, string> = {
    1: 'Sem 1',
    2: 'Sem 2',
    3: 'Special Term I',
    4: 'Special Term II',
  };
  const offeredStr = offered.map((s) => semNames[s] ?? `Sem ${s}`).join(', ');
  const currentStr = semNames[currentSem] ?? `Sem ${currentSem}`;

  return {
    hasSemesterData: true,
    offeredSemesters: offered,
    isAvailable: false,
    warning: `Not usually offered in ${currentStr} (typically offered in ${offeredStr})`,
  };
};

export const getNusModsTimetableUrl = (sem: number, moduleCodes: string[]): string | null => {
  const cleanCodes = moduleCodes
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2,}[A-Z0-9]*\d[A-Z0-9]*$/.test(c) && !c.startsWith('GEN'));
  if (cleanCodes.length === 0) return null;
  const semSlug = sem === 1 ? 'sem-1' : sem === 2 ? 'sem-2' : sem === 3 ? 'st-i' : 'st-ii';
  const query = cleanCodes.map((code) => `${encodeURIComponent(code)}=`).join('&');
  return `https://nusmods.com/timetable/${semSlug}/share?${query}`;
};

export const extractPrerequisiteCodes = (tree: unknown): string[] => {
  if (!tree) return [];
  if (typeof tree === 'string') {
    const code = extractModuleCode(tree);
    return code ? [code] : [];
  }
  if (Array.isArray(tree)) {
    return Array.from(new Set(tree.flatMap(extractPrerequisiteCodes)));
  }
  if (typeof tree === 'object') {
    const record = tree as Record<string, unknown>;
    const codes: string[] = [];
    if (Array.isArray(record.and)) codes.push(...record.and.flatMap(extractPrerequisiteCodes));
    if (Array.isArray(record.or)) codes.push(...record.or.flatMap(extractPrerequisiteCodes));
    return Array.from(new Set(codes));
  }
  return [];
};

export const isPrerequisiteOf = (
  parentDetail: NusModsModuleDetail,
  candidateCode: string,
): boolean => {
  const codes = extractPrerequisiteCodes(parentDetail.prereqTree);
  const targetNorm = normalizePrereqCode(candidateCode);
  return codes.some((c) => normalizePrereqCode(c) === targetNorm);
};
