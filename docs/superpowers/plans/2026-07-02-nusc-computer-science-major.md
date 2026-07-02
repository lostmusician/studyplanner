# NUS College Computer Science Major Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mixed-up `computer-science.json` major with a dedicated `computer-science-nusc.json` major that has accurate, category-grouped requirements matching the real NUS College + SoC Computer Science curriculum.

**Architecture:** Two independent changes. (1) Extend the requirements-checklist rendering path (`RequirementRule` → `computeRequirements` → `RequirementsChecklist`) to carry an optional `categoryId` so requirement rows can be grouped and headed by category, with graceful fallback for rows that don't set one. (2) Replace the `computer-science.json` data file with `computer-science-nusc.json`, populated with the 6-category structure and 9-row requirements list from the approved spec.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind. No test runner is configured in this repo — verification is `tsc --noEmit` plus manual checks against the running dev server (screenshot + console-error check), which is how prior changes in this codebase have been verified.

## Global Constraints

- Scope is the NUS College (NUSC) track only. Do not create or modify a standard/non-NUSC `computer-science.json` — that's a separate future task (spec: "Scope").
- Do not add Focus Area or Industry Experience module data. The `breadth-depth` category stays empty (spec: "Scope", "Categories").
- Do not fix `CS1231` → `CS1231S`. Carry the code forward as-is (spec: "Open questions / explicitly deferred").
- `RequirementRule.categoryId` must be optional (`categoryId?: string`), not required — `computer-science.json`'s existing (pre-Task-2) requirements have no `categoryId`, and the type must not break their compilation via `as`-cast JSON imports (spec: "Schema changes").
- New major file: `id: "computer-science-nusc"`, `label: "Computer Science (NUS College)"`, `specialisation` unchanged (spec: "File plan").

---

### Task 1: Group the requirements checklist by category

**Files:**
- Modify: `shared/types.ts:16-23`
- Modify: `src/lib/studyPlan.ts:41-52`
- Modify: `src/components/RequirementsChecklist.tsx` (full rewrite)
- Modify: `src/components/StudyPlan.tsx:122`

**Interfaces:**
- Consumes: existing `Major`, `MajorCategory` (`shared/types.ts`), existing `computeRequirements(major, semesters)` call site in `src/hooks/useStudyPlan.ts:72` (unchanged — still called the same way, return shape just grows one optional field).
- Produces: `RequirementRule.categoryId?: string`; `computeRequirements` return type becomes `Array<{ name: string; fulfilled: boolean; categoryId?: string }>`; `RequirementsChecklist` now requires a `categories: MajorCategory[]` prop in addition to its existing `requirements` prop.

- [ ] **Step 1: Add `categoryId` to `RequirementRule`**

In `shared/types.ts`, replace:

```ts
export interface RequirementRule {
  name: string;
  /** Module codes that satisfy this requirement. An entry ending in "*" matches by prefix
   * (e.g. "NTW*" matches any NTW-coded section); other entries match exactly. */
  fulfilledBy: string[];
  /** Number of distinct matching modules needed to satisfy this requirement. Defaults to 1. */
  count?: number;
}
```

with:

```ts
export interface RequirementRule {
  name: string;
  /** Module codes that satisfy this requirement. An entry ending in "*" matches by prefix
   * (e.g. "NTW*" matches any NTW-coded section); other entries match exactly. */
  fulfilledBy: string[];
  /** Number of distinct matching modules needed to satisfy this requirement. Defaults to 1. */
  count?: number;
  /** Groups this requirement under a MajorCategory (by id) in the requirements checklist.
   * Rows without one are rendered under a fallback "Other" group. */
  categoryId?: string;
}
```

- [ ] **Step 2: Thread `categoryId` through `computeRequirements`**

In `src/lib/studyPlan.ts`, replace:

