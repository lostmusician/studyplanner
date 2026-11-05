import type {
  Major,
  NocDuration,
  SecondaryProgramme,
  SpecialProgramme,
} from '@shared/types';
import { DOUBLE_DEGREES } from '../lib/programmes';
import { BatchBadge } from './BatchBadge';
import { Dropdown } from './Dropdown';
import { PathwayPicker } from './PathwayPicker';
import { ProgrammePicker } from './ProgrammePicker';

export type SettingsSection = 'profile' | 'degrees' | 'pathways';

export interface SettingsSidebarProps {
  majors: Major[];
  majorId: string;
  secondMajors: SecondaryProgramme[];
  minors: SecondaryProgramme[];
  doubleDegreeId: string | null;
  setDoubleDegreeId: (id: string | null) => void;
  secondMajorId: string | null;
  minorIds: string[];
  setSecondMajorId: (id: string | null) => void;
  toggleMinorId: (id: string) => void;
  nocDuration: NocDuration | null;
  specialProgrammes: SpecialProgramme[];
  togglePathway: (programme: SpecialProgramme) => void;
  polytechnicApcUnits?: number;
  setPolytechnicApcUnits?: (units: number) => void;
  studentName: string;
  setStudentName: (name: string) => void;
  matricNumber: string;
  setMatricNumber: (matric: string) => void;
  studentYear: string;
  setStudentYear: (year: string) => void;
  onSwitchMajor: (id: string) => void;
  onResetPlan: () => void;
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}

const SECTIONS: SettingsSection[] = ['profile', 'degrees', 'pathways'];

const SECTION_LABELS: Record<SettingsSection, string> = {
  profile: 'Profile',
  degrees: 'Degrees',
  pathways: 'Pathways',
};

