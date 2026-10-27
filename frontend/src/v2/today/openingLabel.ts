/** "Homework · Mia" / "Homework · Mia and Sam": what a notification link is about. */
export function openingLabel(title: string, kidIds: number[], kids: { id: number; full_name: string | null; username: string }[] = []): string {
  const names = kidIds.flatMap((id) => kids.find((k) => k.id === id) ?? []).map((k) => k.full_name || k.username)
  return names.length ? `${title} · ${names.join(' and ')}` : title
}