```ts
export const computeRequirements = (
  major: Major,
  semesters: StudentSemester[],
): Array<{ name: string; fulfilled: boolean }> => {
  const allCodes = Array.from(new Set(semesters.flatMap((s) => s.modules.map((m) => m.code))));
  return major.requirements.map((req) => {
    const matchCount = allCodes.filter((code) =>
      req.fulfilledBy.some((fulfiller) => matchesFulfiller(code, fulfiller)),
    ).length;
    return { name: req.name, fulfilled: matchCount >= (req.count ?? 1) };
  });
};
```

with:

```ts
export const computeRequirements = (
  major: Major,
  semesters: StudentSemester[],
): Array<{ name: string; fulfilled: boolean; categoryId?: string }> => {
  const allCodes = Array.from(new Set(semesters.flatMap((s) => s.modules.map((m) => m.code))));
  return major.requirements.map((req) => {
    const matchCount = allCodes.filter((code) =>
      req.fulfilledBy.some((fulfiller) => matchesFulfiller(code, fulfiller)),
    ).length;
    return { name: req.name, fulfilled: matchCount >= (req.count ?? 1), categoryId: req.categoryId };
  });
};
```

- [ ] **Step 3: Rewrite `RequirementsChecklist` to render grouped sections**

Replace the full contents of `src/components/RequirementsChecklist.tsx` with:

```tsx
import type { MajorCategory } from '@shared/types';

interface Requirement {
  name: string;
  fulfilled: boolean;
  categoryId?: string;
}

interface Props {
  requirements: Requirement[];
  categories: MajorCategory[];
}

interface Group {
  id: string;
  label: string;
  items: Requirement[];
}

export const RequirementsChecklist = ({ requirements, categories }: Props) => {
  const fulfilled = requirements.filter((r) => r.fulfilled).length;

  const groups: Group[] = categories
    .map((cat) => ({
      id: cat.id,
      label: cat.label,
      items: requirements.filter((r) => r.categoryId === cat.id),
    }))
    .filter((g) => g.items.length > 0);

  const uncategorized = requirements.filter((r) => !r.categoryId);
  if (uncategorized.length > 0) {
    groups.push({ id: 'uncategorized', label: 'Other', items: uncategorized });
  }

  return (
    <div className="rounded-4xl bg-paper p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-ink text-sm">Requirements</h2>
        <span className="text-xs text-muted">
          {fulfilled}/{requirements.length}
        </span>
      </div>

      {requirements.length === 0 && (
        <p className="text-xs text-muted">No requirements defined for this major.</p>
      )}

      <div className="flex flex-col gap-5">
        {groups.map((group) => (
          <div key={group.id} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wide text-muted">{group.label}</p>
              <span className="text-[10px] text-muted">
                {group.items.filter((r) => r.fulfilled).length}/{group.items.length}
              </span>
            </div>
            <ul className="flex flex-col gap-2">
              {group.items.map((req) => (
                <RequirementRow key={req.name} req={req} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

const RequirementRow = ({ req }: { req: Requirement }) => (
  <li className="flex items-start gap-2.5">
    <span
      className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px]"
      style={{
        backgroundColor: req.fulfilled ? 'rgb(20,20,19)' : 'transparent',
        border: req.fulfilled ? 'none' : '1.5px solid rgb(108,107,104)',
      }}
    >
      {req.fulfilled && (
        <svg
          viewBox="0 0 10 8"
          fill="none"
          stroke="rgb(239,238,231)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-2.5 h-2"
        >
          <path d="M1 4l2.5 2.5L9 1" />
        </svg>
      )}
    </span>
    <span
      className="text-xs leading-relaxed"
      style={{ color: req.fulfilled ? 'rgb(20,20,19)' : 'rgb(108,107,104)' }}
    >
      {req.name}
    </span>
  </li>
);
```

- [ ] **Step 4: Pass `categories` into `RequirementsChecklist` from `StudyPlan`**

In `src/components/StudyPlan.tsx`, replace:

```tsx
          <RequirementsChecklist requirements={requirements} />
```

with:

```tsx
          <RequirementsChecklist requirements={requirements} categories={major.categories} />
```

