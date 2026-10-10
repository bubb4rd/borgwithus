import { createClient } from "npm:@supabase/supabase-js@2";

// Spends one daily BORG AI credit, asks the Ollama model for a name, and refunds the credit
// when no usable name comes back. Credits live in public.ai_credit_usage and can only be spent
// through this function (service role). Each name handed out is logged to public.borg_rolls for
// the admin dashboard.

const MODEL = Deno.env.get("BORG_AI_MODEL") ?? "llama3.2:3b";
const MAX_ATTEMPTS = 3;
const MAX_PROMPT_LENGTH = 120;
const MAX_AVOID_NAMES = 300;
const MODEL_TIMEOUT_MS = 60_000;

const STYLE_EXAMPLES = [
  "Ron Borgundy",
  "LeBorg James",
  "Pablo Escoborg",
  "Playborg Carti",
  "SpongeBorg",
  "Heisenborg",
  "Borgan Freeman",
  "Mark Zuckerborg",
  "Pearl Harborg",
  "Kareem Abdul-Jaborg",
];

const SYSTEM_PROMPT = `You invent BORG names. A BORG name is a famous person, place, brand, title or phrase where one syllable is swapped for "borg" so it still sounds right out loud.

Rules:
- Phonetic fit is everything: "borg" replaces a sound like bor, bur, bar, berg or burg.
- The original reference must be instantly recognisable.
- One substitution, short and punchy. Sports, rap, memes, movies, internet culture.
- Crude and chaotic humour is fine.

Reply with the name only: one line, at most 6 words, no quotes, no explanation, no emojis.`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Letters and digits only, padded so `includes` matches whole words:
// " ron borgundy bears " contains the existing name " ron borgundy ".
function wordKey(name: string) {
  return ` ${name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

const CHATTER = /\b(here'?s|here is|sure|okay|i can|i'm|let me|how about|name:|borg name)\b/i;

function cleanCandidate(text: string) {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, "")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/^[\s*\-•>#\d.)]+/, "")
    .replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, "")
    .replace(/[.!?,;:]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isUsableName(name: string) {
  if (name.length < 3 || name.length > 60) return false;
  if (name.split(" ").length > 6) return false;
  if (CHATTER.test(name)) return false;
  // "borg" has to be fused into a word (LeBorg, Heisenborg), not just mentioned.
  return /\w+borg|borg\w+/i.test(name);
}

// Models pad answers with chatter, quotes, labels ("Name: …"), asides ("Theme - Name") and
// several names at once ("A | B"); the shortest fragment that still reads as a borg name wins.
function extractName(raw: string) {
  const candidates = [...raw.matchAll(/["“]([^"”\n]{3,60})["”]/g)].map((match) => match[1]);
  for (const line of raw.split(/\r?\n/)) {
    candidates.push(line, ...line.split(/:\s+|[!?]\s+|\s+[-–—]\s+|\s*\|\s*/));
  }

  const names = candidates.map(cleanCandidate).filter(isUsableName);
  return names.sort((a, b) => a.length - b.length)[0] ?? null;
}

async function askModel(host: string, prompt: string, attempt: number) {
  const lines = [
    `Examples of the style (do not repeat them): ${STYLE_EXAMPLES.join(" | ")}`,
    prompt ? `Theme from the user: ${prompt}` : "Theme: anything goes.",
  ];
  if (attempt > 1) {
    lines.push("Reply with ONLY the new name on one line. It must contain borg fused into a word.");
  }

  const response = await fetch(`${host}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      options: { temperature: 1 },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: lines.join("\n") },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Model request failed (${response.status}): ${(await response.text()).slice(0, 200)}`);
  }

  const output: { message?: { content?: unknown } } = await response.json();
  return typeof output.message?.content === "string" ? output.message.content : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const modelHost = Deno.env.get("AI_INFERENCE_API_HOST")?.replace(/\/$/, "");

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
  const avoid = [...STYLE_EXAMPLES, ...(Array.isArray(body.avoid) ? body.avoid.slice(0, MAX_AVOID_NAMES) : [])]
    .filter((name): name is string => typeof name === "string" && /[a-z0-9]/i.test(name))
    .map(wordKey);

  if (!modelHost) {
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

  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const name = extractName(await askModel(modelHost, prompt, attempt));
      const key = name && wordKey(name);
      if (key && !avoid.some((existing) => key.includes(existing))) {
        // Stats only: a failed log never costs the member their name.
        const { error: logError } = await admin
          .from("borg_rolls")
          .insert({ user_id: user.id, kind: "ai", name });
        if (logError) console.error("borg_rolls insert failed:", logError.message);
        return json({ name, remaining: credits });
      }
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
