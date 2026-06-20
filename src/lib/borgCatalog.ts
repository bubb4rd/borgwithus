import names from "../data/names.json";
import {
  deleteRemoteCatalogEntry,
  saveRemoteCatalogEntry,
} from "./borgCatalogSupabase";
import {
  appendRemoteCatalogEntry,
  getRemoteCatalogEntries,
  removeRemoteCatalogEntry,
  usesRemoteCatalog,
} from "./sharedBorgData";
import { isSupabaseConfigured } from "./supabase";

const CATALOG_KEY = "borgwithus-admin-catalog";
const CATALOG_EVENT = "borg-catalog:update";

export type BorgKind = "borg" | "mio" | "ai";

export type BorgCatalogEntry = {
  id: string;
  name: string;
  kind: BorgKind;
  tag: string;
  source: "seed" | "admin";
  addedAt: string;
};

export const BORG_KIND_LABELS: Record<BorgKind, string> = {
  borg: "BORG",
  mio: "Mio",
  ai: "AI",
};

export const PRESET_TAGS = ["original", "ai"] as const;

/** Tailwind cyan scale for admin catalog mix chart. */
export const CATALOG_MIX_CYAN_PALETTE = {
  50: "#ecfeff",
  100: "#cffafe",
  200: "#a5f3fc",
  300: "#67e8f9",
  400: "#22d3ee",
  500: "#06b6d4",
  600: "#0891b2",
  700: "#0e7490",
  800: "#155e75",
  900: "#164e63",
  950: "#083344",
} as const;

const CATALOG_MIX_CUSTOM_COLORS = [
  CATALOG_MIX_CYAN_PALETTE[400],
  CATALOG_MIX_CYAN_PALETTE[600],
  CATALOG_MIX_CYAN_PALETTE[300],
  CATALOG_MIX_CYAN_PALETTE[800],
  CATALOG_MIX_CYAN_PALETTE[200],
  CATALOG_MIX_CYAN_PALETTE[900],
] as const;

export type BorgTagMixSegment = {
  tag: string;
  label: string;
  count: number;
  color: string;
};

