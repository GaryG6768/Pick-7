import { createClient } from "@supabase/supabase-js";

export const supabase = () =>
  createClient(
    "https://bwfzxcvwaiipurwdtaxv.supabase.co"
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
