'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { can, type MemberRole } from '@/lib/auth';
import {
  createCategoryAction,
  reorderCategoriesAction,
  updateCategoryAction,
} from '@/features/categories/actions';
import { CATEGORY_PALETTE } from '@/features/spaces/constants';

type Category = {
  id: string;
  name: string;
  kind: 'expense' | 'income' | 'both';
  color: string;
  icon: string;
  parent_id: string | null;
  position: number;
  is_system: boolean;
};

function SortableRow({
  cat,
  canEdit,
  onRename,
  onArchive,
  onColor,
}: {
  cat: Category;
  canEdit: boolean;
  onRename: (name: string) => void;
  onArchive: () => void;
  onColor: (color: string) => void;
}) {
  const t = useTranslations('categories');
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: cat.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-2"
    >
      {canEdit ? (
        <button
          type="button"
          className="cursor-grab text-muted-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
      ) : null}
      <span className="size-3 rounded-full" style={{ backgroundColor: cat.color }} aria-hidden />
      <Input
        className="h-8 flex-1"
        defaultValue={cat.name}
        disabled={!canEdit}
        onBlur={(e) => {
          if (e.target.value.trim() && e.target.value !== cat.name) onRename(e.target.value.trim());
        }}
      />
      {canEdit ? (
        <>
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={cat.color}
            onChange={(e) => {
              onColor(e.target.value);
            }}
            aria-label={t('color')}
          >
            {CATEGORY_PALETTE.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value={cat.color}>{t('customHex')}</option>
          </select>
          <Button type="button" variant="ghost" size="sm" onClick={onArchive}>
            {t('archive')}
          </Button>
        </>
      ) : null}
    </li>
  );
}

export function CategoriesManager({
  spaceId,
  role,
  initial,
}: {
  spaceId: string;
  role: MemberRole;
  initial: Category[];
}) {
  const t = useTranslations('categories');
  const [items, setItems] = useState(initial);
  const [pending, startTransition] = useTransition();
  const canEdit = can(role, 'categories.update');
  const canCreate = can(role, 'categories.create');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const roots = useMemo(
    () => items.filter((c) => !c.parent_id).sort((a, b) => a.position - b.position),
    [items],
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !canEdit) return;
    const oldIndex = roots.findIndex((c) => c.id === active.id);
    const newIndex = roots.findIndex((c) => c.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const nextRoots = arrayMove(roots, oldIndex, newIndex).map((c, position) => ({
      ...c,
      position,
    }));
    setItems((prev) => prev.map((c) => nextRoots.find((r) => r.id === c.id) ?? c));
    startTransition(async () => {
      await reorderCategoriesAction({
        spaceId,
        items: nextRoots.map((c) => ({ id: c.id, parentId: null, position: c.position })),
      });
    });
  }

  return (
    <div className="space-y-6 p-4 lg:p-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{t('title')}</h1>
        {canCreate ? (
          <Button
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await createCategoryAction({
                  spaceId,
                  name: 'New',
                  kind: 'expense',
                  color: CATEGORY_PALETTE[0],
                  icon: 'circle',
                });
                if (result.ok) {
                  setItems((prev) => [
                    ...prev,
                    {
                      id: result.data.id,
                      name: 'New',
                      kind: 'expense',
                      color: CATEGORY_PALETTE[0],
                      icon: 'circle',
                      parent_id: null,
                      position: prev.length,
                      is_system: false,
                    },
                  ]);
                }
              });
            }}
          >
            {t('add')}
          </Button>
        ) : null}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={roots.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {roots.map((cat) => (
              <SortableRow
                key={cat.id}
                cat={cat}
                canEdit={canEdit}
                onRename={(name) => {
                  startTransition(async () => {
                    await updateCategoryAction({ spaceId, categoryId: cat.id, name });
                    setItems((prev) => prev.map((c) => (c.id === cat.id ? { ...c, name } : c)));
                  });
                }}
                onColor={(color) => {
                  startTransition(async () => {
                    await updateCategoryAction({ spaceId, categoryId: cat.id, color });
                    setItems((prev) => prev.map((c) => (c.id === cat.id ? { ...c, color } : c)));
                  });
                }}
                onArchive={() => {
                  startTransition(async () => {
                    await updateCategoryAction({ spaceId, categoryId: cat.id, archived: true });
                    setItems((prev) => prev.filter((c) => c.id !== cat.id));
                  });
                }}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}
