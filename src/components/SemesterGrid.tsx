import { useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import type { Major, PlacedModule, StudentSemester } from '@shared/types';
import { semesterLabel } from '../lib/studyPlan';
import { ModuleCard } from './ModuleCard';

interface Props {
  semesters: StudentSemester[];
  major: Major;
  addOrMoveModule: (year: number, sem: number, module: PlacedModule) => void;
  deleteModule: (code: string) => void;
  getCompletedCodes: (year: number, sem: number) => string[];
}

export const SemesterGrid = ({ semesters, major, addOrMoveModule, deleteModule, getCompletedCodes }: Props) => {
  const [activeDrag, setActiveDrag] = useState<PlacedModule | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    const module = event.active.data.current?.module as PlacedModule | undefined;
    setActiveDrag(module ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;
    const module = active.data.current?.module as PlacedModule;
    const [year, sem] = (over.id as string).split('-').map(Number);
    addOrMoveModule(year, sem, module);
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-3">
        {semesters.map((semester) => (
          <SemesterColumn
            key={`${semester.year}-${semester.sem}`}
            semester={semester}
            major={major}
            deleteModule={deleteModule}
            completedCodes={getCompletedCodes(semester.year, semester.sem)}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDrag && (
          <ModuleCard
            module={activeDrag}
            major={major}
            completedCodes={[]}
            fromYear={0}
            fromSem={0}
            onDelete={() => undefined}
            isOverlay
          />
        )}
      </DragOverlay>
    </DndContext>
  );
};

interface ColumnProps {
  semester: StudentSemester;
  major: Major;
  deleteModule: (code: string) => void;
  completedCodes: string[];
}

const SemesterColumn = ({ semester, major, deleteModule, completedCodes }: ColumnProps) => {
  const id = `${semester.year}-${semester.sem}`;
  const { setNodeRef, isOver } = useDroppable({ id });

  const totalMcs = semester.modules.reduce((sum, m) => sum + m.mcs, 0);

  return (
    <div
      ref={setNodeRef}
      className="flex flex-col flex-shrink-0 rounded-3xl p-3 transition-colors"
      style={{
        minWidth: '172px',
        width: '172px',
        minHeight: '280px',
        backgroundColor: isOver ? 'rgb(210,203,190)' : 'rgb(225,218,205)',
        outline: isOver ? '2px dashed rgb(108,107,104)' : 'none',
        outlineOffset: '-2px',
      }}
    >
      <div className="flex items-baseline justify-between mb-3 px-1">
        <span className="text-xs font-semibold text-ink">{semesterLabel(semester.year, semester.sem)}</span>
        <span className="text-[10px] text-muted">{totalMcs} MC</span>
      </div>

      <div className="flex flex-col gap-2 flex-1">
        {semester.modules.map((module) => (
          <ModuleCard
            key={module.code}
            module={module}
            major={major}
            completedCodes={completedCodes}
            fromYear={semester.year}
            fromSem={semester.sem}
            onDelete={deleteModule}
          />
        ))}
      </div>
    </div>
  );
};
