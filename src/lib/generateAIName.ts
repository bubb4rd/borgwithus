import { getBorgAiBadList } from "./aiFeedback";
import type { AiTone } from "../context/AuthContext";
import { generateBorgNameViaLocalOllama } from "./borgAiLocal";
import { isCatalogDuplicate, isValidBorgAiName } from "./borgAiPrompt";
import { getBorgAiGoodExamples, getPoolForKind } from "./borgCatalog";
import { getSupabase, isSupabaseConfigured } from "./supabase";

const MAX_ATTEMPTS = 3;

function isLocalBorgAiDev() {
  if (import.meta.env.VITE_BORG_AI_USE_REMOTE === "true") return false;
  return import.meta.env.DEV && import.meta.env.VITE_BORG_AI_LOCAL === "true";
}

export const BORG_AI_DAILY_LIMIT = 5;

export type BorgAiUsage = {
  tracked: boolean;
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
};

export const UNTRACKED_BORG_AI_USAGE: BorgAiUsage = {
  tracked: false,
  allowed: true,
  used: 0,
  limit: 0,
  remaining: Number.POSITIVE_INFINITY,
};

export type BorgAiGenerateResult = {
  name: string;
  usage: BorgAiUsage;
};

export class BorgAiError extends Error {
  usage?: BorgAiUsage;

  constructor(message: string, usage?: BorgAiUsage) {
    super(message);
    this.name = "BorgAiError";
    this.usage = usage;
  }
}

async function getInvokeErrorMessage(error: unknown, data: unknown) {
  if (data && typeof data === "object" && "error" in data) {
    return String((data as { error: string }).error);
  }

  if (error && typeof error === "object" && "context" in error) {
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const body = await context.clone().json();
        if (body && typeof body === "object" && "error" in body) {
          return String((body as { error: string }).error);
        }
      } catch {
        // Fall through to generic message handling.
      }
    }
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }

  return "BORG AI request failed.";
}

function parseUsagePayload(data: unknown): BorgAiUsage | undefined {
  if (!data || typeof data !== "object") return undefined;
  const record = data as Record<string, unknown>;
  if (
    typeof record.used !== "number" ||
    typeof record.limit !== "number" ||
    typeof record.remaining !== "number"
  ) {
    return undefined;
  }

  return {
    tracked: true,
    allowed: Boolean(record.allowed),
    used: record.used,
    limit: record.limit,
    remaining: record.remaining,
  };
}

function defaultUsage(overrides: Partial<BorgAiUsage> = {}): BorgAiUsage {
  return {
    tracked: true,
    allowed: true,
    used: 0,
    limit: BORG_AI_DAILY_LIMIT,
    remaining: BORG_AI_DAILY_LIMIT,
    ...overrides,
  };
}

function isMissingLimitRpc(message: string) {
  return (
    message.includes("consume_borg_ai_generation") ||
    message.includes("refund_borg_ai_generation") ||
    message.includes("get_borg_ai_usage") ||
    message.includes("schema cache")
  );
}

async function getSupabaseSession() {
  if (!isSupabaseConfigured) return null;

  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

async function consumeBorgAiGeneration() {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("consume_borg_ai_generation", {
    p_daily_limit: BORG_AI_DAILY_LIMIT,
  });

  if (error) {
    const message = error.message ?? "Could not verify BORG AI daily limit.";
    if (isMissingLimitRpc(message)) {
      return defaultUsage({ used: 0, remaining: BORG_AI_DAILY_LIMIT });
    }
    throw new BorgAiError(message);
  }

  const usage = parseUsagePayload(data) ?? defaultUsage();
  if (!usage.allowed) {
    throw new BorgAiError(
      (data as { error?: string })?.error ??
        `Daily BORG AI limit reached (${usage.used}/${usage.limit}).`,
      usage,
    );
  }

  return usage;
}

async function refundBorgAiGeneration(): Promise<BorgAiUsage | undefined> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc("refund_borg_ai_generation", {
    p_daily_limit: BORG_AI_DAILY_LIMIT,
  });

  if (error) {
    return undefined;
  }

  return parseUsagePayload(data);
}

export async function getBorgAiUsage(): Promise<BorgAiUsage | null> {
  const session = await getSupabaseSession();
  if (!session) return null;

  const { data, error } = await getSupabase().rpc("get_borg_ai_usage", {
    p_daily_limit: BORG_AI_DAILY_LIMIT,
  });

  if (error) {
    return defaultUsage();
  }

  return parseUsagePayload(data) ?? defaultUsage();
}

