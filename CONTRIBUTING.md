# Contributing to StudyPlanner

Thanks for taking the time to contribute to StudyPlanner.

Whether you are adding a minor curriculum, fixing an edge-case prerequisite rule, or polishing a UI interaction, we are glad to have your help. StudyPlanner is built by students, for students, to make academic degree planning straightforward and reliable.

Here is a guide to help you find your way around the codebase and get your changes merged smoothly.

---

## Where Things Live

The repository is structured to keep UI, core degree logic, and curriculum data cleanly separated:

```text
studyplanner/
├── src/                  # The student-facing planner web app
│   ├── components/       # React UI components (grid, cards, sidebar, dialogs)
│   │   └── competency/   # Visualise views (prerequisite Graph and River streamgraph)
│   ├── hooks/            # React hooks for state and layout
│   │   ├── useStudyPlan.ts     # Main plan state, history, and persistence
│   │   └── useModalFocus.ts    # Accessible keyboard navigation and dialog focus
│   └── lib/              # Pure computational logic and co-located unit tests
│       ├── studyPlan.ts        # Degree requirement evaluation and prerequisite checks
│       ├── requirementAllocation.ts  # Multi-programme course credit sharing logic
│       ├── gallery.ts          # Search and filter logic for the Explore view
│       └── aiPlanner.ts        # AI study plan advisor integration
│
├── shared/               # Code and data shared across both the main app and admin tool
│   ├── types.ts          # Core TypeScript definitions (Major, PlacedModule, etc.)
│   ├── nusmods.ts        # Client for NUSMods course details and timetable export
│   ├── pathways.ts       # Global Pathways rules (SEP, NOC, GEx, Regional IEx, SIIP)
│   ├── share.ts          # Compact URL serializer and deserializer (#i=...)
│   └── data/             # Curriculum JSON files
│       ├── majors/       # Primary degree schemas and default study plans
│       ├── second-majors/# Second major requirements
│       ├── minors/       # Minor requirements
│       └── programme-directory.json # Master directory of NUS programmes
│
├── admin/                # Standalone visual tool for authoring curriculum JSON data
├── scripts/              # Data validation scripts run via `npm run validate`
└── docs/                 # Design specs, architecture notes, and feature proposals
```

### Quick rule of thumb for edits:
* Need to fix a degree requirement or add a minor? Look under `shared/data/`.
* Need to adjust degree math, double-counting rules, or unit allocation? Look under `src/lib/` or `shared/pathways.ts`.
* Need to change how things look or interact? Look under `src/components/`.

---

## A Few Core Principles

1. **Zero backend, zero accounts:** StudyPlanner does not store user data on a server or require account logins. All student state lives locally in `localStorage` or serializes into the shareable URL hash (`#i=...`). Please keep the application completely client-side.
2. **The "Academic Parchment" aesthetic:** We intentionally designed StudyPlanner to feel like a structured, high-density academic document rather than a generic SaaS template. We stick to our custom Tailwind tokens (`ink`, `paper`, `canvas`, and `muted`) defined in `DESIGN.md`.
3. **Keep pure logic out of components:** Calculations for credit totals, graduation requirements, and prerequisites belong as pure functions in `src/lib/` and `shared/`, covered by unit tests. Components should only worry about layout and user interactions.

---

## Branching & Git Workflow

We follow a simple branch-per-feature workflow based off `main`:

### 1. Always branch off `main`
Make sure your local `main` branch is up to date before creating a new branch:
```bash
git checkout main
git pull origin main
git checkout -b <your-branch-name>
```

### 2. Branch naming conventions
Use a prefix that describes the type of work you are doing:
* `feature/<short-name>` or `feat/<short-name>`: New user-facing features (e.g. `feat/prereq-quick-filter`)
* `fix/<short-name>`: Bug fixes or calculation corrections (e.g. `fix/sep-credit-balance`)
* `curriculum/<programme-name>`: Adding or updating majors, minors, or second majors (e.g. `curriculum/data-analytics-minor`)
* `refactor/<short-name>`: Code refactoring without changing user-facing behavior

### 3. Commit messages
We follow Conventional Commits to keep our git history readable and informative:
* `feat(curriculum): add interactive media development minor`
* `fix(planner): correctly balance UE targets for 6-month NOC`
* `fix(grid): keep desktop sidebar fixed while scrolling`

### 4. Keep pull requests focused
Small, focused PRs are much easier to review and get merged significantly faster. If you are updating a curriculum file, avoid mixing it with unrelated UI refactoring.

---

## Local Setup

### Running the student planner:
```bash
npm install
npm run dev
```
Open http://localhost:5173 in your browser.

### Running the curriculum admin tool:
If you are authoring or revising major/minor JSON files, the companion admin tool makes it easy to edit and export them visually without hand-formatting JSON:
```bash
cd admin
npm install
npm run dev
```

---

## Common Contribution Workflows

### Adding or Updating Curriculum Data
* Hand-editing JSON can lead to small syntax errors. Running the `admin/` tool provides a clean form interface to inspect and export curriculum configurations.
* Whenever you add or modify graduation rules, please link an official NUS faculty bulletin or department page in your PR so we can verify the accuracy.
* Always run `npm run validate` to verify ID uniqueness, catalog integrity, and credit totals.

### Core Logic and Requirement Rules
* Functions in `src/lib/` must remain pure, deterministic, and free of browser side-effects.
* Whenever you add or update logic in `src/lib/studyPlan.ts` or `shared/pathways.ts`, add or update the corresponding Vitest unit tests in `*.test.ts`.

### UI and Accessibility
* Verify your changes on both desktop and mobile screen sizes.
* Ensure all modals, drawers, and menus support keyboard navigation (`Esc` key to close, focus trapping where appropriate).

---

## Before Opening a Pull Request

Run these checks from the project root:

```bash
# 1. Typecheck and verify build
npm run build

# 2. Run unit tests
npm test

# 3. Validate curriculum JSON data
npm run validate
```

If you touched files inside `admin/`:
```bash
cd admin && npx tsc --noEmit
```

---

## Submitting Your Pull Request

1. Push your branch to GitHub and open a Pull Request targeting `main`.
2. Include a short description of:
   * **What changed:** A concise summary of the changes.
   * **Why:** The problem this addresses or the feature it provides.
   * **How you tested it:** Relevant unit test results or UI screenshots.
3. If you want early feedback or architectural guidance before finishing your implementation, feel free to open a **Draft PR**. We are happy to help you get it across the finish line.
