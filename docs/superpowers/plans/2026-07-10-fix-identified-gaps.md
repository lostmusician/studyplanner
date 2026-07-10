# Fix Identified Gaps (Share Data Loss, Admin Tooling, Test Coverage) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the share/review pipeline silently dropping second-major/minor/requirement-mapping data, add automated test coverage for the counting logic in `src/lib/studyPlan.ts`, extend data validation to the second-major/minor JSON files, remove orphaned dead code, and give the admin tool a builder for `SecondaryProgramme` (second-major/minor) data so it no longer has to be hand-typed.

**Architecture:** Nine independent, sequential tasks. Tasks 1-4 fix the share/review bug end to end (types → hook → UI call sites), with Task 1 also standing up the project's first test framework and a regression-safety-net test suite for the existing pure counting logic. Task 5 is a small dead-code removal. Task 6 extends JSON validation tooling. Tasks 7-9 add a `SecondaryProgramme` builder to the `admin/` app, mirroring the existing `MajorBuilder` pattern.

**Tech Stack:** React 19 + TypeScript 5.8 + Vite 6, Tailwind (utility classes, no new UI libraries), Vitest (new, added in Task 1) for unit tests.

## Global Constraints

- Windows machine. Verify every task with `npx tsc --noEmit` (must exit 0, no output) from the repo root — this is the project's existing verification convention (see `docs/todos/expandable-category-cards.md`).
- No test framework existed before this plan; Task 1 adds Vitest. Only the pure logic in `shared/` and `src/lib/` gets unit tests — do not add React component tests (out of scope, not requested).
- Match existing Tailwind style: palette tokens `ink`, `canvas`, `paper`, `muted`; rounded cards (`rounded-xl`/`rounded-2xl`/`rounded-4xl`).
- Do not add AI attribution to commit messages.
- Do not touch `shared/data/second-majors/*.json` or `shared/data/minors/*.json` content in this plan except to fix concrete validation failures the new script reports (Task 6) — modeling NOC or auditing curriculum depth is out of scope here (tracked separately).
- `admin/` and the root student app (`src/`) are two independent Vite projects sharing `shared/`; each has its own `tsc --noEmit` (root `tsconfig.json` covers `src`+`shared`; `admin/tsconfig.json` covers `admin/src`+`shared`). Run both where a task touches `admin/`.

---

### Task 1: Add Vitest + a regression-safety-net test suite for `src/lib/studyPlan.ts`

**Files:**
- Modify: `package.json` (add `vitest` devDependency, `"test"` script)
- Create: `vitest.config.ts`
- Create: `src/lib/studyPlan.test.ts`

**Interfaces:**
- Consumes: existing exports of `src/lib/studyPlan.ts` — `matchesFulfiller`, `courseLevel`, `computeStats`, `computeRequirements`, `computeDoubleCount`, `computeTripleCountedCodes`, `computeFocusAreas`, `computeBreadthDepth`, `autoCategoryId`. No changes to that file in this task.
- Produces: `vitest.config.ts` resolving `@shared/*` the same way `vite.config.ts` does, so later tasks' test files (Task 2) can rely on it without extra setup.

- [ ] **Step 1: Install Vitest**

Run: `npm install -D vitest`
Expected: `vitest` added under `devDependencies` in `package.json`.

- [ ] **Step 2: Add the Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'shared'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'shared/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Add the `test` npm script**

Modify `package.json`'s `"scripts"` block — add `"test": "vitest run"` alongside the existing `dev`/`build`/`preview` entries.

- [ ] **Step 4: Write the test suite**

