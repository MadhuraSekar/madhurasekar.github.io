-- =============================================================================
-- Muteform Platform Schema
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Workspaces
create table workspaces (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null default 'My Workspace',
  created_at timestamptz default now()
);

-- Profiles (one per auth user)
create table profiles (
  id           uuid        primary key references auth.users(id) on delete cascade,
  workspace_id uuid        references workspaces(id) on delete cascade not null,
  email        text,
  display_name text,
  created_at   timestamptz default now()
);

-- Rulesets
create table rulesets (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        references workspaces(id) on delete cascade not null,
  name         text        not null default 'Untitled Ruleset',
  tokens       jsonb       default '{}',
  typography   jsonb       default '{}',
  components   jsonb       default '{}',
  layout       jsonb       default '{}',
  custom_rules jsonb       default '[]',
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Artifacts (imported design files)
create table artifacts (
  id            uuid        primary key default gen_random_uuid(),
  workspace_id  uuid        references workspaces(id) on delete cascade not null,
  name          text,
  source        text,
  artifact_json jsonb       not null,
  created_at    timestamptz default now()
);

-- Scans (audit runs)
create table scans (
  id              uuid        primary key default gen_random_uuid(),
  workspace_id    uuid        references workspaces(id) on delete cascade not null,
  artifact_id     uuid        references artifacts(id) on delete set null,
  ruleset_id      uuid        references rulesets(id) on delete set null,
  artifact_name   text,
  ruleset_name    text,
  health_score    integer     default 100,
  violation_count integer     default 0,
  high_count      integer     default 0,
  medium_count    integer     default 0,
  low_count       integer     default 0,
  created_at      timestamptz default now()
);

-- Violations (individual issues found by a scan)
create table violations (
  id                uuid        primary key default gen_random_uuid(),
  scan_id           uuid        references scans(id) on delete cascade not null,
  workspace_id      uuid        references workspaces(id) on delete cascade not null,
  type              text        not null
                      check (type in (
                        'color_token_violation',
                        'spacing_violation',
                        'typography_violation',
                        'component_violation',
                        'layout_violation'
                      )),
  severity          text        not null
                      check (severity in ('high', 'medium', 'low')),
  node_id           text,
  node_name         text,
  node_path         text,
  message           text        not null,
  confidence        text        default 'medium',
  preview_type      text,
  current_preview   jsonb,
  suggested_preview jsonb,
  suggested_fix     jsonb,
  status            text        default 'open'
                      check (status in ('open', 'ignored', 'fixed')),
  created_at        timestamptz default now()
);

-- MCP tokens (machine credentials scoped to a workspace + ruleset)
create table mcp_tokens (
  id           uuid        primary key default gen_random_uuid(),
  workspace_id uuid        references workspaces(id) on delete cascade not null,
  ruleset_id   uuid        references rulesets(id) on delete cascade not null,
  token        text        unique not null,
  name         text        default 'Default Token',
  last_used_at timestamptz,
  created_at   timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index idx_profiles_workspace_id on profiles (workspace_id);
create index idx_scans_workspace_created on scans (workspace_id, created_at desc);
create index idx_violations_scan_id on violations (scan_id);
create index idx_mcp_tokens_token on mcp_tokens (token);

-- ---------------------------------------------------------------------------
-- Helper function: resolve the current user's workspace
-- ---------------------------------------------------------------------------

create or replace function get_user_workspace_id()
returns uuid as $$
  select workspace_id from profiles where id = auth.uid()
$$ language sql security definer stable;

-- ---------------------------------------------------------------------------
-- Trigger: auto-update updated_at on rulesets
-- ---------------------------------------------------------------------------

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_rulesets_updated_at
  before update on rulesets
  for each row execute function update_updated_at();

-- ---------------------------------------------------------------------------
-- Trigger: auto-create workspace + profile on new user signup
-- ---------------------------------------------------------------------------

create or replace function handle_new_user()
returns trigger as $$
declare
  new_workspace_id uuid;
begin
  insert into workspaces (name) values ('My Workspace') returning id into new_workspace_id;
  insert into profiles (id, workspace_id, email) values (new.id, new_workspace_id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

-- Enable RLS on every table
alter table workspaces  enable row level security;
alter table profiles    enable row level security;
alter table rulesets    enable row level security;
alter table artifacts   enable row level security;
alter table scans       enable row level security;
alter table violations  enable row level security;
alter table mcp_tokens  enable row level security;

-- Workspaces: select/update own workspace only
create policy "Users can view their own workspace"
  on workspaces for select
  using (id = get_user_workspace_id());

create policy "Users can update their own workspace"
  on workspaces for update
  using (id = get_user_workspace_id());

-- Profiles: select/update own profile only
create policy "Users can view their own profile"
  on profiles for select
  using (id = auth.uid());

create policy "Users can update their own profile"
  on profiles for update
  using (id = auth.uid());

-- Rulesets: full CRUD scoped to workspace
create policy "Users can view rulesets in their workspace"
  on rulesets for select
  using (workspace_id = get_user_workspace_id());

create policy "Users can insert rulesets in their workspace"
  on rulesets for insert
  with check (workspace_id = get_user_workspace_id());

create policy "Users can update rulesets in their workspace"
  on rulesets for update
  using (workspace_id = get_user_workspace_id());

create policy "Users can delete rulesets in their workspace"
  on rulesets for delete
  using (workspace_id = get_user_workspace_id());

-- Artifacts: full CRUD scoped to workspace
create policy "Users can view artifacts in their workspace"
  on artifacts for select
  using (workspace_id = get_user_workspace_id());

create policy "Users can insert artifacts in their workspace"
  on artifacts for insert
  with check (workspace_id = get_user_workspace_id());

create policy "Users can update artifacts in their workspace"
  on artifacts for update
  using (workspace_id = get_user_workspace_id());

create policy "Users can delete artifacts in their workspace"
  on artifacts for delete
  using (workspace_id = get_user_workspace_id());

-- Scans: full CRUD scoped to workspace
create policy "Users can view scans in their workspace"
  on scans for select
  using (workspace_id = get_user_workspace_id());

create policy "Users can insert scans in their workspace"
  on scans for insert
  with check (workspace_id = get_user_workspace_id());

create policy "Users can update scans in their workspace"
  on scans for update
  using (workspace_id = get_user_workspace_id());

create policy "Users can delete scans in their workspace"
  on scans for delete
  using (workspace_id = get_user_workspace_id());

-- Violations: select/update scoped to workspace
create policy "Users can view violations in their workspace"
  on violations for select
  using (workspace_id = get_user_workspace_id());

create policy "Users can update violations in their workspace"
  on violations for update
  using (workspace_id = get_user_workspace_id());

-- MCP tokens: full CRUD scoped to workspace
create policy "Users can view tokens in their workspace"
  on mcp_tokens for select
  using (workspace_id = get_user_workspace_id());

create policy "Users can insert tokens in their workspace"
  on mcp_tokens for insert
  with check (workspace_id = get_user_workspace_id());

create policy "Users can update tokens in their workspace"
  on mcp_tokens for update
  using (workspace_id = get_user_workspace_id());

create policy "Users can delete tokens in their workspace"
  on mcp_tokens for delete
  using (workspace_id = get_user_workspace_id());
