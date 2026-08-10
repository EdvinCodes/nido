-- Phase 02 — ledger: transactions, splits, balance invariant, tags junction, view.

create table nido.transactions (
  id                   uuid primary key default gen_random_uuid(),
  space_id             uuid not null references nido.spaces (id) on delete cascade,
  kind                 nido.tx_kind not null,
  booked_on            date not null,
  occurred_at          timestamptz,
  amount_minor         bigint not null check (amount_minor > 0),
  currency             nido.currency_code not null references nido.currencies (code),
  base_amount_minor    bigint not null,
  base_rate            numeric(20, 10) not null default 1,
  description          text not null default '' check (char_length(description) <= 200),
  merchant             text check (merchant is null or char_length(merchant) <= 120),
  notes                text check (notes is null or char_length(notes) <= 2000),
  category_id          uuid references nido.categories (id) on delete set null,
  account_id           uuid references nido.accounts (id) on delete set null,
  to_account_id        uuid references nido.accounts (id) on delete set null,
  payer_participant_id uuid references nido.participants (id) on delete set null,
  split_mode           nido.split_mode not null default 'personal',
  external_id          text,
  is_pending           boolean not null default false,
  created_by           uuid not null references nido.profiles (id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz,

  constraint transactions_transfer_shape check (
    (
      kind = 'transfer'
      and to_account_id is not null
      and account_id is not null
      and to_account_id <> account_id
      and category_id is null
      and payer_participant_id is null
    )
    or (
      kind <> 'transfer'
      and to_account_id is null
    )
  ),
  constraint transactions_payer_required check (
    kind = 'transfer' or payer_participant_id is not null
  )
);

comment on table nido.transactions is
  'Ledger entries. amount_minor is always positive; direction comes from kind. Soft-deleted via deleted_at.';
comment on column nido.transactions.amount_minor is
  'Always positive. Sign/direction is derived from kind at read time.';
comment on column nido.transactions.deleted_at is
  'Soft delete. Application reads go through nido.v_transactions which filters this out.';

create index transactions_space_booked_idx
  on nido.transactions (space_id, booked_on desc)
  where deleted_at is null;

create index transactions_space_category_booked_idx
  on nido.transactions (space_id, category_id, booked_on)
  where deleted_at is null;

create index transactions_space_payer_booked_idx
  on nido.transactions (space_id, payer_participant_id, booked_on)
  where deleted_at is null;

create unique index transactions_space_external_id_uidx
  on nido.transactions (space_id, external_id)
  where external_id is not null and deleted_at is null;

create index transactions_fts_idx
  on nido.transactions
  using gin (
    to_tsvector(
      'simple',
      coalesce(description, '') || ' ' || coalesce(merchant, '') || ' ' || coalesce(notes, '')
    )
  );

create trigger transactions_set_updated_at
  before update on nido.transactions
  for each row execute function nido.tg_set_updated_at();

-- Soft-delete / restore aware audit for transactions.
create or replace function nido.tg_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_old jsonb;
  v_space_id uuid;
  v_entity_id uuid;
  v_action text;
  v_diff jsonb;
  v_entity text := tg_argv[0];
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
    v_action := 'delete';
  else
    v_row := to_jsonb(new);
    v_action := lower(tg_op);
  end if;

  if v_entity = 'spaces' then
    v_space_id := (v_row ->> 'id')::uuid;
    v_entity_id := v_space_id;
  elsif v_entity = 'space_members' then
    v_space_id := (v_row ->> 'space_id')::uuid;
    v_entity_id := (v_row ->> 'participant_id')::uuid;
  else
    v_space_id := (v_row ->> 'space_id')::uuid;
    v_entity_id := (v_row ->> 'id')::uuid;
  end if;

  -- Soft-delete / restore for ledger rows (deleted_at transitions).
  if tg_op = 'UPDATE' and v_entity = 'transactions' then
    if old.deleted_at is null and new.deleted_at is not null then
      v_action := 'delete';
    elsif old.deleted_at is not null and new.deleted_at is null then
      v_action := 'restore';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_diff := jsonb_strip_nulls(
      (
        select jsonb_object_agg(n.key, n.value)
        from jsonb_each(v_row) as n(key, value)
        where v_old -> n.key is distinct from n.value
      )
    );
  else
    v_diff := v_row;
  end if;

  insert into nido.audit_log (space_id, actor_id, entity, entity_id, action, diff)
  values (v_space_id, (select auth.uid()), v_entity, v_entity_id, v_action, v_diff);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger transactions_audit
  after insert or update or delete on nido.transactions
  for each row execute function nido.tg_audit('transactions');

alter table nido.transactions enable row level security;

create policy "transactions_select_members"
  on nido.transactions for select
  using (nido.is_member(space_id));

create policy "transactions_insert_contributors"
  on nido.transactions for insert
  with check (
    nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[])
    and created_by = (select auth.uid())
  );

