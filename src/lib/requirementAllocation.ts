import type { Major, PlacedModule, RequirementRule, SecondaryProgramme, SpecialProgramme, StudentSemester, WaivedModule } from '@shared/types';
import { computeBreadthDepth, computeProgrammeElectives, computeRequirements, matchesAnyRequirement, matchesFulfiller, type RequirementStatus } from './studyPlan';

export const allocationKey = (source: Major | SecondaryProgramme): string =>
  `${'kind' in source ? source.kind : 'primary'}:${source.id}`;

export interface AllocatedRequirement extends RequirementStatus {
  id: string;
  codes: string[];
  eligibleCodes: string[];
  /** Category eligibility is supplied by the student's category choices. */
  categoryBased?: boolean;
  unit: 'MC' | 'courses' | 'checks';
}

export interface ProgrammeAllocation {
  key: string;
  id: string;
  label: string;
  kind: 'primary' | SecondaryProgramme['kind'];
  rows: AllocatedRequirement[];
  usedCodes: string[];
  sharedCodes: string[];
  sharedMc: number;
  capMc: number | null;
  usedMc: number;
}

export interface AllocationReport {
  programmes: ProgrammeAllocation[];
  courseUses: Record<string, { programmeKey: string; programmeLabel: string; rows: string[] }[]>;
  conflicts: string[];
  manualIssues: string[];
  unavailableRequirements: string[];
  complete: boolean;
  /** A valid complete result is still a witness even when optimisation was bounded. */
  searchLimited: boolean;
}

interface Row {
  id: string;
  name: string;
  programme: number;
  candidates: string[];
  group?: string;
  categoryBased?: boolean;
  unit: AllocatedRequirement['unit'];
  evaluate: (codes: string[]) => RequirementStatus;
}
interface Option { codes: string[]; status: RequirementStatus }
interface State {
  choices: Option[];
  uses: Set<string>[];
  groups: Map<string, Set<string>>;
  primaryMissing: number;
  primaryDeficit: number;
  secondaryMissing: number;
  secondaryDeficit: number;
  score: number[];
  signature: string;
}

const compareScore = (a: number[], b: number[]): number => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
};
const compareStates = (a: State, b: State) => compareScore(a.score, b.score) || a.signature.localeCompare(b.signature);
const primaryCategory = (id: string) => id !== 'unrestricted-electives' && !id.startsWith('minor-') && !id.startsWith('second-major-');

/** Allocate actual course subsets across all declared programmes. The search
 * never certifies infeasibility after pruning. Manual includes remain visible
 * even when they exceed an allowance, rather than silently discarding a choice.
 * Curriculum eligibility comes exclusively from the supplied rules/mappings. */
