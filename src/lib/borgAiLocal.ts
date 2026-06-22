import type { AiTone } from "../context/AuthContext";
import {
  BORG_AI_SYSTEM_PROMPT,
  buildBorgAiUserMessage,
  sanitizeBorgAiName,
} from "./borgAiPrompt";

const DEFAULT_MODEL = "llama3.2:3b";

function getLocalModel() {
  return import.meta.env.VITE_BORG_AI_MODEL?.trim() || DEFAULT_MODEL;
}

function getOllamaBaseUrl() {
  const configured = import.meta.env.VITE_OLLAMA_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://127.0.0.1:11434";
  throw new Error("VITE_OLLAMA_URL is not configured.");
}

export async function generateBorgNameViaLocalOllama(input: {
  prompt: string;
  examples: string[];
  blockedNames: string[];
  badNames?: string[];
  badWords?: string[];
  tone: AiTone;
  extraInstruction?: string;
}) {
  const userMessage = buildBorgAiUserMessage(input);
  let response: Response;

  try {
    response = await fetch(`${getOllamaBaseUrl()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: getLocalModel(),
        stream: false,
        messages: [
          { role: "system", content: BORG_AI_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });
  } catch {
    throw new Error(
      `Could not reach Ollama at ${getOllamaBaseUrl()}. Start Ollama, then run: ollama pull ${getLocalModel()}`,
    );
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      detail.includes("not found")
        ? `Model "${getLocalModel()}" not found. Run: ollama pull ${getLocalModel()}`
        : `Ollama request failed (${response.status}). Is Ollama running on ${getOllamaBaseUrl()}?`,
    );
  }

  const payload = await response.json();
  const content = payload?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Ollama returned an empty BORG name.");
  }

  return sanitizeBorgAiName(content);
}
