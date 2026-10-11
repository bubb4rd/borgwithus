// The BORG name rules in borg-ai.ts, checked with fixed inputs: `npm run test:ai`.
import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import {
  avoidEntries,
  BATCH_SIZE,
  buildMessages,
  BUILT_IN_PROMPT,
  codeSwap,
  DEMO_THEME,
  type Draft,
  extractDrafts,
  formatDemo,
  isNearDuplicate,
  pickPair,
  type PromptConfig,
  type PromptInput,
  STYLE_PAIRS,
  swapPosition,
  swapsSound,
} from "./borg-ai.ts";

// Deterministic stand-in for Math.random (mulberry32).
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const noAvoid = () => ({ names: [], originals: [] });

Deno.test("swapsSound accepts names that swap one sound for borg", () => {
  const swaps: [string, string][] = [
    ["Ron Burgundy", "Ron Borgundy"],
    ["LeBron James", "LeBorg James"],
    ["Playboi Carti", "Playborg Carti"],
    ["SpongeBob", "SpongeBorg"],
    ["Morgan Freeman", "Borgan Freeman"],
    ["Kareem Abdul-Jabbar", "Kareem Abdul-Jaborg"],
    ["Burger King", "Borger King"],
    ["Godzilla", "Borgzilla"],
    ["Rick and Morty", "Rick and Borgy"],
    ["Khloe Kardashian", "Khloe Borgashian"],
    ["Armageddon", "Borgmageddon"],
    ["Lost Boys", "Lost Borgs"],
    ["Sweet Baby Ray's", "Sweet Borgby Rays"],
  ];
  for (const [original, name] of swaps) {
    assert(swapsSound({ original, name }), `${original} -> ${name} should count as a swap`);
  }
});

Deno.test("swapsSound rejects tacked-on, squashed and unrelated borgs", () => {
  const fakes: [string, string][] = [
    ["Taylor Swift", "Taylorborg"],
    ["Adele", "Adeleborg"],
    ["Hulk", "Hulkborg"],
    ["Beyonce", "Beyonborg"],
    ["Norway", "Norborgway"],
    ["Batman", "Batborgh"],
    ["Cyborg", "CyBorg"],
    ["Kenny Rogers", "Kenborg Rogers"],
    ["Titanic", "Titanborg"],
    ["Tupac Shakur", "Tupacshakborg"],
  ];
  for (const [original, name] of fakes) {
    assertFalse(swapsSound({ original, name }), `${original} -> ${name} should not count as a swap`);
  }
});

Deno.test("codeSwap swaps the most borg-like sound", () => {
  const swaps: [string, string][] = [
    ["Michael Jordan", "Michael Borgan"],
    ["Sarah Jessica Parker", "Sarah Jessica Borger"],
    ["Khloe Kardashian", "Khloe Borgashian"],
    ["Lost Boys", "Lost Borgs"],
    ["Burger King", "Borger King"],
  ];
  for (const [original, name] of swaps) {
    assertEquals(codeSwap(original), name, original);
  }
});

Deno.test("codeSwap gives up when no swap keeps the original recognisable", () => {
  for (const original of ["Thor", "Ford", "Big Mac", "Lucky Charms", "Corn Flakes"]) {
    assertEquals(codeSwap(original), null, original);
  }
});

Deno.test("isNearDuplicate catches extensions and respellings of known names", () => {
  const known = avoidEntries(["Borgan Freeman", "SpongeBorg", "Ron Borgundy", "Borger King"]);
  for (const name of ["Borgan Freemon", "Sponge Borgs", "Ron Borgundy Bears", "Borger Kong"]) {
    assert(isNearDuplicate(name, known), `${name} should repeat a known name`);
  }
  for (const name of ["Snoop Doggborg", "Tom Bradyborg"]) {
    assertFalse(isNearDuplicate(name, known), `${name} should be new`);
  }
});

