import { notFound } from 'next/navigation';
import { ReceiptsGallery } from '@/features/attachments/receipts-gallery';
import { listForSpace } from '@/features/attachments/queries';
import { getSpaceForMember } from '@/features/spaces/queries';

export default async function ReceiptsPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const membership = await getSpaceForMember(spaceId);
  if (!membership) notFound();

  const groups = await listForSpace(spaceId);

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <ReceiptsGallery spaceId={spaceId} groups={groups} />
    </main>
  );
}
