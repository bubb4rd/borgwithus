import { getActiveUserStorageId, userStorageKey } from "./userStorage";

export type AIFeedback = "like" | "dislike";

export type AIFeedbackEntry = {
  id: string;
  name: string;
  prompt: string;
  feedback: AIFeedback;
  createdAt: string;
};

const FEEDBACK_BASE = "borgwithus-ai-feedback";

function loadFeedback(): AIFeedbackEntry[] {
  if (!getActiveUserStorageId()) return [];

  try {
    const raw = localStorage.getItem(userStorageKey(FEEDBACK_BASE));
    if (!raw) return [];
    return JSON.parse(raw) as AIFeedbackEntry[];
  } catch {
    return [];
  }
}

export function recordAIFeedback(
  name: string,
  prompt: string,
  feedback: AIFeedback
) {
  if (!getActiveUserStorageId()) return;

  const entries = loadFeedback();
  entries.unshift({
    id: crypto.randomUUID(),
    name,
    prompt,
    feedback,
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem(
    userStorageKey(FEEDBACK_BASE),
    JSON.stringify(entries.slice(0, 200))
  );
}
