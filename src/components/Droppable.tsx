import React from 'react';
import {useDroppable} from '@dnd-kit/core';

export function Droppable({id, children}: {id: string; children: React.ReactNode}) {
  const {setNodeRef, isOver} = useDroppable({id});

  return (
    <div ref={setNodeRef} className={isOver ? 'relative ring-2 ring-dashed ring-ink/30 rounded-xl' : ''}>
      {children}
    </div>
  );
}

export default Droppable;
