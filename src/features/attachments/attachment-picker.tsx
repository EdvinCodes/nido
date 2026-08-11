'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  useTransition,
} from 'react';
import { Paperclip, RotateCcw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { cn } from '@/lib/utils';
import { createAttachment, deleteAttachment, linkAttachment } from './actions';
import { ATTACHMENT_ACCEPT, ATTACHMENT_MAX_PER_TX, isAllowedAttachment } from './lib/compress';
import { invokeReceiptProcess } from './lib/invoke-process';
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
  file?: File;
};

export type AttachmentPickerHandle = {
  /** Completed attachment row ids (upload + DB insert done). */
  getAttachmentIds: () => string[];
  /** True while any file is still uploading or linking. */
  hasPendingUploads: () => boolean;
  /** Link completed and future uploads to a saved transaction. */
  linkToTransaction: (transactionId: string) => Promise<void>;
};

export const AttachmentPicker = forwardRef<
  AttachmentPickerHandle,
  {
    spaceId: string;
    transactionId?: string | null;
    onAttachmentIdsChange?: (ids: string[]) => void;
    disabled?: boolean;
    cameraFirst?: boolean;
    autoOpen?: boolean;
    onFirstUploadComplete?: (attachmentId: string) => void;
  }
>(function AttachmentPicker(
  {
    spaceId,
    transactionId,
    onAttachmentIdsChange,
    disabled,
    cameraFirst = false,
    autoOpen = false,
    onFirstUploadComplete,
  },
  ref,
) {
  const t = useTranslations('attachments');
  const [items, setItems] = useState<Item[]>([]);
  const [pending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const linkedTxRef = useRef<string | null>(transactionId ?? null);
  const firstUploadRef = useRef(false);

  useEffect(() => {
    linkedTxRef.current = transactionId ?? linkedTxRef.current;
  }, [transactionId]);

  useEffect(() => {
    if (autoOpen) {
      fileInputRef.current?.click();
    }
  }, [autoOpen]);

  const emitIds = useCallback(
    (next: Item[]) => {
      onAttachmentIdsChange?.(
        next.map((i) => i.attachmentId).filter((id): id is string => Boolean(id)),
      );
    },
    [onAttachmentIdsChange],
  );

  const linkIfNeeded = useCallback(
    async (attachmentId: string) => {
      const txId = linkedTxRef.current;
      if (!txId) return;
      await linkAttachment({ spaceId, attachmentId, transactionId: txId });
    },
    [spaceId],
  );

  async function uploadOne(file: File, localId: string): Promise<void> {
    try {
      const uploaded = await uploadReceipt({
        spaceId,
        file,
        onProgress: (p) => {
          setItems((prev) =>
            prev.map((item) => (item.localId === localId ? { ...item, progress: p.ratio } : item)),
          );
        },
      });

      const result = await createAttachment({
        spaceId,
        transactionId: linkedTxRef.current,
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
          const { error: _cleared, ...rest } = item;
          return {
            ...rest,
            attachmentId: result.data.id,
            progress: 1,
            beforeBytes: uploaded.beforeBytes,
            afterBytes: uploaded.afterBytes,
          };
        });
        emitIds(next);
        return next;
      });

      if (result.ok) {
        void invokeReceiptProcess(result.data.id);
        if (linkedTxRef.current) {
          void linkIfNeeded(result.data.id);
        }
        if (!firstUploadRef.current) {
          firstUploadRef.current = true;
          onFirstUploadComplete?.(result.data.id);
        }
      }
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

  function handleFiles(fileList: FileList | File[]): void {
    const files = [...fileList].filter(isAllowedAttachment);
    const room = ATTACHMENT_MAX_PER_TX - items.length;
    if (room <= 0) return;

    for (const file of files.slice(0, room)) {
      const localId = crypto.randomUUID();
      const entry: Item = { localId, name: file.name, progress: 0, file };
      if (file.type.startsWith('image/')) {
        entry.previewUrl = URL.createObjectURL(file);
      }

      setItems((prev) => {
        if (prev.length >= ATTACHMENT_MAX_PER_TX) return prev;
        return [...prev, entry];
      });

      void uploadOne(file, localId);
    }
  }

  useImperativeHandle(
    ref,
    () => ({
      getAttachmentIds: () =>
        items.map((i) => i.attachmentId).filter((id): id is string => Boolean(id)),
      hasPendingUploads: () =>
        items.some((item) => !item.error && (item.progress < 1 || !item.attachmentId)),
      linkToTransaction: async (txId: string) => {
        linkedTxRef.current = txId;
        await Promise.all(
          items
            .map((item) => item.attachmentId)
            .filter((id): id is string => Boolean(id))
            .map((attachmentId) => linkAttachment({ spaceId, attachmentId, transactionId: txId })),
        );
      },
    }),
    [items, spaceId],
  );

  useEffect(() => {
    function onPaste(event: ClipboardEvent): void {
      if (disabled) return;
      const files = event.clipboardData?.files;
      if (!files?.length) return;
      event.preventDefault();
      handleFiles(files);
    }
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('paste', onPaste);
    };
  });

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
            onClick={() => {
              fileInputRef.current?.click();
            }}
          >
            <Paperclip className="size-4" aria-hidden />
            {t('add')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ATTACHMENT_ACCEPT}
            capture={cameraFirst ? 'environment' : undefined}
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
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
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
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
              {item.error && item.file ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={t('retry')}
                  disabled={disabled}
                  onClick={() => {
                    const file = item.file;
                    if (!file) return;
                    setItems((prev) =>
                      prev.map((v) => {
                        if (v.localId !== item.localId) return v;
                        const { error: _cleared, ...rest } = v;
                        return { ...rest, progress: 0 };
                      }),
                    );
                    void uploadOne(file, item.localId);
                  }}
                >
                  <RotateCcw className="size-4" aria-hidden />
                </Button>
              ) : null}
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
});

function formatKb(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
