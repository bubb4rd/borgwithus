// Prompt building, the model call and name filtering for BORG AI, shared by generate-borg-name
// (member rolls) and borg-ai-studio (admin test batches). Uses no Deno or Supabase APIs.

// Every line of the prompt costs model read time and is one more thing for a 7B model to echo
// back, so a request carries only the system prompt, a short format demo and the theme.
export const BATCH_SIZE = 5;
const FORMAT_EXAMPLES = 3;
const MAX_USED_IN_PROMPT = 8;
const MODEL_TIMEOUT_MS = 60_000;
/** The user turn of the format demo; its examples come from every topic. */
export const DEMO_THEME = "Theme: anything goes";

/** A BORG name and the real name or phrase it riffs on. */
export type Pair = { original: string; name: string };

/** One line of the model's reply: the original it picked and its BORG name, null when unusable. */
export type Draft = { original: string; name: string | null };

/** A BORG name on offer and who made it: the model's own line, or the code's swap of its original. */
export type Candidate = Pair & { source: "model" | "code" };

export const STYLE_PAIRS: Pair[] = [
  { original: "Ron Burgundy", name: "Ron Borgundy" },
  { original: "LeBron James", name: "LeBorg James" },
  { original: "Pablo Escobar", name: "Pablo Escoborg" },
  { original: "Playboi Carti", name: "Playborg Carti" },
  { original: "SpongeBob", name: "SpongeBorg" },
  { original: "Heisenberg", name: "Heisenborg" },
  { original: "Morgan Freeman", name: "Borgan Freeman" },
  { original: "Mark Zuckerberg", name: "Mark Zuckerborg" },
  { original: "Pearl Harbor", name: "Pearl Harborg" },
  { original: "Kareem Abdul-Jabbar", name: "Kareem Abdul-Jaborg" },
];

// Picked at random when the member leaves the theme blank, so blank rolls don't all start from
// the same prompt and land on the same handful of names. Topics whose famous names carry a sound
// codeSwap can turn into borg (bor, bur, ber, bar, or…) give more usable batches; Studio ratings
// store the topic (borg_ai_ratings.topic), so keep or cut topics by their rating there.
export const TOPICS = [
  "NBA players",
  "NFL players and teams",
  "soccer stars",
  "rappers",
  "pop stars",
  "rock bands",
  "90s movies",
  "horror movies",
  "Disney and Pixar",
  "cartoon characters",
  "The Simpsons",
  "TV shows",
  "reality TV",
  "video games",
  "Pokémon",
  "Star Wars",
  "Lord of the Rings and Harry Potter",
  "Marvel and DC heroes",
  "villains",
  "US presidents and politicians",
  "historical events",
  "festivals and holidays",
  "world cities and landmarks",
  "countries",
  "dinosaurs and wild animals",
  "fast food chains",
  "snacks and candy",
  "drinks and booze",
  "luxury and car brands",
  "tech companies and CEOs",
  "scientists and inventors",
  "famous artists and paintings",
  "classic books and authors",
  "internet memes",
];

export const SYSTEM_PROMPT = `You make BORG names: a famous person, place, brand, title or phrase with one sound swapped for "borg" so it still sounds like the original out loud.
- Swap a sound like bor, bur, bar, ber, burg or bro. Never tack borg on: "Taylor Swift -> Taylorborg" is wrong.
- Left of the arrow: the real original, never containing borg. Right: the same words with one sound swapped.
- Instantly recognisable originals: sports, rap, memes, movies, internet culture. Crude, chaotic humour is fine.
- Every line a different original. Skip originals and names you were told are used.
Reply with {count} lines in the form: Original -> BORG name
Nothing else: no numbering, no quotes, no explanation.`;

/**
 * What a prompt version controls. `{count}` in the system prompt stands for BATCH_SIZE;
 * `formatCount` pairs from `formatExamples` (at most BATCH_SIZE) make up the format demo.
 */
export type PromptConfig = {
  systemPrompt: string;
  temperature: number;
  formatExamples: Pair[];
  formatCount: number;
};

export const BUILT_IN_PROMPT: PromptConfig = {
  systemPrompt: SYSTEM_PROMPT,
  temperature: 1,
  formatExamples: STYLE_PAIRS,
  formatCount: FORMAT_EXAMPLES,
};

