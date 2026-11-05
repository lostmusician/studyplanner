import { DOUBLE_DEGREES, DDP_FRAMEWORK } from '../lib/programmes';
export const DoubleDegreePanel = ({ id, majorId, totalUnits }: { id: string; majorId: string; totalUnits: number }) => {
  const programme = DOUBLE_DEGREES.find(p => p.id === id);
  if (!programme) return null;
  const compatible = programme.primaryIds.includes(majorId);
  return <section className="rounded-2xl border border-line/40 bg-paper/50 p-4 text-xs">
    <h3 className="font-semibold">Double degree · {programme.label}</h3>
    <p className="mt-2 font-medium text-amber-900">Planning only · degree-specific graduation checks are not yet available.</p>
    {!compatible && <p className="mt-2">This combination needs a primary degree curriculum that this planner does not currently support.</p>}
    <ul className="mt-3 list-disc space-y-2 pl-4 text-muted">
      <li>For AY2021/22 onwards: at least 160 units overall; the actual total depends on both degrees and approved overlap. Your plan has {totalUnits} units.</li>
      <li>Fulfil both degrees’ major and faculty requirements. Unrestricted electives are not required under the DDP framework.</li>
      <li>Residency: at least 50% of the minimum units must be read at NUS.</li>
      <li>Student-initiated admission: minimum GPA 3.75 and written approval from both faculties. Continuation: GPA 3.5 in each degree from the second active semester; the continuation rule ends after 140 cumulative units.</li>
      <li>Courses counted towards both degrees’ major requirements cannot also count towards a minor.</li>
    </ul>
    <a className="mt-3 inline-block py-2 underline underline-offset-2" href={DDP_FRAMEWORK} target="_blank" rel="noreferrer">Check the NUS DDP framework and faculty requirements ↗</a>
  </section>;
};
