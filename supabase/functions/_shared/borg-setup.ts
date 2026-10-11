import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { avoidEntries, BUILT_IN_PROMPT, STYLE_PAIRS, storedPrompt } from "./borg-ai.ts";

// get_borg_ai_context() also returns `examples` and `recent`, which no prompt uses any more.
type AiContext = { avoid: string[]; originals: string[] };

/**
 * Everything a batch needs besides the model, read as service role: the prompt version (the live
 * one, or `promptId` for a Studio test; the built-in prompt when there is none) with its example
 * pool, and the names and originals a new name must not repeat (`siteNames` are the site's own
 * names, sent by the browser). A failed lookup is logged and skipped, so a roll still works with
 * the built-in prompt and the site's own names.
 */
export async function loadBatchSetup(admin: SupabaseClient, siteNames: unknown[], promptId: number | null = null) {
  const [context, stored] = await Promise.all([
    admin.rpc("get_borg_ai_context"),
    admin.rpc("get_borg_ai_prompt", { p_prompt_id: promptId }),
  ]);
  if (context.error) console.error("get_borg_ai_context failed:", context.error.message);
  if (stored.error) console.error("get_borg_ai_prompt failed:", stored.error.message);

  const { avoid = [], originals = [] } = (context.data ?? {}) as Partial<AiContext>;
  const version = storedPrompt(stored.data);
  const config = version ?? BUILT_IN_PROMPT;
  const shown = [...STYLE_PAIRS, ...config.formatExamples];
  const shownNames = shown.map(({ name }) => name);

  return {
    /** The stored version in use, null for the built-in prompt. */
    version: version && { id: version.id, version: version.version },
    config,
    avoid: {
      names: avoidEntries([...shownNames, ...siteNames, ...avoid]),
      originals: avoidEntries([...shown.map(({ original }) => original), ...originals]),
    },
  };
}
