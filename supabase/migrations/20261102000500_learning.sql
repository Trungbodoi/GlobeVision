-- Bộ câu hỏi cố định cho mỗi bài, kho câu hỏi, thống kê, ôn tập ngắt quãng, tour.

alter table public.assignments add column published boolean not null default true;

drop policy "assignments_select" on public.assignments;
create policy "assignments_select"
  on public.assignments for select to authenticated
  using (public.is_class_teacher(class_id) or (published and public.is_class_member(class_id)));

-- Kho câu hỏi riêng của từng giáo viên.
create table public.custom_questions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('custom_choice', 'custom_locate')),
  prompt text not null check (char_length(btrim(prompt)) between 1 and 300),
  option_labels text[],
  correct_index integer,
  target_id text references public.quiz_countries (id),
  created_at timestamptz not null default now()
);
create index custom_questions_teacher_idx on public.custom_questions (teacher_id, created_at desc);
alter table public.custom_questions enable row level security;
revoke all on public.custom_questions from anon, authenticated;
grant select on public.custom_questions to authenticated;
create policy "custom_questions_select_own"
  on public.custom_questions for select to authenticated
  using (teacher_id = auth.uid());

-- Bộ câu của bài. Câu tự tạo được sao chép để sửa kho không làm đổi bài đã giao.
-- Không cấp quyền đọc trực tiếp vì chứa đáp án.
create table public.assignment_questions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  position integer not null,
  kind text not null check (kind in ('locate', 'flag', 'capital', 'custom_choice', 'custom_locate')),
  target_id text references public.quiz_countries (id),
  option_ids text[] not null default '{}',
  prompt text,
  option_labels text[],
  correct_index integer
);
create index assignment_questions_idx on public.assignment_questions (assignment_id, position);
alter table public.assignment_questions enable row level security;
revoke all on public.assignment_questions from anon, authenticated;

alter table public.quiz_questions drop constraint quiz_questions_kind_check;
alter table public.quiz_questions add constraint quiz_questions_kind_check
  check (kind in ('locate', 'flag', 'capital', 'custom_choice', 'custom_locate'));
alter table public.quiz_questions alter column target_id drop not null;
alter table public.quiz_questions
  add column assignment_question_id uuid references public.assignment_questions (id) on delete set null,
  add column prompt text,
  add column option_labels text[],
  add column correct_index integer,
  add column answer_index integer;
create index quiz_questions_aq_idx on public.quiz_questions (assignment_question_id);

-- Lịch ôn của từng học sinh: chỉ gồm những nước từng làm sai.
create table public.review_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  target_id text not null references public.quiz_countries (id) on delete cascade,
  box integer not null default 1,
  due_at timestamptz not null,
  primary key (user_id, target_id)
);
create index review_items_due_idx on public.review_items (user_id, due_at);
alter table public.review_items enable row level security;
revoke all on public.review_items from anon, authenticated;

-- Tour: chuỗi điểm dừng trên địa cầu, dành cho một lớp.
create table public.tours (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  created_at timestamptz not null default now()
);
create index tours_class_idx on public.tours (class_id, created_at);
create table public.tour_stops (
  tour_id uuid not null references public.tours (id) on delete cascade,
  position integer not null,
  country_id text not null check (char_length(country_id) between 1 and 10),
  note text not null default '' check (char_length(note) <= 1000),
  primary key (tour_id, position)
);
alter table public.tours enable row level security;
alter table public.tour_stops enable row level security;
revoke all on public.tours, public.tour_stops from anon, authenticated;
grant select on public.tours, public.tour_stops to authenticated;
create policy "tours_select"
  on public.tours for select to authenticated
  using (public.is_class_teacher(class_id) or public.is_class_member(class_id));
create policy "tour_stops_select"
  on public.tour_stops for select to authenticated
  using (exists (
    select 1 from public.tours t
    where t.id = tour_id
      and (public.is_class_teacher(t.class_id) or public.is_class_member(t.class_id))
  ));

create function private.pick_target(p_region text, p_kind text, p_used text[])
returns public.quiz_countries
language sql
volatile
security definer
set search_path = ''
as $$
  select c.* from public.quiz_countries c
  where (p_region is null or c.region = p_region)
    and c.id <> all (p_used)
    and (p_kind <> 'locate' or c.locatable)
  order by random()
  limit 1;
$$;

