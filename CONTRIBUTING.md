# Contributing

## Setup

```bash
npm install
npm run dev
```

For the admin data-authoring tool, see `admin/`'s own `npm install`/`npm run dev` (it's a
separate Vite project — see the root [README](./README.md#project-structure)).

## Before committing

Run these from the repo root:

```bash
npx tsc --noEmit
npm test
npm run validate
```

If you touched `admin/`, also run its own typecheck:

```bash
cd admin && npx tsc --noEmit
```

There is no CI pipeline yet — these checks are the whole verification story, so run all of
them before opening a PR.

## Code style

- Match the existing Tailwind palette tokens (`ink`, `canvas`, `paper`, `muted`) and
  rounded-card shapes (`rounded-xl`/`rounded-2xl`/`rounded-4xl`) — don't introduce new colors
  or a different border-radius scale.
- No comments unless they explain a non-obvious *why* (a hidden constraint, a workaround, a
  subtle invariant). Well-named identifiers should carry the *what*.
- Keep files focused: one clear responsibility per component/module, following the existing
  split (e.g. `src/lib/studyPlan.ts` for pure computation, `src/hooks/useStudyPlan.ts` for
  state/persistence, components for rendering only).
- Follow the patterns already in the codebase for a given layer rather than introducing a new
  one — e.g. new pure logic goes in `src/lib/studyPlan.ts` alongside the existing `compute*`
  functions, new admin builders follow `MajorBuilder`'s tab-per-concern layout.

## Tests

Only the pure logic in `src/lib/` and `shared/` is unit-tested (`npm test`, via Vitest) —
React components are verified manually (`npm run dev` + a browser check), not with component
tests. If you add or change a pure function in `src/lib/studyPlan.ts` or `shared/share.ts`,
add or update its test in the co-located `*.test.ts` file. See
`docs/test-coverage-report.md` for current coverage.

## Adding or editing major/second-major/minor data

Don't hand-edit the JSON under `shared/data/` where possible — use the `admin/` app instead:

```bash
cd admin
npm run dev
```

It has three sections (Majors, Second Majors, Minors), each with an Info/Requirements/
[Default Plan or Module Catalog]/Export tab. Use the Export tab to save the file to the right
`shared/data/` subdirectory, then run `npm run validate` from the repo root to check it (id
uniqueness, `moduleCatalog` consistency, category/MC-target sums for majors).

## Design specs and plans

Nontrivial features get a design spec and/or implementation plan under
`docs/superpowers/specs/` and `docs/superpowers/plans/` before implementation. Look at recent
examples there for the expected level of detail (exact file paths, exact code, a verification
checklist) before writing a new one.

## Commit messages

Concise, imperative subject line describing the *why* more than the *what* (e.g. "Fix
computeDoubleCount design: drop unneeded primary-major requirement check", not "update
studyPlan.ts"). Look at `git log` for examples of the house style.