- [ ] **Step 5: Type-check**

Run: `cd D:\dev\studyplanner && npx tsc --noEmit`
Expected: no output (exit code 0).

- [ ] **Step 6: Manually verify against the still-unmodified `computer-science.json`**

At this point `shared/data/majors/computer-science.json` still has 10 requirement rows, none with `categoryId` set — this step confirms the new grouping code degrades gracefully (all 10 rows render under a single "Other" section) before Task 2 replaces the data file.

Run: `npm run dev` (if not already running) from `D:\dev\studyplanner`, then open `http://localhost:5173` in a browser (or via the `claude-in-chrome` tools) and check:
- The right sidebar shows one section labeled "Other" containing all 10 requirement rows, with a per-group "n/10" count matching the overall "n/10" header count.
- No console errors.
- The 4 pre-existing checked rows (Digital Literacy, Computing Ethics, Writing, Data Literacy) are still shown as fulfilled (matches the default-plan-seeded modules).

- [ ] **Step 7: Commit**

```bash
git add shared/types.ts src/lib/studyPlan.ts src/components/RequirementsChecklist.tsx src/components/StudyPlan.tsx
git commit -m "Group requirements checklist by category

RequirementRule gains an optional categoryId; rows without one fall
back to an Other section so this is backward compatible with
existing major data."
```

---

### Task 2: Replace `computer-science.json` with the NUS College major data

**Files:**
- Delete: `shared/data/majors/computer-science.json`
- Create: `shared/data/majors/computer-science-nusc.json`

**Interfaces:**
- Consumes: `Major`, `MajorCategory`, `RequirementRule`, `DefaultPlanEntry`, `Module` shapes from `shared/types.ts` (as modified in Task 1 — `categoryId` now available on `RequirementRule`).
- Produces: nothing consumed by later tasks — this is the last task in the plan.

**Note on `CS2102`:** the existing `computer-science.json` has `CS2102` (Database Systems) tagged under the old `primary-major` category, but it is not one of the 9 official CS Foundation courses (`CS1231(S)`, `CS2030S`, `CS2040S`, `CS2100`, `CS2101`, `CS2103T`, `CS2106`, `CS2109S`, `CS3230` — spec: "Categories" table). Since `breadth-depth` is explicitly out of scope and stays empty (Global Constraints), `CS2102` has no valid category to go in. It is dropped from both `moduleCatalog` and `defaultPlan` in the new file. Without it, `cs-foundation`'s default-plan modules sum to exactly 36 MC (9 courses × 4 MC), matching its target exactly.

**Note on `NTW2035`'s title:** the spec's "Data changes" section says `moduleCatalog` needs no changes beyond carrying entries forward, but the existing entry's title ("Writing and Critical Thinking in the Sciences") doesn't match the module's real current NUSMods title. Since this exact code/title pair was already looked up against the live NUSMods API earlier in this project's research (confirmed: `NTW2035 — Art and the Attention Economy`), the title below uses the verified current value rather than propagating a stale one. This is a one-line, low-risk factual correction, not a scope change.

- [ ] **Step 1: Delete the old major file**

```bash
git rm shared/data/majors/computer-science.json
```

- [ ] **Step 2: Create the new major file**

Create `shared/data/majors/computer-science-nusc.json`:

