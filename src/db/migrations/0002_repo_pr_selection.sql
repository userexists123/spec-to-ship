alter table workspace
  add column if not exists selected_repo_id text not null default '',
  add column if not exists selected_repo_name text not null default '',
  add column if not exists last_pr_id integer,
  add column if not exists last_pr_title text not null default '';

create index if not exists workspace_selected_repo_id_idx on workspace (selected_repo_id);
create index if not exists recent_pr_repo_id_created_at_idx on recent_pr (repo_id, created_at desc);