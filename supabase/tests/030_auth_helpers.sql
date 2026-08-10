-- pgTAP: the RLS helper functions exist with the contract every future policy depends on.
-- They are not *called* here — nido.space_members and nido.participants arrive in Phase 01
-- — but their signatures are locked in now so Phase 01's policies can rely on them
-- immediately. This is also the harness smoke test proving pgTAP itself works end to end.
begin;
select plan(6);

select has_function(
  'nido', 'is_member', array['uuid', 'nido.member_role[]'],
  'nido.is_member(space_id, roles) exists'
);
select function_returns('nido', 'is_member', array['uuid', 'nido.member_role[]'], 'boolean', 'nido.is_member returns boolean');

select has_function(
  'nido', 'my_participant_id', array['uuid'],
  'nido.my_participant_id(space_id) exists'
);
select function_returns('nido', 'my_participant_id', array['uuid'], 'uuid', 'nido.my_participant_id returns uuid');

select has_function(
  'nido', 'has_role', array['uuid', 'nido.member_role[]'],
  'nido.has_role(space_id, roles) exists'
);
select function_returns('nido', 'has_role', array['uuid', 'nido.member_role[]'], 'boolean', 'nido.has_role returns boolean');

select * from finish();
rollback;