export const allocateRequirements = (
  primary: Major,
  secondaries: SecondaryProgramme[],
  semesters: StudentSemester[],
  waivedModules: WaivedModule[] = [],
  mappings: Record<string, string[]> = {},
  pathways: SpecialProgramme[] = [],
  limits: { subsetsPerRow?: number; optionsPerRow?: number; beamWidth?: number } = {},
): AllocationReport => {
  const subsetLimit = limits.subsetsPerRow ?? 4096;
  const optionLimit = limits.optionsPerRow ?? 48;
  const beamWidth = limits.beamWidth ?? 96;
  const sources = [primary, ...secondaries];
  const modules = new Map<string, PlacedModule>();
  for (const m of [...semesters.flatMap(s => s.modules), ...waivedModules]) if (!modules.has(m.code)) modules.set(m.code, m);
  const codes = [...modules.keys()].sort();
  const credit = (code: string) => modules.get(code)?.mcs ?? 0;
  const sum = (selected: Iterable<string>) => [...selected].reduce((total, code) => total + credit(code), 0);
  // Prefer courses with fewer competing uses; the joint search still explores alternatives.
  const riskCache = sources.map((_, p) => new Map(codes.map(code => [code,
    sources.reduce((n, source, i) => n + Number(i !== p && matchesAnyRequirement(source.requirements, code)), 0)])));
  const risk = (code: string, p: number) => riskCache[p].get(code) ?? 0;
  const eligible = (code: string, rule: RequirementRule, mapped: string[] = []) =>
    !(rule.excludedCodes ?? []).some(pattern => matchesFulfiller(code, pattern)) &&
    (rule.fulfilledBy.some(pattern => matchesFulfiller(code, pattern)) ||
      rule.altGroups?.some(group => group.includes(code)) || mapped.includes(code) ||
      (rule.name === 'Making Connections' && /^NEX\d/.test(code)));
  const rows: Row[] = [];
  const addRule = (rule: RequirementRule, programme: number, id: string, candidates: string[], categoryBased = false) => {
    rows.push({
      id, name: rule.name, programme, candidates, group: rule.allocationGroup, categoryBased,
      unit: rule.minUnits !== undefined ? 'MC' : rule.altGroups?.length ? 'checks' : 'courses',
      evaluate: selected => computeRequirements({ requirements: [rule] }, semesters, waivedModules,
        programme === 0 ? mappings : {}, pathways, { [rule.name]: selected })[0],
    });
  };

  for (let p = 0; p < sources.length; p++) {
    const source = sources[p];
    for (const rule of source.requirements) {
      addRule(rule, p, `requirement:${rule.name}`, codes.filter(code => eligible(code, rule, p === 0 ? mappings[rule.name] : [])));
    }
    if (p === 0) {
      // Credit targets use placed credits, including the repeated NEP slots.
      // A waived prerequisite can satisfy a named row but is not extra degree credit.
      for (const cat of primary.categories.filter(c => primaryCategory(c.id) && (c.mcTarget ?? 0) > 0)) {
        const credits = new Map<string, number>();
        for (const m of semesters.flatMap(s => s.modules).filter(m => m.categoryId === cat.id)) credits.set(m.code, (credits.get(m.code) ?? 0) + m.mcs);
        rows.push({
          id: `category:${cat.id}`, name: `${cat.label} credits`, programme: 0,
          candidates: [...credits.keys()].sort(), categoryBased: true, unit: 'MC',
          evaluate: selected => {
            const have = selected.reduce((n, code) => n + (credits.get(code) ?? 0), 0);
            return { name: `${cat.label} credits`, categoryId: cat.id, have, need: cat.mcTarget!, fulfilled: have >= cat.mcTarget! };
          },
        });
      }
      const advanced = [
        { id: 'breadth-depth', name: 'Breadth & Depth constraints', category: primary.breadthDepth?.categoryId, compute: computeBreadthDepth },
        { id: 'programme-electives', name: 'Programme Electives constraints', category: primary.programmeElectives?.categoryId, compute: computeProgrammeElectives },
      ];
      for (const cfg of advanced) {
        if (!cfg.category) continue;
        const focusCodes = new Set(primary.focusAreas?.flatMap(a => a.primaries) ?? []);
        rows.push({
          id: cfg.id, name: cfg.name, programme: 0, unit: 'checks',
          candidates: codes.filter(code => modules.get(code)?.categoryId === cfg.category || focusCodes.has(code)),
          evaluate: selected => {
            const chosen = new Set(selected);
            const filtered = semesters.map(s => ({ ...s, modules: s.modules.filter(m => chosen.has(m.code)) }));
            const status = cfg.compute(primary, filtered, waivedModules.filter(m => chosen.has(m.code)))!;
            const have = status.constraints.filter(c => c.fulfilled).length;
            return { name: cfg.name, have, need: status.constraints.length, fulfilled: have === status.constraints.length,
              info: status.constraints.filter(c => !c.fulfilled).map(c => c.label).join('; ') || undefined };
          },
        });
      }
    } else if (source.requirements.length) {
      // Checklist rows can overlap; credit toward the programme is unique by code.
      addRule({ name: `${source.label} total credits`, minUnits: (source as SecondaryProgramme).mcTarget,
        fulfilledBy: codes.filter(code => source.requirements.some(rule => eligible(code, rule))) },
      p, 'programme-total', codes.filter(code => source.requirements.some(rule => eligible(code, rule))));
    }
  }

  // Most-constrained rows first within each programme. Stable IDs make results
  // independent of semester ordering and keep saved overrides attached to a row.
  const displayOrder = new Map(rows.map((row, i) => [`${row.programme}:${row.id}`, i]));
  rows.sort((a, b) => a.programme - b.programme || a.candidates.length - b.candidates.length || a.id.localeCompare(b.id));
  let searchLimited = false;
  const manualIssues: string[] = [];
  const unavailableRequirements: string[] = [];
  const rowOptions = rows.map(row => {
    const source = sources[row.programme];
    const key = allocationKey(source);
    const preference = (code: string) => modules.get(code)?.allocationPreferences?.[key]?.[row.id];
    const allowed = row.candidates.filter(code =>
      preference(code) !== 'exclude' && (row.programme === 0 || !modules.get(code)?.excludedProgrammeIds?.includes(source.id)));
    const forced = allowed.filter(code => preference(code) === 'include');
    for (const code of codes) {
      if (preference(code) === 'include' && !allowed.includes(code)) manualIssues.push(`${code} cannot be assigned to ${source.label} → ${row.name}. Clear its manual choice.`);
    }
    const rest = allowed.filter(code => !forced.includes(code)).sort((a, b) => risk(a, row.programme) - risk(b, row.programme) || credit(a) - credit(b) || a.localeCompare(b));
    const options: Option[] = [];
    let visited = 0;
    let rowLimited = false;
    const visit = (selected: string[], start: number) => {
      if (visited >= subsetLimit) { searchLimited = true; rowLimited = true; return; }
      visited++;
      const status = row.evaluate(selected);
      options.push({ codes: [...selected].sort(), status });
      // Supersets of a satisfied row cannot improve its progress or sharing cost.
      if (status.fulfilled) return;
      for (let i = start; i < rest.length; i++) {
        visit([...selected, rest[i]], i + 1);
        if (visited >= subsetLimit) break;
      }
      if (visited >= subsetLimit && start < rest.length) { searchLimited = true; rowLimited = true; }
    };
    visit(forced, 0);
    if (!rowLimited && !options.some(option => option.status.fulfilled)) unavailableRequirements.push(`${source.label}: ${row.name}`);
    options.sort((a, b) => Number(b.status.fulfilled) - Number(a.status.fulfilled) ||
      Math.min(b.status.have, b.status.need) / (b.status.need || 1) - Math.min(a.status.have, a.status.need) / (a.status.need || 1) ||
      sum(a.codes) - sum(b.codes) || a.codes.join('|').localeCompare(b.codes.join('|')));
    if (options.length <= optionLimit) return options;
    searchLimited = true;
    // Keep incomplete options too: an honest gap is preferable to illegal sharing.
    const full = options.filter(o => o.status.fulfilled);
    const partial = options.filter(o => !o.status.fulfilled);
    const kept = [...full.slice(0, Math.ceil(optionLimit / 2)), ...partial.slice(0, Math.floor(optionLimit / 2))];
    if (!kept.some(o => o.codes.length === forced.length)) kept.push({ codes: forced, status: row.evaluate(forced) });
    return kept;
  });

  const sharing = (uses: Set<string>[]) => {
    const count = new Map<string, number>();
    uses.forEach(set => set.forEach(code => count.set(code, (count.get(code) ?? 0) + 1)));
    const conflicts = [...count].filter(([, n]) => n > 2).map(([code]) => code).sort();
    const shared = uses.map(set => [...set].filter(code => (count.get(code) ?? 0) > 1));
    const excess = shared.reduce((n, set, p) => p === 0 ? n : n + Math.max(0, sum(set) - secondaries[p - 1].mcTarget * 0.4), 0);
    return { conflicts, shared, violations: excess + conflicts.length * 100 };
  };
  let beam: State[] = [{ choices: [], uses: sources.map(() => new Set()), groups: new Map(), primaryMissing: 0,
    primaryDeficit: 0, secondaryMissing: 0, secondaryDeficit: 0, score: [], signature: '' }];
  rows.forEach((row, index) => {
    const next: State[] = [];
    const groupKey = row.group ? `${row.programme}:${row.group}` : undefined;
    for (const state of beam) {
      const group = groupKey ? state.groups.get(groupKey) : undefined;
      for (const option of rowOptions[index]) {
        if (option.codes.some(code => group?.has(code))) continue;
        const uses = state.uses.map((set, p) => p === row.programme ? new Set([...set, ...option.codes]) : set);
        const groups = new Map(state.groups);
        if (groupKey) groups.set(groupKey, new Set([...(group ?? []), ...option.codes]));
        const deficit = option.status.fulfilled ? 0 : Math.max(0, option.status.need - option.status.have) / (option.status.need || 1);
        const missing = Number(!option.status.fulfilled);
        const primaryMissing = state.primaryMissing + (row.programme === 0 ? missing : 0);
        const primaryDeficit = state.primaryDeficit + (row.programme === 0 ? deficit : 0);
        const secondaryMissing = state.secondaryMissing + (row.programme === 0 ? 0 : missing);
        const secondaryDeficit = state.secondaryDeficit + (row.programme === 0 ? 0 : deficit);
        const { violations, shared } = sharing(uses);
        next.push({ choices: [...state.choices, option], uses, groups, primaryMissing, primaryDeficit, secondaryMissing, secondaryDeficit,
          score: [primaryMissing, primaryDeficit, violations, secondaryMissing, secondaryDeficit, shared.reduce((n, set) => n + sum(set), 0), uses.reduce((n, set) => n + sum(set), 0),
            uses.reduce((n, set, p) => n + [...set].reduce((r, code) => r + risk(code, p), 0), 0)],
          signature: `${state.signature};${option.codes.join(',')}` });
      }
    }
    if (!next.length) {
      // Conflicting pins within a non-reuse group: keep the plan inspectable.
      const option = { codes: [] as string[], status: row.evaluate([]) };
      manualIssues.push(`Conflicting manual choices in ${sources[row.programme].label} → ${row.name}. Clear a choice in this allocation group.`);
      beam = beam.map(state => ({ ...state, choices: [...state.choices, option] }));
      return;
    }
    next.sort(compareStates);
    // The same programme usage and allocation-group usage has identical future
    // sharing opportunities; retain its best row assignment only.
    const seen = new Set<string>();
    beam = [];
    for (const state of next) {
      const signature = JSON.stringify([state.uses.map(set => [...set].sort()), [...state.groups].map(([key, set]) => [key, [...set].sort()])]);
      if (seen.has(signature)) continue;
      seen.add(signature);
      if (beam.length === beamWidth) { searchLimited = true; break; }
      beam.push(state);
    }
  });

  const best = beam.sort(compareStates)[0];
  const shared = sharing(best.uses);
  const programmes: ProgrammeAllocation[] = sources.map((source, p) => ({
    key: allocationKey(source), id: source.id, label: source.label, kind: p === 0 ? 'primary' : (source as SecondaryProgramme).kind,
    rows: rows.flatMap((row, i) => row.programme === p ? [{ ...best.choices[i].status, id: row.id, codes: best.choices[i].codes,
      eligibleCodes: row.candidates, categoryBased: row.categoryBased, unit: row.unit }] : [])
      .sort((a, b) => displayOrder.get(`${p}:${a.id}`)! - displayOrder.get(`${p}:${b.id}`)!),
    usedCodes: [...best.uses[p]].sort(), sharedCodes: shared.shared[p], sharedMc: sum(shared.shared[p]),
    capMc: p === 0 ? null : (source as SecondaryProgramme).mcTarget * 0.4,
    usedMc: p === 0 ? semesters.flatMap(s => s.modules).filter(m => best.uses[0].has(m.code)).reduce((n, m) => n + m.mcs, 0) : sum(best.uses[p]),
  }));
  const courseUses = Object.fromEntries(codes.map(code => [code, programmes.filter(p => p.usedCodes.includes(code)).map(p => ({
    programmeKey: p.key, programmeLabel: p.label, rows: p.rows.filter(row => row.codes.includes(code)).map(row => row.name),
  }))]));
  return { programmes, courseUses, conflicts: shared.conflicts, manualIssues: [...new Set(manualIssues)], unavailableRequirements, searchLimited,
    complete: programmes.every(p => p.rows.length > 0 && p.rows.every(row => row.fulfilled)) && !shared.violations && !manualIssues.length };
};
