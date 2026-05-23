import { useState } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { DefaultPlanEntry, Major, MajorCategory, Module } from '@shared/types';
import { ModuleSearch } from './ModuleSearch';

interface Props {
  major: Major;
  onUpdateCatalog: (catalog: Record<string, Module>) => void;
  onUpdatePlan: (plan: DefaultPlanEntry[]) => void;
}

const YEARS = [1, 2, 3, 4];
const SEMS = [1, 2];

export const PlanSeeder = ({ major, onUpdateCatalog, onUpdatePlan }: Props) => {
  const [activeCode, setActiveCode] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleAddToCatalog = (module: Module) => {
    if (major.moduleCatalog[module.code]) return;
    onUpdateCatalog({ ...major.moduleCatalog, [module.code]: module });
  };

  const handleRemoveFromCatalog = (code: string) => {
    const next = { ...major.moduleCatalog };
    delete next[code];
    onUpdateCatalog(next);
    onUpdatePlan(major.defaultPlan.filter((e) => e.moduleCode !== code));
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCode(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCode(null);
    const { active, over } = event;
    if (!over) return;

    const code = active.id as string;
    const overId = over.id as string;

    if (overId === 'catalog') {
      onUpdatePlan(major.defaultPlan.filter((e) => e.moduleCode !== code));
      return;
    }

    const [, year, sem] = overId.split('-');
    const y = parseInt(year, 10);
    const s = parseInt(sem, 10);

    const existing = major.defaultPlan.find((e) => e.moduleCode === code);
    const categoryId = existing?.categoryId ?? major.categories[0]?.id ?? '';

    const withoutThis = major.defaultPlan.filter((e) => e.moduleCode !== code);
    onUpdatePlan([...withoutThis, { year: y, sem: s, moduleCode: code, categoryId }]);
  };

  const getModulesForSlot = (year: number, sem: number) =>
    major.defaultPlan
      .filter((e) => e.year === year && e.sem === sem)
      .map((e) => ({ entry: e, module: major.moduleCatalog[e.moduleCode] }))
      .filter((x) => x.module);

  const placedCodes = new Set(major.defaultPlan.map((e) => e.moduleCode));
  const unplacedModules = Object.values(major.moduleCatalog).filter((m) => !placedCodes.has(m.code));

  const updateEntryCategory = (moduleCode: string, categoryId: string) => {
    onUpdatePlan(major.defaultPlan.map((e) => (e.moduleCode === moduleCode ? { ...e, categoryId } : e)));
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-4">
        <div className="flex gap-4">
          {/* Catalog panel */}
          <div className="w-56 flex-shrink-0 flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-ink">Module Catalog</h3>
            <ModuleSearch onSelect={handleAddToCatalog} placeholder="Add module…" />

            <CatalogDropZone>
              <div className="flex flex-col gap-1.5 min-h-[80px]">
                {unplacedModules.map((m) => (
                  <DraggableChip key={m.code} code={m.code} label={m.code} onRemove={() => handleRemoveFromCatalog(m.code)} />
                ))}
                {unplacedModules.length === 0 && (
                  <p className="text-xs text-muted italic">All modules placed</p>
                )}
              </div>
            </CatalogDropZone>

            <div className="text-xs text-muted">{Object.keys(major.moduleCatalog).length} modules in catalog</div>
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-2" style={{ minWidth: `${8 * 160}px` }}>
              {YEARS.flatMap((year) =>
                SEMS.map((sem) => {
                  const entries = getModulesForSlot(year, sem);
                  return (
                    <SemSlot key={`${year}-${sem}`} year={year} sem={sem}>
                      {entries.map(({ entry, module }) => (
                        <div key={module.code} className="flex flex-col gap-1">
                          <DraggableChip code={module.code} label={module.code} onRemove={() => handleRemoveFromCatalog(module.code)} />
                          <select
                            value={entry.categoryId}
                            onChange={(e) => updateEntryCategory(module.code, e.target.value)}
                            className="text-[10px] rounded-lg bg-canvas px-1.5 py-0.5 text-ink border-0 focus:outline-none"
                          >
                            {major.categories.map((cat: MajorCategory) => (
                              <option key={cat.id} value={cat.id}>{cat.label}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </SemSlot>
                  );
                }),
              )}
            </div>
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeCode && (
          <div className="rounded-xl bg-ink text-canvas text-xs font-mono font-bold px-3 py-1.5 shadow-soft opacity-90">
            {activeCode}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};

const CatalogDropZone = ({ children }: { children: React.ReactNode }) => {
  const { setNodeRef, isOver } = useDroppable({ id: 'catalog' });
  return (
    <div
      ref={setNodeRef}
      className="rounded-xl p-2 min-h-[60px] transition-colors"
      style={{ backgroundColor: isOver ? 'rgb(210,203,190)' : 'rgb(225,218,205)' }}
    >
      {children}
    </div>
  );
};

const SemSlot = ({ year, sem, children }: { year: number; sem: number; children: React.ReactNode }) => {
  const id = `slot-${year}-${sem}`;
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className="flex flex-col gap-2 rounded-xl p-2 flex-shrink-0 transition-colors"
      style={{
        width: '152px',
        minHeight: '160px',
        backgroundColor: isOver ? 'rgb(210,203,190)' : 'rgb(225,218,205)',
        outline: isOver ? '2px dashed rgb(108,107,104)' : 'none',
        outlineOffset: '-2px',
      }}
    >
      <div className="text-[10px] font-semibold text-muted">Y{year}S{sem}</div>
      {children}
    </div>
  );
};

const DraggableChip = ({ code, label, onRemove }: { code: string; label: string; onRemove: () => void }) => {
  const { setNodeRef, listeners, attributes, transform, isDragging } = useDraggable({ id: code });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        opacity: isDragging ? 0.3 : 1,
      }}
      className="group relative flex items-center rounded-lg bg-ink/90 text-canvas text-[10px] font-mono font-bold pl-2.5 pr-6 py-1 cursor-grab active:cursor-grabbing select-none touch-none"
      {...listeners}
      {...attributes}
    >
      {label}
      <button
        type="button"
        className="absolute right-1 opacity-0 group-hover:opacity-100 transition-opacity text-canvas/60 hover:text-canvas text-xs leading-none"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        ×
      </button>
    </div>
  );
};
