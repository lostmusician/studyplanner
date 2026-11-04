import { useState, useEffect } from 'react';
import type { Major, SecondaryProgramme } from '@shared/types';
import type { SurveyInput } from '../lib/aiPlanner';
import { SparklesIcon, XIcon } from './Icons';

interface Props {
  major: Major;
  minors: SecondaryProgramme[];
  initialStanding?: { year: number; sem: number };
  onClose: () => void;
  onSubmit: (survey: SurveyInput) => void;
  isLoading: boolean;
}

const TOPICS = [
  'Artificial Intelligence & ML',
  'Software Engineering & Fullstack',
  'Cloud, Systems & Networks',
  'Cybersecurity & Cryptography',
  'Fintech & Algorithmic Trading',
  'Data Science & Analytics',
  'Algorithms & Theoretical CS',
  'Computer Graphics & Gaming',
  'Human-Computer Interaction (HCI)',
  'Database & Big Data Infrastructure',
  'Enterprise IT & Product Management',
];

const CAREER_GOALS = [
  'Tech Software Engineer (SWE)',
  'AI / Machine Learning Engineer',
  'Quantitative Analyst / Fintech SWE',
  'Academic Researcher / PhD Aspirant',
  'Startup Founder / Entrepreneur',
  'Cybersecurity Analyst / Red Teamer',
  'Data Scientist / Analytics Specialist',
  'Technical Product Manager',
];

