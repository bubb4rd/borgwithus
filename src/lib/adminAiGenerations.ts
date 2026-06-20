import type { AIFeedback } from "./aiFeedback";
import { getSupabase, isSupabaseConfigured } from "./supabase";

export type AdminAiGeneration = {
  id: string;
  userId: string;
  userName: string;
  name: string;
  prompt: string;
  feedback: AIFeedback;
  createdAt: string;
  updatedAt: string;
};

export async function fetchAdminAiGenerations(): Promise<{
  rows: AdminAiGeneration[];
  error: string | null;
}> {
  if (!isSupabaseConfigured) {
    return { rows: [], error: "Supabase is not configured." };
  }

  const supabase = getSupabase();

  const rpc = await supabase.rpc("admin_list_ai_feedback");
  if (!rpc.error && Array.isArray(rpc.data)) {
    return {
      rows: rpc.data.map(parseRow),
      error: null,
    };
  }

  const missingRpc =
    rpc.error &&
    /admin_list_ai_feedback/i.test(rpc.error.message ?? "");

  if (!missingRpc && rpc.error) {
    return { rows: [], error: rpc.error.message ?? "Could not load AI generations." };
  }

  const { data, error } = await supabase
    .from("borg_ai_feedback")
    .select("id, user_id, name, prompt, feedback, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(500);

  if (error) {
    const hint = /borg_ai_feedback/i.test(error.message ?? "")
      ? " Run supabase/borg-ai-feedback.sql in the Supabase SQL editor."
      : "";
    return {
      rows: [],
      error: `${error.message ?? "Could not load AI generations."}${hint}`,
    };
  }

  return {
    rows: (data ?? []).map((row) =>
      parseRow({
        id: row.id,
        user_id: row.user_id,
        user_name: null,
        name: row.name,
        prompt: row.prompt,
        feedback: row.feedback,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }),
    ),
    error: null,
  };
}

function parseRow(row: {
  id: string;
  user_id: string;
  user_name?: string | null;
  name: string;
  prompt: string;
  feedback: string;
  created_at: string;
  updated_at: string;
}): AdminAiGeneration {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name?.trim() || "User",
    name: row.name,
    prompt: row.prompt,
    feedback: row.feedback === "like" ? "like" : "dislike",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
