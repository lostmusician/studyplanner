import { describe, it, expect } from 'vitest';
import type { Major, StudentSemester } from '@shared/types';
import { applyNocAdjustment, computeRequirements, defaultPlanToSemesters } from './studyPlan';

const majors = Object.values(import.meta.glob('../../shared/data/majors/*.json', { eager: true })).map(m => (m as { default: Major }).default);
const courses = (codes: string[]): StudentSemester[] => [{ year: 2, sem: 1, modules: codes.map(code => ({ code, name: code, mcs: 4, categoryId: 'nus-college' })) }];
const mce = { requirements: [{ name: 'Making Connections', fulfilledBy: ['NHS*', 'NST*', 'NFB*', 'NFC*', 'NHT*', 'NEX*'], count: 6, categoryId: 'nus-college' }] };

describe('Global Pathways and the graph requirement count', () => {
  it.each(majors)('$id sample is missing exactly the undeclared Global Pathway', major => {
    const semesters = defaultPlanToSemesters(major);
    const missing = computeRequirements(major, semesters, major.defaultWaivedModules).filter(r => !r.fulfilled);
    expect(missing.map(r => r.name)).toEqual(['Global Pathways (NOC / SEP / GEx / Regional IEx / SIIP)']);
    expect(computeRequirements(major, semesters, major.defaultWaivedModules, {}, ['sep', 'gex']).every(r => r.fulfilled)).toBe(true);
  });
  it('counts a placed GEx course once without a selection bonus', () => {
    const result = computeRequirements(mce, courses(['NHS2001', 'NHS2002', 'NST2001', 'NST2002', 'NHT2001', 'NEX3001']), [], {}, ['gex', 'sep'])[0];
    expect(result).toMatchObject({ fulfilled: true, have: 6, need: 6 });
    expect(computeRequirements(mce, courses(['NEX3001', 'NEX3002']), [], {}, ['gex'])[0].have).toBe(1);
  });
  it('does not relax the HSS/ST minimum just because SEP or GEx is selected', () => {
    const result = computeRequirements(mce, courses(['NHS2001', 'NST2001', 'NHT2001', 'NHT2002', 'NHT2003', 'NEX3001']), [], {}, ['sep', 'gex'])[0];
    expect(result.fulfilled).toBe(false);
    expect(result.info).toContain('2 HSS & 2 ST');
  });
  it('limits SEP mappings to two per semester without rejecting extra courses', () => {
    const codes = ['NHS2001', 'NHS2002', 'NST2001', 'NST2002', 'NFB2001', 'NFB2002', 'NFC2001'];
    expect(computeRequirements(mce, courses(codes), [], {}, ['sep'])[0]).toMatchObject({ fulfilled: true, have: 6 });
  });
  it('uses exchange mappings from separate semesters independently', () => {
    const semesters = [...courses(['NHS2001', 'NST2001', 'NFB2001', 'NFC2001']), { ...courses(['NFB2002', 'NFC2002'])[0], sem: 2 }];
    expect(computeRequirements(mce, semesters, [], {}, ['sep'])[0]).toMatchObject({ fulfilled: true, have: 6 });
  });
  it('preserves remaining NOC requirements when other pathways are selected', () => {
    const major = majors.find(m => m.id === 'computer-science-nusc')!;
    const adjusted = applyNocAdjustment(major, '6-month');
    const result = computeRequirements(adjusted, courses(['NHS2001', 'NST2001', 'NHT2001', 'NEX3001']), [], {}, ['noc-6-month', 'sep', 'gex']).find(r => r.name === 'Making Connections');
    expect(result).toMatchObject({ fulfilled: true, have: 4, need: 4 });
    expect(computeRequirements(adjusted, courses([]), [], {}, ['noc-6-month', 'sep', 'gex']).find(r => r.name === 'Making Connections')).toMatchObject({ fulfilled: false, have: 0, need: 4 });
  });
  it('requires a taught NUSC course alongside the remaining domain minimum for one-year NOC', () => {
    const major = applyNocAdjustment(majors[0], '1-year');
    const result = computeRequirements(major, courses(['NFB2001', 'NFC2001']), [], {}, ['noc-1-year', 'sep']).find(r => r.name === 'Making Connections');
    expect(result?.fulfilled).toBe(false);
    const valid = computeRequirements(major, courses(['NHS2001', 'NFC2001']), [], {}, ['noc-1-year', 'sep']).find(r => r.name === 'Making Connections');
    expect(valid?.fulfilled).toBe(true);
  });
  it.each(majors)('$id NOC selection changes only NUSC/UE targets, not faculty/industry requirements', major => {
    const adjusted = applyNocAdjustment(major, '1-year');
    expect(adjusted.breadthDepth).toEqual(major.breadthDepth);
    expect(adjusted.categories.filter(c => !['nus-college', 'unrestricted-electives'].includes(c.id))).toEqual(major.categories.filter(c => !['nus-college', 'unrestricted-electives'].includes(c.id)));
    const industryRows = major.requirements.filter(r => /industr/i.test(r.name));
    expect(computeRequirements({ requirements: industryRows }, [], [], {}, ['noc-1-year']).every(r => !r.fulfilled)).toBe(true);
  });
});