create function private.pick_options(p_target public.quiz_countries)
returns text[]
language sql
volatile
security definer
set search_path = ''
as $$
  select array_agg(o.id order by random())
  from (
    select p_target.id as id
    union all
    select * from (
      select c.id
      from public.quiz_countries c
      where c.id <> p_target.id and c.capital <> p_target.capital
      order by (c.region = p_target.region) desc, random()
      limit 3
    ) distractors
  ) o;
$$;

-- Đề gửi cho học sinh: không có đáp án và mã nước trong lựa chọn.
create function private.quiz_payload(p_attempt_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('attempt_id', p_attempt_id, 'questions', jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'position', q.position,
      'kind', q.kind,
      'prompt', q.prompt,
      'name_vi', case when q.kind in ('locate', 'capital') then t.name_vi end,
      'name_en', case when q.kind in ('locate', 'capital') then t.name_en end,
      'flag', case when q.kind = 'flag' then lower(t.id) end,
      'options', case
        when q.kind = 'custom_choice' then (
          select jsonb_agg(jsonb_build_object('label', l.label) order by l.ord)
          from unnest(q.option_labels) with ordinality as l (label, ord)
        )
        else (
          select coalesce(jsonb_agg(
            case when q.kind = 'capital'
              then jsonb_build_object('label', o.capital)
              else jsonb_build_object('name_vi', o.name_vi, 'name_en', o.name_en)
            end
            order by opt.ord
          ), '[]'::jsonb)
          from unnest(q.option_ids) with ordinality as opt (id, ord)
          join public.quiz_countries o on o.id = opt.id
        )
      end
    )
    order by q.position
  ))
  from public.quiz_questions q
  left join public.quiz_countries t on t.id = q.target_id
  where q.attempt_id = p_attempt_id;
$$;

-- Chấm bài và cập nhật lịch ôn. Vẫn chỉ được nộp một lần.
create or replace function private.submit_quiz(p_attempt_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  attempt public.quiz_attempts;
  final_score integer;
  review jsonb;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into attempt
  from public.quiz_attempts
  where id = p_attempt_id and user_id = uid
  for update;

  if not found then
    raise exception 'attempt_not_found' using errcode = 'P0002';
  end if;

  if attempt.submitted_at is not null then
    raise exception 'already_submitted' using errcode = 'P0001';
  end if;

  update public.quiz_questions q
  set
    answer_id = case
      when q.kind in ('locate', 'custom_locate') then a.answer ->> 'answer_id'
      when q.kind in ('flag', 'capital') then q.option_ids[(a.answer ->> 'option_index')::integer + 1]
    end,
    answer_index = case when q.kind = 'custom_choice' then (a.answer ->> 'option_index')::integer end
  from (
    select value as answer
    from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb))
  ) a
  where q.attempt_id = p_attempt_id
    and q.id = (a.answer ->> 'question_id')::uuid;

  update public.quiz_questions q
  set is_correct = case
    when q.kind = 'custom_choice' then coalesce(q.answer_index = q.correct_index, false)
    else coalesce(q.answer_id = q.target_id, false)
  end
  where q.attempt_id = p_attempt_id;

  select count(*) filter (where q.is_correct) into final_score
  from public.quiz_questions q
  where q.attempt_id = p_attempt_id;

  update public.quiz_attempts
  set score = final_score, submitted_at = now()
  where id = p_attempt_id;

  -- Sai: ôn lại sau 1 ngày. Đúng: giãn dần 3, 7, 14, 30 ngày rồi rời lịch ôn.
  insert into public.review_items as r (user_id, target_id, box, due_at)
  select uid, q.target_id, 1, now() + interval '1 day'
  from public.quiz_questions q
  where q.attempt_id = p_attempt_id and q.target_id is not null and not q.is_correct
  on conflict (user_id, target_id) do update
  set box = 1, due_at = now() + interval '1 day';

  update public.review_items r
  set
    box = r.box + 1,
    due_at = now() + make_interval(days => (array[3, 7, 14, 30])[r.box])
  from public.quiz_questions q
  where q.attempt_id = p_attempt_id
    and q.is_correct
    and q.target_id = r.target_id
    and r.user_id = uid
    and r.box < 5;

  delete from public.review_items r
  using public.quiz_questions q
  where q.attempt_id = p_attempt_id
    and q.is_correct
    and q.target_id = r.target_id
    and r.user_id = uid
    and r.box >= 5
    and r.due_at <= now();

  select jsonb_agg(
    jsonb_build_object(
      'position', q.position,
      'kind', q.kind,
      'is_correct', q.is_correct,
      'prompt', q.prompt,
      'target_id', q.target_id,
      'target_name_vi', t.name_vi,
      'target_name_en', t.name_en,
      'target_capital', t.capital,
      'answer_name_vi', a.name_vi,
      'answer_name_en', a.name_en,
      'answer_capital', a.capital,
      'correct_label', q.option_labels[q.correct_index + 1],
      'answer_label', q.option_labels[q.answer_index + 1]
    )
    order by q.position
  ) into review
  from public.quiz_questions q
  left join public.quiz_countries t on t.id = q.target_id
  left join public.quiz_countries a on a.id = q.answer_id
  where q.attempt_id = p_attempt_id;

  return jsonb_build_object('score', final_score, 'total', attempt.question_count, 'review', review);
