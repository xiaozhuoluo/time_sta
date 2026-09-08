import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const cloudEnabled = Boolean(supabaseUrl && supabaseKey);
export function createClient() {
  if (!cloudEnabled) return null;
  return createBrowserClient(supabaseUrl!, supabaseKey!);
}
