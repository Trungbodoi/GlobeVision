import { supabase } from "../lib/supabase";

async function unwrap(request) {
  const { data, error } = await request;

  if (error) throw error;

  return data;
}

const rpc = (name, args) => unwrap(supabase.rpc(name, args));

export const listClasses = () =>
  unwrap(supabase.from("classes").select("id, name, join_code, created_at").order("created_at"));

export const createClass = (name) => rpc("create_class", { p_name: name });
export const deleteClass = (classId) => rpc("delete_class", { p_class_id: classId });
export const joinClass = (code) => rpc("join_class", { p_code: code });
export const leaveClass = (classId) => rpc("leave_class", { p_class_id: classId });
export const getRoster = (classId) => rpc("class_roster", { p_class_id: classId });
export const removeStudent = (classId, studentId) =>
  rpc("remove_student", { p_class_id: classId, p_student_id: studentId });

export const listAssignments = (classId) =>
  unwrap(supabase.from("assignments").select("*").eq("class_id", classId).order("due_at"));

export const createAssignment = ({ classId, title, region, kinds, count, maxAttempts, dueAt }) =>
  rpc("create_assignment", {
    p_class_id: classId,
    p_title: title,
    p_region: region,
    p_kinds: kinds,
    p_count: count,
    p_max_attempts: maxAttempts,
    p_due_at: dueAt,
  });

export const deleteAssignment = (id) => rpc("delete_assignment", { p_assignment_id: id });
export const getGradebook = (id) => rpc("gradebook", { p_assignment_id: id });
export const getMyAssignments = () => rpc("my_assignments");
export const startAssignment = (id) => rpc("start_assignment", { p_assignment_id: id });

export const rotateJoinCode = (classId) => rpc("rotate_join_code", { p_class_id: classId });
export const getAssignmentPreview = (id) => rpc("assignment_preview", { p_assignment_id: id });
export const swapAssignmentQuestion = (id) => rpc("swap_assignment_question", { p_question_id: id });
export const removeAssignmentQuestion = (id) => rpc("remove_assignment_question", { p_question_id: id });
export const addCustomToAssignment = (assignmentId, customId) =>
  rpc("add_custom_to_assignment", { p_assignment_id: assignmentId, p_custom_id: customId });
export const publishAssignment = (id) => rpc("publish_assignment", { p_assignment_id: id });
export const updateAssignment = ({ id, title, maxAttempts, dueAt }) =>
  rpc("update_assignment", {
    p_assignment_id: id,
    p_title: title,
    p_max_attempts: maxAttempts,
    p_due_at: dueAt,
  });
export const grantAttempt = (assignmentId, studentId) =>
  rpc("grant_attempt", { p_assignment_id: assignmentId, p_student_id: studentId });
export const getAssignmentStats = (id) => rpc("assignment_stats", { p_assignment_id: id });

export const listQuizCountries = () => rpc("list_quiz_countries");
export const listCustomQuestions = () =>
  unwrap(
    supabase
      .from("custom_questions")
      .select("id, kind, prompt, option_labels, correct_index, target_id")
      .order("created_at", { ascending: false })
  );
export const saveCustomQuestion = ({ id, kind, prompt, options, correct, target }) =>
  rpc("save_custom_question", {
    p_id: id,
    p_kind: kind,
    p_prompt: prompt,
    p_options: kind === "custom_choice" ? options : null,
    p_correct_index: kind === "custom_choice" ? correct : null,
    p_target_id: kind === "custom_locate" ? target : null,
  });
export const deleteCustomQuestion = (id) => rpc("delete_custom_question", { p_id: id });

export const listTours = (classId) => {
  const query = supabase
    .from("tours")
    .select("id, class_id, title, tour_stops(position, country_id, note)")
    .order("created_at");

  return unwrap(classId ? query.eq("class_id", classId) : query);
};
export const saveTour = ({ classId, title, stops }) =>
  rpc("save_tour", { p_class_id: classId, p_title: title, p_stops: stops });
export const deleteTour = (id) => rpc("delete_tour", { p_tour_id: id });
