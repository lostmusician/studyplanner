import { useMemo, useRef } from 'react';
import type {
  Major,
  SecondaryProgramme,
  SpecialProgramme,
  StudentSemester,
  WaivedModule,
} from '@shared/types';
import { useModalFocus } from '../hooks/useModalFocus';
import {
  buildMajorRequirementGroups,
  buildProgrammeCoverage,
  coverageStatusLabel,
  getPathwayInfo,
  programmeKindLabel,
  secondarySelectionBlock,
  type MajorRequirementItem,
  type NocPreview,
  type ProgrammeCoverageRow,
} from '../lib/gallery';

export type ExploreDetail =
  | { kind: 'major'; major: Major }
  | { kind: 'secondary'; programme: SecondaryProgramme }
  | { kind: 'pathway'; id: SpecialProgramme };

interface Props {
  target: ExploreDetail;
  majorId: string;
  secondMajorId: string | null;
  minorIds: string[];
  specialProgrammes: SpecialProgramme[];
  semesters: StudentSemester[];
  waivedModules: WaivedModule[];
  nocPreviews: NocPreview[];
  onClose: () => void;
  onRequestSwitchMajor: (id: string) => void;
  setSecondMajorId: (id: string | null) => void;
  toggleMinorId: (id: string) => void;
  togglePathway: (programme: SpecialProgramme) => void;
}

const actionButton = (primary: boolean, disabled = false): string =>
  `min-h-11 rounded-xl px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-45 ${
    primary ? 'bg-ink text-canvas hover:opacity-90' : 'border border-ink/15 bg-canvas text-ink hover:bg-paper'
  }`;

