import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', 'shared', 'data', 'majors');

const errors = [];
const seenIds = new Set();

for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  let major;
  try {
    major = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  } catch (err) {
    console.error(`FAIL ${file}: invalid JSON (${err.message})`);
    errors.push(`FAIL ${file}: invalid JSON (${err.message})`);
    continue;
  }

  const idKey = major.id ?? file;
  const fail = (msg) => errors.push(`FAIL ${idKey}: ${msg}`);

  if (!major.id) fail('missing id');
  if ((major.categories ?? []).length === 0) fail('missing or empty categories');
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

  const checkCode = (context, code) => {
    if (!major.moduleCatalog?.[code]) fail(`${context} code "${code}" not in moduleCatalog`);
  };

  if (major.breadthDepth) {
    const bd = major.breadthDepth;
    if (!catIds.has(bd.categoryId)) fail(`breadthDepth categoryId "${bd.categoryId}" not a category`);
    for (const code of bd.industryExperience?.courses ?? []) checkCode('breadthDepth.industryExperience', code);
    if (bd.industryExperience?.dissertationAlternative) {
      checkCode('breadthDepth.industryExperience.dissertationAlternative', bd.industryExperience.dissertationAlternative);
    }
    for (const code of bd.technicalElectives?.courses ?? []) checkCode('breadthDepth.technicalElectives', code);
  }

  if (major.programmeElectives) {
    const pe = major.programmeElectives;
    if (!catIds.has(pe.categoryId)) fail(`programmeElectives categoryId "${pe.categoryId}" not a category`);
    for (const cat of pe.categories ?? []) {
      for (const code of cat.courses ?? []) checkCode(`programmeElectives.categories[${cat.id}]`, code);
    }
    for (const spec of pe.specialisations ?? []) {
      for (const code of spec.courses ?? []) checkCode(`programmeElectives.specialisations[${spec.id}]`, code);
    }
  }

  if (errors.every((e) => !e.startsWith(`FAIL ${idKey}:`))) {
    console.log(`OK ${idKey} (${(major.categories ?? []).length} categories, ${major.totalMcTarget} MC)`);
  }
}

if (errors.length) {
  for (const e of errors) console.error(e);
  process.exit(1);
}
console.log('All majors valid.');
