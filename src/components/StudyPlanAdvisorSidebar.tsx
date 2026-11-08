import { useState, useRef, useEffect } from 'react';
import type { Major, SecondaryProgramme, StudentSemester, WaivedModule } from '@shared/types';
import {
  generateAiStudyPlanRecommendation,
  iterateAiStudyPlanRecommendation,
  generateMockRecommendation,
  iterateMockRecommendation,
  type SurveyInput,
  type RecommendationResult,
  type ChatTurn,
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

interface MessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  result?: RecommendationResult;
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

const SUGGESTIONS = [
  'Add an NLP elective',
  'Add a security elective',
  'Add a distributed systems elective',
  'Add Economics Minor',
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
  const [isIterating, setIsIterating] = useState(false);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [currentResult, setCurrentResult] = useState<RecommendationResult | null>(null);
  const [inputDraft, setInputDraft] = useState('');

  const requestId = useRef(0);
  useEffect(() => {
    requestId.current++;
    setCurrentResult(null);
    setMessages([]);
    setIsLoading(false);
    setIsIterating(false);
    return () => { requestId.current++; };
  }, [major.id]);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length > 0) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isIterating]);

  const toggleInterest = (topic: string) => {
    setInterests((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic],
    );
  };

  const handleInitialGenerate = async () => {
    if (isLoading) return;
    const request = ++requestId.current;
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

      if (request !== requestId.current) return;
      setCurrentResult(res);
      setMessages([
        {
          id: 'init',
          role: 'assistant',
          content: `I've prepared a recommended pathway tailored to ${careerGoal || 'your aspirations'}. Apply it to your planner, or reply to add courses or explore a minor.`,
          result: res,
        },
      ]);
    } catch (err) {
      if (request !== requestId.current) return;
      console.warn('AI advisor unavailable, falling back to deterministic engine:', err);
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
        const fallbackRes = generateMockRecommendation(
          major,
          semesters,
          waivedModules,
          survey,
          minors,
        );
        setCurrentResult(fallbackRes);
        setMessages([
          {
            id: 'init-fallback',
            role: 'assistant',
            content: `Here are course suggestions based on your interests.`,
            result: fallbackRes,
          },
        ]);
      } catch (fallbackErr) {
        console.error('Study plan fallback failed:', fallbackErr);
        setCurrentResult(null);
        setMessages([
          {
            id: 'init-unavailable',
            role: 'assistant',
            content: 'The advisor could not generate a plan. Please try again.',
          },
        ]);
      }
    } finally {
      if (request === requestId.current) setIsLoading(false);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? inputDraft).trim();
    if (!text || isIterating || isLoading) return;
    const request = ++requestId.current;

    setInputDraft('');
    const userMsgId = `user-${Date.now()}`;
    const newMessages: MessageItem[] = [
      ...messages,
      { id: userMsgId, role: 'user', content: text },
    ];
    setMessages(newMessages);
    setIsIterating(true);

    try {
      if (!currentResult) {
        throw new Error('No active plan');
      }

      const historyTurns: ChatTurn[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const { reply, result: updatedResult } = await iterateAiStudyPlanRecommendation(
        major,
        currentResult,
        semesters,
        waivedModules,
        text,
        historyTurns,
        minors,
        { year: standingYear, sem: standingSem },
      );

      if (request !== requestId.current) return;
      setCurrentResult(updatedResult);
      setMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: reply,
          result: updatedResult,
        },
      ]);
    } catch (err) {
      if (request !== requestId.current) return;
      console.warn('AI iteration unavailable, falling back to deterministic iteration:', err);
      try {
        if (!currentResult) throw new Error('No active plan');
        const fallbackIter = iterateMockRecommendation(
          major,
          currentResult,
          semesters,
          waivedModules,
          text,
          minors,
          { year: standingYear, sem: standingSem },
        );
        setCurrentResult(fallbackIter.result);
        setMessages((prev) => [
          ...prev,
          {
            id: `asst-${Date.now()}`,
            role: 'assistant',
            content: fallbackIter.reply,
            result: fallbackIter.result,
          },
        ]);
      } catch (fallbackErr) {
        console.error('Deterministic iteration failed:', fallbackErr);
        setMessages((prev) => [
          ...prev,
          {
            id: `asst-${Date.now()}`,
            role: 'assistant',
            content: 'Sorry, I could not process that adjustment. Please try rephrasing or selecting a quick suggestion.',
          },
        ]);
      }
    } finally {
      if (request === requestId.current) setIsIterating(false);
    }
  };

  const handleApplyClick = (resToApply?: RecommendationResult) => {
    const target = resToApply || currentResult;
    if (!target) return;
    onApply(target.updatedSemesters, target.recommendedMinorId);
  };

  const handleStartOver = () => {
    requestId.current++;
    setIsLoading(false);
    setIsIterating(false);
    setCurrentResult(null);
    setMessages([]);
  };

  const field =
    'rounded-xl bg-canvas border border-line/40 px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent w-full';

  return (
    <aside
      className={`advisor-drawer transition-[width,opacity] duration-300 ease-in-out shrink-0 overflow-hidden bg-paper/60 backdrop-blur-sm sticky top-[49px] h-[calc(100vh-49px)] z-30 ${
        isOpen
          ? 'w-80 sm:w-96 border-l border-line/20 opacity-100 pointer-events-auto'
          : 'w-0 border-0 opacity-0 pointer-events-none'
      } max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-50 max-lg:w-full max-lg:max-w-sm max-lg:bg-paper max-lg:shadow-2xl ${
        isOpen ? 'max-lg:translate-x-0' : 'max-lg:translate-x-full'
      }`}
    >
      <div className="w-full sm:w-[384px] shrink-0 h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-line/20 shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-ink uppercase tracking-wider">
                Study Plan Advisor
              </h2>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleStartOver}
                  className="text-xs text-muted hover:text-ink transition-colors underline underline-offset-2 ml-1"
                >
                  Reset
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-ink/10 text-sm font-bold text-ink transition-colors hover:bg-ink/20"
              aria-label="Close advisor"
            >
              ✕
            </button>
          </div>

          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="h-11 w-11 animate-spin rounded-full border-2 border-ink border-t-transparent mb-3 opacity-60" />
              <span className="text-sm font-medium text-ink">Analyzing courses...</span>
            </div>
          ) : messages.length > 0 ? (
            /* Conversational Iteration View */
            <div className="flex-1 flex flex-col min-h-0">
              {/* Message History Stream */}
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    {m.role === 'user' ? (
                      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-ink text-canvas px-3.5 py-2 text-sm leading-relaxed shadow-xs">
                        {m.content}
                      </div>
                    ) : (
                      <div className="w-full space-y-3">
                        <div className="max-w-[95%] rounded-2xl rounded-tl-sm bg-canvas border border-line/30 p-3 text-sm leading-relaxed text-ink shadow-2xs">
                          {m.content}
                        </div>

                        {/* Plan Card (if this turn updated the plan) */}
                        {m.result && (
                          <div className="rounded-2xl bg-white/70 p-3.5 border border-line/30 shadow-xs space-y-2.5">
                            <div>
                              <div className="flex items-center justify-between gap-1 mb-1.5 flex-wrap">
                                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full inline-block ${
                                  m.result.usedMock
                                    ? 'bg-ink/5 text-muted'
                                    : 'bg-emerald-500/10 text-emerald-700'
                                }`}>
                                  {m.result.usedMock ? 'Basic suggestions' : 'AI suggestions'}
                                </span>
                                {m.result.recommendedMinorId && (
                                  <span className="text-[11px] font-medium text-muted bg-ink/5 px-2 py-0.5 rounded-full">
                                    Minor: {minors.find((min) => min.id === m.result?.recommendedMinorId)?.label || m.result.recommendedMinorId}
                                  </span>
                                )}
                              </div>
                              <h4 className="text-sm font-bold text-ink">{m.result.trackTitle}</h4>
                              <p className="text-sm text-muted leading-tight mt-1">
                                {m.result.trackRationale}
                              </p>
                              {m.result.recommendedMinorRationale && (
                                <p className="text-xs text-muted/80 leading-tight mt-1 italic">
                                  {m.result.recommendedMinorRationale}
                                </p>
                              )}
                            </div>

                            {/* Prerequisite & Availability Warnings */}
                            {m.result.warnings.length > 0 && (
                              <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs text-amber-900 space-y-1">
                                <span className="font-semibold flex items-center gap-1">
                                  Plan notes ({m.result.warnings.length})
                                </span>
                                <ul className="list-disc pl-4 space-y-0.5 text-[11px] leading-tight">
                                  {m.result.warnings.slice(0, 3).map((w, idx) => (
                                    <li key={idx}>{w}</li>
                                  ))}
                                  {m.result.warnings.length > 3 && (
                                    <li className="list-none pt-0.5"><details>
                                      <summary className="cursor-pointer text-muted">+{m.result.warnings.length - 3} more</summary>
                                      <ul className="mt-1 list-disc pl-4 space-y-0.5">{m.result.warnings.slice(3).map((warning, i) => <li key={i}>{warning}</li>)}</ul>
                                    </details></li>
                                  )}
                                </ul>
                              </div>
                            )}

                            {/* Electives */}
                            {m.result.recommendedElectives.length > 0 && (
                              <div className="pt-1.5 border-t border-line/20 space-y-1">
                                <span className="text-xs font-semibold text-muted uppercase tracking-wider block">
                                  Suggested Courses
                                </span>
                                <div className="space-y-1">
                                  {m.result.recommendedElectives.map((e) => (
                                    <div
                                      key={e.code}
                                      className="rounded-lg bg-canvas px-2 py-1 border border-line/20 text-sm flex items-center justify-between"
                                    >
                                      <span className="font-semibold text-ink">{e.code}</span>
                                      <span className="text-xs text-muted truncate max-w-[170px]">
                                        {e.reason}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Placements Summary */}
                            {m.result.addedModules && m.result.addedModules.length > 0 && (
                              <div className="pt-1.5 border-t border-line/20 space-y-1">
                                <span className="text-xs font-semibold text-muted uppercase tracking-wider block">
                                  Placements Summary
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {m.result.addedModules.map((a, i) => (
                                    <span
                                      key={`${a.code}-${a.year}-${a.sem}-${i}`}
                                      className="rounded-md bg-canvas px-1.5 py-0.5 border border-line/30 text-[11px] font-medium text-ink"
                                    >
                                      <strong className="text-ink">{a.code}</strong> → Y{a.year}S{a.sem}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Apply Button */}
                            <button
                              type="button"
                              onClick={() => handleApplyClick(m.result)}
                              className="w-full mt-1 rounded-xl bg-ink py-2 text-sm font-medium text-canvas hover:bg-ink/90 transition-opacity flex items-center justify-center shadow-xs"
                            >
                              Apply to Plan
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {isIterating && (
                  <div className="flex items-center gap-1.5 text-sm text-muted py-1">
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink border-t-transparent opacity-50" />
                    <span className="text-sm">Adjusting study plan...</span>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input Bar or Unavailable Action */}
              {currentResult ? (
                <div className="p-3 border-t border-line/20 bg-paper shrink-0 space-y-2">
                  {/* Quick suggestions */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                    {SUGGESTIONS.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        disabled={isIterating}
                        onClick={() => handleSendMessage(sug)}
                        className="whitespace-nowrap rounded-lg bg-canvas border border-line/30 px-2 py-1 text-xs font-medium text-ink/75 hover:bg-paper hover:text-ink transition-colors disabled:opacity-40 shrink-0"
                      >
                        + {sug}
                      </button>
                    ))}
                  </div>

                  {/* Text input form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleSendMessage();
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <input
                      type="text"
                      value={inputDraft}
                      disabled={isIterating}
                      onChange={(e) => setInputDraft(e.target.value)}
                      placeholder="Request adjustments (e.g. 'Swap CS4243 for an NLP course')..."
                      className="flex-1 rounded-xl bg-canvas border border-line/40 px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={isIterating || !inputDraft.trim()}
                      className="rounded-xl bg-ink px-3 py-2.5 text-sm font-medium text-canvas hover:bg-ink/90 transition-opacity disabled:opacity-30 shrink-0"
                    >
                      Send
                    </button>
                  </form>
                </div>
              ) : (
                <div className="p-3 border-t border-line/20 bg-paper shrink-0">
                  <button
                    type="button"
                    onClick={handleStartOver}
                    className="w-full rounded-xl bg-ink py-2 text-sm font-medium text-canvas hover:bg-ink/90 transition-opacity"
                  >
                    Back to Survey
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Initial Survey Form */
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
              <section className="rounded-2xl bg-white/70 p-4 border border-line/30 shadow-xs">
                <h3 className="mb-3 text-sm font-semibold text-ink">
                  Current Standing
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm text-muted font-medium">
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
                    <span className="text-sm text-muted font-medium">
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
                  <span className="text-sm text-muted font-medium block mb-1.5">
                    Target Workload
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[16, 20, 24].map((mcs) => (
                      <button
                        key={mcs}
                        type="button"
                        onClick={() => setTargetMcs(mcs)}
                        className={`rounded-xl py-1.5 text-center text-sm font-medium transition-colors border ${
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
                <h3 className="mb-2 text-sm font-semibold text-ink">
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
                        className={`rounded-lg px-2.5 py-1 text-sm font-medium transition-all border ${
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
                <h3 className="mb-3 text-sm font-semibold text-ink">
                  Career & Minors
                </h3>
                <div className="flex flex-col gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm text-muted font-medium">
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
                    <span className="text-sm text-muted font-medium">
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
                    <span className="text-sm text-muted font-medium">
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
                onClick={handleInitialGenerate}
                className="w-full rounded-2xl bg-ink px-4 py-2.5 text-sm font-medium text-canvas hover:bg-ink/90 transition-opacity flex items-center justify-center shadow-xs"
              >
                Generate Plan
              </button>
            </div>
          )}
        </div>
      </aside>
    );
  };
