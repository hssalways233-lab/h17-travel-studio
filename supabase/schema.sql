-- 禾十七 Travel Content Studio / Supabase schema
create extension if not exists "uuid-ossp";

do $$ begin
  create type topic_status as enum ('idea','doing','ready','done');
exception when duplicate_object then null;
end $$;

create table if not exists destinations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  region text,
  cover_url text,
  created_at timestamptz not null default now()
);

create table if not exists trips (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  destination_id uuid references destinations(id) on delete set null,
  title text not null,
  started_at date,
  ended_at date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists materials (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid references trips(id) on delete cascade,
  destination_id uuid references destinations(id) on delete set null,
  storage_path text not null,
  media_type text not null default 'image',
  tags text[] not null default '{}',
  caption text,
  created_at timestamptz not null default now()
);

create table if not exists topics (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  destination text not null default '未分类',
  content_type text not null default '路线型',
  status topic_status not null default 'idea',
  planned_at timestamptz,
  xhs_url text,
  created_at timestamptz not null default now()
);

create table if not exists drafts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid references topics(id) on delete set null,
  title text not null,
  cover_title text,
  cover_subtitle text,
  route text,
  body text,
  xhs_url text,
  xhs_note_id text,
  version int not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists posts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic_id uuid references topics(id) on delete set null,
  title text not null,
  destination text not null default '未分类',
  platform text not null default 'xiaohongshu',
  xhs_url text,
  xhs_note_id text,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists post_metrics (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,
  snapshot_at timestamptz not null default now(),
  views int not null default 0,
  likes int not null default 0,
  saves int not null default 0,
  comments int not null default 0,
  shares int not null default 0,
  follows int not null default 0
);

create table if not exists website_articles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_post_id uuid references posts(id) on delete set null,
  title text not null,
  status text not null default 'candidate',
  body text,
  created_at timestamptz not null default now()
);

alter table destinations enable row level security;
alter table trips enable row level security;
alter table materials enable row level security;
alter table topics enable row level security;
alter table drafts enable row level security;
alter table posts enable row level security;
alter table post_metrics enable row level security;
alter table website_articles enable row level security;

do $$
declare t text;
begin
  foreach t in array array['destinations','trips','materials','topics','drafts','posts','post_metrics','website_articles']
  loop
    execute format('drop policy if exists "own rows" on %I',t);
    execute format('create policy "own rows" on %I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',t);
  end loop;
end $$;

insert into storage.buckets (id,name,public)
values ('travel-media','travel-media',false)
on conflict (id) do nothing;

drop policy if exists "travel media select" on storage.objects;
drop policy if exists "travel media insert" on storage.objects;
drop policy if exists "travel media update" on storage.objects;
drop policy if exists "travel media delete" on storage.objects;

create policy "travel media select" on storage.objects for select
using (bucket_id='travel-media' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "travel media insert" on storage.objects for insert
with check (bucket_id='travel-media' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "travel media update" on storage.objects for update
using (bucket_id='travel-media' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "travel media delete" on storage.objects for delete
using (bucket_id='travel-media' and (storage.foldername(name))[1]=auth.uid()::text);

create or replace view destination_summary with (security_invoker = true) as
select d.id,d.user_id,d.name,d.region,d.cover_url,
  count(distinct tr.id)::int as trip_count,
  count(distinct m.id)::int as material_count,
  count(distinct p.id)::int as published_count,
  count(distinct t.id) filter (where t.status <> 'done')::int as idea_count
from destinations d
left join trips tr on tr.destination_id=d.id
left join materials m on m.destination_id=d.id
left join posts p on p.user_id=d.user_id and p.destination=d.name
left join topics t on t.user_id=d.user_id and t.destination=d.name
group by d.id;

create or replace view post_summary with (security_invoker = true) as
select distinct on (p.id)
  p.id,p.user_id,p.title,p.destination,p.xhs_url,p.published_at,
  coalesce(pm.views,0)::int views, coalesce(pm.likes,0)::int likes,
  coalesce(pm.saves,0)::int saves, coalesce(pm.comments,0)::int comments,
  coalesce(pm.follows,0)::int follows
from posts p
left join post_metrics pm on pm.post_id=p.id
order by p.id,pm.snapshot_at desc nulls last;

do $$ begin
  alter publication supabase_realtime add table topics;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table posts;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table post_metrics;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table drafts;
exception when duplicate_object then null;
end $$;
