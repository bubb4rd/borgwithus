import { createClient } from "npm:@supabase/supabase-js@2";
import { askModel, buildMessages, extractDrafts, pickPair } from "../_shared/borg-ai.ts";
import { loadBatchSetup } from "../_shared/borg-setup.ts";
import { corsHeaders, json } from "../_shared/http.ts";

// Admin-only test batches for the AI Borg Studio. One batch with a chosen prompt version, built
// exactly like a member roll (same context, avoid lists and code swaps), but it spends no credits,
// logs no rolls, and returns everything a tinkerer needs instead of one name:
//   pairs    every name on offer: { original, name, source: "model" | "code", swap }, real sound
//            swaps first, then the model's tacked-on names (swap false)
//   dropped  the model's lines whose original or name was already known: { original, name }
//   topic    the random topic picked for a blank theme (null with a theme)
//   prompt   { system, user }, exactly what the model was sent
//   raw      the model's reply as is
//   ms       how long the model took
// Request: { promptId, theme, topic?, avoid }: avoid is the site's own names, like a member roll;
// topic (blank theme only) replaces the random topic, so two versions can face the same task.

const MODEL = Deno.env.get("BORG_AI_MODEL") ?? "llama2-uncensored";
const MAX_THEME_LENGTH = 120;
const MAX_AVOID_NAMES = 300;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const modelHost = Deno.env.get("AI_INFERENCE_API_HOST")?.replace(/\/$/, "");

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "Admins only." }, 403);
  const { data: isAdmin } = await createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  }).rpc("is_borg_admin");
  if (isAdmin !== true) return json({ error: "Admins only." }, 403);

  let body: { promptId?: unknown; theme?: unknown; topic?: unknown; avoid?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }
  if (!Number.isInteger(body.promptId)) return json({ error: "Pick a prompt version." }, 400);
  const theme = typeof body.theme === "string" ? body.theme.trim() : "";
  const forcedTopic = typeof body.topic === "string" ? body.topic.trim() : "";
  if (theme.length > MAX_THEME_LENGTH || forcedTopic.length > MAX_THEME_LENGTH) {
    return json({ error: `Keep the theme under ${MAX_THEME_LENGTH} characters.` }, 400);
  }
  const siteNames = Array.isArray(body.avoid) ? body.avoid.slice(0, MAX_AVOID_NAMES) : [];

  if (!modelHost) {
    console.error("AI_INFERENCE_API_HOST is not set");
    return json({ error: "BORG AI is offline right now." }, 503);
  }

  const setup = await loadBatchSetup(createClient(supabaseUrl, serviceKey), siteNames, body.promptId as number);
  if (!setup.version) return json({ error: "That prompt version doesn't exist." }, 404);

  const { messages, topic } = buildMessages({
    config: setup.config,
    prompt: theme,
    topic: forcedTopic,
    examples: setup.examplePool,
    usedNames: setup.recent,
    usedOriginals: setup.originals,
    attempt: 1,
  });
  const sent = { system: messages[0].content, user: messages[1].content };

  const started = Date.now();
  let raw: string;
  try {
    raw = await askModel(modelHost, MODEL, messages, setup.config.temperature);
  } catch (error) {
    console.error("borg-ai-studio model error:", error);
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    return json(
      {
        error: timedOut
          ? `The model took over ${Math.round((Date.now() - started) / 1000)} s and was cut off. Try again, or trim the prompt.`
          : "The model server couldn't be reached. Try again.",
        topic,
        prompt: sent,
      },
      timedOut ? 504 : 502,
    );
  }
  const ms = Date.now() - started;

  const batch = pickPair(extractDrafts(raw), setup.avoid);
  return json({
    version: setup.version.version,
    topic,
    prompt: sent,
    raw,
    ms,
    pairs: [
      ...batch.swaps.map((pair) => ({ ...pair, swap: true })),
      ...batch.tackedOn.map((pair) => ({ ...pair, swap: false })),
    ],
    dropped: batch.repeats,
  });
});
