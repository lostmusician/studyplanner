# Other SoC NUSC Majors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four new NUS College–track SoC majors (Artificial Intelligence, Business AI Systems, Business Analytics, Information Security) as data-only `shared/data/majors/*.json` files, auto-registered by the existing loader.

**Architecture:** Pure data authoring — no code or schema changes. Each major is a new JSON file conforming to the existing `Major` schema (`shared/types.ts`), following `computer-science-nusc.json` as the structural template. The `import.meta.glob('../../shared/data/majors/*.json')` loader in `src/hooks/useStudyPlan.ts` registers each new file automatically. A new Node validation script (`scripts/validate-majors.mjs`) acts as the test harness in the absence of a test runner.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind. No test runner is configured — verification is (a) `node scripts/validate-majors.mjs` for data integrity, (b) `npm run build` for type validity, and (c) manual dev-server checks (major appears in dropdown, requirements + default plan render, no console errors), matching how prior changes in this codebase were verified.

## Global Constraints

- **NUSC track only.** Every major reuses the NUS College block verbatim (spec: "Shared approach"). Do not author standard-track variants.
- **All four total 160 MC.** Each file's category `mcTarget` values must sum to `totalMcTarget: 160` (spec: "MC budgeting convention"). The validation script enforces this.
- **Empty elective/breadth/industrial-experience catalogs.** Categories `ai-breadth-depth`, `bais-electives`, `ba-electives`, `industrial-experience` carry an mcTarget but no catalog modules, no default-plan entries, and no requirement rows (spec: "Scope").
- **Per-major programming module:** AI→`CS1101S`, BAIS→`CS1010A`, Business Analytics→`CS1010A`, Information Security→`CS1010` (spec: "Programming methodology per major").
- **Do not modify `computer-science-nusc.json`** — the existing CS major is left exactly as-is (spec: "Judgment calls").
- **Module code variants are used exactly as each curriculum lists them:** AI uses `CS2030S`/`CS2040S`/`CS1231S`; InfoSec uses `CS2040C`/`CS1231S`; BAIS/BA use `CS2030`/`CS2040` (spec: "Judgment calls").
- Shared catalog codes (`IS1108`, `MA1521`, `MA1522`, `ST2334`, `NTW2035`, `GEA1000N`, `MA1301`) are copied into each file — the schema has no cross-file sharing.

---

### Task 1: Validation script (test harness)

**Files:**
- Create: `scripts/validate-majors.mjs`

**Interfaces:**
- Produces: a CLI script `node scripts/validate-majors.mjs` that reads every `shared/data/majors/*.json`, validates each, prints `OK <id>` per valid file and `FAIL <id>: <reason>` per invalid one, and exits non-zero if any file fails. Consumed as the verification step of Tasks 2–5.

- [ ] **Step 1: Write the validation script**

Create `scripts/validate-majors.mjs`:

```js
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', 'shared', 'data', 'majors');

const errors = [];
const seenIds = new Set();

for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const major = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  const fail = (msg) => errors.push(`FAIL ${major.id ?? file}: ${msg}`);

  if (!major.id) fail('missing id');
  if (seenIds.has(major.id)) fail(`duplicate id "${major.id}"`);
  seenIds.add(major.id);

  const catIds = new Set((major.categories ?? []).map((c) => c.id));
  if (catIds.size !== (major.categories ?? []).length) fail('duplicate category id');

  const sum = (major.categories ?? []).reduce((n, c) => n + (c.mcTarget ?? 0), 0);
  if (sum !== major.totalMcTarget) {
    fail(`category mcTarget sum ${sum} !== totalMcTarget ${major.totalMcTarget}`);
  }

  for (const entry of major.defaultPlan ?? []) {
    if (!major.moduleCatalog?.[entry.moduleCode]) {
      fail(`defaultPlan code "${entry.moduleCode}" not in moduleCatalog`);
    }
    if (!catIds.has(entry.categoryId)) {
      fail(`defaultPlan categoryId "${entry.categoryId}" not a category`);
    }
  }

  for (const req of major.requirements ?? []) {
    if (req.categoryId && !catIds.has(req.categoryId)) {
      fail(`requirement "${req.name}" categoryId "${req.categoryId}" not a category`);
    }
    for (const f of req.fulfilledBy ?? []) {
      if (!f.endsWith('*') && major.moduleCatalog && !major.moduleCatalog[f]) {
        // exact-code fulfillers should exist in the catalog
        fail(`requirement "${req.name}" fulfilledBy "${f}" not in moduleCatalog`);
      }
    }
  }

  for (const [code, mod] of Object.entries(major.moduleCatalog ?? {})) {
    if (mod.code !== code) fail(`catalog key "${code}" !== module.code "${mod.code}"`);
  }

  if (errors.every((e) => !e.startsWith(`FAIL ${major.id}:`))) {
    console.log(`OK ${major.id} (${major.categories.length} categories, ${major.totalMcTarget} MC)`);
  }
}

if (errors.length) {
  for (const e of errors) console.error(e);
  process.exit(1);
}
console.log('All majors valid.');
```

