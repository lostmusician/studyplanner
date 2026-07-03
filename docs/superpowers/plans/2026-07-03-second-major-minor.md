# Second Major & Minors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a student declare one second major and up to three minors alongside their primary major, and see live auto-computed requirement checklists plus an informational double-counting/triple-counting warning for each.

**Scope note:** the spec names 16 programmes in total (7 second majors + 9 minors), but only 3 have module-level detail confirmed against official curriculum pages (Second Major Mathematics, Minor Mathematics, Second Major Statistics — see spec's "Confirmed module-level detail" section). This plan builds the full, generic architecture (works for any number of registered programmes, zero code changes to add more, exactly like the existing major registry) plus those 3 real data files as working proof. The remaining 13 programmes (second majors in Data Analytics/Economics/Psychology/Management/Public Health; minors in Statistics/Data Analytics/Economics/Psychology/Management/Public Health/Quantitative Finance/Entrepreneurship) are **not** authored here — inventing their module lists without research would put wrong NUS curriculum data in front of a student. Authoring each is a repeat of Tasks 3-5's recipe (one JSON file, following the `SecondaryProgramme` schema, sourced from that department's official curriculum page) and belongs in a follow-up plan once that research is done.

**Architecture:** A new lean `SecondaryProgramme` data type (JSON files, glob-loaded exactly like existing `Major` files) is checked against the *same* shared `semesters`/`waivedModules` plan the primary major already uses, reusing `computeRequirements` unchanged. A new `computeDoubleCount`/`computeTripleCountedCodes` pair in `src/lib/studyPlan.ts` flags overlap against NUS's 40%-of-programme-MC cap, surfaced as a non-blocking warning chip.

**Tech Stack:** React 19 + TypeScript 5.8 + Vite 6, Tailwind CSS. No test framework exists in this repo (`package.json` scripts are only `dev`/`build`/`preview`; `build` = `tsc --noEmit && vite build`).

## Global Constraints

- Max 1 declared second major, max 3 declared minors (spec: "Programmes in scope").
- Double-counting cap is informational only — a `warn` flag on a chip, never blocks declaring a programme or marking a requirement fulfilled.
- Secondary programmes have **no** `defaultPlan` and **no** `categories`/per-category MC bar — completion is shown purely via requirement-checklist rows. Students manually place modules into their existing semester grid.
- The double-count cap is derived as `secondary.mcTarget * 0.4`, never hard-coded as `16`/`8`.
- No automated tests exist in this repo. Every task's verification step is `npm run build` (must exit 0) plus, for UI tasks, a manual browser check described in the step.
- Full spec: `docs/superpowers/specs/2026-07-03-second-major-minor-design.md`.

---

### Task 1: `SecondaryProgramme` type + extend `StudentPlan`

**Files:**
- Modify: `shared/types.ts:96` (insert new interface after `Major`), `shared/types.ts:104-109` (extend `StudentPlan`)

**Interfaces:**
- Produces: `SecondaryProgramme` (fields `id`, `label`, `kind: 'second-major' | 'minor'`, `mcTarget`, `requirements: RequirementRule[]`, `moduleCatalog: Record<string, Module>`), used by every later task. `StudentPlan.secondMajorId?: string` and `StudentPlan.minorIds?: string[]`, used by Task 6.

- [ ] **Step 1: Add the `SecondaryProgramme` interface**

In `shared/types.ts`, insert immediately after the closing brace of the `Major` interface (currently ends at line 96, right before `export interface StudentSemester {`):

```ts
/** A second major or minor a student can additionally declare alongside their
 * primary major. Deliberately lean compared to `Major`: no `school`,
 * `batches`, `defaultPlan`, `categories`, or `breadthDepth` — a secondary
 * programme never owns semester placement or a per-category MC bar, it is
 * only ever checked against whichever modules the student has already
 * placed for their primary major. */
export interface SecondaryProgramme {
  id: string;
  label: string;
  kind: 'second-major' | 'minor';
  /** 40 MC for a second major, 20 MC for a minor at NUS's standard sizes.
   * Also drives the double-counting cap: `mcTarget * 0.4`. */
  mcTarget: number;
  requirements: RequirementRule[];
  moduleCatalog: Record<string, Module>;
}
```

- [ ] **Step 2: Extend `StudentPlan`**

In `shared/types.ts:104-109`, replace:

```ts
export interface StudentPlan {
  majorId: string;
  semesters: StudentSemester[];
  waivedModules?: WaivedModule[];
  lastUpdated: string;
}
```

with:

```ts
export interface StudentPlan {
  majorId: string;
  /** At most 1 declared second major. */
  secondMajorId?: string;
  /** At most 3 declared minors. */
  minorIds?: string[];
  semesters: StudentSemester[];
  waivedModules?: WaivedModule[];
  lastUpdated: string;
}
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: exits 0, no TypeScript errors (nothing consumes the new fields yet, so this only checks the type additions themselves are valid).

- [ ] **Step 4: Commit**

```bash
git add shared/types.ts
git commit -m "Add SecondaryProgramme type and extend StudentPlan for second major/minors"
```

---

### Task 2: Requirement/double-count/triple-count compute logic

**Files:**
- Modify: `src/lib/studyPlan.ts:72-73` (add helper after `matchesFulfiller`), `src/lib/studyPlan.ts:127-148` (loosen `computeRequirements` parameter type), and add two new exported functions after `computeRequirements` (currently ends line 148, before `courseLevel` at line 150)

**Interfaces:**
- Consumes: `SecondaryProgramme` (Task 1), `RequirementRule`, `PlacedModule`, `WaivedModule`, `StudentSemester` (existing `shared/types.ts`)
- Produces: `computeRequirements(source: Pick<Major, 'requirements'>, semesters, waivedModules)` (same behavior as before, now also accepts a `SecondaryProgramme`), `DoubleCountStatus` interface, `computeDoubleCount(secondary, semesters, waivedModules)`, `computeTripleCountedCodes(secondaries, semesters, waivedModules)` — all used by Task 9/10.

- [ ] **Step 1: Add a shared "matches any requirement" helper**

In `src/lib/studyPlan.ts`, right after `matchesFulfiller` (line 72-73), add:

```ts
const matchesAnyRequirement = (requirements: RequirementRule[], code: string): boolean =>
  requirements.some((req) => req.fulfilledBy.some((fulfiller) => matchesFulfiller(code, fulfiller)));
```

- [ ] **Step 2: Loosen `computeRequirements`'s parameter type**

Replace the existing `computeRequirements` (lines 127-148):

```ts
export const computeRequirements = (
  major: Major,
  semesters: StudentSemester[],
  waivedModules: WaivedModule[] = [],
): RequirementStatus[] => {
  const plannedCodes = semesters.flatMap((s) => s.modules.map((m) => m.code));
  const waivedCodes = waivedModules.map((m) => m.code);
  const allCodes = Array.from(new Set([...plannedCodes, ...waivedCodes]));
  return major.requirements.map((req) => {
    const matchCount = allCodes.filter((code) =>
      req.fulfilledBy.some((fulfiller) => matchesFulfiller(code, fulfiller)),
    ).length;
    const need = req.count ?? 1;
    return {
      name: req.name,
      fulfilled: matchCount >= need,
      categoryId: req.categoryId,
      have: matchCount,
      need,
    };
  });
};
```

with (only the parameter name/type change — body is identical, using `source.requirements` in place of `major.requirements`):

```ts
export const computeRequirements = (
  source: Pick<Major, 'requirements'>,
  semesters: StudentSemester[],
  waivedModules: WaivedModule[] = [],
): RequirementStatus[] => {
  const plannedCodes = semesters.flatMap((s) => s.modules.map((m) => m.code));
  const waivedCodes = waivedModules.map((m) => m.code);
  const allCodes = Array.from(new Set([...plannedCodes, ...waivedCodes]));
  return source.requirements.map((req) => {
    const matchCount = allCodes.filter((code) =>
      req.fulfilledBy.some((fulfiller) => matchesFulfiller(code, fulfiller)),
    ).length;
    const need = req.count ?? 1;
    return {
      name: req.name,
      fulfilled: matchCount >= need,
      categoryId: req.categoryId,
      have: matchCount,
      need,
    };
  });
};
```

`SecondaryProgramme` has a `requirements: RequirementRule[]` field, so it structurally satisfies `Pick<Major, 'requirements'>` — every existing call site (`computeRequirements(major, semesters, waivedModules)` in `src/hooks/useStudyPlan.ts:235`) keeps working unchanged, since a full `Major` also satisfies that type.

- [ ] **Step 3: Add `computeDoubleCount`**

Add this after `computeRequirements` (before `courseLevel`, currently line 150). Note there is **no** `primary: Major` parameter — every module already placed in `semesters`/`waivedModules` belongs to the primary major by construction (many primary categories, e.g. `math-sciences` or `unrestricted-electives`, carry an MC target but no named `RequirementRule` row at all, so "satisfies a primary requirement" is not a meaningful test). The only real question is whether that same credit *also* satisfies the secondary programme's own requirements:

```ts
import type { SecondaryProgramme } from '@shared/types';
```

(add `SecondaryProgramme` to the existing `import type { Major, StudentSemester, PlacedModule, WaivedModule, FocusArea } from '@shared/types';` at the top of the file instead of a separate import line)

```ts
export interface DoubleCountStatus {
  doubleCountMc: number;
  /** secondary.mcTarget * 0.4 — 16 MC for a second major, 8 MC for a minor
   * at NUS's standard 40/20 MC sizes. Derived, never hard-coded. */
  capMc: number;
  warn: boolean;
  doubleCountedCodes: string[];
}

export const computeDoubleCount = (
  secondary: SecondaryProgramme,
  semesters: StudentSemester[],
  waivedModules: WaivedModule[] = [],
): DoubleCountStatus => {
  const allModules = [...semesters.flatMap((s) => s.modules), ...waivedModules];
  const byCode = new Map<string, PlacedModule>();
  for (const m of allModules) if (!byCode.has(m.code)) byCode.set(m.code, m);

  const doubleCountedCodes = [...byCode.keys()].filter((code) =>
    matchesAnyRequirement(secondary.requirements, code),
  );
  const doubleCountMc = doubleCountedCodes.reduce((sum, code) => sum + (byCode.get(code)?.mcs ?? 0), 0);
  const capMc = secondary.mcTarget * 0.4;

  return { doubleCountMc, capMc, warn: doubleCountMc > capMc, doubleCountedCodes };
};
```

- [ ] **Step 4: Add `computeTripleCountedCodes`**

Right after `computeDoubleCount`:

```ts
/** Codes that satisfy ≥1 requirement in 2 or more declared secondary
 * programmes at once (1 implicit primary count + 2 secondary counts = 3).
 * NUS explicitly forbids this. */
export const computeTripleCountedCodes = (
  secondaries: SecondaryProgramme[],
  semesters: StudentSemester[],
  waivedModules: WaivedModule[] = [],
): string[] => {
  const allModules = [...semesters.flatMap((s) => s.modules), ...waivedModules];
  const codes = Array.from(new Set(allModules.map((m) => m.code)));
  return codes.filter(
    (code) => secondaries.filter((secondary) => matchesAnyRequirement(secondary.requirements, code)).length >= 2,
  );
};
```

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/studyPlan.ts
git commit -m "Add computeDoubleCount and computeTripleCountedCodes, loosen computeRequirements"
```

---

### Task 3: Data — Second Major in Mathematics

**Files:**
- Create: `shared/data/second-majors/mathematics.json`

**Interfaces:**
- Produces: a `SecondaryProgramme` JSON matching Task 1's type, auto-registered once Task 6's loader exists.

- [ ] **Step 1: Author the file**

```json
{
  "id": "mathematics",
  "label": "Mathematics",
  "kind": "second-major",
  "mcTarget": 40,
  "requirements": [
    {
      "name": "Calculus (MA1521 or MA1102R)",
      "fulfilledBy": ["MA1521", "MA1102R"],
      "count": 1
    },
    {
      "name": "Linear Algebra II (MA2101 or MA2101S)",
      "fulfilledBy": ["MA2101", "MA2101S"],
      "count": 1
    },
    {
      "name": "Multivariable Calculus (MA2104)",
      "fulfilledBy": ["MA2104"],
      "count": 1
    },
    {
      "name": "Mathematical Analysis I (MA2108 or MA2108S)",
      "fulfilledBy": ["MA2108", "MA2108S"],
      "count": 1
    },
    {
      "name": "Probability (MA2216 or ST2131)",
      "fulfilledBy": ["MA2216", "ST2131"],
      "count": 1
    },
    {
      "name": "3000+ Mathematics electives (MA-coded)",
      "fulfilledBy": ["MA3*", "MA4*"],
      "count": 2
    },
    {
      "name": "Additional 3000+ elective (MA-coded, or ST3236/ST4238)",
      "fulfilledBy": ["MA3*", "MA4*", "ST3236", "ST4238"],
      "count": 1
    }
  ],
  "moduleCatalog": {
    "MA1521": { "code": "MA1521", "name": "Calculus for Computing", "mcs": 4 },
    "MA1102R": { "code": "MA1102R", "name": "Calculus", "mcs": 4 },
    "MA2101": { "code": "MA2101", "name": "Linear Algebra II", "mcs": 4 },
    "MA2101S": { "code": "MA2101S", "name": "Linear Algebra II (S)", "mcs": 5 },
    "MA2104": { "code": "MA2104", "name": "Multivariable Calculus", "mcs": 4 },
    "MA2108": { "code": "MA2108", "name": "Mathematical Analysis I", "mcs": 4 },
    "MA2108S": { "code": "MA2108S", "name": "Mathematical Analysis I (S)", "mcs": 5 },
    "MA2216": { "code": "MA2216", "name": "Probability", "mcs": 4 },
    "ST2131": { "code": "ST2131", "name": "Probability", "mcs": 4 },
    "ST3236": { "code": "ST3236", "name": "Survival Analysis", "mcs": 4 },
    "ST4238": { "code": "ST4238", "name": "Introduction to Multivariate Analysis", "mcs": 4 }
  }
}
```

Judgment call: NUS's real rule requires ≥2 of the 3000+ electives to be MA-coded specifically, with only 1 allowed to substitute ST3236/ST4238. The existing `fulfilledBy`/`count` rule engine can't express "≥2 from list A, 1 more from A∪B" as a single row, so this is split into two rows (2 MA-only, 1 either) — the same kind of simplification the existing major files already accept (e.g. the CS-NUSC spec's documented "Cultures & Connections... dropped, app data can't distinguish" call). MC totals across rows are approximate, matching the "verify against your own degree audit" caveat already used for every major file in this repo.

- [ ] **Step 2: Verify it's valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('shared/data/second-majors/mathematics.json', 'utf8')); console.log('valid')"`
Expected: prints `valid`

- [ ] **Step 3: Commit**

```bash
git add shared/data/second-majors/mathematics.json
git commit -m "Add Second Major in Mathematics data file"
```

---

### Task 4: Data — Minor in Mathematics

**Files:**
- Create: `shared/data/minors/mathematics.json`

- [ ] **Step 1: Author the file**

```json
{
  "id": "mathematics",
  "label": "Mathematics",
  "kind": "minor",
  "mcTarget": 20,
  "requirements": [
    {
      "name": "Foundational Mathematics module (MA1521, MA1102R, or CS1231/CS1231S)",
      "fulfilledBy": ["MA1521", "MA1102R", "CS1231", "CS1231S"],
      "count": 2
    },
    {
      "name": "2000-level Mathematics elective or ST2131",
      "fulfilledBy": ["MA2*", "ST2131"],
      "count": 2
    },
    {
      "name": "3000+ Mathematics elective or ST3236/ST4238",
      "fulfilledBy": ["MA3*", "MA4*", "ST3236", "ST4238"],
      "count": 1
    }
  ],
  "moduleCatalog": {
    "MA1521": { "code": "MA1521", "name": "Calculus for Computing", "mcs": 4 },
    "MA1102R": { "code": "MA1102R", "name": "Calculus", "mcs": 4 },
    "CS1231": { "code": "CS1231", "name": "Discrete Structures", "mcs": 4 },
    "CS1231S": { "code": "CS1231S", "name": "Discrete Structures", "mcs": 4 },
    "ST2131": { "code": "ST2131", "name": "Probability", "mcs": 4 },
    "ST3236": { "code": "ST3236", "name": "Survival Analysis", "mcs": 4 },
    "ST4238": { "code": "ST4238", "name": "Introduction to Multivariate Analysis", "mcs": 4 }
  }
}
```

Judgment call: the official rule excludes `MA1301`/`MA1301X` from the first row's pool and excludes bare `MA20xx` "applied" modules from the second row — the prefix-only `fulfilledBy` syntax (a trailing `*` matches by prefix, nothing else) can't express an exclusion, so this simplification accepts the same kind of precision loss already documented for other majors in this repo.

- [ ] **Step 2: Verify it's valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('shared/data/minors/mathematics.json', 'utf8')); console.log('valid')"`
Expected: prints `valid`

- [ ] **Step 3: Commit**

```bash
git add shared/data/minors/mathematics.json
git commit -m "Add Minor in Mathematics data file"
```

---

### Task 5: Data — Second Major in Statistics

**Files:**
- Create: `shared/data/second-majors/statistics.json`

- [ ] **Step 1: Author the file**

```json
{
  "id": "statistics",
  "label": "Statistics",
  "kind": "second-major",
  "mcTarget": 40,
  "requirements": [
    {
      "name": "Introduction to Statistics (ST1131)",
      "fulfilledBy": ["ST1131"],
      "count": 1
    },
    {
      "name": "Calculus (MA1521 or MA1102R)",
      "fulfilledBy": ["MA1521", "MA1102R"],
      "count": 1
    },
    {
      "name": "Linear Algebra (MA1101R or MA1508E)",
      "fulfilledBy": ["MA1101R", "MA1508E"],
      "count": 1
    },
    {
      "name": "Mathematical Statistics (ST2132)",
      "fulfilledBy": ["ST2132"],
      "count": 1
    },
    {
      "name": "Computer-Aided Data Analysis (ST2137)",
      "fulfilledBy": ["ST2137"],
      "count": 1
    },
    {
      "name": "Statistics electives (ST3131, ST32xx, or ST42xx)",
      "fulfilledBy": ["ST3131", "ST32*", "ST42*"],
      "count": 3
    },
    {
      "name": "Additional Statistics elective (ST32xx or ST42xx)",
      "fulfilledBy": ["ST32*", "ST42*"],
      "count": 1
    }
  ],
  "moduleCatalog": {
    "ST1131": { "code": "ST1131", "name": "Introduction to Statistics", "mcs": 4 },
    "MA1521": { "code": "MA1521", "name": "Calculus for Computing", "mcs": 4 },
    "MA1102R": { "code": "MA1102R", "name": "Calculus", "mcs": 4 },
    "MA1101R": { "code": "MA1101R", "name": "Linear Algebra I", "mcs": 4 },
    "MA1508E": { "code": "MA1508E", "name": "Mathematics for Engineering", "mcs": 4 },
    "ST2132": { "code": "ST2132", "name": "Mathematical Statistics", "mcs": 4 },
    "ST2137": { "code": "ST2137", "name": "Computer-Aided Data Analysis", "mcs": 4 },
    "ST3131": { "code": "ST3131", "name": "Regression Analysis", "mcs": 4 }
  }
}
```

Not open to students already majoring or minoring in Statistics/Data Science & Analytics per NUS policy — this app does not enforce that restriction (per spec's Scope decision), same as it doesn't enforce any other cross-programme eligibility rule.

- [ ] **Step 2: Verify it's valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('shared/data/second-majors/statistics.json', 'utf8')); console.log('valid')"`
Expected: prints `valid`

- [ ] **Step 3: Commit**

```bash
git add shared/data/second-majors/statistics.json
git commit -m "Add Second Major in Statistics data file"
```

---

### Task 6: Load, declare, and persist second major/minors in `useStudyPlan`

**Files:**
- Modify: `src/hooks/useStudyPlan.ts` (throughout — loader, state, persistence, all reset points)

**Interfaces:**
- Consumes: `SecondaryProgramme` (Task 1), the 3 JSON files (Tasks 3-5)
- Produces: from `useStudyPlan()`'s return object — `secondMajors: SecondaryProgramme[]`, `minors: SecondaryProgramme[]`, `secondMajorId: string | null`, `minorIds: string[]`, `setSecondMajorId: (id: string | null) => void`, `toggleMinorId: (id: string) => void`. Consumed by Tasks 7, 8, 10 (all spread via `<StudyPlan {...plan} />` in `src/App.tsx:95`, no change needed there).

- [ ] **Step 1: Add the glob loaders**

In `src/hooks/useStudyPlan.ts`, after the existing `majorModules`/`loadMajors` block (lines 16-22), add:

```ts
const secondMajorModules = import.meta.glob('../../shared/data/second-majors/*.json', { eager: true });
const minorModules = import.meta.glob('../../shared/data/minors/*.json', { eager: true });

export const loadSecondMajors = (): SecondaryProgramme[] =>
  Object.values(secondMajorModules).map((m) => (m as { default: SecondaryProgramme }).default);

export const loadMinors = (): SecondaryProgramme[] =>
  Object.values(minorModules).map((m) => (m as { default: SecondaryProgramme }).default);

/** NUS caps a student at 1 declared second major and 3 declared minors. */
const MAX_MINORS = 3;
```

Add `SecondaryProgramme` to the top-of-file type import:

```ts
import type { Major, StudentPlan, StudentSemester, PlacedModule, WaivedModule, SecondaryProgramme } from '@shared/types';
```

- [ ] **Step 2: Extend `SavedPlanState` and the load/write functions**

Replace the `SavedPlanState` interface (lines 26-29):

```ts
interface SavedPlanState {
  semesters: StudentSemester[];
  waivedModules: WaivedModule[];
}
```

with:

```ts
interface SavedPlanState {
  semesters: StudentSemester[];
  waivedModules: WaivedModule[];
  secondMajorId: string | null;
  minorIds: string[];
}
```

Replace `loadSavedPlan` (lines 68-81):

```ts
const loadSavedPlan = (major: Major): SavedPlanState | null => {
  try {
    const raw = localStorage.getItem(planKey(major.id));
    if (!raw) return null;
    const plan = JSON.parse(raw) as StudentPlan;
    if (!Array.isArray(plan.semesters)) return null;
    return {
      semesters: normalizeSemesters(major, plan.semesters),
      waivedModules: normalizeWaivedModules(major, plan.waivedModules),
    };
  } catch {
    return null;
  }
};
```

with:

```ts
const loadSavedPlan = (major: Major): SavedPlanState | null => {
  try {
    const raw = localStorage.getItem(planKey(major.id));
    if (!raw) return null;
    const plan = JSON.parse(raw) as StudentPlan;
    if (!Array.isArray(plan.semesters)) return null;
    return {
      semesters: normalizeSemesters(major, plan.semesters),
      waivedModules: normalizeWaivedModules(major, plan.waivedModules),
      secondMajorId: typeof plan.secondMajorId === 'string' ? plan.secondMajorId : null,
      minorIds: Array.isArray(plan.minorIds) ? plan.minorIds.slice(0, MAX_MINORS) : [],
    };
  } catch {
    return null;
  }
};
```

Replace `jsonDefaultPlan` (lines 83-86):

```ts
const jsonDefaultPlan = (major: Major): SavedPlanState => ({
  semesters: defaultPlanToSemesters(major),
  waivedModules: normalizeWaivedModules(major, major.defaultWaivedModules),
});
```

with:

```ts
const jsonDefaultPlan = (major: Major): SavedPlanState => ({
  semesters: defaultPlanToSemesters(major),
  waivedModules: normalizeWaivedModules(major, major.defaultWaivedModules),
  secondMajorId: null,
  minorIds: [],
});
```

Replace `writeSavedPlan` (lines 97-105):

```ts
const writeSavedPlan = (majorId: string, state: SavedPlanState) => {
  const plan: StudentPlan = {
    majorId,
    semesters: state.semesters,
    waivedModules: state.waivedModules,
    lastUpdated: new Date().toISOString(),
  };
  localStorage.setItem(planKey(majorId), JSON.stringify(plan));
};
```

with:

```ts
const writeSavedPlan = (majorId: string, state: SavedPlanState) => {
  const plan: StudentPlan = {
    majorId,
    semesters: state.semesters,
    waivedModules: state.waivedModules,
    secondMajorId: state.secondMajorId ?? undefined,
    minorIds: state.minorIds,
    lastUpdated: new Date().toISOString(),
  };
  localStorage.setItem(planKey(majorId), JSON.stringify(plan));
};
```

- [ ] **Step 3: Add state, persistence effect, and setters inside `useStudyPlan`**

Replace the top of `useStudyPlan` (lines 107-122):

```ts
export const useStudyPlan = () => {
  const majors = loadMajors();
  const defaultMajor = majors.find((m) => m.id === DEFAULT_MAJOR_ID) ?? majors[0];
  const [majorId, setMajorId] = useState<string>(defaultMajor?.id ?? '');
  const [personalMajorId, setPersonalMajorId] = useState<string>(defaultMajor?.id ?? '');
  const [mode, setMode] = useState<PlanMode>('personal');
  const major = majors.find((m) => m.id === majorId) ?? defaultMajor;

  const initialPlan = major ? loadPlanForMajor(major) : null;
  const [semesters, setSemesters] = useState<StudentSemester[]>(() => {
    if (!major) return [];
    return initialPlan?.semesters ?? [];
  });
  const [waivedModules, setWaivedModules] = useState<WaivedModule[]>(() =>
    initialPlan?.waivedModules ?? [],
  );

  useEffect(() => {
    if (!major || mode !== 'personal') return;
    writeSavedPlan(major.id, { semesters, waivedModules });
  }, [semesters, waivedModules, major, mode]);
```

with:

```ts
export const useStudyPlan = () => {
  const majors = loadMajors();
  const secondMajors = loadSecondMajors();
  const minors = loadMinors();
  const defaultMajor = majors.find((m) => m.id === DEFAULT_MAJOR_ID) ?? majors[0];
  const [majorId, setMajorId] = useState<string>(defaultMajor?.id ?? '');
  const [personalMajorId, setPersonalMajorId] = useState<string>(defaultMajor?.id ?? '');
  const [mode, setMode] = useState<PlanMode>('personal');
  const major = majors.find((m) => m.id === majorId) ?? defaultMajor;

  const initialPlan = major ? loadPlanForMajor(major) : null;
  const [semesters, setSemesters] = useState<StudentSemester[]>(() => {
    if (!major) return [];
    return initialPlan?.semesters ?? [];
  });
  const [waivedModules, setWaivedModules] = useState<WaivedModule[]>(() =>
    initialPlan?.waivedModules ?? [],
  );
  const [secondMajorId, setSecondMajorIdState] = useState<string | null>(
    () => initialPlan?.secondMajorId ?? null,
  );
  const [minorIds, setMinorIds] = useState<string[]>(() => initialPlan?.minorIds ?? []);

  useEffect(() => {
    if (!major || mode !== 'personal') return;
    writeSavedPlan(major.id, { semesters, waivedModules, secondMajorId, minorIds });
  }, [semesters, waivedModules, secondMajorId, minorIds, major, mode]);

  const setSecondMajorId = useCallback((id: string | null) => {
    setSecondMajorIdState(id);
  }, []);

  const toggleMinorId = useCallback((id: string) => {
    setMinorIds((prev) => {
      if (prev.includes(id)) return prev.filter((existing) => existing !== id);
      if (prev.length >= MAX_MINORS) return prev;
      return [...prev, id];
    });
  }, []);
```

- [ ] **Step 4: Reset second major/minors at every existing plan-reset point**

In `switchMajor` (lines 129-140), replace:

```ts
  const switchMajor = useCallback(
    (newMajorId: string) => {
      const newMajor = majors.find((m) => m.id === newMajorId);
      if (!newMajor) return;
      const nextPlan = mode === 'personal' ? loadPlanForMajor(newMajor) : jsonDefaultPlan(newMajor);
      setSemesters(nextPlan.semesters);
      setWaivedModules(nextPlan.waivedModules);
      setMajorId(newMajorId);
      if (mode === 'personal') setPersonalMajorId(newMajorId);
    },
    [majors, mode],
  );
```

with:

```ts
  const switchMajor = useCallback(
    (newMajorId: string) => {
      const newMajor = majors.find((m) => m.id === newMajorId);
      if (!newMajor) return;
      const nextPlan = mode === 'personal' ? loadPlanForMajor(newMajor) : jsonDefaultPlan(newMajor);
      setSemesters(nextPlan.semesters);
      setWaivedModules(nextPlan.waivedModules);
      setSecondMajorIdState(nextPlan.secondMajorId);
      setMinorIds(nextPlan.minorIds);
      setMajorId(newMajorId);
      if (mode === 'personal') setPersonalMajorId(newMajorId);
    },
    [majors, mode],
  );
```

Replace `resetPlan` (lines 191-196):

```ts
  const resetPlan = useCallback(() => {
    if (!major) return;
    const defaultPlan = jsonDefaultPlan(major);
    setSemesters(defaultPlan.semesters);
    setWaivedModules(defaultPlan.waivedModules);
  }, [major]);
```

with:

```ts
  const resetPlan = useCallback(() => {
    if (!major) return;
    const defaultPlan = jsonDefaultPlan(major);
    setSemesters(defaultPlan.semesters);
    setWaivedModules(defaultPlan.waivedModules);
    setSecondMajorIdState(defaultPlan.secondMajorId);
    setMinorIds(defaultPlan.minorIds);
  }, [major]);
```

Replace `importSharedPlan` (lines 198-210) — imported/reviewed shared plans don't carry secondary-programme declarations (the share payload format is untouched by this feature), so both reset to the empty baseline:

```ts
  const importSharedPlan = useCallback(
    (newMajorId: string, importedSemesters: StudentSemester[], importedWaived: WaivedModule[]) => {
      const newMajor = majors.find((m) => m.id === newMajorId);
      if (!newMajor) return false;
      setMode('personal');
      setSemesters(normalizeSemesters(newMajor, importedSemesters));
      setWaivedModules(normalizeWaivedModules(newMajor, importedWaived));
      setMajorId(newMajorId);
      setPersonalMajorId(newMajorId);
      return true;
    },
    [majors],
  );
```

with:

```ts
  const importSharedPlan = useCallback(
    (newMajorId: string, importedSemesters: StudentSemester[], importedWaived: WaivedModule[]) => {
      const newMajor = majors.find((m) => m.id === newMajorId);
      if (!newMajor) return false;
      setMode('personal');
      setSemesters(normalizeSemesters(newMajor, importedSemesters));
      setWaivedModules(normalizeWaivedModules(newMajor, importedWaived));
      setSecondMajorIdState(null);
      setMinorIds([]);
      setMajorId(newMajorId);
      setPersonalMajorId(newMajorId);
      return true;
    },
    [majors],
  );
```

Replace `openReviewPlan` (lines 212-223):

```ts
  const openReviewPlan = useCallback(
    (newMajorId: string, importedSemesters: StudentSemester[], importedWaived: WaivedModule[]) => {
      const newMajor = majors.find((m) => m.id === newMajorId);
      if (!newMajor) return false;
      setMode('review');
      setSemesters(normalizeSemesters(newMajor, importedSemesters));
      setWaivedModules(normalizeWaivedModules(newMajor, importedWaived));
      setMajorId(newMajorId);
      return true;
    },
    [majors],
  );
```

with:

```ts
  const openReviewPlan = useCallback(
    (newMajorId: string, importedSemesters: StudentSemester[], importedWaived: WaivedModule[]) => {
      const newMajor = majors.find((m) => m.id === newMajorId);
      if (!newMajor) return false;
      setMode('review');
      setSemesters(normalizeSemesters(newMajor, importedSemesters));
      setWaivedModules(normalizeWaivedModules(newMajor, importedWaived));
      setSecondMajorIdState(null);
      setMinorIds([]);
      setMajorId(newMajorId);
      return true;
    },
    [majors],
  );
```

Replace `exitReviewMode` (lines 225-233):

```ts
  const exitReviewMode = useCallback(() => {
    const personalMajor = majors.find((m) => m.id === personalMajorId) ?? defaultMajor;
    if (!personalMajor) return;
    const personalPlan = loadPlanForMajor(personalMajor);
    setMode('personal');
    setSemesters(personalPlan.semesters);
    setWaivedModules(personalPlan.waivedModules);
    setMajorId(personalMajor.id);
  }, [majors, personalMajorId, defaultMajor]);
```

with:

```ts
  const exitReviewMode = useCallback(() => {
    const personalMajor = majors.find((m) => m.id === personalMajorId) ?? defaultMajor;
    if (!personalMajor) return;
    const personalPlan = loadPlanForMajor(personalMajor);
    setMode('personal');
    setSemesters(personalPlan.semesters);
    setWaivedModules(personalPlan.waivedModules);
    setSecondMajorIdState(personalPlan.secondMajorId);
    setMinorIds(personalPlan.minorIds);
    setMajorId(personalMajor.id);
  }, [majors, personalMajorId, defaultMajor]);
```

- [ ] **Step 5: Expose the new fields from the hook's return value**

Replace the final `return` statement (lines 238-258):

```ts
  return {
    majors,
    major,
    majorId,
    semesters,
    waivedModules,
    stats,
    requirements,
    switchMajor,
    addOrMoveModule,
    deleteModule,
    updateModule,
    addWaivedModule,
    deleteWaivedModule,
    resetPlan,
    importSharedPlan,
    openReviewPlan,
    exitReviewMode,
    isReviewMode: mode === 'review',
    getCompletedCodes: (year: number, sem: number) => getCompletedCodesUpTo(semesters, year, sem),
  };
};
```

with:

```ts
  return {
    majors,
    major,
    majorId,
    secondMajors,
    minors,
    secondMajorId,
    minorIds,
    setSecondMajorId,
    toggleMinorId,
    semesters,
    waivedModules,
    stats,
    requirements,
    switchMajor,
    addOrMoveModule,
    deleteModule,
    updateModule,
    addWaivedModule,
    deleteWaivedModule,
    resetPlan,
    importSharedPlan,
    openReviewPlan,
    exitReviewMode,
    isReviewMode: mode === 'review',
    getCompletedCodes: (year: number, sem: number) => getCompletedCodesUpTo(semesters, year, sem),
  };
};
```

- [ ] **Step 6: Verify the build**

Run: `npm run build`
Expected: exits 0. (`src/components/StudyPlan.tsx` doesn't declare these new props on its `Props` interface yet, but since `App.tsx:95` spreads `{...plan}` as a JSX spread rather than an object literal, TypeScript's excess-property check does not fire — the extra fields are silently accepted for now. Task 10 adds them to the `Props` interface explicitly.)

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useStudyPlan.ts
git commit -m "Load, declare, and persist second major/minor selections in useStudyPlan"
```

---

### Task 7: Settings UI — declare second major and minors

**Files:**
- Modify: `src/components/StudyPlan.tsx:368-473` (`SettingsPage` component and its render in the parent)

**Interfaces:**
- Consumes: `secondMajors`, `minors`, `secondMajorId`, `minorIds`, `setSecondMajorId`, `toggleMinorId` (Task 6)

- [ ] **Step 1: Extend `SettingsPage`'s props and destructuring**

Replace the `SettingsPage` signature (lines 368-390):

```ts
const SettingsPage = ({
  majors,
  majorId,
  studentName,
  setStudentName,
  matricNumber,
  setMatricNumber,
  studentYear,
  setStudentYear,
  onSwitchMajor,
  onResetPlan,
}: {
  majors: Major[];
  majorId: string;
  studentName: string;
  setStudentName: (name: string) => void;
  matricNumber: string;
  setMatricNumber: (matric: string) => void;
  studentYear: string;
  setStudentYear: (year: string) => void;
  onSwitchMajor: (id: string) => void;
  onResetPlan: () => void;
}) => {
```

with:

```ts
const SettingsPage = ({
  majors,
  majorId,
  secondMajors,
  minors,
  secondMajorId,
  minorIds,
  setSecondMajorId,
  toggleMinorId,
  studentName,
  setStudentName,
  matricNumber,
  setMatricNumber,
  studentYear,
  setStudentYear,
  onSwitchMajor,
  onResetPlan,
}: {
  majors: Major[];
  majorId: string;
  secondMajors: SecondaryProgramme[];
  minors: SecondaryProgramme[];
  secondMajorId: string | null;
  minorIds: string[];
  setSecondMajorId: (id: string | null) => void;
  toggleMinorId: (id: string) => void;
  studentName: string;
  setStudentName: (name: string) => void;
  matricNumber: string;
  setMatricNumber: (matric: string) => void;
  studentYear: string;
  setStudentYear: (year: string) => void;
  onSwitchMajor: (id: string) => void;
  onResetPlan: () => void;
}) => {
```

Add `SecondaryProgramme` to the top-of-file type import (currently `import type { Major, PlacedModule, StudentSemester, WaivedModule } from '@shared/types';` at line 2):

```ts
import type { Major, PlacedModule, StudentSemester, WaivedModule, SecondaryProgramme } from '@shared/types';
```

- [ ] **Step 2: Add the Second Major dropdown and Minor toggle chips**

In the "Programme" `<section>` (lines 438-456), replace:

```tsx
        <section className="rounded-4xl bg-paper p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">Programme</h2>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted">Major</span>
            <Dropdown
              variant="field"
              ariaLabel="Major"
              value={majorId}
              onChange={onSwitchMajor}
              className={field}
              options={majors.map((item) => ({ value: item.id, label: item.label }))}
            />
          </label>
          {major && (
            <div className="mt-2">
              <BatchBadge batches={major.batches} />
            </div>
          )}
        </section>
```

with:

```tsx
        <section className="rounded-4xl bg-paper p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">Programme</h2>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted">Major</span>
            <Dropdown
              variant="field"
              ariaLabel="Major"
              value={majorId}
              onChange={onSwitchMajor}
              className={field}
              options={majors.map((item) => ({ value: item.id, label: item.label }))}
            />
          </label>
          {major && (
            <div className="mt-2">
              <BatchBadge batches={major.batches} />
            </div>
          )}

          <label className="mt-4 flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted">Second Major</span>
            <Dropdown
              variant="field"
              ariaLabel="Second Major"
              value={secondMajorId ?? ''}
              onChange={(id) => setSecondMajorId(id === '' ? null : id)}
              className={field}
              options={[
                { value: '', label: 'None' },
                ...secondMajors.map((item) => ({ value: item.id, label: item.label })),
              ]}
            />
          </label>

          <div className="mt-4 flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-muted">Minors (up to 3)</span>
            <div className="flex flex-wrap gap-2">
              {minors.map((item) => {
                const selected = minorIds.includes(item.id);
                const disabled = !selected && minorIds.length >= 3;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleMinorId(item.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      selected
                        ? 'bg-ink text-canvas'
                        : disabled
                          ? 'cursor-not-allowed bg-canvas text-muted/50'
                          : 'bg-canvas text-ink hover:bg-canvas/70'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
```

- [ ] **Step 3: Pass the new props at the call site**

Find where `<SettingsPage` is rendered (inside the main `StudyPlan` component, in the `view === 'settings'` branch), currently:

```tsx
        <SettingsPage
          majors={majors}
          majorId={majorId}
          studentName={studentName}
          setStudentName={setStudentName}
          matricNumber={matricNumber}
          setMatricNumber={setMatricNumber}
          studentYear={studentYear}
          setStudentYear={setStudentYear}
          onSwitchMajor={handleSwitchMajor}
          onResetPlan={handleResetPlan}
        />
```

replace with:

```tsx
        <SettingsPage
          majors={majors}
          majorId={majorId}
          secondMajors={secondMajors}
          minors={minors}
          secondMajorId={secondMajorId}
          minorIds={minorIds}
          setSecondMajorId={setSecondMajorId}
          toggleMinorId={toggleMinorId}
          studentName={studentName}
          setStudentName={setStudentName}
          matricNumber={matricNumber}
          setMatricNumber={setMatricNumber}
          studentYear={studentYear}
          setStudentYear={setStudentYear}
          onSwitchMajor={handleSwitchMajor}
          onResetPlan={handleResetPlan}
        />
```

(This call site currently reads these 6 new values — `secondMajors`, `minors`, `secondMajorId`, `minorIds`, `setSecondMajorId`, `toggleMinorId` — as destructured props of the parent `StudyPlan` component. Task 10 adds them to `StudyPlan`'s own `Props` interface and destructuring; until then, `npm run build` will report they're missing from scope. Do Task 10's Step 1 first if building this task in isolation, or proceed straight to Task 10 next — the two are meant to land together in the same review pass.)

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: exits 0 once Task 10 Step 1 has also been applied (see note above). If doing tasks strictly in order, treat Tasks 7-10 as one reviewable unit and run the build once at the end of Task 10 instead.

- [ ] **Step 5: Commit**

```bash
git add src/components/StudyPlan.tsx
git commit -m "Add Second Major dropdown and Minor toggle chips to Settings"
```

---

### Task 8: Header badges for declared programmes

**Files:**
- Modify: `src/components/StudyPlan.tsx:339-366` (`MajorHeaderSelect`)

**Interfaces:**
- Consumes: `SecondaryProgramme` (Task 1)

- [ ] **Step 1: Extend `MajorHeaderSelect` to accept and render declared programmes**

Replace (lines 339-366):

```tsx
const MajorHeaderSelect = ({
  majors,
  major,
  majorId,
  onChange,
}: {
  majors: Major[];
  major: Major;
  majorId: string;
  onChange: (id: string) => void;
}) => (
  <div className="flex flex-col items-start gap-0.5">
    <Dropdown
      variant="header"
      ariaLabel="Major"
      value={majorId}
      onChange={onChange}
      options={majors.map((item) => ({ value: item.id, label: item.label }))}
    />
    {major.specialisation && (
      <span className="text-xs leading-tight text-muted">{major.specialisation}</span>
    )}
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] leading-tight text-muted/70">{major.school}</span>
      <BatchBadge batches={major.batches} />
    </div>
  </div>
);
```

with:

```tsx
const MajorHeaderSelect = ({
  majors,
  major,
  majorId,
  onChange,
  secondMajor,
  declaredMinors,
}: {
  majors: Major[];
  major: Major;
  majorId: string;
  onChange: (id: string) => void;
  secondMajor: SecondaryProgramme | null;
  declaredMinors: SecondaryProgramme[];
}) => (
  <div className="flex flex-col items-start gap-0.5">
    <Dropdown
      variant="header"
      ariaLabel="Major"
      value={majorId}
      onChange={onChange}
      options={majors.map((item) => ({ value: item.id, label: item.label }))}
    />
    {major.specialisation && (
      <span className="text-xs leading-tight text-muted">{major.specialisation}</span>
    )}
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] leading-tight text-muted/70">{major.school}</span>
      <BatchBadge batches={major.batches} />
    </div>
    {(secondMajor || declaredMinors.length > 0) && (
      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
        {secondMajor && <SecondaryProgrammeBadge label={`2nd Major: ${secondMajor.label}`} />}
        {declaredMinors.map((item) => (
          <SecondaryProgrammeBadge key={item.id} label={`Minor: ${item.label}`} />
        ))}
      </div>
    )}
  </div>
);

const SecondaryProgrammeBadge = ({ label }: { label: string }) => (
  <span
    className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium leading-none"
    style={{ backgroundColor: 'rgba(20,20,19,0.06)', color: 'rgb(108,107,104)' }}
  >
    {label}
  </span>
);
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: will report `secondMajor`/`declaredMinors` missing at the `<MajorHeaderSelect>` call site until Task 10 supplies them — same "land together" note as Task 7. Treat Tasks 7, 8, 10 as one reviewable unit; run the build once at the end of Task 10.

- [ ] **Step 3: Commit**

```bash
git add src/components/StudyPlan.tsx
git commit -m "Add header badges for declared second major and minors"
```

---

### Task 9: `SecondaryProgrammePanel` component

**Files:**
- Modify: `src/components/StatsSummary.tsx` (export 3 existing private components, no behavior change)
- Create: `src/components/SecondaryProgrammePanel.tsx`

**Interfaces:**
- Consumes: `computeRequirements`, `computeDoubleCount` (Task 2), `RequirementRow`, `StatusDot`, `ConstraintChip`, `ConstraintStatus` (this task's Step 1)
- Produces: `SecondaryProgrammePanel` component, consumed by Task 10.

- [ ] **Step 1: Export the 3 reusable pieces from `StatsSummary.tsx`**

`StatsSummary.tsx` already has the exact visual primitives this feature needs (a fulfilled/unfulfilled dot, a requirement row, and a warn-capable pill chip), just not exported. Rather than duplicate ~30 lines, export them as-is:

Find (line 275): `const ConstraintChip = ({ constraint }: { constraint: ConstraintStatus }) => (`
Change to: `export const ConstraintChip = ({ constraint }: { constraint: ConstraintStatus }) => (`

Find (line 376): `const RequirementRow = ({ req }: { req: RequirementStatus }) => (`
Change to: `export const RequirementRow = ({ req }: { req: RequirementStatus }) => (`

Find (line 428): `const StatusDot = ({ fulfilled }: { fulfilled: boolean }) => (`
Change to: `export const StatusDot = ({ fulfilled }: { fulfilled: boolean }) => (`

No other changes to this file — purely adding the `export` keyword to 3 existing declarations.

- [ ] **Step 2: Create `SecondaryProgrammePanel.tsx`**

```tsx
import type { SecondaryProgramme, StudentSemester, WaivedModule } from '@shared/types';
import type { ConstraintStatus } from '../lib/studyPlan';
import { computeRequirements, computeDoubleCount } from '../lib/studyPlan';
import { ConstraintChip, RequirementRow, StatusDot } from './StatsSummary';

interface Props {
  programme: SecondaryProgramme;
  semesters: StudentSemester[];
  waivedModules: WaivedModule[];
}

export const SecondaryProgrammePanel = ({ programme, semesters, waivedModules }: Props) => {
  const requirements = computeRequirements(programme, semesters, waivedModules);
  const fulfilled = requirements.filter((req) => req.fulfilled).length;
  const doubleCount = computeDoubleCount(programme, semesters, waivedModules);
  const kindLabel = programme.kind === 'second-major' ? 'Second Major' : 'Minor';

  const doubleCountConstraint: ConstraintStatus = {
    id: 'double-count',
    label: `${doubleCount.doubleCountMc}/${doubleCount.capMc} MC double-counted with your primary major`,
    short: 'Double-counted',
    detail: `${doubleCount.doubleCountMc}/${doubleCount.capMc}MC`,
    fulfilled: !doubleCount.warn,
    warn: doubleCount.warn,
  };

  return (
    <div className="rounded-4xl bg-paper p-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">
          {programme.label} <span className="font-normal text-muted">&middot; {kindLabel}</span>
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">
            {fulfilled}/{requirements.length}
          </span>
          <ConstraintChip constraint={doubleCountConstraint} />
        </div>
      </div>

      {requirements.length === 0 ? (
        <p className="text-xs text-muted">No requirements defined for this programme.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {requirements.map((req) => (
            <RequirementRow key={req.name} req={req} />
          ))}
        </ul>
      )}
    </div>
  );
};
```

`StatusDot` is imported but not referenced directly in this file — it's used transitively inside the imported `RequirementRow`. Remove it from the import list to avoid an unused-import build error:

```tsx
import { ConstraintChip, RequirementRow } from './StatsSummary';
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/StatsSummary.tsx src/components/SecondaryProgrammePanel.tsx
git commit -m "Add SecondaryProgrammePanel, exporting shared chip/row primitives from StatsSummary"
```

---

### Task 10: Wire it all into the main planner view

**Files:**
- Modify: `src/components/StudyPlan.tsx` (top-of-file imports, `Props` interface, main component body and render, `<SettingsPage>`/`<MajorHeaderSelect>` call sites from Tasks 7-8)

**Interfaces:**
- Consumes: everything from Tasks 6 (hook fields), 8 (`MajorHeaderSelect` new props), 7 (`SettingsPage` new props), 9 (`SecondaryProgrammePanel`), plus `computeTripleCountedCodes` (Task 2).

- [ ] **Step 1: Add the new props to `StudyPlan`'s `Props` interface and destructuring**

At the top of `src/components/StudyPlan.tsx`, extend the type import (line 2):

```ts
import type { Major, PlacedModule, StudentSemester, WaivedModule, SecondaryProgramme } from '@shared/types';
```

Add the import for the new panel and the triple-count function:

```ts
import { SecondaryProgrammePanel } from './SecondaryProgrammePanel';
import { computeTripleCountedCodes } from '../lib/studyPlan';
```

In the `Props` interface (lines 11-39), add after `majorId: string;`:

```ts
  secondMajors: SecondaryProgramme[];
  minors: SecondaryProgramme[];
  secondMajorId: string | null;
  minorIds: string[];
  setSecondMajorId: (id: string | null) => void;
  toggleMinorId: (id: string) => void;
```

In the component's destructured parameters (lines 41-60ish), add the same 6 names after `majorId,`:

```ts
  secondMajors,
  minors,
  secondMajorId,
  minorIds,
  setSecondMajorId,
  toggleMinorId,
```

- [ ] **Step 2: Derive the declared programmes and triple-count list**

Inside the `StudyPlan` component body, near the other derived values (alongside `handleSwitchMajor`/`confirmSwitchMajor` etc.), add:

```ts
  const declaredSecondMajor = secondMajorId
    ? secondMajors.find((item) => item.id === secondMajorId) ?? null
    : null;
  const declaredMinors = minors.filter((item) => minorIds.includes(item.id));
  const declaredSecondaries = declaredSecondMajor ? [declaredSecondMajor, ...declaredMinors] : declaredMinors;
  const tripleCountedCodes = computeTripleCountedCodes(declaredSecondaries, semesters, waivedModules);
```

- [ ] **Step 3: Pass the new props to `MajorHeaderSelect`**

Find:

```tsx
            <MajorHeaderSelect
              majors={majors}
              major={major}
              majorId={majorId}
              onChange={handleSwitchMajor}
            />
```

Replace with:

```tsx
            <MajorHeaderSelect
              majors={majors}
              major={major}
              majorId={majorId}
              onChange={handleSwitchMajor}
              secondMajor={declaredSecondMajor}
              declaredMinors={declaredMinors}
            />
```

- [ ] **Step 4: Render the secondary-programme panels and triple-count banner**

Find the block right after the `<StatsSummary ... />` wrapper and before the `SemesterGrid` wrapper:

```tsx
          <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(20,20,19,0.08)' }}>
            <div className="max-w-screen-2xl mx-auto">
              <StatsSummary
                major={major}
                stats={stats}
                semesters={semesters}
                waivedModules={waivedModules}
                requirements={requirements}
              />
            </div>
          </div>

          <div className="max-w-screen-2xl mx-auto px-6 py-6">
```

Insert a new block between them:

```tsx
          <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(20,20,19,0.08)' }}>
            <div className="max-w-screen-2xl mx-auto">
              <StatsSummary
                major={major}
                stats={stats}
                semesters={semesters}
                waivedModules={waivedModules}
                requirements={requirements}
              />
            </div>
          </div>

          {(declaredSecondMajor || declaredMinors.length > 0) && (
            <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(20,20,19,0.08)' }}>
              <div className="max-w-screen-2xl mx-auto flex flex-col gap-4">
                {tripleCountedCodes.length > 0 && (
                  <div className="rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
                    <strong className="font-semibold">Triple-counting warning:</strong>{' '}
                    {tripleCountedCodes.join(', ')}{' '}
                    {tripleCountedCodes.length === 1 ? 'is' : 'are'} being counted toward your primary
                    major and 2 or more secondary programmes at once &mdash; NUS does not allow this;
                    one programme will need a different module.
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  {declaredSecondMajor && (
                    <SecondaryProgrammePanel
                      programme={declaredSecondMajor}
                      semesters={semesters}
                      waivedModules={waivedModules}
                    />
                  )}
                  {declaredMinors.map((item) => (
                    <SecondaryProgrammePanel
                      key={item.id}
                      programme={item}
                      semesters={semesters}
                      waivedModules={waivedModules}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="max-w-screen-2xl mx-auto px-6 py-6">
```

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: exits 0 — this closes out the "land together" note from Tasks 7 and 8.

- [ ] **Step 6: Commit**

```bash
git add src/components/StudyPlan.tsx
git commit -m "Wire second major/minor declarations into the main planner view"
```

---

### Task 11: Manual verification pass

**Files:** none (no code changes expected; fix forward in a follow-up commit if something's off)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: Vite prints a local URL with no errors.

- [ ] **Step 2: Declare a second major and confirm the checklist appears**

In the browser: leave the default major as Computer Science (NUS College). Go to Settings → Programme → set "Second Major" to "Mathematics". Return to the planner view.
Expected: a new "Mathematics · Second Major" panel appears below the stats bar, showing 7 requirement rows, most unfulfilled (0/1 or 0/2).

- [ ] **Step 3: Confirm double-counting registers from the existing default plan**

CS-NUSC's default plan already places `MA1521` (Calculus for Computing) under `math-sciences` — this module also satisfies the new Mathematics second major's "Calculus" requirement row.
Expected: the "Calculus" row in the Mathematics panel shows fulfilled, and the panel's "Double-counted" chip shows a nonzero MC value (4/16 MC), styled as the neutral (non-warning) chip color since it's under the 16 MC cap.

- [ ] **Step 4: Push double-counting over the cap and confirm the warning styling**

Add more modules to the plan that also satisfy Mathematics second-major requirements until double-counted MC exceeds 16 (e.g. place `MA1522`, `ST2334` if not already present, then add `MA2101`, `MA2104` — whichever combination pushes the shared-code MC sum past 16).
Expected: the "Double-counted" chip switches to the amber/warning color once the sum exceeds 16 MC, without blocking anything else in the UI.

- [ ] **Step 5: Declare 3 minors and confirm the cap is enforced in the UI**

In Settings, toggle on "Mathematics" minor plus 2 more (any others available). Confirm the toggle buttons for all remaining minors become visibly disabled (can't select a 4th).
Expected: exactly 3 minors selected, 4th+ buttons are non-clickable and visually muted.

- [ ] **Step 6: Confirm switching the primary major resets declarations**

With a second major and minors declared, go to Settings and switch "Major" to a different one (e.g. Artificial Intelligence), confirming the "Switching major will reset your plan" dialog.
Expected: after confirming, Second Major reverts to "None" and no minor chips remain selected — matches the existing "switching major resets your plan" behavior.

- [ ] **Step 7: Confirm header badges**

Declare a second major and 1-2 minors again on any primary major.
Expected: small pills reading "2nd Major: <name>" and "Minor: <name>" appear beneath the batch badge in the header, next to the major dropdown.

- [ ] **Step 8: If any step above doesn't match, fix forward**

If a visual or logic issue is found, fix it directly in the relevant file from Tasks 1-10, re-run `npm run build`, and commit with a `fix:`-style message describing what was wrong.
