# First-run Onboarding Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a blocking first-run popup that asks a new visitor which major they're in and whether to start from that major's example plan or from (nearly) scratch, instead of silently defaulting everyone to Computer Science's fully pre-filled plan.

**Architecture:** A new `useOnboarding` hook owns the trigger flag and existing-plan detection. A new `OnboardingModal` component renders the two-step wizard. A new `applyOnboardingChoice` function on the existing `useStudyPlan` hook does the actual plan-building (reusing an extended `defaultPlanToSemesters`). `App.tsx` wires the three together and suppresses the popup during share-link import/review.

**Tech Stack:** React 19 + TypeScript 5.8, Vite 6, Tailwind (utility classes only, matching existing modal components), Vitest for the one piece of new pure logic.

## Global Constraints

- Windows machine. Verify every task with `npx tsc --noEmit` (must exit 0, no output) from the repo root.
- Only the pure logic layer gets unit tests (`src/lib/studyPlan.ts` here) — per this project's established convention, do NOT add component tests for `OnboardingModal.tsx` or hook tests for `useOnboarding.ts`/`useStudyPlan.ts`. Verify those manually in the browser (Task 6).
- No new dependencies.
- Match existing Tailwind style: palette tokens `ink`, `canvas`, `paper`, `muted`; rounded cards (`rounded-2xl`/`rounded-4xl`); modal chrome matches `FocusAreaExplorer.tsx`/`ProgrammeElectivesExplorer.tsx` (`fixed inset-0`, `bg-ink/40` overlay, `rounded-4xl bg-paper shadow-soft` panel) but with NO backdrop-click-to-close and NO Escape-to-close, since this modal must be non-dismissible per the design spec.
- Do not add AI attribution to commit messages.
- See `docs/superpowers/specs/2026-07-10-onboarding-popup-design.md` for the full design rationale — this plan implements it as written.

---

### Task 1: Extend `defaultPlanToSemesters` with a `lockedOnly` filter

**Files:**
- Modify: `src/lib/studyPlan.ts:17-27`
- Test: `src/lib/studyPlan.test.ts`

