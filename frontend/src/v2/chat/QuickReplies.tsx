import { useState } from 'react'
import { Icon } from '@/v2/parent/Icon'
import { useFamily } from '@/v2/hooks/useFamily'
import { useApproveChore } from '@/v2/hooks/useToday'
import { usePost } from '@/v2/hooks/useChat'
import { withUndo } from '@/v2/notify'
import type { RunDetail } from '@/v2/types'
import { QuickRepliesEditor } from './QuickRepliesEditor'

/** Parent quick replies above the composer: Approve + "Great job!" (needs-you runs), the family's
 * replies (each fills the composer, never sends) and Edit replies. */
export function QuickReplies({ threadId, run, onFill }: { threadId: number; run?: RunDetail; onFill: (text: string) => void }) {
  const replies = useFamily().data?.quick_replies ?? []
  const approve = useApproveChore()
  const post = usePost(false)
  const [editing, setEditing] = useState(false)

  return (
    <div className="pc-qr" role="group" aria-label="Quick replies">
      {run?.state === 'needs_you' && (
        <button
          type="button"
          data-ok
          onClick={() =>
            withUndo(async () => {
              await approve.mutateAsync(run.id)
              await post.mutateAsync({ threadId, body: 'Great job!' })
            }, `Approved +${run.points}`)
          }
        >
          <Icon name="check" size={15} />
          Approve + “Great job!”
        </button>
      )}
      {replies.map((r) => (
        <button type="button" key={r} onClick={() => onFill(r)}>
          {r}
        </button>
      ))}
      <button type="button" onClick={() => setEditing(true)}>
        <Icon name="edit" size={15} />
        Edit replies
      </button>
      {editing && <QuickRepliesEditor replies={replies} onClose={() => setEditing(false)} />}
    </div>
  )
}
