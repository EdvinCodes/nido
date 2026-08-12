import { notFound } from 'next/navigation';
import { ImportWizard } from '@/features/imports/import-wizard';
import { listAccounts } from '@/features/accounts/queries';
import { listImportBatches, listMappingTemplates } from '@/features/imports/queries';
import { getCategories, getSpaceForMember } from '@/features/spaces/queries';

export default async function ImportPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const membership = await getSpaceForMember(spaceId);
  if (!membership) notFound();

  const [accounts, categories, templates, batches] = await Promise.all([
    listAccounts(spaceId),
    getCategories(spaceId),
    listMappingTemplates(spaceId),
    listImportBatches(spaceId),
  ]);

  return (
    <ImportWizard
      spaceId={spaceId}
      accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      templates={templates}
      batches={batches.map((b) => ({
        id: b.id,
        fileName: b.file_name,
        status: b.status,
        rowCount: b.row_count,
        importedCount: b.imported_count,
        createdAt: b.created_at,
        committedAt: b.committed_at,
      }))}
      baseCurrency={membership.space.base_currency}
    />
  );
}
