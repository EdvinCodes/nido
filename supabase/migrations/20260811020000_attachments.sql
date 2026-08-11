-- Phase 07 — attachments table, receipts bucket policies, signed URL + purge helpers.

create table nido.attachments (
  id             uuid primary key default gen_random_uuid(),
  space_id       uuid not null references nido.spaces (id) on delete cascade,
  transaction_id uuid references nido.transactions (id) on delete cascade,
  storage_path   text not null unique,
  thumb_path     text,
  mime_type      text not null,
  size_bytes     integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  width          integer,
  height         integer,
  blurhash       text,
  ocr_status     text not null default 'none'
    check (ocr_status in ('none', 'queued', 'done', 'failed')),
  ocr_result     jsonb,
  uploaded_by    uuid not null references nido.profiles (id),
  created_at     timestamptz not null default now(),
  constraint attachments_mime_allowlist check (
    mime_type in (
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
      'application/pdf'
    )
  )
);

create index attachments_space_created_idx
  on nido.attachments (space_id, created_at desc);

create index attachments_tx_idx
  on nido.attachments (transaction_id)
  where transaction_id is not null;

create index attachments_space_storage_sum_idx
  on nido.attachments (space_id);

create trigger attachments_audit
  after insert or update or delete on nido.attachments
  for each row execute function nido.tg_audit('attachments');

alter table nido.attachments enable row level security;

create policy "attachments_select_members"
  on nido.attachments for select
  using (nido.is_member(space_id));

create policy "attachments_insert_editors"
  on nido.attachments for insert
  with check (
    nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[])
    and uploaded_by = (select auth.uid())
  );

create policy "attachments_update_editors"
  on nido.attachments for update
  using (
    nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[])
  )
  with check (
    nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[])
  );

create policy "attachments_delete_editors"
  on nido.attachments for delete
  using (
    nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[])
  );

grant select, insert, update, delete on nido.attachments to authenticated, service_role;

-- Max 5 attachments per transaction.
create or replace function nido.tg_attachments_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if new.transaction_id is null then
    return new;
  end if;
  if (
    select count(*)::int from nido.attachments a
    where a.transaction_id = new.transaction_id
      and (tg_op = 'INSERT' or a.id is distinct from new.id)
  ) >= 5 then
    raise exception 'at most five attachments per transaction' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger attachments_limit
  before insert or update of transaction_id on nido.attachments
  for each row execute function nido.tg_attachments_limit();

-- ---------------------------------------------------------------------------------------
-- Storage: private receipts bucket
-- Object name (within bucket): {space_id}/{yyyy}/{mm}/{uuid}.ext
-- Logical path shown in docs: receipts/{space_id}/{yyyy}/{mm}/{uuid}.ext
-- ---------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "receipts_select_members"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'receipts'
    and nido.is_member(((storage.foldername(name))[1])::uuid)
  );

create policy "receipts_insert_editors"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'receipts'
    and nido.is_member(
      ((storage.foldername(name))[1])::uuid,
      array['owner', 'admin', 'member']::nido.member_role[]
    )
  );

create policy "receipts_update_editors"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'receipts'
    and nido.is_member(
      ((storage.foldername(name))[1])::uuid,
      array['owner', 'admin', 'member']::nido.member_role[]
    )
  )
  with check (
    bucket_id = 'receipts'
    and nido.is_member(
      ((storage.foldername(name))[1])::uuid,
      array['owner', 'admin', 'member']::nido.member_role[]
    )
  );

create policy "receipts_delete_editors"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'receipts'
    and nido.is_member(
      ((storage.foldername(name))[1])::uuid,
      array['owner', 'admin', 'member']::nido.member_role[]
    )
  );

-- Storage objects cannot be deleted via SQL (storage.protect_delete). The app and the
-- purge Edge Function remove objects through the Storage API when attachment rows go away.

-- ---------------------------------------------------------------------------------------
-- Path helper for Edge/tests. Prefer app-side createSignedUrl with 60s TTL.
-- ---------------------------------------------------------------------------------------

create or replace function nido.attachment_storage_paths(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_row nido.attachments%rowtype;
begin
  select * into v_row from nido.attachments where id = p_id;
  if not found then
    raise exception 'attachment not found' using errcode = 'P0002';
  end if;
  if auth.role() is distinct from 'service_role' and not nido.is_member(v_row.space_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'id', v_row.id,
    'space_id', v_row.space_id,
    'storage_path', v_row.storage_path,
    'thumb_path', v_row.thumb_path,
    'mime_type', v_row.mime_type
  );
end;
$$;

revoke all on function nido.attachment_storage_paths(uuid) from public;
grant execute on function nido.attachment_storage_paths(uuid) to authenticated, service_role;

create or replace function nido.space_storage_usage(p_space_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_bytes bigint;
  v_count int;
begin
  if auth.role() is distinct from 'service_role' and not nido.is_member(p_space_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select coalesce(sum(size_bytes), 0)::bigint, count(*)::int
    into v_bytes, v_count
  from nido.attachments
  where space_id = p_space_id;
  return jsonb_build_object(
    'bytes', v_bytes,
    'count', v_count,
    'limit_bytes', 1073741824
  );
end;
$$;

revoke all on function nido.space_storage_usage(uuid) from public;
grant execute on function nido.space_storage_usage(uuid) to authenticated, service_role;

-- Purge attachments for transactions soft-deleted > 30 days, and orphans with no tx
-- that are older than 7 days (abandoned uploads).
create or replace function nido.purge_stale_attachments()
returns integer
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_deleted int;
begin
  with doomed as (
    delete from nido.attachments a
    using nido.transactions t
    where a.transaction_id = t.id
      and t.deleted_at is not null
      and t.deleted_at < now() - interval '30 days'
    returning a.id
  )
  select count(*)::int into v_deleted from doomed;

  with orphans as (
    delete from nido.attachments a
    where a.transaction_id is null
      and a.created_at < now() - interval '7 days'
    returning a.id
  )
  select v_deleted + count(*)::int into v_deleted from orphans;

  return v_deleted;
end;
$$;

revoke all on function nido.purge_stale_attachments() from public;
grant execute on function nido.purge_stale_attachments() to service_role;
