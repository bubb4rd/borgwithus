import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BORG_AI_DAILY_LIMIT = 5;
const BORG_AI_MODEL = Deno.env.get("BORG_AI_MODEL") ?? "llama2-uncensored";

const BORG_AI_SYSTEM_PROMPT = `You are a BORG name generator. You output ONE borg name per request. Nothing else.

A BORG name is a recognizable phrase, name, or title where part of a word is replaced with "borg" so it sounds natural spoken aloud.

Rules:
- Phonetic fit is everything.
- "borg" replaces a syllable like bor, bar, berg, or borg.
- Immediately recognizable reference.
- Short and punchy.
- Sports, rap, memes, internet culture, current figures.
- Edgy, vulgar, chaotic humor OK.
- One clean substitution only.

OUTPUT — NON-NEGOTIABLE:
- Your entire reply is ONLY the borg name. Less than 4 words.
- NO sentences. NO greetings. NO "here's one". NO emojis. NO explanations.
- NO labels, colons, quotes, or punctuation at the end.
- Bad: Totally got it! Here's one for you...
- Never copy names from the blocked list.`;

type RequestBody = {
  prompt?: string;
  examples?: string[];
  blockedNames?: string[];
  badNames?: string[];
  badWords?: string[];
  tone?: "funny" | "clean";
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isMissingLimitRpc(message: string) {
  return (
    message.includes("consume_borg_ai_generation") ||
    message.includes("refund_borg_ai_generation") ||
    message.includes("get_borg_ai_usage") ||
    message.includes("user_ai_daily_usage") ||
    message.includes("schema cache")
  );
}

function normalizeBorgName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\u201C\u201D\u2018\u2019"'`]/g, "")
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeModelName(raw: string) {
  const LABEL_PREFIX =
    /^(?:\[[^\]]+\]\s*)?(?:dan assignment|dan|borg name|name|assignment|response|answer|output|here(?:'s| is)(?: one)?(?: for you)?)\s*[:.\-]*\s*/i;
  const CONVERSATIONAL =
    /\b(totally|here'?s one|got it|for you|sure thing|okay|let me|i can|happy to|one for you)\b/i;
  const PROMPT_ECHO =
    /\b(good examples?|from the borg list|blocked|never reuse|disliked|avoid themes|style only|context:|tone:|output the|catalog names|do not copy|do not use|user context)\b/i;

  const removeEmojis = (text: string) =>
    text.replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, "").trim();

  const stripLabelPrefixes = (text: string) => {
    let value = removeEmojis(text.trim());
    for (let i = 0; i < 3; i++) {
      const next = value.replace(LABEL_PREFIX, "").trim();
      if (next === value) break;
      value = next;
    }
    return value.replace(/^["'`]+|["'`]+$/g, "").replace(/[.!?,;:]+$/g, "").trim();
  };

  const cleanCandidate = (text: string) =>
    stripLabelPrefixes(text)
      .replace(/^[\s"'“”‘’\-–—]+|[\s"'“”‘’\-–—]+$/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();

  const hasBorgSubstitution = (name: string) =>
    name.split(/\s+/).some((word) => /(?:\w+borg|borg\w+)/i.test(word));

  const isValid = (name: string) => {
    const trimmed = cleanCandidate(name);
    if (!trimmed || trimmed.length < 3 || trimmed.length > 80) return false;
    if (PROMPT_ECHO.test(trimmed)) return false;
    if (!hasBorgSubstitution(trimmed)) return false;
    if (CONVERSATIONAL.test(trimmed)) return false;
    if (/^(totally|here|sure|okay|got|one for)/i.test(trimmed)) return false;
    if (/[!?].*[!?]/.test(trimmed) || /\.{2,}/.test(trimmed)) return false;
    if (trimmed.split(/\s+/).length > 10) return false;
    return true;
  };

  const cleaned = removeEmojis(raw.replace(/\r/g, " "));
  const candidates: string[] = [];

  for (const match of cleaned.matchAll(/["“']([^"”']*borg[^"”']*)["”']/gi)) {
    candidates.push(cleanCandidate(match[1]));
  }
  for (const match of cleaned.matchAll(/(?:\.{2,}|!\s*|:\s*)\s*([^.!?\n]{2,80})/gi)) {
    const part = cleanCandidate(match[1]);
    if (/borg/i.test(part)) candidates.push(part);
  }
  const segments = cleaned.split(/[!?\n]+/).flatMap((p) => p.split(/\.\.\./));
  for (const segment of segments) {
    for (const match of segment.matchAll(
      /([A-Za-z0-9][A-Za-z0-9\s'’\-]*borg[A-Za-z0-9\s'’\-]*)/gi,
    )) {
      candidates.push(cleanCandidate(match[1]));
    }
  }
  if (/borg/i.test(cleaned)) candidates.push(cleanCandidate(cleaned));

  const sorted = [...new Set(candidates.filter(Boolean))].sort(
    (a, b) => a.length - b.length,
  );
  for (const candidate of sorted) {
    if (isValid(candidate)) return candidate;
  }

  return "";
}

function isValidModelName(name: string) {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length < 3 || trimmed.length > 80) return false;
  if (
    /\b(good examples?|from the borg list|blocked|never reuse|disliked|avoid themes|style only|context:|tone:|output the|catalog names|do not copy|do not use|user context)\b/i.test(
      trimmed,
    )
  ) {
    return false;
  }
  if (!trimmed.split(/\s+/).some((word) => /(?:\w+borg|borg\w+)/i.test(word))) {
    return false;
  }
  if (!/borg/i.test(trimmed)) return false;
  if (/\b(totally|here'?s one|got it|for you)\b/i.test(trimmed)) return false;
  if (/^(totally|here|sure|okay|got|one for)/i.test(trimmed)) return false;
  if (/[!?].*[!?]/.test(trimmed) || /\.{2,}/.test(trimmed)) return false;
  if (trimmed.split(/\s+/).length > 10) return false;
  return true;
}

function isBlocked(name: string, blockedNames: string[]) {
  const normalized = normalizeBorgName(name);
  if (!normalized) return true;
  return blockedNames.some(
    (blocked) => normalizeBorgName(blocked) === normalized,
  );
}

function buildUserMessage(body: RequestBody) {
  const prompt = body.prompt?.trim() ?? "";
  const examples = Array.isArray(body.examples) ? body.examples : [];
  const blockedNames = Array.isArray(body.blockedNames)
    ? body.blockedNames
    : [];
  const badNames = Array.isArray(body.badNames) ? body.badNames : [];
  const badWords = Array.isArray(body.badWords) ? body.badWords : [];
  const exampleLines = examples.map((name) => `- ${name}`).join("\n");
  const toneLine =
    body.tone === "clean"
      ? "Tone: keep it PG-13 with no vulgarity."
      : "Tone: edgy, chaotic, and meme-aware.";

  const parts = [
    "STYLE REFERENCE (do not copy verbatim):",
    exampleLines || "- Ron Borgundy",
    "",
    `${blockedNames.length} catalog names are blocked — invent something new.`,
  ];

  if (badNames.length > 0) {
    parts.push(
      "",
      `User-disliked (${badNames.length}): ${badNames.slice(0, 20).join(" | ")}`,
    );
  }

  if (badWords.length > 0) {
    parts.push("", `Avoid these themes: ${badWords.slice(0, 15).join(", ")}`);
  }

  parts.push(
    "",
    toneLine,
    prompt ? `User context: ${prompt}` : "User context: freestyle",
    "",
    "Your reply is ONE new name only. Fuse borg into a word (like LeBorg James). No labels, no sentences.",
  );

  return parts.join("\n");
}

function extractModelText(output: unknown) {
  if (typeof output === "string") return output;
  if (!output || typeof output !== "object") return "";

  const record = output as Record<string, unknown>;
  if (typeof record.response === "string") return record.response;

  const message = record.message;
  if (message && typeof message === "object" && "content" in message) {
    return String((message as { content: string }).content);
  }

  const choices = record.choices;
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === "object") {
    const first = choices[0] as {
      message?: { content?: string };
      text?: string;
    };
    if (first.message?.content) return first.message.content;
    if (first.text) return first.text;
  }

  return "";
}

async function callLocalModel(userMessage: string, extraInstruction = "") {
  const inferenceHost = Deno.env.get("AI_INFERENCE_API_HOST");
  if (!inferenceHost) {
    throw new Error(
      "BORG AI inference is not configured. Set AI_INFERENCE_API_HOST to your Ollama server (GPU/VRAM) and pull llama2-uncensored.",
    );
  }

  const session = new Supabase.ai.Session(BORG_AI_MODEL);
  const content = extraInstruction
    ? `${userMessage}\n\n${extraInstruction}`
    : userMessage;

  const output = await session.run(
    {
      messages: [
        { role: "system", content: BORG_AI_SYSTEM_PROMPT },
        { role: "user", content },
      ],
    },
    {
      mode: "ollama",
      stream: false,
      timeout: 90,
    },
  );

  const text = sanitizeModelName(extractModelText(output));
  if (!text) {
    throw new Error("Local model returned an empty BORG name.");
  }

  return text;
}

async function refundBorgAiGeneration(
  supabase: ReturnType<typeof createClient>,
) {
  const { data, error } = await supabase.rpc("refund_borg_ai_generation", {
    p_daily_limit: BORG_AI_DAILY_LIMIT,
  });

  if (error || !data || typeof data !== "object") {
    return null;
  }

  return {
    allowed: Boolean((data as { allowed?: boolean }).allowed),
    used: Number((data as { used?: number }).used ?? 0),
    limit: Number(
      (data as { limit?: number }).limit ?? BORG_AI_DAILY_LIMIT,
    ),
    remaining: Number(
      (data as { remaining?: number }).remaining ?? BORG_AI_DAILY_LIMIT,
    ),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authHeader = req.headers.get("Authorization");

  if (!supabaseUrl || !supabaseAnonKey || !authHeader) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  const { data: usageResult, error: usageError } = await supabase.rpc(
    "consume_borg_ai_generation",
    { p_daily_limit: BORG_AI_DAILY_LIMIT },
  );

  let usage = {
    allowed: true,
    used: 0,
    limit: BORG_AI_DAILY_LIMIT,
    remaining: BORG_AI_DAILY_LIMIT,
  };

  if (usageError) {
    const message = usageError.message ?? "Unknown database error.";
    if (!isMissingLimitRpc(message)) {
      return jsonResponse(
        { error: `Could not verify BORG AI daily limit: ${message}` },
        500,
      );
    }
  } else if (usageResult && typeof usageResult === "object") {
    usage = {
      allowed: Boolean((usageResult as { allowed?: boolean }).allowed),
      used: Number((usageResult as { used?: number }).used ?? 0),
      limit: Number(
        (usageResult as { limit?: number }).limit ?? BORG_AI_DAILY_LIMIT,
      ),
      remaining: Number(
        (usageResult as { remaining?: number }).remaining ??
          BORG_AI_DAILY_LIMIT,
      ),
    };

    if (!usage.allowed) {
      return jsonResponse(
        {
          error:
            (usageResult as { error?: string }).error ??
            `Daily BORG AI limit reached (${usage.used}/${usage.limit}).`,
          used: usage.used,
          limit: usage.limit,
          remaining: 0,
          allowed: false,
        },
        429,
      );
    }
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const blockedNames = Array.isArray(body.blockedNames)
    ? body.blockedNames.filter((name) => typeof name === "string")
    : [];
  const badNames = Array.isArray(body.badNames)
    ? body.badNames.filter((name) => typeof name === "string")
    : [];
  const avoidNames = [...blockedNames, ...badNames];

  if (blockedNames.length === 0) {
    return jsonResponse({ error: "Blocked catalog names are required." }, 400);
  }

  const userMessage = buildUserMessage(body);
  const maxAttempts = 3;

  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const extraInstruction =
        attempt === 1
          ? ""
          : attempt === 2
            ? "Invalid. Reply with ONLY the borg name on one line. No sentences. No emojis. Example: LeBorg James"
            : "Name only. One line. Must contain borg. No other text.";

      const candidate = await callLocalModel(userMessage, extraInstruction);
      if (!isValidModelName(candidate)) continue;
      if (!isBlocked(candidate, avoidNames)) {
        return jsonResponse({
          name: candidate,
          used: usage.used,
          limit: usage.limit,
          remaining: usage.remaining,
          allowed: true,
        });
      }
    }

    const refunded = await refundBorgAiGeneration(supabase);
    const finalUsage = refunded ?? usage;

    return jsonResponse(
      {
        error:
          "Could not generate a unique BORG name. Try different context and generate again.",
        used: finalUsage.used,
        limit: finalUsage.limit,
        remaining: finalUsage.remaining,
        allowed: finalUsage.remaining > 0,
      },
      422,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "BORG AI generation failed.";
    const refunded = await refundBorgAiGeneration(supabase);
    const finalUsage = refunded ?? usage;
    return jsonResponse(
      {
        error: message,
        used: finalUsage.used,
        limit: finalUsage.limit,
        remaining: finalUsage.remaining,
        allowed: finalUsage.remaining > 0,
      },
      500,
    );
  }
});
