import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchNusModsModuleDetail,
  formatPrerequisiteSummary,
  assessPrerequisiteConflict,
  type NusModsModuleDetail,
} from './nusmods';

// Builds a minimal fetch Response stand-in. `ok: false` simulates a 404 from the NUSMods API.
const jsonResponse = (body: unknown, ok = true) => ({ ok, json: async () => body });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('searchNusModsModules', () => {
  // The module-list cache lives at module scope (`listCache`), so a fresh module instance is
  // imported for every test in this block. Without this, a search in one test would populate the
  // cache and silently suppress the `fetch` call a later test expects to observe.
  let searchNusModsModules: typeof import('./nusmods').searchNusModsModules;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    ({ searchNusModsModules } = await import('./nusmods'));
  });

  it('returns no results for a query under 2 chars, since a 1-char search would fetch the entire module list for nothing', async () => {
    const result = await searchNusModsModules(' a ');
    expect(result.items).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('matches on module code case-insensitively', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([
        { moduleCode: 'CS1101S', title: 'Programming Methodology', semesters: [1] },
        { moduleCode: 'MA1521', title: 'Calculus', semesters: [1, 2] },
      ]),
    );
    const result = await searchNusModsModules('cs1101s');
    expect(result.items.map((m) => m.moduleCode)).toEqual(['CS1101S']);
  });

  it('matches on module title case-insensitively', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([
        { moduleCode: 'CS1101S', title: 'Programming Methodology', semesters: [1] },
        { moduleCode: 'MA1521', title: 'Calculus', semesters: [1, 2] },
      ]),
    );
    const result = await searchNusModsModules('CALCULUS');
    expect(result.items.map((m) => m.moduleCode)).toEqual(['MA1521']);
  });

  it('truncates results to the default limit of 20 when more modules match than the limit allows', async () => {
    const modules = Array.from({ length: 25 }, (_, i) => ({
      moduleCode: `CS1${String(i).padStart(3, '0')}`,
      title: `Test Module ${i}`,
      semesters: [1],
    }));
    fetchMock.mockResolvedValue(jsonResponse(modules));
    const result = await searchNusModsModules('cs1');
    expect(result.items).toHaveLength(20);
  });

  it('caches the module list per acad year, so a second search does not refetch the whole list', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse([{ moduleCode: 'CS1101S', title: 'Programming Methodology', semesters: [1] }]),
    );
    await searchNusModsModules('cs1101s');
    await searchNusModsModules('programming');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('fetchNusModsModuleDetail', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('returns the parsed detail when the first attempted acad year succeeds', async () => {
    const detail: NusModsModuleDetail = { moduleCode: 'CS1101S', title: 'Programming Methodology' };
    fetchMock.mockResolvedValue(jsonResponse(detail));

    const result = await fetchNusModsModuleDetail('CS1101S');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/v2\/\d{4}-\d{4}\/modules\/CS1101S\.json$/);
    expect(result.detail).toEqual(detail);
  });

  it('retries against the next candidate acad year when the first returns a 404', async () => {
    const detail: NusModsModuleDetail = { moduleCode: 'CS1101S', title: 'Programming Methodology' };
    fetchMock
      .mockResolvedValueOnce(jsonResponse(null, false))
      .mockResolvedValueOnce(jsonResponse(detail));

    const result = await fetchNusModsModuleDetail('CS1101S');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstYear = String(fetchMock.mock.calls[0][0]).match(/\/v2\/(\d{4}-\d{4})\//)?.[1];
    const secondYear = String(fetchMock.mock.calls[1][0]).match(/\/v2\/(\d{4}-\d{4})\//)?.[1];
    expect(secondYear).not.toBe(firstYear);
    expect(result.acadYear).toBe(secondYear);
    expect(result.detail).toEqual(detail);
  });

  it('throws a "not found" error when every candidate acad year fails', async () => {
    fetchMock.mockResolvedValue(jsonResponse(null, false));

    await expect(fetchNusModsModuleDetail('CS9999X')).rejects.toThrow(/CS9999X not found in NUSMods/);
  });

  it('tries preferredAcadYear first even when it is not the auto-derived "most likely" year', async () => {
    const detail: NusModsModuleDetail = { moduleCode: 'CS1101S', title: 'Programming Methodology' };
    fetchMock.mockResolvedValue(jsonResponse(detail));

    const result = await fetchNusModsModuleDetail('CS1101S', '1999-2000');

    expect(fetchMock.mock.calls[0][0]).toContain('/v2/1999-2000/modules/CS1101S.json');
    expect(result.acadYear).toBe('1999-2000');
  });

  it('treats a malformed payload missing moduleCode as a failure and continues the retry loop', async () => {
    const validDetail: NusModsModuleDetail = { moduleCode: 'CS1101S', title: 'Programming Methodology' };
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ title: 'Missing module code' }))
      .mockResolvedValueOnce(jsonResponse(validDetail));

    const result = await fetchNusModsModuleDetail('CS1101S');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.detail).toEqual(validDetail);
  });

  it('throws synchronously without calling fetch when the module code is empty or whitespace-only', async () => {
    await expect(fetchNusModsModuleDetail('   ')).rejects.toThrow('Module code is required');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('formatPrerequisiteSummary', () => {
  it('prefers the raw `prerequisite` string over `prereqTree` when both are present', () => {
    const detail: NusModsModuleDetail = {
      moduleCode: 'CS2100',
      title: 'Computer Organisation',
      prerequisite: '  CS1010 or equivalent  ',
      prereqTree: { or: ['CS1010', 'CS1101S'] },
    };
    expect(formatPrerequisiteSummary(detail)).toBe('CS1010 or equivalent');
  });

  it('falls back to a tree-derived string when `prerequisite` is absent', () => {
    const detail: NusModsModuleDetail = {
      moduleCode: 'CS2100',
      title: 'Computer Organisation',
      prereqTree: { or: ['CS1010', 'CS1101S'] },
    };
    expect(formatPrerequisiteSummary(detail)).toBe('(CS1010 or CS1101S)');
  });

  it('returns the literal fallback string when neither `prerequisite` nor `prereqTree` is present', () => {
    const detail: NusModsModuleDetail = { moduleCode: 'CS2100', title: 'Computer Organisation' };
    expect(formatPrerequisiteSummary(detail)).toBe('No listed prerequisites.');
  });
});

describe('assessPrerequisiteConflict', () => {
  it('reports hasPrerequisiteData as false when the module has neither prereqTree nor prerequisite', () => {
    const detail: NusModsModuleDetail = { moduleCode: 'CS1010', title: 'Programming Methodology' };
    const result = assessPrerequisiteConflict(detail, []);
    expect(result.hasPrerequisiteData).toBe(false);
    expect(result.missingRequirement).toBeNull();
  });

  it('an and-tree has no missingRequirement once every branch is completed', () => {
    const detail: NusModsModuleDetail = {
      moduleCode: 'CS2100',
      title: 'Computer Organisation',
      prereqTree: { and: ['CS1010', 'MA1521'] },
    };
    const result = assessPrerequisiteConflict(detail, ['CS1010', 'MA1521']);
    expect(result.missingRequirement).toBeNull();
  });

  it('an and-tree names the single branch that is not yet completed', () => {
    const detail: NusModsModuleDetail = {
      moduleCode: 'CS2100',
      title: 'Computer Organisation',
      prereqTree: { and: ['CS1010', 'MA1521'] },
    };
    const result = assessPrerequisiteConflict(detail, ['CS1010']);
    expect(result.missingRequirement).toBe('MA1521');
  });

  it('an or-tree has no missingRequirement when just one of several branches is satisfied', () => {
    // A naive AND-style walk over the tree would wrongly flag this as missing; the source
    // short-circuits to null as soon as any single `or` branch is satisfied.
    const detail: NusModsModuleDetail = {
      moduleCode: 'CS2103T',
      title: 'Software Engineering',
      prereqTree: { or: ['CS1010', 'CS1101S'] },
    };
    const result = assessPrerequisiteConflict(detail, ['CS1010']);
    expect(result.missingRequirement).toBeNull();
  });

  it('an or-tree with no branch satisfied lists all alternatives joined by "or" in parens', () => {
    const detail: NusModsModuleDetail = {
      moduleCode: 'CS2103T',
      title: 'Software Engineering',
      prereqTree: { or: ['CS1010', 'CS1101S'] },
    };
    const result = assessPrerequisiteConflict(detail, []);
    expect(result.missingRequirement).toBe('(CS1010 or CS1101S)');
  });

  it('an or-tree with a single unmet branch reports it plainly, without parens or the "or" join', () => {
    const detail: NusModsModuleDetail = {
      moduleCode: 'CS2103T',
      title: 'Software Engineering',
      prereqTree: { or: ['CS1010'] },
    };
    const result = assessPrerequisiteConflict(detail, []);
    expect(result.missingRequirement).toBe('CS1010');
  });

  it('a nested and-containing-or tree recurses correctly, combining a plain code with a parenthesised alternative', () => {
    const detail: NusModsModuleDetail = {
      moduleCode: 'CS3230',
      title: 'Design and Analysis of Algorithms',
      prereqTree: { and: ['MA1521', { or: ['CS1010', 'CS1101S'] }] },
    };
    const result = assessPrerequisiteConflict(detail, []);
    expect(result.missingRequirement).toBe('MA1521 and (CS1010 or CS1101S)');
  });

  it('normalizes completed module codes (trim + uppercase) before comparing against the tree', () => {
    const detail: NusModsModuleDetail = {
      moduleCode: 'CS2100',
      title: 'Computer Organisation',
      prereqTree: { and: ['CS1010', 'MA1521'] },
    };
    const result = assessPrerequisiteConflict(detail, ['  cs1010 ', 'ma1521']);
    expect(result.missingRequirement).toBeNull();
  });
});
