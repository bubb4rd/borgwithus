import { getSupabase, isSupabaseConfigured } from "./supabase";
import { getActiveUserStorageId, userStorageKey } from "./userStorage";

export type AIFeedback = "like" | "dislike";

export type AIFeedbackEntry = {
  id: string;
  name: string;
  prompt: string;
  feedback: AIFeedback;
  createdAt: string;
};

export type BorgAiBadList = {
  names: string[];
  words: string[];
};

export const AI_FEEDBACK_UPDATE_EVENT = "borg-ai-feedback:update";

export function aiFeedbackUpdateEventName() {
  return AI_FEEDBACK_UPDATE_EVENT;
}

const FEEDBACK_BASE = "borgwithus-ai-feedback";

function loadFeedback(): AIFeedbackEntry[] {
  if (!getActiveUserStorageId()) return [];

  try {
    const raw = localStorage.getItem(userStorageKey(FEEDBACK_BASE));
    if (!raw) return [];
    return JSON.parse(raw) as AIFeedbackEntry[];
  } catch {
    return [];
  }
}

function saveLocalFeedback(
  name: string,
  prompt: string,
  feedback: AIFeedback,
) {
  if (!getActiveUserStorageId()) return;

  const entries = loadFeedback();
  entries.unshift({
    id: crypto.randomUUID(),
    name,
    prompt,
    feedback,
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem(
    userStorageKey(FEEDBACK_BASE),
    JSON.stringify(entries.slice(0, 200)),
  );
}

export async function getBorgAiBadList(): Promise<BorgAiBadList> {
  if (!isSupabaseConfigured) {
    return { names: [], words: [] };
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("get_borg_ai_bad_names", {
      p_limit: 40,
    });

    if (error || !data || typeof data !== "object") {
      return { names: [], words: [] };
    }

    const payload = data as { names?: unknown; words?: unknown };
    return {
      names: Array.isArray(payload.names)
        ? payload.names.filter((name): name is string => typeof name === "string")
        : [],
      words: Array.isArray(payload.words)
        ? payload.words.filter((word): word is string => typeof word === "string")
        : [],
    };
  } catch {
    return { names: [], words: [] };
  }
}

export async function recordAIFeedback(
  name: string,
  prompt: string,
  feedback: AIFeedback,
) {
  const trimmedName = name.trim();
  const trimmedPrompt = prompt.trim();
  saveLocalFeedback(trimmedName, trimmedPrompt, feedback);

  if (!isSupabaseConfigured) return;

  try {
    const supabase = getSupabase();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return;

    await supabase.from("borg_ai_feedback").upsert(
      {
        user_id: session.user.id,
        name: trimmedName,
        prompt: trimmedPrompt,
        feedback,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,name,prompt" },
    );

    window.dispatchEvent(new Event(AI_FEEDBACK_UPDATE_EVENT));
  } catch {
    // Local feedback is still saved; DB sync can retry on next rating.
  }
}
