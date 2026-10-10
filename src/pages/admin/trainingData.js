import { BATCH_SIZE, nameKey } from "./studioApi";

// Builds fine-tuning files for BORG AI from get_borg_ai_training_data() (see
// supabase/migrations/20261016000000_borg_ai_training.sql and training/README.md).
//   sft  one chat per theme and batch of up to BATCH_SIZE pairs, shaped like a real roll: the
//        system prompt, the theme, and the "Original -> BORG name" lines a good reply has
//   dpo  one preference per ✏️ fix: the fixed name chosen over the name the model wrote

/** Pairs worth teaching before a LoRA run pays off; fewer mostly teaches the examples by heart. */
export const TRAINING_TARGET = 300;

const lineFor = ({ original, name }) => `${original} -> ${name}`;

function promptMessages(systemPrompt, theme, count) {
  return [
    { role: "system", content: systemPrompt.replaceAll("{count}", String(count)) },
    { role: "user", content: theme ? `Theme from the user: ${theme}` : "Theme: anything goes" },
  ];
}

/**
 * Every pair worth teaching, one per name, best evidence first: ✏️ fixes (the fixed name), 👍
 * ratings, live names members liked, then the example pool. A name whose latest rating is 👎 is
 * left out wherever else it turns up. Each pair keeps the theme it was made for ("" when unknown)
 * and where it came from (`origin`).
 */
export function trainingPairs({ ratings, liked, examples }) {
  const latestVerdict = new Map();
  for (const r of ratings) latestVerdict.set(nameKey(r.name), r.verdict);

  const pairs = new Map();
  const add = (original, name, theme, origin) => {
    const key = name ? nameKey(name) : "";
    if (!original?.trim() || !key || latestVerdict.get(key) === "bad" || pairs.has(key)) return;
    pairs.set(key, { original: original.trim(), name: name.trim(), theme: theme?.trim() ?? "", origin });
  };

  ratings.filter((r) => r.verdict === "fixed").forEach((r) => add(r.original, r.fixed_name, r.theme, "fixed"));
  ratings.filter((r) => r.verdict === "good").forEach((r) => add(r.original, r.name, r.theme, "good"));
  liked.forEach((l) => add(l.original, l.name, "", "liked"));
  examples.forEach((e) => add(e.original, e.name, "", "example"));
  return [...pairs.values()];
}

/** Chat-format JSONL lines ({ messages }), the pairs grouped by theme in batches of BATCH_SIZE. */
export function sftLines(pairs, systemPrompt) {
  const byTheme = new Map();
  for (const pair of pairs) {
    const theme = pair.theme.toLowerCase();
    if (!byTheme.has(theme)) byTheme.set(theme, { theme: pair.theme, pairs: [] });
    byTheme.get(theme).pairs.push(pair);
  }
  const lines = [];
  for (const group of byTheme.values()) {
    for (let at = 0; at < group.pairs.length; at += BATCH_SIZE) {
      const batch = group.pairs.slice(at, at + BATCH_SIZE);
      const messages = [
        ...promptMessages(systemPrompt, group.theme, batch.length),
        { role: "assistant", content: batch.map(lineFor).join("\n") },
      ];
      lines.push(JSON.stringify({ messages }));
    }
  }
  return lines;
}

/** Preference JSONL lines ({ prompt, chosen, rejected }), one per ✏️ fix that changed the name. */
export function dpoLines(ratings, systemPrompt) {
  return ratings
    .filter((r) => r.verdict === "fixed" && r.fixed_name && nameKey(r.fixed_name) !== nameKey(r.name))
    .map((r) =>
      JSON.stringify({
        prompt: promptMessages(systemPrompt, r.theme, 1),
        chosen: [{ role: "assistant", content: lineFor({ original: r.original, name: r.fixed_name }) }],
        rejected: [{ role: "assistant", content: lineFor(r) }],
      })
    );
}
