# Print / Export Study Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Print" button that produces a clean, print/PDF-ready document of the current plan (profile, progress, requirements, breadth&depth/programme-electives, second major & minor, and the full semester grid) via the browser's native print dialog — no new dependency.

**Architecture:** A new `PrintView` component renders a complete, print-only document (hidden on screen via Tailwind's `print:`/base `hidden` variants, shown only inside `@media print`). It's rendered unconditionally inside `StudyPlan.tsx`, fed the exact same data already flowing through that component's props, so it works identically in personal and review mode. A "Print" button next to "Share" calls `window.print()` directly.

**Tech Stack:** React 19 + TypeScript 5.8, Tailwind (including its built-in `print:` variant and `break-before-page`/`break-inside-avoid` utilities — no custom CSS classes needed beyond one `@page` rule).

## Global Constraints

- Windows machine. Verify every task with `npx tsc --noEmit` (must exit 0, no output) from the repo root.
- No new dependencies — browser-native `window.print()` + `@media print` CSS only (see `docs/superpowers/specs/2026-07-10-print-export-design.md` for why this was chosen over a PDF library).
- `PrintView.tsx` is a presentational component — no unit tests, per this project's established convention (only `src/lib/` pure logic is unit-tested). Verify manually in the browser (Task 3).
- Match existing Tailwind style: palette tokens `ink`/`canvas`/`paper`/`muted`; category colors applied via inline `style` from `category.color` data (the same pattern `StatsSummary.tsx` already uses — `style={{ borderTop: ... category.color }}` — not hardcoded Tailwind color classes, since category colors are per-major data, not static).
- Do not add AI attribution to commit messages.
- Reuse existing compute functions (`computeRequirements`, `computeBreadthDepth`, `computeProgrammeElectives`) — do not duplicate their logic.

---

### Task 1: Build the `PrintView` component

**Files:**
- Create: `src/components/PrintView.tsx`

**Interfaces:**
- Consumes: `Major`, `StudentSemester`, `WaivedModule`, `SecondaryProgramme`, `NocDuration` from `@shared/types`; `RequirementStatus`, `Stats`, `computeRequirements`, `computeBreadthDepth`, `computeProgrammeElectives` from `../lib/studyPlan`.
- Produces: `PrintView(props): JSX.Element` — Task 2 renders this from `StudyPlan.tsx`, passing the exact prop names listed below (all of which `StudyPlan.tsx` already receives).

- [ ] **Step 1: Create the component with header + stats + requirements sections**

Create `src/components/PrintView.tsx`:

```tsx
import type {
  Major,
  StudentSemester,
  WaivedModule,
  SecondaryProgramme,
  NocDuration,
} from '@shared/types';
import type { RequirementStatus, Stats } from '../lib/studyPlan';
import { computeRequirements, computeBreadthDepth, computeProgrammeElectives } from '../lib/studyPlan';

interface Props {
  studentName: string;
  matricNumber: string;
  studentYear: string;
  major: Major;
  stats: Stats;
  requirements: RequirementStatus[];
  semesters: StudentSemester[];
  waivedModules: WaivedModule[];
  secondMajors: SecondaryProgramme[];
  minors: SecondaryProgramme[];
  secondMajorId: string | null;
  minorIds: string[];
  nocDuration: NocDuration | null;
}

export const PrintView = ({
  studentName,
  matricNumber,
  studentYear,
  major,
  stats,
  requirements,
  semesters,
  waivedModules,
  secondMajors,
  minors,
  secondMajorId,
  minorIds,
  nocDuration,
}: Props) => {
  const declaredSecondMajor = secondMajorId
    ? secondMajors.find((m) => m.id === secondMajorId) ?? null
    : null;
  const declaredMinors = minors.filter((m) => minorIds.includes(m.id));
  const declaredSecondaries = declaredSecondMajor ? [declaredSecondMajor, ...declaredMinors] : declaredMinors;

  const depthConfig = major.breadthDepth
    ? computeBreadthDepth(major, semesters, waivedModules)
    : major.programmeElectives
      ? computeProgrammeElectives(major, semesters, waivedModules)
      : null;
  const depthTitle = major.breadthDepth ? 'Breadth & Depth' : 'Programme Electives';

  const generatedOn = new Date().toLocaleDateString('en-SG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const requirementsByCategory = major.categories
    .map((cat) => ({ category: cat, rows: requirements.filter((r) => r.categoryId === cat.id) }))
    .filter((group) => group.rows.length > 0);

  return (
    <div className="hidden print:block text-ink">
      <div className="mb-6 flex items-start justify-between border-b border-ink/20 pb-4">
        <div>
          <div className="text-lg font-semibold">{studentName || 'Student Name'}</div>
          <div className="text-xs text-muted">
            {matricNumber ? `${studentYear} · ${matricNumber}` : studentYear}
          </div>
          <div className="mt-2 text-sm font-medium">
            {major.label}
            <span className="ml-1 text-xs font-normal text-muted">
              · {major.school} · {major.batches.join(', ')}
            </span>
          </div>
          {(declaredSecondMajor || declaredMinors.length > 0 || nocDuration) && (
            <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
              {declaredSecondMajor && (
                <span className="rounded-full border border-ink/20 px-2 py-0.5">
                  2nd Major: {declaredSecondMajor.label}
                </span>
              )}
              {declaredMinors.map((m) => (
                <span key={m.id} className="rounded-full border border-ink/20 px-2 py-0.5">
                  Minor: {m.label}
                </span>
              ))}
              {nocDuration && (
                <span className="rounded-full border border-ink/20 px-2 py-0.5">NOC: {nocDuration}</span>
              )}
            </div>
          )}
        </div>
        <div className="text-[10px] text-muted">Generated on {generatedOn}</div>
      </div>

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-semibold">Progress</h2>
        <div className="mb-2 text-xs font-medium">
          Total: {stats.totalMc}/{major.totalMcTarget} MC
        </div>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
          {major.categories.map((cat) => (
            <li key={cat.id} className="border-l-2 pl-2" style={{ borderColor: cat.color }}>
              {cat.label}: {stats.byCategory[cat.id] ?? 0}
              {cat.mcTarget ? `/${cat.mcTarget}` : ''} MC
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-semibold">Requirements</h2>
        {requirementsByCategory.map(({ category, rows }) => (
          <div key={category.id} className="mb-3">
            <h3 className="mb-1 text-xs font-semibold text-muted">{category.label}</h3>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs">
              {rows.map((r) => (
                <li key={r.name} className="flex items-baseline gap-1.5">
                  <span>{r.fulfilled ? '✓' : '○'}</span>
                  <span>{r.name}</span>
                  {r.need > 1 && <span className="text-muted">({r.have}/{r.need})</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {depthConfig && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-semibold">{depthTitle}</h2>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs">
            {depthConfig.constraints.map((c) => (
              <li key={c.id} className="flex items-baseline gap-1.5">
                <span>{c.fulfilled ? '✓' : '○'}</span>
                <span>{c.label}</span>
                {c.detail && <span className="text-muted">({c.detail})</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {declaredSecondaries.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-semibold">Second Major &amp; Minor Progress</h2>
          {declaredSecondaries.map((programme) => {
            const progReqs = computeRequirements(programme, semesters, waivedModules);
            return (
              <div key={programme.id} className="mb-3">
                <h3 className="mb-1 text-xs font-semibold text-muted">
                  {programme.label} ({programme.kind === 'second-major' ? 'Second Major' : 'Minor'})
                </h3>
                <ul className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs">
                  {progReqs.map((r) => (
                    <li key={r.name} className="flex items-baseline gap-1.5">
                      <span>{r.fulfilled ? '✓' : '○'}</span>
                      <span>{r.name}</span>
                      {r.need > 1 && <span className="text-muted">({r.have}/{r.need})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean, no output. (The semester-grid section is added in Step 3 below before this component is complete — but this intermediate state should still typecheck cleanly since it's valid TSX on its own.)

- [ ] **Step 3: Add the semester grid + waived section**

In `src/components/PrintView.tsx`, replace the closing:

```tsx
      )}
    </div>
  );
};
```

(the end of the "Second Major & Minor Progress" conditional block, immediately before the component's final `</div>` and closing) with:

```tsx
      )}

      <section className="break-before-page">
        <h2 className="mb-2 text-sm font-semibold">Semester Plan</h2>
        <div className="grid grid-cols-2 gap-3">
          {semesters.map((sem) => (
            <div
              key={`${sem.year}-${sem.sem}`}
              className="break-inside-avoid rounded-lg border border-ink/20 p-2"
            >
              <h3 className="mb-1 text-xs font-semibold">
                Year {sem.year} Semester {sem.sem}
              </h3>
              {sem.modules.length === 0 ? (
                <p className="text-[10px] text-muted">No modules</p>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {sem.modules.map((m) => (
                    <li key={m.code} className="flex items-baseline justify-between gap-2 text-[10px]">
                      <span>
                        <span className="font-mono font-semibold">{m.code}</span> {m.name}
                      </span>
                      <span className="whitespace-nowrap text-muted">{m.mcs} MC</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {waivedModules.length > 0 && (
          <div className="mt-3 break-inside-avoid rounded-lg border border-ink/20 p-2">
            <h3 className="mb-1 text-xs font-semibold">Waived</h3>
            <ul className="flex flex-col gap-0.5">
              {waivedModules.map((m) => (
                <li key={m.code} className="flex items-baseline justify-between gap-2 text-[10px]">
                  <span>
                    <span className="font-mono font-semibold">{m.code}</span> {m.name}
                  </span>
                  <span className="whitespace-nowrap text-muted">{m.mcs} MC</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
};
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean, no output. (`PrintView` isn't imported anywhere yet — Task 2 wires it in — so this only confirms the file itself compiles.)

- [ ] **Step 5: Commit**

```bash
git add src/components/PrintView.tsx
git commit -m "Add PrintView component for print/export"
```

---

### Task 2: Wire the Print button and `@page` CSS

**Files:**
- Modify: `src/components/StudyPlan.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `PrintView` from Task 1.

- [ ] **Step 1: Import `PrintView`**

In `src/components/StudyPlan.tsx`, add to the existing imports:

```ts
import { PrintView } from './PrintView';
```

- [ ] **Step 2: Hide the screen UI when printing**

Find the component's root return statement:

```tsx
  return (
    <div className="min-h-screen bg-canvas">
```

Replace with:

```tsx
  return (
    <div className="min-h-screen bg-canvas print:hidden">
```

- [ ] **Step 3: Add the Print button next to Share**

Find:

```tsx
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="text-xs text-muted hover:text-ink transition-colors px-3 py-1.5 rounded-xl hover:bg-paper"
            >
              {shareState === 'copied' ? 'Link copied' : shareState === 'error' ? 'Copy manually' : 'Share'}
            </button>
```

Replace with:

```tsx
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="text-xs text-muted hover:text-ink transition-colors px-3 py-1.5 rounded-xl hover:bg-paper"
            >
              Print
            </button>
            <button
              onClick={handleShare}
              className="text-xs text-muted hover:text-ink transition-colors px-3 py-1.5 rounded-xl hover:bg-paper"
            >
              {shareState === 'copied' ? 'Link copied' : shareState === 'error' ? 'Copy manually' : 'Share'}
            </button>
```

- [ ] **Step 4: Render `PrintView` alongside the screen UI**

`StudyPlan.tsx`'s component body returns one top-level `<div className="min-h-screen bg-canvas print:hidden">` (opened at the `return (` you just edited in Step 2) which closes at the very end of the component, immediately before its final `};`. `PrintView` must render as a SIBLING of this div, not nested inside it — nesting it there would hide it in print too (since the wrapper is now `print:hidden`), defeating the whole feature.

The component's closing lines are currently exactly:

```tsx
      {showShareNameDialog && (
        <AppDialog
          title="Set your name"
          onClose={() => setShowShareNameDialog(false)}
          actions={[
            { label: 'Cancel', onClick: () => setShowShareNameDialog(false), variant: 'secondary' },
            { label: 'Continue', onClick: handleConfirmShareName, variant: 'primary' },
          ]}
        >
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-muted">Name</span>
            <input
              type="text"
              value={shareNameDraft}
              onChange={(event) => {
                setShareNameDraft(event.target.value);
                setShareNameError(false);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleConfirmShareName();
                }
              }}
              className="w-full rounded-2xl border border-ink/10 bg-paper px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/20"
              autoFocus
            />
          </label>
          {shareNameError && (
            <p className="mt-2 text-xs font-medium text-red-700">Enter a name before sharing.</p>
          )}
        </AppDialog>
      )}
    </div>
  );
};
```

Two changes:

1. Change the `return (` line (from Step 2) to open a fragment instead of returning the div directly:

```tsx
  return (
    <>
      <div className="min-h-screen bg-canvas print:hidden">
```

(i.e. insert a `<>` line and indent the existing `<div className="min-h-screen bg-canvas print:hidden">` one level — every line between this div and its closing `</div>` at the bottom stays textually the same, just now one indent level deeper is NOT required by TSX/JSX — indentation is cosmetic only, you do not need to re-indent the whole file; it is fine to leave the inner content's existing indentation as-is, only the two edited lines actually need to change).

2. Replace the closing:

```tsx
    </div>
  );
};
```

with:

```tsx
    </div>
      <PrintView
        studentName={studentName}
        matricNumber={matricNumber}
        studentYear={studentYear}
        major={major}
        stats={stats}
        requirements={requirements}
        semesters={semesters}
        waivedModules={waivedModules}
        secondMajors={secondMajors}
        minors={minors}
        secondMajorId={secondMajorId}
        minorIds={minorIds}
        nocDuration={nocDuration}
      />
    </>
  );
};
```

All prop values passed to `PrintView` are already in scope as `StudyPlan`'s own destructured props (`studentName`, `matricNumber`, `studentYear`, `major`, `stats`, `requirements`, `semesters`, `waivedModules`, `secondMajors`, `minors`, `secondMajorId`, `minorIds`, `nocDuration` — confirmed all present in the `Props` interface at the top of this file) — no new state or plumbing needed. Run `npx tsc --noEmit` after this step specifically before moving on — mismatched JSX fragment/div nesting is the easiest mistake to make here and TypeScript's JSX checker will catch it immediately.

- [ ] **Step 5: Add the `@page` print rule**

In `src/index.css`, add at the end of the file:

```css
@media print {
  @page {
    margin: 1.5cm;
  }
}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean, no output.

- [ ] **Step 7: Run the full test suite**

Run: `npm run test`
Expected: all existing tests pass (this task adds no new tests — `StudyPlan.tsx`/`PrintView.tsx` aren't unit-tested per this project's convention — but must not break anything).

- [ ] **Step 8: Commit**

```bash
git add src/components/StudyPlan.tsx src/index.css
git commit -m "Wire the Print button and PrintView into StudyPlan"
```

---

### Task 3: Manual verification

**Files:** none (verification only).

- [ ] **Step 1: Basic print preview**

Run `npm run dev`. On a plan with no secondary programmes declared, click "Print" (or use the browser's print-preview shortcut, e.g. Ctrl+P, to inspect without actually printing). Confirm:
1. The normal interactive screen UI (header buttons, semester grid, stats cards) is NOT visible in the print preview — only the new print document.
2. The print document shows: name/matric/year header, major + school + batch, a "Generated on <date>" line, total MC progress, per-category MC lines, and the requirements checklist grouped by category with ✓/○ marks.
3. No layout overflow — nothing is clipped at the page edge.

- [ ] **Step 2: Secondary programmes + NOC**

On a plan with a declared second major, at least one minor, and a declared NOC duration, open print preview. Confirm the header badges show all three, and a "Second Major & Minor Progress" section appears with a requirements checklist per declared programme.

- [ ] **Step 3: Breadth & Depth / Programme Electives**

Switch to Computer Science (has `breadthDepth`) and open print preview — confirm a "Breadth & Depth" section appears with constraint rows. Switch to Business Analytics (has `programmeElectives`) and confirm a "Programme Electives" section appears instead, with its own constraint rows. Switch to a major with neither (e.g. Information Security) and confirm neither section appears (no empty heading).

- [ ] **Step 4: Semester grid layout**

In print preview, confirm the semester grid shows 2 semesters per row (Y1S1+Y1S2 in one row, Y2S1+Y2S2 in the next, etc.), each in its own bordered box with module code/name/MC. Add enough modules to a plan that has waived modules too, and confirm a trailing "Waived" box appears after the semester grid. Confirm the semester-grid section starts on a new page (check the page-break lands before "Semester Plan", not mid-section) and that no individual semester box is visibly split across two pages.

- [ ] **Step 5: Review mode**

Open a share link in a fresh browser context to enter review mode, and confirm "Print" still works and produces the same document shape for the reviewed plan.

- [ ] **Step 6: No regressions**

Run `npx tsc --noEmit`, `npm run test`, `npm run validate`, `npm run build` one final time — all must be clean, matching the CI workflow's exact steps.
