/** Round lock: green 🔓 when online, red 🔒 when offline, grey when `online` is null (no devices). */
export function LockBadge({ online, size = 48 }: { online: boolean | null; size?: number }) {
  return (
    <span
      className="f-lock"
      data-online={online === null ? 'none' : online}
      role="img"
      aria-label={online === null ? 'No devices yet' : online ? 'Online' : 'Offline'}
      style={{ width: size, height: size, fontSize: Math.round(size / 2) }}
    >
      {online ? '🔓' : '🔒'}
    </span>
  )
}
