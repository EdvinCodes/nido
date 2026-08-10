-- pgTAP: nido.currencies exists, is RLS-protected, and is readable but not writable by the
-- application roles. Positive and negative cases per docs/06-CONVENTIONS.md §5.
begin;
select plan(6);

select has_table('nido', 'currencies', 'nido.currencies exists');
select has_pk('nido', 'currencies', 'nido.currencies has a primary key');
select ok(
  (select relrowsecurity from pg_class where oid = 'nido.currencies'::regclass),
  'row level security is enabled on nido.currencies'
);

select is(
  (select count(*)::int from nido.currencies),
  29,
  'the seeded currency list has the expected number of rows'
);

-- Positive: members of the anon role (unauthenticated visitors) can read the lookup table.
set local role anon;
select isnt_empty(
  $$ select 1 from nido.currencies limit 1 $$,
  'anon can read nido.currencies'
);

-- Negative: nobody outside a migration can write to the lookup table.
select throws_ok(
  $$ insert into nido.currencies (code, name, symbol) values ('XXX', 'Test', 'X') $$,
  '42501',
  null,
  'anon cannot insert into nido.currencies'
);
reset role;

select * from finish();
rollback;
