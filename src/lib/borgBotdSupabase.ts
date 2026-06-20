import { getSupabase, isSupabaseConfigured } from "./supabase";

const HISTORY_KEY = "borgwithus-botd-history";
let botdMigrationDone = false;

export type BotdDayRecord = {
  day: string;
  name: string;
  likeCount: number;
  ratingTotal: number;
  ratingCount: number;
};

type RemoteBotdRow = {
  day_key: string;
  name: string;
  like_count: number;
  rating_total: number;
  rating_count: number;
};

function mapRemoteRow(row: RemoteBotdRow): BotdDayRecord {
  return {
    day: row.day_key,
    name: row.name,
    likeCount: row.like_count,
    ratingTotal: Number(row.rating_total),
    ratingCount: row.rating_count,
  };
}

function loadLocalHistory(): Record<string, BotdDayRecord> {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, BotdDayRecord>;
  } catch {
    return {};
  }
}

async function upsertRemoteBotdDay(record: BotdDayRecord): Promise<void> {
  const { error } = await getSupabase().from("borg_botd_days").upsert(
    {
      day_key: record.day,
      name: record.name,
      like_count: record.likeCount,
      rating_total: record.ratingTotal,
      rating_count: record.ratingCount,
    },
    { onConflict: "day_key" },
  );

  if (error) throw new Error(error.message);
}

async function migrateLocalHistoryToRemote(
  remoteHistory: Record<string, BotdDayRecord>,
): Promise<Record<string, BotdDayRecord>> {
  if (botdMigrationDone) return remoteHistory;

  const localHistory = loadLocalHistory();
  if (Object.keys(localHistory).length === 0) {
    botdMigrationDone = true;
    return remoteHistory;
  }

  const merged = { ...remoteHistory };

  for (const record of Object.values(localHistory)) {
    const existing = merged[record.day];
    const shouldUpsert =
      !existing ||
      record.likeCount > existing.likeCount ||
      record.ratingCount > existing.ratingCount;

    if (!shouldUpsert) continue;

    try {
      await upsertRemoteBotdDay(record);
      merged[record.day] = record;
    } catch {
      // Ignore single-row migration failures.
    }
  }

  if (Object.keys(localHistory).length > 0) {
    localStorage.removeItem(HISTORY_KEY);
  }

  botdMigrationDone = true;
  return merged;
}

export async function hydrateRemoteBotdHistory(): Promise<
  Record<string, BotdDayRecord> | null
> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await getSupabase()
      .from("borg_botd_days")
      .select("day_key, name, like_count, rating_total, rating_count");

    if (error) return null;

    const remoteHistory: Record<string, BotdDayRecord> = {};

    for (const row of (data ?? []) as RemoteBotdRow[]) {
      remoteHistory[row.day_key] = mapRemoteRow(row);
    }

    return migrateLocalHistoryToRemote(remoteHistory);
  } catch {
    return null;
  }
}

export async function saveRemoteBotdDay(record: BotdDayRecord): Promise<void> {
  if (!isSupabaseConfigured) return;
  await upsertRemoteBotdDay(record);
}
