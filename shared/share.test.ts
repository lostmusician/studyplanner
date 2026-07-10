import { describe, it, expect } from 'vitest';
import { encodeCompactPlan, decodeCompactPlan } from './share';

describe('encodeCompactPlan / decodeCompactPlan round trip', () => {
  const basePayload = {
    profile: { name: 'Alex Tan', matricNumber: 'A0123456X', year: 'Year 2' },
    plan: {
      majorId: 'computer-science-nusc',
      semesters: [
        {
          year: 1,
          sem: 1,
          modules: [{ code: 'CS1101S', name: 'Programming Methodology', mcs: 4, categoryId: 'soc-common' }],
        },
      ],
      waivedModules: [],
    },
  };

  it('round-trips a plan with no secondary programme declared', () => {
    const encoded = encodeCompactPlan(basePayload);
    const decoded = decodeCompactPlan(encoded);
    expect(decoded?.plan.secondMajorId ?? null).toBeNull();
    expect(decoded?.plan.minorIds ?? []).toEqual([]);
    expect(decoded?.plan.requirementMappings ?? {}).toEqual({});
  });

  it('round-trips a declared second major, minors, and requirement mappings', () => {
    const payload = {
      ...basePayload,
      plan: {
        ...basePayload.plan,
        secondMajorId: 'mathematics',
        minorIds: ['statistics', 'economics'],
        requirementMappings: { 'Programming Methodology': ['CS2101'] },
      },
    };
    const encoded = encodeCompactPlan(payload);
    const decoded = decodeCompactPlan(encoded);
    expect(decoded?.plan.secondMajorId).toBe('mathematics');
    expect(decoded?.plan.minorIds).toEqual(['statistics', 'economics']);
    expect(decoded?.plan.requirementMappings).toEqual({ 'Programming Methodology': ['CS2101'] });
  });
});
