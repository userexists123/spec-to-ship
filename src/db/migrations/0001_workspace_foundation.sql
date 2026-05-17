create extension if not exists pgcrypto;

create table if not exists workspace (
  id uuid primary key default gen_random_uuid(),
  singleton_key text not null unique,
  org_url text not null,
  project text not null,
  default_repo text not null default '',
  epic_work_item_type text not null default 'Epic',
  issue_work_item_type text not null default 'Issue',
  default_branch text not null default 'main',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists recent_pr (
  id uuid primary key default gen_random_uuid(),
  repo_id text not null,
  repo_name text not null default '',
  pr_id integer not null,
  pr_title text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists recent_prd (
  id uuid primary key default gen_random_uuid(),
  prd_id text not null,
  title text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists recent_pr_created_at_idx on recent_pr (created_at desc);
create index if not exists recent_prd_created_at_idx on recent_prd (created_at desc);