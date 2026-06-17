import names from "../data/names.json";

export function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function generateBorgName(): string {
  return pickRandom(names.borg);
}

export function generateMioName(): string {
  return pickRandom(names.mio);
}
