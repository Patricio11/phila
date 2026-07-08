-- Phila  Row-Level Security (Task 10.2). The real tenant boundary, enforced in
-- Postgres, beneath the app-layer `where org_id = …` checks (defence in depth).
--
-- The app's owner role (neondb_owner) has BYPASSRLS, so these policies are inert
-- for migrations/seed/auth. The runtime connects as the non-owner `phila_app`
-- role (no BYPASSRLS) and sets two GUCs per request inside a transaction:
--   set_config('app.org_id', '<org>', true)     -- the caller's org
--   set_config('app.is_super', 'on'|'off', true) -- platform super-admin escape
-- Policies key off those. With neither set, every org-scoped table denies all
-- rows (deny-by-default). The runner splits statements on its delimiter line.
--##
grant usage on schema public to phila_app;
--##
grant select, insert, update, delete on all tables in schema public to phila_app;
--##
alter default privileges in schema public grant select, insert, update, delete on tables to phila_app;
--##
create or replace function app_current_org() returns text language sql stable as $$ select current_setting('app.org_id', true) $$;
--##
create or replace function app_is_super() returns boolean language sql stable as $$ select coalesce(current_setting('app.is_super', true) = 'on', false) $$;
--##
grant execute on function app_current_org() to phila_app;
--##
grant execute on function app_is_super() to phila_app;
--##
-- Directly org-scoped tables: org_id must match the caller's org (or super).
do $$
declare t text;
begin
  foreach t in array array['appointments','audit_log','client_documents','clients','consents','counsellors','funders','grants','invoices','org_members','rooms','room_assignments','services','sites','org_messaging_settings','whatsapp_connections','credit_balances','credit_ledger','message_log','message_opt_outs','org_video_settings','org_ai_settings','ai_usage','payments','org_payment_connections','subscriptions','org_public_pages','public_page_events','documents','document_folders','document_requests','document_shares','org_storage_usage','message_threads','thread_members','team_messages','forms','form_assignments','org_onboarding_docs','org_feature_overrides','appointment_change_requests','waitlist_entries','whatsapp_windows']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists org_isolation on %I', t);
    execute format('create policy org_isolation on %I using (app_is_super() or org_id = app_current_org()) with check (app_is_super() or org_id = app_current_org())', t);
  end loop;
end $$;
--##
-- The org row itself (scoped by id).
alter table orgs enable row level security;
--##
alter table orgs force row level security;
--##
drop policy if exists org_isolation on orgs;
--##
create policy org_isolation on orgs using (app_is_super() or id = app_current_org()) with check (app_is_super() or id = app_current_org());
--##
-- message_templates: system defaults (org_id null) are readable by everyone; org
-- rows are isolated. Writes must target the caller's own org.
alter table message_templates enable row level security;
--##
alter table message_templates force row level security;
--##
drop policy if exists org_isolation on message_templates;
--##
create policy org_isolation on message_templates using (app_is_super() or org_id is null or org_id = app_current_org()) with check (app_is_super() or org_id = app_current_org());
--##
-- Clinical children scoped via clients.org_id.
do $$
declare t text;
begin
  foreach t in array array['care_plans','demographics','outcome_measures']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists org_isolation on %I', t);
    execute format('create policy org_isolation on %I using (app_is_super() or exists (select 1 from clients c where c.id = %I.client_id and c.org_id = app_current_org())) with check (app_is_super() or exists (select 1 from clients c where c.id = %I.client_id and c.org_id = app_current_org()))', t, t, t);
  end loop;
end $$;
--##
-- Grant M&E children scoped via grants.org_id.
do $$
declare t text;
begin
  foreach t in array array['grant_allocations','grant_indicators','grant_narratives']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists org_isolation on %I', t);
    execute format('create policy org_isolation on %I using (app_is_super() or exists (select 1 from grants g where g.id = %I.grant_id and g.org_id = app_current_org())) with check (app_is_super() or exists (select 1 from grants g where g.id = %I.grant_id and g.org_id = app_current_org()))', t, t, t);
  end loop;
end $$;
--##
-- session_notes scoped via appointments.org_id.
alter table session_notes enable row level security;
--##
alter table session_notes force row level security;
--##
drop policy if exists org_isolation on session_notes;
--##
create policy org_isolation on session_notes using (app_is_super() or exists (select 1 from appointments a where a.id = session_notes.appointment_id and a.org_id = app_current_org())) with check (app_is_super() or exists (select 1 from appointments a where a.id = session_notes.appointment_id and a.org_id = app_current_org()));
--##
-- funder_contacts scoped via funders.org_id.
alter table funder_contacts enable row level security;
--##
alter table funder_contacts force row level security;
--##
drop policy if exists org_isolation on funder_contacts;
--##
create policy org_isolation on funder_contacts using (app_is_super() or exists (select 1 from funders f where f.id = funder_contacts.funder_id and f.org_id = app_current_org())) with check (app_is_super() or exists (select 1 from funders f where f.id = funder_contacts.funder_id and f.org_id = app_current_org()));
--##
-- Platform-global tables: hold cross-tenant secrets / config with no org_id, so no
-- tenant may read them. Only the platform super-admin (or the owner connection,
-- which BYPASSRLS for migrations/seed/webhooks) can. `user_presence` has no org_id
-- either and isn't on the tenant request path; deny it to tenant sessions too.
do $$
declare t text;
begin
  foreach t in array array['platform_integrations','ai_providers','user_presence','onboarding_requirements','platform_feature_flags']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists super_only on %I', t);
    execute format('create policy super_only on %I using (app_is_super()) with check (app_is_super())', t);
  end loop;
end $$;
