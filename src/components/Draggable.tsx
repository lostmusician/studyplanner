import React from 'react';
import {useDraggable} from '@dnd-kit/core';

export function Draggable({id, children}: {id: string; children: React.ReactNode}) {
  const {attributes, listeners, setNodeRef, transform, isDragging} = useDraggable({id});

  const style: React.CSSProperties = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isDragging ? 9999 : undefined,
        visibility: isDragging ? 'hidden' : 'visible',
      }
    : {
        zIndex: isDragging ? 9999 : undefined,
        visibility: isDragging ? 'hidden' : 'visible',
      };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  );
}

export default Draggable;
