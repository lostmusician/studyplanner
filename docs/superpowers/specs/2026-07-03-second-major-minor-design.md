# Second major & minors — design

## Context

The planner currently supports exactly one degree programme per student: a
`Major` (`shared/types.ts:79`), selected via a single dropdown, with a single
`StudentPlan` (`majorId` + `semesters` + `waivedModules`) persisted to
localStorage under `studyplan:${majorId}`. There is no existing code for a
second major, minor, or double major (confirmed by full-codebase search).

NUS allows a student to additionally declare **one Second Major** and **up
to three Minors** alongside their primary major, each with its own
requirement list, subject to double-counting caps between programmes. This
spec adds the ability to declare these and see live auto-computed
completion status, reusing the app's existing requirement-checking engine
wherever possible.

## Scope

**In scope:**
- A new lean `SecondaryProgramme` data type + JSON files for 7 second
  majors and 9 minors (list below).
- Declaring at most 1 second major and at most 3 minors per plan.
- Auto-computed requirement checklists per declared programme, reusing
  `computeRequirements`.
- An informational (non-blocking) double-counting overlap warning per
  declared programme, plus a triple-counting warning.
- UI: Settings-page selectors, header badges, per-programme checklist
  panels.

**Out of scope (deferred):**
- Any second major/minor `defaultPlan` (auto-placement into semesters).
  Programmes here are a requirements checklist only; the student manually
  places modules into their existing semester grid.
- Per-category MC progress bars for secondary programmes (no `categories`
  field — see Data model).
- Hard-coded eligibility restrictions between a specific primary major and
  a specific second major/minor. NUS's exact "Prohibited Combinations"
  list per major/minor pairing was not fully retrievable during research;
  rather than encode a guess, v1 leaves all 7/9 selectable regardless of
  primary major, with the same "approximate, verify against your own
  degree audit" caveat the existing major specs already carry.
- Full per-module curriculum research for every one of the 16 programmes.
  Math, Statistics (second major), and Business Analytics (minor) have
  confirmed module-level detail below; the remaining programmes' exact
  module lists are authored during implementation, one data file at a
  time, against their official department curriculum pages.
- SoC's own second-majors in CS/InfoSec/BA — confirmed explicitly closed to
  students already holding any of the app's 5 modeled majors, so they are
  not real options here.

## Programmes in scope

**Second majors** (all 40 MC, cohort 2021+; max 1 declared):
Mathematics, Statistics, Data Analytics, Economics, Psychology, Management,
Public Health.

**Minors** (all 20 MC, cohort 2019/20+; max 3 declared):
Mathematics, Statistics, Data Analytics, Economics, Psychology, Management,
Public Health, Quantitative Finance, Entrepreneurship.

Sources: comp.nus.edu.sg programme pages, NUS Registrar Double Major /
Minor Programmes policy pages, math.nus.edu.sg and stat.nus.edu.sg
curriculum pages, NUS Bulletin AY2023/24 (see citations gathered during
research; re-verify against live pages before each cohort's data is
authored, since NUS revises these roughly every 2-3 years).

### Confirmed module-level detail (for first data files authored)

**Second Major in Mathematics** (40 MC): 1000-level calculus (MA1102R/
MA2002 or MA1505/MA1507/MA1521 etc.), 2000-level (MA2101/S Linear Algebra
II, MA2104 Multivariable Calculus or MA2501, MA2108/S Mathematical Analysis
I, MA2216/MA2116/ST2131 Probability), 3+ modules from Lists III/IV at
3000-level (≥2 must be MA-coded, or ST3236/ST4238).

**Minor in Mathematics** (20 MC): 8 MC from MA1xxx/MA20xx (excl. MA1301/
MA1301X) + CS1231/S; 2 MA2xxx modules (excl. MA20xx) or ST2131; 1 MA3xxx+
module (excl. MA33xx) or ST3236/ST4238.

**Second Major in Statistics** (40 MC): ST1131 Introduction to Statistics,
linear algebra/calculus prerequisites, ST2132 Mathematical Statistics,
ST2137 Computer-Aided Data Analysis, 3 modules from ST3131/ST32xx/ST42xx +
1 more from ST32xx/ST42xx. Not open to students already majoring or
minoring in Statistics/Data Science &amp; Analytics.

**Minor in Business Analytics** (20 MC): Core (12 MC) — BT1101, BT2101,
CS1010S (or +4 MC elective if CS1010S is waived); Electives (8 MC) from
BT2102, BT3103, BT4014, BT4211, BT4212, BT4221, BT4222, BT4240, IS4241,
ST3131.

The remaining 5 second majors (Data Analytics, Economics, Psychology,
Management, Public Health) and 6 remaining minors (Data Analytics,
Economics, Psychology, Management, Public Health, Quantitative Finance,
Entrepreneurship) are confirmed to exist at the stated MC totals, but their
exact module lists are not yet researched to this level of detail — that
research happens per-file during implementation.

## Data model

New type in `shared/types.ts`, deliberately lean — no `school`, `batches`,
`defaultPlan`, `categories`, or `breadthDepth`, since secondary programmes
never own semester placement or a per-category MC bar, only get checked
against whatever the student has placed in their (primary-major-driven)
plan:

```ts
export interface SecondaryProgramme {
  id: string;
  label: string;
  kind: 'second-major' | 'minor';
  mcTarget: number;                 // 40 (second major) or 20 (minor)
  requirements: RequirementRule[];  // same shape as Major.requirements
  moduleCatalog: Record<string, Module>;
}
```

