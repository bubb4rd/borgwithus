import { getPoolForKind } from "./borgCatalog";

export function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function pickFromKind(kind: "borg" | "mio" | "ai") {
  const pool = getPoolForKind(kind);
  if (pool.length === 0) {
    throw new Error(`No ${kind} names available.`);
  }
  return pickRandom(pool);
}

export function generateBorgName(): string {
  return pickFromKind("borg");
}

export function generateMioName(): string {
  return pickFromKind("mio");
}
