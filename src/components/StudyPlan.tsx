import type { Major, PlacedModule, StudentSemester } from '@shared/types';
import type { Stats } from '../lib/studyPlan';
import { StatsSummary } from './StatsSummary';
import { SemesterGrid } from './SemesterGrid';
import { AddModuleForm } from './AddModuleForm';
import { RequirementsChecklist } from './RequirementsChecklist';

interface Props {
  majors: Major[];
  major: Major;
  majorId: string;
  semesters: StudentSemester[];
  stats: Stats;
  requirements: Array<{ name: string; fulfilled: boolean; categoryId?: string }>;
  switchMajor: (id: string) => void;
  addOrMoveModule: (year: number, sem: number, module: PlacedModule) => void;
  deleteModule: (code: string) => void;
  resetPlan: () => void;
  getCompletedCodes: (year: number, sem: number) => string[];
  studentName: string;
  setStudentName: (name: string) => void;
  matricNo: string;
  setMatricNo: (no: string) => void;
}

export const StudyPlan = ({
  majors,
  major,
  majorId,
  semesters,
  stats,
  requirements,
  switchMajor,
  addOrMoveModule,
  deleteModule,
  resetPlan,
  getCompletedCodes,
  studentName,
  setStudentName,
  matricNo,
  setMatricNo,
}: Props) => {
  const handleSwitchMajor = (id: string) => {
    if (id === majorId) return;
    if (confirm('Switching major will reset your plan. Continue?')) {
      switchMajor(id);
    }
  };

  return (
    <div className="min-h-screen bg-canvas">
      {/* Header */}
      <header className="px-6 py-5" style={{ borderBottom: '1px solid rgba(20,20,19,0.08)' }}>
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="flex flex-col gap-0.5">
              <EditableField
                value={studentName}
                onChange={setStudentName}
                className="text-base font-semibold text-ink"
                placeholder="Student Name"
              />
              <EditableField
                value={matricNo}
                onChange={setMatricNo}
                className="text-xs text-muted font-mono"
                placeholder="Matric No."
              />
            </div>

            <div className="h-8 w-px" style={{ backgroundColor: 'rgba(20,20,19,0.1)' }} />

            <div className="flex flex-col gap-0.5">
              <select
                value={majorId}
                onChange={(e) => handleSwitchMajor(e.target.value)}
                className="text-sm font-medium text-ink bg-transparent border-none focus:outline-none cursor-pointer"
              >
                {majors.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
              {major.specialisation && (
                <span className="text-xs text-muted">{major.specialisation}</span>
              )}
              <span className="text-[10px] text-muted/70">{major.school}</span>
            </div>
          </div>

          <button
            onClick={() => { if (confirm('Reset plan to default?')) resetPlan(); }}
            className="text-xs text-muted hover:text-ink transition-colors px-3 py-1.5 rounded-xl hover:bg-paper"
          >
            Reset plan
          </button>
        </div>
      </header>

      {/* Stats bar */}
      <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(20,20,19,0.08)' }}>
        <div className="max-w-screen-2xl mx-auto">
          <StatsSummary major={major} stats={stats} />
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-screen-2xl mx-auto px-6 py-6 flex gap-6">
        {/* Left: semester grid + add form */}
        <div className="flex-1 min-w-0 flex flex-col gap-5">
          <SemesterGrid
            semesters={semesters}
            major={major}
            addOrMoveModule={addOrMoveModule}
            deleteModule={deleteModule}
            getCompletedCodes={getCompletedCodes}
          />
          <AddModuleForm major={major} onAdd={addOrMoveModule} />
        </div>

        {/* Right sidebar */}
        <aside className="w-64 flex-shrink-0">
          <RequirementsChecklist requirements={requirements} categories={major.categories} />
        </aside>
      </div>
    </div>
  );
};

const EditableField = ({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  className: string;
  placeholder: string;
}) => (
  <input
    type="text"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className={`bg-transparent border-none focus:outline-none focus:ring-0 p-0 ${className}`}
    style={{ width: `${Math.max(value.length, placeholder.length, 8)}ch` }}
  />
);
