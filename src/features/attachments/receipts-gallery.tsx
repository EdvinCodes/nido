'use client';

import { decode } from 'blurhash';
import { FileText } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { getAttachmentSignedUrl } from '@/features/attachments/actions';
import type { AttachmentDateGroup } from '@/features/attachments/queries';
import { route } from '@/lib/routes';
import { cn } from '@/lib/utils';

function ReceiptTile({
  spaceId,
  item,
}: {
  spaceId: string;
  item: AttachmentDateGroup['items'][number];
}) {
  const [url, setUrl] = useState<string | null>(null);
  const isPdf = item.mime_type === 'application/pdf';

  useEffect(() => {
    let cancelled = false;
    void getAttachmentSignedUrl({
      spaceId,
      attachmentId: item.id,
      thumb: true,
    }).then((result) => {
      if (!cancelled) setUrl(result.ok ? result.data.url : null);
    });
    return () => {
      cancelled = true;
    };
  }, [item.id, spaceId]);

  const ratio =
    item.width != null && item.height != null && item.height > 0
      ? `${String(item.width)} / ${String(item.height)}`
      : '3 / 4';

  const content = (
    <div
      className="overflow-hidden rounded-lg border border-border bg-surface-raised"
      style={{ aspectRatio: ratio }}
    >
      {isPdf ? (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <FileText className="size-10" aria-hidden />
        </div>
      ) : url ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed thumbnail
        <img src={url} alt="" className="size-full object-cover" />
      ) : item.blurhash ? (
        <BlurhashTile blurhash={item.blurhash} ratio={ratio} />
      ) : (
        <Skeleton className="size-full" />
      )}
    </div>
  );

  if (!item.transaction_id) return content;

  return (
    <Link
      href={route(`/s/${spaceId}/ledger?tx=${item.transaction_id}`)}
      className="block transition-opacity hover:opacity-90"
      data-testid={`receipt-tile-${item.id}`}
    >
      {content}
    </Link>
  );
}

function BlurhashTile({ blurhash, ratio }: { blurhash: string; ratio: string }) {
  const pixels = decode(blurhash, 32, 32);
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const imageData = ctx.createImageData(32, 32);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- blurhash placeholder
    <img
      src={canvas.toDataURL()}
      alt=""
      className="size-full object-cover"
      style={{ aspectRatio: ratio }}
    />
  );
}

export function ReceiptsGallery({
  spaceId,
  groups,
}: {
  spaceId: string;
  groups: AttachmentDateGroup[];
}) {
  const t = useTranslations('attachments');
  const locale = useLocale();

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
        <p className="font-medium">{t('emptyTitle')}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{t('emptyBody')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 lg:p-8">
      {groups.map((group) => (
        <section key={group.date} className="space-y-3">
          <h2 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
            {new Intl.DateTimeFormat(locale, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }).format(new Date(`${group.date}T12:00:00Z`))}
          </h2>
          <div
            className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5')}
          >
            {group.items.map((item) => (
              <ReceiptTile key={item.id} spaceId={spaceId} item={item} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
