import { useState, useEffect, useCallback } from 'react';
import type { ShareProfile } from '@shared/share';

const PROFILE_KEY = 'studyplan:profile';

const DEFAULT_PROFILE: ShareProfile = {
  name: 'Student Name',
  matricNumber: '',
  year: 'Year 1',
};

const loadProfile = (): ShareProfile => {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as Partial<ShareProfile>;
    return {
      name: typeof parsed.name === 'string' ? parsed.name : DEFAULT_PROFILE.name,
      matricNumber: typeof parsed.matricNumber === 'string' ? parsed.matricNumber : '',
      year: typeof parsed.year === 'string' ? parsed.year : DEFAULT_PROFILE.year,
    };
  } catch {
    return DEFAULT_PROFILE;
  }
};

export const useProfile = () => {
  const [profile, setProfileState] = useState<ShareProfile>(() => loadProfile());

  useEffect(() => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }, [profile]);

  const setName = useCallback((name: string) => setProfileState((prev) => ({ ...prev, name })), []);
  const setMatricNumber = useCallback(
    (matricNumber: string) => setProfileState((prev) => ({ ...prev, matricNumber })),
    [],
  );
  const setYear = useCallback((year: string) => setProfileState((prev) => ({ ...prev, year })), []);
  const importProfile = useCallback((next: ShareProfile) => setProfileState(next), []);

  return { profile, setName, setMatricNumber, setYear, importProfile };
};
