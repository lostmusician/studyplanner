import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const DIRS = [
  { name: 'second-majors', path: join(here, '..', 'shared', 'data', 'second-majors'), kind: 'second-major' },
  { name: 'minors', path: join(here, '..', 'shared', 'data', 'minors'), kind: 'minor' },
];

const errors = [];

for (const dir of DIRS) {
  const seenIds = new Set();

  for (const file of readdirSync(dir.path).filter((f) => f.endsWith('.json'))) {
    let programme;
    try {
      programme = JSON.parse(readFileSync(join(dir.path, file), 'utf8'));
    } catch (err) {
      console.error(`FAIL ${dir.name}/${file}: invalid JSON (${err.message})`);
      errors.push(`FAIL ${dir.name}/${file}: invalid JSON (${err.message})`);
      continue;
    }

    const idKey = `${dir.name}/${programme.id ?? file}`;
    const fail = (msg) => errors.push(`FAIL ${idKey}: ${msg}`);

    if (!programme.id) fail('missing id');
    if (!programme.label) fail('missing label');
    if (programme.kind !== dir.kind) {
      fail(`expected kind "${dir.kind}" for a file under ${dir.name}/, got "${programme.kind}"`);
    }
    if (typeof programme.mcTarget !== 'number' || programme.mcTarget <= 0) {
      fail('missing or invalid mcTarget');
    }
    if (seenIds.has(programme.id)) fail(`duplicate id "${programme.id}" within ${dir.name}/`);
    seenIds.add(programme.id);

    for (const req of programme.requirements ?? []) {
      for (const f of req.fulfilledBy ?? []) {
        if (!f.endsWith('*') && programme.moduleCatalog && !programme.moduleCatalog[f]) {
          fail(`requirement "${req.name}" fulfilledBy "${f}" not in moduleCatalog`);
        }
      }
    }

    for (const [code, mod] of Object.entries(programme.moduleCatalog ?? {})) {
      if (mod.code !== code) fail(`catalog key "${code}" !== module.code "${mod.code}"`);
    }

    if (errors.every((e) => !e.startsWith(`FAIL ${idKey}:`))) {
      console.log(`OK ${idKey} (${(programme.requirements ?? []).length} requirements, ${programme.mcTarget} MC)`);
    }
  }
}

if (errors.length) {
  for (const e of errors) console.error(e);
  process.exit(1);
}
console.log('All second majors and minors valid.');
