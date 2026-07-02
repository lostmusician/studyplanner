import type { StudentSemester, WaivedModule } from './types';

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
}

/** Self-contained payload encoded into a share URL. */
export interface SharePayload {
  v: 1;
  profile: ShareProfile;
  plan: SharePlan;
}

const CURRENT_VERSION = 1 as const;

/** URL hash key under which the encoded payload lives, e.g. `#import=<data>`. */
export const IMPORT_HASH_KEY = 'import';

const toBase64Url = (json: string): string => {
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (encoded: string): string => {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
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

/** Builds a full share link for the current page from a payload. */
export const buildShareLink = (payload: Omit<SharePayload, 'v'>): string => {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#${IMPORT_HASH_KEY}=${encodePlan(payload)}`;
};

/** Reads and decodes an import payload from a URL hash string (e.g. location.hash). */
export const readImportFromHash = (hash: string): SharePayload | null => {
  const match = hash.replace(/^#/, '').match(new RegExp(`(?:^|&)${IMPORT_HASH_KEY}=([^&]+)`));
  if (!match) return null;
  return decodePlan(match[1]);
};
