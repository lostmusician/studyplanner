import type { AllocationPreferences, AllocationChoice, PlacedModule } from './types';

/** Validate saved/imported choices without accepting arbitrary object properties. */
export const normalizeAllocationPreferences = (value: unknown): AllocationPreferences | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const programmes: [string, Record<string, AllocationChoice>][] = [];
  for (const [key, rows] of Object.entries(value)) {
    if (!rows || typeof rows !== 'object' || Array.isArray(rows)) continue;
    const choices = Object.entries(rows).filter((entry): entry is [string, AllocationChoice] =>
      entry[1] === 'include' || entry[1] === 'exclude');
    if (choices.length) programmes.push([key, Object.fromEntries(choices)]);
  }
  return programmes.length ? Object.fromEntries(programmes) : undefined;
};

export const withAllocationChoice = (
  module: PlacedModule, programmeKey: string, rowId: string, choice?: AllocationChoice,
): PlacedModule => {
  const rows = { ...module.allocationPreferences?.[programmeKey] };
  if (choice) rows[rowId] = choice;
  else delete rows[rowId];
  const preferences = { ...module.allocationPreferences };
  if (Object.keys(rows).length) preferences[programmeKey] = rows;
  else delete preferences[programmeKey];
  return { ...module, allocationPreferences: preferences };
};