`mcTarget` has two uses: deriving the double-counting cap (see below) and
labelling the programme (e.g. "Statistics (Second Major · 40 MC)"). There
is no MC-completed progress bar for secondary programmes — unlike
`computeStats`, which sums `PlacedModule.mcs` by `categoryId`, secondary
programmes have no categories to sum by (per the Scope decision above), so
completion is communicated purely through the requirement checklist rows.

`StudentPlan` (`shared/types.ts:104`) gains two optional fields, bundled
into the same per-major localStorage blob (`studyplan:${majorId}`) — no new
storage plumbing, and consistent with the existing "switching primary major
resets your plan" behavior:

```ts
export interface StudentPlan {
  majorId: string;
  secondMajorId?: string;   // at most 1
  minorIds?: string[];      // at most 3
  semesters: StudentSemester[];
  waivedModules?: WaivedModule[];
  lastUpdated: string;
}
```

## File organization & loading

`shared/data/second-majors/*.json` and `shared/data/minors/*.json`, each
auto-registered via `import.meta.glob` exactly like
`shared/data/majors/*.json` today (`src/hooks/useStudyPlan.ts:16`) — adding
one programme is pure data authoring, no code changes, matching the
established major-registry pattern.

## Requirement checking

Reuses `computeRequirements` (`src/lib/studyPlan.ts:127`) unchanged in
behavior. Its `major` parameter's type loosens from `Major` to
`Pick<Major, 'requirements'>`, which `SecondaryProgramme` also structurally
satisfies — no wrapper function needed. Since every declared programme is
checked against the same shared `semesters` list, a module already placed
for the primary major automatically counts toward a minor's matching
requirement too, which is exactly the real "double counting" behavior, for
free.

## Double-counting overlap warning

New function in `src/lib/studyPlan.ts`, following the existing
`ConstraintStatus.warn` pattern (used today for the CP-cap / coding-prefix
checks in `computeBreadthDepth`) — informational only, never blocks
declaring a programme or marking a requirement complete:

```ts
export interface DoubleCountStatus {
  doubleCountMc: number;
  capMc: number;         // secondary.mcTarget * 0.4 (16 or 8 at standard sizes)
  warn: boolean;         // doubleCountMc > capMc
  doubleCountedCodes: string[];
}

export const computeDoubleCount = (
  primary: Major,
  secondary: SecondaryProgramme,
  semesters: StudentSemester[],
  waivedModules: WaivedModule[] = [],
): DoubleCountStatus => {
  // 1. Codes satisfying ≥1 requirement in `primary`.
  // 2. Codes satisfying ≥1 requirement in `secondary`.
  // 3. Intersect, sum MC via the plan's PlacedModule.mcs.
  // 4. capMc = secondary.mcTarget * 0.4; warn = doubleCountMc > capMc.
};
```

The cap is derived from `mcTarget` (NUS's rule is "40% of the programme's
MC requirement," which equals 16/8 only because second majors/minors are
standardized at 40/20 MC) rather than hard-coded, so it stays correct if a
future programme ever ships at a non-standard size.

**Triple-counting flag**: any code that double-counts against the primary
*and 2+* declared secondary programmes at once is called out as its own
separate warning line (NUS explicitly forbids triple counting), rather
than folded into either programme's double-count chip.

## UI/UX

**Declaring programmes** — extends the existing "Programme" section in
Settings (`src/components/StudyPlan.tsx:387-477`), directly below the major
dropdown:
- **Second Major**: single `<select>`, default "None", 7 options.
- **Minors**: togglable chips/checkboxes, 9 options; once 3 are checked,
  the rest disable.

**Header badges**: small pills next to the major label showing declared
programmes (e.g. "2nd Major: Statistics", "Minor: Math"), reusing the
visual pattern of the existing batch-indicator badge
(`docs/superpowers/specs/2026-07-02-batch-indicator-design.md`).

**Secondary requirements panels**: one collapsible card per declared
programme (second major + each minor), rendered below the primary
Requirements panel, reusing the existing checklist row component, scoped
to that programme's `requirements`. Each card shows its double-count chip
(e.g. "12/16 MC double-counted"), styled as a warning when `warn` is true.

## Testing / verification

The repo has no automated test framework (`package.json` scripts are only
`dev` / `build` / `preview`; `build` runs `tsc --noEmit` then `vite
build`). Verification for this feature is:
1. Type-check + build passing.
2. Manual browser testing: declare a second major and 2-3 minors, add
   overlapping and non-overlapping modules, confirm each programme's
   checklist rows update correctly, confirm the double-count warning chip
   flips at the 16/8 MC thresholds, confirm declarations reset correctly
   when switching the primary major.

## Judgment calls / open questions

- **Eligibility restrictions not enforced** — see Scope. A future pass
  could encode NUS's Prohibited Combinations list per major, if it can be
  reliably sourced.
- **"Max 3 minors" confirmed via a CHS/FASS orientation FAQ**, not a
  SoC-specific or university-Registrar-wide page. The mechanism (APAD
  declaration) is university-wide, so this is treated as reliable, but is
  worth a spot-check against a SoC-specific source if one surfaces later.
- **Remaining 11 programmes' exact module lists** are authored per-file
  during implementation, against official curriculum pages current as of
  authoring time — flagged for periodic re-verification, same caveat the
  existing major files carry.
