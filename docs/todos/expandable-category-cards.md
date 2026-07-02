# TODO (for Codex): Fold the Requirements checklist into expandable category cards

**Branch:** `feature/nusc-cs-major` (work here; it's already checked out).
**Status:** design agreed, not yet implemented. This doc is self-contained — you do not need any prior chat history.

---

## 1. What this app is (30-second orientation)

A client-only React 19 + TypeScript + Vite study planner (NUS School of Computing).
No backend, no database — student plans persist to `localStorage`. It's a dual-app
monorepo; **you only touch the student app at the repo root** (`src/`, `shared/`),
not `admin/`.

Run it: `npm run dev` → http://localhost:5173 (Vite; port may bump to 5174 if taken).
There is **no test framework**. Verification is:
- `npx tsc --noEmit` from the repo root (must exit 0, no output), and
- a manual browser check (load the app, confirm the UI + no console errors).

Windows machine. Match the existing Tailwind style (palette tokens `ink`, `canvas`,
`paper`, `muted`; rounded cards; per-category `color`).

---

## 2. Goal

Today the same per-category information lives in two places:
- **Top stats bar** — one MC card per category (e.g. "CS Foundation 36/36"). Component: `src/components/StatsSummary.tsx`.
- **Right sidebar** — a "Requirements" checklist grouped by category. Component: `src/components/RequirementsChecklist.tsx`.

Merge them. **Remove the right sidebar entirely** and make each **top category card
clickable → it expands to show, for that category, what is done and what is still
missing.** The freed-up sidebar width goes to the semester grid.

---

## 3. Current state — files & data flow (all paths are real, read them first)

- `shared/types.ts` — data model. Relevant types:
  - `MajorCategory { id: string; label: string; mcTarget?: number; color: string }`
  - `RequirementRule { name: string; fulfilledBy: string[]; count?: number; categoryId?: string }`
    (`fulfilledBy` entries ending in `*` are prefix matches, e.g. `"NTW*"`; `count` is how many distinct matches are needed, default 1.)
  - `Major { …; categories: MajorCategory[]; requirements: RequirementRule[]; moduleCatalog: Record<string, Module>; defaultPlan: DefaultPlanEntry[] }`
  - `DefaultPlanEntry { year; sem; moduleCode; categoryId }`
  - `PlacedModule extends Module { categoryId: string }`; `StudentSemester { year; sem; modules: PlacedModule[] }`
- `src/lib/studyPlan.ts` — pure logic:
  - `computeStats(major, semesters): { totalMc, byCategory: Record<categoryId, number> }` — MC placed per category.
  - `computeRequirements(major, semesters): Array<{ name; fulfilled; categoryId? }>` — one entry per requirement rule.
  - `matchesFulfiller(moduleCode, fulfiller)` — the `*`-prefix/exact matcher (currently module-private; export it if you reuse it).
- `src/hooks/useStudyPlan.ts` — supplies `major`, `semesters`, `stats`, `requirements` (and mutators) to `StudyPlan`.
- `src/components/StudyPlan.tsx` — layout. The stats bar renders `<StatsSummary major={major} stats={stats} />`; the right `<aside className="w-64 …">` renders `<RequirementsChecklist requirements={requirements} categories={major.categories} />` (see lines ~99–124).
- `src/components/StatsSummary.tsx` — `StatsSummary({ major, stats })` maps `major.categories` to `StatCard({ label, value, target, color })` (a Total-MCs card plus one per category) in a `flex flex-wrap gap-3` row.
- `src/components/RequirementsChecklist.tsx` — groups requirement rows by `categoryId`, renders a checkmark row per requirement, with an "Other" fallback group for rows whose `categoryId` is absent or unknown. **Salvage its row markup** (the circle-with-check `RequirementRow`) for the expanded panel, then delete or repurpose the file.

The live major data is `shared/data/majors/computer-science-nusc.json`
(6 categories: `cs-foundation` 36, `breadth-depth` 32 (empty), `math-sciences` 12,
`soc-common` 8, `nus-college` 52, `unrestricted-electives` 20; 9 requirement rows
each tagged with a `categoryId`; a `defaultPlan` seeding foundation/math/common courses).

---

## 4. Design to implement

### 4a. Expanded content — three cases, resolved by priority

For the clicked category, compute (all data is already available from `major` + `semesters`):
- **named requirements** = `computeRequirements(...)` filtered to `categoryId === cat.id`.
- **expected modules** = `major.defaultPlan` entries with `categoryId === cat.id`, resolved through `major.moduleCatalog`. (For `cs-foundation` this is the 9 required courses; for `math-sciences` the 3; empty for `breadth-depth`/`unrestricted-electives`.)
- **placed modules** = modules across all `semesters` whose `categoryId === cat.id`.
- **placed MC / target** = `stats.byCategory[cat.id] ?? 0` and `cat.mcTarget`.

Render the expanded panel by this priority:
1. **Has named requirements** (`soc-common`, `nus-college`) → list each requirement with a ✓ (fulfilled) / ○ (not) marker. For a rule with `count > 1` (e.g. "Making Connections", needs 6), show progress **"have/need"** e.g. `2/6` — see 4b, this needs a small logic change.
2. **Else has expected modules** (`cs-foundation`, `math-sciences`) → list each expected module with ✓ if it appears in placed modules, ○ if missing. This is what lets an empty plan show "○ CS2100 — not yet added".
3. **Else** (`breadth-depth`, `unrestricted-electives`) → list placed modules (if any) and show "X MC remaining to target" (`mcTarget - placed`, floored at 0). If none placed, a short empty hint.

### 4b. Required logic change — expose per-requirement progress counts

`computeRequirements` currently returns only a boolean `fulfilled`, so the UI cannot
show "2/6". Extend it to also return the match count and target:

```ts
// in src/lib/studyPlan.ts, computeRequirements(...) map:
const matchCount = allCodes.filter((code) =>
  req.fulfilledBy.some((f) => matchesFulfiller(code, f)),
).length;
const need = req.count ?? 1;
return { name: req.name, fulfilled: matchCount >= need, categoryId: req.categoryId, have: matchCount, need };
```

Widen the return type accordingly and update the `StudyPlan` prop type
(`src/components/StudyPlan.tsx`) and any consumer to include `have: number; need: number`.
Only show the `have/need` badge when `need > 1` (binary rows stay as plain ✓/○).

### 4c. Interaction & layout

- Track one open category at a time: `const [openId, setOpenId] = useState<string | null>(null)` in the stats component; clicking a card toggles it (click again = collapse, click another = switch). Total-MCs card is not expandable.
- Render the expanded panel **full-width directly below the cards row** (not inside the wrapped flex, which would reflow badly). Give the open card a visible selected state (e.g. outline/ring in its category color).
- In `StudyPlan.tsx`: delete the right `<aside>` + its `RequirementsChecklist` usage; the main content becomes a single full-width column (`SemesterGrid` + `AddModuleForm`). Keep the `stats` bar container.
- `useStudyPlan` already returns `requirements` and `semesters`; pass whatever the expandable component needs (it needs at least `major`, `stats`, `semesters`, and `requirements`). `StatsSummary` currently does **not** receive `semesters` or `requirements` — thread them in.

Keep accessibility basic-sane: the card is a `<button>`, `aria-expanded`, panel toggles on click.

---

## 5. Constraints

- Student app only (repo root). Do **not** modify `admin/`.
- No new dependencies. Plain React state + Tailwind.
- `breadth-depth` legitimately has 0 modules — its expanded panel is the "case 3" empty/remaining view; that's correct, not a bug.
- Don't change the major JSON or the category set. This is a UI/logic change only, except the `computeRequirements` extension in 4b.
- Preserve the existing visual language (colors per category, rounded cards, ink/canvas/paper palette).

## 6. Verification (do all three before calling it done)

1. `npx tsc --noEmit` → clean.
2. `npm run dev`, load http://localhost:5173, and check:
   - Right "Requirements" sidebar is gone; semester grid spans full width.
   - Clicking "NUS College" expands to the 7 requirement rows, "Making Connections" shows `0/6` (or current progress); clicking again collapses.
   - Clicking "CS Foundation" expands to the 9 courses, all ✓ on the default plan.
   - Clicking "Unrestricted Electives" shows the remaining-MC view.
   - No console errors.
3. Commit with a clear message. (Do not push unless asked.)

## 7. Open decisions (pick a default, note what you chose)

- **D1 — expanded panel placement:** below-the-row full-width panel (recommended, above) vs. inline card growth. If below-row is awkward with the current max-width container, a single panel spanning the stats container is fine. Choose one; don't build both.
- **D2 — keep `RequirementsChecklist.tsx`?** Recommended: extract its `RequirementRow` visual into the new panel and delete the old file. If deleting causes churn, leaving it unused is acceptable but note it.
- **D3 — "have/need" display:** show only when `need > 1`. If you find a cleaner treatment (e.g. always show a small count), that's fine — keep it subtle.
