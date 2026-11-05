import { useMemo, useState, type ReactNode } from 'react';
import type {
  Major,
  SecondaryProgramme,
  SpecialProgramme,
  StudentSemester,
  WaivedModule,
} from '@shared/types';
import {
  GALLERY_KINDS,
  PATHWAY_INFO,
  buildNocPreviews,
  collectFaculties,
  filterProgrammes,
  getPathwayInfo,
  matchesPathwayQuery,
  programmeKindLabel,
  secondarySelectionBlock,
  type GalleryKind,
} from '../lib/gallery';
import { ExploreDetailDialog, type ExploreDetail } from './ExploreDetailDialog';

interface Props {
  majors: Major[];
  majorId: string;
  secondMajors: SecondaryProgramme[];
  minors: SecondaryProgramme[];
  secondMajorId: string | null;
  minorIds: string[];
  specialProgrammes: SpecialProgramme[];
  semesters: StudentSemester[];
  waivedModules: WaivedModule[];
  onRequestSwitchMajor: (id: string) => void;
  setSecondMajorId: (id: string | null) => void;
  toggleMinorId: (id: string) => void;
  togglePathway: (programme: SpecialProgramme) => void;
}

const KIND_NOUNS: Record<GalleryKind, string> = {
  major: 'primary majors',
  'second-major': 'second majors',
  minor: 'minors',
  overseas: 'pathways',
};

