import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadMajors, loadSecondMajors, loadMinors } from '../hooks/useStudyPlan';
import { computeRequirements, computeStats, defaultPlanToSemesters } from './studyPlan';
import { StudyPlan } from '../components/StudyPlan';
import { AppSidebar } from '../components/AppSidebar';
import { SettingsSidebar } from '../components/SettingsSidebar';
import { MobileNavigation } from '../components/MobileNavigation';
import { SettingsPanel } from '../components/SettingsPanel';

describe('app shell smoke', () => {
  it('renders the desktop sidebar and compact navigation without header page toggles', () => {
    const majors = loadMajors();
    const major = majors.find((candidate) => candidate.id === 'computer-science-nusc')!;
    const secondMajors = loadSecondMajors();
    const minors = loadMinors();
    const semesters = defaultPlanToSemesters(major);
    const waivedModules = major.defaultWaivedModules ?? [];
    const markup = renderToStaticMarkup(createElement(StudyPlan, {
      majors, major, majorId: major.id, secondMajors, minors,
      doubleDegreeId: null, setDoubleDegreeId: () => {},
      secondMajorId: null, minorIds: [], setSecondMajorId: () => {}, toggleMinorId: () => {},
      nocDuration: null, specialProgrammes: [], togglePathway: () => {},
      requirementMappings: {}, addRequirementMapping: () => {}, removeRequirementMapping: () => {},
      semesters, waivedModules,
      stats: computeStats(major, semesters, waivedModules),
      requirements: computeRequirements(major, semesters, waivedModules),
      switchMajor: () => {},
      addOrMoveModule: () => {}, deleteModule: () => {},
      updateModule: () => ({ ok: true } as const), addWaivedModule: () => {}, deleteWaivedModule: () => {},
      resetPlan: () => {}, getCompletedCodes: () => [],
      addSpecialTerm: () => {}, deleteSpecialTerm: () => {},
      studentName: 'Test Student', setStudentName: () => {},
      matricNumber: '', setMatricNumber: () => {},
      studentYear: 'Year 2', setStudentYear: () => {},
    }));
    expect(markup).toContain('App sections');
    expect(markup).toContain('StudyPlanner');
    expect(markup).not.toContain('ModStack');
    expect(markup).toContain('Explore');
    expect(markup).toContain('Settings');
    expect(markup).toContain('Primary navigation');
    expect(markup).toContain('Advisor');
    expect(markup).toContain('Total Degree MCs');
    expect(markup).not.toContain('>Grid<');
    expect(markup).not.toContain('Plan Settings');
  });
});

describe('settings and compact navigation', () => {
  it('keeps degrees ordering and the sample-plan action inside Profile only', () => {
    const majors = loadMajors();
    const secondMajors = loadSecondMajors();
    const minors = loadMinors();
    const shared = {
      majors,
      majorId: majors[0].id,
      secondMajors,
      minors,
      doubleDegreeId: null,
      setDoubleDegreeId: () => {},
      secondMajorId: 'economics' as string | null,
      minorIds: [] as string[],
      setSecondMajorId: () => {},
      toggleMinorId: () => {},
      nocDuration: null,
      specialProgrammes: [] as [],
      togglePathway: () => {},
      studentName: 'Test Student',
      setStudentName: () => {},
      matricNumber: '',
      setMatricNumber: () => {},
      studentYear: 'Year 2',
      setStudentYear: () => {},
      onSwitchMajor: () => {},
      onResetPlan: () => {},
      onSectionChange: () => {},
    };

    const degrees = renderToStaticMarkup(createElement(SettingsSidebar, {
      ...shared, activeSection: 'degrees' as const,
    }));
    expect(degrees).toContain('Second degree');
    expect(degrees).toContain('Second major');
    expect(degrees.indexOf('Second degree')).toBeLessThan(degrees.indexOf('Second major'));
    expect(degrees).not.toContain('Load Sample Plan');

    const profile = renderToStaticMarkup(createElement(SettingsSidebar, {
      ...shared, activeSection: 'profile' as const,
    }));
    expect(profile).toContain('Load Sample Plan');
    expect(profile).toContain('Student profile');
    expect(profile).not.toContain('Second degree');

    const pathways = renderToStaticMarkup(createElement(SettingsSidebar, {
      ...shared, activeSection: 'pathways' as const,
    }));
    expect(pathways).toContain('Global Pathways');
    expect(pathways).not.toContain('Load Sample Plan');

    const closedPanel = renderToStaticMarkup(createElement(SettingsPanel, {
      ...shared, activeSection: 'profile' as const, open: false, onClose: () => {},
    }));
    expect(closedPanel).toBe('');

    const openPanel = renderToStaticMarkup(createElement(SettingsPanel, {
      ...shared, activeSection: 'profile' as const, open: true, onClose: () => {},
    }));
    expect(openPanel).toContain('Plan Settings');
    expect(openPanel).toContain('Load Sample Plan');
    expect(openPanel).toContain('settings-backdrop');
  });

  it('offers five compact destinations with one active item', () => {
    const markup = renderToStaticMarkup(createElement(MobileNavigation, { active: 'explore', onChange: () => {} }));
    for (const label of ['Home', 'Visualise', 'Explore', 'Advisor', 'Settings']) {
      expect(markup).toContain(`>${label}<`);
    }
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
    expect(markup).toContain('md:hidden');
  });

  it('supports collapsing desktop sidebar into a thin icon-only sidebar', () => {
    const sharedProps = {
      active: 'home' as const,
      onNavigate: () => {},
      settingsOpen: false,
      onToggleSettings: () => {},
      studentName: 'Alex Tan',
      majorLabel: 'Computer Science',
      onToggleCollapse: () => {},
    };

    const expanded = renderToStaticMarkup(createElement(AppSidebar, {
      ...sharedProps,
      isCollapsed: false,
    }));
    expect(expanded).toContain('StudyPlanner');
    expect(expanded).toContain('Alex Tan');
    expect(expanded).toContain('Computer Science');
    expect(expanded).toContain('Collapse sidebar');
    expect(expanded).toContain('w-60 lg:w-64');

    const collapsed = renderToStaticMarkup(createElement(AppSidebar, {
      ...sharedProps,
      isCollapsed: true,
    }));
    expect(collapsed).toContain('w-16');
    expect(collapsed).not.toContain('StudyPlanner');
    expect(collapsed).not.toContain('Alex Tan');
    expect(collapsed).toContain('Expand sidebar');
    expect(collapsed).toContain('aria-label="Home"');
    expect(collapsed).toContain('aria-label="Visualise"');
    expect(collapsed).toContain('aria-label="Explore"');
    expect(collapsed).toContain('aria-label="Settings"');
  });
});
