import { createClient } from "@supabase/supabase-js";

const client = createClient(
  "https://bwfzxcvwaiipurwdtaxv.supabase.co",
  "sb_publishable_Daujb5n4qdmQzEAjWmR4Lw_fOwncA60"
);

export const supabase = () => client;
