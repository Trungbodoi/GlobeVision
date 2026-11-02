import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Chưa cấu hình Supabase: phần tra cứu địa cầu vẫn chạy, chỉ ẩn phần tài khoản.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