create policy "transactions_update_own_or_admin"
  on nido.transactions for update
  using (
    nido.is_member(space_id, array['owner', 'admin']::nido.member_role[])
    or (
      nido.is_member(space_id, array['member']::nido.member_role[])
      and created_by = (select auth.uid())
    )
  )
  with check (
    nido.is_member(space_id, array['owner', 'admin']::nido.member_role[])
    or (
      nido.is_member(space_id, array['member']::nido.member_role[])
      and created_by = (select auth.uid())
    )
  );

create policy "transactions_delete_own_or_admin"
  on nido.transactions for delete
  using (
    nido.is_member(space_id, array['owner', 'admin']::nido.member_role[])
    or (
      nido.is_member(space_id, array['member']::nido.member_role[])
      and created_by = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------------------
-- Splits
-- ---------------------------------------------------------------------------------------

create table nido.transaction_splits (
  id              uuid primary key default gen_random_uuid(),
  transaction_id  uuid not null references nido.transactions (id) on delete cascade,
  space_id        uuid not null references nido.spaces (id) on delete cascade,
  participant_id  uuid not null references nido.participants (id) on delete cascade,
  weight          numeric(12, 4) not null default 1 check (weight >= 0),
  owed_minor      bigint not null,
  base_owed_minor bigint not null,
  unique (transaction_id, participant_id)
);

comment on table nido.transaction_splits is
  'Who owes how much of a transaction. space_id is denormalized for RLS without a join.';

create index transaction_splits_space_participant_idx
  on nido.transaction_splits (space_id, participant_id);

create trigger transaction_splits_audit
  after insert or update or delete on nido.transaction_splits
  for each row execute function nido.tg_audit('transaction_splits');

alter table nido.transaction_splits enable row level security;

create policy "transaction_splits_select_members"
  on nido.transaction_splits for select
  using (nido.is_member(space_id));

create policy "transaction_splits_insert_contributors"
  on nido.transaction_splits for insert
  with check (
    nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[])
  );

create policy "transaction_splits_update_contributors"
  on nido.transaction_splits for update
  using (
    nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[])
  )
  with check (
    nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[])
  );

create policy "transaction_splits_delete_contributors"
  on nido.transaction_splits for delete
  using (
    nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[])
  );

-- ---------------------------------------------------------------------------------------
-- Balance invariant — deferred constraint trigger
-- ---------------------------------------------------------------------------------------

create or replace function nido.tg_splits_balance()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tx_id uuid;
  v_kind nido.tx_kind;
  v_amount bigint;
  v_sum bigint;
  v_deleted timestamptz;
begin
  v_tx_id := coalesce(new.transaction_id, old.transaction_id);

  select t.kind, t.amount_minor, t.deleted_at
    into v_kind, v_amount, v_deleted
  from nido.transactions t
  where t.id = v_tx_id;

  if not found then
    return null;
  end if;

  -- Soft-deleted rows are frozen; skip while deleted.
  if v_deleted is not null then
    return null;
  end if;

  select coalesce(sum(s.owed_minor), 0)
    into v_sum
  from nido.transaction_splits s
  where s.transaction_id = v_tx_id;

  if v_kind = 'transfer' then
    if v_sum <> 0 then
      raise exception
        'transfer % must have no splits (sum=%s)',
        v_tx_id, v_sum
        using errcode = 'P0001';
    end if;
  elsif v_sum <> v_amount then
    raise exception
      'split imbalance for transaction %: sum(owed_minor)=% amount_minor=%',
      v_tx_id, v_sum, v_amount
      using errcode = 'P0001';
  end if;

  return null;
end;
$$;

comment on function nido.tg_splits_balance() is
  'Deferred constraint: non-transfer splits must sum exactly to amount_minor; transfers must have none.';

create constraint trigger transaction_splits_balance
  after insert or update or delete on nido.transaction_splits
  deferrable initially deferred
  for each row execute function nido.tg_splits_balance();

