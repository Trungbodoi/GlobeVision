-- Lớp học, giao bài có hạn nộp và bảng điểm.
--
-- Giáo viên chỉ thấy lớp của mình; học sinh chỉ thấy lớp đã tham gia.
-- Mọi thao tác ghi đi qua các hàm bên dưới, không ghi trực tiếp vào bảng.

create schema if not exists private;
revoke all on schema private from public;

-- Giữ logic chấm cũ; bản public mới kiểm tra thêm hạn nộp.
alter function public.submit_quiz(uuid, jsonb) set schema private;

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  join_code text not null unique,
  created_at timestamptz not null default now()
);

create index classes_teacher_idx on public.classes (teacher_id);

create table public.class_members (
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

create index class_members_student_idx on public.class_members (student_id);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  region text,
  kinds text[] not null,
  question_count integer not null check (question_count between 1 and 20),
  max_attempts integer not null check (max_attempts between 1 and 10),
  due_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index assignments_class_idx on public.assignments (class_id, due_at);

-- Đếm số lần bắt đầu, kể cả lượt bỏ dở, để không thể xem đề rồi làm lại.
create table public.assignment_starts (
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  started integer not null default 0,
  primary key (assignment_id, student_id)
);

alter table public.quiz_attempts
  add column assignment_id uuid references public.assignments (id) on delete set null;

create index quiz_attempts_assignment_idx on public.quiz_attempts (assignment_id, user_id);

alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_starts enable row level security;

revoke all on public.classes, public.class_members, public.assignments, public.assignment_starts
  from anon, authenticated;
grant select on public.classes, public.class_members, public.assignments to authenticated;

create function public.is_class_teacher(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.classes where id = p_class_id and teacher_id = auth.uid()
  );
$$;

create function public.is_class_member(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.class_members where class_id = p_class_id and student_id = auth.uid()
  );
$$;

revoke execute on function public.is_class_teacher(uuid) from public, anon;
revoke execute on function public.is_class_member(uuid) from public, anon;
grant execute on function public.is_class_teacher(uuid) to authenticated;
grant execute on function public.is_class_member(uuid) to authenticated;

create policy "classes_select"
  on public.classes for select to authenticated
  using (teacher_id = auth.uid() or public.is_class_member(id));

create policy "class_members_select"
  on public.class_members for select to authenticated
  using (student_id = auth.uid() or public.is_class_teacher(class_id));

create policy "assignments_select"
  on public.assignments for select to authenticated
  using (public.is_class_teacher(class_id) or public.is_class_member(class_id));

create function private.require_role(required public.user_role)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  if not exists (select 1 from public.profiles where id = uid and role = required) then
    raise exception 'wrong_role' using errcode = '42501';
  end if;

  return uid;
end;
$$;

create function private.require_class_teacher(p_class_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_role('teacher');

  if not public.is_class_teacher(p_class_id) then
    raise exception 'class_not_found' using errcode = 'P0002';
  end if;
end;
$$;

create function public.create_class(p_name text)
returns public.classes
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_role('teacher');
  result public.classes;
begin
  insert into public.classes (teacher_id, name, join_code)
  values (
    uid,
    btrim(p_name),
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  )
  returning * into result;

  return result;
end;
$$;

create function public.delete_class(p_class_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_class_teacher(p_class_id);

  delete from public.classes where id = p_class_id;
end;
$$;

create function public.join_class(p_code text)
returns public.classes
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_role('student');
  result public.classes;
begin
  select * into result from public.classes where join_code = upper(btrim(p_code));

  if not found then
    raise exception 'invalid_code' using errcode = 'P0002';
  end if;

  insert into public.class_members (class_id, student_id)
  values (result.id, uid)
  on conflict do nothing;

  return result;
end;
$$;

create function public.leave_class(p_class_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.class_members
  where class_id = p_class_id and student_id = private.require_role('student');
end;
$$;

create function public.remove_student(p_class_id uuid, p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_class_teacher(p_class_id);

  delete from public.class_members where class_id = p_class_id and student_id = p_student_id;
end;
$$;

create function public.class_roster(p_class_id uuid)
returns table (student_id uuid, display_name text, joined_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_class_teacher(p_class_id);

  return query
    select m.student_id, p.display_name, m.joined_at
    from public.class_members m
    join public.profiles p on p.id = m.student_id
    where m.class_id = p_class_id
    order by p.display_name;
end;
$$;

create function public.create_assignment(
  p_class_id uuid,
  p_title text,
  p_region text,
  p_kinds text[],
  p_count integer,
  p_max_attempts integer,
  p_due_at timestamptz
)
returns public.assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.assignments;
begin
  perform private.require_class_teacher(p_class_id);

  if p_due_at <= now() then
    raise exception 'due_in_past' using errcode = '22023';
  end if;

  if coalesce(array_length(p_kinds, 1), 0) = 0
    or not p_kinds <@ array['locate', 'flag', 'capital'] then
    raise exception 'kinds_required' using errcode = '22023';
  end if;

  if p_region is not null
    and not exists (select 1 from public.quiz_countries where region = p_region) then
    raise exception 'invalid_region' using errcode = '22023';
  end if;

  insert into public.assignments (class_id, title, region, kinds, question_count, max_attempts, due_at)
  values (p_class_id, btrim(p_title), p_region, p_kinds, p_count, p_max_attempts, p_due_at)
  returning * into result;

  return result;
end;
$$;

create function public.delete_assignment(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_class uuid;
begin
  select class_id into target_class from public.assignments where id = p_assignment_id;

  if not found then
    raise exception 'assignment_not_found' using errcode = 'P0002';
  end if;

  perform private.require_class_teacher(target_class);

  delete from public.assignments where id = p_assignment_id;
end;
$$;

create function public.start_assignment(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_role('student');
  target public.assignments;
  used integer;
  quiz jsonb;
begin
  select * into target from public.assignments where id = p_assignment_id;

  if not found or not exists (
    select 1 from public.class_members where class_id = target.class_id and student_id = uid
  ) then
    raise exception 'assignment_not_found' using errcode = 'P0002';
  end if;

  if now() > target.due_at then
    raise exception 'past_due' using errcode = 'P0001';
  end if;

  insert into public.assignment_starts (assignment_id, student_id)
  values (p_assignment_id, uid)
  on conflict do nothing;

  select started into used
  from public.assignment_starts
  where assignment_id = p_assignment_id and student_id = uid
  for update;

  if used >= target.max_attempts then
    raise exception 'no_attempts_left' using errcode = 'P0001';
  end if;

  update public.assignment_starts
  set started = used + 1
  where assignment_id = p_assignment_id and student_id = uid;

  quiz := public.start_quiz(target.region, target.kinds, target.question_count);

  update public.quiz_attempts
  set assignment_id = p_assignment_id
  where id = (quiz ->> 'attempt_id')::uuid;

  return quiz;
end;
$$;

-- Cho phép 5 phút sau hạn để bài làm đang dở kịp gửi lên.
create function public.submit_quiz(p_attempt_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.quiz_attempts q
    join public.assignments a on a.id = q.assignment_id
    where q.id = p_attempt_id
      and q.user_id = auth.uid()
      and now() > a.due_at + interval '5 minutes'
  ) then
    raise exception 'past_due' using errcode = 'P0001';
  end if;

  return private.submit_quiz(p_attempt_id, p_answers);
end;
$$;

create function public.my_assignments()
returns table (
  id uuid,
  class_id uuid,
  class_name text,
  title text,
  region text,
  question_count integer,
  max_attempts integer,
  due_at timestamptz,
  started integer,
  best_score integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_role('student');
begin
  return query
    select a.id, a.class_id, c.name, a.title, a.region, a.question_count, a.max_attempts, a.due_at,
      coalesce(s.started, 0),
      (
        select max(q.score)::integer
        from public.quiz_attempts q
        where q.assignment_id = a.id and q.user_id = uid and q.submitted_at is not null
      )
    from public.assignments a
    join public.classes c on c.id = a.class_id
    join public.class_members m on m.class_id = a.class_id and m.student_id = uid
    left join public.assignment_starts s on s.assignment_id = a.id and s.student_id = uid
    order by a.due_at;
end;
$$;

create function public.gradebook(p_assignment_id uuid)
returns table (
  student_id uuid,
  display_name text,
  started integer,
  submitted integer,
  best_score integer,
  total integer,
  last_submitted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target public.assignments;
begin
  select * into target from public.assignments a where a.id = p_assignment_id;

  if not found then
    raise exception 'assignment_not_found' using errcode = 'P0002';
  end if;

  perform private.require_class_teacher(target.class_id);

  return query
    select m.student_id, p.display_name,
      coalesce(s.started, 0),
      count(q.id)::integer,
      max(q.score)::integer,
      max(q.question_count)::integer,
      max(q.submitted_at)
    from public.class_members m
    join public.profiles p on p.id = m.student_id
    left join public.assignment_starts s
      on s.assignment_id = p_assignment_id and s.student_id = m.student_id
    left join public.quiz_attempts q
      on q.assignment_id = p_assignment_id
      and q.user_id = m.student_id
      and q.submitted_at is not null
    where m.class_id = target.class_id
    group by m.student_id, p.display_name, s.started
    order by p.display_name;
end;
$$;

revoke execute on function public.create_class(text) from public, anon;
revoke execute on function public.delete_class(uuid) from public, anon;
revoke execute on function public.join_class(text) from public, anon;
revoke execute on function public.leave_class(uuid) from public, anon;
revoke execute on function public.remove_student(uuid, uuid) from public, anon;
revoke execute on function public.class_roster(uuid) from public, anon;
revoke execute on function public.create_assignment(uuid, text, text, text[], integer, integer, timestamptz) from public, anon;
revoke execute on function public.delete_assignment(uuid) from public, anon;
revoke execute on function public.start_assignment(uuid) from public, anon;
revoke execute on function public.submit_quiz(uuid, jsonb) from public, anon;
revoke execute on function public.my_assignments() from public, anon;
revoke execute on function public.gradebook(uuid) from public, anon;

grant execute on function public.create_class(text) to authenticated;
grant execute on function public.delete_class(uuid) to authenticated;
grant execute on function public.join_class(text) to authenticated;
grant execute on function public.leave_class(uuid) to authenticated;
grant execute on function public.remove_student(uuid, uuid) to authenticated;
grant execute on function public.class_roster(uuid) to authenticated;
grant execute on function public.create_assignment(uuid, text, text, text[], integer, integer, timestamptz) to authenticated;
grant execute on function public.delete_assignment(uuid) to authenticated;
grant execute on function public.start_assignment(uuid) to authenticated;
grant execute on function public.submit_quiz(uuid, jsonb) to authenticated;
grant execute on function public.my_assignments() to authenticated;
grant execute on function public.gradebook(uuid) to authenticated;
