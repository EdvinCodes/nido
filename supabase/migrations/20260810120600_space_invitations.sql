-- Phase 01 — space_invitations. Raw token never stored; only sha256 hash.

create table nido.space_invitations (
  id             uuid primary key default gen_random_uuid(),
  space_id       uuid not null references nido.spaces (id) on delete cascade,
  email          extensions.citext,
  token_hash     text not null unique,
  role           nido.member_role not null default 'member'
                   check (role <> 'owner'),
  participant_id uuid references nido.participants (id) on delete set null,
  invited_by     uuid not null references nido.profiles (id),
  expires_at     timestamptz not null default (now() + interval '7 days'),
  accepted_at    timestamptz,
  accepted_by    uuid references nido.profiles (id),
  revoked_at     timestamptz,
  created_at     timestamptz not null default now()
);

comment on table nido.space_invitations is
  'Single-use invite tokens. Acceptance goes through nido.accept_invitation RPC.';
comment on column nido.space_invitations.token_hash is
  'sha256 hex digest of the raw token shown once in the invite link.';

create index space_invitations_space_pending_idx
  on nido.space_invitations (space_id)
  where accepted_at is null and revoked_at is null;

alter table nido.space_invitations enable row level security;

-- Admins/owners manage invitations; invitees never read the table directly.
create policy "space_invitations_select_admins"
  on nido.space_invitations for select
  using (nido.is_member(space_id, array['owner', 'admin']::nido.member_role[]));

create policy "space_invitations_insert_admins"
  on nido.space_invitations for insert
  with check (nido.is_member(space_id, array['owner', 'admin']::nido.member_role[]));

create policy "space_invitations_update_admins"
  on nido.space_invitations for update
  using (nido.is_member(space_id, array['owner', 'admin']::nido.member_role[]))
  with check (nido.is_member(space_id, array['owner', 'admin']::nido.member_role[]));

create policy "space_invitations_delete_admins"
  on nido.space_invitations for delete
  using (nido.is_member(space_id, array['owner', 'admin']::nido.member_role[]));
