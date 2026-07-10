# Print / export the study plan — design

## Context

The app currently has no way to get a plan out as a document — only the base64 share-link (for
importing into another browser) and an admin-only JSON export. A student wanting to show their
advisor a printed or PDF'd plan has no path to that today. `StudyPlan.tsx` already computes
everything a print view would need (`stats`, `requirements`, `semesters`, `waivedModules`,
`secondMajors`/`minors`/`secondMajorId`/`minorIds`, `nocDuration`) and passes it down as props, so
this is additive — no new data plumbing required.

## Approach

Browser-native print via `@media print` CSS and `window.print()` — no new dependency. This matches
every prior plan in this codebase's history, which has consistently constrained "no new
dependencies" (confirmed across the onboarding, NOC, and curriculum-gap plans). The alternative
(a client-side PDF library like `jsPDF`/`react-to-print`) would give more consistent
cross-browser output but is a deliberate deviation from that established convention — rejected in
favor of the zero-dependency approach.

A **separate print-only view**, not a CSS makeover of the existing interactive components. The
live semester grid/stats/requirements UI is full of interactive-only chrome (⊕ requirement-mapping
pickers, hover states, a horizontally-scrolling semester-grid container, dropdowns) that would be
fragile to force into print mode via overrides scattered across already-complex components. A
clean, separate `PrintView` component keeps the two concerns isolated: building it carries no risk
of breaking the screen UI, and its layout isn't constrained by the screen layout's horizontal
scroll.

## Mechanics

- New `src/components/PrintView.tsx`, rendered unconditionally inside `StudyPlan.tsx` (always in
  the DOM) but hidden on-screen via CSS. `@media print` rules (added to `src/index.css`) hide the
  normal interactive screen content and show `PrintView` instead.
- A "Print" button added to `StudyPlan.tsx`'s header, next to the existing "Share" button, calling
  `window.print()` directly — no confirmation dialog, no share-name prompt (unlike "Share", which
  needs a name for the link). The browser's native print dialog (with "Save as PDF" as a
  destination) handles the rest.
- Works in both personal and review mode automatically — `PrintView` receives whatever data
  `StudyPlan.tsx` already has in scope (this is identical to how the existing screen UI already
  works in either mode), so reviewing someone else's shared plan can also be printed.

## Content

`PrintView` renders, top to bottom:

1. **Header**: student name, matric number, year; major label + school + batch (`AY2026/2027`
   style); a "Generated on `<date>`" line; badges for any declared second major, minors, and NOC
   duration.
2. **Stats**: total MC progress (`128/160 MC`) and one line per category (`SoC Common Curriculum:
   4/8 MC`).
3. **Requirements**: grouped by category, each row a ✓/○ + requirement name + `have/need` — reuses
   the same `RequirementStatus[]` (`computeRequirements`'s output) already computed on screen,
   rendered plainly (no ⊕ picker button, no hover states).
4. **Breadth & Depth / Programme Electives** (only if the major has one — today that's
   `computer-science-nusc` and `artificial-intelligence-nusc` for `breadthDepth`,
   `business-analytics-nusc`/`business-ai-systems-nusc` for `programmeElectives`): a plain list of
   constraint chips with met/not-met status, reusing `computeBreadthDepth`/
   `computeProgrammeElectives`'s existing output. The interactive "browse categories/focus areas"
   explorer has no print equivalent — skipped.
5. **Second Major / Minor** (only if declared): one compact requirements checklist per declared
   programme, reusing `computeRequirements` against that programme (same function the screen UI
   already calls for this).
6. **Semester grid**: a CSS grid that wraps 2 semesters per row (`Y1S1`+`Y1S2` in a row,
   `Y2S1`+`Y2S2` below, etc.), each semester a bordered box listing its modules (code, name, MC,
   category label). A trailing **Waived** section lists waived modules the same way.

Styling: light category-color accents preserved (the same color tokens already used on screen),
not stripped to pure black-and-white — cheap to keep, and most "printing" today is really
Save-as-PDF, which renders color fine.

Page breaks: a `page-break-before` ahead of the semester-grid section (so requirements/stats don't
awkwardly split across a page boundary), and `page-break-inside: avoid` on each semester box (so a
single semester's module list doesn't split across two pages — the box itself may still push to
the next page if it doesn't fit).

## Testing

Per this project's established convention, `PrintView` is a presentational component — no
component tests. Verified manually: trigger print preview (or print-to-PDF) in the browser for
(a) a personal plan with no secondary programmes declared, (b) a personal plan with a second major
+ minors + NOC declared, (c) a major with a `breadthDepth` config (e.g. Computer Science), (d) a
major with `programmeElectives` (e.g. Business Analytics), (e) review mode viewing an imported
plan. Confirm: no interactive screen chrome bleeds into the print output, the 2-per-row semester
wrap reads cleanly, page breaks land sensibly, and nothing is clipped or overflows the page width.

## Out of scope

- Client-side PDF generation library (rejected — see Approach).
- A print preview/customization screen inside the app (e.g. "choose what to include") — the print
  view always shows everything; the student can still deselect sections in the browser's native
  print dialog if they want a subset.
- Print styling parity with the exact on-screen visual design (colors, fonts, spacing) — the print
  view is a distinct, print-optimized layout, not a pixel-accurate reproduction of the app.
