export type AIFeedback = "like" | "dislike";

export type AIFeedbackEntry = {
  id: string;
  name: string;
  prompt: string;
  feedback: AIFeedback;
  createdAt: string;
};

const FEEDBACK_KEY = "borgwithus-ai-feedback";

function loadFeedback(): AIFeedbackEntry[] {
  try {
    const raw = localStorage.getItem(FEEDBACK_KEY);
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
  const entries = loadFeedback();
  entries.unshift({
    id: crypto.randomUUID(),
    name,
    prompt,
    feedback,
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(entries.slice(0, 200)));
}