async function generateViaCloudFunction(
  supabase: ReturnType<typeof getSupabase>,
  body: {
    prompt: string;
    examples: string[];
    blockedNames: string[];
    badNames: string[];
    badWords: string[];
    tone: AiTone;
  },
) {
  return supabase.functions.invoke("generate-borg-name", { body });
}

async function failGeneration(message: string, usage: BorgAiUsage): Promise<never> {
  if (!usage.tracked) {
    throw new BorgAiError(message, usage);
  }

  const refundedUsage = (await refundBorgAiGeneration()) ?? usage;
  throw new BorgAiError(message, refundedUsage);
}

async function generateViaLocalOllama(input: {
  prompt: string;
  tone: AiTone;
  examples: string[];
  blockedNames: string[];
  badNames: string[];
  badWords: string[];
  avoidNames: string[];
  usage: BorgAiUsage;
}): Promise<BorgAiGenerateResult> {
  let lastError = "BORG AI generation failed.";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const extraInstruction =
        attempt === 1
          ? undefined
          : attempt === 2
            ? "Invalid. Reply with ONLY the borg name on one line. No sentences. No emojis. Example: LeBorg James"
            : "Name only. One line. Must contain borg. No other text.";

      const name = await generateBorgNameViaLocalOllama({
        prompt: input.prompt,
        examples: input.examples,
        blockedNames: input.blockedNames,
        badNames: input.badNames,
        badWords: input.badWords,
        tone: input.tone,
        extraInstruction,
      });

      if (!isValidBorgAiName(name)) {
        lastError = "Model returned an invalid BORG name format.";
        continue;
      }

      if (isCatalogDuplicate(name, input.avoidNames)) {
        lastError = "Model returned a blocked or disliked BORG name.";
        continue;
      }

      return { name, usage: input.usage };
    } catch (error) {
      lastError =
        error instanceof Error ? error.message : "BORG AI generation failed.";
      break;
    }
  }

  return failGeneration(lastError, input.usage);
}

export async function generateAIName(
  prompt: string,
  tone: AiTone = "funny",
): Promise<BorgAiGenerateResult> {
  const blockedNames = getPoolForKind("borg");
  if (blockedNames.length === 0) {
    throw new BorgAiError("No BORG catalog names are available.");
  }

  const examples = getBorgAiGoodExamples();
  if (examples.length === 0) {
    throw new BorgAiError("No BORG example names are available.");
  }

  const badList = await getBorgAiBadList();
  const avoidNames = [...blockedNames, ...badList.names];
  const session = await getSupabaseSession();
  const tracked = Boolean(session);

  if (isLocalBorgAiDev()) {
    const usage = tracked
      ? await consumeBorgAiGeneration()
      : UNTRACKED_BORG_AI_USAGE;

    return generateViaLocalOllama({
      prompt,
      tone,
      examples,
      blockedNames,
      badNames: badList.names,
      badWords: badList.words,
      avoidNames,
      usage,
    });
  }

  if (!isSupabaseConfigured || !session) {
    throw new BorgAiError("Sign in to use BORG AI.");
  }

  const supabase = getSupabase();
  const { data, error } = await generateViaCloudFunction(supabase, {
    prompt,
    examples,
    blockedNames,
    badNames: badList.names,
    badWords: badList.words,
    tone,
  });

  const responseUsage = parseUsagePayload(data) ?? defaultUsage();

  if (error) {
    const message = await getInvokeErrorMessage(error, data);
    const usageFromError = parseUsagePayload(data);
    throw new BorgAiError(message, usageFromError);
  }

  if (data && typeof data === "object" && "error" in data) {
    const payload = data as { error: string };
    const message = String(payload.error);
    throw new BorgAiError(message, responseUsage);
  }

  const name =
    data && typeof data === "object" && "name" in data
      ? String((data as { name: string }).name).trim()
      : "";

  if (!name) {
    await failGeneration("BORG AI returned an empty name.", responseUsage);
  }

  if (isCatalogDuplicate(name, avoidNames)) {
    await failGeneration(
      "BORG AI returned a blocked or disliked name.",
      responseUsage,
    );
  }

  return {
    name,
    usage:
      responseUsage ??
      defaultUsage({ used: 1, remaining: BORG_AI_DAILY_LIMIT - 1 }),
  };
}
