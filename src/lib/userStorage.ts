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

/** Drop old global keys so they are never merged into a new account. */
export function clearLegacyUnscopedUserData() {
  for (const base of SCOPED_BASE_KEYS) {
    localStorage.removeItem(base);
  }
  localStorage.removeItem(LEGACY_MIGRATION_KEY);
}

export function notifyUserDataChanged() {
  window.dispatchEvent(new Event("user-data:update"));
}

export function bindUserStorage(userId: string | null) {
  const changed = activeUserId !== userId;
  if (userId) {
    clearLegacyUnscopedUserData();
  }
  setActiveUserStorageId(userId);
  if (changed) {
    notifyUserDataChanged();
  }
}