export const ExploreGallery = ({
  majors,
  majorId,
  secondMajors,
  minors,
  secondMajorId,
  minorIds,
  specialProgrammes,
  semesters,
  waivedModules,
  onRequestSwitchMajor,
  setSecondMajorId,
  toggleMinorId,
  togglePathway,
}: Props) => {
  const [kind, setKind] = useState<GalleryKind>('major');
  const [query, setQuery] = useState('');
  const [school, setSchool] = useState('');
  const [detail, setDetail] = useState<ExploreDetail | null>(null);

  const secondaryProgrammes = kind === 'second-major' ? secondMajors : kind === 'minor' ? minors : [];
  const faculties = useMemo(() => collectFaculties(secondaryProgrammes), [secondaryProgrammes]);
  const visibleMajors = useMemo(
    () => (kind === 'major' ? filterProgrammes(majors, query, school) : []),
    [kind, majors, query, school],
  );
  const visibleSecondary = useMemo(
    () => (secondaryProgrammes.length > 0 ? filterProgrammes(secondaryProgrammes, query, school) : []),
    [secondaryProgrammes, query, school],
  );
  const visiblePathways = useMemo(
    () => (kind === 'overseas' ? PATHWAY_INFO.filter((info) => matchesPathwayQuery(info, query)) : []),
    [kind, query],
  );
  const nocPreviews = useMemo(() => buildNocPreviews(majors, majorId), [majors, majorId]);

  const counts: Record<GalleryKind, number> = {
    major: majors.length,
    'second-major': secondMajors.length,
    minor: minors.length,
    overseas: PATHWAY_INFO.length,
  };
  const total = counts[kind];
  const shown = kind === 'major' ? visibleMajors.length : kind === 'overseas' ? visiblePathways.length : visibleSecondary.length;
  const hasFilters = query.trim().length > 0 || school.length > 0;

  const resetFilters = () => {
    setQuery('');
    setSchool('');
  };

  const changeKind = (next: GalleryKind) => {
    setKind(next);
    setSchool('');
  };

  return (
    <section className="flex min-w-0 flex-col gap-5" aria-labelledby="explore-heading">
      <header className="flex flex-col gap-1">
        <h1 id="explore-heading" className="text-lg font-semibold leading-tight text-ink sm:text-xl">
          Explore programmes
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted">
          Find a programme or global experience that fits your plan.
        </p>
      </header>

      <div className="flex flex-col gap-2.5 rounded-2xl border border-ink/10 bg-paper/35 p-3">
        <div role="group" aria-label="Programme type" className="flex flex-wrap gap-1">
          {GALLERY_KINDS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={kind === option.id}
              onClick={() => changeKind(option.id)}
              className={`flex min-h-10 items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                kind === option.id ? 'bg-ink text-canvas' : 'text-muted hover:bg-ink/[0.06] hover:text-ink'
              }`}
            >
              <span>{option.label}</span>
              <span className={`text-xs ${kind === option.id ? 'text-canvas/70' : 'text-muted/70'}`}>
                {counts[option.id]}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label={`Search ${KIND_NOUNS[kind]}`}
            placeholder={`Search ${KIND_NOUNS[kind]} by title or faculty…`}
            className="w-full rounded-xl border border-ink/15 bg-canvas px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent sm:max-w-xs"
          />
          {faculties.length > 1 && (
            <select
              aria-label="Filter by faculty"
              value={school}
              onChange={(event) => setSchool(event.target.value)}
              className="w-full rounded-xl border border-ink/15 bg-canvas px-3 py-2 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-accent sm:w-auto"
            >
              <option value="">All faculties</option>
              {faculties.map((faculty) => (
                <option key={faculty.value} value={faculty.value}>
                  {faculty.label} ({faculty.count})
                </option>
              ))}
            </select>
          )}
          <div className="flex items-center gap-2 sm:ml-auto">
            <span role="status" aria-live="polite" className="text-xs text-muted">
              {hasFilters ? `Showing ${shown} of ${total}` : `${total} ${total === 1 ? 'entry' : 'entries'}`}
            </span>
            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-lg px-2 py-1 text-sm font-medium text-ink underline underline-offset-2 hover:bg-ink/[0.06]"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>
      </div>

      {kind === 'major' && (
        <p className="text-xs text-muted">
          The five NUS College computing majors supported by this planner.
        </p>
      )}

      {shown === 0 ? (
        <div role="status" className="rounded-2xl border border-dashed border-ink/20 bg-paper/35 px-5 py-8 text-center">
          <p className="text-sm font-medium text-ink">No programmes match your filters.</p>
          <p className="mt-1 text-xs text-muted">
            Try a different title, faculty or programme type.
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="mt-3 rounded-xl bg-ink px-3 py-2 text-sm font-medium text-canvas transition-opacity hover:opacity-90"
          >
            Reset filters
          </button>
        </div>
      ) : (
        <ul role="list" className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {kind === 'major' &&
            visibleMajors.map((major) => (
              <li key={major.id} className="min-w-0">
                <GalleryCard
                  title={major.label}
                  typeLabel="Primary major"
                  faculty={major.school}
                  meta={`${major.totalMcTarget} MC`}
                  selected={major.id === majorId}
                  selectedLabel="Current plan"
                  onDetails={() => setDetail({ kind: 'major', major })}
                  action={
                    major.id !== majorId ? (
                      <button
                        type="button"
                        onClick={() => onRequestSwitchMajor(major.id)}
                        aria-label={`Switch to ${major.label}`}
                        className="min-h-11 rounded-xl border border-ink/15 bg-canvas px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-paper"
                      >
                        Switch…
                      </button>
                    ) : undefined
                  }
                />
              </li>
            ))}

          {kind !== 'major' && kind !== 'overseas' &&
            visibleSecondary.map((programme) => {
              const selected =
                programme.kind === 'minor' ? minorIds.includes(programme.id) : secondMajorId === programme.id;
              const blockReason = secondarySelectionBlock(programme, { majorId, secondMajorId, minorIds });
              return (
                <li key={`${programme.kind}-${programme.id}`} className="min-w-0">
                  <GalleryCard
                    title={programme.label}
                    typeLabel={programmeKindLabel(programme)}
                    faculty={programme.school}
                    meta={
                      programme.requirements.length > 0
                        ? `${programme.mcTarget} MC`
                        : `${programme.mcTarget} MC · Manual review`
                    }
                    selected={selected}
                    selectedLabel={selected ? 'In plan' : undefined}
                    onDetails={() => setDetail({ kind: 'secondary', programme })}
                    blockReason={selected ? undefined : blockReason}
                    action={
                      <button
                        type="button"
                        onClick={() => {
                          if (programme.kind === 'minor') toggleMinorId(programme.id);
                          else setSecondMajorId(selected ? null : programme.id);
                        }}
                        disabled={!selected && Boolean(blockReason)}
                        aria-label={selected ? `Remove ${programme.label} from plan` : `Add ${programme.label} to plan`}
                        className={`min-h-11 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                          selected
                            ? 'border border-ink/15 bg-canvas text-ink hover:bg-paper'
                            : 'bg-ink text-canvas hover:opacity-90'
                        }`}
                      >
                        {selected ? 'Remove' : 'Add'}
                      </button>
                    }
                  />
                </li>
              );
            })}

          {kind === 'overseas' &&
            visiblePathways.map((info) => {
              const selected = specialProgrammes.includes(info.id);
              const otherNoc = info.id.startsWith('noc-')
                ? specialProgrammes.find((programme) => programme.startsWith('noc-') && programme !== info.id)
                : undefined;
              return (
                <li key={info.id} className="min-w-0">
                  <GalleryCard
                    title={getPathwayInfo(info.id)?.label ?? info.label}
                    typeLabel={info.kind === 'noc' ? 'NOC' : 'Global pathway'}
                    faculty={info.kind === 'noc' ? 'NUS Overseas Colleges' : 'NUS College'}
                    meta={info.shortEffect}
                    selected={selected}
                    selectedLabel={selected ? 'In plan' : undefined}
                    onDetails={() => setDetail({ kind: 'pathway', id: info.id })}
                    action={
                      <button
                        type="button"
                        onClick={() => togglePathway(info.id)}
                        aria-label={selected ? `Remove ${info.label} from plan` : `Select ${info.label}`}
                        className={`min-h-11 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
                          selected
                            ? 'border border-ink/15 bg-canvas text-ink hover:bg-paper'
                            : 'bg-ink text-canvas hover:opacity-90'
                        }`}
                      >
                        {selected ? 'Remove' : otherNoc ? 'Replace NOC' : 'Select'}
                      </button>
                    }
                  />
                </li>
              );
            })}
        </ul>
      )}

      {detail && (
        <ExploreDetailDialog
          target={detail}
          majorId={majorId}
          secondMajorId={secondMajorId}
          minorIds={minorIds}
          specialProgrammes={specialProgrammes}
          semesters={semesters}
          waivedModules={waivedModules}
          nocPreviews={nocPreviews}
          onClose={() => setDetail(null)}
          onRequestSwitchMajor={(id) => {
            setDetail(null);
            onRequestSwitchMajor(id);
          }}
          setSecondMajorId={setSecondMajorId}
          toggleMinorId={toggleMinorId}
          togglePathway={togglePathway}
        />
      )}
    </section>
  );
};

const GalleryCard = ({
  title,
  typeLabel,
  faculty,
  meta,
  selected,
  selectedLabel,
  action,
  blockReason,
  onDetails,
}: {
  title: string;
  typeLabel: string;
  faculty?: string;
  meta: string;
  selected: boolean;
  selectedLabel?: string;
  action?: ReactNode;
  blockReason?: string;
  onDetails: () => void;
}) => (
  <article
    className={`flex h-full min-w-0 flex-col gap-2 rounded-2xl border bg-paper/45 p-4 ${
      selected ? 'border-ink/30' : 'border-ink/10'
    }`}
  >
    <div className="flex min-w-0 items-start justify-between gap-2">
      <h2 className="min-w-0 break-words text-sm font-semibold leading-snug text-ink">{title}</h2>
      <span className="shrink-0 rounded-full bg-ink/[0.07] px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
        {typeLabel}
      </span>
    </div>
    {faculty && <p className="break-words text-xs leading-snug text-muted">{faculty}</p>}
    <p className="text-xs leading-snug text-muted">{meta}</p>
    {selected && selectedLabel && (
      <p className="text-xs font-medium text-ink">{selectedLabel}</p>
    )}
    {blockReason && <p className="text-xs leading-snug text-amber-800">{blockReason}</p>}
    <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
      <button
        type="button"
        onClick={onDetails}
        aria-label={`View details for ${title}`}
        className="min-h-11 rounded-xl px-3 py-1.5 text-sm font-medium text-ink underline-offset-2 transition-colors hover:bg-ink/[0.06]"
      >
        View details
      </button>
      {action}
    </div>
  </article>
);
