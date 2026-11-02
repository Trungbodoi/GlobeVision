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
