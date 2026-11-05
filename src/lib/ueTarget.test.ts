import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Major } from '@shared/types';
import cs from '@shared/data/majors/computer-science-nusc.json';
import { applyNocAdjustment, computeUeTarget } from './studyPlan';
import { StatsSummary } from '../components/StatsSummary';

const withSecondaries = (major: Major): Major => ({ ...major, categories: [
  ...major.categories,
  { id: 'minor-economics', label: 'Economics (Minor)', mcTarget: 20, color: '#fff' },
  { id: 'second-major-statistics', label: 'Statistics (2nd Major)', mcTarget: 40, color: '#fff' },
] });

describe('UE budget with secondary programmes', () => {
  it('keeps the same UE budget when adding minors and second majors', () => {
    expect(computeUeTarget(cs as Major)).toBe(20);
    expect(computeUeTarget(withSecondaries(cs as Major))).toBe(20);
  });

  it('preserves the NOC-adjusted UE budget', () => {
    const adjusted = applyNocAdjustment(cs as Major, '6-month');
    expect(computeUeTarget(withSecondaries(adjusted))).toBe(computeUeTarget(adjusted));
    expect(computeUeTarget(adjusted)).toBeGreaterThan(20);
  });

  it('renders 20 / 20 for UE progress after a minor is added', () => {
    const markup = renderToStaticMarkup(createElement(StatsSummary, {
      major: withSecondaries(cs as Major), stats: { totalMc: 20, byCategory: { 'unrestricted-electives': 20 } },
      semesters: [], waivedModules: [], requirements: [], requirementMappings: {},
      addRequirementMapping: () => {}, removeRequirementMapping: () => {},
    }));
    expect(markup).toContain('>20<span class="text-xs font-normal text-ink/60 ml-1">/ 20</span>');
  });

  it('renders a zero target as a denominator instead of appending a stray zero', () => {
    const major = { ...cs, totalMcTarget: 140 } as Major;
    expect(computeUeTarget(major)).toBe(0);
    const markup = renderToStaticMarkup(createElement(StatsSummary, {
      major, stats: { totalMc: 20, byCategory: { 'unrestricted-electives': 20 } },
      semesters: [], waivedModules: [], requirements: [], requirementMappings: {},
      addRequirementMapping: () => {}, removeRequirementMapping: () => {},
    }));
    expect(markup).toContain('>20<span class="text-xs font-normal text-ink/60 ml-1">/ 0</span>');
  });
});