export const ExploreDetailDialog = ({
  target,
  majorId,
  secondMajorId,
  minorIds,
  specialProgrammes,
  semesters,
  waivedModules,
  nocPreviews,
  onClose,
  onRequestSwitchMajor,
  setSecondMajorId,
  toggleMinorId,
  togglePathway,
}: Props) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { skipRestore } = useModalFocus({
    active: true,
    modal: true,
    containerRef: dialogRef,
    initialFocusRef: closeButtonRef,
    onClose,
  });

  const programme = target.kind === 'secondary' ? target.programme : null;
  const coverage = useMemo(
    () => (programme ? buildProgrammeCoverage(programme, semesters, waivedModules) : null),
    [programme, semesters, waivedModules],
  );

  const heading =
    target.kind === 'major'
      ? { title: target.major.label, subtitle: `${target.major.school} · ${target.major.batches.join(', ')}` }
      : target.kind === 'secondary'
        ? { title: target.programme.label, subtitle: `${programmeKindLabel(target.programme)}${target.programme.school ? ` · ${target.programme.school}` : ''}` }
        : { title: getPathwayInfo(target.id)?.label ?? target.id, subtitle: target.id.startsWith('noc-') ? 'NUS Overseas Colleges pathway' : 'Global Pathway experience' };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-ink/40 px-4 py-6"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="explore-detail-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="my-auto w-full max-w-2xl overflow-hidden rounded-3xl border border-ink/10 bg-canvas shadow-soft"
      >
        <div className="flex items-start justify-between gap-3 border-b border-ink/10 px-5 py-4">
          <div className="min-w-0">
            <h2 id="explore-detail-title" className="break-words text-base font-semibold leading-snug text-ink">
              {heading.title}
            </h2>
            <p className="mt-0.5 break-words text-xs text-muted">{heading.subtitle}</p>
          </div>
          <button
            type="button"
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close details"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink/10 text-xs font-bold text-ink transition-colors hover:bg-ink/20"
          >
            ✕
          </button>
        </div>

        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto overscroll-contain px-5 py-4">
          {target.kind === 'major' && (
            <MajorDetails
              major={target.major}
              isCurrent={target.major.id === majorId}
              onRequestSwitchMajor={(id) => {
                skipRestore();
                onRequestSwitchMajor(id);
              }}
            />
          )}

          {target.kind === 'secondary' && programme && coverage && (
            <SecondaryDetails
              programme={programme}
              coverage={coverage}
              selected={
                programme.kind === 'minor' ? minorIds.includes(programme.id) : secondMajorId === programme.id
              }
              blockReason={secondarySelectionBlock(programme, {
                majorId,
                secondMajorId,
                minorIds,
              })}
              onToggle={() => {
                if (programme.kind === 'minor') toggleMinorId(programme.id);
                else {
                  const isSelected = secondMajorId === programme.id;
                  setSecondMajorId(isSelected ? null : programme.id);
                }
              }}
            />
          )}

          {target.kind === 'pathway' && (
            <PathwayDetails
              id={target.id}
              selected={specialProgrammes.includes(target.id)}
              specialProgrammes={specialProgrammes}
              nocPreviews={nocPreviews}
              onToggle={() => togglePathway(target.id)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

const MajorDetails = ({
  major,
  isCurrent,
  onRequestSwitchMajor,
}: {
  major: Major;
  isCurrent: boolean;
  onRequestSwitchMajor: (id: string) => void;
}) => {
  const groups = buildMajorRequirementGroups(major);

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-paper/55 px-3 py-2.5">
        <span className="text-sm text-muted">Degree target</span>
        <span className="text-sm font-semibold text-ink">{major.totalMcTarget} MC</span>
      </div>
      <p className="text-sm leading-relaxed text-muted">
        One of the five NUS College computing majors supported by this planner.
      </p>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-ink">Curriculum breakdown</h3>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {major.categories.map((category) => (
            <li key={category.id} className="flex items-baseline justify-between gap-2 rounded-xl bg-paper/45 px-3 py-2">
              <span className="min-w-0 break-words text-sm text-ink">{category.label}</span>
              {category.mcTarget !== undefined && (
                <span className="shrink-0 text-xs text-muted">{category.mcTarget} MC</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-ink">Course requirements</h3>
        {groups.map((group) => (
          <div key={group.id} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="text-sm font-semibold text-ink">{group.label}</h4>
              {group.mcTarget !== undefined && (
                <span className="shrink-0 text-xs text-muted">{group.mcTarget} MC</span>
              )}
            </div>
            <ul className="flex flex-col gap-1.5">
              {group.requirements.map((requirement) => (
                <MajorRequirementRow key={requirement.name} requirement={requirement} />
              ))}
            </ul>
          </div>
        ))}
      </section>

      <p className="text-sm leading-relaxed text-muted">
        {isCurrent
          ? 'This is your current primary major.'
          : 'Switching replaces your current plan after you confirm; only the new major’s saved or sample plan is loaded.'}
      </p>
      {isCurrent ? (
        <p className="rounded-xl border border-ink/10 bg-paper/60 px-3 py-2 text-sm font-medium text-ink">
          Currently planning this major
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => onRequestSwitchMajor(major.id)} className={actionButton(true)}>
            Switch to this major…
          </button>
          <span className="text-xs text-muted">You will be asked to confirm before anything changes.</span>
        </div>
      )}
    </>
  );
};

const MajorRequirementRow = ({ requirement }: { requirement: MajorRequirementItem }) => (
  <li className="rounded-xl bg-paper/45 px-3 py-2">
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <span className="min-w-0 flex-1 break-words text-sm text-ink">{requirement.name}</span>
      {requirement.nonCourse ? (
        <span className="shrink-0 text-xs font-medium text-muted">Non-course requirement</span>
      ) : requirement.amount ? (
        <span className="shrink-0 text-xs text-muted">{requirement.amount}</span>
      ) : null}
    </div>
    {requirement.courses.length > 0 && (
      <p className="mt-1 break-words text-xs leading-snug text-muted">
        Eligible courses: {requirement.courses.join(', ')}
      </p>
    )}
    {requirement.alternatives.length > 0 && (
      <p className="mt-0.5 break-words text-xs leading-snug text-muted">
        Alternative: {requirement.alternatives.join(' · ')}
      </p>
    )}
    {requirement.globalPathway && (
      <p className="mt-0.5 text-xs leading-snug text-muted">Choose a pathway in Settings → Pathways.</p>
    )}
  </li>
);

const SecondaryDetails = ({
  programme,
  coverage,
  selected,
  blockReason,
  onToggle,
}: {
  programme: SecondaryProgramme;
  coverage: ReturnType<typeof buildProgrammeCoverage>;
  selected: boolean;
  blockReason?: string;
  onToggle: () => void;
}) => (
  <>
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <Fact label="Type" value={programmeKindLabel(programme)} />
      <Fact label="Target" value={`${programme.mcTarget} MC`} />
      <Fact label="Faculty" value={programme.school ?? 'Not listed'} />
    </dl>

    {coverage.authored ? (
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-ink">Checklist coverage</h3>
        <div className="rounded-xl border border-ink/10 bg-paper/55 px-3 py-2.5">
          <p className="text-sm font-medium leading-relaxed text-ink">
            {coverage.allCovered
              ? `All ${coverage.rows.length} course requirements are covered by your current plan.`
              : `${coverage.covered} of ${coverage.rows.length} course requirements covered by your current plan${coverage.partial > 0 ? ` · ${coverage.partial} partly covered` : ''}.`}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Checklist coverage only; transfers, substitutions, approvals and exact remaining units still
            need manual review.
          </p>
        </div>
        <ul className="flex flex-col gap-1.5">
          {coverage.rows.map((row) => (
            <CoverageRow key={row.name} row={row} />
          ))}
        </ul>
      </section>
    ) : (
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-ink">Course requirements</h3>
        <div className="rounded-xl border border-ink/10 bg-paper/55 px-3 py-3">
          <p className="text-sm font-medium leading-relaxed text-ink">
            Manual review required — this planner does not store the course checklist for this programme.
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Target: {programme.mcTarget} MC. Confirm course rules, substitutions and eligibility with the
            official source or the programme office before relying on this planning choice.
          </p>
        </div>
      </section>
    )}

    {programme.sourceUrl && (
      <a
        href={programme.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="w-fit text-sm font-medium text-ink underline underline-offset-2"
      >
        Official NUS requirements ↗
      </a>
    )}

    {selected && (
      <p className="text-xs text-muted">
        Selected in your plan. Coverage updates as courses are placed, waived or removed.
      </p>
    )}
    {blockReason && <p className="text-xs font-medium text-amber-800">{blockReason}</p>}

    <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3">
      <button
        type="button"
        onClick={onToggle}
        disabled={!selected && Boolean(blockReason)}
        className={actionButton(!selected)}
      >
        {selected ? 'Remove from plan' : `Add ${programmeKindLabel(programme).toLowerCase()}`}
      </button>
      {selected && (
        <span className="text-xs text-muted">
          Removing is always available, even if the combination later needs review.
        </span>
      )}
    </div>
  </>
);

const CoverageRow = ({ row }: { row: ProgrammeCoverageRow }) => (
  <li className="flex items-start gap-2 rounded-xl bg-paper/45 px-3 py-2">
    <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
      row.status === 'covered' ? 'bg-ink' : row.status === 'partial' ? 'bg-amber-500' : 'border border-muted'
    }`} />
    <div className="min-w-0 flex-1">
      <p className="break-words text-sm leading-relaxed text-ink">{row.name}</p>
      {row.info && row.status !== 'covered' && (
        <p className="mt-0.5 text-xs leading-snug text-amber-800">{row.info}</p>
      )}
    </div>
    <span className="shrink-0 text-right text-xs leading-snug text-muted">
      {row.have}/{row.need}{row.units ? 'u' : ''}
      <span className="block">{coverageStatusLabel[row.status]}</span>
    </span>
  </li>
);

const PathwayDetails = ({
  id,
  selected,
  specialProgrammes,
  nocPreviews,
  onToggle,
}: {
  id: SpecialProgramme;
  selected: boolean;
  specialProgrammes: SpecialProgramme[];
  nocPreviews: NocPreview[];
  onToggle: () => void;
}) => {
  const info = getPathwayInfo(id);
  if (!info) return null;
  const preview = id.startsWith('noc-')
    ? nocPreviews.find((candidate) => candidate.duration === id.slice(4))
    : undefined;
  const otherNoc = id.startsWith('noc-')
    ? specialProgrammes.find((programme) => programme.startsWith('noc-') && programme !== id)
    : undefined;
  const otherNocLabel = otherNoc ? getPathwayInfo(otherNoc)?.label ?? otherNoc : null;

  return (
    <>
      <ul className="flex flex-col gap-1.5">
        {info.effects.map((effect) => (
          <li key={effect} className="flex items-start gap-2 text-sm leading-relaxed text-muted">
            <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink/50" />
            <span>{effect}</span>
          </li>
        ))}
      </ul>

      {preview && (
        <section className="rounded-xl border border-ink/10 bg-paper/55 px-3 py-2.5">
          <h3 className="text-sm font-semibold text-ink">Preview with {preview.label}</h3>
          <dl className="mt-2 flex flex-col gap-1.5">
            <PreviewRow
              label="Making Connections"
              value={preview.waiverCount > 0
                ? `${preview.defaultMceNeed} → ${preview.mceNeed} MCEs`
                : `${preview.defaultMceNeed} MCEs · no waiver`}
            />
            {preview.nusCollegeTarget !== null && preview.adjustedNusCollegeTarget !== null && (
              <PreviewRow
                label="NUS College MC target"
                value={preview.waiverCount > 0
                  ? `${preview.nusCollegeTarget} → ${preview.adjustedNusCollegeTarget} MC`
                  : `${preview.nusCollegeTarget} MC`}
              />
            )}
            <PreviewRow
              label="Unrestricted electives"
              value={preview.waiverCount > 0
                ? `${preview.ueTarget} → ${preview.adjustedUeTarget} MC`
                : `${preview.ueTarget} MC`}
            />
          </dl>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Previewed against your current primary major before any NOC adjustment. Choosing a different
            NOC replaces only the previous NOC duration.
          </p>
        </section>
      )}

      <p className="text-xs leading-relaxed text-muted">
        This planner has no partner-university course or mapping database. Selecting a pathway records an
        intention; it does not create courses, credit or approvals.
      </p>

      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {info.links.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-ink underline underline-offset-2"
          >
            {link.label} ↗
          </a>
        ))}
      </div>

      {otherNocLabel && !selected && (
        <p className="text-xs text-muted">
          Selecting {info.label} replaces {otherNocLabel}; other pathways stay selected.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3">
        <button type="button" onClick={onToggle} className={actionButton(!selected)}>
          {selected ? 'Remove from plan' : otherNocLabel ? 'Replace with this NOC' : 'Select pathway'}
        </button>
      </div>
    </>
  );
};

const Fact = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-ink/10 bg-paper/55 px-3 py-2">
    <dt className="text-xs text-muted">{label}</dt>
    <dd className="mt-0.5 break-words text-sm font-semibold text-ink">{value}</dd>
  </div>
);

const PreviewRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-3">
    <dt className="text-xs text-muted">{label}</dt>
    <dd className="shrink-0 text-sm font-medium text-ink">{value}</dd>
  </div>
);
