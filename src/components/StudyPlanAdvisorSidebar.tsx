import { useState } from 'react';
import type { Major, SecondaryProgramme, StudentSemester, WaivedModule } from '@shared/types';
import { SparklesIcon } from './Icons';
import {
  generateAiStudyPlanRecommendation,
  type SurveyInput,
  type RecommendationResult,
} from '../lib/aiPlanner';

interface Props {
  major: Major;
  minors: SecondaryProgramme[];
  semesters: StudentSemester[];
  waivedModules: WaivedModule[];
  studentYear: string;
  isOpen: boolean;
  onClose: () => void;
  onApply: (semesters: StudentSemester[], minorId?: string | null) => void;
}

const TOPICS = [
  'Artificial Intelligence & ML',
  'Software Engineering & Fullstack',
  'Cloud & Distributed Systems',
  'Cybersecurity & Cryptography',
  'Fintech & Algorithmic Trading',
  'Data Science & Analytics',
  'Algorithms & Theory',
  'Computer Graphics & Gaming',
  'Human-Computer Interaction',
  'Database Infrastructure',
];

const CAREER_GOALS = [
  'Software Engineer',
  'Machine Learning Engineer',
  'Fintech / Quant Analyst',
  'Academic / Research',
  'Startup / Entrepreneur',
  'Cybersecurity Specialist',
  'Data Scientist',
  'Product Manager',
];

