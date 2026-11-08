import { describe, expect, it } from 'vitest';
import type { Major, PlacedModule, SecondaryProgramme, StudentSemester } from '@shared/types';
import { allocateRequirements, allocationKey } from './requirementAllocation';
import { withAllocationChoice, normalizeAllocationPreferences } from '@shared/allocationPreferences';

const primary: Major = { id: 'main', label: 'Primary', school: 'Test', batches: [], totalMcTarget: 160,
  categories: [{ id: 'foundation', label: 'Foundation', color: '#aaa', mcTarget: 12 }], requirements: [], moduleCatalog: {}, defaultPlan: [] };
const course = (code: string, categoryId = 'foundation', mcs = 4): PlacedModule => ({ code, name: code, mcs, categoryId });
const plan = (modules: PlacedModule[]): StudentSemester[] => [{ year: 1, sem: 1, modules }];
const minor = (id: string, courses: string[], count = 5): SecondaryProgramme => ({ id, label: id, kind: 'minor', mcTarget: 20,
  requirements: [{ name: 'Electives', fulfilledBy: courses, count }], moduleCatalog: {} });
const used = (report: ReturnType<typeof allocateRequirements>, id: string) => report.programmes.find(p => p.id === id)!;

describe('joint requirement allocation', () => {
  it('uses just two shared electives instead of reporting every eligible course as shared', () => {
    const modules = ['A', 'B', 'C'].map(code => course(code));
    const extras = ['D', 'E', 'F'].map(code => course(code, 'unrestricted-electives'));
    const secondary = minor('minor', ['A', 'B', 'C', 'D', 'E', 'F']);
    const report = allocateRequirements(primary, [secondary], plan([...modules, ...extras]));
    expect(report.complete).toBe(true);
    expect(used(report, 'minor').sharedMc).toBe(8);
    expect(used(report, 'minor').usedCodes).toHaveLength(5);
    expect(used(report, 'minor').rows.find(r => r.id === 'requirement:Electives')?.codes).toHaveLength(5);
    expect(report.courseUses['C'].length + report.courseUses['B'].length + report.courseUses['A'].length).toBe(5);
  });

  it('prefers a dedicated eligible course over unnecessary sharing', () => {
    const secondary = minor('minor', ['A', 'D', 'E', 'F', 'G', 'H']);
    const report = allocateRequirements(primary, [secondary], plan([
      ...['A', 'B', 'C'].map(code => course(code)), ...['D', 'E', 'F', 'G', 'H'].map(code => course(code, 'unrestricted-electives')),
    ]));
    expect(report.complete).toBe(true);
    expect(used(report, 'minor').sharedMc).toBe(0);
    expect(used(report, 'minor').usedCodes).not.toContain('A');
  });

  it('detects primary usage from a named requirement even when the course is tagged UE', () => {
    const main = { ...primary, requirements: [{ name: 'Required A', fulfilledBy: ['A'] }] };
    const secondary = minor('minor', ['A', 'D', 'E', 'F', 'G']);
    const report = allocateRequirements(main, [secondary], plan([
      ...['B', 'C', 'X'].map(code => course(code)), ...['A', 'D', 'E', 'F', 'G'].map(code => course(code, 'unrestricted-electives')),
    ]));
    expect(report.complete).toBe(true);
    expect(used(report, 'minor').sharedCodes).toEqual(['A']);
    expect(report.courseUses.A[0].rows).toContain('Required A');
  });

  it('chooses alternatives jointly to avoid using a primary course in two minors', () => {
    const one = minor('one', ['A', 'D', 'E', 'F', 'G']);
    const two = minor('two', ['A', 'H', 'I', 'J', 'K', 'L']);
    const report = allocateRequirements(primary, [one, two], plan([
      ...['A', 'B', 'C'].map(code => course(code)), ...['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'].map(code => course(code, 'unrestricted-electives')),
    ]));
    expect(report.complete).toBe(true);
    expect(report.conflicts).toEqual([]);
    expect(used(report, 'two').usedCodes).not.toContain('A');
  });

  it('allows one elective to serve two secondary programmes when the primary does not use it', () => {
    const one = minor('one', ['X', 'D', 'E', 'F', 'G']);
    const two = minor('two', ['X', 'H', 'I', 'J', 'K']);
    const report = allocateRequirements(primary, [one, two], plan([
      ...['A', 'B', 'C'].map(code => course(code)), ...['X', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'].map(code => course(code, 'unrestricted-electives')),
    ]));
    expect(report.complete).toBe(true);
    expect(report.conflicts).toEqual([]);
    expect(report.courseUses.X).toHaveLength(2);
  });

  it('shows honest requirement gaps when courses cannot fit the sharing cap', () => {
    const secondary = minor('minor', ['A', 'B', 'C', 'D', 'E']);
    const report = allocateRequirements(primary, [secondary], plan([
      ...['A', 'B', 'C'].map(code => course(code)), ...['D', 'E'].map(code => course(code, 'unrestricted-electives')),
    ]));
    expect(report.complete).toBe(false);
    expect(used(report, 'main').rows.every(r => r.fulfilled)).toBe(true);
    expect(used(report, 'minor').sharedMc).toBeLessThanOrEqual(8);
    expect(used(report, 'minor').rows.some(r => !r.fulfilled)).toBe(true);
  });

  it('retains manual assignments and visibly reports an allowance violation', () => {
    const secondary = minor('minor', ['A', 'B', 'C', 'D', 'E']);
    const modules = ['A', 'B', 'C'].map(code => withAllocationChoice(course(code), allocationKey(secondary), 'requirement:Electives', 'include'));
    const report = allocateRequirements(primary, [secondary], plan([...modules, ...['D', 'E'].map(code => course(code, 'unrestricted-electives'))]));
    expect(report.complete).toBe(false);
    expect(used(report, 'minor').sharedMc).toBe(12);
    expect(used(report, 'minor').usedCodes).toEqual(['A', 'B', 'C', 'D', 'E']);
  });

  it('keeps alternatives, equivalent courses, and allocation groups consistent', () => {
    const secondary: SecondaryProgramme = { ...minor('minor', []), mcTarget: 12, requirements: [
      { name: 'Capstone', fulfilledBy: ['Z'], altGroups: [['D', 'E']], allocationGroup: 'exclusive' },
      { name: 'Other', fulfilledBy: ['D', 'F'], allocationGroup: 'exclusive' },
      { name: 'Equivalent courses', fulfilledBy: ['D', 'D1', 'F'], count: 2, equivalentGroups: [['D', 'D1']] },
    ] };
    const report = allocateRequirements(primary, [secondary], plan([...['A', 'B', 'C'].map(code => course(code)),
      ...['D', 'D1', 'E', 'F'].map(code => course(code, 'unrestricted-electives'))]));
    const rows = used(report, 'minor').rows;
    expect(report.complete).toBe(true);
    expect(rows.find(r => r.name === 'Capstone')?.codes).toEqual(['D', 'E']);
    expect(rows.find(r => r.name === 'Other')?.codes).toEqual(['F']);
    expect(rows.find(r => r.name === 'Equivalent courses')?.codes).toContain('F');
  });

  it('evaluates conditional rows against the full plan rather than hiding their trigger', () => {
    const main = { ...primary, requirements: [{ name: 'Companion', whenCourse: 'A', fulfilledBy: ['Z'] }] };
    const report = allocateRequirements(main, [], plan(['A', 'B', 'C'].map(code => course(code))));
    expect(used(report, 'main').rows.find(r => r.name === 'Companion')?.fulfilled).toBe(false);
  });

  it('respects exclusions on alternative groups and legacy programme opt-outs', () => {
    const secondary = { ...minor('minor', ['A', 'D', 'E', 'F', 'G']), requirements: [
      { name: 'Alternative', fulfilledBy: [], altGroups: [['A', 'D']], excludedCodes: ['A'] },
      { name: 'Electives', fulfilledBy: ['A', 'D', 'E', 'F', 'G'], count: 5 },
    ] };
    const report = allocateRequirements(primary, [secondary], plan([...['A', 'B', 'C'].map(code => course(code)),
      ...['D', 'E', 'F', 'G'].map(code => ({ ...course(code, 'unrestricted-electives'), excludedProgrammeIds: ['minor'] }))]));
    expect(report.complete).toBe(false);
    expect(used(report, 'minor').rows.find(r => r.name === 'Alternative')?.fulfilled).toBe(false);
    expect(used(report, 'minor').usedCodes).not.toContain('D');
  });

  it('counts repeated primary-credit slots but deduplicates secondary course usage', () => {
    const main = { ...primary, categories: [{ ...primary.categories[0], mcTarget: 8 }] };
    const report = allocateRequirements(main, [], [{ year: 1, sem: 1, modules: [course('NEP2001A', 'foundation', 2)] },
      { year: 1, sem: 2, modules: [course('NEP2001A', 'foundation', 2)] },
      { year: 2, sem: 1, modules: [course('NEP2001A', 'foundation', 2)] },
      { year: 2, sem: 2, modules: [course('NEP2001A', 'foundation', 2)] }]);
    expect(report.complete).toBe(true);
    expect(used(report, 'main').rows[0].have).toBe(8);
    expect(used(report, 'main').usedCodes).toEqual(['NEP2001A']);
  });

  it('distinguishes search exhaustion from proof that no allocation exists', () => {
    const report = allocateRequirements(primary, [minor('minor', ['A', 'B', 'C', 'D', 'E'])],
      plan(['A', 'B', 'C', 'D', 'E'].map(code => course(code))), [], {}, [], { subsetsPerRow: 1, optionsPerRow: 2, beamWidth: 1 });
    expect(report.complete).toBe(false);
    expect(report.searchLimited).toBe(true);
  });

  it('is deterministic under semester and course reordering', () => {
    const secondary = minor('minor', ['A', 'B', 'C', 'D', 'E', 'F']);
    const modules = [...['A', 'B', 'C'].map(code => course(code)), ...['D', 'E', 'F'].map(code => course(code, 'unrestricted-electives'))];
    expect(allocateRequirements(primary, [secondary], plan(modules)).programmes)
      .toEqual(allocateRequirements(primary, [secondary], plan([...modules].reverse())).programmes);
  });
});

describe('allocation preferences', () => {
  it('validates imported data and can reset a row to automatic', () => {
    expect(normalizeAllocationPreferences({ bad: [], test: { a: 'include', b: 'exclude', c: true } }))
      .toEqual({ test: { a: 'include', b: 'exclude' } });
    const pinned = withAllocationChoice(course('A'), 'minor:one', 'row', 'include');
    expect(withAllocationChoice(pinned, 'minor:one', 'row').allocationPreferences).toEqual({});
  });
});

describe('curriculum integration', () => {
  const majors = Object.values(import.meta.glob('../../shared/data/majors/*.json', { eager: true }))
    .map(m => (m as { default: Major }).default);
  it.each(majors)('preserves all primary template checks for $id', async main => {
    const { defaultPlanToSemesters, computeRequirements } = await import('./studyPlan');
    const semesters = defaultPlanToSemesters(main);
    const report = allocateRequirements(main, [], semesters, main.defaultWaivedModules, {}, ['sep']);
    const baseline = computeRequirements(main, semesters, main.defaultWaivedModules, {}, ['sep']);
    for (const row of baseline.filter(row => row.fulfilled)) {
      expect(report.programmes[0].rows.find(result => result.name === row.name)?.fulfilled, row.name).toBe(true);
    }
    expect(report.programmes[0].rows.filter(row => row.categoryBased).every(row => row.fulfilled)).toBe(true);
  });
});

describe('sharing across secondary programmes', () => {
  it('applies the minor allowance to overlap with another minor too', () => {
    const one = minor('one', ['X', 'Y', 'Z', 'D', 'E']);
    const two = minor('two', ['X', 'Y', 'Z', 'F', 'G']);
    const report = allocateRequirements(primary, [one, two], plan([
      ...['A', 'B', 'C'].map(code => course(code)),
      ...['X', 'Y', 'Z', 'D', 'E', 'F', 'G'].map(code => course(code, 'unrestricted-electives')),
    ]));
    expect(report.complete).toBe(false);
    expect(used(report, 'one').sharedMc).toBeLessThanOrEqual(8);
    expect(used(report, 'two').sharedMc).toBeLessThanOrEqual(8);
    expect(used(report, 'one').rows.some(r => !r.fulfilled) || used(report, 'two').rows.some(r => !r.fulfilled)).toBe(true);
  });

  it('reports triple use explicitly when manual choices pin a primary course in two minors', () => {
    const one = minor('one', ['A', 'D', 'E', 'F', 'G']);
    const two = minor('two', ['A', 'H', 'I', 'J', 'K']);
    let a = withAllocationChoice(course('A'), allocationKey(one), 'requirement:Electives', 'include');
    a = withAllocationChoice(a, allocationKey(two), 'requirement:Electives', 'include');
    const report = allocateRequirements(primary, [one, two], plan([a, course('B'), course('C'),
      ...['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'].map(code => course(code, 'unrestricted-electives'))]));
    expect(report.complete).toBe(false);
    expect(report.conflicts).toEqual(['A']);
    expect(report.courseUses.A).toHaveLength(3);
  });

  it('does not treat waived prerequisite credits as extra primary category credit', () => {
    const report = allocateRequirements(primary, [], plan([course('A'), course('B')]), [course('WAIVED')]);
    expect(report.complete).toBe(false);
    expect(used(report, 'main').rows.find(row => row.id === 'category:foundation')?.have).toBe(8);
  });
});
