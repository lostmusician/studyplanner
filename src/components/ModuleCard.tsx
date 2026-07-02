import { useState, useEffect, useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { Major, PlacedModule } from '@shared/types';
import { fetchNusModsModuleDetail, assessPrerequisiteConflict } from '@shared/nusmods';
import { XIcon, EditIcon } from './Icons';
import { CourseDetailModal } from './CourseDetailModal';
import { useIsMobile } from '../hooks/useIsMobile';

interface Props {
  module: PlacedModule;
  major: Major;
  completedCodes: string[];
  fromYear: number;
  fromSem: number;
  onDelete: (code: string) => void;
  onChangeCategory?: (code: string, categoryId: string) => void;
  isOverlay?: boolean;
}

export const ModuleCard = ({
  module,
  major,
  completedCodes,
  fromYear,
  fromSem,
  onDelete,
  onChangeCategory,
  isOverlay = false,
}: Props) => {
  const { setNodeRef, listeners, attributes, transform, isDragging } = useDraggable({
    id: module.code,
    data: { module, fromYear, fromSem },
    disabled: isOverlay,
  });

  const [prereqWarning, setPrereqWarning] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipUp, setTooltipUp] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [editingCategory, setEditingCategory] = useState(false);
  const completedStr = completedCodes.join(',');
  const cardRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isOverlay) return;
    let cancelled = false;
    fetchNusModsModuleDetail(module.code)
      .then(({ detail }) => {
        if (cancelled) return;
        const assessment = assessPrerequisiteConflict(detail, completedCodes);
        setPrereqWarning(assessment.missingRequirement);
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
    // Allow vertical scrolling over the card on touch; press-hold still triggers drag.
    touchAction: 'pan-y',
  };

  // On touch there is no hover, so reveal the card controls unconditionally.
  const controlVisibility = isMobile ? 'opacity-100' : 'opacity-0 group-hover:opacity-100';

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        (cardRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      style={style}
      className="relative group rounded-2xl p-3 select-none"
      onMouseEnter={() => {
        const rect = cardRef.current?.getBoundingClientRect();
        // Flip the tooltip above the card when there isn't room for it below.
        if (rect) setTooltipUp(window.innerHeight - rect.bottom < 220);
        setShowTooltip(true);
      }}
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
        <div className="flex items-center justify-between gap-1 mt-2">
          <span className="text-[10px] text-ink/50">{module.mcs} MC</span>
          <div className="flex min-w-0 items-center gap-1">
            {category && (
              <span className="truncate max-w-[72px] text-[10px] text-ink/50">{category.label}</span>
            )}
            {!isOverlay && onChangeCategory && (
              <button
                className={`flex-shrink-0 text-ink/40 ${controlVisibility} transition-opacity hover:text-ink`}
                onClick={(e) => { e.stopPropagation(); setEditingCategory(true); }}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label={`Edit bucket for ${module.code}`}
                title="Change requirement bucket"
              >
                <EditIcon className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Re-bucket category — shown only while editing, outside the drag handle */}
      {!isOverlay && onChangeCategory && editingCategory && (
        <select
          autoFocus
          value={module.categoryId}
          onChange={(event) => { onChangeCategory(module.code, event.target.value); setEditingCategory(false); }}
          onBlur={() => setEditingCategory(false)}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          className="mt-1.5 w-full cursor-pointer rounded-lg border border-ink/10 bg-paper/60 px-1.5 py-1 text-[10px] text-ink/70 focus:outline-none focus:ring-1 focus:ring-ink/20"
          aria-label={`Requirement bucket for ${module.code}`}
        >
          {major.categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.label}</option>
          ))}
        </select>
      )}

      {/* Delete button */}
      {!isOverlay && (
        <button
          className={`absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-canvas ${controlVisibility} transition-opacity`}
          onClick={(e) => { e.stopPropagation(); onDelete(module.code); }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`Remove ${module.code}`}
        >
          <XIcon className="h-3 w-3" />
        </button>
      )}

      {/* Details button */}
      {!isOverlay && (
        <button
          className={`absolute -top-1.5 -left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[11px] font-serif italic text-canvas ${controlVisibility} transition-opacity`}
          onClick={(e) => { e.stopPropagation(); setShowDetail(true); }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`Details for ${module.code}`}
          title="Course details"
        >
          i
        </button>
      )}

      {/* Hover tooltip */}
      {showTooltip && !isDragging && !isOverlay && (
        <div
          className={`absolute z-50 left-0 w-64 rounded-2xl bg-ink text-canvas p-4 text-xs shadow-soft pointer-events-none ${
            tooltipUp ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
        >
          <div className="font-bold font-mono">{module.code}</div>
          <div className="mt-0.5 text-canvas/80 leading-snug">{module.name}</div>
          <div className="mt-2 text-canvas/50">
            {module.mcs} MC · {category?.label ?? module.categoryId}
          </div>
          {prereqWarning && (
            <div className="mt-2 pt-2 border-t border-canvas/10" style={{ color: 'rgb(252,211,77)' }}>
              <span className="uppercase text-[10px] tracking-wide block mb-1">Missing prereqs</span>
              {prereqWarning}
            </div>
          )}
          <div className="mt-2 pt-2 border-t border-canvas/10 text-canvas/40">Click ⓘ for full details</div>
        </div>
      )}

      {/* Course details */}
      {showDetail && (
        <CourseDetailModal
          module={module}
          major={major}
          completedCodes={completedCodes}
          onClose={() => setShowDetail(false)}
        />
      )}
    </div>
  );
};
