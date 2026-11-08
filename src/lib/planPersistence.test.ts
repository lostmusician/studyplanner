import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Major, PlacedModule } from '@shared/types';
import cs from '@shared/data/majors/computer-science-nusc.json';
import { loadSavedPlan, writeSavedPlan, type SavedPlanState } from '../hooks/useStudyPlan';
import { createEmptySemesters, upsertModule, renameModule } from './studyPlan';

const major = cs as Major;
const state = (): SavedPlanState => ({ doubleDegreeId: null, semesters: createEmptySemesters(), waivedModules: [],
  secondMajorId: 'economics', minorIds: ['statistics', 'mathematics'], requirementMappings: {}, nocDuration: null, specialProgrammes: [], polytechnicApcUnits: 0 });
const module: PlacedModule = { code: 'ST2131', name: 'Probability', mcs: 4, categoryId: 'minor-statistics',
  allocationPreferences: { 'minor:statistics': { 'requirement:Probability': 'include' } }, excludedProgrammeIds: ['mathematics'] };
let disk: Map<string, string>;
const connectStorage = () => {
  const storage = { getItem: vi.fn((key: string) => disk.get(key) ?? null), setItem: vi.fn((key: string, value: string) => { disk.set(key, value); }) };
  vi.stubGlobal('localStorage', storage);
  return storage;
};

beforeEach(() => { disk = new Map(); connectStorage(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('plan persistence across browser sessions', () => {
  it('restores a newly added minor module, its semester, category, credits and choices', () => {
    const current = state();
    current.semesters = upsertModule(current.semesters, 2, 1, module);
    writeSavedPlan(major.id, current);
    connectStorage(); // New browser instance with the same persistent storage.
    const restored = loadSavedPlan(major)!;
    expect(restored.minorIds).toEqual(current.minorIds);
    expect(restored.semesters.find(s => s.year === 2 && s.sem === 1)?.modules).toEqual([module]);
    expect(restored.semesters.flatMap(s => s.modules)).toHaveLength(1);
  });

  it.each(['minor-statistics', 'minor-mathematics', 'second-major-economics', 'unrestricted-electives'])(
    'keeps an edited category (%s) after closing and reopening', categoryId => {
      const current = state();
      current.semesters = upsertModule(current.semesters, 2, 1, { ...module, categoryId: 'math-sciences' });
      writeSavedPlan(major.id, current);
      current.semesters = renameModule(current.semesters, module.code, { ...module, categoryId });
      writeSavedPlan(major.id, current);
      connectStorage();
      const restored = loadSavedPlan(major)!;
      expect(restored.semesters.find(s => s.year === 2 && s.sem === 1)?.modules[0].categoryId).toBe(categoryId);
      // The next autosave/reload must preserve the explicit choice too.
      writeSavedPlan(major.id, restored);
      connectStorage();
      expect(loadSavedPlan(major)?.semesters.find(s => s.year === 2 && s.sem === 1)?.modules[0].categoryId).toBe(categoryId);
    },
  );

  it('keeps custom courses outside the primary catalogue and second-major categories', () => {
    const current = state();
    const custom = { code: 'CUSTOM1234', name: 'My custom course', mcs: 3, categoryId: 'second-major-economics' };
    current.semesters.push({ year: 3, sem: 4, modules: [] });
    current.semesters = upsertModule(current.semesters, 3, 4, custom);
    writeSavedPlan(major.id, current);
    connectStorage();
    expect(loadSavedPlan(major)?.semesters.find(s => s.year === 3 && s.sem === 4)?.modules[0]).toMatchObject(custom);
  });

  it('persists edits and deletion instead of restoring the previous course on restart', () => {
    const current = state();
    current.semesters = upsertModule(current.semesters, 2, 1, module);
    writeSavedPlan(major.id, current);
    current.semesters = upsertModule(current.semesters, 2, 2, { ...module, name: 'Edited', categoryId: 'minor-mathematics' });
    writeSavedPlan(major.id, current);
    connectStorage();
    expect(loadSavedPlan(major)?.semesters.find(s => s.year === 2 && s.sem === 2)?.modules[0]).toMatchObject({ name: 'Edited', categoryId: 'minor-mathematics' });
    current.semesters = createEmptySemesters();
    writeSavedPlan(major.id, current);
    expect(loadSavedPlan(major)?.semesters.flatMap(s => s.modules)).toEqual([]);
  });

  it('keeps different primary-major plans separate', () => {
    writeSavedPlan(major.id, state());
    expect(loadSavedPlan({ ...major, id: 'another-major' })).toBeNull();
  });

  it('leaves the last successful snapshot intact when storage rejects a save', () => {
    writeSavedPlan(major.id, state());
    const original = disk.get(`studyplan:${major.id}`);
    const storage = connectStorage();
    storage.setItem.mockImplementation(() => { throw new Error('QuotaExceededError'); });
    const changed = state();
    changed.semesters = upsertModule(changed.semesters, 2, 1, module);
    expect(() => writeSavedPlan(major.id, changed)).toThrow('QuotaExceededError');
    expect(disk.get(`studyplan:${major.id}`)).toBe(original);
  });
});
