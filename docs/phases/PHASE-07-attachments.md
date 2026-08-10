# Phase 07 — Attachments and receipt extraction

## Goal

Photograph a receipt and the transaction fills itself in. Failing that, at least the receipt
is attached, compressed, stripped of location metadata, and retrievable in two taps.

## Required reading

- [`../02-DATA-MODEL.md`](../02-DATA-MODEL.md) — § 5 (`attachments`)
- [`../04-FEATURES.md`](../04-FEATURES.md) — § 8
- [`../01-ARCHITECTURE.md`](../01-ARCHITECTURE.md) — §§ 6, 12

## Tasks

### 1. Storage and database

1. `nido.attachments` with RLS.
2. A private `receipts` bucket with a path convention of
   `receipts/{space_id}/{yyyy}/{mm}/{uuid}.{ext}` and storage policies checking
   `nido.is_member((storage.foldername(name))[2]::uuid)` for select, insert, and delete.
3. A `nido.attachment_signed_url(p_id uuid)` helper, or equivalent Server Action, issuing
   60-second signed URLs. The bucket is never public and no long-lived URL is ever stored.
4. A trigger deleting the storage object when the attachment row is hard-deleted, and
   leaving it in place for soft-deleted transactions until the 30-day purge.
5. pgTAP covering the negative case: a member of another space cannot read the row, and the
   storage policy rejects them too.

### 2. Upload pipeline

Client side:

- Camera-first on mobile (`capture="environment"`), file picker on desktop, plus drag and
  drop and paste-from-clipboard.
- `browser-image-compression` reduces the image to at most 1600 px on the long edge and
  converts it to WebP at quality 0.8 before upload. Show the before and after size.
- A blurhash is computed client-side for the placeholder.
- Uploads are resumable via `tus` and continue in the background: the transaction saves
  immediately and the attachment attaches when it lands, with per-file progress and retry.
- Validation before upload: at most five per transaction, at most 10 MB each, and an
  extension allowlist.

Server side, in the `receipt-process` Edge Function:

- Re-encode the image, which strips all EXIF including GPS. A receipt photo carrying the
  coordinates of your home is a real leak and this is not optional.
- Verify the real MIME type by magic bytes rather than trusting the extension or the
  client-supplied type.
- Generate a 320 px thumbnail stored alongside the original.
- Extract width and height and write them to the row so the gallery never shifts layout.
- PDFs are accepted, thumbnailed from the first page, and never re-encoded.

### 3. Attachment UI

- A paperclip in the transaction form showing thumbnails with progress and remove actions.
- A gallery in the transaction detail sheet: tap to open a full-screen viewer with pinch
  zoom, swipe between attachments, download, and delete.
- A paperclip indicator on ledger rows that have one, and a "has attachment" filter (already
  present in the filter bar since Phase 02 — wire it up).
- A space-wide receipts gallery at `/s/[spaceId]/receipts`, a date-grouped grid, each item
  linking to its transaction. Useful for finding a warranty two years later.

### 4. Extraction

Only active when an AI provider is configured; the UI hides the entry points otherwise.

- Edge Function `receipt-extract` sends the image to a vision model through the AI SDK with
  `Output.object()` and a strict Zod schema returning: total, currency, date, merchant, tax
  amount, line items (optional), suggested category chosen from the space's actual category
  list, and a confidence score per field.
- Confidence below 0.7 leaves the field empty rather than guessing. A wrong pre-filled
  amount is worse than an empty one.
- Results never save automatically. They pre-fill the form, visually marked as suggestions
  with a small sparkle indicator and a one-tap "clear suggestions".
- The raw response is stored in `attachments.ocr_result` and `ocr_status` tracks the
  lifecycle. Failures are non-fatal and never block the attachment.
- Category suggestion is constrained to existing categories by passing the list in the
  schema as an enum, so the model cannot invent one.

### 5. Scan-first flow

An "add from receipt" action on the FAB and in the command palette inverts the order:
photograph, wait with a progress state showing what is being read, then land in a
pre-filled transaction form. On mobile this should feel like the fastest way to record an
expense, because it is.

### 6. Quota and cleanup

- Track total storage per space and show it in settings with the free-tier limit, since
  Supabase's free bucket is 1 GB and receipts are the thing that fills it.
- A weekly Edge Function purges attachments belonging to transactions soft-deleted more than
  30 days ago, and orphaned objects with no matching row.

## Acceptance criteria

- [ ] A 4 MB phone photo uploads as a WebP under 400 KB with no visible quality loss on the
      receipt text.
- [ ] EXIF, including GPS, is verifiably absent from the stored object — assert it in a test
      using a fixture image that contains coordinates.
- [ ] A member of another space cannot fetch the object even with the exact storage path.
- [ ] Signed URLs expire and a stale one returns an error rather than the file.
- [ ] Uploading on a throttled connection does not block saving the transaction, and the
      attachment appears when it completes.
- [ ] With an AI provider configured, a real Spanish supermarket receipt yields the correct
      total, date, and merchant, and a sensible category.
- [ ] With no AI provider configured, everything else in the phase works and no extraction
      UI is shown.
- [ ] Low-confidence fields are left empty rather than filled with a guess.
- [ ] `pnpm verify`, `pnpm test:db`, `pnpm test:e2e` pass.

## Out of scope

Line-item level splitting from a receipt, warranty tracking, and full-text search inside
receipt images. Add them to the backlog.

## Verification

```bash
pnpm db:reset && pnpm verify && pnpm test:db && pnpm test:e2e
```

Manual: upload the committed fixture receipts in `e2e/fixtures/receipts/` and compare the
extraction against the expected values recorded next to them.
