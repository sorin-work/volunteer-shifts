/** Emails are compared and stored case-insensitively. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
