import { notFound } from 'next/navigation';
import { CategoriesManager } from '@/features/categories/categories-manager';
import { getCategories, getSpaceForMember } from '@/features/spaces/queries';

export default async function CategoriesSettingsPage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  const membership = await getSpaceForMember(spaceId);
  if (!membership) notFound();

  const categories = await getCategories(spaceId);

  return (
    <CategoriesManager
      spaceId={spaceId}
      role={membership.role}
      initial={categories.map((c) => ({
        id: c.id,
        name: c.name,
        kind: c.kind,
        color: c.color,
        icon: c.icon,
        parent_id: c.parent_id,
        position: c.position,
        is_system: c.is_system,
      }))}
    />
  );
}
