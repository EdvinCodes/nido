-- Phase 01 — table privileges for PostgREST roles.

grant select, update on nido.profiles to authenticated, service_role;
grant select, insert, update, delete on nido.spaces to authenticated, service_role;
grant select, insert, update, delete on nido.participants to authenticated, service_role;
grant select, insert, update, delete on nido.space_members to authenticated, service_role;
grant select, insert, update, delete on nido.space_invitations to authenticated, service_role;
grant select, insert, update, delete on nido.categories to authenticated, service_role;
grant select on nido.audit_log to authenticated, service_role;

grant usage, select on sequence nido.audit_log_id_seq to authenticated, service_role;