Create `src/lib/studyPlan.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { Major, SecondaryProgramme, StudentSemester } from '@shared/types';
import {
  matchesFulfiller,
  courseLevel,
  computeStats,
  computeRequirements,
  computeDoubleCount,
  computeTripleCountedCodes,
  computeFocusAreas,
  computeBreadthDepth,
  autoCategoryId,
} from './studyPlan';

interface FixtureModule {
  code: string;
  name: string;
  mcs: number;
  categoryId: string;
  year: number;
  sem: number;
}

const semesters = (modules: FixtureModule[]): StudentSemester[] => {
  const grid: StudentSemester[] = [1, 2, 3, 4].flatMap((year) => [1, 2].map((sem) => ({ year, sem, modules: [] })));
  for (const m of modules) {
    const target = grid.find((s) => s.year === m.year && s.sem === m.sem)!;
    target.modules.push({ code: m.code, name: m.name, mcs: m.mcs, categoryId: m.categoryId });
  }
  return grid;
};

describe('matchesFulfiller', () => {
  it('matches an exact code', () => {
    expect(matchesFulfiller('CS1101S', 'CS1101S')).toBe(true);
    expect(matchesFulfiller('CS1101', 'CS1101S')).toBe(false);
  });

  it('matches a prefix when the fulfiller ends in *', () => {
    expect(matchesFulfiller('NHS2001', 'NHS*')).toBe(true);
    expect(matchesFulfiller('NST2001', 'NHS*')).toBe(false);
  });
});

describe('courseLevel', () => {
  it('derives the thousand-level from a course code', () => {
    expect(courseLevel('CS4231')).toBe(4000);
    expect(courseLevel('CS2103T')).toBe(2000);
    expect(courseLevel('MA1521')).toBe(1000);
  });
});

describe('computeStats', () => {
  it('sums MC per category and overall', () => {
    const major = { totalMcTarget: 160 } as Major;
    const sems = semesters([
      { code: 'CS1101S', name: 'Programming Methodology', mcs: 4, categoryId: 'cs-foundation', year: 1, sem: 1 },
      { code: 'MA1521', name: 'Calculus', mcs: 4, categoryId: 'math-sciences', year: 1, sem: 1 },
      { code: 'CS2030S', name: 'Programming Methodology II', mcs: 4, categoryId: 'cs-foundation', year: 1, sem: 2 },
    ]);
    const stats = computeStats(major, sems);
    expect(stats.totalMc).toBe(12);
    expect(stats.byCategory['cs-foundation']).toBe(8);
    expect(stats.byCategory['math-sciences']).toBe(4);
  });
});

describe('computeRequirements', () => {
  const source = {
    requirements: [
      { name: 'Programming Methodology', fulfilledBy: ['CS1101S'] },
      { name: 'Making Connections', fulfilledBy: ['NHS*', 'NST*'], count: 2 },
    ],
  };

  it('marks a single-count requirement fulfilled once its code is placed', () => {
    const sems = semesters([{ code: 'CS1101S', name: 'x', mcs: 4, categoryId: 'soc-common', year: 1, sem: 1 }]);
    const [prog] = computeRequirements(source, sems);
    expect(prog.fulfilled).toBe(true);
    expect(prog.have).toBe(1);
    expect(prog.need).toBe(1);
  });

  it('requires `count` distinct matches for a multi-count requirement', () => {
    const sems = semesters([{ code: 'NHS2001', name: 'x', mcs: 4, categoryId: 'nus-college', year: 1, sem: 1 }]);
    const [, mce] = computeRequirements(source, sems);
    expect(mce.have).toBe(1);
    expect(mce.fulfilled).toBe(false);
  });

  it('counts a manually mapped code only while it is actually placed', () => {
    const placed = semesters([{ code: 'CS2101', name: 'x', mcs: 4, categoryId: 'cs-foundation', year: 2, sem: 2 }]);
    const mappings = { 'Programming Methodology': ['CS2101'] };
    const [placedResult] = computeRequirements(source, placed, [], mappings);
    expect(placedResult.fulfilled).toBe(true);

    const empty = semesters([]);
    const [removedResult] = computeRequirements(source, empty, [], mappings);
    expect(removedResult.fulfilled).toBe(false);
  });
});

describe('computeDoubleCount', () => {
  const secondary: SecondaryProgramme = {
    id: 'statistics',
    label: 'Statistics',
    kind: 'minor',
    mcTarget: 20,
    requirements: [{ name: 'Probability', fulfilledBy: ['ST2334'] }],
    moduleCatalog: {},
  };

  it('stays under cap when double-counted MC is below mcTarget * 0.4', () => {
    const sems = semesters([{ code: 'ST2334', name: 'x', mcs: 4, categoryId: 'math-sciences', year: 2, sem: 1 }]);
    const result = computeDoubleCount(secondary, sems);
    expect(result.doubleCountMc).toBe(4);
    expect(result.capMc).toBe(8);
    expect(result.warn).toBe(false);
  });

  it('warns once double-counted MC exceeds the cap', () => {
    const sems = semesters([
      { code: 'ST2334', name: 'x', mcs: 4, categoryId: 'math-sciences', year: 2, sem: 1 },
      { code: 'ST2334B', name: 'y', mcs: 8, categoryId: 'math-sciences', year: 2, sem: 2 },
    ]);
    const wideSecondary: SecondaryProgramme = {
      ...secondary,
      requirements: [{ name: 'Probability', fulfilledBy: ['ST2334', 'ST2334B'] }],
    };
    const result = computeDoubleCount(wideSecondary, sems);
    expect(result.doubleCountMc).toBe(12);
    expect(result.warn).toBe(true);
  });
});

describe('computeTripleCountedCodes', () => {
  const secondA: SecondaryProgramme = {
    id: 'a', label: 'A', kind: 'second-major', mcTarget: 40,
    requirements: [{ name: 'Req A', fulfilledBy: ['MA2001'] }], moduleCatalog: {},
  };

  it('flags a code that satisfies two or more declared secondary programmes', () => {
    const secondB: SecondaryProgramme = {
      id: 'b', label: 'B', kind: 'minor', mcTarget: 20,
      requirements: [{ name: 'Req B', fulfilledBy: ['MA2001'] }], moduleCatalog: {},
    };
    const sems = semesters([{ code: 'MA2001', name: 'x', mcs: 4, categoryId: 'math-sciences', year: 2, sem: 1 }]);
    expect(computeTripleCountedCodes([secondA, secondB], sems)).toEqual(['MA2001']);
  });

  it('does not flag a code that only satisfies one secondary programme', () => {
    const secondB: SecondaryProgramme = {
      id: 'b', label: 'B', kind: 'minor', mcTarget: 20,
      requirements: [{ name: 'Req B', fulfilledBy: ['ST2334'] }], moduleCatalog: {},
    };
    const sems = semesters([{ code: 'MA2001', name: 'x', mcs: 4, categoryId: 'math-sciences', year: 2, sem: 1 }]);
    expect(computeTripleCountedCodes([secondA, secondB], sems)).toEqual([]);
  });
});

describe('computeFocusAreas', () => {
  const major: Major = {
    id: 'cs', label: 'CS', school: 'SoC', batches: [], totalMcTarget: 160,
    categories: [], requirements: [], moduleCatalog: {}, defaultPlan: [],
    focusAreas: [
      { id: 'ai', label: 'Artificial Intelligence', primaries: ['CS3243', 'CS3244', 'CS4246', 'CS4248'], minCourses: 3, minSeniorCourses: 1 },
    ],
  };

  it('is not fulfilled below the required primary count', () => {
    const sems = semesters([
      { code: 'CS3243', name: 'x', mcs: 4, categoryId: 'breadth-depth', year: 3, sem: 1 },
      { code: 'CS3244', name: 'x', mcs: 4, categoryId: 'breadth-depth', year: 3, sem: 2 },
    ]);
    const { areas, anyFulfilled } = computeFocusAreas(major, sems);
    expect(areas[0].matched.length).toBe(2);
    expect(anyFulfilled).toBe(false);
  });

  it('is fulfilled once enough primaries are matched, including one at level-4000+', () => {
    const sems = semesters([
      { code: 'CS3243', name: 'x', mcs: 4, categoryId: 'breadth-depth', year: 3, sem: 1 },
      { code: 'CS3244', name: 'x', mcs: 4, categoryId: 'breadth-depth', year: 3, sem: 2 },
      { code: 'CS4246', name: 'x', mcs: 4, categoryId: 'breadth-depth', year: 4, sem: 1 },
    ]);
    const { anyFulfilled } = computeFocusAreas(major, sems);
    expect(anyFulfilled).toBe(true);
  });
});

describe('computeBreadthDepth', () => {
  const major: Major = {
    id: 'cs', label: 'CS', school: 'SoC', batches: [], totalMcTarget: 160,
    categories: [], requirements: [], moduleCatalog: {}, defaultPlan: [],
    breadthDepth: {
      categoryId: 'breadth-depth',
      totalUnits: 32,
      minLevel4000Units: 12,
      industryExperience: { minUnits: 6, maxUnits: 12, courses: ['CP3880'] },
      allowedPrefixes: ['CS', 'IFS', 'CP'],
      maxCpUnits: 12,
      cpPrefix: 'CP',
    },
  };

  it('returns null when the major has no breadthDepth config', () => {
    expect(computeBreadthDepth({ ...major, breadthDepth: undefined }, [])).toBeNull();
  });

  it('flags a coding-restriction violation for a non-allowed prefix', () => {
    const sems = semesters([{ code: 'GEA1000N', name: 'x', mcs: 4, categoryId: 'breadth-depth', year: 3, sem: 1 }]);
    const result = computeBreadthDepth(major, sems);
    expect(result?.codingViolations).toEqual(['GEA1000N']);
  });

  it('flags the cp-cap constraint once CP-prefixed units exceed the max', () => {
    const sems = semesters([
      { code: 'CP3200', name: 'x', mcs: 8, categoryId: 'breadth-depth', year: 3, sem: 1 },
      { code: 'CP3202', name: 'y', mcs: 8, categoryId: 'breadth-depth', year: 3, sem: 2 },
    ]);
    const result = computeBreadthDepth(major, sems);
    const cpConstraint = result?.constraints.find((c) => c.id === 'cp-cap');
    expect(cpConstraint?.warn).toBe(true);
  });
});

describe('autoCategoryId', () => {
  const major: Major = {
    id: 'cs', label: 'CS', school: 'SoC', batches: [], totalMcTarget: 160,
    categories: [
      { id: 'cs-foundation', label: 'CS Foundation', color: '#fff' },
      { id: 'math-sciences', label: 'Math & Sciences', color: '#fff' },
      { id: 'unrestricted-electives', label: 'Unrestricted Electives', color: '#fff' },
    ],
    requirements: [],
    moduleCatalog: {},
    defaultPlan: [{ year: 1, sem: 1, moduleCode: 'CS1101S', categoryId: 'cs-foundation' }],
  };

  it('prefers the default-plan category for a fixed course', () => {
    expect(autoCategoryId(major, 'CS1101S')).toBe('cs-foundation');
  });

  it('falls back to math-sciences by prefix', () => {
    expect(autoCategoryId(major, 'MA1521')).toBe('math-sciences');
  });

  it('falls back to unrestricted electives for anything else', () => {
    expect(autoCategoryId(major, 'GET1234')).toBe('unrestricted-electives');
  });
});
```

