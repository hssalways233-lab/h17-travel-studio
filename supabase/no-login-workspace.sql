-- 禾十七 Travel OS：单人共享工作区 / 无登录模式
-- 目标：手机、电脑直接打开同一网址即可读写同一套数据，不再要求邮箱、Magic Link 或手机登录码。
-- 注意：这会把后台改成“知道网址即可访问”的个人工作区。不要把这个后台网址公开传播；未来公开独立站应使用单独域名/前台。

begin;

-- 1) 继续沿用现有第一个 Supabase 用户作为历史数据 owner。
--    新增数据在未登录情况下也自动归到这个 owner，避免改动现有表结构和历史数据。
do $$
declare
  owner_id uuid;
  t text;
begin
  select id into owner_id from auth.users order by created_at asc limit 1;
  if owner_id is null then
    raise exception 'No existing auth user found. Please keep one existing Supabase user before enabling no-login workspace mode.';
  end if;

  foreach t in array array['destinations','trips','materials','topics','drafts','posts','post_metrics','website_articles']
  loop
    execute format('alter table %I alter column user_id set default %L::uuid', t, owner_id::text);
  end loop;
end $$;

-- 2) 后台数据改为共享工作区：anon / authenticated 都可以读写同一套内容。
do $$
declare
  t text;
begin
  foreach t in array array['destinations','trips','materials','topics','drafts','posts','post_metrics','website_articles']
  loop
    execute format('drop policy if exists "own rows" on %I', t);
    execute format('drop policy if exists "workspace access" on %I', t);
    execute format('create policy "workspace access" on %I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- 3) Storage 同样改为共享工作区。Bucket 仍保持 private，页面通过 signed URL 展示图片。
drop policy if exists "travel media select" on storage.objects;
drop policy if exists "travel media insert" on storage.objects;
drop policy if exists "travel media update" on storage.objects;
drop policy if exists "travel media delete" on storage.objects;

drop policy if exists "travel media workspace select" on storage.objects;
drop policy if exists "travel media workspace insert" on storage.objects;
drop policy if exists "travel media workspace update" on storage.objects;
drop policy if exists "travel media workspace delete" on storage.objects;

create policy "travel media workspace select" on storage.objects for select to anon, authenticated
using (bucket_id='travel-media');

create policy "travel media workspace insert" on storage.objects for insert to anon, authenticated
with check (bucket_id='travel-media');

create policy "travel media workspace update" on storage.objects for update to anon, authenticated
using (bucket_id='travel-media') with check (bucket_id='travel-media');

create policy "travel media workspace delete" on storage.objects for delete to anon, authenticated
using (bucket_id='travel-media');

-- 4) 明确给前端角色基础权限（Supabase 一般已有，这里保证无登录模式可用）。
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant select on destination_summary, post_summary to anon, authenticated;

commit;