/**
 * The PromptConfig for a get_borg_ai_prompt() result, or null when it names no version. With the
 * example pool switched off entirely, the built-in pairs still show the model the format.
 */
export function storedPrompt(stored: unknown): (PromptConfig & { id: number; version: number }) | null {
  const { prompt, examples } = (stored ?? {}) as {
    prompt?: { id: number; version: number; system_prompt: string; temperature: number | string; example_count: number } | null;
    examples?: Pair[];
  };
  if (!prompt) return null;
  return {
    id: prompt.id,
    version: prompt.version,
    systemPrompt: prompt.system_prompt,
    temperature: Number(prompt.temperature),
    formatExamples: examples?.length ? examples : STYLE_PAIRS,
    formatCount: prompt.example_count,
  };
}

// Letters and digits only, padded so `includes` matches whole words:
// " ron borgundy bears " contains the existing name " ron borgundy ".
function wordKey(name: string) {
  return ` ${name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

// Letters and digits only, no spaces: "Sponge Borg" and "SpongeBorg" share one key.
function compactKey(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const CHATTER = /\b(here'?s|here is|sure|okay|i can|i'm|let me|how about|name:|borg name)\b/i;

function cleanCandidate(text: string) {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, "")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/^(?:\s*(?:[*\-•>#]+|\d+[.)]))*\s*/, "")
    .replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, "")
    .replace(/[.!?,;:]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isUsableName(name: string) {
  if (name.length < 3 || name.length > 60) return false;
  if (name.split(" ").length > 6) return false;
  if (CHATTER.test(name)) return false;
  // "borg" has to be fused into a word (LeBorg, Heisenborg), not just mentioned.
  return /\w+borg|borg\w+/i.test(name);
}

const ARROW = /\s*(?:-+>|→|=>|[–—]>)\s*/;

// Some replies label each side instead of using an arrow, on two lines ("Original: Halo" then
// "BORG name: Halborg") or one ("Original: Halo, BORG name: Halborg"). Each such pair is rewritten
// as "Halo -> Halborg" before the arrow parsing below.
const LABELLED_PAIR =
  /^[^\S\n]*(?:[*\-•>#]+[^\S\n]*|\d+[.)][^\S\n]*)?\**original\**[^\S\n]*[:=–—-][^\S\n]*([^\n|]+?)[^\S\n]*(?:[\n|,;][^\S\n]*)+\**(?:borg(?:ed)?(?:[^\S\n]+name)?|name)\**[^\S\n]*[:=–—-][^\S\n]*([^\n|]+)/gim;

// Models list "Original -> Name" pairs one per line, or on one line split by "|" or commas, and
// pad them with chatter, quotes, labels ("Original: …") and asides ("Name (Theme)"). Lines
// without an arrow count when a single spaced dash splits them ("Donald Trump - Don Borgump"),
// and labelled pairs count as above. The original is what follows the last label; for the name,
// the shortest fragment that still reads as a borg name wins, or null when none does (code can
// still swap the original). Returns one draft per usable original, without repeats.
export function extractDrafts(raw: string) {
  const drafts = new Map<string, Draft>();
  const text = raw.replace(LABELLED_PAIR, "$1 -> $2");
  for (const entry of text.split(/\r?\n|\||,\s+/)) {
    let sides = entry.split(ARROW);
    if (sides.length === 1) sides = entry.split(/\s+[-–—]\s+/);
    if (sides.length !== 2) continue;
    const original = cleanCandidate(sides[0].split(/:\s+/).at(-1)!);
    // Originals are real names: one holding "borg" is the model getting confused, and "Original"
    // is it echoing the format line.
    if (
      original.length < 2 ||
      original.length > 60 ||
      /borg/i.test(original) ||
      compactKey(original) === "original" ||
      drafts.has(compactKey(original))
    ) {
      continue;
    }
    const candidates = [...sides[1].matchAll(/["“]([^"”]{3,60})["”]/g)].map((match) => match[1]);
    candidates.push(sides[1], ...sides[1].split(/:\s+|[!?]\s+|\s+[-–—]\s+/));
    const name = candidates
      .map(cleanCandidate)
      .filter(isUsableName)
      .sort((a, b) => a.length - b.length)[0];
    drafts.set(compactKey(original), { original, name: name ?? null });
  }
  return [...drafts.values()];
}

export type AvoidEntry = { words: string; compact: string };

export function avoidEntries(names: unknown[]): AvoidEntry[] {
  return names
    .filter((name): name is string => typeof name === "string" && /[a-z0-9]/i.test(name))
    .map((name) => ({ words: wordKey(name), compact: compactKey(name) }));
}

// Whether a and b are at most `max` single-letter edits apart (Levenshtein), bailing out as soon
// as every path is over budget.
function withinEdits(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  let cur = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return false;
    [prev, cur] = [cur, prev];
  }
  return prev[b.length] <= max;
}

/**
 * True when `name` repeats an existing name: one contains the other as whole words
 * ("Ron Borgundy Bears" and "Ron Borgundy"), or it is a respelling, one edit per 5 letters of the
 * shorter name, at least one ("Borgan Freemon" for "Borgan Freeman", "Sponge Borgs" for
 * "SpongeBorg").
 */
export function isNearDuplicate(name: string, avoid: AvoidEntry[]) {
  const words = wordKey(name);
  const compact = compactKey(name);
  return avoid.some(
    (entry) =>
      words.includes(entry.words) ||
      entry.words.includes(words) ||
      withinEdits(compact, entry.compact, Math.max(1, Math.floor(Math.min(compact.length, entry.compact.length) / 5))),
  );
}

function sample<T>(items: T[], count: number, random: () => number) {
  const pool = [...items];
  const picked: T[] = [];
  while (picked.length < count && pool.length) {
    picked.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  return picked;
}

/** Length of the longest common subsequence of a and b. */
function commonSubsequence(a: string, b: string) {
  let prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const cur = [0];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * True when `name` is `original` with one sound swapped for "borg": the same number of words,
 * everything before and after the borg spelled as in the original, and the part borg replaced
 * 1-6 letters (other than "borg" itself) that sound like it: starting with b/p, holding an o or a
 * vowel + r, or sharing two letters with "borg" in order ("burg", "bron", "boi", "god", "kar",
 * "trig"). Tacked-on borgs ("Taylor Swift -> Taylorborg", "Hulk -> Hulkborg"), squashed words
 * ("Tupac Shakur -> Tupacshakborg") and riffs on some other original fail.
 */
export function swapsSound({ original, name }: Pair) {
  if (original.trim().split(/[\s-]+/).length !== name.trim().split(/[\s-]+/).length) return false;
  const o = compactKey(original);
  const n = compactKey(name);
  for (let at = n.indexOf("borg"); at !== -1; at = n.indexOf("borg", at + 1)) {
    const before = n.slice(0, at);
    const after = n.slice(at + 4);
    if (o.length <= before.length + after.length || !o.startsWith(before) || !o.endsWith(after)) continue;
    const swapped = o.slice(before.length, o.length - after.length);
    if (swapped.length > 6 || swapped === "borg") continue;
    if (/^[bp]|o|[aeiuy]r/.test(swapped) || commonSubsequence(swapped, "borg") >= 2) return true;
  }
  return false;
}

// Sounds borg can stand in for: b/p + vowels + r (+ a closing g/k/d/b/t), a consonant + vowel + r
// (+ g/k/d/b), or b + vowels (+ b/g/r).
const SWAPPABLE = /[bp][aeiouy]*r[gkdbt]?|[b-df-hj-np-tv-z]?[aeiou]r[gkdb]?|b[aeiouy]+[bgr]?/gi;

/**
 * The code's own BORG name for `original`: every borg-like sound is a candidate swap, scored by
 * how close it sounds (b/p start, vowel + r, an o) and whether it starts a word, so
 * "Sarah Jessica Parker" becomes "Sarah Jessica Borger" rather than "Borgah Jessica Parker".
 * Swaps that leave fewer than 3 letters, or less than half, of the original ("Ford -> Borg",
 * "Thor -> Tborg") don't count, nor do ones that strand consonants against borg within the word
 * ("Lucky Charms -> Lucky Cborgms", "Corn Flakes -> Borgn Flakes"; a plural s is fine). Null when
 * nothing qualifies.
 */
export function codeSwap(original: string) {
  const length = compactKey(original).length;
  let best: { name: string; score: number } | null = null;
  for (const match of original.matchAll(SWAPPABLE)) {
    const at = match.index!;
    const sound = match[0].toLowerCase();
    const kept = length - sound.length;
    if (kept < 3 || kept * 2 < length) continue;
    const head = original.slice(0, at).match(/[a-z]*$/i)![0];
    const tail = original.slice(at + sound.length).match(/^[a-z]*/i)![0].replace(/s$/i, "");
    if ((head && !/[aeiouy]/i.test(head)) || (tail && !/[aeiouy]/i.test(tail))) continue;
    const borg = original[at] === original[at].toUpperCase() ? "Borg" : "borg";
    const name = original.slice(0, at) + borg + original.slice(at + sound.length);
    if (!isUsableName(name) || !swapsSound({ original, name })) continue;
    const score =
      (/^[bp]/.test(sound) ? 2 : 0) +
      (/[aeiouy]r/.test(sound) ? 2 : 0) +
      (sound.includes("o") ? 1 : 0) +
      (head ? 0 : 1);
    if (!best || score > best.score) best = { name, score };
  }
  return best?.name ?? null;
}

export type Avoid = { names: AvoidEntry[]; originals: AvoidEntry[] };

/**
 * Why an original the model picked offers no name at all: it repeats a known original, its only
 * names repeat known ones, or the model wrote no usable name and the code couldn't swap it.
 */
export type LostReason = "known-original" | "known-name" | "no-name";

/**
 * Turns a batch of drafts into BORG names. Each fresh original (one that repeats nothing in
 * `avoid` or earlier in the batch) offers up to two swaps, the model's own when it really swaps a
 * sound (`swapsSound`) and the code's (`codeSwap`), plus the model's name as a tacked-on fallback
 * when it doesn't. Names that repeat a known one are skipped. `pair` is a random swap, else a
 * random tacked-on name (a weak name beats an empty roll), else null. `repeats` holds drafts whose
 * original or model name was already known; `lost` holds every draft that offers nothing, and why.
 */
export function pickPair(drafts: Draft[], avoid: Avoid, random = Math.random) {
  const swaps: Candidate[] = [];
  const tackedOn: Candidate[] = [];
  const repeats: Draft[] = [];
  const lost: (Draft & { reason: LostReason })[] = [];
  const taken: Avoid = { names: [], originals: [] };
  const isKnownName = (name: string) => isNearDuplicate(name, avoid.names) || isNearDuplicate(name, taken.names);
  for (const draft of drafts) {
    const { original, name } = draft;
    if (isNearDuplicate(original, avoid.originals) || isNearDuplicate(original, taken.originals)) {
      repeats.push(draft);
      lost.push({ ...draft, reason: "known-original" });
      continue;
    }
    const modelName = name && !isKnownName(name) ? name : null;
    if (name && !modelName) repeats.push(draft);
    const offered: Candidate[] = [];
    if (modelName && swapsSound({ original, name: modelName })) {
      offered.push({ original, name: modelName, source: "model" });
    }
    const coded = codeSwap(original);
    const codedKnown = coded !== null && isKnownName(coded);
    if (coded && !codedKnown && compactKey(coded) !== compactKey(modelName ?? "")) {
      offered.push({ original, name: coded, source: "code" });
    }
    swaps.push(...offered);
    if (modelName && !offered.some((pair) => pair.name === modelName)) {
      tackedOn.push({ original, name: modelName, source: "model" });
      offered.push({ original, name: modelName, source: "model" });
    }
    if (!offered.length) {
      lost.push({ ...draft, reason: (name && !modelName) || codedKnown ? "known-name" : "no-name" });
      continue;
    }
    taken.originals.push(...avoidEntries([original]));
    taken.names.push(...avoidEntries(offered.map((pair) => pair.name)));
  }
  const best = swaps.length ? swaps : tackedOn;
  return { pair: best.length ? best[Math.floor(random() * best.length)] : null, swaps, tackedOn, repeats, lost };
}

export type PromptInput = {
  config: PromptConfig;
  /** The member's theme, already trimmed; empty for a random topic. */
  prompt: string;
  /** The topic to use when the theme is empty, instead of a random one (Studio comparisons). */
  topic?: string | null;
  /** Drafts this request already threw out as repeats; listed to the model on retries only. */
  repeats: Draft[];
  attempt: number;
};

/** Where the swap sits in a BORG name: at its start (Borgan Freeman), its end (Heisenborg) or between. */
export function swapPosition(name: string): "start" | "middle" | "end" {
  const key = compactKey(name);
  if (key.startsWith("borg")) return "start";
  return /borgs?$/.test(key) ? "end" : "middle";
}

/**
 * Up to `count` pairs for the format demo: real sound swaps only (`swapsSound`), taken in turn
 * from start, middle and end swaps so the model sees borg land in different places. The built-in
 * pairs stand in when no pair in `pairs` is a real swap.
 */
export function formatDemo(pairs: Pair[], count: number, random = Math.random) {
  const swaps = pairs.filter(swapsSound);
  const groups = new Map<string, Pair[]>();
  for (const pair of sample(swaps.length ? swaps : STYLE_PAIRS, Infinity, random)) {
    const position = swapPosition(pair.name);
    groups.set(position, [...(groups.get(position) ?? []), pair]);
  }
  const turns = sample([...groups.values()], groups.size, random);
  const picked: Pair[] = [];
  while (picked.length < count && turns.some((group) => group.length)) {
    for (const group of turns) {
      if (picked.length < count && group.length) picked.push(group.shift()!);
    }
  }
  return picked;
}

/**
 * The chat messages for one batch, and the random topic picked when the theme is blank. The
 * format examples go in as an earlier exchange (a "Theme: anything goes" turn answered with
 * example lines), which Llama 2 chat models copy more reliably than a list in the request. The
 * names a retry must not repeat are only listed from attempt 2, from this request's repeats:
 * `pickPair` already checks every batch against the site's names in code.
 */
export function buildMessages({ config, prompt, topic: forcedTopic, repeats, attempt }: PromptInput, random = Math.random) {
  const topic = prompt ? null : forcedTopic || sample(TOPICS, 1, random)[0];
  const messages = [{ role: "system", content: config.systemPrompt.replaceAll("{count}", String(BATCH_SIZE)) }];
  const demo = formatDemo(config.formatExamples, Math.min(config.formatCount, BATCH_SIZE), random);
  if (demo.length) {
    messages.push(
      { role: "user", content: DEMO_THEME },
      { role: "assistant", content: demo.map(({ original, name }) => `${original} -> ${name}`).join("\n") },
    );
  }
  const lines: string[] = [];
  if (attempt > 1) {
    const originals = repeats.map(({ original }) => original);
    const names = repeats.flatMap(({ name }) => (name ? [name] : []));
    if (originals.length) lines.push(`Used originals: ${originals.slice(0, MAX_USED_IN_PROMPT).join(" | ")}`);
    if (names.length) lines.push(`Used names: ${names.slice(0, MAX_USED_IN_PROMPT).join(" | ")}`);
  }
  lines.push(prompt ? `Theme from the user: ${prompt}` : `Theme: ${topic}`);
  if (attempt > 1) {
    lines.push("Reply with ONLY the new lines, each in the form: Original -> BORG name");
  }
  messages.push({ role: "user", content: lines.join("\n") });
  return { topic, messages };
}

/** Where the Ollama model runs. `apiKey` is sent as a Bearer token (Runpod requires one). */
export type ModelServer = { host: string; apiKey?: string };

/** AI_INFERENCE_API_HOST and the optional AI_INFERENCE_API_KEY, or null when no host is set. */
export function modelServer(): ModelServer | null {
  const host = Deno.env.get("AI_INFERENCE_API_HOST")?.replace(/\/$/, "");
  if (!host) return null;
  return { host, apiKey: Deno.env.get("AI_INFERENCE_API_KEY") || undefined };
}

export async function askModel(
  server: ModelServer,
  model: string,
  messages: { role: string; content: string }[],
  temperature: number,
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (server.apiKey) headers.Authorization = `Bearer ${server.apiKey}`;
  const response = await fetch(`${server.host}/api/chat`, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
    body: JSON.stringify({
      model,
      stream: false,
      // A batch of 5 pairs fits in ~75 tokens; the cap stops a rambling model from running into
      // the timeout. keep_alive keeps it loaded between rolls instead of the default 5 minutes, so
      // a quiet spell doesn't cost the next member a cold start.
      keep_alive: "30m",
      options: { temperature, num_predict: 90 },
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`Model request failed (${response.status}): ${(await response.text()).slice(0, 200)}`);
  }

  const output: { message?: { content?: unknown } } = await response.json();
  return typeof output.message?.content === "string" ? output.message.content : "";
}
