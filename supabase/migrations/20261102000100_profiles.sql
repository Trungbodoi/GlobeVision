-- Hồ sơ người dùng và vai trò (giáo viên / học sinh).
--
-- Vai trò để trống khi tạo tài khoản; người dùng chọn đúng một lần qua
-- hàm choose_role. Không ai đổi được vai trò trực tiếp từ trình duyệt.

create type public.user_role as enum ('teacher', 'student');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 80),
  role public.user_role,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Chỉ cấp đúng quyền cần dùng: đọc hồ sơ và sửa tên hiển thị.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Tự tạo hồ sơ khi có tài khoản mới (email hoặc Google).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  name text := left(btrim(coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    ''
  )), 80);
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(name, ''), split_part(new.email, '@', 1), 'User'));

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Chọn vai trò một lần duy nhất.
create function public.choose_role(new_role public.user_role)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.profiles;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if new_role is null then
    raise exception 'role_required' using errcode = '22023';
  end if;

  update public.profiles
  set role = new_role
  where id = auth.uid() and role is null
  returning * into result;

  if not found then
    raise exception 'role_already_chosen' using errcode = 'P0001';
  end if;

  return result;
end;
$$;

revoke execute on function public.choose_role(public.user_role) from public, anon;
grant execute on function public.choose_role(public.user_role) to authenticated;
