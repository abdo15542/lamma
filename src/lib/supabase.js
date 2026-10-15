import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://kbnazbcxepzuyfunwola.supabase.co";

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtibmF6YmN4ZXB6dXlmdW53b2xhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5ODQyODksImV4cCI6MjEwNzU2MDI4OX0.mEY9c5855Ld8H3ztIN7RE9d3pwLAg65IZsSSAe0CUIo";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
