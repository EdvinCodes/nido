'use client';

import { Paperclip, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { cn } from '@/lib/utils';
import { createAttachment, deleteAttachment } from './actions';
import { ATTACHMENT_ACCEPT, ATTACHMENT_MAX_PER_TX, isAllowedAttachment } from './lib/compress';
import { uploadReceipt } from './lib/upload';

type Item = {
  localId: string;
  attachmentId?: string;
  name: string;
  progress: number;
  beforeBytes?: number;
  afterBytes?: number;
  error?: string;
  previewUrl?: string;
};

export function AttachmentPicker({
  spaceId,
  transactionId,
  onAttachmentIdsChange,
  disabled,
}: {
  spaceId: string;
  transactionId?: string | null;
  onAttachmentIdsChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('attachments');
  const [items, setItems] = useState<Item[]>([]);
  const [pending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);

  function emitIds(next: Item[]): void {
    onAttachmentIdsChange(
      next.map((i) => i.attachmentId).filter((id): id is string => Boolean(id)),
    );
  }

  async function handleFiles(fileList: FileList | File[]): Promise<void> {
    const files = [...fileList].filter(isAllowedAttachment);
    const room = ATTACHMENT_MAX_PER_TX - items.length;
    if (room <= 0) return;
    await uploadBatch(files.slice(0, room));
  }

  async function uploadBatch(files: File[]): Promise<void> {
    for (const file of files) {
      const localId = crypto.randomUUID();
      const entry: Item = { localId, name: file.name, progress: 0 };
      if (file.type.startsWith('image/')) {
        entry.previewUrl = URL.createObjectURL(file);
      }

      setItems((prev) => {
        if (prev.length >= ATTACHMENT_MAX_PER_TX) return prev;
        return [...prev, entry];
      });

      try {
        const uploaded = await uploadReceipt({
          spaceId,
          file,
          onProgress: (p) => {
            setItems((prev) =>
              prev.map((item) =>
                item.localId === localId ? { ...item, progress: p.ratio } : item,
              ),
            );
          },
        });

        const result = await createAttachment({
          spaceId,
          transactionId: transactionId ?? null,
          storagePath: uploaded.storagePath,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
          width: uploaded.width,
          height: uploaded.height,
          blurhash: uploaded.blurhash,
        });

        setItems((prev) => {
          const next = prev.map((item) => {
            if (item.localId !== localId) return item;
            if (!result.ok) {
              return {
                ...item,
                error: result.error.message,
                progress: 0,
                beforeBytes: uploaded.beforeBytes,
                afterBytes: uploaded.afterBytes,
              };
            }
            return {
              ...item,
              attachmentId: result.data.id,
              progress: 1,
              beforeBytes: uploaded.beforeBytes,
              afterBytes: uploaded.afterBytes,
            };
          });
          emitIds(next);
          return next;
        });
      } catch (error) {
        setItems((prev) =>
          prev.map((item) =>
            item.localId === localId
              ? {
                  ...item,
                  error: error instanceof Error ? error.message : t('errors.upload'),
                  progress: 0,
                }
              : item,
          ),
        );
      }
    }
  }

  return (
    <div className="space-y-2" data-testid="attachment-picker">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{t('title')}</p>
        <label className="inline-flex">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || pending || items.length >= ATTACHMENT_MAX_PER_TX}
            onClick={(e) => {
              const input = (e.currentTarget.parentElement as HTMLElement).querySelector(
                'input[type=file]',
              );
              input?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            }}
          >
            <Paperclip className="size-4" aria-hidden />
            {t('add')}
          </Button>
          <input
            type="file"
            accept={ATTACHMENT_ACCEPT}
            capture="environment"
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files) void handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      <div
        className={cn(
          'rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground',
          dragOver && 'border-foreground bg-surface-raised',
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => {
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files);
        }}
      >
        {t('dropHint')}
      </div>

      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.localId}
              className="flex items-center gap-3 rounded-lg border border-border px-2 py-2"
            >
              {item.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                <img
                  src={item.previewUrl}
                  alt=""
                  className="size-10 shrink-0 rounded object-cover"
                />
              ) : (
                <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{item.name}</p>
                {item.beforeBytes != null && item.afterBytes != null ? (
                  <p className="text-xs text-muted-foreground">
                    {t('sizeCompare', {
                      before: formatKb(item.beforeBytes),
                      after: formatKb(item.afterBytes),
                    })}
                  </p>
                ) : null}
                {item.progress < 1 && !item.error ? (
                  <ProgressBar className="mt-1" value={item.progress} label={item.name} />
                ) : null}
                {item.error ? <p className="text-xs text-danger">{item.error}</p> : null}
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={disabled}
                aria-label={t('remove')}
                onClick={() => {
                  startTransition(async () => {
                    if (item.attachmentId) {
                      await deleteAttachment({
                        spaceId,
                        attachmentId: item.attachmentId,
                      });
                    }
                    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
                    setItems((prev) => {
                      const next = prev.filter((v) => v.localId !== item.localId);
                      emitIds(next);
                      return next;
                    });
                  });
                }}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function formatKb(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
