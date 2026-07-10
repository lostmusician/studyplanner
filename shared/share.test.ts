import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  encodeCompactPlan,
  decodeCompactPlan,
  encodePlan,
  decodePlan,
  buildShareLink,
  readImportFromHash,
  SHORT_IMPORT_HASH_KEY,
  IMPORT_HASH_KEY,
} from './share';

// Shared across every describe block below (and the pre-existing compact-codec
// tests) so payload shape only needs to be defined once.
const basePayload = {
  profile: { name: 'Alex Tan', matricNumber: 'A0123456X', year: 'Year 2' },
  plan: {
    majorId: 'computer-science-nusc',
    semesters: [
      {
        year: 1,
        sem: 1,
        modules: [{ code: 'CS1101S', name: 'Programming Methodology', mcs: 4, categoryId: 'soc-common' }],
      },
    ],
    waivedModules: [],
  },
};

// Re-implements share.ts's private toBase64Url encoder so tests can construct
// deliberately malformed/tampered v1 payloads (wrong version, missing fields,
// wrong field types) without share.ts needing to export its internals.
const encodeRaw = (obj: unknown): string => {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

describe('encodeCompactPlan / decodeCompactPlan round trip', () => {
  it('round-trips a plan with no secondary programme declared', () => {
    const encoded = encodeCompactPlan(basePayload);
    const decoded = decodeCompactPlan(encoded);
    expect(decoded?.plan.secondMajorId ?? null).toBeNull();
    expect(decoded?.plan.minorIds ?? []).toEqual([]);
    expect(decoded?.plan.requirementMappings ?? {}).toEqual({});
    expect(decoded?.plan.nocDuration ?? null).toBeNull();
  });

  it('round-trips a declared second major, minors, requirement mappings, and NOC duration', () => {
    const payload = {
      ...basePayload,
      plan: {
        ...basePayload.plan,
        secondMajorId: 'mathematics',
        minorIds: ['statistics', 'economics'],
        requirementMappings: { 'Programming Methodology': ['CS2101'] },
        nocDuration: '1-year' as const,
      },
    };
    const encoded = encodeCompactPlan(payload);
    const decoded = decodeCompactPlan(encoded);
    expect(decoded?.plan.secondMajorId).toBe('mathematics');
    expect(decoded?.plan.minorIds).toEqual(['statistics', 'economics']);
    expect(decoded?.plan.requirementMappings).toEqual({ 'Programming Methodology': ['CS2101'] });
    expect(decoded?.plan.nocDuration).toBe('1-year');
  });

  it('drops name/mcs for a module matching the catalog exactly, falling back to the code as name and 0 mcs on decode (lossy by design)', () => {
    // isCatalogEquivalent finds a catalog entry for CS1101S with the same
    // name/mcs, so compactModule emits the short 2-element tuple. expandModule
    // has no catalog to consult, so it can only fall back to the bare code.
    const catalog = { CS1101S: { code: 'CS1101S', name: 'Programming Methodology', mcs: 4 } };
    const encoded = encodeCompactPlan(basePayload, catalog);
    const decoded = decodeCompactPlan(encoded);
    const decodedModule = decoded?.plan.semesters[0]?.modules[0];
    expect(decodedModule?.name).toBe('CS1101S');
    expect(decodedModule?.mcs).toBe(0);
  });

  it('round-trips a module that does not match the catalog losslessly (full 4-element compact tuple)', () => {
    const catalog = { CS1101S: { code: 'CS1101S', name: 'A Different Name', mcs: 99 } };
    const encoded = encodeCompactPlan(basePayload, catalog);
    const decoded = decodeCompactPlan(encoded);
    const decodedModule = decoded?.plan.semesters[0]?.modules[0];
    expect(decodedModule?.name).toBe('Programming Methodology');
    expect(decodedModule?.mcs).toBe(4);
  });

  it('round-trips a module losslessly when no catalog is passed at all', () => {
    const encoded = encodeCompactPlan(basePayload);
    const decoded = decodeCompactPlan(encoded);
    const decodedModule = decoded?.plan.semesters[0]?.modules[0];
    expect(decodedModule?.name).toBe('Programming Methodology');
    expect(decodedModule?.mcs).toBe(4);
  });

  it('round-trips a waived module alongside placed modules', () => {
    const payload = {
      ...basePayload,
      plan: {
        ...basePayload.plan,
        waivedModules: [{ code: 'GEA1000', name: 'Quantitative Reasoning', mcs: 4, categoryId: 'ge' }],
      },
    };
    const encoded = encodeCompactPlan(payload);
    const decoded = decodeCompactPlan(encoded);
    expect(decoded?.plan.waivedModules).toEqual([
      { code: 'GEA1000', name: 'Quantitative Reasoning', mcs: 4, categoryId: 'ge' },
    ]);
  });

  it('drops a semester with zero modules entirely from the encoded output rather than keeping it as an empty entry', () => {
    const payload = {
      ...basePayload,
      plan: {
        ...basePayload.plan,
        semesters: [...basePayload.plan.semesters, { year: 1, sem: 2, modules: [] }],
      },
    };
    const encoded = encodeCompactPlan(payload);
    const decoded = decodeCompactPlan(encoded);
    expect(decoded?.plan.semesters).toHaveLength(1);
    expect(decoded?.plan.semesters.some((semester) => semester.year === 1 && semester.sem === 2)).toBe(false);
  });
});

describe('encodePlan / decodePlan (legacy v1 codec)', () => {
  it('round-trips profile, majorId, and semesters', () => {
    const encoded = encodePlan(basePayload);
    const decoded = decodePlan(encoded);
    expect(decoded?.profile).toEqual(basePayload.profile);
    expect(decoded?.plan.majorId).toBe(basePayload.plan.majorId);
    expect(decoded?.plan.semesters).toEqual(basePayload.plan.semesters);
  });

  it('does not carry secondMajorId/minorIds/requirementMappings/nocDuration on round trip — this gap is why share links moved to the v2 compact codec for those fields, not a v1 bug', () => {
    const payload = {
      ...basePayload,
      plan: {
        ...basePayload.plan,
        secondMajorId: 'mathematics',
        minorIds: ['statistics'],
        requirementMappings: { 'Programming Methodology': ['CS2101'] },
        nocDuration: '1-year' as const,
      },
    };
    const encoded = encodePlan(payload);
    const decoded = decodePlan(encoded);
    expect(decoded?.plan.majorId).toBe(payload.plan.majorId);
    expect(decoded?.plan.secondMajorId).toBeUndefined();
    expect(decoded?.plan.minorIds).toBeUndefined();
    expect(decoded?.plan.requirementMappings).toBeUndefined();
    expect(decoded?.plan.nocDuration).toBeUndefined();
  });

  it('returns null when the decoded version tag is not 1', () => {
    const encoded = encodeRaw({ v: 2, profile: basePayload.profile, plan: basePayload.plan });
    expect(decodePlan(encoded)).toBeNull();
  });

  it('returns null when profile is missing', () => {
    const encoded = encodeRaw({ v: 1, plan: basePayload.plan });
    expect(decodePlan(encoded)).toBeNull();
  });

  it('returns null when plan is missing', () => {
    const encoded = encodeRaw({ v: 1, profile: basePayload.profile });
    expect(decodePlan(encoded)).toBeNull();
  });

  it('returns null when plan.majorId is not a string', () => {
    const encoded = encodeRaw({ v: 1, profile: basePayload.profile, plan: { ...basePayload.plan, majorId: 42 } });
    expect(decodePlan(encoded)).toBeNull();
  });

  it('returns null when plan.semesters is not an array', () => {
    const encoded = encodeRaw({
      v: 1,
      profile: basePayload.profile,
      plan: { ...basePayload.plan, semesters: 'not-an-array' },
    });
    expect(decodePlan(encoded)).toBeNull();
  });

  it('returns null (not a throw) on malformed base64/non-JSON input, so a corrupted share link degrades gracefully instead of crashing the app', () => {
    expect(() => decodePlan('not-valid-base64!!!')).not.toThrow();
    expect(decodePlan('not-valid-base64!!!')).toBeNull();
  });
});

describe('buildShareLink', () => {
  // buildShareLink reads window.location, which doesn't exist under vitest's
  // 'node' test environment. Stubbing just `window` avoids switching the
  // whole suite to a jsdom environment (and the new devDependency that would
  // require) for the sake of one function.
  beforeEach(() => {
    vi.stubGlobal('window', {
      location: { origin: 'https://example.com', pathname: '/plan' },
    } as unknown as typeof window);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds a link shaped as `${origin}${pathname}#${SHORT_IMPORT_HASH_KEY}=<encoded>`', () => {
    const link = buildShareLink(basePayload);
    expect(link.startsWith(`https://example.com/plan#${SHORT_IMPORT_HASH_KEY}=`)).toBe(true);
  });

  it('encodes a payload that decodeCompactPlan reads back correctly, proving the two are wire-format consistent', () => {
    const link = buildShareLink(basePayload);
    const encoded = link.split(`#${SHORT_IMPORT_HASH_KEY}=`)[1];
    const decoded = decodeCompactPlan(encoded);
    expect(decoded?.profile).toEqual(basePayload.profile);
    expect(decoded?.plan.majorId).toBe(basePayload.plan.majorId);
  });
});

describe('readImportFromHash', () => {
  it('decodes via the compact v2 codec when the short key is present', () => {
    const encoded = encodeCompactPlan(basePayload);
    const decoded = readImportFromHash(`#${SHORT_IMPORT_HASH_KEY}=${encoded}`);
    expect(decoded?.plan.majorId).toBe(basePayload.plan.majorId);
  });

  it('decodes via the legacy v1 codec when only the long "import" key is present', () => {
    const encoded = encodePlan(basePayload);
    const decoded = readImportFromHash(`#${IMPORT_HASH_KEY}=${encoded}`);
    expect(decoded?.plan.majorId).toBe(basePayload.plan.majorId);
  });

  it('prefers the short key when both keys are present in the same hash, since the short-key match is checked first and returns immediately', () => {
    const shortPayload = { ...basePayload, plan: { ...basePayload.plan, majorId: 'short-major' } };
    const legacyPayload = { ...basePayload, plan: { ...basePayload.plan, majorId: 'legacy-major' } };
    const shortEncoded = encodeCompactPlan(shortPayload);
    const legacyEncoded = encodePlan(legacyPayload);
    const decoded = readImportFromHash(
      `#${SHORT_IMPORT_HASH_KEY}=${shortEncoded}&${IMPORT_HASH_KEY}=${legacyEncoded}`,
    );
    expect(decoded?.plan.majorId).toBe('short-major');
  });

  it('returns null when neither the short nor the legacy key is present', () => {
    expect(readImportFromHash('#foo=bar')).toBeNull();
  });

  it('returns null rather than throwing when the matched hash value fails to decode, confirming graceful degradation holds end-to-end through this entry point', () => {
    expect(() => readImportFromHash(`#${SHORT_IMPORT_HASH_KEY}=garbage!!!`)).not.toThrow();
    expect(readImportFromHash(`#${SHORT_IMPORT_HASH_KEY}=garbage!!!`)).toBeNull();
  });
});