-- Also re-check when the parent amount or kind changes.
create or replace function nido.tg_transactions_balance()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_sum bigint;
begin
  if new.deleted_at is not null then
    return null;
  end if;

  select coalesce(sum(s.owed_minor), 0)
    into v_sum
  from nido.transaction_splits s
  where s.transaction_id = new.id;

  if new.kind = 'transfer' then
    if v_sum <> 0 then
      raise exception
        'transfer % must have no splits (sum=%s)',
        new.id, v_sum
        using errcode = 'P0001';
    end if;
  elsif v_sum <> new.amount_minor then
    raise exception
      'split imbalance for transaction %: sum(owed_minor)=% amount_minor=%',
      new.id, v_sum, new.amount_minor
      using errcode = 'P0001';
  end if;

  return null;
end;
$$;

create constraint trigger transactions_balance
  after insert or update of amount_minor, kind, deleted_at on nido.transactions
  deferrable initially deferred
  for each row execute function nido.tg_transactions_balance();

-- ---------------------------------------------------------------------------------------
-- transaction_tags
-- ---------------------------------------------------------------------------------------

create table nido.transaction_tags (
  transaction_id uuid not null references nido.transactions (id) on delete cascade,
  tag_id         uuid not null references nido.tags (id) on delete cascade,
  space_id       uuid not null references nido.spaces (id) on delete cascade,
  primary key (transaction_id, tag_id)
);

comment on table nido.transaction_tags is
  'Many-to-many between transactions and tags. space_id denormalized for RLS.';

alter table nido.transaction_tags enable row level security;

create policy "transaction_tags_select_members"
  on nido.transaction_tags for select
  using (nido.is_member(space_id));

create policy "transaction_tags_insert_contributors"
  on nido.transaction_tags for insert
  with check (
    nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[])
  );

create policy "transaction_tags_delete_contributors"
  on nido.transaction_tags for delete
  using (
    nido.is_member(space_id, array['owner', 'admin', 'member']::nido.member_role[])
  );

grant select, insert, update, delete on nido.transactions to authenticated, service_role;
grant select, insert, update, delete on nido.transaction_splits to authenticated, service_role;
grant select, insert, update, delete on nido.transaction_tags to authenticated, service_role;

-- ---------------------------------------------------------------------------------------
-- v_transactions — application read model
-- ---------------------------------------------------------------------------------------

create or replace view nido.v_transactions
with (security_invoker = true)
as
select
  t.id,
  t.space_id,
  t.kind,
  t.booked_on,
  t.occurred_at,
  t.amount_minor,
  t.currency,
  t.base_amount_minor,
  t.base_rate,
  t.description,
  t.merchant,
  t.notes,
  t.category_id,
  t.account_id,
  t.to_account_id,
  t.payer_participant_id,
  t.split_mode,
  t.external_id,
  t.is_pending,
  t.created_by,
  t.created_at,
  t.updated_at,
  c.name as category_name,
  c.color as category_color,
  c.icon as category_icon,
  a.name as account_name,
  a.color as account_color,
  ta.name as to_account_name,
  p.display_name as payer_name,
  p.color as payer_color,
  p.avatar_url as payer_avatar_url,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'participant_id', s.participant_id,
          'display_name', sp.display_name,
          'color', sp.color,
          'avatar_url', sp.avatar_url,
          'weight', s.weight,
          'owed_minor', s.owed_minor,
          'base_owed_minor', s.base_owed_minor
        )
        order by sp.position, sp.display_name
      )
      from nido.transaction_splits s
      join nido.participants sp on sp.id = s.participant_id
      where s.transaction_id = t.id
    ),
    '[]'::jsonb
  ) as splits,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', tg.id,
          'name', tg.name,
          'color', tg.color
        )
        order by tg.name
      )
      from nido.transaction_tags tt
      join nido.tags tg on tg.id = tt.tag_id
      where tt.transaction_id = t.id
    ),
    '[]'::jsonb
  ) as tags
from nido.transactions t
left join nido.categories c on c.id = t.category_id
left join nido.accounts a on a.id = t.account_id
left join nido.accounts ta on ta.id = t.to_account_id
left join nido.participants p on p.id = t.payer_participant_id
where t.deleted_at is null;

comment on view nido.v_transactions is
  'Active transactions with category, accounts, payer, aggregated splits and tags. App reads this, not the base table.';

grant select on nido.v_transactions to authenticated, service_role;