- [ ] **Step 2: Run it against the existing CS major to verify it passes**

Run: `node scripts/validate-majors.mjs`
Expected: PASS — prints `OK computer-science-nusc (...)` and `All majors valid.`, exit 0.

Note: `computer-science-nusc.json`'s requirement rows reference `CS1101S` and `IS1108` (both in its catalog) and prefix codes (`NTW*` etc.); its categories sum to 160. If this step fails, the script has a bug — fix the script, not the CS file (the CS file is out of scope).

- [ ] **Step 3: Commit**

```bash
git add scripts/validate-majors.mjs
git commit -m "Add major-data validation script"
```

---

### Task 2: Artificial Intelligence major

**Files:**
- Create: `shared/data/majors/artificial-intelligence-nusc.json`

**Interfaces:**
- Consumes: `scripts/validate-majors.mjs` (Task 1) as its verification step; the existing `Major` schema in `shared/types.ts`.
- Produces: a new auto-registered major with `id: "artificial-intelligence-nusc"`.

- [ ] **Step 1: Write the major file**

Create `shared/data/majors/artificial-intelligence-nusc.json`:

```json
{
  "id": "artificial-intelligence-nusc",
  "label": "Artificial Intelligence (NUS College)",
  "school": "School of Computing",
  "totalMcTarget": 160,
  "categories": [
    { "id": "computing-foundation", "label": "Computing Foundation", "mcTarget": 20, "color": "#d4c9b8" },
    { "id": "ai-foundation", "label": "AI Foundation", "mcTarget": 20, "color": "#c9d4b8" },
    { "id": "math-sciences", "label": "Math & Sciences", "mcTarget": 20, "color": "#c6d0ca" },
    { "id": "ai-breadth-depth", "label": "AI Breadth & Depth", "mcTarget": 20, "color": "#d0c6b0" },
    { "id": "soc-common", "label": "SoC Common Curriculum", "mcTarget": 8, "color": "#abb89b" },
    { "id": "nus-college", "label": "NUS College", "mcTarget": 52, "color": "#b8c9d4" },
    { "id": "unrestricted-electives", "label": "Unrestricted Electives", "mcTarget": 20, "color": "#c3bace" }
  ],
  "requirements": [
    { "name": "Programming Methodology (CS1101S)", "fulfilledBy": ["CS1101S"], "categoryId": "soc-common" },
    { "name": "Digital and AI Ethics (IS1108)", "fulfilledBy": ["IS1108"], "categoryId": "soc-common" },
    { "name": "Design and Analysis of Algorithms (CS3230)", "fulfilledBy": ["CS3230"], "categoryId": "computing-foundation" },
    { "name": "Introduction to AI and Machine Learning (CS2109S)", "fulfilledBy": ["CS2109S"], "categoryId": "ai-foundation" },
    { "name": "Foundations of Artificial Intelligence (CS3263)", "fulfilledBy": ["CS3263"], "categoryId": "ai-foundation" },
    { "name": "Foundations of Machine Learning (CS3264)", "fulfilledBy": ["CS3264"], "categoryId": "ai-foundation" },
    { "name": "Responsible AI (CS3268)", "fulfilledBy": ["CS3268"], "categoryId": "ai-foundation" },
    { "name": "Perception (CS4243 / CS4248)", "fulfilledBy": ["CS4243", "CS4248"], "categoryId": "ai-foundation" },
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
    "CS1231S": { "code": "CS1231S", "name": "Discrete Structures", "mcs": 4 },
    "CS2030S": { "code": "CS2030S", "name": "Programming Methodology II", "mcs": 4 },
    "CS2040S": { "code": "CS2040S", "name": "Data Structures and Algorithms", "mcs": 4 },
    "CS2101": { "code": "CS2101", "name": "Effective Communication for Computing Professionals", "mcs": 4 },
    "CS2103T": { "code": "CS2103T", "name": "Software Engineering", "mcs": 4 },
    "CS3230": { "code": "CS3230", "name": "Design and Analysis of Algorithms", "mcs": 4 },
    "CS2109S": { "code": "CS2109S", "name": "Introduction to AI and Machine Learning", "mcs": 4 },
    "CS3263": { "code": "CS3263", "name": "Foundations of Artificial Intelligence", "mcs": 4 },
    "CS3264": { "code": "CS3264", "name": "Foundations of Machine Learning", "mcs": 4 },
    "CS3268": { "code": "CS3268", "name": "Responsible AI: from Algorithms to Impact", "mcs": 4 },
    "CS4243": { "code": "CS4243", "name": "Computer Vision and Pattern Recognition", "mcs": 4 },
    "CS4248": { "code": "CS4248", "name": "Natural Language Processing", "mcs": 4 },
    "CS2251": { "code": "CS2251", "name": "Optimization for Machine Learning", "mcs": 4 },
    "MA1521": { "code": "MA1521", "name": "Calculus for Computing", "mcs": 4 },
    "MA1522": { "code": "MA1522", "name": "Linear Algebra for Computing", "mcs": 4 },
    "ST2334": { "code": "ST2334", "name": "Probability and Statistics", "mcs": 4 },
    "IS1108": { "code": "IS1108", "name": "Digital and AI Ethics", "mcs": 4 },
    "NTW2035": { "code": "NTW2035", "name": "Art and the Attention Economy", "mcs": 4 },
    "GEA1000N": { "code": "GEA1000N", "name": "Quantitative Reasoning with Data", "mcs": 4 },
    "MA1301": { "code": "MA1301", "name": "Introductory Mathematics", "mcs": 4 }
  },
  "defaultPlan": [
    { "year": 1, "sem": 1, "moduleCode": "CS1101S", "categoryId": "soc-common" },
    { "year": 1, "sem": 1, "moduleCode": "CS1231S", "categoryId": "math-sciences" },
    { "year": 1, "sem": 1, "moduleCode": "MA1521", "categoryId": "math-sciences" },
    { "year": 1, "sem": 2, "moduleCode": "CS2030S", "categoryId": "computing-foundation" },
    { "year": 1, "sem": 2, "moduleCode": "CS2040S", "categoryId": "computing-foundation" },
    { "year": 1, "sem": 2, "moduleCode": "MA1522", "categoryId": "math-sciences" },
    { "year": 1, "sem": 2, "moduleCode": "NTW2035", "categoryId": "nus-college" },
    { "year": 2, "sem": 1, "moduleCode": "CS2101", "categoryId": "computing-foundation" },
    { "year": 2, "sem": 1, "moduleCode": "ST2334", "categoryId": "math-sciences" },
    { "year": 2, "sem": 1, "moduleCode": "CS2109S", "categoryId": "ai-foundation" },
    { "year": 2, "sem": 1, "moduleCode": "GEA1000N", "categoryId": "nus-college" },
    { "year": 2, "sem": 2, "moduleCode": "CS2103T", "categoryId": "computing-foundation" },
    { "year": 2, "sem": 2, "moduleCode": "CS2251", "categoryId": "math-sciences" },
    { "year": 2, "sem": 2, "moduleCode": "CS3230", "categoryId": "computing-foundation" },
    { "year": 3, "sem": 1, "moduleCode": "CS3263", "categoryId": "ai-foundation" },
    { "year": 3, "sem": 1, "moduleCode": "CS3264", "categoryId": "ai-foundation" },
    { "year": 3, "sem": 1, "moduleCode": "IS1108", "categoryId": "soc-common" },
    { "year": 3, "sem": 2, "moduleCode": "CS3268", "categoryId": "ai-foundation" },
    { "year": 3, "sem": 2, "moduleCode": "CS4243", "categoryId": "ai-foundation" }
  ]
}
```

