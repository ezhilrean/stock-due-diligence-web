-- Stock Due Diligence Web: Supabase schema
-- Run in Supabase Dashboard > SQL Editor. Safe to run once in a new project.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table if not exists public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null check (length(ticker) between 1 and 12),
  name text not null,
  sector text not null default 'Other',
  price numeric(18,4) not null default 0,
  daily_change numeric(10,4) not null default 0,
  pe_ratio numeric(12,4) not null default 0,
  revenue_growth numeric(10,4) not null default 0,
  quality_score integer not null default 0 check (quality_score between 0 and 100),
  created_at timestamptz not null default now(),
  unique (user_id, ticker)
);
create index if not exists watchlist_user_idx on public.watchlist(user_id);

create table if not exists public.dcf_models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  model_key text not null default 'default',
  assumptions jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, model_key)
);
create index if not exists dcf_models_user_idx on public.dcf_models(user_id);

create table if not exists public.checklist_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_key text not null,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, task_key)
);
create index if not exists checklist_user_idx on public.checklist_progress(user_id);

create table if not exists public.research_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  document_type text not null default 'note' check (document_type in ('note','report','thesis','risk')),
  title text not null check (length(title) between 1 and 160),
  content text not null check (length(content) <= 50000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists research_documents_user_updated_idx on public.research_documents(user_id, updated_at desc);

alter table public.profiles enable row level security;
alter table public.watchlist enable row level security;
alter table public.dcf_models enable row level security;
alter table public.checklist_progress enable row level security;
alter table public.research_documents enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "Users manage own watchlist" on public.watchlist;
create policy "Users manage own watchlist" on public.watchlist for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users manage own DCF models" on public.dcf_models;
create policy "Users manage own DCF models" on public.dcf_models for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users manage own checklist" on public.checklist_progress;
create policy "Users manage own checklist" on public.checklist_progress for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users manage own research documents" on public.research_documents;
create policy "Users manage own research documents" on public.research_documents for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.watchlist to authenticated;
grant select, insert, update, delete on public.dcf_models to authenticated;
grant select, insert, update, delete on public.checklist_progress to authenticated;
grant select, insert, update, delete on public.research_documents to authenticated;
