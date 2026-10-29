import { useState } from 'react'
import { Modal } from '@mantine/core'
import { useAuthImage } from '@/v2/today/PhotoViewer'

/** Server photo paths are `/api/v1/...`; the proxy wants them without that prefix. */
export const proxyPath = (url: string) => url.replace(/^\/api\/v1/, '')

/** Chat photo thumbnail that opens full size; `className` swaps the kid inline look for parent CSS. */
export function Photo({ url, className }: { url: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const path = proxyPath(url)
  const thumb = useAuthImage(`${path}/thumb`)
  const full = useAuthImage(open ? path : null)
  return (
    <>
      <button
        type="button"
        aria-label="Open photo"
        className={className}
        onClick={() => setOpen(true)}
        style={className ? undefined : { display: 'block', width: 160, height: 120, padding: 0, border: 0, borderRadius: 6, overflow: 'hidden', background: 'var(--f-mute)', cursor: 'pointer' }}
      >
        {thumb && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </button>
      <Modal opened={open} onClose={() => setOpen(false)} title="Photo" size="lg" transitionProps={{ duration: 0 }}>
        {full && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={full} alt="Chat photo" style={{ width: '100%', borderRadius: 6 }} />
        )}
      </Modal>
    </>
  )
}
