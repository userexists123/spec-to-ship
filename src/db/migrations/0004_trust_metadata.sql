alter table backlog_draft
  add column if not exists ambiguity_warnings jsonb not null default '[]'::jsonb;

alter table backlog_item
  add column if not exists evidence_label text not null default 'inferred',
  add column if not exists confidence text not null default 'Medium',
  add column if not exists rationale text not null default '',
  add column if not exists warnings jsonb not null default '[]'::jsonb;

alter table acceptance_criterion
  add column if not exists evidence_label text not null default 'inferred',
  add column if not exists confidence text not null default 'Medium',
  add column if not exists rationale text not null default '',
  add column if not exists warnings jsonb not null default '[]'::jsonb;

alter table risk_item
  add column if not exists evidence_label text not null default 'inferred',
  add column if not exists confidence text not null default 'Medium',
  add column if not exists rationale text not null default '',
  add column if not exists warnings jsonb not null default '[]'::jsonb;

create index if not exists backlog_item_confidence_idx on backlog_item (draft_id, confidence);
create index if not exists acceptance_criterion_confidence_idx on acceptance_criterion (draft_id, confidence);
create index if not exists risk_item_confidence_idx on risk_item (draft_id, confidence);