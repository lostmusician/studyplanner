import { describe, it, expect } from 'vitest';
import { normalizeSpecialProgrammes, toggleSpecialProgramme, getNocDuration, getMceWaiverCount } from './pathways';
import { encodeCompactPlan, decodeCompactPlan, encodePlan, decodePlan } from './share';

const base = { profile: { name: 'Student', matricNumber: '', year: 'Year 1' }, plan: { majorId: 'computer-science-nusc', semesters: [], waivedModules: [] } };

describe('Global Pathway migration and selection', () => {
  it('migrates the old single value and NOC-only saves', () => {
    expect(normalizeSpecialProgrammes(undefined, 'sep')).toEqual(['sep']);
    expect(normalizeSpecialProgrammes(undefined, null, '6-month')).toEqual(['noc-6-month']);
  });
  it('treats a new empty array as intentional removal', () => {
    expect(normalizeSpecialProgrammes([], 'sep', '6-month')).toEqual([]);
  });
  it('filters invalid entries, deduplicates and keeps one NOC duration', () => {
    expect(normalizeSpecialProgrammes(['sep', 'invalid', 'noc-3-month', 'gex', 'sep', 'noc-1-year'])).toEqual(['sep', 'gex', 'noc-1-year']);
  });
  it('replaces NOC duration while preserving other pathways, and toggles it off', () => {
    const programmes = toggleSpecialProgramme(['sep', 'noc-3-month'], 'noc-6-month');
    expect(programmes).toEqual(['sep', 'noc-6-month']);
    expect(getNocDuration(programmes)).toBe('6-month');
    expect(toggleSpecialProgramme(programmes, 'noc-6-month')).toEqual(['sep']);
  });
  it('takes the highest PWW waiver rather than adding entitlements', () => {
    expect(getMceWaiverCount(['noc-6-month', 'sep', 'gex'], 3)).toBe(3);
    expect(getMceWaiverCount(['noc-1-year', 'gex'], 3)).toBe(4);
    expect(getMceWaiverCount(['sep', 'gex'])).toBe(0);
  });
  it('round-trips multiple pathways and empty selections through compact and legacy links', () => {
    for (const specialProgrammes of [[], ['sep', 'gex', 'noc-6-month']] as const) {
      const payload = { ...base, plan: { ...base.plan, specialProgrammes: [...specialProgrammes], specialProgramme: 'noc-1-year' as const, nocDuration: '1-year' as const } };
      expect(decodeCompactPlan(encodeCompactPlan(payload))?.plan.specialProgrammes).toEqual(specialProgrammes);
      expect(decodePlan(encodePlan(payload))?.plan.specialProgrammes).toEqual(specialProgrammes);
    }
  });
  it('opens old compact links with a single pathway or NOC duration', () => {
    expect(decodeCompactPlan(encodeCompactPlan({ ...base, plan: { ...base.plan, specialProgramme: 'gex' } }))?.plan.specialProgrammes).toEqual(['gex']);
    expect(decodeCompactPlan(encodeCompactPlan({ ...base, plan: { ...base.plan, nocDuration: '1-year' } }))?.plan.specialProgrammes).toEqual(['noc-1-year']);
  });
});
