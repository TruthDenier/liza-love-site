
alter table public.moments
    add column if not exists created_by text,
    add column if not exists edited_by text,
    add column if not exists edited_at timestamptz,
    add column if not exists photo_url text,
    add column if not exists photo_path text;


create table if not exists public.members (
    name text primary key,
    pin_hash text not null,
    created_at timestamptz not null default now()
);


alter table public.members enable row level security;

revoke all on public.members from anon, authenticated;


create or replace function public.member_register(p_name text, p_hash text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_name text := btrim(p_name);
begin
    if length(v_name) < 2 or length(v_name) > 24 then
        raise exception 'bad_name';
    end if;

    if exists (select 1 from public.members where lower(name) = lower(v_name)) then
        raise exception 'name_taken';
    end if;

    insert into public.members (name, pin_hash) values (v_name, p_hash);
    return v_name;
end;
$$;

create or replace function public.member_login(p_name text, p_hash text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    v_name text;
begin
    select name into v_name
    from public.members
    where lower(name) = lower(btrim(p_name)) and pin_hash = p_hash;

    return v_name;
end;
$$;

grant execute on function public.member_register(text, text) to anon, authenticated;
grant execute on function public.member_login(text, text) to anon, authenticated;


insert into storage.buckets (id, name, public)
values ('moments', 'moments', true)
on conflict (id) do update set public = true;

drop policy if exists "moments photos read" on storage.objects;
drop policy if exists "moments photos write" on storage.objects;
drop policy if exists "moments photos remove" on storage.objects;

create policy "moments photos read" on storage.objects
    for select to anon, authenticated
    using (bucket_id = 'moments');

create policy "moments photos write" on storage.objects
    for insert to anon, authenticated
    with check (bucket_id = 'moments');

create policy "moments photos remove" on storage.objects
    for delete to anon, authenticated
    using (bucket_id = 'moments');


grant select, insert, update, delete on public.moments to anon, authenticated;

drop policy if exists "moments update" on public.moments;

create policy "moments update" on public.moments
    for update to anon, authenticated
    using (true)
    with check (true);


insert into public.moments (id, emoji, date, title, note, is_key)
values ('seed-1', '💌', '2026-09-12', 'Мы познакомились',
        '13:34. Точка отсчёта. С этого момента всё и началось.', true)
on conflict (id) do nothing;