- [ ] **Step 2: Run the validation script**

Run: `node scripts/validate-majors.mjs`
Expected: PASS — prints `OK artificial-intelligence-nusc (7 categories, 160 MC)` alongside the CS line, exit 0.

- [ ] **Step 3: Commit**

```bash
git add shared/data/majors/artificial-intelligence-nusc.json
git commit -m "Add Artificial Intelligence (NUSC) major"
```

---

### Task 3: Business AI Systems (BAIS) major

**Files:**
- Create: `shared/data/majors/business-ai-systems-nusc.json`

**Interfaces:**
- Consumes: `scripts/validate-majors.mjs`; the `Major` schema.
- Produces: a new auto-registered major with `id: "business-ai-systems-nusc"`. (BAIS is the rebrand of the former Information Systems degree — noted in the commit message.)

- [ ] **Step 1: Write the major file**

Create `shared/data/majors/business-ai-systems-nusc.json`:

```json
{
  "id": "business-ai-systems-nusc",
  "label": "Business AI Systems (NUS College)",
  "school": "School of Computing",
  "totalMcTarget": 160,
  "categories": [
    { "id": "bais-foundation", "label": "BAIS Foundation", "mcTarget": 48, "color": "#d4c9b8" },
    { "id": "math-sciences", "label": "Math & Sciences", "mcTarget": 12, "color": "#c6d0ca" },
    { "id": "bais-electives", "label": "Programme Electives", "mcTarget": 20, "color": "#c9d4b8" },
    { "id": "soc-common", "label": "SoC Common Curriculum", "mcTarget": 8, "color": "#abb89b" },
    { "id": "nus-college", "label": "NUS College", "mcTarget": 52, "color": "#b8c9d4" },
    { "id": "unrestricted-electives", "label": "Unrestricted Electives", "mcTarget": 20, "color": "#c3bace" }
  ],
  "requirements": [
    { "name": "Programming Methodology (CS1010A)", "fulfilledBy": ["CS1010A"], "categoryId": "soc-common" },
    { "name": "Digital and AI Ethics (IS1108)", "fulfilledBy": ["IS1108"], "categoryId": "soc-common" },
    { "name": "Data Management and Visualisation (BT2102)", "fulfilledBy": ["BT2102"], "categoryId": "bais-foundation" },
    { "name": "Full-stack Software Engineering for AI Solutions I (IS2108)", "fulfilledBy": ["IS2108"], "categoryId": "bais-foundation" },
    { "name": "AI and Machine Learning Techniques I (IS2109)", "fulfilledBy": ["IS2109"], "categoryId": "bais-foundation" },
    { "name": "AI Solutioning Capstone Project (IS4108)", "fulfilledBy": ["IS4108"], "categoryId": "bais-foundation" },
    { "name": "Thinking with Writing (NTW)", "fulfilledBy": ["NTW*"], "categoryId": "nus-college" },
    { "name": "Understanding the Social World (NSW)", "fulfilledBy": ["NSW*"], "categoryId": "nus-college" },
    { "name": "Reasoning with Data (GEA1000N)", "fulfilledBy": ["GEA1000N"], "categoryId": "nus-college" },
    { "name": "Global Narratives (NGN)", "fulfilledBy": ["NGN*"], "categoryId": "nus-college" },
    { "name": "Science and Society (NSS)", "fulfilledBy": ["NSS*"], "categoryId": "nus-college" },
    { "name": "Making Connections", "fulfilledBy": ["NHS*", "NFB*", "NST*", "NFC*", "NHT*"], "count": 6, "categoryId": "nus-college" },
    { "name": "Impact Experience Project (NEP)", "fulfilledBy": ["NEP*"], "categoryId": "nus-college" }
  ],
  "moduleCatalog": {
    "CS1010A": { "code": "CS1010A", "name": "Programming Methodology", "mcs": 4 },
    "CS2030": { "code": "CS2030", "name": "Programming Methodology II", "mcs": 4 },
    "CS2040": { "code": "CS2040", "name": "Data Structures and Algorithms", "mcs": 4 },
    "BT2102": { "code": "BT2102", "name": "Data Management and Visualisation", "mcs": 4 },
    "IS2101": { "code": "IS2101", "name": "Business and Technical Communication", "mcs": 4 },
    "IS2108": { "code": "IS2108", "name": "Full-stack Software Engineering for AI Solutions I", "mcs": 4 },
    "IS2109": { "code": "IS2109", "name": "AI and Machine Learning Techniques I", "mcs": 4 },
    "IS3103": { "code": "IS3103", "name": "Digital Transformation and Leadership Communication", "mcs": 4 },
    "IS4108": { "code": "IS4108", "name": "AI Solutioning Capstone Project", "mcs": 8 },
    "CP4101": { "code": "CP4101", "name": "B.Comp. Dissertation", "mcs": 12 },
    "MA1521": { "code": "MA1521", "name": "Calculus for Computing", "mcs": 4 },
    "MA1522": { "code": "MA1522", "name": "Linear Algebra for Computing", "mcs": 4 },
    "ST2334": { "code": "ST2334", "name": "Probability and Statistics", "mcs": 4 },
    "IS1108": { "code": "IS1108", "name": "Digital and AI Ethics", "mcs": 4 },
    "NTW2035": { "code": "NTW2035", "name": "Art and the Attention Economy", "mcs": 4 },
    "GEA1000N": { "code": "GEA1000N", "name": "Quantitative Reasoning with Data", "mcs": 4 },
    "MA1301": { "code": "MA1301", "name": "Introductory Mathematics", "mcs": 4 }
  },
  "defaultPlan": [
    { "year": 1, "sem": 1, "moduleCode": "CS1010A", "categoryId": "soc-common" },
    { "year": 1, "sem": 1, "moduleCode": "MA1521", "categoryId": "math-sciences" },
    { "year": 1, "sem": 2, "moduleCode": "CS2030", "categoryId": "bais-foundation" },
    { "year": 1, "sem": 2, "moduleCode": "CS2040", "categoryId": "bais-foundation" },
    { "year": 1, "sem": 2, "moduleCode": "MA1522", "categoryId": "math-sciences" },
    { "year": 1, "sem": 2, "moduleCode": "NTW2035", "categoryId": "nus-college" },
    { "year": 2, "sem": 1, "moduleCode": "BT2102", "categoryId": "bais-foundation" },
    { "year": 2, "sem": 1, "moduleCode": "IS2101", "categoryId": "bais-foundation" },
    { "year": 2, "sem": 1, "moduleCode": "ST2334", "categoryId": "math-sciences" },
    { "year": 2, "sem": 1, "moduleCode": "GEA1000N", "categoryId": "nus-college" },
    { "year": 2, "sem": 2, "moduleCode": "IS2108", "categoryId": "bais-foundation" },
    { "year": 2, "sem": 2, "moduleCode": "IS2109", "categoryId": "bais-foundation" },
    { "year": 2, "sem": 2, "moduleCode": "IS1108", "categoryId": "soc-common" },
    { "year": 3, "sem": 1, "moduleCode": "IS3103", "categoryId": "bais-foundation" },
    { "year": 4, "sem": 1, "moduleCode": "IS4108", "categoryId": "bais-foundation" },
    { "year": 4, "sem": 2, "moduleCode": "CP4101", "categoryId": "bais-foundation" }
  ]
}
```

