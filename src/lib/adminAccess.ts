const ADMIN_EMAILS = new Set([
  "bohubbard8@gmail.com",
  "bohubbard8@gmal.com",
]);

export function isAdminEmail(email: string) {
  return ADMIN_EMAILS.has(email.trim().toLowerCase());
}
