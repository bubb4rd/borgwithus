import type { AiTone } from "../context/AuthContext";
import {
  BORG_AI_SYSTEM_PROMPT,
  buildBorgAiUserMessage,
  sanitizeBorgAiName,
} from "./borgAiPrompt";

const DEFAULT_MODEL = "llama2-uncensored";

function getLocalModel() {
  return import.meta.env.VITE_BORG_AI_MODEL?.trim() || DEFAULT_MODEL;
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
  const response = await fetch("/ollama/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: getLocalModel(),
      stream: false,
      temperature: 0.85,
      max_tokens: 32,
      messages: [
        { role: "system", content: BORG_AI_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      detail.includes("not found")
        ? `Model "${getLocalModel()}" not found. Run: ollama pull ${getLocalModel()}`
        : `Ollama request failed (${response.status}). Is Ollama running?`,
    );
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Ollama returned an empty BORG name.");
  }

  return sanitizeBorgAiName(content);
}
