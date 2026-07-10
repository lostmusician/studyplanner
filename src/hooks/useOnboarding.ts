import { useState } from 'react';
import type { Major } from '@shared/types';

const ONBOARDED_KEY = 'studyplan:onboarded';
const planKey = (majorId: string) => `studyplan:${majorId}`;

const hasAnyExistingPlan = (majors: Major[]): boolean =>
  majors.some((major) => localStorage.getItem(planKey(major.id)) !== null);

export const useOnboarding = (majors: Major[]) => {
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean>(
    () => localStorage.getItem(ONBOARDED_KEY) !== 'true',
  );
  const [hasExistingPlan] = useState<boolean>(() => hasAnyExistingPlan(majors));

  const dismissOnboarding = () => {
    localStorage.setItem(ONBOARDED_KEY, 'true');
    setNeedsOnboarding(false);
  };

  return { needsOnboarding, hasExistingPlan, dismissOnboarding };
};
