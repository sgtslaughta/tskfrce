/** Chip rows with more than 5 chores or more than 3 devices collapse to a summary. */
export function collapseRow(
  done: number,
  total: number,
  devices: number,
): { collapsed: boolean; summary: string } {
  return { collapsed: total > 5 || devices > 3, summary: `✓ ${done}/${total} · +${devices} devices` }
}
