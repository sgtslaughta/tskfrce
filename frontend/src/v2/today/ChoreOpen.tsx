import Link from 'next/link'
import { useMediaQuery } from '@mantine/hooks'
import { Drawer } from '@mantine/core'
import { useState } from 'react'
import type { TodayKid, TodayChore } from '../types'
import { useRunDetail } from '../hooks/useChores'
import { useApproveChore, useSendBack } from '../hooks/useToday'
import { Chip } from '../parent/Chip'
import { Icon } from '../parent/Icon'
import { withUndo } from '../notify'
import { ChatColumn } from './ChatColumn'

export function ChoreOpen({
  chore,
  kid,
  onOpenChat,
  chatOpen,
}: {
  chore: TodayChore
  kid: TodayKid
  onOpenChat: () => void
  chatOpen: boolean
}) {
  const { data: runDetail } = useRunDetail(chore.id)
  const approve = useApproveChore()
  const sendBack = useSendBack()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [drawerOpen, setDrawerOpen] = useState(false)

  if (!runDetail) return null

  const progressPercent = runDetail.steps.length > 0 ? runDetail.steps.filter((s) => s.done).length / runDetail.steps.length * 100 : 0

  return (
    <div className="p-chore-open">
      <div className="p-open-content">
        <div className="p-chore-steps">
          {runDetail.steps.map((step, idx) => (
            <div key={step.id} className="p-step">
              <input type="checkbox" checked={step.done} className="p-step-checkbox" />
              <span className="p-step-title">{step.title}</span>
              {step.done && step.done_at && (
                <span className="p-step-time">
                  {new Date(step.done_at).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              )}
              <button className="p-step-reply">Reply</button>
            </div>
          ))}
        </div>

        {runDetail.photos.length > 0 && (
          <div className="p-chore-photos">
            {runDetail.photos.map((photo) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={photo.id} src={photo.thumb_url} alt="chore" className="p-photo-thumb" />
            ))}
          </div>
        )}

        <div className="p-action-panel">
          <button
            className="p-btn"
            onClick={() =>
              withUndo(() => approve.mutateAsync(chore.id), `Approved +${chore.points}`)
            }
          >
            Approve +{chore.points}
          </button>
          <button
            className="p-btn"
            onClick={() => sendBack.mutateAsync({ id: chore.id, note: '' })}
          >
            Send back
          </button>
          <button
            className="p-btn"
            onClick={onOpenChat}
          >
            Open chat
          </button>
        </div>
      </div>

      {isMobile ? (
        <Drawer
          opened={chatOpen}
          onClose={() => onOpenChat()}
          position="bottom"
          size="58%"
          title="Chat"
          closeButtonProps={{ 'aria-label': 'Close chat' }}
        >
          <ChatColumn runId={chore.id} onClose={() => onOpenChat()} />
        </Drawer>
      ) : (
        chatOpen && (
          <ChatColumn runId={chore.id} onClose={() => onOpenChat()} />
        )
      )}
    </div>
  )
}
