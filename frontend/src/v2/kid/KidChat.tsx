import { useState } from 'react'
import { Button } from '@mantine/core'
import { ThreadList } from '../chat/ThreadList'
import { ThreadView } from '../chat/ThreadView'
import { refOf, useThreads, type ThreadKind } from '../hooks/useChat'
import { StickerCard } from '../components/StickerCard'

export type ChatPick = { kind: ThreadKind; ref: string }

/** Kid chat: the threads the server lists for this kid (family, own private, their chores), then one thread. */
export function KidChat({ meId, start, onClose }: { meId: number | null; start: ChatPick | null; onClose: () => void }) {
  const threads = useThreads(true)
  const [picked, setPicked] = useState<ChatPick | null>(start)
  return (
    <StickerCard>
      <div style={{ display: 'grid', gap: 10 }}>
        <Button variant="default" size="md" onClick={picked ? () => setPicked(null) : onClose}>
          Back
        </Button>
        {picked ? (
          <ThreadView key={`${picked.kind}:${picked.ref}`} kind={picked.kind} refId={picked.ref} meId={meId} kid />
        ) : (
          <>
            {threads.isError && <p role="alert">{threads.error.message}</p>}
            <ThreadList
              threads={threads.data?.threads ?? []}
              selected={null}
              onPick={(t) => setPicked({ kind: t.kind, ref: refOf(t) })}
            />
          </>
        )}
      </div>
    </StickerCard>
  )
}