Deno.test("extractDrafts reads ->, → and => arrows", () => {
  assertEquals(extractDrafts("Ron Burgundy -> Ron Borgundy\nLeBron James → LeBorg James\nSpongeBob => SpongeBorg"), [
    { original: "Ron Burgundy", name: "Ron Borgundy" },
    { original: "LeBron James", name: "LeBorg James" },
    { original: "SpongeBob", name: "SpongeBorg" },
  ]);
});

Deno.test("extractDrafts falls back to a spaced dash", () => {
  assertEquals(extractDrafts("Donald Trump - Don Borgumpf"), [{ original: "Donald Trump", name: "Don Borgumpf" }]);
});

Deno.test("extractDrafts reads pairs labelled Original / BORG name instead of an arrow", () => {
  const raw = [
    "Original: Halo",
    "BORG name: Halborg",
    "Original: Mario Kart",
    "BORG name: Marionelborgg",
    "1. **Original:** Burger King, **Borg name:** Borger King",
    "Theme: music/albums",
  ].join("\r\n");
  assertEquals(extractDrafts(raw), [
    { original: "Halo", name: "Halborg" },
    { original: "Mario Kart", name: "Marionelborgg" },
    { original: "Burger King", name: "Borger King" },
  ]);
});

Deno.test("extractDrafts splits pipe- and comma-separated entries", () => {
  const expected = [
    { original: "Morgan Freeman", name: "Borgan Freeman" },
    { original: "Burger King", name: "Borger King" },
  ];
  assertEquals(extractDrafts("Morgan Freeman -> Borgan Freeman | Burger King -> Borger King"), expected);
  assertEquals(extractDrafts("Morgan Freeman -> Borgan Freeman, Burger King -> Borger King"), expected);
});

Deno.test("extractDrafts strips list markers but keeps names that start with a number", () => {
  assertEquals(extractDrafts("1. Ron Burgundy -> Ron Borgundy\n- Burger King -> Borger King\n* 50 Cent -> 50 Borgcent"), [
    { original: "Ron Burgundy", name: "Ron Borgundy" },
    { original: "Burger King", name: "Borger King" },
    { original: "50 Cent", name: "50 Borgcent" },
  ]);
});

Deno.test("extractDrafts drops chatter, headers and originals that are not real names", () => {
  const raw = [
    "Here's 5 BORG names:",
    "Original -> BORG name",
    "Cyborg -> Cyborgborg",
    "Original: Ron Burgundy -> Name: Ron Borgundy",
    "Burger King -> Borger King (fast food)",
  ].join("\n");
  assertEquals(extractDrafts(raw), [
    { original: "Ron Burgundy", name: "Ron Borgundy" },
    { original: "Burger King", name: "Borger King" },
  ]);
});

Deno.test("extractDrafts keeps originals whose name is unusable, with name null", () => {
  assertEquals(extractDrafts("Thor -> Thor\nHulk -> Hulk Borg\nTitanic -> Here's Titanborg"), [
    { original: "Thor", name: null },
    { original: "Hulk", name: null },
    { original: "Titanic", name: null },
  ]);
});

Deno.test("extractDrafts drops repeated originals, keeping the first", () => {
  assertEquals(extractDrafts("Ron Burgundy -> Ron Borgundy\nron burgundy -> Ron Borgundee"), [
    { original: "Ron Burgundy", name: "Ron Borgundy" },
  ]);
});

Deno.test("pickPair counts a known original as a repeat", () => {
  const draft = { original: "Morgan Freeman", name: "Borgan Freeman" };
  const result = pickPair([draft], { names: [], originals: avoidEntries(["Morgan Freeman"]) }, seeded(1));
  assertEquals(result.repeats, [draft]);
  assertEquals(result.swaps, []);
  assertEquals(result.pair, null);
});

Deno.test("pickPair offers both the model's real swap and the code's swap", () => {
  const result = pickPair([{ original: "Michael Jordan", name: "Michael Borgdan" }], noAvoid(), seeded(2));
  assertEquals(result.swaps, [
    { original: "Michael Jordan", name: "Michael Borgdan", source: "model" },
    { original: "Michael Jordan", name: "Michael Borgan", source: "code" },
  ]);
  assertEquals(result.tackedOn, []);
  assert(result.pair && result.swaps.includes(result.pair));
});

