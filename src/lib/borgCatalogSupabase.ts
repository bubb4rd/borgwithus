import { getSupabase, isSupabaseConfigured } from "./supabase";
import type { BorgCatalogEntry, BorgKind } from "./borgCatalog";

const CATALOG_KEY = "borgwithus-admin-catalog";
let catalogMigrationDone = false;

type RemoteCatalogRow = {
  id: string;
  name: string;
  kind: BorgKind;
  tag: string;
  source: "seed" | "admin";
  created_at: string;
};

function mapRemoteRow(row: RemoteCatalogRow): BorgCatalogEntry {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    tag: row.tag,
    source: row.source,
    addedAt: row.created_at,
  };
}

function catalogEntryKey(kind: BorgKind, name: string) {
  return `${kind}:${name.trim().toLowerCase()}`;
}

function loadLocalAdminEntries(): BorgCatalogEntry[] {
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as BorgCatalogEntry[];
  } catch {
    return [];
  }
}

export async function fetchRemoteCatalogEntries(): Promise<BorgCatalogEntry[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await getSupabase()
    .from("borg_catalog")
    .select("id, name, kind, tag, source, created_at")
    .order("name", { ascending: true });

  if (error || !data) return [];
  return (data as RemoteCatalogRow[]).map(mapRemoteRow);
}

async function insertRemoteCatalogEntry(input: {
  name: string;
  kind: BorgKind;
  tag: string;
}): Promise<BorgCatalogEntry> {
  const { data, error } = await getSupabase()
    .from("borg_catalog")
    .insert({
      name: input.name,
      kind: input.kind,
      tag: input.tag,
      source: "admin",
    })
    .select("id, name, kind, tag, source, created_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not save catalog entry.");
  }

  return mapRemoteRow(data as RemoteCatalogRow);
}

async function migrateLocalCatalogToRemote(
  remoteEntries: BorgCatalogEntry[],
): Promise<BorgCatalogEntry[]> {
  if (catalogMigrationDone) return remoteEntries;

  const localEntries = loadLocalAdminEntries();
  if (localEntries.length === 0) {
    catalogMigrationDone = true;
    return remoteEntries;
  }

  const seen = new Set(
    remoteEntries.map((entry) => catalogEntryKey(entry.kind, entry.name)),
  );

  const merged = [...remoteEntries];

  for (const entry of localEntries) {
    const key = catalogEntryKey(entry.kind, entry.name);
    if (seen.has(key)) continue;

    try {
      const saved = await insertRemoteCatalogEntry({
        name: entry.name,
        kind: entry.kind,
        tag: entry.tag,
      });
      merged.push(saved);
      seen.add(key);
    } catch {
      // Keep trying other rows; duplicates may race across tabs.
    }
  }

  localStorage.removeItem(CATALOG_KEY);
  catalogMigrationDone = true;
  return merged.sort((a, b) => a.name.localeCompare(b.name));
}

export async function hydrateRemoteCatalog(): Promise<BorgCatalogEntry[] | null> {
  if (!isSupabaseConfigured) return null;

  try {
    let remoteEntries = await fetchRemoteCatalogEntries();
    remoteEntries = await migrateLocalCatalogToRemote(remoteEntries);
    return remoteEntries;
  } catch {
    return null;
  }
}

export async function saveRemoteCatalogEntry(input: {
  name: string;
  kind: BorgKind;
  tag: string;
}): Promise<BorgCatalogEntry> {
  return insertRemoteCatalogEntry(input);
}

export async function deleteRemoteCatalogEntry(id: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await getSupabase().from("borg_catalog").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
