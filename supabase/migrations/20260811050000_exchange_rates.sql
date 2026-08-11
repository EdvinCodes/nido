-- Phase 09 — exchange_rates table, identity seed, and nido.convert().
-- See docs/02-DATA-MODEL.md §10 and docs/phases/PHASE-09-currency-reports.md.

create table nido.exchange_rates (
  base    nido.currency_code not null references nido.currencies (code),
  quote   nido.currency_code not null references nido.currencies (code),
  rate    numeric(20, 10) not null check (rate > 0),
  as_of   date not null,
  source  text not null default 'frankfurter',
  primary key (base, quote, as_of)
);

create index exchange_rates_lookup_idx
  on nido.exchange_rates (base, quote, as_of desc);

comment on table nido.exchange_rates is
  'Daily FX rates. base/quote means 1 unit of base equals rate units of quote.';

alter table nido.exchange_rates enable row level security;

create policy "exchange_rates_select_all"
  on nido.exchange_rates for select
  using (true);

grant select on nido.exchange_rates to anon, authenticated, service_role;
grant insert, update, delete on nido.exchange_rates to service_role;

-- Initial ECB reference rates (EUR base) so conversion works offline after reset.
-- Values are approximate; fx-refresh keeps them current.
insert into nido.exchange_rates (base, quote, rate, as_of, source) values
  ('EUR', 'USD', 1.0850000000, '2026-08-01', 'seed'),
  ('EUR', 'GBP', 0.8620000000, '2026-08-01', 'seed'),
  ('EUR', 'CHF', 0.9450000000, '2026-08-01', 'seed'),
  ('EUR', 'SEK', 11.4500000000, '2026-08-01', 'seed'),
  ('EUR', 'NOK', 11.8200000000, '2026-08-01', 'seed'),
  ('EUR', 'DKK', 7.4600000000, '2026-08-01', 'seed'),
  ('EUR', 'PLN', 4.2800000000, '2026-08-01', 'seed'),
  ('EUR', 'CZK', 25.1500000000, '2026-08-01', 'seed'),
  ('EUR', 'HUF', 395.0000000000, '2026-08-01', 'seed'),
  ('EUR', 'RON', 4.9700000000, '2026-08-01', 'seed'),
  ('EUR', 'BGN', 1.9558000000, '2026-08-01', 'seed'),
  ('EUR', 'CAD', 1.4850000000, '2026-08-01', 'seed'),
  ('EUR', 'AUD', 1.6550000000, '2026-08-01', 'seed'),
  ('EUR', 'NZD', 1.7850000000, '2026-08-01', 'seed'),
  ('EUR', 'MXN', 18.6500000000, '2026-08-01', 'seed'),
  ('EUR', 'BRL', 5.9500000000, '2026-08-01', 'seed'),
  ('EUR', 'ARS', 1050.0000000000, '2026-08-01', 'seed'),
  ('EUR', 'CLP', 985.0000000000, '2026-08-01', 'seed'),
  ('EUR', 'COP', 4550.0000000000, '2026-08-01', 'seed'),
  ('EUR', 'MAD', 10.6500000000, '2026-08-01', 'seed'),
  ('EUR', 'TRY', 37.5000000000, '2026-08-01', 'seed'),
  ('EUR', 'JPY', 162.5000000000, '2026-08-01', 'seed'),
  ('EUR', 'KRW', 1485.0000000000, '2026-08-01', 'seed'),
  ('EUR', 'CNY', 7.8500000000, '2026-08-01', 'seed'),
  ('EUR', 'INR', 90.5000000000, '2026-08-01', 'seed'),
  ('EUR', 'ZAR', 19.8500000000, '2026-08-01', 'seed'),
  ('EUR', 'ISK', 148.0000000000, '2026-08-01', 'seed'),
  ('EUR', 'TND', 3.3200000000, '2026-08-01', 'seed')
on conflict do nothing;

-- Look up the most recent rate at or before p_on, falling back to the oldest known rate.
create or replace function nido._fx_rate(
  p_base nido.currency_code,
  p_quote nido.currency_code,
  p_on date
)
returns table(rate numeric, as_of date, fallback boolean)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_rate numeric;
  v_as_of date;