Deno.test("pickPair offers a name once when the model and the code agree", () => {
  const result = pickPair([{ original: "Burger King", name: "Borger King" }], noAvoid(), seeded(3));
  assertEquals(result.swaps, [{ original: "Burger King", name: "Borger King", source: "model" }]);
  assertEquals(result.pair, { original: "Burger King", name: "Borger King", source: "model" });
});

Deno.test("pickPair only picks a tacked-on name when no swap exists", () => {
  const hulk: Draft = { original: "Hulk", name: "Hulkborg" };
  const alone = pickPair([hulk], noAvoid(), seeded(4));
  assertEquals(alone.swaps, []);
  assertEquals(alone.pair, { original: "Hulk", name: "Hulkborg", source: "model" });

  const withSwap = [hulk, { original: "Burger King", name: "Borger King" }];
  for (const random of [() => 0, () => 0.999, seeded(5)]) {
    const result = pickPair(withSwap, noAvoid(), random);
    assertEquals(result.tackedOn, [{ original: "Hulk", name: "Hulkborg", source: "model" }]);
    assertEquals(result.pair, { original: "Burger King", name: "Borger King", source: "model" });
  }
});

Deno.test("pickPair returns no pair when nothing is usable", () => {
  const result = pickPair([{ original: "Thor", name: null }], noAvoid(), seeded(6));
  assertEquals(result, {
    pair: null,
    swaps: [],
    tackedOn: [],
    repeats: [],
    lost: [{ original: "Thor", name: null, reason: "no-name" }],
  });
});

Deno.test("pickPair says why each original that offers nothing was lost", () => {
  const drafts: Draft[] = [
    { original: "Morgan Freeman", name: "Borgan Freeman" },
    { original: "Ron Burgundy", name: "Ron Borgundy" },
    { original: "Ron Burgandy", name: "Ron Borgandy" },
    { original: "Hulk", name: "Hulkborg" },
    { original: "Michael Jordan", name: null },
    { original: "Thor", name: null },
  ];
  const avoid = {
    names: avoidEntries(["Hulkborg", "Michael Borgan"]),
    originals: avoidEntries(["Morgan Freeman"]),
  };
  const result = pickPair(drafts, avoid, seeded(7));
  assertEquals(result.swaps, [{ original: "Ron Burgundy", name: "Ron Borgundy", source: "model" }]);
  assertEquals(result.lost, [
    { original: "Morgan Freeman", name: "Borgan Freeman", reason: "known-original" },
    { original: "Ron Burgandy", name: "Ron Borgandy", reason: "known-original" },
    { original: "Hulk", name: "Hulkborg", reason: "known-name" },
    { original: "Michael Jordan", name: null, reason: "known-name" },
    { original: "Thor", name: null, reason: "no-name" },
  ]);
});

const input = (config: PromptConfig, prompt: string, topic: string | null, attempt = 1, repeats: Draft[] = []): PromptInput => ({
  config,
  prompt,
  topic,
  repeats,
  attempt,
});

const request = (messages: { content: string }[]) => messages[messages.length - 1].content;

Deno.test("buildMessages fills {count} with the batch size", () => {
  const config = { ...BUILT_IN_PROMPT, systemPrompt: "Reply with {count} lines, {count} in all." };
  const { messages } = buildMessages(input(config, "", "rappers"), seeded(7));
  assertEquals(messages[0], { role: "system", content: `Reply with ${BATCH_SIZE} lines, ${BATCH_SIZE} in all.` });
});

Deno.test("buildMessages uses the forced topic when the theme is blank", () => {
  const { topic, messages } = buildMessages(input(BUILT_IN_PROMPT, "", "rappers"), seeded(8));
  assertEquals(topic, "rappers");
  assertEquals(request(messages), "Theme: rappers");
});

