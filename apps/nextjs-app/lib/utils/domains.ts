// Shared list and helpers for identifying consumer/free email domains

export const CONSUMER_EMAIL_DOMAINS = new Set(
  [
    "gmail.com",
    "yahoo.com",
    "outlook.com",
    "icloud.com",
    "hotmail.com",
    "aol.com",
    "proton.me",
    "pm.me",
  ].map((d) => d.toLowerCase()),
);

export function getEmailDomain(email?: string | null): string | null {
  if (!email || typeof email !== "string") return null;
  const parts = email.split("@");
  if (parts.length !== 2) return null;
  return parts[1]!.trim().toLowerCase();
}

export function isConsumerDomain(domain?: string | null): boolean {
  if (!domain) return false;
  return CONSUMER_EMAIL_DOMAINS.has(domain.toLowerCase());
}
