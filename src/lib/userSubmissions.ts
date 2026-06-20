const SUBMISSIONS_KEY = "borgwithus-user-submissions";
const SUBMISSIONS_EVENT = "user-submissions:update";

export type UserSubmissionStatus = "pending" | "approved" | "dismissed";

export type UserSubmission = {
  id: string;
  name: string;
  note: string;
  userId: string | null;
  userName: string;
  submittedAt: string;
  status: UserSubmissionStatus;
};

export function userSubmissionsUpdateEventName() {
  return SUBMISSIONS_EVENT;
}

function loadSubmissions(): UserSubmission[] {
  try {
    const raw = localStorage.getItem(SUBMISSIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as UserSubmission[];
  } catch {
    return [];
  }
}

function saveSubmissions(rows: UserSubmission[]) {
  localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(rows));
  window.dispatchEvent(new Event(SUBMISSIONS_EVENT));
}

export function getUserSubmissions(): UserSubmission[] {
  return loadSubmissions().sort((a, b) =>
    b.submittedAt.localeCompare(a.submittedAt),
  );
}

export function submitUserBorgName(input: {
  name: string;
  note?: string;
  userId?: string | null;
  userName?: string;
}) {
  const name = input.name.trim();
  if (!name) throw new Error("Name is required.");

  const rows = loadSubmissions();
  const duplicate = rows.some(
    (row) =>
      row.name.toLowerCase() === name.toLowerCase() && row.status !== "dismissed",
  );
  if (duplicate) {
    throw new Error(`"${name}" has already been submitted.`);
  }

  const entry: UserSubmission = {
    id: crypto.randomUUID(),
    name,
    note: input.note?.trim() ?? "",
    userId: input.userId ?? null,
    userName: input.userName?.trim() || "User",
    submittedAt: new Date().toISOString(),
    status: "pending",
  };

  rows.push(entry);
  saveSubmissions(rows);
  return entry;
}

export function updateUserSubmissionStatus(
  id: string,
  status: UserSubmissionStatus,
) {
  const rows = loadSubmissions();
  const index = rows.findIndex((row) => row.id === id);
  if (index === -1) return null;

  rows[index] = { ...rows[index], status };
  saveSubmissions(rows);
  return rows[index];
}

export function removeUserSubmission(id: string) {
  saveSubmissions(loadSubmissions().filter((row) => row.id !== id));
}
