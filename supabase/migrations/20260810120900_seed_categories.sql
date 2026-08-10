-- Phase 01 — default category seed shared by create_space and seed.sql.

create or replace function nido.seed_default_categories(
  p_space_id uuid,
  p_category_keys text[] default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_keys text[];
begin
  if p_category_keys is null then
    v_keys := array[
      'housing', 'groceries', 'eating_out', 'transport', 'health', 'leisure',
      'subscriptions', 'shopping', 'pets', 'travel', 'education', 'gifts_out',
      'fees', 'other_expense',
      'salary', 'freelance', 'refunds', 'gifts_in', 'investments', 'other_income'
    ];
  else
    v_keys := p_category_keys;
  end if;

  -- Always keep at least one expense and one income "Other" so the ledger stays usable.
  if not ('other_expense' = any (v_keys)) then
    v_keys := array_append(v_keys, 'other_expense');
  end if;
  if not ('other_income' = any (v_keys)) then
    v_keys := array_append(v_keys, 'other_income');
  end if;

  insert into nido.categories (space_id, name, kind, color, icon, position, is_system)
  select p_space_id, d.name, d.kind, d.color, d.icon, d.position, true
  from (
    values
      ('housing',       'Housing',       'expense'::nido.category_kind, '#C4A484', 'home',            0::smallint),
      ('groceries',     'Groceries',     'expense', '#8FBC8F', 'shopping-cart',   1),
      ('eating_out',    'Eating out',    'expense', '#E8A87C', 'utensils',        2),
      ('transport',     'Transport',     'expense', '#6B8EAD', 'car',             3),
      ('health',        'Health',        'expense', '#D4849A', 'heart-pulse',     4),
      ('leisure',       'Leisure',       'expense', '#9B8EC4', 'gamepad-2',       5),
      ('subscriptions', 'Subscriptions', 'expense', '#7BA3A8', 'repeat',          6),
      ('shopping',      'Shopping',      'expense', '#D4A5A5', 'shopping-bag',    7),
      ('pets',          'Pets',          'expense', '#B8A98A', 'paw-print',       8),
      ('travel',        'Travel',        'expense', '#6A9BC3', 'plane',           9),
      ('education',     'Education',     'expense', '#8A9A5B', 'graduation-cap', 10),
      ('gifts_out',     'Gifts',         'expense', '#C49A6C', 'gift',           11),
      ('fees',          'Fees',          'expense', '#9A9A9A', 'landmark',       12),
      ('other_expense', 'Other',         'expense', '#8B8B8B', 'circle',         13),
      ('salary',        'Salary',        'income',  '#5B9A7A', 'wallet',          0),
      ('freelance',     'Freelance',     'income',  '#6B8EAD', 'briefcase',       1),
      ('refunds',       'Refunds',       'income',  '#7BA3A8', 'undo-2',          2),
      ('gifts_in',      'Gifts',         'income',  '#C49A6C', 'gift',            3),
      ('investments',   'Investments',   'income',  '#8A9A5B', 'trending-up',     4),
      ('other_income',  'Other',         'income',  '#8B8B8B', 'circle',          5)
  ) as d(key, name, kind, color, icon, position)
  where d.key = any (v_keys);
end;
$$;

comment on function nido.seed_default_categories(uuid, text[]) is
  'Seeds the default category tree for a space. Null keys = full set; always keeps Other.';

revoke all on function nido.seed_default_categories(uuid, text[]) from public;
grant execute on function nido.seed_default_categories(uuid, text[]) to service_role;
