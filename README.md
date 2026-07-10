# Study Planner

A study planner for NUS School of Computing (SoC) / NUS College (NUSC) students to plan
their degree, track requirements, and share their plan for review.

## Project structure

This is a two-app monorepo sharing one data/logic layer:

- `src/` — the student-facing planner app (React 19 + TypeScript + Vite + Tailwind). No
  backend; a plan persists to `localStorage` and can be shared via a self-contained link
  (`#i=<encoded-plan>`).
- `admin/` — a separate Vite app for authoring major/second-major/minor JSON data without
  hand-editing files. Has its own `package.json`/`tsconfig.json`.
- `shared/` — the data model (`types.ts`), the NUSMods API client (`nusmods.ts`), the
  share-link codec (`share.ts`), and the data itself (`data/majors/`, `data/second-majors/`,
  `data/minors/`).
- `scripts/` — standalone data validation scripts (`validate-majors.mjs`,
  `validate-secondary.mjs`), run via `npm run validate`.
- `docs/superpowers/` — design specs and implementation plans for past and current feature
  work.

## Getting started

```bash
npm install
npm run dev
```

Opens the student app at http://localhost:5173 (port may bump if taken).

To run the admin data-authoring tool:

```bash
cd admin
npm install
npm run dev
```

## Scripts (student app, repo root)

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the student app dev server |
| `npm run build` | Typecheck (`tsc --noEmit`) then build for production |
| `npm run preview` | Preview the production build |
| `npm test` | Run the Vitest test suite (pure logic in `src/lib/` and `shared/`) |
| `npm run test:coverage` | Run tests with a coverage report (see `docs/test-coverage-report.md`) |
| `npm run validate` | Validate all major/second-major/minor JSON data files |

## Data model

Majors, second majors, and minors are plain JSON files under `shared/data/`. A `Major` owns
categories, a default seed plan, and named requirement rules; a `SecondaryProgramme` (second
major or minor) is a leaner shape — just requirements and a module catalog, checked against
whatever the student has already placed for their primary major. See `shared/types.ts` for
the full data model, and `admin/` for the tool that authors these files.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).