- [ ] **Step 2: Run the validation script**

Run: `node scripts/validate-majors.mjs`
Expected: PASS — prints `OK business-ai-systems-nusc (6 categories, 160 MC)`, exit 0.

- [ ] **Step 3: Commit**

```bash
git add shared/data/majors/business-ai-systems-nusc.json
git commit -m "Add Business AI Systems (NUSC) major (formerly Information Systems)"
```

---

### Task 4: Business Analytics major

**Files:**
- Create: `shared/data/majors/business-analytics-nusc.json`

**Interfaces:**
- Consumes: `scripts/validate-majors.mjs`; the `Major` schema.
- Produces: a new auto-registered major with `id: "business-analytics-nusc"`.

- [ ] **Step 1: Write the major file**

Create `shared/data/majors/business-analytics-nusc.json`:

```json
{
  "id": "business-analytics-nusc",
  "label": "Business Analytics (NUS College)",
  "school": "School of Computing",
  "totalMcTarget": 160,
  "categories": [
    { "id": "ba-foundation", "label": "BA Foundation", "mcTarget": 52, "color": "#d4c9b8" },
    { "id": "math-sciences", "label": "Math & Sciences", "mcTarget": 12, "color": "#c6d0ca" },
    { "id": "ba-electives", "label": "Programme Electives", "mcTarget": 20, "color": "#c9d4b8" },
    { "id": "soc-common", "label": "SoC Common Curriculum", "mcTarget": 8, "color": "#abb89b" },
    { "id": "nus-college", "label": "NUS College", "mcTarget": 52, "color": "#b8c9d4" },
    { "id": "unrestricted-electives", "label": "Unrestricted Electives", "mcTarget": 16, "color": "#c3bace" }
  ],
  "requirements": [
    { "name": "Programming Methodology (CS1010A)", "fulfilledBy": ["CS1010A"], "categoryId": "soc-common" },
    { "name": "Digital and AI Ethics (IS1108)", "fulfilledBy": ["IS1108"], "categoryId": "soc-common" },
    { "name": "Introduction to Business Analytics (BT1101)", "fulfilledBy": ["BT1101"], "categoryId": "ba-foundation" },
    { "name": "Econometrics Modeling for Business Analytics (BT2101)", "fulfilledBy": ["BT2101"], "categoryId": "ba-foundation" },
    { "name": "Application Systems Development for Business Analytics (BT3103)", "fulfilledBy": ["BT3103"], "categoryId": "ba-foundation" },
    { "name": "Business Analytics Capstone Project (BT4103)", "fulfilledBy": ["BT4103"], "categoryId": "ba-foundation" },
    { "name": "Thinking with Writing (NTW)", "fulfilledBy": ["NTW*"], "categoryId": "nus-college" },
    { "name": "Understanding the Social World (NSW)", "fulfilledBy": ["NSW*"], "categoryId": "nus-college" },
    { "name": "Reasoning with Data (GEA1000N)", "fulfilledBy": ["GEA1000N"], "categoryId": "nus-college" },
    { "name": "Global Narratives (NGN)", "fulfilledBy": ["NGN*"], "categoryId": "nus-college" },
    { "name": "Science and Society (NSS)", "fulfilledBy": ["NSS*"], "categoryId": "nus-college" },
    { "name": "Making Connections", "fulfilledBy": ["NHS*", "NFB*", "NST*", "NFC*", "NHT*"], "count": 6, "categoryId": "nus-college" },
    { "name": "Impact Experience Project (NEP)", "fulfilledBy": ["NEP*"], "categoryId": "nus-college" }
  ],
  "moduleCatalog": {
    "CS1010A": { "code": "CS1010A", "name": "Programming Methodology", "mcs": 4 },
    "BT1101": { "code": "BT1101", "name": "Introduction to Business Analytics", "mcs": 4 },
    "BT2101": { "code": "BT2101", "name": "Econometrics Modeling for Business Analytics", "mcs": 4 },
    "BT2102": { "code": "BT2102", "name": "Data Management and Visualisation", "mcs": 4 },
    "CS2030": { "code": "CS2030", "name": "Programming Methodology II", "mcs": 4 },
    "CS2040": { "code": "CS2040", "name": "Data Structures and Algorithms", "mcs": 4 },
    "IS2101": { "code": "IS2101", "name": "Business and Technical Communication", "mcs": 4 },
    "BT3103": { "code": "BT3103", "name": "Application Systems Development for Business Analytics", "mcs": 4 },
    "IS3103": { "code": "IS3103", "name": "Information Systems Leadership and Communication", "mcs": 4 },
    "BT4103": { "code": "BT4103", "name": "Business Analytics Capstone Project", "mcs": 8 },
    "BT4101": { "code": "BT4101", "name": "B.Sc. Dissertation", "mcs": 12 },
    "MA1521": { "code": "MA1521", "name": "Calculus for Computing", "mcs": 4 },
    "MA1522": { "code": "MA1522", "name": "Linear Algebra for Computing", "mcs": 4 },
    "ST2334": { "code": "ST2334", "name": "Probability and Statistics", "mcs": 4 },
    "IS1108": { "code": "IS1108", "name": "Digital and AI Ethics", "mcs": 4 },
    "NTW2035": { "code": "NTW2035", "name": "Art and the Attention Economy", "mcs": 4 },
    "GEA1000N": { "code": "GEA1000N", "name": "Quantitative Reasoning with Data", "mcs": 4 },
    "MA1301": { "code": "MA1301", "name": "Introductory Mathematics", "mcs": 4 }
  },
  "defaultPlan": [
    { "year": 1, "sem": 1, "moduleCode": "CS1010A", "categoryId": "soc-common" },
    { "year": 1, "sem": 1, "moduleCode": "BT1101", "categoryId": "ba-foundation" },
    { "year": 1, "sem": 1, "moduleCode": "MA1521", "categoryId": "math-sciences" },
    { "year": 1, "sem": 2, "moduleCode": "CS2030", "categoryId": "ba-foundation" },
    { "year": 1, "sem": 2, "moduleCode": "CS2040", "categoryId": "ba-foundation" },
    { "year": 1, "sem": 2, "moduleCode": "MA1522", "categoryId": "math-sciences" },
    { "year": 1, "sem": 2, "moduleCode": "NTW2035", "categoryId": "nus-college" },
    { "year": 2, "sem": 1, "moduleCode": "BT2101", "categoryId": "ba-foundation" },
    { "year": 2, "sem": 1, "moduleCode": "BT2102", "categoryId": "ba-foundation" },
    { "year": 2, "sem": 1, "moduleCode": "ST2334", "categoryId": "math-sciences" },
    { "year": 2, "sem": 1, "moduleCode": "GEA1000N", "categoryId": "nus-college" },
    { "year": 2, "sem": 2, "moduleCode": "IS2101", "categoryId": "ba-foundation" },
    { "year": 2, "sem": 2, "moduleCode": "BT3103", "categoryId": "ba-foundation" },
    { "year": 2, "sem": 2, "moduleCode": "IS1108", "categoryId": "soc-common" },
    { "year": 3, "sem": 1, "moduleCode": "IS3103", "categoryId": "ba-foundation" },
    { "year": 4, "sem": 1, "moduleCode": "BT4103", "categoryId": "ba-foundation" },
    { "year": 4, "sem": 2, "moduleCode": "BT4101", "categoryId": "ba-foundation" }
  ]
}
```

