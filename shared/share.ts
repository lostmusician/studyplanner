import type { Module, PlacedModule, StudentSemester, WaivedModule, NocDuration } from './types';

/** Personal identity carried in a share link. */
export interface ShareProfile {
  name: string;
  matricNumber: string;
  year: string;
}

/** The current major's plan carried in a share link. */
export interface SharePlan {
  majorId: string;
  semesters: StudentSemester[];
  waivedModules: WaivedModule[];
  secondMajorId?: string | null;
  minorIds?: string[];
  requirementMappings?: Record<string, string[]>;
  nocDuration?: NocDuration | null;
}

/** Self-contained payload encoded into a share URL. */
export interface SharePayload {
  v: 1;
  profile: ShareProfile;
  plan: SharePlan;
}

const CURRENT_VERSION = 1 as const;
const COMPACT_VERSION = 2 as const;

/** URL hash key under which the encoded payload lives, e.g. `#import=<data>`. */
export const IMPORT_HASH_KEY = 'import';
export const SHORT_IMPORT_HASH_KEY = 'i';

type ModuleCatalog = Record<string, Module>;
type CompactModule = [code: string, categoryId: string] | [code: string, categoryId: string, name: string, mcs: number];
type CompactSemester = [year: number, sem: number, modules: CompactModule[]];

interface CompactSharePayload {
  v: typeof COMPACT_VERSION;
  p: [name: string, matricNumber: string, year: string];
  m: string;
  s: CompactSemester[];
  w: CompactModule[];
  /** Declared second major id. Omitted entirely when none is declared. */
  sm?: string;
  /** Declared minor ids. Omitted entirely when empty. */
  mn?: string[];
  /** Manual requirement-name -> module-code mappings. Omitted entirely when empty. */
  rm?: Record<string, string[]>;
  /** Declared NOC duration. Omitted entirely when not on NOC. */
  noc?: NocDuration;
}

const toBase64Url = (json: string): string => {
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (encoded: string): string => {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encoded.length / 4) * 4, '=');
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const isCatalogEquivalent = (module: PlacedModule, catalog?: ModuleCatalog): boolean => {
  const catalogModule = catalog?.[module.code];
  return Boolean(catalogModule && catalogModule.name === module.name && catalogModule.mcs === module.mcs);
};

const compactModule = (module: PlacedModule, catalog?: ModuleCatalog): CompactModule =>
  isCatalogEquivalent(module, catalog)
    ? [module.code, module.categoryId]
    : [module.code, module.categoryId, module.name, module.mcs];

const expandModule = (module: unknown): PlacedModule | null => {
  if (!Array.isArray(module)) return null;
  const [code, categoryId, name, mcs] = module;
  const normalizedCode = String(code ?? '').trim().toUpperCase();
  if (!normalizedCode) return null;
  return {
    code: normalizedCode,
    categoryId: String(categoryId ?? ''),
    name: typeof name === 'string' && name.trim() ? name : normalizedCode,
    mcs: Number.isFinite(Number(mcs)) ? Number(mcs) : 0,
  };
};

const expandModules = (modules: unknown): PlacedModule[] =>
  Array.isArray(modules)
    ? modules.map(expandModule).filter((module): module is PlacedModule => Boolean(module))
    : [];

const compactPayload = (payload: Omit<SharePayload, 'v'>, catalog?: ModuleCatalog): CompactSharePayload => {
  const compact: CompactSharePayload = {
    v: COMPACT_VERSION,
    p: [payload.profile.name, payload.profile.matricNumber, payload.profile.year],
    m: payload.plan.majorId,
    s: payload.plan.semesters
      .map((semester): CompactSemester => [
        semester.year,
        semester.sem,
        semester.modules.map((module) => compactModule(module, catalog)),
      ])
      .filter((semester) => semester[2].length > 0),
    w: payload.plan.waivedModules.map((module) => compactModule(module, catalog)),
  };
  if (payload.plan.secondMajorId) compact.sm = payload.plan.secondMajorId;
  if (payload.plan.minorIds && payload.plan.minorIds.length > 0) compact.mn = payload.plan.minorIds;
  if (payload.plan.requirementMappings && Object.keys(payload.plan.requirementMappings).length > 0) {
    compact.rm = payload.plan.requirementMappings;
  }
  if (payload.plan.nocDuration) compact.noc = payload.plan.nocDuration;
  return compact;
};

