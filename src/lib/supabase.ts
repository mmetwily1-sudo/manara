import { createBrowserClient, createServerClient } from "@supabase/ssr";

/**
 * Supabase client — يُنشأ حسب السياق (browser/server)
 * ملاحظة: مفيش tenant isolation هنا — العزل كله في RLS policies
 * على مستوى قاعدة البيانات (شوف database/schema.sql)
 */

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** للاستخدام داخل Client Components */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

/** للاستخدام داخل Server Components / Route Handlers — مرر الـ cookies */
export function createServerSupabase(cookieStore: {
  getAll: () => { name: string; value: string }[];
}) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
    },
  });
}