end;
$$;

-- Tạo bản nháp kèm bộ câu tự sinh; học sinh chỉ thấy sau khi giao.
create or replace function public.create_assignment(
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
  kind_count integer := coalesce(array_length(p_kinds, 1), 0);
  used text[] := '{}';
  added integer := 0;
  tries integer := 0;
  current_kind text;
  target public.quiz_countries;
begin
  perform private.require_class_teacher(p_class_id);

  if p_due_at <= now() then
    raise exception 'due_in_past' using errcode = '22023';
  end if;

  if kind_count = 0 or not p_kinds <@ array['locate', 'flag', 'capital'] then
    raise exception 'kinds_required' using errcode = '22023';
  end if;

  if p_region is not null
    and not exists (select 1 from public.quiz_countries where region = p_region) then
    raise exception 'invalid_region' using errcode = '22023';
  end if;

  insert into public.assignments (class_id, title, region, kinds, question_count, max_attempts, due_at, published)
  values (p_class_id, btrim(p_title), p_region, p_kinds, p_count, p_max_attempts, p_due_at, false)
  returning * into result;

  while added < p_count and tries < p_count * kind_count loop
    current_kind := p_kinds[(tries % kind_count) + 1];
    tries := tries + 1;
    target := private.pick_target(p_region, current_kind, used);

    continue when target.id is null;

    added := added + 1;
    used := used || target.id;

    insert into public.assignment_questions (assignment_id, position, kind, target_id, option_ids)
    values (
      result.id, added, current_kind, target.id,
      case when current_kind = 'locate' then '{}'::text[] else private.pick_options(target) end
    );
  end loop;

  update public.assignments set question_count = added where id = result.id returning * into result;

  return result;
end;
$$;

create function private.require_assignment_teacher(p_assignment_id uuid)
returns public.assignments
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target public.assignments;
begin
  select * into target from public.assignments where id = p_assignment_id;

  if not found then
    raise exception 'assignment_not_found' using errcode = 'P0002';
  end if;

  perform private.require_class_teacher(target.class_id);

  return target;
end;
$$;

create function private.require_draft(p_assignment_id uuid)
returns public.assignments
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target public.assignments := private.require_assignment_teacher(p_assignment_id);
begin
  if target.published then
    raise exception 'already_published' using errcode = 'P0001';
  end if;

  return target;
end;
$$;

create function public.assignment_preview(p_assignment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_assignment_teacher(p_assignment_id);

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'position', q.position,
        'kind', q.kind,
        'prompt', q.prompt,
        'target_id', q.target_id,
        'name_vi', t.name_vi,
        'name_en', t.name_en,
        'capital', t.capital,
        'correct_label', q.option_labels[q.correct_index + 1],
        'option_labels', q.option_labels
      )
      order by q.position
    )
    from public.assignment_questions q
    left join public.quiz_countries t on t.id = q.target_id
    where q.assignment_id = p_assignment_id
  ), '[]'::jsonb);
end;
$$;

create function public.swap_assignment_question(p_question_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.assignment_questions;
  a public.assignments;
  used text[];
  target public.quiz_countries;
begin
  select * into q from public.assignment_questions where id = p_question_id;

  if not found then
    raise exception 'question_not_found' using errcode = 'P0002';
  end if;

  a := private.require_draft(q.assignment_id);

  if q.kind not in ('locate', 'flag', 'capital') then
    raise exception 'cannot_swap_custom' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(target_id), '{}') into used
  from public.assignment_questions
  where assignment_id = q.assignment_id and target_id is not null;

  target := private.pick_target(a.region, q.kind, used);

  if target.id is null then
    raise exception 'no_more_questions' using errcode = 'P0001';
  end if;

  update public.assignment_questions
  set target_id = target.id,
      option_ids = case when q.kind = 'locate' then '{}'::text[] else private.pick_options(target) end
  where id = p_question_id;