/** Encodes a payload into a base64url string suitable for a URL hash. */
export const encodePlan = (payload: Omit<SharePayload, 'v'>): string =>
  toBase64Url(JSON.stringify({ v: CURRENT_VERSION, ...payload }));

/** Decodes a share string. Returns null on any parse, shape, or version failure. */
export const decodePlan = (encoded: string): SharePayload | null => {
  try {
    const parsed = JSON.parse(fromBase64Url(encoded)) as Partial<SharePayload>;
    if (parsed.v !== CURRENT_VERSION) return null;
    if (!parsed.profile || !parsed.plan) return null;
    const { plan } = parsed;
    if (typeof plan.majorId !== 'string' || !Array.isArray(plan.semesters)) return null;
    return {
      v: CURRENT_VERSION,
      profile: {
        name: String(parsed.profile.name ?? ''),
        matricNumber: String(parsed.profile.matricNumber ?? ''),
        year: String(parsed.profile.year ?? ''),
      },
      plan: {
        majorId: plan.majorId,
        semesters: plan.semesters,
        waivedModules: Array.isArray(plan.waivedModules) ? plan.waivedModules : [],
      },
    };
  } catch {
    return null;
  }
};

/** Encodes a compact payload into a shorter URL-safe share string. */
export const encodeCompactPlan = (payload: Omit<SharePayload, 'v'>, catalog?: ModuleCatalog): string =>
  toBase64Url(JSON.stringify(compactPayload(payload, catalog)));

const isRequirementMappings = (value: unknown): value is Record<string, string[]> =>
  Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.values(value).every((codes) => Array.isArray(codes) && codes.every((c) => typeof c === 'string')),
  );

/** Decodes the compact v2 share string. Returns null on parse, shape, or version failure. */
export const decodeCompactPlan = (encoded: string): SharePayload | null => {
  try {
    const parsed = JSON.parse(fromBase64Url(encoded)) as Partial<CompactSharePayload>;
    if (parsed.v !== COMPACT_VERSION) return null;
    if (!Array.isArray(parsed.p) || typeof parsed.m !== 'string' || !Array.isArray(parsed.s)) return null;

    return {
      v: CURRENT_VERSION,
      profile: {
        name: String(parsed.p[0] ?? ''),
        matricNumber: String(parsed.p[1] ?? ''),
        year: String(parsed.p[2] ?? ''),
      },
      plan: {
        majorId: parsed.m,
        semesters: parsed.s
          .filter((semester): semester is CompactSemester => Array.isArray(semester) && semester.length >= 3)
          .map(([year, sem, modules]) => ({
            year: Number(year),
            sem: Number(sem),
            modules: expandModules(modules),
          }))
          .filter((semester) => Number.isFinite(semester.year) && Number.isFinite(semester.sem)),
        waivedModules: expandModules(parsed.w),
        secondMajorId: typeof parsed.sm === 'string' ? parsed.sm : null,
        minorIds: Array.isArray(parsed.mn) ? parsed.mn.filter((id): id is string => typeof id === 'string') : [],
        requirementMappings: isRequirementMappings(parsed.rm) ? parsed.rm : {},
        nocDuration: parsed.noc === '6-month' || parsed.noc === '1-year' ? parsed.noc : null,
      },
    };
  } catch {
    return null;
  }
};

/** Builds a full share link for the current page from a payload. */
export const buildShareLink = (payload: Omit<SharePayload, 'v'>, catalog?: ModuleCatalog): string => {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#${SHORT_IMPORT_HASH_KEY}=${encodeCompactPlan(payload, catalog)}`;
};

/** Reads and decodes an import payload from a URL hash string (e.g. location.hash). */
export const readImportFromHash = (hash: string): SharePayload | null => {
  const normalizedHash = hash.replace(/^#/, '');
  const shortMatch = normalizedHash.match(new RegExp(`(?:^|&)${SHORT_IMPORT_HASH_KEY}=([^&]+)`));
  if (shortMatch) return decodeCompactPlan(shortMatch[1]);
  const match = normalizedHash.match(new RegExp(`(?:^|&)${IMPORT_HASH_KEY}=([^&]+)`));
  return match ? decodePlan(match[1]) : null;
};
