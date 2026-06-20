import type { AiTone } from "../context/AuthContext";

export const BORG_AI_SYSTEM_PROMPT = `You are a BORG name generator. You output ONE borg name per request. Nothing else.

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
- Your entire reply is ONLY the borg name. One line.
- NO sentences. NO greetings. NO "here's one". NO emojis. NO explanations.
- NO labels, colons, quotes, or punctuation at the end.
- Good: LeBorg James
- Good: The Pornfession of Borg
- Bad: Totally got it! Here's one for you... LeBorg James!
- Bad: DAN ASSIGNMENT: LeBorg James
- Never copy names from the blocked list.`;

const LABEL_PREFIX =
  /^(?:\[[^\]]+\]\s*)?(?:dan assignment|dan|borg name|name|assignment|response|answer|output|here(?:'s| is)(?: one)?(?: for you)?)\s*[:.\-]*\s*/i;

const PROMPT_ECHO =
  /\b(good examples?|from the borg list|blocked|never reuse|disliked|avoid themes|style only|context:|tone:|output the|catalog names|do not copy|do not use|user context)\b/i;

function hasBorgSubstitution(name: string) {
  return name.split(/\s+/).some((word) => /(?:\w+borg|borg\w+)/i.test(word));
}

const CONVERSATIONAL =
  /\b(totally|here'?s one|got it|for you|sure thing|okay|let me|i can|happy to|one for you)\b/i;

function removeEmojis(text: string) {
  return text.replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, "").trim();
}

function stripLabelPrefixes(text: string) {
  let value = removeEmojis(text.trim());
  for (let i = 0; i < 3; i++) {
    const next = value.replace(LABEL_PREFIX, "").trim();
    if (next === value) break;
    value = next;
  }
  return value.replace(/^["'`]+|["'`]+$/g, "").replace(/[.!?,;:]+$/g, "").trim();
}

function cleanCandidate(text: string) {
  return stripLabelPrefixes(text)
    .replace(/^[\s"'“”‘’\-–—]+|[\s"'“”‘’\-–—]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractBorgCandidates(raw: string): string[] {
  const cleaned = removeEmojis(raw.replace(/\r/g, " "));
  const candidates: string[] = [];

  for (const match of cleaned.matchAll(/["“']([^"”']*borg[^"”']*)["”']/gi)) {
    candidates.push(cleanCandidate(match[1]));
  }

  for (const match of cleaned.matchAll(
    /(?:\.{2,}|!\s*|:\s*)\s*([^.!?\n]{2,80})/gi,
  )) {
    const part = cleanCandidate(match[1]);
    if (/borg/i.test(part)) candidates.push(part);
  }

  const segments = cleaned.split(/[!?\n]+/).flatMap((part) => part.split(/\.\.\./));
  for (const segment of segments) {
    for (const match of segment.matchAll(
      /([A-Za-z0-9][A-Za-z0-9\s'’\-]*borg[A-Za-z0-9\s'’\-]*)/gi,
    )) {
      candidates.push(cleanCandidate(match[1]));
    }
  }

  if (/borg/i.test(cleaned)) {
    candidates.push(cleanCandidate(cleaned));
  }

  return [...new Set(candidates.filter(Boolean))];
}

function isLabelOnlyLine(line: string) {
  return /^(?:dan assignment|dan|assignment|response|answer|output)\s*:?\s*$/i.test(
    line,
  );
}

export function sanitizeBorgAiName(raw: string) {
  const extracted = extractBorgCandidates(raw);
  const sorted = extracted.sort((a, b) => a.length - b.length);

  for (const candidate of sorted) {
    if (isValidBorgAiName(candidate)) return candidate;
  }

  const lines = raw
    .split("\n")
    .map((line) => cleanCandidate(line))
    .filter(Boolean);

  for (const line of lines) {
    if (isLabelOnlyLine(line)) continue;
    if (isValidBorgAiName(line)) return line;
  }

  return "";
}

export function isValidBorgAiName(name: string) {
  const trimmed = cleanCandidate(name);
  if (!trimmed || trimmed.length < 3 || trimmed.length > 80) return false;
  if (/^dan assignment/i.test(trimmed)) return false;
  if (PROMPT_ECHO.test(trimmed)) return false;
  if (!hasBorgSubstitution(trimmed)) return false;
  if (CONVERSATIONAL.test(trimmed)) return false;
  if (/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u.test(trimmed)) return false;
  if (/[!?].*[!?]/.test(trimmed)) return false;
  if (/\.{2,}/.test(trimmed)) return false;
  if (trimmed.split(/\s+/).length > 10) return false;
  if (/^(totally|here|sure|okay|got|one for)/i.test(trimmed)) return false;
  return true;
}

export function normalizeBorgNameForMatch(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\u201C\u201D\u2018\u2019"'`]/g, "")
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isCatalogDuplicate(name: string, catalogNames: string[]) {
  const normalized = normalizeBorgNameForMatch(name);
  if (!normalized) return true;
  return catalogNames.some(
    (catalogName) => normalizeBorgNameForMatch(catalogName) === normalized,
  );
}

export function buildBorgAiUserMessage(input: {
  prompt: string;
  examples: string[];
  blockedNames: string[];
  badNames?: string[];
  badWords?: string[];
  tone: AiTone;
  extraInstruction?: string;
}) {
  const prompt = input.prompt.trim();
  const exampleLines = input.examples.map((name) => `- ${name}`).join("\n");
  const toneLine =
    input.tone === "clean"
      ? "Tone: PG-13, no vulgarity."
      : "Tone: edgy, chaotic, meme-aware.";

  const parts = [
    "STYLE REFERENCE (do not copy verbatim):",
    exampleLines || "- Ron Borgundy",
    "",
    `${input.blockedNames.length} catalog names are blocked — invent something new.`,
  ];

  if (input.badNames?.length) {
    parts.push(
      "",
      `User-disliked (${input.badNames.length}): ${input.badNames.slice(0, 20).join(" | ")}`,
    );
  }

  if (input.badWords?.length) {
    parts.push(
      "",
      `Avoid these themes: ${input.badWords.slice(0, 15).join(", ")}`,
    );
  }

  parts.push(
    "",
    toneLine,
    prompt ? `User context: ${prompt}` : "User context: freestyle",
    "",
    "Your reply is ONE new name only. Fuse borg into a word (like LeBorg James). No labels, no sentences.",
  );

  if (input.extraInstruction) {
    parts.push("", input.extraInstruction);
  }

  return parts.join("\n");
}