- [ ] **Step 2: Run the validation script**

Run: `node scripts/validate-majors.mjs`
Expected: PASS — prints `OK business-analytics-nusc (6 categories, 160 MC)`, exit 0.

- [ ] **Step 3: Commit**

```bash
git add shared/data/majors/business-analytics-nusc.json
git commit -m "Add Business Analytics (NUSC) major"
```

---

### Task 5: Information Security major

**Files:**
- Create: `shared/data/majors/information-security-nusc.json`

**Interfaces:**
- Consumes: `scripts/validate-majors.mjs`; the `Major` schema.
- Produces: a new auto-registered major with `id: "information-security-nusc"`.

- [ ] **Step 1: Write the major file**

Create `shared/data/majors/information-security-nusc.json`:

```json
{
  "id": "information-security-nusc",
  "label": "Information Security (NUS College)",
  "school": "School of Computing",
  "totalMcTarget": 160,
  "categories": [
    { "id": "computing-foundation", "label": "Computing Foundation", "mcTarget": 32, "color": "#d4c9b8" },
    { "id": "security-requirements", "label": "Security Requirements", "mcTarget": 28, "color": "#c9d4b8" },
    { "id": "industrial-experience", "label": "Industrial Experience", "mcTarget": 12, "color": "#d0c6b0" },
    { "id": "math-sciences", "label": "Math & Sciences", "mcTarget": 12, "color": "#c6d0ca" },
    { "id": "soc-common", "label": "SoC Common Curriculum", "mcTarget": 8, "color": "#abb89b" },
    { "id": "nus-college", "label": "NUS College", "mcTarget": 52, "color": "#b8c9d4" },
    { "id": "unrestricted-electives", "label": "Unrestricted Electives", "mcTarget": 16, "color": "#c3bace" }
  ],
  "requirements": [
    { "name": "Programming Methodology (CS1010)", "fulfilledBy": ["CS1010"], "categoryId": "soc-common" },
    { "name": "Digital and AI Ethics (IS1108)", "fulfilledBy": ["IS1108"], "categoryId": "soc-common" },
    { "name": "Introduction to Computer Networks (CS2105)", "fulfilledBy": ["CS2105"], "categoryId": "computing-foundation" },
    { "name": "Introduction to Information Security (CS2107)", "fulfilledBy": ["CS2107"], "categoryId": "security-requirements" },
    { "name": "Computer Security (CS3235)", "fulfilledBy": ["CS3235"], "categoryId": "security-requirements" },
    { "name": "Information Security Management (IS4231)", "fulfilledBy": ["IS4231"], "categoryId": "security-requirements" },
    { "name": "Information Security Capstone Project (IFS4205)", "fulfilledBy": ["IFS4205"], "categoryId": "security-requirements" },
    { "name": "Thinking with Writing (NTW)", "fulfilledBy": ["NTW*"], "categoryId": "nus-college" },
    { "name": "Understanding the Social World (NSW)", "fulfilledBy": ["NSW*"], "categoryId": "nus-college" },
    { "name": "Reasoning with Data (GEA1000N)", "fulfilledBy": ["GEA1000N"], "categoryId": "nus-college" },
    { "name": "Global Narratives (NGN)", "fulfilledBy": ["NGN*"], "categoryId": "nus-college" },
    { "name": "Science and Society (NSS)", "fulfilledBy": ["NSS*"], "categoryId": "nus-college" },
    { "name": "Making Connections", "fulfilledBy": ["NHS*", "NFB*", "NST*", "NFC*", "NHT*"], "count": 6, "categoryId": "nus-college" },
    { "name": "Impact Experience Project (NEP)", "fulfilledBy": ["NEP*"], "categoryId": "nus-college" }
  ],
  "moduleCatalog": {
    "CS1010": { "code": "CS1010", "name": "Programming Methodology", "mcs": 4 },
    "CS1231S": { "code": "CS1231S", "name": "Discrete Structures", "mcs": 4 },
    "CS2030": { "code": "CS2030", "name": "Programming Methodology II", "mcs": 4 },
    "CS2040C": { "code": "CS2040C", "name": "Data Structures and Algorithms", "mcs": 4 },
    "CS2100": { "code": "CS2100", "name": "Computer Organisation", "mcs": 4 },
    "CS2101": { "code": "CS2101", "name": "Effective Communication for Computing Professionals", "mcs": 4 },
    "CS2103T": { "code": "CS2103T", "name": "Software Engineering", "mcs": 4 },
    "CS2105": { "code": "CS2105", "name": "Introduction to Computer Networks", "mcs": 4 },
    "CS2106": { "code": "CS2106", "name": "Introduction to Operating Systems", "mcs": 4 },
    "CS2107": { "code": "CS2107", "name": "Introduction to Information Security", "mcs": 4 },
    "CS3235": { "code": "CS3235", "name": "Computer Security", "mcs": 4 },
    "IS4231": { "code": "IS4231", "name": "Information Security Management", "mcs": 4 },
    "IFS4205": { "code": "IFS4205", "name": "Information Security Capstone Project", "mcs": 8 },
    "MA1521": { "code": "MA1521", "name": "Calculus for Computing", "mcs": 4 },
    "MA1522": { "code": "MA1522", "name": "Linear Algebra for Computing", "mcs": 4 },
    "ST2334": { "code": "ST2334", "name": "Probability and Statistics", "mcs": 4 },
    "IS1108": { "code": "IS1108", "name": "Digital and AI Ethics", "mcs": 4 },
    "NTW2035": { "code": "NTW2035", "name": "Art and the Attention Economy", "mcs": 4 },
    "GEA1000N": { "code": "GEA1000N", "name": "Quantitative Reasoning with Data", "mcs": 4 },
    "MA1301": { "code": "MA1301", "name": "Introductory Mathematics", "mcs": 4 }
  },
  "defaultPlan": [
    { "year": 1, "sem": 1, "moduleCode": "CS1010", "categoryId": "soc-common" },
    { "year": 1, "sem": 1, "moduleCode": "CS1231S", "categoryId": "computing-foundation" },
    { "year": 1, "sem": 1, "moduleCode": "MA1521", "categoryId": "math-sciences" },
    { "year": 1, "sem": 2, "moduleCode": "CS2030", "categoryId": "computing-foundation" },
    { "year": 1, "sem": 2, "moduleCode": "CS2040C", "categoryId": "computing-foundation" },
    { "year": 1, "sem": 2, "moduleCode": "MA1522", "categoryId": "math-sciences" },
    { "year": 1, "sem": 2, "moduleCode": "NTW2035", "categoryId": "nus-college" },
    { "year": 2, "sem": 1, "moduleCode": "CS2100", "categoryId": "computing-foundation" },
    { "year": 2, "sem": 1, "moduleCode": "CS2101", "categoryId": "computing-foundation" },
    { "year": 2, "sem": 1, "moduleCode": "ST2334", "categoryId": "math-sciences" },
    { "year": 2, "sem": 1, "moduleCode": "GEA1000N", "categoryId": "nus-college" },
    { "year": 2, "sem": 2, "moduleCode": "CS2103T", "categoryId": "computing-foundation" },
    { "year": 2, "sem": 2, "moduleCode": "CS2105", "categoryId": "computing-foundation" },
    { "year": 2, "sem": 2, "moduleCode": "CS2107", "categoryId": "security-requirements" },
    { "year": 2, "sem": 2, "moduleCode": "IS1108", "categoryId": "soc-common" },
    { "year": 3, "sem": 1, "moduleCode": "CS2106", "categoryId": "computing-foundation" },
    { "year": 3, "sem": 1, "moduleCode": "CS3235", "categoryId": "security-requirements" },
    { "year": 3, "sem": 2, "moduleCode": "IS4231", "categoryId": "security-requirements" },
    { "year": 4, "sem": 1, "moduleCode": "IFS4205", "categoryId": "security-requirements" }
  ]
}
```