- [ ] **Step 5: Run the suite**

Run: `npm run test`
Expected: all 15 tests pass (0 failures).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean, no output.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/studyPlan.test.ts
git commit -m "Add Vitest and a regression test suite for the counting logic"
```

---

### Task 2: Carry second-major/minor/requirement-mapping data through the share/review link codec

**Files:**
- Modify: `shared/share.ts`
- Create: `shared/share.test.ts`

**Interfaces:**
- Consumes: nothing new (existing `PlacedModule`, `Module` types from `./types`).
- Produces: `SharePlan.secondMajorId?: string | null`, `SharePlan.minorIds?: string[]`, `SharePlan.requirementMappings?: Record<string, string[]>` — Task 3 reads these off `SharePayload.plan` returned by `decodeCompactPlan`.

- [ ] **Step 1: Write the failing test**

Create `shared/share.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { encodeCompactPlan, decodeCompactPlan } from './share';

describe('encodeCompactPlan / decodeCompactPlan round trip', () => {
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

  it('round-trips a plan with no secondary programme declared', () => {
    const encoded = encodeCompactPlan(basePayload);
    const decoded = decodeCompactPlan(encoded);
    expect(decoded?.plan.secondMajorId ?? null).toBeNull();
    expect(decoded?.plan.minorIds ?? []).toEqual([]);
    expect(decoded?.plan.requirementMappings ?? {}).toEqual({});
  });

  it('round-trips a declared second major, minors, and requirement mappings', () => {
    const payload = {
      ...basePayload,
      plan: {
        ...basePayload.plan,
        secondMajorId: 'mathematics',
        minorIds: ['statistics', 'economics'],
        requirementMappings: { 'Programming Methodology': ['CS2101'] },
      },
    };
    const encoded = encodeCompactPlan(payload);
    const decoded = decodeCompactPlan(encoded);
    expect(decoded?.plan.secondMajorId).toBe('mathematics');
    expect(decoded?.plan.minorIds).toEqual(['statistics', 'economics']);
    expect(decoded?.plan.requirementMappings).toEqual({ 'Programming Methodology': ['CS2101'] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- share.test`
Expected: FAIL — TypeScript error, `secondMajorId` does not exist on the inferred payload type for `encodeCompactPlan`'s argument (the field doesn't exist on `SharePlan` yet).

- [ ] **Step 3: Extend the types and codec**

Modify `shared/share.ts` — extend `SharePlan`:

```ts
/** The current major's plan carried in a share link. */
export interface SharePlan {
  majorId: string;
  semesters: StudentSemester[];
  waivedModules: WaivedModule[];
  secondMajorId?: string | null;
  minorIds?: string[];
  requirementMappings?: Record<string, string[]>;
}
```

Extend `CompactSharePayload`:

```ts
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
}
```

Replace `compactPayload`:

```ts
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
  return compact;
};
```

Add a small type guard above `decodeCompactPlan`:

```ts
const isRequirementMappings = (value: unknown): value is Record<string, string[]> =>
  Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.values(value).every((codes) => Array.isArray(codes) && codes.every((c) => typeof c === 'string')),
  );
```

Replace the `plan` object returned by `decodeCompactPlan`:

```ts
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
      },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test`
Expected: all tests pass, including the 2 new ones in `shared/share.test.ts` and the 15 from Task 1.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean, no output.

- [ ] **Step 6: Commit**

```bash
git add shared/share.ts shared/share.test.ts
git commit -m "Carry second major, minors, and requirement mappings through share links"
```

---

### Task 3: Validate and apply the new share fields in `useStudyPlan`

**Files:**
- Modify: `src/hooks/useStudyPlan.ts:282-313` (`importSharedPlan`, `openReviewPlan`)

**Interfaces:**
- Consumes: `SharePlan.secondMajorId`/`minorIds`/`requirementMappings` from Task 2.
- Produces: `importSharedPlan` and `openReviewPlan` each gain 3 new optional trailing parameters — `importedSecondMajorId: string | null = null`, `importedMinorIds: string[] = []`, `importedRequirementMappings: Record<string, string[]> = {}`. Task 4's call sites pass these positionally.

- [ ] **Step 1: Update `importSharedPlan`**

In `src/hooks/useStudyPlan.ts`, replace the `importSharedPlan` callback:

```ts
  const importSharedPlan = useCallback(
    (
      newMajorId: string,
      importedSemesters: StudentSemester[],
      importedWaived: WaivedModule[],
      importedSecondMajorId: string | null = null,
      importedMinorIds: string[] = [],
      importedRequirementMappings: Record<string, string[]> = {},
    ) => {
      const newMajor = majors.find((m) => m.id === newMajorId);
      if (!newMajor) return false;
      setMode('personal');
      setSemesters(normalizeSemesters(newMajor, importedSemesters));
      setWaivedModules(normalizeWaivedModules(newMajor, importedWaived));
      setSecondMajorIdState(
        importedSecondMajorId && secondMajors.some((m) => m.id === importedSecondMajorId)
          ? importedSecondMajorId
          : null,
      );
      setMinorIds(importedMinorIds.filter((id) => minors.some((m) => m.id === id)).slice(0, MAX_MINORS));
      setRequirementMappings(normalizeRequirementMappings(importedRequirementMappings));
      setMajorId(newMajorId);
      setPersonalMajorId(newMajorId);
      return true;
    },
    [majors, secondMajors, minors],
  );
```

- [ ] **Step 2: Update `openReviewPlan`**

Replace the `openReviewPlan` callback:

```ts
  const openReviewPlan = useCallback(
    (
      newMajorId: string,
      importedSemesters: StudentSemester[],
      importedWaived: WaivedModule[],
      importedSecondMajorId: string | null = null,
      importedMinorIds: string[] = [],
      importedRequirementMappings: Record<string, string[]> = {},
    ) => {
      const newMajor = majors.find((m) => m.id === newMajorId);
      if (!newMajor) return false;
      setMode('review');
      setSemesters(normalizeSemesters(newMajor, importedSemesters));
      setWaivedModules(normalizeWaivedModules(newMajor, importedWaived));
      setSecondMajorIdState(
        importedSecondMajorId && secondMajors.some((m) => m.id === importedSecondMajorId)
          ? importedSecondMajorId
          : null,
      );
      setMinorIds(importedMinorIds.filter((id) => minors.some((m) => m.id === id)).slice(0, MAX_MINORS));
      setRequirementMappings(normalizeRequirementMappings(importedRequirementMappings));
      setMajorId(newMajorId);
      return true;
    },
    [majors, secondMajors, minors],
  );
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: FAIL at this point — `src/App.tsx` still calls `importSharedPlan`/`openReviewPlan` with only 3 arguments, which is fine (the 3 new params are optional with defaults), so this should actually pass. Confirm output is clean; if TypeScript complains about anything else, stop and re-read the diff before continuing.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useStudyPlan.ts
git commit -m "Accept second major, minors, and requirement mappings on plan import"
```

---

### Task 4: Pass the new fields through the share-link builder and import call sites

**Files:**
- Modify: `src/components/StudyPlan.tsx:98-102` (`copyShareLink`)
- Modify: `src/App.tsx:37-62` (`confirmImport`, `openReviewImport`)

**Interfaces:**
- Consumes: `importSharedPlan`/`openReviewPlan`'s new optional params from Task 3; `StudyPlan`'s existing `secondMajorId`, `minorIds`, `requirementMappings` props (already declared in its `Props` interface, already destructured in the component).

- [ ] **Step 1: Include the new fields when building a share link**

In `src/components/StudyPlan.tsx`, replace `copyShareLink`:

```ts
  const copyShareLink = async (name: string) => {
    const link = buildShareLink({
      profile: { name, matricNumber, year: studentYear },
      plan: { majorId, semesters, waivedModules, secondMajorId, minorIds, requirementMappings },
    }, major.moduleCatalog);
    try {
      await navigator.clipboard.writeText(link);
      setShareState('copied');
      window.setTimeout(() => setShareState('idle'), 2000);
    } catch {
      // Clipboard can be blocked (e.g. insecure context); surface the link so it's still usable.
      setShareDialogLink(link);
      setShareState('error');
    }
  };
```

- [ ] **Step 2: Pass the new fields on import**

In `src/App.tsx`, replace `confirmImport`:

```ts
  const confirmImport = () => {
    if (!pendingImport) return;
    const ok = plan.importSharedPlan(
      pendingImport.plan.majorId,
      pendingImport.plan.semesters,
      pendingImport.plan.waivedModules,
      pendingImport.plan.secondMajorId ?? null,
      pendingImport.plan.minorIds ?? [],
      pendingImport.plan.requirementMappings ?? {},
    );
    if (ok) {
      importProfile(pendingImport.profile);
      setReviewProfile(null);
    }
    setPendingImport(null);
  };
```

Replace `openReviewImport`:

```ts
  const openReviewImport = () => {
    if (!pendingImport) return;
    const ok = plan.openReviewPlan(
      pendingImport.plan.majorId,
      pendingImport.plan.semesters,
      pendingImport.plan.waivedModules,
      pendingImport.plan.secondMajorId ?? null,
      pendingImport.plan.minorIds ?? [],
      pendingImport.plan.requirementMappings ?? {},
    );
    if (ok) {
      setReviewProfile(pendingImport.profile);
      setPendingImport(null);
    }
  };
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean, no output.

- [ ] **Step 4: Verify in the running app**

Run: `npm run dev`, open http://localhost:5173.
1. In Settings, declare a second major and a minor, place a module and link it to a requirement via the ⊕ picker in the requirement row.
2. Click "Share" in the header, confirm "Link copied".
3. Open the copied link in a new incognito/private window (or a second browser profile so it doesn't clobber your own `localStorage` plan).
4. In the import dialog, choose "Review" (not "Import") — confirms the review path also now carries the data.
5. Confirm the "Second Major & Minor Progress" panel appears in review mode with the same programmes, and the requirement mapping chip you added is present.
6. No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/StudyPlan.tsx src/App.tsx
git commit -m "Thread second major, minors, and requirement mappings through share/review links"
```

---

### Task 5: Remove orphaned `RequirementsChecklist` and its stale todo doc

**Files:**
- Delete: `src/components/RequirementsChecklist.tsx`
- Delete: `docs/todos/expandable-category-cards.md`

**Interfaces:**
- Consumes: nothing (verified unused — grep for `RequirementsChecklist` outside this file and `docs/` returns no matches; `StatsSummary.tsx`'s `CategoryPanel`/`RequirementRow` already covers everything this component and the todo doc describe, plus manual requirement mapping which the todo doc doesn't even mention).
- Produces: nothing new.

- [ ] **Step 1: Confirm nothing imports the component**

Run: `grep -rn "RequirementsChecklist" src admin` (or the Grep tool if working interactively)
Expected: no matches (the only references left are inside the file itself and inside `docs/`, which this task also removes).

- [ ] **Step 2: Delete both files**

```bash
git rm src/components/RequirementsChecklist.tsx docs/todos/expandable-category-cards.md
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean, no output.

- [ ] **Step 4: Commit**

```bash
git commit -m "Remove RequirementsChecklist (superseded by StatsSummary's category panel) and its stale todo"
```

---

### Task 6: Validate `shared/data/second-majors/` and `shared/data/minors/` JSON

**Files:**
- Create: `scripts/validate-secondary.mjs`
- Modify: `package.json` (add `validate:majors`, `validate:secondary`, `validate` scripts)
- Modify (conditionally): any file under `shared/data/second-majors/` or `shared/data/minors/` that the new script flags as invalid

**Interfaces:**
- Consumes: nothing (reads JSON files directly from disk, same pattern as `scripts/validate-majors.mjs`).
- Produces: nothing new consumed by app code — this is a standalone dev-time check, same as the existing majors validator (which also isn't wired into `build`).

- [ ] **Step 1: Write the validation script**

Create `scripts/validate-secondary.mjs`:

```js
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const DIRS = [
  { name: 'second-majors', path: join(here, '..', 'shared', 'data', 'second-majors'), kind: 'second-major' },
  { name: 'minors', path: join(here, '..', 'shared', 'data', 'minors'), kind: 'minor' },
];

const errors = [];

for (const dir of DIRS) {
  const seenIds = new Set();

  for (const file of readdirSync(dir.path).filter((f) => f.endsWith('.json'))) {
    let programme;
    try {
      programme = JSON.parse(readFileSync(join(dir.path, file), 'utf8'));
    } catch (err) {
      console.error(`FAIL ${dir.name}/${file}: invalid JSON (${err.message})`);
      errors.push(`FAIL ${dir.name}/${file}: invalid JSON (${err.message})`);
      continue;
    }

    const idKey = `${dir.name}/${programme.id ?? file}`;
    const fail = (msg) => errors.push(`FAIL ${idKey}: ${msg}`);

    if (!programme.id) fail('missing id');
    if (!programme.label) fail('missing label');
    if (programme.kind !== dir.kind) {
      fail(`expected kind "${dir.kind}" for a file under ${dir.name}/, got "${programme.kind}"`);
    }
    if (typeof programme.mcTarget !== 'number' || programme.mcTarget <= 0) {
      fail('missing or invalid mcTarget');
    }
    if (seenIds.has(programme.id)) fail(`duplicate id "${programme.id}" within ${dir.name}/`);
    seenIds.add(programme.id);

    for (const req of programme.requirements ?? []) {
      for (const f of req.fulfilledBy ?? []) {
        if (!f.endsWith('*') && programme.moduleCatalog && !programme.moduleCatalog[f]) {
          fail(`requirement "${req.name}" fulfilledBy "${f}" not in moduleCatalog`);
        }
      }
    }

    for (const [code, mod] of Object.entries(programme.moduleCatalog ?? {})) {
      if (mod.code !== code) fail(`catalog key "${code}" !== module.code "${mod.code}"`);
    }

    if (errors.every((e) => !e.startsWith(`FAIL ${idKey}:`))) {
      console.log(`OK ${idKey} (${(programme.requirements ?? []).length} requirements, ${programme.mcTarget} MC)`);
    }
  }
}

if (errors.length) {
  for (const e of errors) console.error(e);
  process.exit(1);
}
console.log('All second majors and minors valid.');
```

- [ ] **Step 2: Add npm scripts**

Modify `package.json`'s `"scripts"` block, adding:

```json
    "validate:majors": "node scripts/validate-majors.mjs",
    "validate:secondary": "node scripts/validate-secondary.mjs",
    "validate": "npm run validate:majors && npm run validate:secondary"
```

- [ ] **Step 3: Run it against the real data**

Run: `npm run validate`
Expected: either `All second majors and minors valid.` (proceed to Step 5), or one or more `FAIL <dir>/<id>: <reason>` lines.

- [ ] **Step 4: Fix any real failures found**

If Step 3 printed `FAIL` lines, open each referenced file under `shared/data/second-majors/` or `shared/data/minors/` and resolve per the message — e.g. a `fulfilledBy "XYZ" not in moduleCatalog` means either add `"XYZ": { "code": "XYZ", "name": "...", "mcs": ... }` to that file's `moduleCatalog`, or fix a typo'd code. Re-run `npm run validate` until it prints `All second majors and minors valid.` for both directories.

- [ ] **Step 5: Commit**

```bash
git add scripts/validate-secondary.mjs package.json
# If Step 4 fixed real data errors, add those files too:
# git add shared/data/second-majors/<fixed-file>.json shared/data/minors/<fixed-file>.json
git commit -m "Validate second-major and minor JSON data (id, kind, mcTarget, catalog consistency)"
```

---

### Task 7: Generalize the admin `ExportPanel` to any `{id}`-shaped record

**Files:**
- Modify: `admin/src/components/ExportPanel.tsx`
- Modify: `admin/src/components/MajorBuilder.tsx:116` (call site)

**Interfaces:**
- Consumes: nothing new.
- Produces: `ExportPanel<T extends { id: string }>({ data: T; directory: 'majors' | 'second-majors' | 'minors' })` — Task 8's `SecondaryProgrammeBuilder` renders `<ExportPanel data={programme} directory={...} />`.

- [ ] **Step 1: Rewrite `ExportPanel.tsx`**

Replace the full contents of `admin/src/components/ExportPanel.tsx`:

```tsx
interface Props<T extends { id: string }> {
  data: T;
  directory: 'majors' | 'second-majors' | 'minors';
}

export const ExportPanel = <T extends { id: string },>({ data, directory }: Props<T>) => {
  const json = JSON.stringify(data, null, 2);

  const handleSave = async () => {
    if (!('showSaveFilePicker' in window)) {
      fallbackDownload(data.id, json);
      return;
    }

    try {
      const fileHandle = await (window as Window & typeof globalThis & {
        showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle>;
      }).showSaveFilePicker({
        suggestedName: `${data.id}.json`,
        types: [{ description: 'JSON file', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await fileHandle.createWritable();
      await writable.write(json);
      await writable.close();
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        fallbackDownload(data.id, json);
      }
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(json).catch(() => undefined);
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-ink">Export JSON</h3>
      <p className="text-xs text-muted leading-relaxed">
        Save the JSON file to <code className="font-mono bg-paper px-1 rounded">shared/data/{directory}/{data.id}.json</code> for the student app to pick it up.
      </p>
      <pre className="rounded-xl bg-paper p-3 text-[10px] font-mono text-ink/70 overflow-auto max-h-48">
        {json}
      </pre>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="flex-1 rounded-xl bg-ink text-canvas px-4 py-2 text-sm font-medium hover:bg-ink/80 transition-colors"
        >
          Save file…
        </button>
        <button
          onClick={handleCopy}
          className="rounded-xl bg-paper border border-ink/20 text-ink px-4 py-2 text-sm hover:bg-canvas transition-colors"
        >
          Copy JSON
        </button>
      </div>
    </div>
  );
};

const fallbackDownload = (id: string, json: string) => {
  const a = document.createElement('a');
  a.href = `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
  a.download = `${id}.json`;
  a.click();
};
```

- [ ] **Step 2: Update the `MajorBuilder` call site**

In `admin/src/components/MajorBuilder.tsx`, replace:

```tsx
        {tab === 'export' && <ExportPanel major={major} />}
```

with:

```tsx
        {tab === 'export' && <ExportPanel data={major} directory="majors" />}
```

- [ ] **Step 3: Typecheck the admin project**

Run: `cd admin && npx tsc --noEmit`
Expected: clean, no output.

- [ ] **Step 4: Commit**

```bash
git add admin/src/components/ExportPanel.tsx admin/src/components/MajorBuilder.tsx
git commit -m "Generalize admin ExportPanel to any {id}-shaped record"
```

---

### Task 8: Build the `SecondaryProgrammeBuilder` admin component

**Files:**
- Create: `admin/src/components/SecondaryProgrammeBuilder.tsx`

**Interfaces:**
- Consumes: `SecondaryProgramme`, `Module`, `RequirementRule` from `@shared/types`; `ModuleSearch` from `./ModuleSearch` (existing, reused as-is); `ExportPanel` from `./ExportPanel` (Task 7's generalized version).
- Produces: `SecondaryProgrammeBuilder({ programme: SecondaryProgramme; onChange: (programme: SecondaryProgramme) => void })` — Task 9's `admin/src/App.tsx` renders this for the "Second Majors" and "Minors" tabs.

- [ ] **Step 1: Create the component**

Create `admin/src/components/SecondaryProgrammeBuilder.tsx`:

```tsx
import { useState } from 'react';
import type { Module, RequirementRule, SecondaryProgramme } from '@shared/types';
import { ModuleSearch } from './ModuleSearch';
import { ExportPanel } from './ExportPanel';

interface Props {
  programme: SecondaryProgramme;
  onChange: (programme: SecondaryProgramme) => void;
}

type Tab = 'info' | 'requirements' | 'catalog' | 'export';

export const SecondaryProgrammeBuilder = ({ programme, onChange }: Props) => {
  const [tab, setTab] = useState<Tab>('info');

  const update = (patch: Partial<SecondaryProgramme>) => onChange({ ...programme, ...patch });

  const tabs: { id: Tab; label: string }[] = [
    { id: 'info', label: 'Info' },
    { id: 'requirements', label: 'Requirements' },
    { id: 'catalog', label: 'Module Catalog' },
    { id: 'export', label: 'Export' },
  ];

  const field =
    'rounded-xl border border-ink/20 bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/20 w-full';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-1 rounded-2xl bg-paper p-1 self-start">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="rounded-xl px-4 py-1.5 text-sm font-medium transition-colors"
            style={{
              backgroundColor: tab === t.id ? 'rgb(20,20,19)' : 'transparent',
              color: tab === t.id ? 'rgb(239,238,231)' : 'rgb(108,107,104)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-paper p-5">
        {tab === 'info' && (
          <div className="flex flex-col gap-4 max-w-md">
            <h3 className="text-sm font-semibold text-ink">Programme Info</h3>
            <LabeledField label="Label">
              <input value={programme.label} onChange={(e) => update({ label: e.target.value })} className={field} />
            </LabeledField>
            <LabeledField label="Kind">
              <select
                value={programme.kind}
                onChange={(e) => update({ kind: e.target.value as SecondaryProgramme['kind'] })}
                className={field}
              >
                <option value="second-major">Second Major</option>
                <option value="minor">Minor</option>
              </select>
            </LabeledField>
            <LabeledField label="MC Target">
              <input
                type="number"
                value={programme.mcTarget}
                onChange={(e) => update({ mcTarget: parseInt(e.target.value, 10) || 0 })}
                className={field}
              />
            </LabeledField>
          </div>
        )}

        {tab === 'requirements' && (
          <RequirementsEditor
            requirements={programme.requirements}
            onChange={(requirements) => update({ requirements })}
          />
        )}

        {tab === 'catalog' && (
          <CatalogEditor
            catalog={programme.moduleCatalog}
            onChange={(moduleCatalog) => update({ moduleCatalog })}
          />
        )}

        {tab === 'export' && (
          <ExportPanel
            data={programme}
            directory={programme.kind === 'second-major' ? 'second-majors' : 'minors'}
          />
        )}
      </div>
    </div>
  );
};

const LabeledField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs text-muted uppercase tracking-wide">{label}</label>
    {children}
  </div>
);

const RequirementsEditor = ({
  requirements,
  onChange,
}: {
  requirements: RequirementRule[];
  onChange: (r: RequirementRule[]) => void;
}) => {
  const [newName, setNewName] = useState('');
  const [newCodes, setNewCodes] = useState('');
  const [newCount, setNewCount] = useState('1');

  const addReq = () => {
    const name = newName.trim();
    if (!name) return;
    const fulfilledBy = newCodes
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    const count = parseInt(newCount, 10) || 1;
    onChange([...requirements, { name, fulfilledBy, count }]);
    setNewName('');
    setNewCodes('');
    setNewCount('1');
  };

  const removeReq = (idx: number) => onChange(requirements.filter((_, i) => i !== idx));

  const field =
    'rounded-xl border border-ink/20 bg-canvas px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/20 w-full';

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-ink">Requirements</h3>

      <div className="flex flex-col gap-2">
        {requirements.map((req, idx) => (
          <div key={idx} className="flex items-center gap-3 rounded-xl bg-canvas p-3">
            <div className="flex-1">
              <div className="text-sm text-ink">
                {req.name}
                {(req.count ?? 1) > 1 && <span className="ml-2 text-xs text-muted">needs {req.count}</span>}
              </div>
              <div className="text-xs text-muted font-mono mt-0.5">{req.fulfilledBy.join(', ')}</div>
            </div>
            <button onClick={() => removeReq(idx)} className="text-muted hover:text-ink text-lg leading-none">×</button>
          </div>
        ))}
        {requirements.length === 0 && <p className="text-xs text-muted italic">No requirements yet.</p>}
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-ink/10 p-3">
        <p className="text-xs text-muted font-medium">Add requirement</p>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Requirement name…" className={field} />
        <input
          value={newCodes}
          onChange={(e) => setNewCodes(e.target.value)}
          placeholder="Module codes (comma-separated, e.g. ST1131, ST32*)"
          className={field}
        />
        <LabeledField label="Distinct modules needed">
          <input type="number" min={1} value={newCount} onChange={(e) => setNewCount(e.target.value)} className={field} />
        </LabeledField>
        <button
          onClick={addReq}
          disabled={!newName.trim()}
          className="self-start rounded-xl bg-ink text-canvas px-4 py-2 text-sm font-medium hover:bg-ink/80 transition-colors disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );
};

const CatalogEditor = ({
  catalog,
  onChange,
}: {
  catalog: Record<string, Module>;
  onChange: (catalog: Record<string, Module>) => void;
}) => {
  const handleAdd = (module: Module) => {
    if (catalog[module.code]) return;
    onChange({ ...catalog, [module.code]: module });
  };

  const handleRemove = (code: string) => {
    const next = { ...catalog };
    delete next[code];
    onChange(next);
  };

  const modules = Object.values(catalog).sort((a, b) => a.code.localeCompare(b.code));

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <h3 className="text-sm font-semibold text-ink">Module Catalog</h3>
      <ModuleSearch onSelect={handleAdd} placeholder="Add module…" />
      <div className="flex flex-col gap-1.5">
        {modules.map((m) => (
          <div key={m.code} className="flex items-center gap-3 rounded-xl bg-canvas p-3">
            <div className="flex-1">
              <span className="font-mono text-xs font-bold text-ink">{m.code}</span>
              <span className="ml-2 text-xs text-muted">{m.name}</span>
            </div>
            <span className="text-xs text-muted">{m.mcs} MC</span>
            <button onClick={() => handleRemove(m.code)} className="text-muted hover:text-ink text-lg leading-none">×</button>
          </div>
        ))}
        {modules.length === 0 && <p className="text-xs text-muted italic">No modules in catalog yet.</p>}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Typecheck the admin project**

Run: `cd admin && npx tsc --noEmit`
Expected: clean, no output. (This component isn't imported anywhere yet — Task 9 wires it in — so this step only confirms the file itself compiles.)

- [ ] **Step 3: Commit**

```bash
git add admin/src/components/SecondaryProgrammeBuilder.tsx
git commit -m "Add SecondaryProgrammeBuilder admin component for second-major/minor data"
```

---

### Task 9: Wire `SecondaryProgrammeBuilder` into the admin app

**Files:**
- Modify: `admin/src/App.tsx`

**Interfaces:**
- Consumes: `SecondaryProgrammeBuilder` from Task 8; `loadSecondMajors`/`loadMinors`-equivalent glob loaders (new, mirroring `useStudyPlan.ts`'s pattern of `import.meta.glob('../../shared/data/second-majors/*.json', { eager: true })`).

- [ ] **Step 1: Rewrite `admin/src/App.tsx`**

Replace the full contents of `admin/src/App.tsx`:

```tsx
import { useState } from 'react';
import type { Major, SecondaryProgramme } from '@shared/types';
import { MajorBuilder } from './components/MajorBuilder';
import { SecondaryProgrammeBuilder } from './components/SecondaryProgrammeBuilder';

const majorModules = import.meta.glob('../../shared/data/majors/*.json', { eager: true });
const secondMajorModules = import.meta.glob('../../shared/data/second-majors/*.json', { eager: true });
const minorModules = import.meta.glob('../../shared/data/minors/*.json', { eager: true });

const loadMajors = (): Major[] =>
  Object.values(majorModules).map((m) => (m as { default: Major }).default);

const loadSecondMajors = (): SecondaryProgramme[] =>
  Object.values(secondMajorModules).map((m) => (m as { default: SecondaryProgramme }).default);

const loadMinors = (): SecondaryProgramme[] =>
  Object.values(minorModules).map((m) => (m as { default: SecondaryProgramme }).default);

const newMajor = (): Major => ({
  id: `major-${Date.now()}`,
  label: 'New Major',
  school: '',
  batches: ['AY2026/2027'],
  totalMcTarget: 160,
  categories: [
    { id: 'primary-major', label: 'Primary Major', mcTarget: 80, color: '#d4c9b8' },
    { id: 'unrestricted-electives', label: 'Unrestricted Electives', color: '#c3bace' },
  ],
  requirements: [],
  moduleCatalog: {},
  defaultPlan: [],
});

const newSecondaryProgramme = (kind: SecondaryProgramme['kind']): SecondaryProgramme => ({
  id: `${kind}-${Date.now()}`,
  label: kind === 'second-major' ? 'New Second Major' : 'New Minor',
  kind,
  mcTarget: kind === 'second-major' ? 40 : 20,
  requirements: [],
  moduleCatalog: {},
});

type Kind = 'major' | 'second-major' | 'minor';

const App = () => {
  const [majors, setMajors] = useState<Major[]>(loadMajors);
  const [secondMajors, setSecondMajors] = useState<SecondaryProgramme[]>(loadSecondMajors);
  const [minors, setMinors] = useState<SecondaryProgramme[]>(loadMinors);
  const [kind, setKind] = useState<Kind>('major');
  const [selectedId, setSelectedId] = useState<string | null>(majors[0]?.id ?? null);

  const secondaryList = kind === 'second-major' ? secondMajors : minors;
  const sidebarItems: { id: string; label: string; specialisation?: string }[] =
    kind === 'major' ? majors : secondaryList;

  const handleCreate = () => {
    if (kind === 'major') {
      const m = newMajor();
      setMajors((prev) => [...prev, m]);
      setSelectedId(m.id);
      return;
    }
    const p = newSecondaryProgramme(kind);
    if (kind === 'second-major') setSecondMajors((prev) => [...prev, p]);
    else setMinors((prev) => [...prev, p]);
    setSelectedId(p.id);
  };

  const handleSwitchKind = (next: Kind) => {
    setKind(next);
    const list = next === 'major' ? majors : next === 'second-major' ? secondMajors : minors;
    setSelectedId(list[0]?.id ?? null);
  };

  const handleChangeMajor = (updated: Major) => {
    setMajors((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
  };

  const handleChangeSecondary = (updated: SecondaryProgramme) => {
    if (updated.kind === 'second-major') {
      setSecondMajors((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } else {
      setMinors((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    }
  };

  const selectedMajor = kind === 'major' ? majors.find((m) => m.id === selectedId) ?? null : null;
  const selectedSecondary = kind !== 'major' ? secondaryList.find((p) => p.id === selectedId) ?? null : null;

  const kindTabs: { id: Kind; label: string }[] = [
    { id: 'major', label: 'Majors' },
    { id: 'second-major', label: 'Second Majors' },
    { id: 'minor', label: 'Minors' },
  ];
  const createLabel = kind === 'major' ? 'Major' : kind === 'second-major' ? 'Second Major' : 'Minor';

  return (
    <div className="min-h-screen bg-canvas">
      <header className="px-6 py-4" style={{ borderBottom: '1px solid rgba(20,20,19,0.08)' }}>
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <h1 className="text-base font-semibold text-ink">SOC Study Planner — Admin</h1>
          <button
            onClick={handleCreate}
            className="rounded-xl bg-ink text-canvas px-4 py-2 text-sm font-medium hover:bg-ink/80 transition-colors"
          >
            + New {createLabel}
          </button>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-6 py-6 flex gap-6">
        <aside className="w-52 flex-shrink-0 flex flex-col gap-4">
          <div className="flex flex-col gap-1 rounded-2xl bg-paper p-1">
            {kindTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSwitchKind(t.id)}
                className="rounded-xl px-3 py-1.5 text-left text-sm font-medium transition-colors"
                style={{
                  backgroundColor: kind === t.id ? 'rgb(20,20,19)' : 'transparent',
                  color: kind === t.id ? 'rgb(239,238,231)' : 'rgb(108,107,104)',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[10px] uppercase tracking-wide text-muted px-1">
              {kindTabs.find((t) => t.id === kind)?.label}
            </p>
            {sidebarItems.length === 0 && (
              <p className="text-xs text-muted italic px-1">None yet. Create one.</p>
            )}
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className="text-left rounded-2xl px-4 py-3 text-sm transition-colors"
                style={{
                  backgroundColor: selectedId === item.id ? 'rgb(20,20,19)' : 'rgb(225,218,205)',
                  color: selectedId === item.id ? 'rgb(239,238,231)' : 'rgb(20,20,19)',
                }}
              >
                <div className="font-medium">{item.label}</div>
                {item.specialisation && (
                  <div
                    className="text-[10px] mt-0.5 truncate"
                    style={{ color: selectedId === item.id ? 'rgba(239,238,231,0.6)' : 'rgb(108,107,104)' }}
                  >
                    {item.specialisation}
                  </div>
                )}
              </button>
            ))}
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          {kind === 'major' && selectedMajor && (
            <MajorBuilder major={selectedMajor} onChange={handleChangeMajor} />
          )}
          {kind !== 'major' && selectedSecondary && (
            <SecondaryProgrammeBuilder programme={selectedSecondary} onChange={handleChangeSecondary} />
          )}
          {!selectedMajor && !selectedSecondary && (
            <div className="flex items-center justify-center h-64 text-muted text-sm">
              Select or create an entry to get started.
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
```

- [ ] **Step 2: Typecheck the admin project**

Run: `cd admin && npx tsc --noEmit`
Expected: clean, no output.

- [ ] **Step 3: Verify in preview**

Run: `cd admin && npm run dev`, open the printed local URL (typically http://localhost:5173, may bump if the student app's dev server is also running).
1. Confirm "Majors" tab shows the existing 5 majors, unchanged.
2. Click "Second Majors" — confirm 7 entries load (data-analytics, economics, management, mathematics, psychology, public-health, statistics).
3. Click "Minors" — confirm 8 entries load.
4. Select a minor (e.g. Statistics), confirm its Info/Requirements/Module Catalog/Export tabs all show its real data.
5. Click "+ New Minor" — confirm a new blank minor appears and is selected; edit its label and confirm it updates in the sidebar.
6. On the Export tab, confirm the path message reads `shared/data/minors/<id>.json` (or `second-majors/` when on that tab).
7. No console errors.

- [ ] **Step 4: Commit**

```bash
git add admin/src/App.tsx
git commit -m "Add Second Majors and Minors tabs to the admin app"
```
