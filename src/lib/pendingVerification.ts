const STORAGE_KEY = "borgwithus-pending-verify";
const MAX_AGE_MS = 15 * 60 * 1000;

type PendingVerification = {
  email: string;
  createdAt: number;
};

export function setPendingEmailVerification(email: string) {
  const payload: PendingVerification = {
    email,
    createdAt: Date.now(),
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function getPendingEmailVerification(): PendingVerification | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const payload = JSON.parse(raw) as PendingVerification;
    if (!payload.email || !payload.createdAt) return null;
    if (Date.now() - payload.createdAt > MAX_AGE_MS) {
      clearPendingEmailVerification();
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function clearPendingEmailVerification() {
  sessionStorage.removeItem(STORAGE_KEY);
}
