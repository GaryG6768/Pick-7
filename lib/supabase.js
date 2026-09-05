import { createClient } from "@supabase/supabase-js";

export const supabase = () =>
  createClient(
    "https://bwfzxcvwaiipurwdtaxv.supabase.co",
    "sb_publishable_Daujb5n4qdmQzEAjWmR4Lw_fOwncA60"
  );