- [ ] **Step 2: Run the validation script**

Run: `node scripts/validate-majors.mjs`
Expected: PASS — prints `OK information-security-nusc (7 categories, 160 MC)` and `All majors valid.`, exit 0.

- [ ] **Step 3: Commit**

```bash
git add shared/data/majors/information-security-nusc.json
git commit -m "Add Information Security (NUSC) major"
```

---

### Task 6: Integration verification

**Files:**
- No new files. Verifies all five majors load and render in the app.

**Interfaces:**
- Consumes: all four new major files (Tasks 2–5) plus the existing CS major, loaded via `import.meta.glob` in `src/hooks/useStudyPlan.ts`.

- [ ] **Step 1: Typecheck / build the whole app**

Run: `npm run build`
Expected: PASS — `tsc --noEmit` reports no errors and `vite build` succeeds. The JSON files are imported (via `import.meta.glob`) and cast to `Major`; a malformed JSON or wrong shape would surface here.

- [ ] **Step 2: Run the app and verify each major in the dev server**

Start the dev server (via the preview tooling / `npm run dev`) and, for each of the five majors:
1. Select the major from the major-picker dropdown (in `StudyPlan.tsx`).
2. Confirm the requirements checklist renders grouped by category with no crash.
3. Confirm the default plan populates the semester grid (AI, BAIS, BA, InfoSec each front-load their core into Y1–Y3, with capstone/IE in Y4 for BAIS/BA/InfoSec).
4. Confirm the stats summary shows category MC progress totaling toward 160.

Check the browser console for errors (there should be none). Capture a screenshot of at least one new major (e.g. Artificial Intelligence) for the completion report.

- [ ] **Step 3: Final commit (if any docs/notes changed)**

No code changes expected in this task. If Step 2 surfaced a data bug, fix it in the relevant major file, re-run `node scripts/validate-majors.mjs` and `npm run build`, and commit the fix with message `Fix <major> data: <what>`.

---

## Notes for the implementer

- **Reference file:** `shared/data/majors/computer-science-nusc.json` is the canonical template — match its formatting, key ordering, and color style.
- **The NUS College block** (categories `nus-college`/`soc-common`, the 7 `nus-college` requirement rows, and the shared catalog codes `IS1108`/`MA1521`/`MA1522`/`ST2334`/`NTW2035`/`GEA1000N`/`MA1301`) is intentionally duplicated across all four files — do not try to factor it out (the schema has no cross-file sharing; spec: "Shared approach").
- **Capstone/IE MC weights:** `IS4108`, `BT4103`, `IFS4205` are 8 MC; `CP4101`, `BT4101` are 12 MC. All other modules are 4 MC.
- **Do not touch `computer-science-nusc.json`.**
```
