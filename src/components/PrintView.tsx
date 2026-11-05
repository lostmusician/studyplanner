import type {
  Major,
  StudentSemester,
  WaivedModule,
  SecondaryProgramme,
  NocDuration,
  SpecialProgramme,
} from '@shared/types';
import type { RequirementStatus, Stats } from '../lib/studyPlan';
import { computeRequirements, computeBreadthDepth, computeProgrammeElectives } from '../lib/studyPlan';

interface Props {
  studentName: string;
  matricNumber: string;
  studentYear: string;
  major: Major;
  stats: Stats;
  requirements: RequirementStatus[];
  semesters: StudentSemester[];
  waivedModules: WaivedModule[];
  secondMajors: SecondaryProgramme[];
  minors: SecondaryProgramme[];
  secondMajorId: string | null;
  minorIds: string[];
  nocDuration: NocDuration | null;
  specialProgramme: SpecialProgramme | null;
  polytechnicApcUnits?: number;
}

export const PrintView = ({
  studentName,
  matricNumber,
  studentYear,
  major,
  stats,
  requirements,
  semesters,
  waivedModules,
  secondMajors,
  minors,
  secondMajorId,
  minorIds,
  nocDuration,
  specialProgramme,
  polytechnicApcUnits,
}: Props) => {
  const declaredSecondMajor = secondMajorId
    ? secondMajors.find((m) => m.id === secondMajorId) ?? null
    : null;
  const declaredMinors = minors.filter((m) => minorIds.includes(m.id));
  const declaredSecondaries = declaredSecondMajor ? [declaredSecondMajor, ...declaredMinors] : declaredMinors;

  const otherCategoriesTargetSum = major.categories
    .filter((cat) => cat.id !== 'unrestricted-electives')
    .reduce((sum, cat) => sum + (cat.mcTarget ?? 0), 0);
  const dynamicUeTarget = Math.max(0, major.totalMcTarget - otherCategoriesTargetSum);

  const depthConfig = major.breadthDepth
    ? computeBreadthDepth(major, semesters, waivedModules)
    : major.programmeElectives
      ? computeProgrammeElectives(major, semesters, waivedModules)
      : null;
  const depthTitle = major.breadthDepth ? 'Breadth & Depth' : 'Programme Electives';

  const generatedOn = new Date().toLocaleDateString('en-SG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const requirementsByCategory = major.categories
    .map((cat) => ({ category: cat, rows: requirements.filter((r) => r.categoryId === cat.id) }))
    .filter((group) => group.rows.length > 0);

  return (
    <div className="hidden print:block text-ink">
      <div className="mb-6 flex items-start justify-between border-b border-ink/20 pb-4">
        <div>
          <div className="text-lg font-semibold">{studentName || 'Student Name'}</div>
          <div className="text-xs text-muted">
            {matricNumber ? `${studentYear} · ${matricNumber}` : studentYear}
          </div>
          <div className="mt-2 text-sm font-medium">
            {major.label}
            <span className="ml-1 text-xs font-normal text-muted">
              · {major.school} · {major.batches.join(', ')}
            </span>
          </div>
          {(declaredSecondMajor || declaredMinors.length > 0 || nocDuration || specialProgramme || (polytechnicApcUnits ?? 0) > 0) && (
            <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
              {(polytechnicApcUnits ?? 0) > 0 && (
                <span className="rounded-full border border-ink/20 px-2 py-0.5">
                  Polytechnic Track ({polytechnicApcUnits} MC APC)
                </span>
              )}
              {declaredSecondMajor && (
                <span className="rounded-full border border-ink/20 px-2 py-0.5">
                  2nd Major: {declaredSecondMajor.label}
                </span>
              )}
              {declaredMinors.map((m) => (
                <span key={m.id} className="rounded-full border border-ink/20 px-2 py-0.5">
                  Minor: {m.label}
                </span>
              ))}
              {nocDuration && (
                <span className="rounded-full border border-ink/20 px-2 py-0.5">NOC: {nocDuration}</span>
              )}
              {specialProgramme === 'sep' && (
                <span className="rounded-full border border-ink/20 px-2 py-0.5">SEP (Exchange)</span>
              )}
              {specialProgramme === 'gex' && (
                <span className="rounded-full border border-ink/20 px-2 py-0.5">GEx</span>
              )}
              {specialProgramme === 'regional-iex' && (
                <span className="rounded-full border border-ink/20 px-2 py-0.5">Regional IEx</span>
              )}
              {specialProgramme === 'siip' && (
                <span className="rounded-full border border-ink/20 px-2 py-0.5">SIIP</span>
              )}
            </div>
          )}
        </div>
        <div className="text-[10px] text-muted">Generated on {generatedOn}</div>
      </div>

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-semibold">Progress</h2>
        <div className="mb-2 text-xs font-medium">
          Total: {stats.totalMc + (polytechnicApcUnits ?? 0)}/{major.totalMcTarget} MC
          {(polytechnicApcUnits ?? 0) > 0 && ` (incl. ${polytechnicApcUnits} MC Poly APC)`}
        </div>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
          {major.categories.map((cat) => {
            const isUe = cat.id === 'unrestricted-electives';
            const catMc = (stats.byCategory[cat.id] ?? 0) + (isUe ? (polytechnicApcUnits ?? 0) : 0);
            const catTarget = isUe ? dynamicUeTarget : (cat.mcTarget ?? 0);
            return (
              <li key={cat.id} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 flex-shrink-0 rounded-full"
                  style={{
                    backgroundColor: cat.color,
                    WebkitPrintColorAdjust: 'exact',
                    printColorAdjust: 'exact',
                  }}
                  aria-hidden="true"
                />
                {cat.label}: {catMc}/{catTarget} MC
                {isUe && (polytechnicApcUnits ?? 0) > 0 && (
                  <span className="text-muted text-[10px]">({polytechnicApcUnits} MC APC)</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mb-5">
        <h2 className="mb-2 text-sm font-semibold">Requirements</h2>
        {requirementsByCategory.map(({ category, rows }) => (
          <div key={category.id} className="mb-3">
            <h3 className="mb-1 text-xs font-semibold text-muted">{category.label}</h3>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs">
              {rows.map((r) => (
                <li key={r.name} className="flex items-baseline gap-1.5">
                  <span>{r.fulfilled ? '✓' : '○'}</span>
                  <span>{r.name}</span>
                  {r.need > 1 && <span className="text-muted">({r.have}/{r.need})</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {depthConfig && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-semibold">{depthTitle}</h2>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs">
            {depthConfig.constraints.map((c) => (
              <li key={c.id} className="flex items-baseline gap-1.5">
                <span>{c.fulfilled ? '✓' : '○'}</span>
                <span>{c.label}</span>
                {c.detail && <span className="text-muted">({c.detail})</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {declaredSecondaries.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-sm font-semibold">Second Major &amp; Minor Progress</h2>
          {declaredSecondaries.map((programme) => {
            const progReqs = computeRequirements(programme, semesters, waivedModules);
            return (
              <div key={programme.id} className="mb-3">
                <h3 className="mb-1 text-xs font-semibold text-muted">
                  {programme.label} ({programme.kind === 'second-major' ? 'Second Major' : 'Minor'})
                </h3>
                <ul className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs">
                  {progReqs.map((r) => (
                    <li key={r.name} className="flex items-baseline gap-1.5">
                      <span>{r.fulfilled ? '✓' : '○'}</span>
                      <span>{r.name}</span>
                      {r.need > 1 && <span className="text-muted">({r.have}/{r.need})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}

      <section className="break-before-page">
        <h2 className="mb-2 text-sm font-semibold">Semester Plan</h2>
        <div className="grid grid-cols-2 gap-3">
          {semesters.map((sem) => (
            <div
              key={`${sem.year}-${sem.sem}`}
              className="break-inside-avoid rounded-lg border border-ink/20 p-2"
            >
              <h3 className="mb-1 text-xs font-semibold">
                Year {sem.year} Semester {sem.sem}
              </h3>
              {sem.modules.length === 0 ? (
                <p className="text-[10px] text-muted">No modules</p>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {sem.modules.map((m) => (
                    <li key={m.code} className="flex items-baseline justify-between gap-2 text-[10px]">
                      <span>
                        <span className="font-mono font-semibold">{m.code}</span> {m.name}
                      </span>
                      <span className="whitespace-nowrap text-muted">{m.mcs} MC</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {waivedModules.length > 0 && (
          <div className="mt-3 break-inside-avoid rounded-lg border border-ink/20 p-2">
            <h3 className="mb-1 text-xs font-semibold">Waived</h3>
            <ul className="flex flex-col gap-0.5">
              {waivedModules.map((m) => (
                <li key={m.code} className="flex items-baseline justify-between gap-2 text-[10px]">
                  <span>
                    <span className="font-mono font-semibold">{m.code}</span> {m.name}
                  </span>
                  <span className="whitespace-nowrap text-muted">{m.mcs} MC</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
};