export const RecommendationSurveyModal = ({
  major,
  minors,
  initialStanding = { year: 1, sem: 1 },
  onClose,
  onSubmit,
  isLoading,
}: Props) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [standingYear, setStandingYear] = useState<number>(initialStanding.year);
  const [standingSem, setStandingSem] = useState<number>(initialStanding.sem);
  const [targetMcsPerSem, setTargetMcsPerSem] = useState<number>(20);
  const [interests, setInterests] = useState<string[]>([]);
  const [careerGoal, setCareerGoal] = useState<string>(CAREER_GOALS[0]);
  const [selectedMinorId, setSelectedMinorId] = useState<string>('');
  const [nocSelection, setNocSelection] = useState<'none' | '3-month' | '6-month' | '1-year'>('none');
  const [customNotes, setCustomNotes] = useState<string>('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, isLoading]);

  const toggleInterest = (topic: string) => {
    setInterests((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic],
    );
  };

  const handleFinish = () => {
    const survey: SurveyInput = {
      standingYear,
      standingSem,
      interests: interests.length > 0 ? interests : ['Artificial Intelligence & ML'],
      careerGoal,
      targetMcsPerSem,
      selectedMinorId: selectedMinorId || null,
      interestedInNoc: nocSelection !== 'none',
      nocDuration: nocSelection === 'none' ? null : nocSelection,
      customNotes: customNotes.trim() || undefined,
    };
    onSubmit(survey);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:p-8 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="AI Study Plan Advisor"
    >
      <div className="my-auto w-full max-w-xl rounded-4xl bg-paper p-6 shadow-soft border border-line/30">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-line/20">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-2xl bg-amber-500/10 text-amber-700">
              <SparklesIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink leading-tight">AI Study Plan Advisor</h2>
              <p className="text-[11px] text-muted">
                {major.label} &middot; Step {step} of 4
              </p>
            </div>
          </div>
          {!isLoading && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1.5 text-muted hover:bg-canvas hover:text-ink transition-colors"
              aria-label="Close"
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Content body */}
        <div className="py-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-10 w-10 animate-spin rounded-full border-3 border-amber-600 border-t-transparent mb-4" />
              <h3 className="text-sm font-semibold text-ink mb-1">Analyzing NUSMods Syllabi...</h3>
              <p className="text-xs text-muted max-w-xs">
                Scanning course prerequisites, semester availability, and synthesizing recommendations via SoCLaaS.
              </p>
            </div>
          ) : (
            <>
              {/* Step 1: Standing & Workload */}
              {step === 1 && (
                <div className="flex flex-col gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-ink mb-1">Where are you right now?</h3>
                    <p className="text-xs text-muted">
                      We will preserve all past completed modules and only plan your remaining semesters.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-medium text-ink/80">Current Year</span>
                      <select
                        value={standingYear}
                        onChange={(e) => setStandingYear(Number(e.target.value))}
                        className="rounded-2xl border border-line/30 bg-canvas px-3 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        {[1, 2, 3, 4].map((y) => (
                          <option key={y} value={y}>
                            Year {y}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-medium text-ink/80">Current Semester</span>
                      <select
                        value={standingSem}
                        onChange={(e) => setStandingSem(Number(e.target.value))}
                        className="rounded-2xl border border-line/30 bg-canvas px-3 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        <option value={1}>Semester 1</option>
                        <option value={2}>Semester 2</option>
                      </select>
                    </label>
                  </div>

                  <div className="mt-2">
                    <span className="block text-[11px] font-medium text-ink/80 mb-2">
                      Target Workload per Semester
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {[16, 20, 24].map((mcs) => (
                        <button
                          key={mcs}
                          type="button"
                          onClick={() => setTargetMcsPerSem(mcs)}
                          className={`rounded-2xl p-3 text-left transition-colors border ${
                            targetMcsPerSem === mcs
                              ? 'bg-ink text-canvas border-ink shadow-2xs'
                              : 'bg-canvas text-ink border-line/30 hover:border-line'
                          }`}
                        >
                          <span className="block text-xs font-semibold">{mcs} MCs</span>
                          <span className="block text-[10px] opacity-75">
                            {mcs === 16 ? 'Lighter pace' : mcs === 20 ? 'Standard load' : 'Accelerated'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Topics of Interest */}
              {step === 2 && (
                <div className="flex flex-col gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-ink mb-1">What areas excite you the most?</h3>
                    <p className="text-xs text-muted">
                      Select all topics you want your electives and specialisation to emphasize.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1 max-h-64 overflow-y-auto pr-1">
                    {TOPICS.map((topic) => {
                      const selected = interests.includes(topic);
                      return (
                        <button
                          key={topic}
                          type="button"
                          onClick={() => toggleInterest(topic)}
                          className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all border ${
                            selected
                              ? 'bg-ink text-canvas border-ink shadow-2xs'
                              : 'bg-canvas text-ink border-line/30 hover:border-line'
                          }`}
                        >
                          {selected ? '✓ ' : '+ '}
                          {topic}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 3: Career Aspirations & Minors */}
              {step === 3 && (
                <div className="flex flex-col gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-ink mb-1">Career & Programmes</h3>
                    <p className="text-xs text-muted">Help us align modules with your post-grad goals.</p>
                  </div>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-medium text-ink/80">Primary Career Goal</span>
                    <select
                      value={careerGoal}
                      onChange={(e) => setCareerGoal(e.target.value)}
                      className="rounded-2xl border border-line/30 bg-canvas px-3 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      {CAREER_GOALS.map((goal) => (
                        <option key={goal} value={goal}>
                          {goal}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-medium text-ink/80">Secondary Programme (Optional Minor)</span>
                    <select
                      value={selectedMinorId}
                      onChange={(e) => setSelectedMinorId(e.target.value)}
                      className="rounded-2xl border border-line/30 bg-canvas px-3 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="">No declared minor / pure electives</option>
                      {minors.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-medium text-ink/80">NUS Overseas Colleges (NOC) / Immersion</span>
                    <select
                      value={nocSelection}
                      onChange={(e) => setNocSelection(e.target.value as 'none' | '3-month' | '6-month' | '1-year')}
                      className="rounded-2xl border border-line/30 bg-canvas px-3 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="none">No NOC / Standard semester internship</option>
                      <option value="3-month">3-Month Short NOC</option>
                      <option value="6-month">6-Month NOC (1 Semester)</option>
                      <option value="1-year">1-Year NOC (2 Semesters)</option>
                    </select>
                  </label>
                </div>
              )}

              {/* Step 4: Custom Notes & Review */}
              {step === 4 && (
                <div className="flex flex-col gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-ink mb-1">Anything else we should know?</h3>
                    <p className="text-xs text-muted">
                      Mention any specific module codes you want to take or particular preferences.
                    </p>
                  </div>

                  <textarea
                    rows={4}
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    placeholder="e.g. I want to prepare for master's research in computer vision, or prefer hands-on coding over mathematical proofs..."
                    className="rounded-2xl border border-line/30 bg-canvas p-3 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />

                  <div className="rounded-2xl bg-amber-500/10 p-3 text-xs text-amber-900 border border-amber-500/20">
                    <p className="font-semibold mb-0.5">Ready to plan</p>
                    <p className="text-[11px] leading-relaxed text-amber-800">
                      We will preserve semesters prior to Year {standingYear} Semester {standingSem} and populate your future semesters with tailored electives.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer controls */}
        {!isLoading && (
          <div className="flex items-center justify-between pt-4 border-t border-line/20">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
                className="rounded-2xl px-4 py-2 text-xs font-medium text-muted hover:text-ink transition-colors"
              >
                ← Back
              </button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s + 1) as 2 | 3 | 4)}
                className="rounded-2xl bg-ink px-5 py-2 text-xs font-medium text-canvas hover:bg-ink/90 transition-opacity"
              >
                Next Step →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="flex items-center gap-1.5 rounded-2xl bg-amber-600 px-5 py-2 text-xs font-semibold text-white hover:bg-amber-700 transition-colors shadow-2xs"
              >
                <SparklesIcon className="h-4 w-4" />
                <span>Generate Recommendations</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