begin
  if p_base = p_quote then
    return query select 1::numeric, p_on, false;
    return;
  end if;

  select r.rate, r.as_of
    into v_rate, v_as_of
  from nido.exchange_rates r
  where r.base = p_base
    and r.quote = p_quote
    and r.as_of <= p_on
  order by r.as_of desc
  limit 1;

  if found then
    return query select v_rate, v_as_of, false;
    return;
  end if;

  select 1 / r.rate, r.as_of
    into v_rate, v_as_of
  from nido.exchange_rates r
  where r.base = p_quote
    and r.quote = p_base
    and r.as_of <= p_on
  order by r.as_of desc
  limit 1;

  if found then
    return query select v_rate, v_as_of, false;
    return;
  end if;

  select r.rate, r.as_of
    into v_rate, v_as_of
  from nido.exchange_rates r
  where r.base = p_base
    and r.quote = p_quote
  order by r.as_of asc
  limit 1;

  if found then
    return query select v_rate, v_as_of, true;
    return;
  end if;

  select 1 / r.rate, r.as_of
    into v_rate, v_as_of
  from nido.exchange_rates r
  where r.base = p_quote
    and r.quote = p_base
  order by r.as_of asc
  limit 1;

  if found then
    return query select v_rate, v_as_of, true;
    return;
  end if;

  raise exception 'no exchange rate for % / %', p_base, p_quote using errcode = '22023';
end;
$$;

-- Convert minor units from p_from to p_to using EUR as pivot when no direct pair exists.
create or replace function nido.convert(
  p_amount bigint,
  p_from nido.currency_code,
  p_to nido.currency_code,
  p_on date
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_from_exp smallint;
  v_to_exp smallint;
  v_from_major numeric;
  v_to_major numeric;
  v_to_minor bigint;
  v_eur_major numeric;
  v_rate_from record;
  v_rate_to record;
  v_effective_rate numeric;
  v_as_of date;
  v_fallback boolean := false;
begin
  if p_amount is null then
    raise exception 'amount is required' using errcode = '22023';
  end if;
  if p_on is null then
    raise exception 'date is required' using errcode = '22023';
  end if;

  if p_from = p_to then
    return jsonb_build_object(
      'amount_minor', p_amount,
      'rate', 1,
      'as_of', p_on,
      'fallback', false
    );
  end if;

  select exponent into v_from_exp from nido.currencies where code = p_from;
  if not found then
    raise exception 'unknown currency %', p_from using errcode = '22023';
  end if;

  select exponent into v_to_exp from nido.currencies where code = p_to;
  if not found then
    raise exception 'unknown currency %', p_to using errcode = '22023';
  end if;

  v_from_major := p_amount::numeric / power(10::numeric, v_from_exp);

  if p_from = 'EUR' then
    v_eur_major := v_from_major;
    v_as_of := p_on;
  else
    select * into v_rate_from from nido._fx_rate('EUR', p_from, p_on);
    v_eur_major := v_from_major / v_rate_from.rate;
    v_as_of := v_rate_from.as_of;
    v_fallback := v_rate_from.fallback;
  end if;

  if p_to = 'EUR' then
    v_to_major := v_eur_major;
  else
    select * into v_rate_to from nido._fx_rate('EUR', p_to, p_on);
    v_to_major := v_eur_major * v_rate_to.rate;
    v_as_of := greatest(v_as_of, v_rate_to.as_of);
    v_fallback := v_fallback or v_rate_to.fallback;
  end if;

  v_to_minor := round(v_to_major * power(10::numeric, v_to_exp))::bigint;

  if p_amount = 0 then
    v_effective_rate := 0;
  else
    v_effective_rate := round((v_to_minor::numeric / p_amount::numeric), 10);
  end if;

  return jsonb_build_object(
    'amount_minor', v_to_minor,
    'rate', v_effective_rate,
    'as_of', v_as_of,
    'fallback', v_fallback
  );
end;
$$;

comment on function nido.convert(bigint, nido.currency_code, nido.currency_code, date) is
  'Convert minor units using the most recent rate at or before p_on; flags fallback to oldest rate.';

revoke all on function nido.convert(bigint, nido.currency_code, nido.currency_code, date) from public;
grant execute on function nido.convert(bigint, nido.currency_code, nido.currency_code, date)
  to authenticated, service_role;