export const StudyPlanAdvisorSidebar = ({
  major,
  minors,
  semesters,
  waivedModules,
  studentYear,
  isOpen,
  onClose,
  onApply,
}: Props) => {
  const initialYear = studentYear.includes('2')
    ? 2
    : studentYear.includes('3')
      ? 3
      : studentYear.includes('4')
        ? 4
        : 1;

  const [standingYear, setStandingYear] = useState<number>(initialYear);
  const [standingSem, setStandingSem] = useState<number>(1);
  const [targetMcs, setTargetMcs] = useState<number>(20);
  const [interests, setInterests] = useState<string[]>(['Artificial Intelligence & ML']);
  const [careerGoal, setCareerGoal] = useState<string>(CAREER_GOALS[0]);
  const [selectedMinorId, setSelectedMinorId] = useState<string>('');
  const [customNotes, setCustomNotes] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<RecommendationResult | null>(null);

  const toggleInterest = (topic: string) => {
    setInterests((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic],
    );
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const survey: SurveyInput = {
        standingYear,
        standingSem,
        interests: interests.length > 0 ? interests : ['Software Engineering & Fullstack'],
        careerGoal,
        targetMcsPerSem: targetMcs,
        selectedMinorId: selectedMinorId || null,
        interestedInNoc: false,
        nocDuration: null,
        customNotes: customNotes.trim() || undefined,
      };

      const res = await generateAiStudyPlanRecommendation(
        major,
        semesters,
        waivedModules,
        survey,
        minors,
      );
      setResult(res);
    } catch {
      // Handled inside aiPlanner with mock fallback
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyClick = () => {
    if (!result) return;
    onApply(result.updatedSemesters, result.recommendedMinorId);
  };

  const field =
    'rounded-xl bg-canvas border border-line/40 px-3 py-1.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent w-full';

  return (
    <aside
      className={`transition-all duration-300 ease-in-out ${
        isOpen
          ? 'translate-x-0 opacity-100 pointer-events-auto lg:w-84 lg:p-5 lg:border-l lg:border-line/20'
          : 'translate-x-full opacity-0 pointer-events-none lg:w-0 lg:p-0 lg:border-0 lg:translate-x-0'
      } fixed inset-0 top-0 right-0 z-50 flex flex-col w-full h-full bg-paper p-5 overflow-y-auto shadow-2xl lg:sticky lg:top-[49px] lg:h-[calc(100vh-49px)] lg:shrink-0 lg:bg-paper/60 lg:shadow-none lg:backdrop-blur-sm lg:z-30`}
    >
      <div className="w-full lg:w-[296px] shrink-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-line/20">
          <div className="flex items-center gap-1.5">
            <SparklesIcon className="w-4 h-4 text-amber-600" />
            <h2 className="text-xs font-bold text-ink uppercase tracking-wider">
              Study Plan Advisor
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/10 text-xs font-bold text-ink transition-colors hover:bg-ink/20"
            aria-label="Close advisor"
          >
            ✕
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-600 border-t-transparent mb-3" />
            <span className="text-xs font-medium text-ink">Analyzing modules...</span>
          </div>
        ) : result ? (
          /* Result View */
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl bg-white/70 p-4 border border-line/30 shadow-xs">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full inline-block mb-1.5">
                Recommendation
              </span>
              <h3 className="text-sm font-semibold text-ink leading-snug">
                {result.trackTitle}
              </h3>
              <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                {result.trackRationale}
              </p>
              {result.recommendedMinorRationale && (
                <p className="mt-2 pt-2 border-t border-line/20 text-[11px] leading-relaxed text-muted">
                  <span className="font-medium text-ink">Minor: </span>
                  {result.recommendedMinorRationale}
                </p>
              )}
            </div>

            {/* Recommended Electives */}
            {result.recommendedElectives.length > 0 && (
              <div className="rounded-2xl bg-white/70 p-4 border border-line/30 shadow-xs">
                <h4 className="text-[10px] font-semibold text-ink uppercase tracking-wider mb-2.5">
                  Suggested Courses
                </h4>
                <div className="flex flex-col gap-2">
                  {result.recommendedElectives.map((e) => (
                    <div
                      key={e.code}
                      className="rounded-xl bg-canvas p-2.5 border border-line/30 text-xs"
                    >
                      <div className="flex items-center justify-between font-semibold text-ink">
                        <span>{e.code}</span>
                      </div>
                      <p className="text-[11px] text-muted leading-tight mt-0.5">{e.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={handleApplyClick}
                className="w-full rounded-2xl bg-ink px-4 py-2.5 text-xs font-medium text-canvas hover:bg-ink/90 transition-opacity flex items-center justify-center gap-1.5 shadow-xs"
              >
                <SparklesIcon className="h-3.5 w-3.5 text-amber-400" />
                <span>Apply to Plan</span>
              </button>
              <button
                type="button"
                onClick={() => setResult(null)}
                className="w-full rounded-2xl border border-line/40 bg-canvas px-4 py-2 text-xs font-medium text-ink hover:bg-paper transition-colors"
              >
                Adjust Preferences
              </button>
            </div>
          </div>
        ) : (
          /* Survey / Preferences Form */
          <div className="flex flex-col gap-4">
            <section className="rounded-2xl bg-white/70 p-4 border border-line/30 shadow-xs">
              <h3 className="mb-3 text-xs font-semibold text-ink uppercase tracking-wide">
                Current Standing
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-muted font-medium">
                    Year
                  </span>
                  <select
                    value={standingYear}
                    onChange={(e) => setStandingYear(Number(e.target.value))}
                    className={field}
                  >
                    {[1, 2, 3, 4].map((y) => (
                      <option key={y} value={y}>
                        Year {y}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-muted font-medium">
                    Semester
                  </span>
                  <select
                    value={standingSem}
                    onChange={(e) => setStandingSem(Number(e.target.value))}
                    className={field}
                  >
                    <option value={1}>Sem 1</option>
                    <option value={2}>Sem 2</option>
                  </select>
                </label>
              </div>

              <div className="mt-3">
                <span className="text-[10px] uppercase tracking-wide text-muted font-medium block mb-1.5">
                  Target Workload
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {[16, 20, 24].map((mcs) => (
                    <button
                      key={mcs}
                      type="button"
                      onClick={() => setTargetMcs(mcs)}
                      className={`rounded-xl py-1.5 text-center text-xs font-medium transition-colors border ${
                        targetMcs === mcs
                          ? 'bg-ink text-canvas border-ink'
                          : 'bg-canvas text-ink border-line/40 hover:border-line'
                      }`}
                    >
                      {mcs} MCs
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-2xl bg-white/70 p-4 border border-line/30 shadow-xs">
              <h3 className="mb-2 text-xs font-semibold text-ink uppercase tracking-wide">
                Interests
              </h3>
              <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto pr-0.5">
                {TOPICS.map((topic) => {
                  const selected = interests.includes(topic);
                  return (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => toggleInterest(topic)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all border ${
                        selected
                          ? 'bg-ink text-canvas border-ink shadow-2xs'
                          : 'bg-canvas text-ink/80 border-line/30 hover:border-line'
                      }`}
                    >
                      {selected ? '✓ ' : '+ '}
                      {topic}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl bg-white/70 p-4 border border-line/30 shadow-xs">
              <h3 className="mb-3 text-xs font-semibold text-ink uppercase tracking-wide">
                Career & Minors
              </h3>
              <div className="flex flex-col gap-2.5">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-muted font-medium">
                    Career Direction
                  </span>
                  <select
                    value={careerGoal}
                    onChange={(e) => setCareerGoal(e.target.value)}
                    className={field}
                  >
                    {CAREER_GOALS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-muted font-medium">
                    Optional Minor
                  </span>
                  <select
                    value={selectedMinorId}
                    onChange={(e) => setSelectedMinorId(e.target.value)}
                    className={field}
                  >
                    <option value="">None / Open Electives</option>
                    {minors.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-muted font-medium">
                    Notes (Optional)
                  </span>
                  <input
                    type="text"
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    placeholder="Specific module or preferences..."
                    className={field}
                  />
                </label>
              </div>
            </section>

            <button
              type="button"
              onClick={handleGenerate}
              className="w-full rounded-2xl bg-ink px-4 py-2.5 text-xs font-medium text-canvas hover:bg-ink/90 transition-opacity flex items-center justify-center gap-1.5 shadow-xs"
            >
              <SparklesIcon className="h-3.5 w-3.5 text-amber-400" />
              <span>Generate Plan</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
