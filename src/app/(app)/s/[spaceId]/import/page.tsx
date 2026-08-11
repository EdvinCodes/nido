import { notFound } from 'next/navigation';
import { ImportWizard } from '@/features/imports/import-wizard';
import { listAccounts } from '@/features/accounts/queries';
import { listMappingTemplates } from '@/features/imports/queries';
import { getCategories, getSpaceForMember } from '@/features/spaces/queries';

export default async function ImportPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const membership = await getSpaceForMember(spaceId);
  if (!membership) notFound();

  const [accounts, categories, templates] = await Promise.all([
    listAccounts(spaceId),
    getCategories(spaceId),
    listMappingTemplates(spaceId),
  ]);

  return (
    <ImportWizard
      spaceId={spaceId}
      accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      templates={templates}
      baseCurrency={membership.space.base_currency}
    />
  );
}
