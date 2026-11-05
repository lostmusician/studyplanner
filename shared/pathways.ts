import type { NocDuration, SpecialProgramme } from './types';

export const PATHWAY_OPTIONS: { id: SpecialProgramme; label: string }[] = [
  { id: 'sep', label: 'SEP' }, { id: 'gex', label: 'GEx' },
  { id: 'regional-iex', label: 'Regional IEx' }, { id: 'siip', label: 'SIIP' },
  { id: 'noc-3-month', label: '3 months' }, { id: 'noc-6-month', label: '6 months' }, { id: 'noc-1-year', label: '1 year' },
];
export const isSpecialProgramme = (value: unknown): value is SpecialProgramme =>
  PATHWAY_OPTIONS.some(option => option.id === value);

/** Array presence is authoritative, even when empty. Last NOC duration wins on malformed imports. */
export const normalizeSpecialProgrammes = (value: unknown, legacy?: unknown, legacyNoc?: unknown): SpecialProgramme[] => {
  const candidates: unknown[] = Array.isArray(value) ? value
    : isSpecialProgramme(legacy) ? [legacy]
    : ['3-month', '6-month', '1-year'].includes(String(legacyNoc)) ? [`noc-${legacyNoc}`] : [];
  return candidates.reduce<SpecialProgramme[]>((result, item) => {
    if (!isSpecialProgramme(item)) return result;
    const next = item.startsWith('noc-') ? result.filter(p => !p.startsWith('noc-')) : result;
    return next.includes(item) ? next : [...next, item];
  }, []);
};

export const getNocDuration = (programmes: readonly SpecialProgramme[]): NocDuration | null => {
  const noc = programmes.find(p => p.startsWith('noc-'));
  return noc ? noc.slice(4) as NocDuration : null;
};

export const toggleSpecialProgramme = (programmes: SpecialProgramme[], programme: SpecialProgramme): SpecialProgramme[] =>
  programmes.includes(programme) ? programmes.filter(p => p !== programme)
    : normalizeSpecialProgrammes([...programmes, programme]);

/** Waiver arrangements overlap; the highest entitlement applies, never their sum. */
export const getMceWaiverCount = (programmes: readonly SpecialProgramme[], otherPwwWaivers = 0): number => {
  const noc = getNocDuration(programmes);
  return Math.min(4, Math.max(0, otherPwwWaivers, noc === '1-year' ? 4 : noc === '6-month' ? 2 : 0));
};
