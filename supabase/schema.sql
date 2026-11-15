-- ─────────────────────────────────────────────────────────────────────────────
-- Yanzx AI — optional persistence schema.
-- Run this once in the Supabase SQL editor (or as a migration) to enable
-- cloud-saved projects. The app works without it (localStorage fallback).
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

create table if not exists public.yanzx_projects (
  id          uuid primary key default gen_random_uuid(),
  title       text        not null default 'Untitled project',
  prompt      text,
  files       jsonb       not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists yanzx_projects_updated_at_idx
  on public.yanzx_projects (updated_at desc);

-- The app talks to this table with the service-role key from a server route
-- handler, so row level security stays on with no public policies: the anon
-- key can read nothing.
alter table public.yanzx_projects enable row level security;

-- Keep updated_at honest even for manual edits.
create or replace function public.yanzx_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists yanzx_projects_touch on public.yanzx_projects;
create trigger yanzx_projects_touch
  before update on public.yanzx_projects
  for each row execute function public.yanzx_touch_updated_at();
