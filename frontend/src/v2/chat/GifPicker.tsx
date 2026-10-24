import { useEffect, useState } from 'react'
import { Modal, TextInput } from '@mantine/core'
import { useGifs, usePickGif, type Gif } from '@/v2/hooks/useChat'
import { toastFail } from '@/v2/notify'
import { useAuthImage } from '@/v2/today/PhotoViewer'

function Tile({ gif, disabled, onPick }: { gif: Gif; disabled: boolean; onPick: () => void }) {
  const src = useAuthImage(gif.preview_url)
  return (
    <button
      type="button"
      aria-label="Send this GIF"
      disabled={disabled}
      onClick={onPick}
      style={{ padding: 0, border: '1.5px solid var(--f-edge)', borderRadius: 6, overflow: 'hidden', background: 'var(--f-mute)', cursor: 'pointer', aspectRatio: `${gif.width} / ${gif.height}` }}
    >
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="GIF" loading="lazy" style={{ width: '100%', height: '100%', display: 'block' }} />
      )}
    </button>
  )
}

/** Search (or trending) GIFs through the home box; picking one saves it as a chat photo. */
export function GifPicker({
  threadId,
  kid = false,
  opened,
  onClose,
  onPicked,
}: {
  threadId: number
  kid?: boolean
  opened: boolean
  onClose: () => void
  onPicked: (photoId: number) => void | Promise<void>
}) {
  const [text, setText] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300)
    return () => clearTimeout(t)
  }, [text])
  const gifs = useGifs(q, kid, opened)
  const pick = usePickGif(kid)
  const choose = async (g: Gif) => {
    try {
      const { photo_id } = await pick.mutateAsync({ threadId, gifId: g.id })
      await onPicked(photo_id)
      onClose()
    } catch (e) {
      toastFail(e)
    }
  }
  return (
    <Modal opened={opened} onClose={onClose} title="Pick a GIF" size="lg" transitionProps={{ duration: 0 }}>
      <TextInput
        aria-label="Search GIFs"
        placeholder="Search GIFs"
        value={text}
        maxLength={50}
        onChange={(e) => setText(e.currentTarget.value)}
        data-autofocus
      />
      {gifs.isError && <p role="alert" className="f-note">{gifs.error.message}</p>}
      {gifs.data?.length === 0 && <p className="f-note">No GIFs found. Try another word.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8, marginTop: 12, maxHeight: '50vh', overflowY: 'auto' }}>
        {gifs.data?.map((g) => (
          <Tile key={g.id} gif={g} disabled={pick.isPending} onPick={() => void choose(g)} />
        ))}
      </div>
      <p className="f-cap" style={{ marginTop: 8 }}>Powered by GIPHY</p>
    </Modal>
  )
}
