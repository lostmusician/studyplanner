import { useState, useEffect, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { Major, PlacedModule } from '@shared/types';
import { fetchNusModsModuleDetail, assessPrerequisiteConflict, formatPrerequisiteSummary } from '@shared/nusmods';
import { XIcon } from './Icons';

interface Props {
  module: PlacedModule;
  major: Major;
  completedCodes: string[];
  fromYear: number;
  fromSem: number;
  onDelete: (code: string) => void;
  isOverlay?: boolean;
}

export const ModuleCard = ({
  module,
  major,
  completedCodes,
  fromYear,
  fromSem,
  onDelete,
  isOverlay = false,
}: Props) => {
  const { setNodeRef, listeners, attributes, transform, isDragging } = useDraggable({
    id: module.code,
    data: { module, fromYear, fromSem },
    disabled: isOverlay,
  });

  const [prereqWarning, setPrereqWarning] = useState<string | null>(null);
  const [prereqSummary, setPrereqSummary] = useState<string>('');
  const [showTooltip, setShowTooltip] = useState(false);
  const completedStr = completedCodes.join(',');
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOverlay) return;
    let cancelled = false;
    fetchNusModsModuleDetail(module.code)
      .then(({ detail }) => {
        if (cancelled) return;
        const assessment = assessPrerequisiteConflict(detail, completedCodes);
        setPrereqWarning(assessment.missingRequirement);
        setPrereqSummary(formatPrerequisiteSummary(detail));
      })
      .catch(() => {
        if (!cancelled) setPrereqWarning(null);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module.code, completedStr, isOverlay]);

  const category = major.categories.find((c) => c.id === module.categoryId);

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.35 : 1,
    backgroundColor: category?.color ?? '#d4c9b8',
    outline: prereqWarning ? '2px solid rgb(245,158,11)' : 'none',
    outlineOffset: '-2px',
  };

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        (cardRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      style={style}
      className="relative group rounded-2xl p-3 select-none touch-none"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Drag handle area */}
      <div
        {...listeners}
        {...attributes}
        className="cursor-grab active:cursor-grabbing"
        style={{ userSelect: 'none' }}
      >
        <div className="flex items-start justify-between gap-1">
          <span className="font-mono text-xs font-bold text-ink leading-tight">{module.code}</span>
          {prereqWarning && (
            <span
              className="flex-shrink-0 w-2 h-2 rounded-full mt-0.5"
              style={{ backgroundColor: 'rgb(245,158,11)' }}
              title={`Missing prereqs: ${prereqWarning}`}
            />
          )}
        </div>
        <p className="text-[11px] text-ink/70 leading-snug mt-0.5 line-clamp-2">{module.name}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-ink/50">{module.mcs} MC</span>
          {category && (
            <span className="text-[10px] text-ink/50 truncate max-w-[80px]">{category.label}</span>
          )}
        </div>
      </div>

      {/* Delete button */}
      {!isOverlay && (
        <button
          className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-canvas opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); onDelete(module.code); }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`Remove ${module.code}`}
        >
          <XIcon className="h-3 w-3" />
        </button>
      )}

      {/* Hover tooltip */}
      {showTooltip && !isDragging && !isOverlay && (
        <div className="absolute z-50 left-0 top-full mt-2 w-64 rounded-2xl bg-ink text-canvas p-4 text-xs shadow-soft pointer-events-none">
          <div className="font-bold font-mono">{module.code}</div>
          <div className="mt-0.5 text-canvas/80 leading-snug">{module.name}</div>
          <div className="mt-2 text-canvas/50">
            {module.mcs} MC · {category?.label ?? module.categoryId}
          </div>
          {prereqSummary && (
            <div className="mt-2 pt-2 border-t border-canvas/10 text-canvas/60 leading-snug">
              <span className="text-canvas/40 uppercase text-[10px] tracking-wide block mb-1">Prerequisites</span>
              {prereqSummary}
            </div>
          )}
          {prereqWarning && (
            <div className="mt-2 pt-2 border-t border-canvas/10" style={{ color: 'rgb(252,211,77)' }}>
              <span className="uppercase text-[10px] tracking-wide block mb-1">Missing</span>
              {prereqWarning}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
