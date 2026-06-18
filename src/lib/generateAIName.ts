import { getPoolForKind } from "./borgCatalog";
import { pickRandom } from "./generateName";
import type { AiTone } from "../context/AuthContext";

const suffixes = ["borg", "Borginator", "borg Supreme", "borg Deluxe", "borg XL"];

export function generateAIName(prompt: string, tone: AiTone = "funny"): string {
  const trimmed = prompt.trim();
  const seed = pickRandom(getPoolForKind("borg"));

  if (!trimmed) return seed;

  if (tone === "clean") {
    const topic = trimmed.split(/\s+/).slice(0, 3).join(" ");
    return `${topic} Borg`;
  }

  const topic = trimmed.split(/\s+/).slice(0, 2).join(" ");
  const roll = Math.random();

  if (roll < 0.34) {
    const suffix = pickRandom(suffixes);
    return `${topic} ${suffix}`;
  }
  if (roll < 0.67) {
    return `${topic} meets ${seed}`;
  }
  return seed.replace(/borg/gi, topic);
}
