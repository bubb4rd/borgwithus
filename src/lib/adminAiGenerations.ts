import type { AIFeedback } from "./aiFeedback";
import { getSupabase, isSupabaseConfigured } from "./supabase";

export type AdminAiGeneration = {
  id: string;
  userId: string;
  userName: string;
  name: string;
  prompt: string;
  feedback: AIFeedback | null;
  createdAt: string;
  updatedAt: string;
};

type RawAdminAiGenerationRow = {
  id: string;
  user_id: string;
  user_name?: string | null;
  name: string;
  prompt: string;
  feedback: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchAdminAiGenerations(): Promise<{
  rows: AdminAiGeneration[];
  error: string | null;
}> {
  if (!isSupabaseConfigured) {
    return { rows: [], error: "Supabase is not configured." };
  }

  const supabase = getSupabase();

  const generationsRpc = await supabase.rpc("admin_list_ai_generations");
  if (!generationsRpc.error && Array.isArray(generationsRpc.data)) {
    return {
      rows: generationsRpc.data.map((row) => parseRow(row as RawAdminAiGenerationRow)),
      error: null,
    };
  }

  const missingGenerationsRpc =
    generationsRpc.error &&
    /admin_list_ai_generations/i.test(generationsRpc.error.message ?? "");

  if (!missingGenerationsRpc && generationsRpc.error) {
    return {
      rows: [],
      error: generationsRpc.error.message ?? "Could not load AI generations.",
    };
  }

  const merged = await fetchMergedAiGenerationsClient(supabase);
  if (merged.error) {
    return merged;
  }
  if (merged.rows.length > 0) {
    return merged;
  }

  const feedbackRpc = await supabase.rpc("admin_list_ai_feedback");
  if (!feedbackRpc.error && Array.isArray(feedbackRpc.data)) {
    return {
      rows: feedbackRpc.data.map((row) => parseRow(row as RawAdminAiGenerationRow)),
      error: null,
    };
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

async function fetchMergedAiGenerationsClient(
  supabase: ReturnType<typeof getSupabase>,
): Promise<{ rows: AdminAiGeneration[]; error: string | null }> {
  const [rollsRes, feedbackRes] = await Promise.all([
    supabase
      .from("user_rolls")
      .select("id, user_id, name, rolled_at")
      .eq("roll_type", "ai")
      .order("rolled_at", { ascending: false })
      .limit(500),
    supabase
      .from("borg_ai_feedback")
      .select("user_id, name, prompt, feedback, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(500),
  ]);

  if (rollsRes.error) {
    return { rows: [], error: rollsRes.error.message ?? "Could not load AI rolls." };
  }

  const feedbackByKey = new Map<
    string,
    { prompt: string; feedback: string; created_at: string; updated_at: string }
  >();

  for (const row of feedbackRes.data ?? []) {
    const key = `${row.user_id}:${row.name.trim().toLowerCase()}`;
    if (!feedbackByKey.has(key)) {
      feedbackByKey.set(key, {
        prompt: row.prompt,
        feedback: row.feedback,
        created_at: row.created_at,
        updated_at: row.updated_at,
      });
    }
  }

  return {
    rows: (rollsRes.data ?? []).map((roll) => {
      const key = `${roll.user_id}:${roll.name.trim().toLowerCase()}`;
      const feedback = feedbackByKey.get(key);

      return parseRow({
        id: roll.id,
        user_id: roll.user_id,
        user_name: null,
        name: roll.name,
        prompt: feedback?.prompt ?? "",
        feedback: feedback?.feedback ?? null,
        created_at: feedback?.created_at ?? roll.rolled_at,
        updated_at: feedback?.updated_at ?? roll.rolled_at,
      });
    }),
    error: null,
  };
}

function parseFeedback(value: string | null | undefined): AIFeedback | null {
  if (value === "like" || value === "dislike") return value;
  return null;
}

function parseRow(row: RawAdminAiGenerationRow): AdminAiGeneration {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name?.trim() || "User",
    name: row.name,
    prompt: row.prompt,
    feedback: parseFeedback(row.feedback),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
