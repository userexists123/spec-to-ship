create table if not exists traceability_snapshot (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text not null default '',
  customer_release_notes text not null default '',
  internal_release_notes text not null default '',
  snapshot_json jsonb not null,
  source_counts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists traceability_snapshot_created_idx
  on traceability_snapshot (created_at desc);