export function formatTagLabel(tag: string) {
  return tag
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function tagChartColor(tag: string, customIndex = 0) {
  switch (tag.toLowerCase()) {
    case "original":
      return CATALOG_MIX_CYAN_PALETTE[500];
    case "ai":
      return CATALOG_MIX_CYAN_PALETTE[700];
    default:
      return CATALOG_MIX_CUSTOM_COLORS[
        customIndex % CATALOG_MIX_CUSTOM_COLORS.length
      ];
  }
}

export function getBorgTagMix(): BorgTagMixSegment[] {
  const borgs = getFullCatalog().filter(
    (entry) => entry.kind === "borg" || entry.kind === "ai",
  );
  const counts = new Map<string, number>();

  for (const entry of borgs) {
    const tag = entry.kind === "ai" ? "ai" : normalizeTag(entry.tag);
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }

  const orderedTags: string[] = [];
  if (counts.has("original")) orderedTags.push("original");
  if (counts.has("ai")) orderedTags.push("ai");

  const customTags = [...counts.keys()]
    .filter((tag) => tag !== "original" && tag !== "ai")
    .sort((a, b) => a.localeCompare(b));
  orderedTags.push(...customTags);

  let customColorIndex = 0;

  return orderedTags.map((tag) => {
    const isCustom = tag !== "original" && tag !== "ai";
    const color = tagChartColor(tag, isCustom ? customColorIndex++ : 0);

    return {
      tag,
      label: formatTagLabel(tag),
      count: counts.get(tag) ?? 0,
      color,
    };
  });
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function normalizeTag(tag: string) {
  const trimmed = tag.trim().toLowerCase();
  return trimmed || "custom";
}

export function getEntryCatalogTag(entry: BorgCatalogEntry): string {
  return entry.kind === "ai" ? "ai" : normalizeTag(entry.tag);
}

export function isPresetCatalogTag(tag: string) {
  return PRESET_TAGS.includes(tag as (typeof PRESET_TAGS)[number]);
}

export function getCatalogCustomTags(catalog: BorgCatalogEntry[] = getFullCatalog()) {
  const tags = new Set<string>();

  for (const entry of catalog) {
    const tag = getEntryCatalogTag(entry);
    if (!isPresetCatalogTag(tag)) {
      tags.add(tag);
    }
  }

  return [...tags].sort((a, b) => a.localeCompare(b));
}

function loadAdminEntries(): BorgCatalogEntry[] {
  if (usesRemoteCatalog()) {
    return getRemoteCatalogEntries();
  }

  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as BorgCatalogEntry[];
  } catch {
    return [];
  }
}

function saveAdminEntries(entries: BorgCatalogEntry[]) {
  if (usesRemoteCatalog()) return;
  localStorage.setItem(CATALOG_KEY, JSON.stringify(entries));
  window.dispatchEvent(new Event(CATALOG_EVENT));
}

function seedEntries(): BorgCatalogEntry[] {
  const entries: BorgCatalogEntry[] = [];

  for (const name of names.borg) {
    entries.push({
      id: `seed-borg-${name}`,
      name,
      kind: "borg",
      tag: "original",
      source: "seed",
      addedAt: "",
    });
  }

  for (const name of names.mio) {
    entries.push({
      id: `seed-mio-${name}`,
      name,
      kind: "mio",
      tag: "original",
      source: "seed",
      addedAt: "",
    });
  }

  return entries;
}

export function getFullCatalog(): BorgCatalogEntry[] {
  const merged = [...seedEntries(), ...loadAdminEntries()];
  return merged.sort((a, b) => a.name.localeCompare(b.name));
}

export function getCatalogCounts() {
  const catalog = getFullCatalog();
  const borg = catalog.filter((entry) => entry.kind === "borg").length;
  const ai = catalog.filter((entry) => entry.kind === "ai").length;
  return {
    total: catalog.length,
    borg,
    mio: catalog.filter((entry) => entry.kind === "mio").length,
    ai,
    borgMixTotal: borg + ai,
    adminAdded: catalog.filter((entry) => entry.source === "admin").length,
    borgTagMix: getBorgTagMix(),
  };
}

export function getPoolForKind(kind: BorgKind): string[] {
  return getFullCatalog()
    .filter((entry) => entry.kind === kind)
    .map((entry) => entry.name);
}

/** Canonical good examples for BORG AI — style reference only, never reused as output. */
export const BORG_AI_GOOD_EXAMPLES = [
  "Ron Borgundy",
  "LeBorg James",
  "Pablo Escoborg",
  "Playborg Carti",
  "SpongeBorg",
  "Borgzilla",
  "Borgan Freeman",
  "Ruth Bader-Ginsborg",
  "Borger King",
  "Heisenborg",
  "Mark Zuckerborg",
  "Leonardo DiBorgio",
  "To Kill a Mockingborg",
  "Borg, James Borg",
  "Kareem Abdul-Jaborg",
  "Smorgasborg",
  "Borgahontas",
  "Arnold Borginator",
  "Pearl Harborg",
  "The Big Borg Theory",
] as const;

export function getBorgAiGoodExamples(): string[] {
  const pool = getPoolForKind("borg");
  const byLower = new Map(pool.map((name) => [name.toLowerCase(), name]));

  return BORG_AI_GOOD_EXAMPLES.flatMap((name) => {
    const match = byLower.get(name.toLowerCase());
    return match ? [match] : [];
  });
}

export async function addCatalogEntry(input: {
  name: string;
  kind: BorgKind;
  tag: string;
}): Promise<BorgCatalogEntry> {
  const name = normalizeName(input.name);
  if (!name) throw new Error("Name is required.");

  const kind = input.kind;
  const tag = normalizeTag(input.tag);
  const catalog = getFullCatalog();

  const duplicate = catalog.some(
    (entry) =>
      entry.kind === kind && entry.name.toLowerCase() === name.toLowerCase(),
  );
  if (duplicate) {
    throw new Error(`"${name}" is already in the ${BORG_KIND_LABELS[kind]} list.`);
  }

  if (isSupabaseConfigured) {
    const entry = await saveRemoteCatalogEntry({ name, kind, tag });
    if (usesRemoteCatalog()) {
      appendRemoteCatalogEntry(entry);
    }
    window.dispatchEvent(new Event(CATALOG_EVENT));
    return entry;
  }

  const entry: BorgCatalogEntry = {
    id: crypto.randomUUID(),
    name,
    kind,
    tag,
    source: "admin",
    addedAt: new Date().toISOString(),
  };

  const adminEntries = loadAdminEntries();
  adminEntries.push(entry);
  saveAdminEntries(adminEntries);
  return entry;
}

export async function removeAdminCatalogEntry(id: string) {
  if (isSupabaseConfigured) {
    await deleteRemoteCatalogEntry(id);
    if (usesRemoteCatalog()) {
      removeRemoteCatalogEntry(id);
    }
    window.dispatchEvent(new Event(CATALOG_EVENT));
    return;
  }

  const next = loadAdminEntries().filter((entry) => entry.id !== id);
  saveAdminEntries(next);
}

export function catalogUpdateEventName() {
  return CATALOG_EVENT;
}

export function tagBadgeClass(tag: string) {
  switch (tag.toLowerCase()) {
    case "original":
      return "bg-cyan/10 text-cyan border-cyan/20";
    case "ai":
      return "bg-magenta/10 text-magenta border-magenta/20";
    default:
      return "bg-sky-500/10 text-sky-700 border-sky-500/20 dark:text-sky-300";
  }
}