export const SettingsSidebar = ({
  majors,
  majorId,
  secondMajors,
  minors,
  doubleDegreeId,
  setDoubleDegreeId,
  secondMajorId,
  minorIds,
  setSecondMajorId,
  toggleMinorId,
  nocDuration,
  specialProgrammes,
  togglePathway,
  polytechnicApcUnits = 0,
  setPolytechnicApcUnits,
  studentName,
  setStudentName,
  matricNumber,
  setMatricNumber,
  studentYear,
  setStudentYear,
  onSwitchMajor,
  onResetPlan,
  activeSection,
  onSectionChange,
}: SettingsSidebarProps) => {
  const major = majors.find((candidate) => candidate.id === majorId);
  const field =
    'rounded-xl bg-canvas border border-line/40 px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent w-full';

  const secondMajor = secondMajors.find((candidate) => candidate.id === secondMajorId);
  const selectedMinors = minors.filter((candidate) => minorIds.includes(candidate.id));
  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="Settings sections" className="grid grid-cols-3 gap-1 rounded-xl bg-canvas/80 p-1">
        {SECTIONS.map(section => <button key={section} id={`settings-tab-${section}`} type="button" role="tab" aria-selected={activeSection === section} onKeyDown={event => {
          const index = SECTIONS.indexOf(section);
          const next = event.key === 'ArrowRight' ? SECTIONS[(index + 1) % SECTIONS.length] : event.key === 'ArrowLeft' ? SECTIONS[(index + SECTIONS.length - 1) % SECTIONS.length] : event.key === 'Home' ? SECTIONS[0] : event.key === 'End' ? SECTIONS[SECTIONS.length - 1] : null;
          if (next) { event.preventDefault(); onSectionChange(next); document.getElementById(`settings-tab-${next}`)?.focus(); }
        }} tabIndex={activeSection === section ? 0 : -1} aria-controls={`settings-panel-${section}`} onClick={() => onSectionChange(section)} className={`min-h-11 rounded-lg px-2 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink ${activeSection === section ? 'bg-ink text-canvas' : 'text-muted'}`}>{SECTION_LABELS[section]}</button>)}
      </div>
      <section id={`settings-panel-${activeSection}`} role="tabpanel" aria-labelledby={`settings-tab-${activeSection}`} className="rounded-2xl border border-line/30 bg-white/70 p-4">
        {activeSection === 'profile' && <div className="flex flex-col gap-5">
          <h3 className="text-base font-semibold">Student profile</h3>
          <label className="flex flex-col gap-2">
            <span className="text-sm text-muted font-medium">Name</span>
            <input
              type="text"
              value={studentName}
              onChange={(event) => setStudentName(event.target.value)}
              className={field}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm text-muted font-medium">Matric Number</span>
            <input
              type="text"
              value={matricNumber}
              onChange={(event) => setMatricNumber(event.target.value)}
              placeholder="A0123456X"
              className={field}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm text-muted font-medium">Year</span>
            <Dropdown
              variant="field"
              ariaLabel="Year"
              value={studentYear}
              onChange={setStudentYear}
              className={field}
              options={[1, 2, 3, 4].map((year) => ({ value: `Year ${year}`, label: `Year ${year}` }))}
            />
          </label>
          <div className="border-t border-line/40 pt-5">
          <label className="flex flex-col gap-2">
            <span className="text-sm text-muted font-medium">Admission Pathway</span>
            <Dropdown variant="field" ariaLabel="Admission Pathway" value={String(polytechnicApcUnits)} onChange={value => setPolytechnicApcUnits?.(Number(value) || 0)} className={field} options={[
              { value: '0', label: 'JC / High School (160 MC at NUS)' },
              { value: '20', label: 'Polytechnic (20 MC UE Advanced Standing)' },
              ...[24, 28, 32, 36, 40].map(units => ({ value: String(units), label: `Polytechnic (${units} MC APCs)` })),
            ]} />
          </label>

          </div>
        </div>}
        {activeSection === 'degrees' && <div className="flex flex-col gap-5">
          <h3 className="text-base font-semibold">Your degrees</h3>
          <label className="flex flex-col gap-2">
            <span className="text-sm text-muted font-medium">Primary Major</span>
            <Dropdown
              variant="field"
              ariaLabel="Major"
              value={majorId}
              onChange={onSwitchMajor}
              className={field}
              options={majors.map((item) => ({ value: item.id, label: item.label }))}
            />
          </label>
          {major && (
            <div>
              <BatchBadge batches={major.batches} />
            </div>
          )}

          <div className="border-t border-line/40 pt-5">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Second degree
            <select aria-label="Second degree" value={doubleDegreeId ?? ''} onChange={e => setDoubleDegreeId(e.target.value || null)} className="w-full rounded-xl border border-line/40 bg-canvas px-3 py-2.5 text-base sm:text-sm font-normal">
              <option value="">None</option>
              <optgroup label="Matches your primary major">{DOUBLE_DEGREES.filter(p => p.primaryIds.includes(majorId)).map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</optgroup>
              <optgroup label="Other NUS combinations · planning only">{DOUBLE_DEGREES.filter(p => !p.primaryIds.includes(majorId)).map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</optgroup>
            </select>
          </label>

          </div>
          <details className="settings-programme-group border-t border-line/40 pt-5">
            <summary className="cursor-pointer text-sm font-medium">Second major <span className="mt-1 block text-xs font-normal text-muted">{secondMajor?.label ?? 'None selected'}</span></summary>
            <div className="pt-4"><ProgrammePicker label="Second major" programmes={secondMajors} selectedIds={secondMajorId ? [secondMajorId] : []} onToggle={id => setSecondMajorId(id === secondMajorId ? null : id)} majorId={majorId} secondMajorId={secondMajorId} minorIds={minorIds} max={1} /></div>
          </details>
          <details className="settings-programme-group border-t border-line/40 pt-5">
            <summary className="cursor-pointer text-sm font-medium">Minors <span className="mt-1 block text-xs font-normal text-muted">{selectedMinors.length ? selectedMinors.map(p => p.label).join(', ') : 'None selected'} · {minorIds.length}/3</span></summary>
            <div className="pt-4"><ProgrammePicker label="Minors" programmes={minors} selectedIds={minorIds} onToggle={toggleMinorId} majorId={majorId} secondMajorId={secondMajorId} minorIds={minorIds} max={3} /></div>
          </details>
        </div>}
        {activeSection === 'pathways' && <PathwayPicker selected={specialProgrammes} onToggle={togglePathway} />}
      </section>
      {activeSection === 'profile' && <button type="button" onClick={onResetPlan} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-canvas shadow-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m-5-5 5 5 5-5M5 16v4h14v-4" /></svg>
        Load Sample Plan
      </button>}
    </div>
  );
};
