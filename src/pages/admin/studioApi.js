import data from "../../data.json";
import { supabase } from "../../lib/supabase";

// AI Borg Studio data. Like the dashboard, everything goes through admin-only functions
// (is_borg_admin()), defined in supabase/migrations/20261013000000_borg_ai_studio.sql; the tables
// behind them have no grants.
//
//   get_borg_studio(p_ratings = 200) -> {
//     prompts:  [{ id, version, label, system_prompt, temperature, example_count, is_live,
//                  created_at, ratings: { good, bad, fixed, model_good, model_rated } }]
//                                                                      oldest version first
//     examples: [{ id, original, name, enabled, source, created_at }]    newest first
//     ratings:  [{ id, prompt_id, theme, original, name, source, verdict, reason, fixed_name,
//                  created_at }]                                         newest first, capped
//   }
//   get_borg_ai_feedback(p_days = 30) -> [{ name, original, source, rolls, last_rolled_at, likes,
//                                           dislikes }]   live AI names members reacted to
//     (supabase/migrations/20261015000000_borg_ai_dislikes.sql)
//   get_borg_ai_training_data() -> { ratings: [...every rating, oldest first], liked: [{ name,
//                                    original, source, likes, dislikes }], examples: [{ original,
//                                    name }] }   fine-tuning sources, built into files by
//     trainingData.js (supabase/migrations/20261016000000_borg_ai_training.sql)
//   save_borg_prompt(p_label, p_system_prompt, p_temperature, p_example_count) -> prompt
//     Versions are immutable so every rating stays tied to the exact prompt that made the name;
//     editing saves the next version.
//   set_live_borg_prompt(p_id) -> void         exactly one version is live afterwards
//   add_borg_example(p_original, p_name) -> example
//   set_borg_example_enabled(p_id, p_enabled) -> void
//   rate_borg_name(p_id, p_prompt_id, p_theme, p_original, p_name, p_source, p_verdict, p_reason,
//                  p_fixed_name) -> rating       p_id null inserts, otherwise re-rates that row
//
// Test batches come from the borg-ai-studio edge function (admins only, spends no credits, logs
// no rolls; see supabase/functions/borg-ai-studio/index.ts):
//   { promptId, theme, topic?, avoid } -> { pairs: [{ original, name, source, swap }], dropped,
//                                           topic, prompt: { system, user }, raw, ms }
//   topic (blank theme only) reuses a random topic, so two versions can be compared on one task.

/** Originals per batch, set by BATCH_SIZE in supabase/functions/_shared/borg-ai.ts. */
export const BATCH_SIZE = 5;
export const MAX_THEME_LENGTH = 120;

/** Letters and digits only, lower-cased: "Sponge Borg" and "SpongeBorg" share one key. */
export const nameKey = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "");

async function rpc(name, args) {
  const { data: result, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message || "Request failed");
  return result;
}

// Member feedback is its own call so a failure there doesn't take the rest of the Studio down.
export async function fetchStudio() {
  const [result, feedback] = await Promise.all([
    rpc("get_borg_studio"),
    rpc("get_borg_ai_feedback").then(
      (rows) => ({ rows: rows ?? [], error: null }),
      (failure) => ({ rows: [], error: failure.message })
    ),
  ]);
  return {
    prompts: result?.prompts ?? [],
    examples: result?.examples ?? [],
    ratings: result?.ratings ?? [],
    feedback: feedback.rows,
    feedbackError: feedback.error,
  };
}

export const savePrompt = ({ label, systemPrompt, temperature, exampleCount }) =>
  rpc("save_borg_prompt", {
    p_label: label,
    p_system_prompt: systemPrompt,
    p_temperature: temperature,
    p_example_count: exampleCount,
  });

export const setLivePrompt = (id) => rpc("set_live_borg_prompt", { p_id: id });

export async function fetchTrainingData() {
  const result = await rpc("get_borg_ai_training_data");
  return { ratings: result?.ratings ?? [], liked: result?.liked ?? [], examples: result?.examples ?? [] };
}

export const addExample = ({ original, name }) => rpc("add_borg_example", { p_original: original, p_name: name });

export const setExampleEnabled = (id, enabled) =>
  rpc("set_borg_example_enabled", { p_id: id, p_enabled: enabled });

export const rateName = ({ id, promptId, theme, original, name, source, verdict, reason, fixedName }) =>
  rpc("rate_borg_name", {
    p_id: id ?? null,
    p_prompt_id: promptId,
    p_theme: theme,
    p_original: original,
    p_name: name,
    p_source: source ?? null,
    p_verdict: verdict,
    p_reason: reason || null,
    p_fixed_name: fixedName || null,
  });

export async function generateBatch({ promptId, theme, topic }) {
  const { data: payload, error } = await supabase.functions.invoke("borg-ai-studio", {
    body: { promptId, theme, topic, avoid: data.borgs },
  });
  // Non-2xx responses still carry { error } in the body.
  const body = error ? await error.context?.json?.().catch(() => null) : payload;
  if (!Array.isArray(body?.pairs)) {
    // A timed-out batch still says what was sent, so the prompt can be trimmed.
    throw Object.assign(new Error(body?.error ?? "BORG AI couldn't be reached. Try again."), {
      prompt: body?.prompt ?? null,
      topic: body?.topic ?? null,
    });
  }
  return {
    pairs: body.pairs,
    dropped: body.dropped ?? [],
    topic: body.topic ?? null,
    prompt: body.prompt ?? null,
    raw: body.raw ?? "",
    ms: body.ms ?? null,
  };
}
