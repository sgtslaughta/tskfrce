import { useRouter } from 'next/router'
import { SharedDeviceNudge } from '../types'

interface PINsNudgeProps {
  nudges: SharedDeviceNudge[]
}

/** Quiet info card nudging parents to add PINs for shared devices. */
export function PINsNudge({ nudges }: PINsNudgeProps) {
  const router = useRouter()

  if (!nudges || nudges.length === 0) return null

  // Show first nudge only (minimal implementation)
  const nudge = nudges[0]
  const kidNames = nudge.kid_names.join(' and ')

  const handleSetPINs = () => {
    const firstKidId = nudge.kid_ids[0]
    router.push(`/kids?section=kids&kid=${firstKidId}&pin=1`)
  }

  return (
    <div style={{ padding: 16, border: '1px solid #e0e0e0', borderRadius: 8, backgroundColor: '#f9f9f9' }}>
      <p style={{ margin: '0 0 12px 0', fontSize: 14, color: '#666' }}>
        {kidNames} share {nudge.device_name}. Add PINs so they can&apos;t sign in as each other.
      </p>
      <button
        onClick={handleSetPINs}
        style={{
          padding: '8px 16px',
          backgroundColor: '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        Set PINs
      </button>
    </div>
  )
}
