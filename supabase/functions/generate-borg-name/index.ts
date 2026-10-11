import { createClient } from "npm:@supabase/supabase-js@2";
import { askModel, buildMessages, type Draft, extractDrafts, modelServer, pickPair } from "../_shared/borg-ai.ts";
import { loadBatchSetup } from "../_shared/borg-setup.ts";
import { corsHeaders, json } from "../_shared/http.ts";

// Spends one daily BORG AI credit, asks the Ollama model for a batch of "Original -> BORG name"
// pairs with the live Studio prompt version (the built-in prompt when none is live), and hands out
// a random name that doesn't repeat a name or original the site already knows. The model picks
// the originals; for each one, its own name competes with a swap the code makes (borg-ai.ts
// `codeSwap`), and real sound swaps win over tacked-on borgs. Refunds the credit when no fresh
// name comes back. Credits live in public.ai_credit_usage and can only be spent through this
// function (service role). Each name handed out is logged with its original and who made it to
// public.borg_rolls for the admin dashboard, which also feeds later prompts through
// get_borg_ai_context().

const MODEL = Deno.env.get("BORG_AI_MODEL") ?? "llama2-uncensored";
const MAX_ATTEMPTS = 3;
const MAX_PROMPT_LENGTH = 120;
const MAX_AVOID_NAMES = 300;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const server = modelServer();

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Log in to use BORG AI." }, 401);

  const {
    data: { user },
  } = await createClient(supabaseUrl, anonKey).auth.getUser(token);
  if (!user) return json({ error: "Log in to use BORG AI." }, 401);

  let body: { prompt?: unknown; avoid?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return json({ error: `Keep the theme under ${MAX_PROMPT_LENGTH} characters.` }, 400);
  }

  // Names that already exist on the site; a new borg must not reuse one.
  const siteNames = Array.isArray(body.avoid) ? body.avoid.slice(0, MAX_AVOID_NAMES) : [];

  if (!server) {
    console.error("AI_INFERENCE_API_HOST is not set");
    return json({ error: "BORG AI is offline right now." }, 503);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: credits, error: creditError } = await admin.rpc("consume_ai_credit", {
    p_user_id: user.id,
  });
  if (creditError) {
    console.error("consume_ai_credit failed:", creditError.message);
    return json({ error: "Could not check your credits. Try again." }, 500);
  }
  if (typeof credits !== "number") {
    return json({ error: "You're out of BORG AI credits for today.", remaining: 0 }, 429);
  }

  const setup = await loadBatchSetup(admin, siteNames);
  const repeats: Draft[] = [];

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const { messages } = buildMessages({
        config: setup.config,
        prompt,
        examples: setup.examplePool,
        usedNames: [...repeats.flatMap(({ name }) => (name ? [name] : [])), ...setup.recent],
        usedOriginals: [...repeats.map(({ original }) => original), ...setup.originals],
        attempt,
      });
      const raw = await askModel(server, MODEL, messages, setup.config.temperature);
      const batch = pickPair(extractDrafts(raw), setup.avoid);
      if (batch.pair) {
        const { name, original, source } = batch.pair;
        // Stats only: a failed log never costs the member their name.
        const { error: logError } = await admin
          .from("borg_rolls")
          .insert({ user_id: user.id, kind: "ai", name, original, source });
        if (logError) console.error("borg_rolls insert failed:", logError.message);
        return json({ name, remaining: credits });
      }
      repeats.push(...batch.repeats);
    }
  } catch (error) {
    console.error("generate-borg-name model error:", error);
  }

  const { data: refunded } = await admin.rpc("refund_ai_credit", { p_user_id: user.id });
  return json(
    {
      error: "BORG AI came up empty. Your credit was refunded, try again.",
      remaining: typeof refunded === "number" ? refunded : credits + 1,
    },
    502,
  );
});
