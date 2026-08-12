'use client';

import { decode } from 'blurhash';
import { Camera, FileText, Receipt } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
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
      href={route(`/s/${spaceId}/ledger?ids=${item.transaction_id}`)}
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
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-card text-primary">
          <Receipt className="size-7" aria-hidden />
        </div>
        <div className="space-y-2">
          <p className="font-display text-2xl tracking-tight">{t('emptyTitle')}</p>
          <p className="text-sm text-balance text-muted-foreground">{t('emptyBody')}</p>
        </div>
        <ol className="w-full space-y-3 rounded-xl border border-border bg-card p-4 text-left text-sm">
          <li className="flex gap-3">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
              1
            </span>
            <span>{t('emptyStep1')}</span>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
              2
            </span>
            <span>{t('emptyStep2')}</span>
          </li>
          <li className="flex gap-3">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
              3
            </span>
            <span>{t('emptyStep3')}</span>
          </li>
        </ol>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href={route(`/s/${spaceId}/ledger`)}>
              <Camera className="size-4" aria-hidden />
              {t('emptyCtaLedger')}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={route(`/s/${spaceId}/import`)}>{t('emptyCtaImport')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 lg:p-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t('galleryTitle')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('gallerySubtitle')}</p>
      </div>
      {groups.map((group) => (
        <section key={group.date} className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            {new Intl.DateTimeFormat(locale, {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            }).format(new Date(`${group.date}T00:00:00Z`))}
          </h2>
          <ul className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5')}>
            {group.items.map((item) => (
              <li key={item.id}>
                <ReceiptTile spaceId={spaceId} item={item} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
