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
  moduleCredit?: string;
  semesterData?: NusModsSemesterData[];
  prerequisite?: string;
  prereqTree?: unknown;
}

const API_BASE = 'https://api.nusmods.com/v2';
const listCache = new Map<string, NusModsModuleSummary[]>();

const toAcadYearSlug = (startYear: number): string => `${startYear}-${startYear + 1}`;

const getLikelyAcadYearStart = (date: Date): number => {
  // NUS academic year typically starts in August.
  return date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1;
};

const getAcadYearCandidates = (): string[] => {
  const start = getLikelyAcadYearStart(new Date());
  return [toAcadYearSlug(start), toAcadYearSlug(start - 1), toAcadYearSlug(start + 1)];
};

const uniqNumbers = (values: number[]): number[] => Array.from(new Set(values)).sort((a, b) => a - b);

const isModuleSummary = (value: unknown): value is { moduleCode: string; title: string; semesters?: number[] } => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.moduleCode === 'string' && typeof candidate.title === 'string';
};

const fetchModuleListForAcadYear = async (acadYear: string): Promise<NusModsModuleSummary[]> => {
  const cached = listCache.get(acadYear);
  if (cached) {
    return cached;
  }

  const response = await fetch(`${API_BASE}/${acadYear}/moduleList.json`);
  if (!response.ok) {
    throw new Error(`Unable to load NUSMods module list for ${acadYear}`);
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error(`Unexpected module list payload for ${acadYear}`);
  }

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
  if (!tree) {
    return null;
  }

  if (typeof tree === 'string') {
    return tree;
  }

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

export const formatPrerequisiteSummary = (detail: NusModsModuleDetail): string => {
  if (detail.prerequisite && detail.prerequisite.trim().length > 0) {
    return detail.prerequisite.trim();
  }

  const fromTree = formatPrereqTree(detail.prereqTree);
  return fromTree ?? 'No listed prerequisites.';
};

export const searchNusModsModules = async (
  query: string,
  limit = 20,
): Promise<{ acadYear: string; items: NusModsModuleSummary[] }> => {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 2) {
    return { acadYear: getAcadYearCandidates()[0], items: [] };
  }

  const { acadYear, data } = await fetchWithAcadYearFallback(fetchModuleListForAcadYear);

  const items = data
    .filter((moduleItem) =>
      moduleItem.moduleCode.toLowerCase().includes(normalized) || moduleItem.title.toLowerCase().includes(normalized),
    )
    .slice(0, limit);

  return { acadYear, items };
};

export const fetchNusModsModuleDetail = async (
  moduleCode: string,
  preferredAcadYear?: string,
): Promise<{ acadYear: string; detail: NusModsModuleDetail }> => {
  const normalizedCode = moduleCode.trim().toUpperCase();
  if (!normalizedCode) {
    throw new Error('Module code is required');
  }

  const candidates = preferredAcadYear
    ? [preferredAcadYear, ...getAcadYearCandidates().filter((item) => item !== preferredAcadYear)]
    : getAcadYearCandidates();

  let lastError: unknown = null;

  for (const acadYear of candidates) {
    try {
      const response = await fetch(`${API_BASE}/${acadYear}/modules/${normalizedCode}.json`);
      if (!response.ok) {
        continue;
      }

      const payload = (await response.json()) as NusModsModuleDetail;
      if (!payload || typeof payload !== 'object' || typeof payload.moduleCode !== 'string') {
        continue;
      }

      return { acadYear, detail: payload };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Module ${normalizedCode} not found in NUSMods`);
};
