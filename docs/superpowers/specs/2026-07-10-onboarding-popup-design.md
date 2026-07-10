# First-run onboarding popup — design

## Context

`useStudyPlan.ts` currently hardcodes `DEFAULT_MAJOR_ID = 'computer-science-nusc'` for any
visitor with no saved plan, and immediately fills the grid with CS's full `defaultPlan` (19
modules, 68/160 MC). There's no detection of "is this actually a new user" anywhere, and no
major-selection prompt — a non-CS student's first impression is a grid full of someone else's
modules they have to notice and clear out via Settings.

This spec adds a blocking first-run popup that asks a new visitor which major they're in, and
whether to start from the major's example plan or from (nearly) scratch.

## Trigger & persistence

A dedicated flag, `localStorage['studyplan:onboarded'] = 'true'`, checked once on app load:

- **Not set + no existing saved plan anywhere** (a genuinely new visitor): show the popup.
- **Not set + at least one `studyplan:<majorId>` key already exists** (an existing user from
  before this feature shipped): show the popup too, but with an extra escape hatch in step 2 (see
  below) so their real data is never silently overwritten.
- **Set**: never show it again, full stop.

The flag is set the moment the popup is completed (any of the three step-2 outcomes), so it never
reappears.

## Flow

**Step 1 — "Which major?"**: a list of the 5 majors as clickable cards (label + school), not a
`<select>` — this is the first thing a new visitor sees, so it gets a more inviting layout than
the existing Settings dropdown. Nothing is pre-selected; "Next" stays disabled until a major is
picked, so nobody proceeds on a default they didn't consciously choose.

**Step 2 — "How do you want to start?"**:
- **"Use the example plan"** — pre-fills the chosen major's full `defaultPlan` (today's existing
  behavior).
- **"Start from scratch"** — pre-fills only the entries with `locked: true` (the compulsory NEP
  Impact Experience Project rows already marked that way in the data), everything else blank.
- **"Keep my current plan"** — shown ONLY when the user already has at least one saved plan
  (the migration case above). Ignores whatever was picked in step 1 entirely, sets the
  `onboarded` flag, and closes without touching any existing `semesters`/`waivedModules` — the
  safe default for anyone with real data. (It's a little odd that step 1 is shown at all if this
  is chosen — that's an accepted, deliberately simple tradeoff for keeping one flow instead of
  branching the whole wizard by user type.)

A "← Back" link on step 2 returns to step 1 to change major. The popup is **not** dismissible —
no Escape, no backdrop-click, no skip link — matching the earlier decision that every path through
it (including "keep my current plan") is an explicit, safe choice.

## Integration points

- **Share-link import takes priority.** If `App.tsx` has a `pendingImport` (someone opened a
  share/review link), the onboarding popup is suppressed — the import modal already fully
  determines major + plan, so onboarding would be redundant. Completing an import or entering
  review mode also sets the `onboarded` flag, so the popup never appears afterward for that
  browser.
- **New pure function** in `src/lib/studyPlan.ts`: `defaultPlanToSemesters` gains an optional
  filter so "start from scratch" can reuse the same placement logic instead of duplicating it —
  e.g. `defaultPlanToSemesters(major, { lockedOnly?: boolean })`. Exact signature is an
  implementation-plan detail, not fixed here.
- **New component**: `src/components/OnboardingModal.tsx` — the two-step UI, following the
  existing modal chrome conventions (`fixed inset-0`, `rounded-4xl bg-paper`, `ink`/`canvas`
  tokens) but with no close/Escape handling, unlike `FocusAreaExplorer`/`ProgrammeElectivesExplorer`.
- **New state/logic**: lives in `useStudyPlan.ts` alongside the other plan-setup state (or a small
  co-located hook if `useStudyPlan.ts` is getting crowded — implementation-plan call). Exposes
  something like `needsOnboarding: boolean`, `hasExistingPlan: boolean` (drives whether step 2
  shows 2 or 3 options), and `completeOnboarding(majorId, mode: 'example' | 'scratch' | 'keep')`.

## Testing

Per this project's existing convention, only the pure logic layer gets unit tests:
`defaultPlanToSemesters`'s new filter behavior (locked-only vs. full plan) in
`src/lib/studyPlan.test.ts`. The modal itself and the trigger/flag logic are verified manually in
the browser — new-user flow (no existing plan), existing-user flow (has a saved plan, confirm
"keep my current plan" leaves it untouched), and the share-import-suppresses-onboarding case.

## Out of scope

- Any visual mockup/wireframe beyond the text description above.
- Changing what "the example plan" contains, or which entries are `locked` — reuses existing data
  as-is.
- A way to re-trigger onboarding later (e.g. from Settings) — not requested.
