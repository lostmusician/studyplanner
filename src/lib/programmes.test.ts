import { describe, it, expect } from 'vitest';
import { expandProgrammes, programmeRestriction, normalizeDoubleDegreeId } from './programmes';
import { computeRequirements } from './studyPlan';
import type { SecondaryProgramme, StudentSemester, RequirementRule } from '@shared/types';
import statistics from '@shared/data/second-majors/statistics.json';
import analytics from '@shared/data/second-majors/data-analytics.json';
import mathematics from '@shared/data/minors/mathematics.json';
import { encodeCompactPlan, decodeCompactPlan } from '@shared/share';

const plan = (courses: [string, number][]): StudentSemester[] => [{ year: 1, sem: 1, modules: courses.map(([code, mcs]) => ({ code, mcs, name: code, categoryId: 'unrestricted-electives' })) }];
const check = (rules: RequirementRule[], courses: [string, number][]) => computeRequirements({ requirements: rules }, plan(courses));

describe('programme catalogue', () => {
  it('keeps all choices searchable with sources and explicit manual-review status', () => {
    for (const kind of ['minor', 'second-major'] as const) {
      const entries = expandProgrammes(kind, []);
      expect(entries.length).toBeGreaterThan(kind === 'minor' ? 100 : 60);
      expect(new Set(entries.map(p => p.id)).size).toBe(entries.length);
      expect(entries.every(p => p.sourceUrl?.startsWith('https://') && p.school && p.requirementStatus === 'review-needed')).toBe(true);
      expect(entries[0].id).toBe('management');
    }
  });
  it('preserves authored rules and combines eligibility metadata', () => {
    const entries = expandProgrammes('second-major', [analytics as SecondaryProgramme]);
    expect(entries.find(p => p.id === 'data-analytics')?.requirements).toEqual(analytics.requirements);
    expect(programmeRestriction(entries.find(p => p.id === 'data-analytics')!, 'business-analytics-nusc', null, [])).toBeTruthy();
    expect(programmeRestriction(entries.find(p => p.id === 'computer-science')!, 'computer-science-nusc', null, [])).toBeTruthy();
  });
  it('prevents a minor and second major in the same subject', () => {
    expect(programmeRestriction(mathematics as SecondaryProgramme, 'computer-science-nusc', 'mathematics', [])).toBeTruthy();
  });
  it('round-trips new programmes and double degrees in compact share links', () => {
    const input = { profile: { name: 'Test', matricNumber: '', year: 'Year 1' }, plan: { majorId: 'computer-science-nusc', semesters: [], waivedModules: [], doubleDegreeId: 'cs-mathematics', secondMajorId: 'sociology', minorIds: ['french-language-studies'] } };
    expect(decodeCompactPlan(encodeCompactPlan(input))?.plan).toMatchObject(input.plan);
    expect(normalizeDoubleDegreeId('cs-mathematics')).toBe('cs-mathematics');
    expect(normalizeDoubleDegreeId('unknown')).toBeNull();
  });
});

describe('sourced secondary course rules', () => {
  it('uses actual units and does not count a repeated code twice', () => {
    const rules = [{ name: '8 units', fulfilledBy: ['MA*'], minUnits: 8 }];
    expect(check(rules, [['MA1513', 2], ['MA1513', 2], ['MA1522', 4]])[0]).toMatchObject({ fulfilled: false, have: 6, need: 8 });
  });
  it('excludes Statistics UROPS and ST4288', () => {
    const row = statistics.requirements.find(r => r.name.startsWith('At least 12'))!;
    expect(check([row], [['ST3281', 4], ['ST4288', 4], ['ST3236', 4]])[0]).toMatchObject({ fulfilled: false, have: 4 });
  });
  it('does not reuse the computing alternative as an advanced elective', () => {
    const rows = statistics.requirements.filter(r => 'allocationGroup' in r);
    const results = check(rows, [['ST3236', 4], ['ST3239', 4], ['ST3240', 4]]);
    expect(results[0].fulfilled).toBe(true);
    expect(results[1].fulfilled).toBe(false);
  });
  it('requires the extra elective for the 2-unit linear algebra route', () => {
    const row = statistics.requirements.find(r => 'whenCourse' in r)!;
    expect(check([row], [])[0].fulfilled).toBe(true);
    expect(check([row], [['MA1513', 2]])[0].fulfilled).toBe(false);
  });
  it('counts CS3244 and CS3264 as one advanced Data Analytics option', () => {
    const row = analytics.requirements.find(r => r.name.startsWith('Advanced electives'))!;
    expect(check([row], [['CS3244', 4], ['CS3264', 4]])[0]).toMatchObject({ fulfilled: false, have: 4 });
    expect(check([row], [['CS3264', 4], ['DSA4211', 4]])[0].fulfilled).toBe(true);
  });
  it('does not accept excluded Mathematics projects or unapproved MA3xxx courses', () => {
    const row = mathematics.requirements[2];
    expect(check([row], [['MA3288', 4], ['MA3311', 4]])[0].fulfilled).toBe(false);
    expect(check([row], [['PC3274A', 4]])[0].fulfilled).toBe(true);
  });
});