```json
{
  "id": "computer-science-nusc",
  "label": "Computer Science (NUS College)",
  "school": "School of Computing",
  "specialisation": "Networking and Distributed Systems",
  "totalMcTarget": 160,
  "categories": [
    { "id": "cs-foundation", "label": "CS Foundation", "mcTarget": 36, "color": "#d4c9b8" },
    { "id": "breadth-depth", "label": "Breadth & Depth (Focus Area)", "mcTarget": 32, "color": "#c9d4b8" },
    { "id": "math-sciences", "label": "Math & Sciences", "mcTarget": 12, "color": "#c6d0ca" },
    { "id": "soc-common", "label": "SoC Common Curriculum", "mcTarget": 8, "color": "#abb89b" },
    { "id": "nus-college", "label": "NUS College", "mcTarget": 52, "color": "#b8c9d4" },
    { "id": "unrestricted-electives", "label": "Unrestricted Electives", "mcTarget": 20, "color": "#c3bace" }
  ],
  "requirements": [
    { "name": "Programming Methodology (CS1101S)", "fulfilledBy": ["CS1101S"], "categoryId": "soc-common" },
    { "name": "Digital and AI Ethics (IS1108)", "fulfilledBy": ["IS1108"], "categoryId": "soc-common" },
    { "name": "Thinking with Writing (NTW)", "fulfilledBy": ["NTW*"], "categoryId": "nus-college" },
    { "name": "Understanding the Social World (NSW)", "fulfilledBy": ["NSW*"], "categoryId": "nus-college" },
    { "name": "Reasoning with Data (GEA1000N)", "fulfilledBy": ["GEA1000N"], "categoryId": "nus-college" },
    { "name": "Global Narratives (NGN)", "fulfilledBy": ["NGN*"], "categoryId": "nus-college" },
    { "name": "Science and Society (NSS)", "fulfilledBy": ["NSS*"], "categoryId": "nus-college" },
    { "name": "Making Connections", "fulfilledBy": ["NHS*", "NFB*", "NST*", "NFC*", "NHT*"], "count": 6, "categoryId": "nus-college" },
    { "name": "Impact Experience Project (NEP)", "fulfilledBy": ["NEP*"], "categoryId": "nus-college" }
  ],
  "moduleCatalog": {
    "CS1101S": { "code": "CS1101S", "name": "Programming Methodology", "mcs": 4 },
    "CS1231": { "code": "CS1231", "name": "Discrete Structures", "mcs": 4 },
    "CS2030S": { "code": "CS2030S", "name": "Programming Methodology II", "mcs": 4 },
    "CS2040S": { "code": "CS2040S", "name": "Data Structures and Algorithms", "mcs": 4 },
    "CS2100": { "code": "CS2100", "name": "Computer Organisation", "mcs": 4 },
    "CS2101": { "code": "CS2101", "name": "Effective Communication for Computing Professionals", "mcs": 4 },
    "CS2103T": { "code": "CS2103T", "name": "Software Engineering", "mcs": 4 },
    "CS2106": { "code": "CS2106", "name": "Introduction to Operating Systems", "mcs": 4 },
    "CS2109S": { "code": "CS2109S", "name": "Introduction to AI and Machine Learning", "mcs": 4 },
    "CS3230": { "code": "CS3230", "name": "Design and Analysis of Algorithms", "mcs": 4 },
    "ST2334": { "code": "ST2334", "name": "Probability and Statistics", "mcs": 4 },
    "MA1521": { "code": "MA1521", "name": "Calculus for Computing", "mcs": 4 },
    "MA1522": { "code": "MA1522", "name": "Linear Algebra for Computing", "mcs": 4 },
    "NTW2035": { "code": "NTW2035", "name": "Art and the Attention Economy", "mcs": 4 },
    "GEA1000N": { "code": "GEA1000N", "name": "Quantitative Reasoning with Data", "mcs": 4 },
    "IS1108": { "code": "IS1108", "name": "Digital and AI Ethics", "mcs": 4 }
  },
  "defaultPlan": [
    { "year": 1, "sem": 1, "moduleCode": "CS1101S", "categoryId": "soc-common" },
    { "year": 1, "sem": 1, "moduleCode": "CS1231", "categoryId": "cs-foundation" },
    { "year": 1, "sem": 1, "moduleCode": "MA1521", "categoryId": "math-sciences" },
    { "year": 1, "sem": 2, "moduleCode": "CS2030S", "categoryId": "cs-foundation" },
    { "year": 1, "sem": 2, "moduleCode": "CS2040S", "categoryId": "cs-foundation" },
    { "year": 1, "sem": 2, "moduleCode": "MA1522", "categoryId": "math-sciences" },
    { "year": 1, "sem": 2, "moduleCode": "NTW2035", "categoryId": "nus-college" },
    { "year": 2, "sem": 1, "moduleCode": "CS2100", "categoryId": "cs-foundation" },
    { "year": 2, "sem": 1, "moduleCode": "ST2334", "categoryId": "math-sciences" },
    { "year": 2, "sem": 1, "moduleCode": "GEA1000N", "categoryId": "nus-college" },
    { "year": 2, "sem": 2, "moduleCode": "CS2103T", "categoryId": "cs-foundation" },
    { "year": 2, "sem": 2, "moduleCode": "CS2101", "categoryId": "cs-foundation" },
    { "year": 2, "sem": 2, "moduleCode": "CS2106", "categoryId": "cs-foundation" },
    { "year": 3, "sem": 1, "moduleCode": "CS2109S", "categoryId": "cs-foundation" },
    { "year": 3, "sem": 1, "moduleCode": "CS3230", "categoryId": "cs-foundation" },
    { "year": 3, "sem": 1, "moduleCode": "IS1108", "categoryId": "soc-common" }
  ]
}
```

