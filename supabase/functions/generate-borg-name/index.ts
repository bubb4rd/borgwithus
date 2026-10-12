import { createClient } from "npm:@supabase/supabase-js@2";
import {
  askModel,
  buildMessages,
  type Candidate,
  type Draft,
  extractDrafts,
  modelServer,
  pickPair,
} from "../_shared/borg-ai.ts";
import { loadBatchSetup } from "../_shared/borg-setup.ts";
import { corsHeaders, json } from "../_shared/http.ts";

// Spends one daily BORG AI credit, asks the Ollama model for a batch of "Original -> BORG name"
// pairs with the live Studio prompt version (the built-in prompt when none is live), and hands out
// a random name that doesn't repeat a name or original the site already knows. The model picks
// the originals; for each one, its own name competes with a swap the code makes (borg-ai.ts
// `codeSwap`), and real sound swaps win over tacked-on borgs. Each request is a row in
// public.ai_generations (start_ai_generation / finish_ai_generation, service role only): one in
// flight per member, and a request that comes back empty is refunded up to ai_daily_refunds()
// times a day. A request this function never finishes is settled by the database after three
// minutes. Each name handed out is logged with its original and who made it to public.borg_rolls
// for the admin dashboard, which also feeds later prompts through get_borg_ai_context().

const MODEL = Deno.env.get("BORG_AI_MODEL") ?? "llama2-uncensored";
const MAX_ATTEMPTS = 3;
const MAX_PROMPT_LENGTH = 120;
const MAX_AVOID_NAMES = 300;
// Setup plus every model attempt. Supabase cuts the response at 150 s; this leaves room to settle
// the request and answer.
const BUDGET_MS = 100_000;
// Not worth starting an attempt with less than this left.
const MIN_ATTEMPT_MS = 10_000;

type Started = { status: "ok"; id: number; remaining: number } | { status: "busy" } | { status: "out" };
type Finished = { outcome: "named" | "refunded" | "charged" | null; remaining: number | null };

const EMPTY_COPY: Record<string, string> = {
  refunded: "BORG AI came up empty. Your credit was refunded, try again.",
  charged: "BORG AI came up empty. Today's refunds are used up, so that one cost a credit.",
};

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

  let body: { prompt?: unknown; avoid?: unknown; variant?: unknown; visitor?: unknown };
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

  // The home page's generator A/B test: which group the browser is in and its visitor id.
  const variant = body.variant === "classic" || body.variant === "jug" ? body.variant : null;
  const visitor = typeof body.visitor === "string" ? body.visitor.trim().slice(0, 64) || null : null;

  if (!server) {
    console.error("AI_INFERENCE_API_HOST is not set");
    return json({ error: "BORG AI is offline right now." }, 503);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: started, error: startError } = await admin.rpc("start_ai_generation", {
    p_user_id: user.id,
  });
  if (startError || !started) {
    console.error("start_ai_generation failed:", startError?.message);
    return json({ error: "Could not check your credits. Try again." }, 500);
  }
  const start = started as Started;
  if (start.status === "busy") {
    return json({ error: "BORG AI is still on your last one. Hang tight." }, 409);
  }
  if (start.status === "out") {
    return json({ error: "You're out of BORG AI credits for today.", remaining: 0 }, 429);
  }

  const deadline = Date.now() + BUDGET_MS;
  let pair: Candidate | null = null;

  try {
    const setup = await loadBatchSetup(admin, siteNames);
    const repeats: Draft[] = [];
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !pair; attempt++) {
      const timeLeft = deadline - Date.now();
      if (timeLeft < MIN_ATTEMPT_MS) break;
      const { messages } = buildMessages({ config: setup.config, prompt, repeats, attempt });
      const raw = await askModel(server, MODEL, messages, setup.config.temperature, timeLeft);
      const batch = pickPair(extractDrafts(raw), setup.avoid);
      pair = batch.pair;
      repeats.push(...batch.repeats);
    }
  } catch (error) {
    console.error("generate-borg-name model error:", error);
  }

  if (pair) {
    // Stats only: a failed log never costs the member their name.
    const { name, original, source } = pair;
    const { error: logError } = await admin
      .from("borg_rolls")
      .insert({ user_id: user.id, kind: "ai", name, original, source, variant, visitor });
    if (logError) console.error("borg_rolls insert failed:", logError.message);
  }

  const { data: finished, error: finishError } = await admin.rpc("finish_ai_generation", {
    p_id: start.id,
    p_named: pair !== null,
  });
  if (finishError) console.error("finish_ai_generation failed:", finishError.message);
  const { outcome, remaining } = (finished ?? { outcome: null, remaining: null }) as Finished;

  if (pair) return json({ name: pair.name, remaining: remaining ?? start.remaining });
  return json(
    {
      error: EMPTY_COPY[outcome ?? ""] ?? "BORG AI came up empty. Try again.",
      ...(typeof remaining === "number" ? { remaining } : {}),
    },
    502,
  );
});
