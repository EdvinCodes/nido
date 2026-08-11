'use client';

import { ChevronLeft, ChevronRight, Download, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { deleteAttachment, getAttachmentSignedUrl } from '@/features/attachments/actions';
import type { AttachmentRow } from '@/features/attachments/queries';
import { cn } from '@/lib/utils';

export function AttachmentViewer({
  spaceId,
  attachments,
  initialIndex,
  onClose,
  onDeleted,
}: {
  spaceId: string;
  attachments: AttachmentRow[];
  initialIndex: number;
  onClose: () => void;
  onDeleted?: (id: string) => void;
}) {
  const t = useTranslations('attachments');
  const [index, setIndex] = useState(initialIndex);
  const [url, setUrl] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [pending, startTransition] = useTransition();
  const pointerStart = useRef<{ x: number; y: number; dist: number; scale: number } | null>(null);
  const current = attachments[index];

  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    void getAttachmentSignedUrl({
      spaceId,
      attachmentId: current.id,
      thumb: false,
    }).then((result) => {
      if (!cancelled) {
        setUrl(result.ok ? result.data.url : null);
        setScale(1);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [current, spaceId]);

  function go(delta: number): void {
    setIndex((prev) => {
      const next = prev + delta;
      if (next < 0 || next >= attachments.length) return prev;
      return next;
    });
  }

  if (!current) return null;

  const isPdf = current.mime_type === 'application/pdf';

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="flex h-[min(92vh,900px)] max-w-4xl flex-col gap-0 overflow-hidden p-0"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">{t('viewerTitle')}</DialogTitle>
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm text-muted-foreground">
            {t('viewerCounter', { current: index + 1, total: attachments.length })}
          </p>
          <div className="flex items-center gap-1">
            {url ? (
              <Button type="button" size="icon" variant="ghost" asChild>
                <a href={url} download target="_blank" rel="noopener noreferrer">
                  <Download className="size-4" aria-hidden />
                  <span className="sr-only">{t('download')}</span>
                </a>
              </Button>
            ) : null}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={pending}
              aria-label={t('delete')}
              onClick={() => {
                startTransition(async () => {
                  const result = await deleteAttachment({
                    spaceId,
                    attachmentId: current.id,
                  });
                  if (result.ok) onDeleted?.(current.id);
                });
              }}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onClose}
              aria-label={t('close')}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        </div>

        <div
          className="relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden bg-black/90"
          onPointerDown={(e) => {
            if (isPdf) return;
            pointerStart.current = {
              x: e.clientX,
              y: e.clientY,
              dist: 0,
              scale,
            };
          }}
          onPointerMove={(e) => {
            if (!pointerStart.current || isPdf) return;
            const dx = e.clientX - pointerStart.current.x;
            if (Math.abs(dx) > 80 && scale <= 1.05) {
              if (dx < 0) go(1);
              else go(-1);
              pointerStart.current = null;
              return;
            }
            if (e.pointerType === 'touch' && e.buttons === 0) return;
          }}
          onPointerUp={() => {
            pointerStart.current = null;
          }}
          onWheel={(e) => {
            if (isPdf) return;
            e.preventDefault();
            setScale((s) => Math.min(4, Math.max(1, s + (e.deltaY < 0 ? 0.1 : -0.1))));
          }}
        >
          {attachments.length > 1 ? (
            <>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="absolute left-2 z-10 bg-background/40 text-foreground"
                disabled={index === 0}
                onClick={() => {
                  go(-1);
                }}
                aria-label={t('previous')}
              >
                <ChevronLeft className="size-5" aria-hidden />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="absolute right-2 z-10 bg-background/40 text-foreground"
                disabled={index === attachments.length - 1}
                onClick={() => {
                  go(1);
                }}
                aria-label={t('next')}
              >
                <ChevronRight className="size-5" aria-hidden />
              </Button>
            </>
          ) : null}

          {isPdf && url ? (
            <iframe title={t('viewerTitle')} src={url} className="size-full bg-background" />
          ) : url ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed URL viewer
            <img
              src={url}
              alt=""
              className={cn(
                'max-h-full max-w-full object-contain transition-transform duration-100',
              )}
              style={{ transform: `scale(${String(scale)})` }}
              draggable={false}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t('loading')}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
