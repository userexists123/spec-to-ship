create extension if not exists vector;

alter table backlog_draft
  add column if not exists retrieved_context_json jsonb not null default '[]'::jsonb;

create table if not exists source_document (
  id uuid primary key default gen_random_uuid(),
  workspace_key text not null default 'single-pm-pilot',
  source_type text not null,
  title text not null,
  content text not null,
  external_url text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'indexed',
  chunk_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint source_document_source_type_check check (
    source_type in (
      'prior_prd',
      'ado_work_item',
      'accepted_backlog',
      'architecture_doc',
      'convention_doc'
    )
  )
);

create table if not exists source_chunk (
  id uuid primary key default gen_random_uuid(),
  source_document_id uuid not null references source_document(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  token_estimate integer not null default 0,
  embedding vector(1536) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_document_id, chunk_index)
);

create table if not exists draft_retrieval_source (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references backlog_draft(id) on delete cascade,
  source_document_id uuid not null references source_document(id) on delete cascade,
  source_chunk_id uuid not null references source_chunk(id) on delete cascade,
  source_type text not null,
  title text not null,
  excerpt text not null,
  similarity double precision not null,
  rank integer not null,
  created_at timestamptz not null default now()
);

create index if not exists source_document_source_type_idx on source_document (source_type, created_at desc);
create index if not exists source_chunk_document_idx on source_chunk (source_document_id, chunk_index);
create index if not exists draft_retrieval_source_draft_idx on draft_retrieval_source (draft_id, rank);

create index if not exists source_chunk_embedding_idx
  on source_chunk
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);