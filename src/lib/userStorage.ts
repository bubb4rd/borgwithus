const SCOPED_BASE_KEYS = [
  "borgwithus-saved-likes",
  "borgwithus-saved-picks",
  "borgwithus-recent-rolls",
  "borgwithus-botd",
  "borgwithus-ai-feedback",
  "borgwithus-likes-cast",
] as const;

const LEGACY_MIGRATION_KEY = "borgwithus-legacy-user-data-migrated";

let activeUserId: string | null = null;

export function setActiveUserStorageId(userId: string | null) {
  activeUserId = userId;
}

export function getActiveUserStorageId() {
  return activeUserId;
}

export function userStorageKey(base: string, userId = activeUserId) {
  if (!userId) throw new Error("User storage is not ready");
  return `${base}:${userId}`;
}

function mergeJsonArrays<T>(a: T[], b: T[], getId: (item: T) => string) {
  const seen = new Set<string>();
  const merged: T[] = [];

  for (const item of [...a, ...b]) {
    const id = getId(item);
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(item);
  }

  return merged;
}

/** Move legacy global keys into the active user's scoped keys. */
export function migrateLegacyUnscopedToUser(userId: string) {
  if (localStorage.getItem(LEGACY_MIGRATION_KEY)) return;

  for (const base of SCOPED_BASE_KEYS) {
    const legacyRaw = localStorage.getItem(base);
    if (!legacyRaw) continue;

    const scopedKey = `${base}:${userId}`;
    const scopedRaw = localStorage.getItem(scopedKey);

    if (base === "borgwithus-likes-cast") {
      const legacyCount = Number(JSON.parse(legacyRaw));
      const scopedCount = scopedRaw ? Number(JSON.parse(scopedRaw)) : 0;
      localStorage.setItem(
        scopedKey,
        JSON.stringify(
          Number.isFinite(legacyCount)
            ? legacyCount + (Number.isFinite(scopedCount) ? scopedCount : 0)
            : scopedCount
        )
      );
    } else if (
      base === "borgwithus-saved-likes" ||
      base === "borgwithus-saved-picks" ||
      base === "borgwithus-recent-rolls"
    ) {
      try {
        const legacyItems = JSON.parse(legacyRaw) as Array<{ id: string }>;
        const scopedItems = scopedRaw
          ? (JSON.parse(scopedRaw) as Array<{ id: string }>)
          : [];
        localStorage.setItem(
          scopedKey,
          JSON.stringify(
            mergeJsonArrays(scopedItems, legacyItems, (item) => item.id)
          )
        );
      } catch {
        if (!scopedRaw) localStorage.setItem(scopedKey, legacyRaw);
      }
    } else if (!scopedRaw) {
      localStorage.setItem(scopedKey, legacyRaw);
    }

    localStorage.removeItem(base);
  }

  localStorage.setItem(LEGACY_MIGRATION_KEY, userId);
}

export function clearLegacyUnscopedUserData() {
  for (const base of SCOPED_BASE_KEYS) {
    localStorage.removeItem(base);
  }
}

export function notifyUserDataChanged() {
  window.dispatchEvent(new Event("user-data:update"));
}

export function bindUserStorage(userId: string | null) {
  const changed = activeUserId !== userId;
  if (userId) {
    migrateLegacyUnscopedToUser(userId);
    clearLegacyUnscopedUserData();
  }
  setActiveUserStorageId(userId);
  if (changed) {
    notifyUserDataChanged();
  }
}