- [ ] **Step 3: Validate JSON syntax**

Run: `node -e "JSON.parse(require('fs').readFileSync('D:/dev/studyplanner/shared/data/majors/computer-science-nusc.json', 'utf8')); console.log('valid JSON')"`
Expected: `valid JSON`

- [ ] **Step 4: Type-check**

Run: `cd D:\dev\studyplanner && npx tsc --noEmit`
Expected: no output (exit code 0).

- [ ] **Step 5: Manually verify in the running app**

Vite's dev server (`npm run dev`, already running from Task 1) auto-reloads on file changes — no restart needed. Reload `http://localhost:5173` (or navigate again via `claude-in-chrome`) and check:
- Header shows major label "Computer Science (NUS College)".
- Stats bar shows 6 category cards: CS Foundation (36/36), Breadth & Depth (Focus Area) (0/32), Math & Sciences (12/12), SoC Common Curriculum (8/8), NUS College (8/52), Unrestricted Electives (0/20). Total MCs 64/160.
- Semester grid shows the 16 default-plan modules across Y1S1–Y3S1, with no module in a "Primary Major" or "SOC/NUSC" category (those ids no longer exist).
- Requirements sidebar shows 3 sections: "SoC Common Curriculum" (2/2 — Programming Methodology and Digital and AI Ethics both fulfilled from the default plan), "NUS College" (2/7 — Thinking with Writing and Reasoning with Data fulfilled via `NTW2035`/`GEA1000N`, the other 5 unfulfilled), no "Other" section (every row now has a `categoryId`). Overall count "4/9".
- No console errors.
- Because `localStorage` caches the previously-seeded plan under `studyplan:computer-science` (the *old* major id), and this is a brand new major id `computer-science-nusc`, there is no stale-cache collision — the app seeds fresh from `defaultPlanToSemesters` on first load of the new major. Confirm this by checking browser localStorage has a new `studyplan:computer-science-nusc` key after load (via `javascript_tool` or dev tools), not reused old data.

- [ ] **Step 6: Commit**

```bash
git add shared/data/majors/computer-science-nusc.json
git commit -m "Replace computer-science major with NUS College track

New computer-science-nusc.json models the real curriculum per
docs/superpowers/specs/2026-07-02-nusc-computer-science-major-design.md:
6 MC categories (CS Foundation, Breadth & Depth, Math & Sciences, SoC
Common Curriculum, NUS College, Unrestricted Electives) and 9
category-tagged requirement rows covering all NUS College course
obligations plus the two SoC Common Curriculum courses."
```

---

## Post-plan follow-ups (not part of this plan)

- Standard (non-NUSC) `computer-science.json` — separate task.
- Focus Area module research to populate `breadth-depth`.
- `CS1231` → `CS1231S` code correction.
- Verifying the exact `nus-college` MC target (52 vs 56) against a real degree audit.
