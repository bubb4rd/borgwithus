import { hydrateRemoteBotdHistory } from "./borgBotdSupabase";
import type { BotdDayRecord } from "./borgBotdSupabase";
import { hydrateRemoteCatalog } from "./borgCatalogSupabase";
import type { BorgCatalogEntry } from "./borgCatalog";
import { hasNameStatsCache, hydrateNameStatsCache } from "./nameStatsCache";
import { isSupabaseConfigured } from "./supabase";

export const SHARED_SYNC_EVENT = "borg-shared-sync:update";

export type SyncSourceStatus = "remote" | "local" | "unavailable";

export type SharedSyncStatus = {
  configured: boolean;
  catalog: SyncSourceStatus;
  botd: SyncSourceStatus;
  community: SyncSourceStatus;
  nameStats: SyncSourceStatus;
  updatedAt: string | null;
};

type HydrateOptions = {
  force?: boolean;
};

function sourceStatus(remoteReady: boolean): SyncSourceStatus {
  if (!isSupabaseConfigured) return "unavailable";
  return remoteReady ? "remote" : "local";
}

let communitySyncRemote = false;
let lastSyncedAt: string | null = null;
let hasHydrated = false;
let hydratePromise: Promise<void> | null = null;

export function getSharedSyncStatus(): SharedSyncStatus {
  return {
    configured: isSupabaseConfigured,
    catalog: sourceStatus(usesRemoteCatalog()),
    botd: sourceStatus(usesRemoteBotdHistory()),
    community: sourceStatus(communitySyncRemote),
    nameStats: sourceStatus(hasNameStatsCache()),
    updatedAt: lastSyncedAt,
  };
}

export function isSharedDataLive(status: SharedSyncStatus = getSharedSyncStatus()) {
  if (!status.configured) return false;
  return [status.catalog, status.botd, status.community, status.nameStats].every(
    (source) => source === "remote",
  );
}

export type SharedDataModeLabel = "Live" | "Local" | "N/A";

export function getSharedDataModeLabel(
  status: SharedSyncStatus = getSharedSyncStatus(),
): SharedDataModeLabel {
  if (!status.configured) return "N/A";
  if (isSharedDataLive(status)) return "Live";
  return "Local";
}

export function setCommunitySyncRemote(remote: boolean) {
  if (communitySyncRemote === remote) return;
  communitySyncRemote = remote;
  notifySyncUpdate();
}

function notifySyncUpdate() {
  window.dispatchEvent(new Event(SHARED_SYNC_EVENT));
}

export async function hydrateSharedBorgData(options: HydrateOptions = {}) {
  if (!isSupabaseConfigured) {
    communitySyncRemote = false;
    notifySyncUpdate();
    return;
  }

  if (hasHydrated && !options.force) return;
  if (hydratePromise && !options.force) {
    await hydratePromise;
    return;
  }

  hydratePromise = (async () => {
    await Promise.all([
      hydrateRemoteCatalog().then((entries) => {
        if (entries) setRemoteCatalogEntries(entries);
      }),
      hydrateRemoteBotdHistory().then((history) => {
        if (history) setRemoteBotdHistory(history);
      }),
      hydrateNameStatsCache(),
    ]);

    hasHydrated = true;
    lastSyncedAt = new Date().toISOString();
    notifySyncUpdate();
  })();

  try {
    await hydratePromise;
  } finally {
    hydratePromise = null;
  }
}

let remoteCatalogEntries: BorgCatalogEntry[] | null = null;
let remoteBotdHistory: Record<string, BotdDayRecord> | null = null;

export function usesRemoteCatalog() {
  return remoteCatalogEntries !== null;
}

export function getRemoteCatalogEntries() {
  return remoteCatalogEntries ?? [];
}

export function setRemoteCatalogEntries(entries: BorgCatalogEntry[]) {
  remoteCatalogEntries = entries;
}

export function usesRemoteBotdHistory() {
  return remoteBotdHistory !== null;
}

export function getRemoteBotdHistory() {
  return remoteBotdHistory ?? {};
}

export function setRemoteBotdHistory(history: Record<string, BotdDayRecord>) {
  remoteBotdHistory = history;
}

export function upsertRemoteBotdHistoryRecord(record: BotdDayRecord) {
  if (!remoteBotdHistory) return;
  remoteBotdHistory[record.day] = record;
}

export function appendRemoteCatalogEntry(entry: BorgCatalogEntry) {
  if (!remoteCatalogEntries) return;
  remoteCatalogEntries = [...remoteCatalogEntries, entry].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export function removeRemoteCatalogEntry(id: string) {
  if (!remoteCatalogEntries) return;
  remoteCatalogEntries = remoteCatalogEntries.filter((entry) => entry.id !== id);
}
