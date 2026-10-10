import { createClient } from "@supabase/supabase-js";

const url = process.env.REACT_APP_SUPABASE_URL;
const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Null when the env vars are missing: accounts, BORG AI and the leaderboard render as offline.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
