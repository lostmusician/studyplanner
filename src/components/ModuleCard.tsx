import { useState, useEffect, useRef } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { Major, PlacedModule } from '@shared/types';
import { fetchNusModsModuleDetail, assessPrerequisiteConflict } from '@shared/nusmods';
import { XIcon, EditIcon, LockIcon, MoveIcon } from './Icons';
import { CourseDetailModal } from './CourseDetailModal';
import { AppDialog } from './AppDialog';
import { useIsMobile } from '../hooks/useIsMobile';
import { Dropdown } from './Dropdown';
import { isModuleLocked } from '../lib/studyPlan';
import { FOCUS_RING } from '../lib/colors';

interface Props {
  module: PlacedModule;
  major: Major;
  completedCodes: string[];
  fromYear: number;
  fromSem: number;
  onDelete: (code: string, year?: number, sem?: number) => void;
  onEditModule?: (
    oldCode: string,
    updates: { code: string; name: string; mcs: number; categoryId: string },
  ) => { ok: true } | { ok: false; error: string };
  isOverlay?: boolean;
  moveTargets?: { year: number; sem: number; label: string }[];
  onMove?: (year: number, sem: number) => void;
}

export const ModuleCard = ({
  module,
  major,
  completedCodes,
  fromYear,
  fromSem,
  onDelete,
  onEditModule,
  isOverlay = false,
  moveTargets = [],
  onMove,
}: Props) => {
  const { setNodeRef: setDraggableNodeRef, listeners, attributes, transform, isDragging } = useDraggable({
    id: module.code,
    data: { module, fromYear, fromSem },
    disabled: isOverlay || isModuleLocked(major, module.code),
  });
  const { setNodeRef: setDroppableNodeRef, isOver: isDropTarget } = useDroppable({
    id: `module-${fromYear}-${fromSem}-${module.code}`,
    data: { type: 'module-card', year: fromYear, sem: fromSem, moduleCode: module.code },
    disabled: isOverlay,
  });

  const [prereqWarning, setPrereqWarning] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipUp, setTooltipUp] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editCode, setEditCode] = useState(module.code);
  const [editName, setEditName] = useState(module.name);
  const [editMcs, setEditMcs] = useState(String(module.mcs));
  const [editCategoryId, setEditCategoryId] = useState(module.categoryId);
  const [editError, setEditError] = useState<string | null>(null);
  const completedStr = completedCodes.join(',');
  const cardRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isLocked = isModuleLocked(major, module.code);

  useEffect(() => {
    if (!showMoveMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        setShowMoveMenu(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowMoveMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showMoveMenu]);

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

  useEffect(() => {
    if (showDetail || editing || showDeleteConfirm || showMoveMenu || isDragging) {
      setShowTooltip(false);
    }
  }, [showDetail, editing, showDeleteConfirm, showMoveMenu, isDragging]);

  const category = major.categories.find((c) => c.id === module.categoryId);

  const openEditor = () => {
    setEditCode(module.code);
    setEditName(module.name);
    setEditMcs(String(module.mcs));
    setEditCategoryId(module.categoryId);
    setEditError(null);
    setEditing(true);
  };

  const handleDeleteClick = () => {
    if (isLocked) {
      setShowDeleteConfirm(true);
      return;
    }
    onDelete(module.code, fromYear, fromSem);
  };

  const handleConfirmDelete = () => {
    setShowDeleteConfirm(false);
    onDelete(module.code, fromYear, fromSem);
  };

  const handleSaveEdit = () => {
    if (!onEditModule) return;
    const result = onEditModule(module.code, {
      code: editCode,
      name: editName,
      mcs: parseInt(editMcs, 10),
      categoryId: editCategoryId,
    });
    if (!result.ok) {
      setEditError(result.error);
      return;
    }
    setEditing(false);
    setEditError(null);
  };

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.35 : 1,
    backgroundColor: category?.color ?? '#d4c9b8',
    outline: prereqWarning ? '2px solid rgb(245,158,11)' : 'none',
    outlineOffset: '-2px',
    // Allow vertical scrolling over the card on touch; press-hold still triggers drag.
    touchAction: 'pan-y',
  };

  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number } | null>(null);

  // group-focus-within keeps controls reachable by keyboard (tabbing into the card),
  // not just mouse hover.
  const controlVisibility =
    'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150';
  const showInsertBar = isDropTarget && !isDragging && !isOverlay;

  return (
    <div
      ref={(node) => {
        setDraggableNodeRef(node);
        setDroppableNodeRef(node);
        (cardRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      style={style}
      className="relative group rounded-xl p-2.5 select-none hover:z-50 focus-within:z-50"
      onMouseEnter={() => {
        const rect = cardRef.current?.getBoundingClientRect();
        if (rect) {
          const spaceBelow = window.innerHeight - rect.bottom;
          const placeAbove = spaceBelow < 120 && rect.top > 120;
          const top = placeAbove
            ? Math.max(8, rect.top - 110)
            : Math.min(window.innerHeight - 115, rect.bottom + 4);
          const left = Math.max(12, Math.min(rect.left, window.innerWidth - 204));
          setTooltipPos({ left, top });
          setShowTooltip(true);
        }
      }}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {showInsertBar && (
        <div className="pointer-events-none absolute -top-1.5 left-2 right-2 z-40 h-1 rounded-full bg-ink shadow-soft" />
      )}

      {/* Drag handle area */}
      <div
        {...listeners}
        {...attributes}
        className={isLocked ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}
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
        <p className="text-[10px] sm:text-[11px] text-ink/75 leading-tight mt-0.5 line-clamp-2">{module.name}</p>
        <div className="flex items-center justify-between gap-1 mt-1 font-mono text-[9px] sm:text-[10px]">
          <span className="text-ink/80 font-semibold">{module.mcs} MC</span>
          <div className="flex min-w-0 items-center gap-1">
            {category && (
              <span className="truncate max-w-[68px] text-[9px] text-ink/70 font-sans font-medium">{category.label}</span>
            )}
            {isLocked && (
              <span className="flex-shrink-0 text-ink/60" title="Compulsory NEP module" aria-label="Compulsory NEP module">
                <LockIcon className="h-3 w-3" />
              </span>
            )}
            {!isOverlay && !isLocked && onEditModule && (
              <button
                className={`flex-shrink-0 rounded-full text-ink/60 ${controlVisibility} transition-opacity hover:text-ink ${FOCUS_RING}`}
                onClick={(e) => { e.stopPropagation(); openEditor(); }}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label={`Edit ${module.code}`}
                title="Edit module"
              >
                <EditIcon className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Re-bucket category — shown only while editing, outside the drag handle */}
      {!isOverlay && !isLocked && onEditModule && editing && (
        <div
          className="mt-1.5 flex flex-col gap-1"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <input
            autoFocus
            value={editCode}
            onChange={(e) => setEditCode(e.target.value)}
            placeholder="Code"
            className="w-full rounded-lg border border-ink/10 bg-paper/60 px-1.5 py-1 text-[10px] text-ink/70 focus:outline-none focus:ring-1 focus:ring-ink/20"
            aria-label={`Course code for ${module.code}`}
          />
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Name"
            className="w-full rounded-lg border border-ink/10 bg-paper/60 px-1.5 py-1 text-[10px] text-ink/70 focus:outline-none focus:ring-1 focus:ring-ink/20"
            aria-label={`Course name for ${module.code}`}
          />
          <input
            type="number"
            min="1"
            max="20"
            value={editMcs}
            onChange={(e) => setEditMcs(e.target.value)}
            placeholder="MCs"
            className="w-full rounded-lg border border-ink/10 bg-paper/60 px-1.5 py-1 text-[10px] text-ink/70 focus:outline-none focus:ring-1 focus:ring-ink/20"
            aria-label={`MCs for ${module.code}`}
          />
          <Dropdown
            variant="field"
            ariaLabel={`Requirement bucket for ${module.code}`}
            value={editCategoryId}
            onChange={setEditCategoryId}
            className="w-full cursor-pointer rounded-lg border border-ink/10 bg-paper/60 px-1.5 py-1 text-[10px] text-ink/70 focus:outline-none focus:ring-1 focus:ring-ink/20"
            options={major.categories.map((cat) => ({ value: cat.id, label: cat.label }))}
          />
          {editError && (
            <p className="text-[10px] font-medium leading-snug text-red-700">{editError}</p>
          )}
          <div className="flex gap-1">
            <button
              type="button"
              onClick={handleSaveEdit}
              className="flex-1 rounded-lg bg-ink py-1 text-[10px] font-medium text-canvas"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setEditError(null); }}
              className="flex-1 rounded-lg bg-ink/10 py-1 text-[10px] font-medium text-ink/70"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Delete button */}
      {!isOverlay && (
        <button
          className={`absolute z-40 top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink/75 text-canvas hover:bg-ink ${controlVisibility} transition-all ${FOCUS_RING}`}
          onClick={(e) => { e.stopPropagation(); handleDeleteClick(); }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`Remove ${module.code}`}
        >
          <XIcon className="h-3 w-3" />
        </button>
      )}

      {showDeleteConfirm && (
        <AppDialog
          title="NEP is compulsory"
          labelledBy={`delete-${module.code}-title`}
          onClose={() => setShowDeleteConfirm(false)}
          actions={[
            { label: 'Keep NEP', onClick: () => setShowDeleteConfirm(false), variant: 'primary' },
            { label: 'Delete anyway', onClick: handleConfirmDelete, variant: 'danger' },
          ]}
        >
          {module.code} is part of the NUS College Impact Experience Project sequence. Delete this planned slot anyway?
        </AppDialog>
      )}

      {/* Details button */}
      {!isOverlay && (
        <button
          className={`absolute z-40 top-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink/75 text-[11px] font-serif italic text-canvas hover:bg-ink ${controlVisibility} transition-all ${FOCUS_RING}`}
          onClick={(e) => { e.stopPropagation(); setShowDetail(true); }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`Details for ${module.code}`}
          title="Course details"
        >
          i
        </button>
      )}

      {/* Hover tooltip — fixed viewport positioning */}
      {showTooltip && tooltipPos && !isDragging && !isOverlay && (
        <div
          style={{ position: 'fixed', left: `${tooltipPos.left}px`, top: `${tooltipPos.top}px` }}
          className="z-[9999] w-48 rounded-xl bg-ink text-canvas p-2.5 text-[10px] shadow-xl pointer-events-none"
        >
          <div className="font-bold font-mono text-[11px] leading-none">{module.code}</div>
          <div className="mt-1 text-canvas/85 leading-tight line-clamp-2">{module.name}</div>
          <div className="mt-1 text-[9px] text-canvas/50">
            {module.mcs} MC · {category?.label ?? module.categoryId}
          </div>
          {prereqWarning && (
            <div className="mt-1 pt-1 border-t border-canvas/10" style={{ color: 'rgb(252,211,77)' }}>
              <span className="uppercase text-[8px] tracking-wide block mb-0.5">Missing prereqs</span>
              <span className="text-[9px] leading-tight block">{prereqWarning}</span>
            </div>
          )}
          <div className="mt-1 pt-1 border-t border-canvas/10 text-[8px] text-canvas/40">Click ⓘ for full details</div>
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

      {/* Move button — keyboard/touch-reachable alternative to dragging */}
      {!isOverlay && !isLocked && onMove && moveTargets.length > 0 && (
        <div className="absolute z-40 bottom-1 right-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowMoveMenu((open) => !open); }}
            onPointerDown={(e) => e.stopPropagation()}
            className={`flex h-5 w-5 items-center justify-center rounded-full bg-ink/75 text-canvas hover:bg-ink ${controlVisibility} transition-all ${FOCUS_RING}`}
            aria-haspopup="listbox"
            aria-expanded={showMoveMenu}
            aria-label={`Move ${module.code} to another semester`}
            title="Move to another semester"
          >
            <MoveIcon className="h-3 w-3" />
          </button>
          {showMoveMenu && (
            <ul
              className="absolute z-40 bottom-6 right-0 max-h-52 w-40 overflow-y-auto rounded-2xl bg-ink shadow-soft"
              role="listbox"
            >
              {moveTargets
                .filter((target) => !(target.year === fromYear && target.sem === fromSem))
                .map((target) => (
                  <li key={`${target.year}-${target.sem}`}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-xs text-canvas hover:bg-canvas/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMove(target.year, target.sem);
                        setShowMoveMenu(false);
                      }}
                    >
                      {target.label}
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
