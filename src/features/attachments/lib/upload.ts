'use client';

import * as tus from 'tus-js-client';
import { clientEnv } from '@/lib/env';
import { createClient } from '@/lib/supabase/client';
import { compressReceipt, isAllowedAttachment } from './compress';
import { encodeBlurhash } from './blurhash';
import { receiptObjectPath } from './path';

export type UploadProgress = {
  bytesUploaded: number;
  bytesTotal: number;
  ratio: number;
};

export type UploadedReceipt = {
  storagePath: string;
  mimeType: 'image/webp' | 'application/pdf' | 'image/jpeg' | 'image/png';
  sizeBytes: number;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  beforeBytes: number;
  afterBytes: number;
};

async function imageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith('image/')) return null;
  const bitmap = await createImageBitmap(file);
  const dims = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return dims;
}

/**
 * Compress (client-side), then upload via tus resumable protocol to the receipts bucket.
 */
export async function uploadReceipt(input: {
  spaceId: string;
  file: File;
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
}): Promise<UploadedReceipt> {
  if (!isAllowedAttachment(input.file)) {
    throw new Error('File type or size is not allowed');
  }

  const compressed = await compressReceipt(input.file);
  const ext = compressed.file.type === 'application/pdf' ? 'pdf' : 'webp';
  const storagePath = receiptObjectPath(input.spaceId, ext);
  const mimeType =
    compressed.file.type === 'application/pdf'
      ? ('application/pdf' as const)
      : ('image/webp' as const);

  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const endpoint = `${clientEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`;
  const objectBytes = await compressed.file.arrayBuffer();

  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(new Blob([objectBytes], { type: mimeType }), {
      endpoint,
      retryDelays: [0, 1000, 3000, 5000],
      headers: {
        authorization: `Bearer ${session.access_token}`,
        'x-upsert': 'false',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: 'receipts',
        objectName: storagePath,
        contentType: mimeType,
        cacheControl: '3600',
      },
      chunkSize: 6 * 1024 * 1024,
      onError: (error) => {
        reject(error);
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        input.onProgress?.({
          bytesUploaded,
          bytesTotal,
          ratio: bytesTotal > 0 ? bytesUploaded / bytesTotal : 0,
        });
      },
      onSuccess: () => {
        resolve();
      },
    });

    if (input.signal) {
      input.signal.addEventListener('abort', () => {
        void upload.abort(true);
        reject(new DOMException('Aborted', 'AbortError'));
      });
    }

    void upload.findPreviousUploads().then((previous) => {
      if (previous[0]) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    });
  });

  const dims = await imageDimensions(compressed.file);
  const blurhash = await encodeBlurhash(compressed.file);

  return {
    storagePath,
    mimeType,
    sizeBytes: compressed.afterBytes,
    width: dims?.width ?? null,
    height: dims?.height ?? null,
    blurhash,
    beforeBytes: compressed.beforeBytes,
    afterBytes: compressed.afterBytes,
  };
}
