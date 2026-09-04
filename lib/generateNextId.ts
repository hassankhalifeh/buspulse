// Suggests the next code in a sequence like BUS-004 given existing
// ids like ["BUS-001","BUS-002","BUS-003"]. Purely a starting
// suggestion — the admin can always overwrite it before saving, since
// these codes are still the real primary keys.
export function generateNextId(existingIds: string[], prefix: string, pad = 3): string {
  let max = 0;
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  for (const id of existingIds) {
    const m = id.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}-${String(max + 1).padStart(pad, "0")}`;
}
