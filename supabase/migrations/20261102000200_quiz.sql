-- Quiz cá nhân: máy chủ phát đề và chấm điểm.
--
-- Đáp án nằm trong quiz_questions, bảng này không cấp quyền đọc trực tiếp.
-- Trình duyệt chỉ làm việc qua start_quiz và submit_quiz, và chỉ nhận
-- đáp án đúng sau khi đã nộp bài.

create table public.quiz_countries (
  id text primary key,
  name_vi text not null,
  name_en text not null,
  capital text not null,
  region text not null,
  locatable boolean not null default true
);

alter table public.quiz_countries enable row level security;
revoke all on public.quiz_countries from anon, authenticated;

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  region text,
  question_count integer not null,
  score integer,
  started_at timestamptz not null default now(),
  submitted_at timestamptz
);

create index quiz_attempts_user_idx on public.quiz_attempts (user_id, started_at desc);

alter table public.quiz_attempts enable row level security;
revoke all on public.quiz_attempts from anon, authenticated;
grant select on public.quiz_attempts to authenticated;

create policy "quiz_attempts_select_own"
  on public.quiz_attempts for select to authenticated
  using (user_id = auth.uid());

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts (id) on delete cascade,
  position integer not null,
  kind text not null check (kind in ('locate', 'flag', 'capital')),
  target_id text not null references public.quiz_countries (id),
  option_ids text[] not null default '{}',
  answer_id text,
  is_correct boolean,
  unique (attempt_id, position)
);

alter table public.quiz_questions enable row level security;
revoke all on public.quiz_questions from anon, authenticated;

-- Phát đề: tối đa 20 câu, không lộ mã đáp án trong các lựa chọn.
create function public.start_quiz(
  p_region text default null,
  p_kinds text[] default array['locate', 'flag', 'capital'],
  p_count integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  new_attempt_id uuid;
  kinds text[];
  kind_count integer;
  wanted integer := least(greatest(coalesce(p_count, 10), 1), 20);
  used text[] := '{}';
  added integer := 0;
  tries integer := 0;
  current_kind text;
  target public.quiz_countries;
  options text[];
  questions jsonb;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select array_agg(distinct k) into kinds
  from unnest(p_kinds) as k
  where k in ('locate', 'flag', 'capital');

  kind_count := coalesce(array_length(kinds, 1), 0);

  if kind_count = 0 then
    raise exception 'kinds_required' using errcode = '22023';
  end if;

  -- Dọn các lượt bỏ dở đã lâu.
  delete from public.quiz_attempts
  where user_id = uid and submitted_at is null and started_at < now() - interval '1 day';

  insert into public.quiz_attempts (user_id, region, question_count)
  values (uid, p_region, wanted)
  returning id into new_attempt_id;

  while added < wanted and tries < wanted * kind_count loop
    current_kind := kinds[(tries % kind_count) + 1];
    tries := tries + 1;

    select * into target
    from public.quiz_countries c
    where (p_region is null or c.region = p_region)
      and c.id <> all (used)
      and (current_kind <> 'locate' or c.locatable)
    order by random()
    limit 1;

    continue when not found;

    options := '{}';

    if current_kind <> 'locate' then
      -- Đáp án nhiễu ưu tiên cùng khu vực để câu hỏi không quá dễ.
      select array_agg(o.id order by random()) into options
      from (
        select target.id as id
        union all
        select * from (
          select c.id
          from public.quiz_countries c
          where c.id <> target.id and c.capital <> target.capital
          order by (c.region = target.region) desc, random()
          limit 3
        ) distractors
      ) o;
    end if;

    added := added + 1;
    used := used || target.id;

    insert into public.quiz_questions (attempt_id, position, kind, target_id, option_ids)
    values (new_attempt_id, added, current_kind, target.id, options);
  end loop;

  if added = 0 then
    delete from public.quiz_attempts where id = new_attempt_id;
    raise exception 'no_questions' using errcode = 'P0001';
  end if;

  update public.quiz_attempts set question_count = added where id = new_attempt_id;

  select jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'position', q.position,
      'kind', q.kind,
      'name_vi', case when q.kind = 'flag' then null else t.name_vi end,
      'name_en', case when q.kind = 'flag' then null else t.name_en end,
      'flag', case when q.kind = 'flag' then lower(t.id) end,
      'options', (
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
    )
    order by q.position
  ) into questions
  from public.quiz_questions q
  join public.quiz_countries t on t.id = q.target_id
  where q.attempt_id = new_attempt_id;

  return jsonb_build_object('attempt_id', new_attempt_id, 'questions', questions);
end;
$$;

-- Nộp bài và chấm. Mỗi lượt chỉ nộp được một lần.
-- p_answers: [{ "question_id": uuid, "answer_id": "VN" } hoặc
--             { "question_id": uuid, "option_index": 0 }]
create function public.submit_quiz(p_attempt_id uuid, p_answers jsonb)
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
  set answer_id = case
    when q.kind = 'locate' then a.answer ->> 'answer_id'
    else q.option_ids[(a.answer ->> 'option_index')::integer + 1]
  end
  from (
    select value as answer
    from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb))
  ) a
  where q.attempt_id = p_attempt_id
    and q.id = (a.answer ->> 'question_id')::uuid;

  update public.quiz_questions q
  set is_correct = coalesce(q.answer_id = q.target_id, false)
  where q.attempt_id = p_attempt_id;

  select count(*) filter (where q.is_correct) into final_score
  from public.quiz_questions q
  where q.attempt_id = p_attempt_id;

  update public.quiz_attempts
  set score = final_score, submitted_at = now()
  where id = p_attempt_id;

  select jsonb_agg(
    jsonb_build_object(
      'position', q.position,
      'kind', q.kind,
      'is_correct', q.is_correct,
      'target_id', q.target_id,
      'target_name_vi', t.name_vi,
      'target_name_en', t.name_en,
      'target_capital', t.capital,
      'answer_name_vi', a.name_vi,
      'answer_name_en', a.name_en,
      'answer_capital', a.capital
    )
    order by q.position
  ) into review
  from public.quiz_questions q
  join public.quiz_countries t on t.id = q.target_id
  left join public.quiz_countries a on a.id = q.answer_id
  where q.attempt_id = p_attempt_id;

  return jsonb_build_object(
    'score', final_score,
    'total', attempt.question_count,
    'review', review
  );
end;
$$;

revoke execute on function public.start_quiz(text, text[], integer) from public, anon;
grant execute on function public.start_quiz(text, text[], integer) to authenticated;
revoke execute on function public.submit_quiz(uuid, jsonb) from public, anon;
grant execute on function public.submit_quiz(uuid, jsonb) to authenticated;
