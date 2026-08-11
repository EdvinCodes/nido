import { notFound } from 'next/navigation';
import { RulesManager } from '@/features/imports/rules-manager';
import { listCategorizationRules } from '@/features/imports/queries';
import { getCategories, getSpaceForMember } from '@/features/spaces/queries';

export default async function RulesSettingsPage({
  params,
}: {
  params: Promise<{ spaceId: string }>;
}) {
  const { spaceId } = await params;
  const membership = await getSpaceForMember(spaceId);
  if (!membership) notFound();

  const [rules, categories] = await Promise.all([
    listCategorizationRules(spaceId),
    getCategories(spaceId),
  ]);

  return (
    <RulesManager
      spaceId={spaceId}
      role={membership.role}
      rules={rules}
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
