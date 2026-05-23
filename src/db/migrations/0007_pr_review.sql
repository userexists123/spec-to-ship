create table if not exists pr_review_run (
  id uuid primary key default gen_random_uuid(),
  repo_id text not null,
  repo_name text not null default '',
  pr_id integer not null,
  pr_title text not null default '',
  pr_status text not null default '',
  pr_author text not null default '',
  source_branch text not null default '',
  target_branch text not null default '',
  pr_url text not null default '',
  review_status text not null default 'generated',
  summary text not null default '',
  linked_work_item_ids jsonb not null default '[]'::jsonb,
  changed_files jsonb not null default '[]'::jsonb,
  comment_preview text,
  comment_posted boolean not null default false,
  comment_thread_id integer,
  comment_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists review_assessment (
  id uuid primary key default gen_random_uuid(),
  review_run_id uuid not null references pr_review_run(id) on delete cascade,
  work_item_id integer,
  work_item_title text not null default '',
  local_backlog_item_id text not null default '',
  acceptance_criterion_id text not null,
  acceptance_criterion_text text not null,
  status text not null,
  evidence jsonb not null default '[]'::jsonb,
  missing_evidence jsonb not null default '[]'::jsonb,
  rationale text not null default '',
  confidence text not null default 'Low',
  requirement_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint review_assessment_status_check check (
    status in ('met', 'partial', 'not_evident', 'not_applicable')
  ),
  constraint review_assessment_confidence_check check (
    confidence in ('High', 'Medium', 'Low')
  )
);

create table if not exists comment_posting (
  id uuid primary key default gen_random_uuid(),
  review_run_id uuid not null references pr_review_run(id) on delete cascade,
  repo_id text not null,
  pr_id integer not null,
  comment_body text not null,
  thread_id integer not null,
  thread_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists pr_review_run_repo_pr_idx on pr_review_run (repo_id, pr_id, created_at desc);
create index if not exists pr_review_run_created_idx on pr_review_run (created_at desc);
create index if not exists review_assessment_run_idx on review_assessment (review_run_id);
create index if not exists review_assessment_status_idx on review_assessment (status);
create index if not exists comment_posting_run_idx on comment_posting (review_run_id);
create unique index if not exists comment_posting_review_run_unique_idx on comment_posting (review_run_id);