**Interfaces:**
- Consumes: nothing new (existing `Major`, `StudentSemester`, `createEmptySemesters` from the same file).
- Produces: `defaultPlanToSemesters(major: Major, options?: { lockedOnly?: boolean }): StudentSemester[]` — the second parameter is optional and defaults to `{}`, so the existing single-argument call site (`useStudyPlan.ts`'s `jsonDefaultPlan`) keeps working unchanged. Task 3 calls this with `{ lockedOnly: true }` for the "start from scratch" mode.

- [ ] **Step 1: Write the failing test**

Open `src/lib/studyPlan.test.ts`. Find the existing `describe('defaultPlanToSemesters', ...)` block (it currently has 3 tests: places modules per entry, skips unknown moduleCode, multiple entries in same semester). Add a new test at the end of that block, right before its closing `});`:

```ts
  it('with lockedOnly: true, places only entries marked locked', () => {
    const major: Major = {
      id: 'cs', label: 'CS', school: 'SoC', batches: [], totalMcTarget: 160,
      categories: [], requirements: [],
      moduleCatalog: {
        CS1101S: { code: 'CS1101S', name: 'Programming Methodology', mcs: 4 },
        NEP2001A: { code: 'NEP2001A', name: 'Impact Experience Project', mcs: 2 },
      },
      defaultPlan: [
        { year: 1, sem: 1, moduleCode: 'CS1101S', categoryId: 'soc-common' },
        { year: 1, sem: 2, moduleCode: 'NEP2001A', categoryId: 'nus-college', locked: true },
      ],
    };
    const result = defaultPlanToSemesters(major, { lockedOnly: true });
    const allCodes = result.flatMap((s) => s.modules.map((m) => m.code));
    expect(allCodes).toEqual(['NEP2001A']);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- studyPlan.test`
Expected: FAIL — TypeScript error, `defaultPlanToSemesters` doesn't accept a second argument yet (or, if TS is lenient about it, a runtime failure because the unfiltered function places both `CS1101S` and `NEP2001A`, so `allCodes` would be `['CS1101S', 'NEP2001A']`, not `['NEP2001A']`).

- [ ] **Step 3: Implement the filter**

In `src/lib/studyPlan.ts`, replace the existing `defaultPlanToSemesters`:

```ts
export const defaultPlanToSemesters = (
  major: Major,
  options: { lockedOnly?: boolean } = {},
): StudentSemester[] => {
  const semesters = createEmptySemesters();
  for (const entry of major.defaultPlan) {
    if (options.lockedOnly && !entry.locked) continue;
    const sem = semesters.find((s) => s.year === entry.year && s.sem === entry.sem);
    if (!sem) continue;
    const mod = major.moduleCatalog[entry.moduleCode];
    if (!mod) continue;
    sem.modules.push({ ...mod, categoryId: entry.categoryId });
  }
  return semesters;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- studyPlan.test`
Expected: all tests in the file pass, including the 3 pre-existing `defaultPlanToSemesters` tests (confirming the default `{}` argument didn't change existing behavior) and the new one.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean, no output.

- [ ] **Step 6: Commit**

```bash
git add src/lib/studyPlan.ts src/lib/studyPlan.test.ts
git commit -m "Add a lockedOnly filter to defaultPlanToSemesters"
```

---

### Task 2: Create the `useOnboarding` hook

**Files:**
- Create: `src/hooks/useOnboarding.ts`

**Interfaces:**
- Consumes: `Major` type from `@shared/types`.
- Produces: `useOnboarding(majors: Major[]): { needsOnboarding: boolean; hasExistingPlan: boolean; dismissOnboarding: () => void }`. Task 5 (`App.tsx`) calls this with `plan.majors` and uses all three fields.

- [ ] **Step 1: Create the hook**

Create `src/hooks/useOnboarding.ts`:

```ts
import { useState } from 'react';
import type { Major } from '@shared/types';

const ONBOARDED_KEY = 'studyplan:onboarded';
const planKey = (majorId: string) => `studyplan:${majorId}`;

const hasAnyExistingPlan = (majors: Major[]): boolean =>
  majors.some((major) => localStorage.getItem(planKey(major.id)) !== null);

export const useOnboarding = (majors: Major[]) => {
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean>(
    () => localStorage.getItem(ONBOARDED_KEY) !== 'true',
  );
  const [hasExistingPlan] = useState<boolean>(() => hasAnyExistingPlan(majors));

  const dismissOnboarding = () => {
    localStorage.setItem(ONBOARDED_KEY, 'true');
    setNeedsOnboarding(false);
  };

  return { needsOnboarding, hasExistingPlan, dismissOnboarding };
};
```

Note: both `useState` initializers are lazy (function form), so `localStorage`/`hasAnyExistingPlan` only run once on mount, not on every render — this matters because `majors` is a fresh array reference on every render of `useStudyPlan` (it calls `loadMajors()` unmemoized), but its contents are stable, so re-running the scan on every render would be wasted work, not a correctness issue either way.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean, no output. (This hook isn't imported anywhere yet — Task 5 wires it in — so this only confirms the file itself compiles.)

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useOnboarding.ts
git commit -m "Add useOnboarding hook for first-run trigger/persistence"
```

---

### Task 3: Add `applyOnboardingChoice` to `useStudyPlan`

**Files:**
- Modify: `src/hooks/useStudyPlan.ts`

**Interfaces:**
- Consumes: `defaultPlanToSemesters(major, { lockedOnly })` from Task 1; existing `setSemesters`/`setWaivedModules`/`setSecondMajorIdState`/`setMinorIds`/`setRequirementMappings`/`setNocDurationState`/`setMajorId`/`setPersonalMajorId`/`majors`/`normalizeWaivedModules` already in this file.
- Produces: `applyOnboardingChoice(majorId: string, mode: 'example' | 'scratch'): void`, added to the hook's returned object. Task 5 (`App.tsx`) calls this from the `OnboardingModal`'s `onChooseExample`/`onChooseScratch` callbacks.

- [ ] **Step 1: Add the function**

In `src/hooks/useStudyPlan.ts`, add this new `useCallback` immediately after the existing `switchMajor` callback (search for `const switchMajor = useCallback(` — add this right after its closing `);`):

```ts
  const applyOnboardingChoice = useCallback(
    (newMajorId: string, mode: 'example' | 'scratch') => {
      const newMajor = majors.find((m) => m.id === newMajorId);
      if (!newMajor) return;
      setSemesters(defaultPlanToSemesters(newMajor, { lockedOnly: mode === 'scratch' }));
      setWaivedModules(
        mode === 'example' ? normalizeWaivedModules(newMajor, newMajor.defaultWaivedModules) : [],
      );
      setSecondMajorIdState(null);
      setMinorIds([]);
      setRequirementMappings({});
      setNocDurationState(null);
      setMajorId(newMajorId);
      setPersonalMajorId(newMajorId);
    },
    [majors],
  );
```

This deliberately does NOT call `loadPlanForMajor` (which checks for an already-saved plan first) — onboarding's "example"/"scratch" choices always produce a fresh plan for the chosen mode, even if the picked major happens to already have some auto-saved data sitting under its `studyplan:<id>` key from earlier browsing.

- [ ] **Step 2: Export it from the hook's returned object**

Find the `return { ... }` object at the end of `useStudyPlan` (it currently ends with `getCompletedCodes: ...`). Add `applyOnboardingChoice,` to that object, e.g. right after `switchMajor,`:

```ts
    switchMajor,
    applyOnboardingChoice,
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean, no output.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useStudyPlan.ts
git commit -m "Add applyOnboardingChoice for the onboarding popup's example/scratch modes"
```

---

### Task 4: Create the `OnboardingModal` component

**Files:**
- Create: `src/components/OnboardingModal.tsx`

**Interfaces:**
- Consumes: `Major` type from `@shared/types`.
- Produces: `OnboardingModal({ majors, hasExistingPlan, onChooseExample, onChooseScratch, onKeepCurrent }): JSX.Element`, where `onChooseExample`/`onChooseScratch` are `(majorId: string) => void` and `onKeepCurrent` is `() => void`. Task 5 (`App.tsx`) renders this and wires all four props.

- [ ] **Step 1: Create the component**

Create `src/components/OnboardingModal.tsx`:

```tsx
import { useState } from 'react';
import type { Major } from '@shared/types';

interface Props {
  majors: Major[];
  hasExistingPlan: boolean;
  onChooseExample: (majorId: string) => void;
  onChooseScratch: (majorId: string) => void;
  onKeepCurrent: () => void;
}

type Step = 'major' | 'mode';

export const OnboardingModal = ({ majors, hasExistingPlan, onChooseExample, onChooseScratch, onKeepCurrent }: Props) => {
  const [step, setStep] = useState<Step>('major');
  const [selectedMajorId, setSelectedMajorId] = useState<string | null>(null);
  const selectedMajor = majors.find((m) => m.id === selectedMajorId) ?? null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome"
    >
      <div className="my-auto w-full max-w-lg rounded-4xl bg-paper p-6 shadow-soft">
        {step === 'major' ? (
          <>
            <h2 className="mb-1 text-base font-semibold text-ink">Welcome! Which major are you in?</h2>
            <p className="mb-5 text-[11px] leading-relaxed text-muted">
              This sets up your planner with the right requirements and categories.
            </p>
            <div className="flex flex-col gap-2">
              {majors.map((major) => (
                <button
                  key={major.id}
                  type="button"
                  onClick={() => setSelectedMajorId(major.id)}
                  className="rounded-2xl px-4 py-3 text-left transition-colors"
                  style={
                    selectedMajorId === major.id
                      ? { backgroundColor: 'rgb(20,20,19)', color: 'rgb(239,238,231)' }
                      : { backgroundColor: 'rgba(20,20,19,0.05)', color: 'rgb(20,20,19)' }
                  }
                >
                  <span className="block text-sm font-medium">{major.label}</span>
                  <span className="block text-[11px] opacity-70">{major.school}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={!selectedMajorId}
              onClick={() => setStep('mode')}
              className="mt-5 w-full rounded-2xl bg-ink px-4 py-2.5 text-sm font-medium text-canvas transition-opacity disabled:opacity-30"
            >
              Next
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setStep('major')}
              className="mb-3 text-xs font-medium text-muted hover:text-ink"
            >
              ← Back
            </button>
            <h2 className="mb-1 text-base font-semibold text-ink">
              How do you want to start with {selectedMajor?.label}?
            </h2>
            <p className="mb-5 text-[11px] leading-relaxed text-muted">
              You can change any of this later in Settings.
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => selectedMajorId && onChooseExample(selectedMajorId)}
                className="rounded-2xl bg-ink px-4 py-3 text-left text-canvas"
              >
                <span className="block text-sm font-medium">Use the example plan</span>
                <span className="block text-[11px] opacity-70">
                  Pre-fills a suggested semester-by-semester plan for {selectedMajor?.label}.
                </span>
              </button>
              <button
                type="button"
                onClick={() => selectedMajorId && onChooseScratch(selectedMajorId)}
                className="rounded-2xl bg-canvas px-4 py-3 text-left text-ink"
              >
                <span className="block text-sm font-medium">Start from scratch</span>
                <span className="block text-[11px] text-muted">
                  Only compulsory modules are pre-filled. You place everything else yourself.
                </span>
              </button>
              {hasExistingPlan && (
                <button
                  type="button"
                  onClick={onKeepCurrent}
                  className="rounded-2xl border border-ink/10 px-4 py-3 text-left text-ink"
                >
                  <span className="block text-sm font-medium">Keep my current plan</span>
                  <span className="block text-[11px] text-muted">
                    You already have a saved plan — leave it exactly as it is.
                  </span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean, no output. (Not imported anywhere yet — Task 5 wires it in.)

- [ ] **Step 3: Commit**

```bash
git add src/components/OnboardingModal.tsx
git commit -m "Add OnboardingModal component"
```

---

### Task 5: Wire onboarding into `App.tsx`

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useOnboarding` from Task 2, `applyOnboardingChoice` from Task 3 (already on `plan`), `OnboardingModal` from Task 4.

- [ ] **Step 1: Import the new pieces**

In `src/App.tsx`, add these imports alongside the existing ones:

```ts
import { useOnboarding } from './hooks/useOnboarding';
import { OnboardingModal } from './components/OnboardingModal';
```

- [ ] **Step 2: Call the hook and compute the import-in-progress guard**

Replace:

```ts
  const plan = useStudyPlan();
  const { profile, setName, setMatricNumber, setYear, importProfile } = useProfile();
  const [pendingImport, setPendingImport] = useState<SharePayload | null>(null);
  const [reviewProfile, setReviewProfile] = useState<ShareProfile | null>(null);
  const [importError, setImportError] = useState(false);
```

with:

```ts
  const plan = useStudyPlan();
  const { profile, setName, setMatricNumber, setYear, importProfile } = useProfile();
  const onboarding = useOnboarding(plan.majors);
  const [pendingImport, setPendingImport] = useState<SharePayload | null>(null);
  const [reviewProfile, setReviewProfile] = useState<ShareProfile | null>(null);
  const [importError, setImportError] = useState(false);
  const hasImportInHash =
    window.location.hash.includes(`${IMPORT_HASH_KEY}=`) ||
    window.location.hash.includes(`${SHORT_IMPORT_HASH_KEY}=`);
```

`hasImportInHash` is computed fresh on every render (not state) — it exists only to suppress the onboarding popup during the one render before the `useEffect` below has parsed the hash into `pendingImport`. Once that effect runs, it clears the hash (`clearImportHash()`), so from then on `pendingImport` itself is what keeps the popup suppressed while the import dialog is showing.

- [ ] **Step 3: Mark onboarding complete when an import or review is confirmed**

Replace `confirmImport`:

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
      pendingImport.plan.nocDuration ?? null,
    );
    if (ok) {
      importProfile(pendingImport.profile);
      setReviewProfile(null);
      onboarding.dismissOnboarding();
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
      pendingImport.plan.nocDuration ?? null,
    );
    if (ok) {
      setReviewProfile(pendingImport.profile);
      setPendingImport(null);
      onboarding.dismissOnboarding();
    }
  };
```

(Only the two `onboarding.dismissOnboarding();` lines are new — everything else in both functions is unchanged.)

- [ ] **Step 4: Compute whether to show the popup and render it**

Find this block (it comes after the `if (!plan.major) return ...` early return):

```ts
  const pendingMajorLabel = pendingImport
    ? plan.majors.find((m) => m.id === pendingImport.plan.majorId)?.label ?? null
    : null;
  const isReviewMode = plan.isReviewMode && reviewProfile !== null;
```

Add one line right after it:

```ts
  const isReviewMode = plan.isReviewMode && reviewProfile !== null;
  const showOnboarding = onboarding.needsOnboarding && !hasImportInHash && !pendingImport && !isReviewMode;
```

Then, in the returned JSX, add the `OnboardingModal` as the first child inside the top-level fragment (before `<StudyPlan .../>`):

```tsx
  return (
    <>
      {showOnboarding && (
        <OnboardingModal
          majors={plan.majors}
          hasExistingPlan={onboarding.hasExistingPlan}
          onChooseExample={(majorId) => {
            plan.applyOnboardingChoice(majorId, 'example');
            onboarding.dismissOnboarding();
          }}
          onChooseScratch={(majorId) => {
            plan.applyOnboardingChoice(majorId, 'scratch');
            onboarding.dismissOnboarding();
          }}
          onKeepCurrent={onboarding.dismissOnboarding}
        />
      )}
      <StudyPlan
        {...plan}
        studentName={displayedProfile.name}
        setStudentName={setDisplayedName}
        matricNumber={displayedProfile.matricNumber}
        setMatricNumber={setDisplayedMatricNumber}
        studentYear={displayedProfile.year}
        setStudentYear={setDisplayedYear}
        isReviewMode={isReviewMode}
        reviewOwnerName={reviewProfile?.name}
        onExitReviewMode={exitReviewMode}
      />
```

(Everything from `<StudyPlan ...>` onward — including the existing `{pendingImport && <ImportModal .../>}` and `{importError && ...}` blocks below it — stays exactly as it is; only the new `{showOnboarding && <OnboardingModal .../>}` block is added above it.)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean, no output.

- [ ] **Step 6: Run the full test suite**

Run: `npm run test`
Expected: all tests pass (the Task 1 addition plus every pre-existing test).

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx
git commit -m "Wire the onboarding popup into App.tsx"
```

---

### Task 6: Manual verification

**Files:** none (verification only).

- [ ] **Step 1: New-user flow**

Run `npm run dev`. Open the app in a fresh incognito/private window (so `localStorage` is empty — do NOT reuse a regular window that already has a saved plan, since that would exercise the existing-user path instead).
1. Confirm the popup appears immediately, blocking the planner underneath, with no way to dismiss it (try clicking the backdrop and pressing Escape — nothing should happen).
2. Confirm "Next" is disabled until a major card is clicked.
3. Pick a non-CS major (e.g. Information Security), click Next.
4. Confirm step 2 shows exactly 2 options (no "Keep my current plan" — this is a brand new profile with zero existing plans).
5. Click "← Back", confirm it returns to step 1 with the major still selected.
6. Proceed to step 2 again, click "Use the example plan".
7. Confirm the popup closes, the header's major now reads the picked major, and the grid shows that major's pre-filled `defaultPlan`.
8. Reload the page. Confirm the popup does NOT reappear (the `studyplan:onboarded` flag persisted).

- [ ] **Step 2: "Start from scratch" mode**

In the same or another fresh incognito window, repeat the flow but choose "Start from scratch" in step 2.
Confirm the grid shows ONLY the locked NEP Impact Experience Project entries pre-placed (2 MC each, 4 semesters) — everything else empty. Cross-check against the picked major's JSON file's `defaultPlan` entries where `"locked": true` is set.

- [ ] **Step 3: Existing-user flow ("Keep my current plan")**

Using a window/profile that already has a real saved plan (e.g. clear `localStorage.removeItem('studyplan:onboarded')` via devtools console on a window that already has `studyplan:computer-science-nusc` or similar saved, to simulate "existing user from before this feature shipped" without actually losing their data), reload.
1. Confirm the popup appears.
2. Proceed through step 1 (pick any major, including one different from their real one) to step 2.
3. Confirm step 2 now shows 3 options, including "Keep my current plan".
4. Click "Keep my current plan".
5. Confirm the popup closes and the planner shows EXACTLY what it showed before the popup appeared (no data changed) — check the grid contents and MC totals match.
6. Reload. Confirm the popup does not reappear.

- [ ] **Step 4: Share-import suppression**

With `localStorage` cleared (fresh incognito window) but with a valid share link in hand (build one via a different window's "Share" button first), open the share link directly.
Confirm the ImportModal appears and the onboarding popup does NOT appear underneath/behind/instead of it. Confirm choosing either "Import" or "Review" in the ImportModal correctly leads directly into the planner (no onboarding popup afterward), and reloading afterward doesn't show onboarding either.

- [ ] **Step 5: No regressions**

Run `npx tsc --noEmit`, `npm run test`, `npm run validate`, `npm run build` one final time — all must be clean, matching the CI workflow's exact steps.

---
### Task 7: Persist the last active major across page loads

**Files:**
- Modify: `src/hooks/useStudyPlan.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: no new exports — this is a behavioral fix to the hook's existing initialization logic.

**Why:** Task 6's manual verification surfaced a pre-existing, separate gap that directly undermines this feature: `majorId` state always initializes to the hardcoded `DEFAULT_MAJOR_ID` ('computer-science-nusc') on every fresh page load — there is no persisted "last active major." Consequence: a student who completes onboarding by picking a non-CS major sees Computer Science's plan again on their very next reload (their real data is safe under its own `studyplan:<majorId>` key and reachable via the major dropdown, so this is not data loss — but it looks broken and defeats onboarding's purpose for exactly the students it was built to help). This task closes that gap with a small persisted key.

- [ ] **Step 1: Add the persisted-key constant and a read helper**

In `src/hooks/useStudyPlan.ts`, find `const writeSavedPlan = (majorId: string, state: SavedPlanState) => {`. Immediately after that function's closing `};` (and before `export const useStudyPlan = () => {`), add:

```ts
const LAST_MAJOR_KEY = 'studyplan:lastMajorId';

const getInitialMajorId = (majors: Major[], fallback: string): string => {
  const stored = localStorage.getItem(LAST_MAJOR_KEY);
  return stored && majors.some((m) => m.id === stored) ? stored : fallback;
};
```

- [ ] **Step 2: Use it to seed the initial state**

Replace:

```ts
  const defaultMajor = majors.find((m) => m.id === DEFAULT_MAJOR_ID) ?? majors[0];
  const [majorId, setMajorId] = useState<string>(defaultMajor?.id ?? '');
  const [personalMajorId, setPersonalMajorId] = useState<string>(defaultMajor?.id ?? '');
```

with:

```ts
  const defaultMajor = majors.find((m) => m.id === DEFAULT_MAJOR_ID) ?? majors[0];
  const initialMajorId = getInitialMajorId(majors, defaultMajor?.id ?? '');
  const [majorId, setMajorId] = useState<string>(initialMajorId);
  const [personalMajorId, setPersonalMajorId] = useState<string>(initialMajorId);
```

On a genuinely fresh browser (no `studyplan:lastMajorId` key yet), `getInitialMajorId` falls back to `defaultMajor?.id` — identical to today's bootstrap behavior, so this doesn't change what a brand-new visitor sees before onboarding runs.

- [ ] **Step 3: Add a `rememberMajorId` helper that persists on every real major change**

Find `const toggleMinorId = useCallback(`. Immediately before it, add:

```ts
  const rememberMajorId = (id: string) => {
    localStorage.setItem(LAST_MAJOR_KEY, id);
    setPersonalMajorId(id);
  };
```

- [ ] **Step 4: Replace the three existing `setPersonalMajorId` call sites**

There are exactly three. Each one is the signal for "this is the user's own real major choice, not a temporary review-mode view" — replace each with `rememberMajorId`, keeping every surrounding line unchanged:

In `switchMajor`, replace:
```ts
      if (mode === 'personal') setPersonalMajorId(newMajorId);
```
with:
```ts
      if (mode === 'personal') rememberMajorId(newMajorId);
```

In `applyOnboardingChoice` (added in Task 3), replace:
```ts
      setPersonalMajorId(newMajorId);
```
with:
```ts
      rememberMajorId(newMajorId);
```
(This is the one line that directly closes the gap Task 6 found: completing onboarding now persists the chosen major for next time.)

In `importSharedPlan`, replace:
```ts
      setPersonalMajorId(newMajorId);
```
with:
```ts
      rememberMajorId(newMajorId);
```

Do not touch `openReviewPlan` or `exitReviewMode` — review mode is intentionally temporary and must not overwrite the persisted "last active" major.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean, no output.

- [ ] **Step 6: Run the full test suite**

Run: `npm run test`
Expected: all tests pass (this task adds no new tests — `useStudyPlan.ts` isn't unit-tested per this project's convention — but must not break any of the existing 109).

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useStudyPlan.ts
git commit -m "Persist the last active major across page loads"
```

- [ ] **Step 8: Manual re-verification**

Run `npm run dev` (or reuse a running dev server). In a fresh browser context with empty `localStorage`:
1. Complete onboarding picking a non-CS major (e.g. Information Security) with "Start from scratch."
2. Confirm the grid shows the scratch plan for that major (only the locked NEP entries).
3. Reload the page.
4. Confirm the header still shows the chosen major (e.g. Information Security) — NOT Computer Science — and the grid still shows the scratch plan, not a reset default. This is the specific regression Task 6 found; confirm it's fixed.
5. Switch to a different major via the Settings dropdown, reload, confirm it lands on that major too (general "remember last active major" behavior, not just the onboarding path).

