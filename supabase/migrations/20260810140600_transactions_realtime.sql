-- Enable Realtime for the ledger so partners see each other's changes within ~1s
-- (docs/01-ARCHITECTURE.md § Realtime, Phase 02 task 5).

alter table nido.transactions replica identity full;

alter publication supabase_realtime add table nido.transactions;
