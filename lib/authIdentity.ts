// Fleet owners/admins sign in with either a real email or a plain username.
// A username is stored in Supabase Auth as <username>@owners.buspulse.internal (created by the
// platform-admin function), so the login form maps a bare username to that same address.
export const OWNER_INTERNAL_DOMAIN = "owners.buspulse.internal";

export function toLoginEmail(input: string): string {
  const value = input.trim().toLowerCase();
  return value.includes("@") ? value : `${value}@${OWNER_INTERNAL_DOMAIN}`;
}
