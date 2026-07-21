import type { ReactNode, CSSProperties } from 'react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// A vertical drag-and-drop sortable list. `ids` is the ordered item id list;
// `onReorder(fromIndex, toIndex)` fires on drop. Children render the rows
// (each wrapped with <SortableRow id=…>).
export function SortableList({ ids, onReorder, children }: {
  ids: string[];
  onReorder: (from: number, to: number) => void;
  children: ReactNode;
}) {
  // 5px activation distance so clicks (accept/edit/etc.) still work.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(from, to);
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

// A single sortable row. `render` receives a drag-handle props object to spread
// onto the grip element (only the handle starts a drag).
export function SortableRow({ id, children }: {
  id: string;
  children: (args: { setNodeRef: (el: HTMLElement | null) => void; style: CSSProperties; handleProps: Record<string, unknown> }) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    zIndex: isDragging ? 20 : undefined,
    position: 'relative',
  };
  return <>{children({ setNodeRef, style, handleProps: { ...attributes, ...listeners } })}</>;
}
