create table if not exists prd_document (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  raw_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists backlog_draft (
  id uuid primary key default gen_random_uuid(),
  prd_document_id uuid not null references prd_document(id) on delete cascade,
  title text not null,
  status text not null default 'generated',
  draft_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists backlog_item (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references backlog_draft(id) on delete cascade,
  item_type text not null,
  external_id text not null,
  parent_external_id text not null default '',
  title text not null,
  summary text not null default '',
  priority text not null default '',
  requirement_ids jsonb not null default '[]'::jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists acceptance_criterion (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references backlog_draft(id) on delete cascade,
  story_external_id text not null,
  external_id text not null,
  text text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists risk_item (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references backlog_draft(id) on delete cascade,
  external_id text not null,
  title text not null,
  severity text not null,
  related_requirement_ids jsonb not null default '[]'::jsonb,
  mitigation_note text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists prd_document_created_at_idx on prd_document (created_at desc);
create index if not exists backlog_draft_prd_document_id_idx on backlog_draft (prd_document_id);
create index if not exists backlog_draft_created_at_idx on backlog_draft (created_at desc);
create index if not exists backlog_item_draft_id_type_idx on backlog_item (draft_id, item_type, sort_order);
create index if not exists acceptance_criterion_draft_id_idx on acceptance_criterion (draft_id, sort_order);
create index if not exists risk_item_draft_id_idx on risk_item (draft_id, sort_order);