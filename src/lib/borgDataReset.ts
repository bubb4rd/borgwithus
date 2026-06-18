import { clearLegacyUnscopedUserData } from "./userStorage";

const RESET_FLAG_KEY = "borgwithus-data-reset-v2";

export const BORG_DATA_STORAGE_KEYS = [
  "borgwithus-likes",
  "borgwithus-picks",
  "borgwithus-ratings",
  "borgwithus-saved-likes",
  "borgwithus-saved-picks",
  "borgwithus-recent-rolls",
  "borgwithus-botd",
  "borgwithus-botd-history",
  "borgwithus-ai-feedback",
  "borgwithus-likes-cast",
  "borgwithus-legacy-user-data-migrated",
] as const;

export function clearLocalBorgData() {
  for (const key of BORG_DATA_STORAGE_KEYS) {
    localStorage.removeItem(key);
  }

  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (
      key.startsWith("borgwithus-saved-likes:") ||
      key.startsWith("borgwithus-saved-picks:") ||
      key.startsWith("borgwithus-recent-rolls:") ||
      key.startsWith("borgwithus-botd:") ||
      key.startsWith("borgwithus-ai-feedback:") ||
      key.startsWith("borgwithus-likes-cast:")
    ) {
      localStorage.removeItem(key);
    }
  }
}

export function runBorgDataResetIfNeeded() {
  if (localStorage.getItem(RESET_FLAG_KEY)) return;

  clearLocalBorgData();
  clearLegacyUnscopedUserData();
  localStorage.setItem(RESET_FLAG_KEY, new Date().toISOString());
}