end;
$$;

create function public.remove_assignment_question(p_question_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.assignment_questions;
begin
  select * into q from public.assignment_questions where id = p_question_id;

  if not found then
    raise exception 'question_not_found' using errcode = 'P0002';
  end if;

  perform private.require_draft(q.assignment_id);

  delete from public.assignment_questions where id = p_question_id;

  update public.assignments
  set question_count = greatest((select count(*) from public.assignment_questions where assignment_id = q.assignment_id), 1)
  where id = q.assignment_id;
end;
$$;

create function public.add_custom_to_assignment(p_assignment_id uuid, p_custom_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.custom_questions;
  total integer;
begin
  perform private.require_draft(p_assignment_id);

  select * into c from public.custom_questions where id = p_custom_id and teacher_id = auth.uid();

  if not found then
    raise exception 'question_not_found' using errcode = 'P0002';
  end if;

  select count(*) into total from public.assignment_questions where assignment_id = p_assignment_id;

  if total >= 20 then
    raise exception 'too_many_questions' using errcode = 'P0001';
  end if;

  insert into public.assignment_questions (assignment_id, position, kind, target_id, prompt, option_labels, correct_index)
  select p_assignment_id, coalesce(max(position), 0) + 1, c.kind, c.target_id, c.prompt, c.option_labels, c.correct_index
  from public.assignment_questions where assignment_id = p_assignment_id;

  update public.assignments set question_count = total + 1 where id = p_assignment_id;
end;
$$;

create function public.publish_assignment(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.assignments := private.require_draft(p_assignment_id);
begin
  if not exists (select 1 from public.assignment_questions where assignment_id = p_assignment_id) then
    raise exception 'no_questions' using errcode = 'P0001';
  end if;

  if a.due_at <= now() then
    raise exception 'due_in_past' using errcode = '22023';
  end if;

  update public.assignments set published = true where id = p_assignment_id;
end;
$$;

create function public.update_assignment(p_assignment_id uuid, p_title text, p_max_attempts integer, p_due_at timestamptz)
returns public.assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.assignments;
begin
  perform private.require_assignment_teacher(p_assignment_id);

  if p_due_at <= now() then
    raise exception 'due_in_past' using errcode = '22023';
  end if;

  update public.assignments
  set title = btrim(p_title), max_attempts = p_max_attempts, due_at = p_due_at
  where id = p_assignment_id
  returning * into result;

  return result;
end;
$$;

-- Trả lại một lượt, ví dụ khi học sinh mất mạng giữa bài.
create function public.grant_attempt(p_assignment_id uuid, p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_assignment_teacher(p_assignment_id);

  update public.assignment_starts
  set started = greatest(started - 1, 0)
  where assignment_id = p_assignment_id and student_id = p_student_id;
end;
$$;

create function public.rotate_join_code(p_class_id uuid)
returns public.classes
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.classes;
begin
  perform private.require_class_teacher(p_class_id);

  update public.classes
  set join_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  where id = p_class_id
  returning * into result;

  return result;
end;
$$;

-- Đề của học sinh: cùng bộ câu, thứ tự câu và đáp án xáo riêng.
create or replace function public.start_assignment(p_assignment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_role('student');
  target public.assignments;
  used integer;
  new_attempt uuid;
  aq public.assignment_questions;
  pos integer := 0;
  shuffled text[];
begin
  select * into target from public.assignments where id = p_assignment_id and published;

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

  insert into public.quiz_attempts (user_id, region, question_count, assignment_id)
  values (uid, target.region, target.question_count, p_assignment_id)
  returning id into new_attempt;

  for aq in
    select * from public.assignment_questions where assignment_id = p_assignment_id order by random()
  loop
    pos := pos + 1;
    shuffled := null;

    if aq.kind = 'custom_choice' then
      select array_agg(l order by random()) into shuffled from unnest(aq.option_labels) as l;
    end if;

    insert into public.quiz_questions (
      attempt_id, position, kind, target_id, option_ids, assignment_question_id,
      prompt, option_labels, correct_index
    )
    values (
      new_attempt, pos, aq.kind, aq.target_id,
      coalesce((select array_agg(o order by random()) from unnest(aq.option_ids) as o), '{}'),
      aq.id, aq.prompt, shuffled,
      case when aq.kind = 'custom_choice'
        then array_position(shuffled, aq.option_labels[aq.correct_index + 1]) - 1
      end
    );
  end loop;

  update public.quiz_attempts set question_count = pos where id = new_attempt;

  return private.quiz_payload(new_attempt);
end;
$$;

create or replace function public.my_assignments()
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
    where a.published
    order by a.due_at;
end;
$$;

-- Tỉ lệ đúng từng câu của bài, câu khó nhất trước.
create function public.assignment_stats(p_assignment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_assignment_teacher(p_assignment_id);

  return coalesce((
    select jsonb_agg(row_to_json(s) order by s.answered = 0, s.correct::float / nullif(s.answered, 0))
    from (
      select aq.id, aq.kind, aq.prompt, t.name_vi, t.name_en, t.capital,
        count(q.id) filter (where a.submitted_at is not null)::integer as answered,
        count(q.id) filter (where a.submitted_at is not null and q.is_correct)::integer as correct
      from public.assignment_questions aq
      left join public.quiz_countries t on t.id = aq.target_id
      left join public.quiz_questions q on q.assignment_question_id = aq.id
      left join public.quiz_attempts a on a.id = q.attempt_id
      where aq.assignment_id = p_assignment_id
      group by aq.id, aq.kind, aq.prompt, t.name_vi, t.name_en, t.capital
    ) s
  ), '[]'::jsonb);
end;
$$;

create function public.list_quiz_countries()
returns table (id text, name_vi text, name_en text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_role('teacher');

  return query
    select c.id, c.name_vi, c.name_en from public.quiz_countries c order by c.name_vi;
end;
$$;

create function public.save_custom_question(
  p_id uuid,
  p_kind text,
  p_prompt text,
  p_options text[],
  p_correct_index integer,
  p_target_id text
)
returns public.custom_questions
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_role('teacher');
  labels text[];
  result public.custom_questions;
begin
  if p_kind = 'custom_choice' then
    select array_agg(btrim(o) order by ord) into labels
    from unnest(p_options) with ordinality as x (o, ord);

    if coalesce(array_length(labels, 1), 0) not between 2 and 6
      or exists (select 1 from unnest(labels) l where l = '' or char_length(l) > 200)
      or (select count(distinct l) from unnest(labels) l) <> array_length(labels, 1)
      or p_correct_index is null
      or p_correct_index not between 0 and array_length(labels, 1) - 1 then
      raise exception 'invalid_options' using errcode = '22023';
    end if;
  elsif p_kind = 'custom_locate' then
    if not exists (select 1 from public.quiz_countries where id = p_target_id) then
      raise exception 'invalid_target' using errcode = '22023';
    end if;
  else
    raise exception 'invalid_kind' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.custom_questions (teacher_id, kind, prompt, option_labels, correct_index, target_id)
    values (
      uid, p_kind, btrim(p_prompt), labels,
      case when p_kind = 'custom_choice' then p_correct_index end,
      case when p_kind = 'custom_locate' then p_target_id end
    )
    returning * into result;
  else
    update public.custom_questions
    set kind = p_kind, prompt = btrim(p_prompt), option_labels = labels,
        correct_index = case when p_kind = 'custom_choice' then p_correct_index end,
        target_id = case when p_kind = 'custom_locate' then p_target_id end
    where id = p_id and teacher_id = uid
    returning * into result;

    if not found then
      raise exception 'question_not_found' using errcode = 'P0002';
    end if;
  end if;

  return result;
end;
$$;

create function public.delete_custom_question(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.custom_questions
  where id = p_id and teacher_id = private.require_role('teacher');
end;
$$;

-- Tiến độ của chính người dùng, dùng cho bản đồ thành thạo.
create function public.my_mastery()
returns table (target_id text, answered integer, correct integer)
language sql
stable
security definer
set search_path = ''
as $$
  select q.target_id, count(*)::integer, count(*) filter (where q.is_correct)::integer
  from public.quiz_questions q
  join public.quiz_attempts a on a.id = q.attempt_id
  where a.user_id = auth.uid() and a.submitted_at is not null and q.target_id is not null
  group by q.target_id;
$$;

create function public.review_due_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.review_items
  where user_id = auth.uid() and due_at <= now();
$$;

create function public.start_review(p_count integer default 10)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  new_attempt uuid;
  target public.quiz_countries;
  pos integer := 0;
  chosen text;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  insert into public.quiz_attempts (user_id, question_count)
  values (uid, 0)
  returning id into new_attempt;

  for target in
    select c.*
    from public.review_items r
    join public.quiz_countries c on c.id = r.target_id
    where r.user_id = uid and r.due_at <= now()
    order by r.due_at
    limit least(greatest(coalesce(p_count, 10), 1), 20)
  loop
    pos := pos + 1;
    chosen := case
      when target.locatable and random() < 0.34 then 'locate'
      when random() < 0.5 then 'flag'
      else 'capital'
    end;

    insert into public.quiz_questions (attempt_id, position, kind, target_id, option_ids)
    values (
      new_attempt, pos, chosen, target.id,
      case when chosen = 'locate' then '{}'::text[] else private.pick_options(target) end
    );
  end loop;

  if pos = 0 then
    delete from public.quiz_attempts where id = new_attempt;
    raise exception 'no_reviews' using errcode = 'P0001';
  end if;

  update public.quiz_attempts set question_count = pos where id = new_attempt;

  return private.quiz_payload(new_attempt);
end;
$$;

create function public.save_tour(p_class_id uuid, p_title text, p_stops jsonb)
returns public.tours
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.tours;
begin
  perform private.require_class_teacher(p_class_id);

  if jsonb_typeof(p_stops) <> 'array' or jsonb_array_length(p_stops) not between 1 and 30 then
    raise exception 'invalid_stops' using errcode = '22023';
  end if;

  insert into public.tours (class_id, title)
  values (p_class_id, btrim(p_title))
  returning * into result;

  insert into public.tour_stops (tour_id, position, country_id, note)
  select result.id, ord::integer, s ->> 'country_id', coalesce(s ->> 'note', '')
  from jsonb_array_elements(p_stops) with ordinality as x (s, ord);

  return result;
end;
$$;

create function public.delete_tour(p_tour_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_class uuid;
begin
  select class_id into target_class from public.tours where id = p_tour_id;

  if not found then
    raise exception 'tour_not_found' using errcode = 'P0002';
  end if;

  perform private.require_class_teacher(target_class);

  delete from public.tours where id = p_tour_id;
end;
$$;

-- Sinh bộ câu cho các bài đã giao trước khi có bộ câu cố định.
do $$
declare
  a public.assignments;
  kind_count integer;
  used text[];
  added integer;
  tries integer;
  current_kind text;
  target public.quiz_countries;
begin
  for a in
    select * from public.assignments x
    where not exists (select 1 from public.assignment_questions q where q.assignment_id = x.id)
  loop
    kind_count := array_length(a.kinds, 1);
    used := '{}';
    added := 0;
    tries := 0;

    while added < a.question_count and tries < a.question_count * kind_count loop
      current_kind := a.kinds[(tries % kind_count) + 1];
      tries := tries + 1;
      target := private.pick_target(a.region, current_kind, used);

      continue when target.id is null;

      added := added + 1;
      used := used || target.id;

      insert into public.assignment_questions (assignment_id, position, kind, target_id, option_ids)
      values (
        a.id, added, current_kind, target.id,
        case when current_kind = 'locate' then '{}'::text[] else private.pick_options(target) end
      );
    end loop;

    update public.assignments set question_count = greatest(added, 1) where id = a.id;
  end loop;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.assignment_preview(uuid)',
    'public.swap_assignment_question(uuid)',
    'public.remove_assignment_question(uuid)',
    'public.add_custom_to_assignment(uuid, uuid)',
    'public.publish_assignment(uuid)',
    'public.update_assignment(uuid, text, integer, timestamptz)',
    'public.grant_attempt(uuid, uuid)',
    'public.rotate_join_code(uuid)',
    'public.assignment_stats(uuid)',
    'public.list_quiz_countries()',
    'public.save_custom_question(uuid, text, text, text[], integer, text)',
    'public.delete_custom_question(uuid)',
    'public.my_mastery()',
    'public.review_due_count()',
    'public.start_review(integer)',
    'public.save_tour(uuid, text, jsonb)',
    'public.delete_tour(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
