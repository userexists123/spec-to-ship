alter table backlog_draft
  add column if not exists preview_json jsonb,
  add column if not exists execution_json jsonb,
  add column if not exists last_previewed_at timestamptz,
  add column if not exists last_executed_at timestamptz;

alter table backlog_item
  add column if not exists is_deleted boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table acceptance_criterion
  add column if not exists is_deleted boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table risk_item
  add column if not exists is_deleted boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists work_item_mapping (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references backlog_draft(id) on delete cascade,
  run_id text not null,
  local_id text not null,
  work_item_type text not null,
  ado_work_item_id integer not null,
  ado_url text not null,
  parent_local_id text,
  parent_ado_work_item_id integer,
  requirement_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists work_item_mapping_draft_id_idx on work_item_mapping (draft_id, created_at desc);
create index if not exists work_item_mapping_ado_work_item_id_idx on work_item_mapping (ado_work_item_id);
create unique index if not exists work_item_mapping_draft_run_local_idx on work_item_mapping (draft_id, run_id, local_id);