import type { SecondaryProgramme, StudentSemester, WaivedModule } from '@shared/types';
import type { ConstraintStatus } from '../lib/studyPlan';
import { computeRequirements, computeDoubleCount } from '../lib/studyPlan';
import { ConstraintChip, RequirementRow } from './StatsSummary';

interface Props {
  programme: SecondaryProgramme;
  semesters: StudentSemester[];
  waivedModules: WaivedModule[];
}

export const SecondaryProgrammePanel = ({ programme, semesters, waivedModules }: Props) => {
  const requirements = computeRequirements(programme, semesters, waivedModules);
  const fulfilled = requirements.filter((req) => req.fulfilled).length;
  const doubleCount = computeDoubleCount(programme, semesters, waivedModules);
  const kindLabel = programme.kind === 'second-major' ? 'Second Major' : 'Minor';

  const doubleCountConstraint: ConstraintStatus = {
    id: 'double-count',
    label: `${doubleCount.doubleCountMc}/${doubleCount.capMc} MC double-counted with your primary major`,
    short: 'Double-counted',
    detail: `${doubleCount.doubleCountMc}/${doubleCount.capMc}MC`,
    fulfilled: !doubleCount.warn,
    warn: doubleCount.warn,
  };

  return (
    <div className="rounded-4xl bg-paper p-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">
          {programme.label} <span className="font-normal text-muted">&middot; {kindLabel}</span>
        </h3>
        {requirements.length > 0 && <div className="flex items-center gap-2">
          <span className="text-xs text-muted">
            {fulfilled}/{requirements.length}
          </span>
          <ConstraintChip constraint={doubleCountConstraint} />
        </div>}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
        {programme.requirementStatus !== 'verified' && <span>{requirements.length ? 'Partial checklist' : 'Manual review'}</span>}
        {programme.sourceUrl && <a href={programme.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">NUS requirements ↗</a>}
      </div>
      {requirements.length === 0 ? (
        <p className="text-xs text-muted">Course checklist unavailable.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {requirements.map((req) => (
            <RequirementRow key={req.name} req={req} />
          ))}
        </ul>
      )}
    </div>
  );
};
