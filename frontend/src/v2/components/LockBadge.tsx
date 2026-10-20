/** Round lock: green 🔓 when online, red 🔒 when offline. */
export function LockBadge({ online, size = 48 }: { online: boolean; size?: number }) {
  return (
    <span
      className="f-lock"
      data-online={online}
      role="img"
      aria-label={online ? 'Online' : 'Offline'}
      style={{ width: size, height: size, fontSize: Math.round(size / 2) }}
    >
      {online ? '🔓' : '🔒'}
    </span>
  )
}
