import { supabase } from "../lib/supabase";

async function unwrap(request) {
  const { data, error } = await request;

  if (error) throw error;

  return data;
}

export function startQuiz({ region, kinds, count = 10 }) {
  return unwrap(
    supabase.rpc("start_quiz", { p_region: region, p_kinds: kinds, p_count: count })
  );
}

export function submitQuiz(attemptId, answers) {
  return unwrap(supabase.rpc("submit_quiz", { p_attempt_id: attemptId, p_answers: answers }));
}

export function getQuizHistory(limit = 5) {
  return unwrap(
    supabase
      .from("quiz_attempts")
      .select("id, region, question_count, score, submitted_at")
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: false })
      .limit(limit)
  );
}
