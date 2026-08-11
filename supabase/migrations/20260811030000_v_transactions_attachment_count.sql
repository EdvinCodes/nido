-- Phase 07 — expose attachment_count on the ledger read model.

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
  ) as tags,
  (
    select count(*)::int
    from nido.attachments att
    where att.transaction_id = t.id
  ) as attachment_count
from nido.transactions t
left join nido.categories c on c.id = t.category_id
left join nido.accounts a on a.id = t.account_id
left join nido.accounts ta on ta.id = t.to_account_id
left join nido.participants p on p.id = t.payer_participant_id
where t.deleted_at is null;

comment on view nido.v_transactions is
  'Active transactions with category, accounts, payer, attachment_count, aggregated splits and tags.';

grant select on nido.v_transactions to authenticated, service_role;
