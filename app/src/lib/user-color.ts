// Deterministic per-user color, so the same user id always maps to the same hue everywhere (cursors, avatars, sharing list).
export function colorForUser(userId: number): { color: string; colorLight: string } {
  const hue = (userId * 137.508) % 360 // golden-angle spread for distinct hues
  return {
    color: `hsl(${hue}, 65%, 45%)`,
    colorLight: `hsl(${hue}, 65%, 90%)`,
  }
}

export function initialsForName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return "?"
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
