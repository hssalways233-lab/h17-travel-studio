-- 禾十七 Travel OS：私人设备模式
-- 目标：第一次仅输入访问口令；之后手机/电脑各自长期记住，不使用邮箱、Magic Link 或手机登录码。
-- 依赖：Supabase Authentication 需开启 Anonymous Sign-Ins。

begin;

create extension if not exists pgcrypto;

-- 1) 私人工作区配置。这里只保存访问口令的 SHA-256 哈希，不保存明文。
create table if not exists public.h17_workspace_security (
  id smallint primary key default 1 check (id = 1),
  passphrase_hash text not null,
  updated_at timestamptz not null default now()
);

alter table public.h17_workspace_security enable row level security;
revoke all on public.h17_workspace_security from anon, authenticated;

insert into public.h17_workspace_security (id, passphrase_hash)
values (1, '1512fdb003fd678f7fa3847330e246609eafcd34205d89799546deca7f789dca')
on conflict (id) do update set
  passphrase_hash = excluded.passphrase_hash,
  updated_at = now();

-- 2) 记录已经通过口令授权的设备身份。
create table if not exists public.h17_workspace_devices (
  user_id uuid primary key references auth.users(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.h17_workspace_devices enable row level security;
revoke all on public.h17_workspace_devices from anon, authenticated;

-- 3) 当前设备是否已经获得工作区权限。
create or replace function public.h17_workspace_is_unlocked()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from public.h17_workspace_devices d
      where d.user_id = auth.uid()
    );
$$;

revoke all on function public.h17_workspace_is_unlocked() from public;
grant execute on function public.h17_workspace_is_unlocked() to authenticated;

-- 4) 输入正确访问口令后，把当前匿名设备加入授权设备表。
create or replace function public.h17_unlock_workspace(p_passphrase text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  expected_hash text;
  supplied_hash text;
begin
  if auth.uid() is null then
    return false;
  end if;

  select passphrase_hash into expected_hash
  from public.h17_workspace_security
  where id = 1;

  supplied_hash := encode(digest(coalesce(p_passphrase, ''), 'sha256'), 'hex');

  if supplied_hash <> expected_hash then
    return false;
  end if;

  insert into public.h17_workspace_devices(user_id, unlocked_at, last_seen_at)
  values (auth.uid(), now(), now())
  on conflict (user_id) do update set last_seen_at = now();

  return true;
end;
$$;

revoke all on function public.h17_unlock_workspace(text) from public;
grant execute on function public.h17_unlock_workspace(text) to authenticated;

-- 5) 可选：当前设备主动锁定。
create or replace function public.h17_lock_current_device()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.h17_workspace_devices where user_id = auth.uid();
$$;

revoke all on function public.h17_lock_current_device() from public;
grant execute on function public.h17_lock_current_device() to authenticated;

-- 6) 收紧业务表：不再允许未认证 anon 访问；只有“已授权设备”才能读写。
do $$
declare
  t text;
begin
  foreach t in array array['destinations','trips','materials','topics','drafts','posts','post_metrics','website_articles']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "own rows" on %I', t);
    execute format('drop policy if exists "workspace access" on %I', t);
    execute format('drop policy if exists "private workspace access" on %I', t);
    execute format(
      'create policy "private workspace access" on %I for all to authenticated using (public.h17_workspace_is_unlocked()) with check (public.h17_workspace_is_unlocked())',
      t
    );
    execute format('revoke all on %I from anon', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

-- 7) 汇总视图也按调用者权限执行，避免通过 View 绕过 RLS。
do $$
begin
  begin
    execute 'alter view public.destination_summary set (security_invoker = true)';
  exception when others then
    null;
  end;
  begin
    execute 'alter view public.post_summary set (security_invoker = true)';
  exception when others then
    null;
  end;
end $$;

revoke all on public.destination_summary from anon;
revoke all on public.post_summary from anon;
grant select on public.destination_summary to authenticated;
grant select on public.post_summary to authenticated;

-- 8) 图片 Storage 同样只允许已授权设备。
drop policy if exists "travel media select" on storage.objects;
drop policy if exists "travel media insert" on storage.objects;
drop policy if exists "travel media update" on storage.objects;
drop policy if exists "travel media delete" on storage.objects;
drop policy if exists "travel media workspace select" on storage.objects;
drop policy if exists "travel media workspace insert" on storage.objects;
drop policy if exists "travel media workspace update" on storage.objects;
drop policy if exists "travel media workspace delete" on storage.objects;
drop policy if exists "travel media private select" on storage.objects;
drop policy if exists "travel media private insert" on storage.objects;
drop policy if exists "travel media private update" on storage.objects;
drop policy if exists "travel media private delete" on storage.objects;

create policy "travel media private select"
on storage.objects for select to authenticated
using (bucket_id = 'travel-media' and public.h17_workspace_is_unlocked());

create policy "travel media private insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'travel-media' and public.h17_workspace_is_unlocked());

create policy "travel media private update"
on storage.objects for update to authenticated
using (bucket_id = 'travel-media' and public.h17_workspace_is_unlocked())
with check (bucket_id = 'travel-media' and public.h17_workspace_is_unlocked());

create policy "travel media private delete"
on storage.objects for delete to authenticated
using (bucket_id = 'travel-media' and public.h17_workspace_is_unlocked());

commit;
