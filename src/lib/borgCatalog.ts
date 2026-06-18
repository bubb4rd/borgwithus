import names from "../data/names.json";

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

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function normalizeTag(tag: string) {
  const trimmed = tag.trim().toLowerCase();
  return trimmed || "custom";
}

function loadAdminEntries(): BorgCatalogEntry[] {
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as BorgCatalogEntry[];
  } catch {
    return [];
  }
}

function saveAdminEntries(entries: BorgCatalogEntry[]) {
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
  return {
    total: catalog.length,
    borg: catalog.filter((entry) => entry.kind === "borg").length,
    mio: catalog.filter((entry) => entry.kind === "mio").length,
    ai: catalog.filter((entry) => entry.kind === "ai").length,
    adminAdded: catalog.filter((entry) => entry.source === "admin").length,
  };
}

export function getPoolForKind(kind: BorgKind): string[] {
  return getFullCatalog()
    .filter((entry) => entry.kind === kind)
    .map((entry) => entry.name);
}

export function addCatalogEntry(input: {
  name: string;
  kind: BorgKind;
  tag: string;
}): BorgCatalogEntry {
  const name = normalizeName(input.name);
  if (!name) throw new Error("Name is required.");

  const kind = input.kind;
  const tag = normalizeTag(input.tag);
  const catalog = getFullCatalog();

  const duplicate = catalog.some(
    (entry) =>
      entry.kind === kind && entry.name.toLowerCase() === name.toLowerCase()
  );
  if (duplicate) {
    throw new Error(`"${name}" is already in the ${BORG_KIND_LABELS[kind]} list.`);
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

export function removeAdminCatalogEntry(id: string) {
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
