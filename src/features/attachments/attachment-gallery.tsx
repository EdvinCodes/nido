'use client';

import { decode } from 'blurhash';
import { FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { getAttachmentSignedUrl } from '@/features/attachments/actions';
import type { AttachmentRow } from '@/features/attachments/queries';
import { cn } from '@/lib/utils';
import { AttachmentViewer } from './attachment-viewer';

type ThumbState = {
  url: string | null;
  loading: boolean;
};

function BlurPlaceholder({
  blurhash,
  width,
  height,
  className,
}: {
  blurhash: string | null;
  width: number | null;
  height: number | null;
  className?: string;
}) {
  const ratio =
    width != null && height != null && height > 0
      ? `${String(width)} / ${String(height)}`
      : '4 / 3';

  if (!blurhash) {
    return (
      <Skeleton className={cn('w-full rounded-lg', className)} style={{ aspectRatio: ratio }} />
    );
  }

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
    // eslint-disable-next-line @next/next/no-img-element -- blurhash data URL placeholder
    <img
      src={canvas.toDataURL()}
      alt=""
      className={cn('w-full rounded-lg object-cover', className)}
      style={{ aspectRatio: ratio }}
    />
  );
}

function AttachmentThumb({
  attachment,
  spaceId,
  onOpen,
}: {
  attachment: AttachmentRow;
  spaceId: string;
  onOpen: () => void;
}) {
  const [state, setState] = useState<ThumbState>({ url: null, loading: true });
  const isPdf = attachment.mime_type === 'application/pdf';

  useEffect(() => {
    let cancelled = false;
    void getAttachmentSignedUrl({
      spaceId,
      attachmentId: attachment.id,
      thumb: true,
    }).then((result) => {
      if (!cancelled) {
        setState({
          url: result.ok ? result.data.url : null,
          loading: false,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [attachment.id, spaceId]);

  return (
    <button
      type="button"
      className="relative overflow-hidden rounded-lg border border-border bg-surface-raised focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      style={{
        aspectRatio:
          attachment.width && attachment.height
            ? `${String(attachment.width)} / ${String(attachment.height)}`
            : '4 / 3',
      }}
      onClick={onOpen}
      data-testid={`attachment-thumb-${attachment.id}`}
    >
      {isPdf ? (
        <div className="flex size-full flex-col items-center justify-center gap-1 bg-muted/40 p-2 text-muted-foreground">
          <FileText className="size-8" aria-hidden />
        </div>
      ) : state.loading ? (
        <BlurPlaceholder
          blurhash={attachment.blurhash}
          width={attachment.width}
          height={attachment.height}
          className="size-full"
        />
      ) : state.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL from private bucket
        <img src={state.url} alt="" className="size-full object-cover" />
      ) : (
        <BlurPlaceholder
          blurhash={attachment.blurhash}
          width={attachment.width}
          height={attachment.height}
          className="size-full"
        />
      )}
    </button>
  );
}

export function AttachmentGallery({
  spaceId,
  attachments,
}: {
  spaceId: string;
  transactionId: string;
  attachments: AttachmentRow[];
}) {
  const t = useTranslations('attachments');
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set());

  const items = useMemo(
    () => attachments.filter((row) => !deletedIds.has(row.id)),
    [attachments, deletedIds],
  );

  if (items.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="attachment-gallery">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {t('galleryTitle')}
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {items.map((attachment, index) => (
          <AttachmentThumb
            key={attachment.id}
            attachment={attachment}
            spaceId={spaceId}
            onOpen={() => {
              setViewerIndex(index);
            }}
          />
        ))}
      </div>
      {viewerIndex != null ? (
        <AttachmentViewer
          spaceId={spaceId}
          attachments={items}
          initialIndex={viewerIndex}
          onClose={() => {
            setViewerIndex(null);
          }}
          onDeleted={(id) => {
            startTransition(() => {
              setDeletedIds((prev) => new Set(prev).add(id));
              setViewerIndex(null);
            });
          }}
        />
      ) : null}
    </div>
  );
}