Deno.test("buildMessages prefers the theme over the topic", () => {
  const { topic, messages } = buildMessages(input(BUILT_IN_PROMPT, "pirates", "rappers"), seeded(9));
  assertEquals(topic, null);
  assertEquals(request(messages), "Theme from the user: pirates");
});

Deno.test("buildMessages sends the format examples as an earlier exchange, at most one batch of them", () => {
  const without = buildMessages(input({ ...BUILT_IN_PROMPT, formatCount: 0 }, "pirates", null), seeded(10));
  assertEquals(without.messages.map(({ role }) => role), ["system", "user"]);

  const ten = buildMessages(input({ ...BUILT_IN_PROMPT, formatCount: 10 }, "pirates", null), seeded(10));
  assertEquals(ten.messages.map(({ role }) => role), ["system", "user", "assistant", "user"]);
  assertEquals(ten.messages[1].content, DEMO_THEME);
  const lines = ten.messages[2].content.split("\n");
  assertEquals(lines.length, BATCH_SIZE);
  assert(lines.every((line) => line.includes(" -> ")));
});

Deno.test("buildMessages lists repeats only on retries", () => {
  const repeats: Draft[] = [{ original: "Morgan Freeman", name: "Borgan Freeman" }, { original: "Thor", name: null }];
  const first = buildMessages(input(BUILT_IN_PROMPT, "", "rappers", 1, repeats), seeded(11));
  assertEquals(request(first.messages), "Theme: rappers");

  const retry = buildMessages(input(BUILT_IN_PROMPT, "", "rappers", 2, repeats), seeded(11));
  assertEquals(request(retry.messages).split("\n"), [
    "Used originals: Morgan Freeman | Thor",
    "Used names: Borgan Freeman",
    "Theme: rappers",
    "Reply with ONLY the new lines, each in the form: Original -> BORG name",
  ]);
});

Deno.test("the built-in pairs are real swaps at the start, middle and end of a name", () => {
  for (const pair of STYLE_PAIRS) assert(swapsSound(pair), `${pair.original} -> ${pair.name}`);
  assertEquals(new Set(STYLE_PAIRS.map(({ name }) => swapPosition(name))), new Set(["start", "middle", "end"]));
});

Deno.test("swapPosition finds where borg sits in the name", () => {
  assertEquals(swapPosition("Borgan Freeman"), "start");
  assertEquals(swapPosition("Ron Borgundy"), "middle");
  assertEquals(swapPosition("Playborg Carti"), "middle");
  assertEquals(swapPosition("Heisenborg"), "end");
  assertEquals(swapPosition("Kareem Abdul-Jaborg"), "end");
});

Deno.test("formatDemo shows only real swaps, spread over start, middle and end", () => {
  const pool = [
    { original: "Morgan Freeman", name: "Borgan Freeman" },
    { original: "Porcupine", name: "Borgupine" },
    { original: "Playboi Carti", name: "Playborg Carti" },
    { original: "Mitsubishi", name: "Mitsuborgshi" },
    { original: "Heisenberg", name: "Heisenborg" },
    { original: "SpongeBob", name: "SpongeBorg" },
    { original: "Taylor Swift", name: "Taylorborg" },
    { original: "Dora", name: "Borga the Explorer" },
  ];
  for (let seed = 1; seed <= 20; seed++) {
    const demo = formatDemo(pool, 3, seeded(seed));
    assertEquals(demo.length, 3);
    assert(demo.every(swapsSound), "only real swaps");
    assertEquals(new Set(demo.map(({ name }) => swapPosition(name))).size, 3, `seed ${seed}: one of each place`);
  }
});

Deno.test("formatDemo falls back to the built-in pairs when no pair is a real swap", () => {
  const demo = formatDemo([{ original: "Taylor Swift", name: "Taylorborg" }], 2, seeded(3));
  assertEquals(demo.length, 2);
  assert(demo.every((pair) => STYLE_PAIRS.includes(pair)));
});
