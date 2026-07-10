import { useState } from 'react';
import type { Major } from '@shared/types';

interface Props {
  majors: Major[];
  hasExistingPlan: boolean;
  onChooseExample: (majorId: string) => void;
  onChooseScratch: (majorId: string) => void;
  onKeepCurrent: () => void;
}

type Step = 'major' | 'mode';

export const OnboardingModal = ({ majors, hasExistingPlan, onChooseExample, onChooseScratch, onKeepCurrent }: Props) => {
  const [step, setStep] = useState<Step>('major');
  const [selectedMajorId, setSelectedMajorId] = useState<string | null>(null);
  const selectedMajor = majors.find((m) => m.id === selectedMajorId) ?? null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome"
    >
      <div className="my-auto w-full max-w-lg rounded-4xl bg-paper p-6 shadow-soft">
        {step === 'major' ? (
          <>
            <h2 className="mb-1 text-base font-semibold text-ink">Welcome! Which major are you in?</h2>
            <p className="mb-5 text-[11px] leading-relaxed text-muted">
              This sets up your planner with the right requirements and categories.
            </p>
            <div className="flex flex-col gap-2">
              {majors.map((major) => (
                <button
                  key={major.id}
                  type="button"
                  onClick={() => setSelectedMajorId(major.id)}
                  className="rounded-2xl px-4 py-3 text-left transition-colors"
                  style={
                    selectedMajorId === major.id
                      ? { backgroundColor: 'rgb(20,20,19)', color: 'rgb(239,238,231)' }
                      : { backgroundColor: 'rgba(20,20,19,0.05)', color: 'rgb(20,20,19)' }
                  }
                >
                  <span className="block text-sm font-medium">{major.label}</span>
                  <span className="block text-[11px] opacity-70">{major.school}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={!selectedMajorId}
              onClick={() => setStep('mode')}
              className="mt-5 w-full rounded-2xl bg-ink px-4 py-2.5 text-sm font-medium text-canvas transition-opacity disabled:opacity-30"
            >
              Next
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setStep('major')}
              className="mb-3 text-xs font-medium text-muted hover:text-ink"
            >
              ← Back
            </button>
            <h2 className="mb-1 text-base font-semibold text-ink">
              How do you want to start with {selectedMajor?.label}?
            </h2>
            <p className="mb-5 text-[11px] leading-relaxed text-muted">
              You can change any of this later in Settings.
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => selectedMajorId && onChooseExample(selectedMajorId)}
                className="rounded-2xl bg-ink px-4 py-3 text-left text-canvas"
              >
                <span className="block text-sm font-medium">Use the example plan</span>
                <span className="block text-[11px] opacity-70">
                  Pre-fills a suggested semester-by-semester plan for {selectedMajor?.label}.
                </span>
              </button>
              <button
                type="button"
                onClick={() => selectedMajorId && onChooseScratch(selectedMajorId)}
                className="rounded-2xl bg-canvas px-4 py-3 text-left text-ink"
              >
                <span className="block text-sm font-medium">Start from scratch</span>
                <span className="block text-[11px] text-muted">
                  Only compulsory modules are pre-filled. You place everything else yourself.
                </span>
              </button>
              {hasExistingPlan && (
                <button
                  type="button"
                  onClick={onKeepCurrent}
                  className="rounded-2xl border border-ink/10 px-4 py-3 text-left text-ink"
                >
                  <span className="block text-sm font-medium">Keep my current plan</span>
                  <span className="block text-[11px] text-muted">
                    You already have a saved plan — leave it exactly as it is.
                  </span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
