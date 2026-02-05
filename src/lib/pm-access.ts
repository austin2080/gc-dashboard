export const PM_EMAIL_ALLOWLIST = [
  "austinemshoff@gmail.com",
];

export function canAccessPm(email: string | null | undefined) {
  if (!email) return false;
  return PM_EMAIL_ALLOWLIST.includes(email.toLowerCase());
}
