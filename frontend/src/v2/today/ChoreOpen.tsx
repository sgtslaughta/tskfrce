import Link from 'next/link'
import type { TodayKid, TodayChore } from '../types'
import { useRunDetail } from '../hooks/useChores'
import { useApproveChore, useSendBack } from '../hooks/useToday'
import { Chip } from '../parent/Chip'
import { Icon } from '../parent/Icon'
import { withUndo } from '../notify'

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

  if (!runDetail) return null

  const progressPercent = runDetail.steps.filter((s) => s.done).length / runDetail.steps.length * 100

  return (
    <div className="p-chore-open">
      <div className="p-open-header">
        <h2>
          {kid.name}&apos;s day
        </h2>
        <div className="p-open-actions">
          <Link href={`/kid?as=${kid.id}`} className="p-btn">
            View as kid
          </Link>
          <Link href={`/kids?section=chores&kid=${kid.id}`} className="p-btn">
            Add chore
          </Link>
        </div>
      </div>

      <div className="p-open-progress">
        <div className="p-meter-bar" style={{ width: `${progressPercent}%` }} />
        <span>{runDetail.steps.filter((s) => s.done).length} of {runDetail.steps.length} done</span>
      </div>

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

      {chatOpen && (
        <ChatColumn runId={chore.id} onClose={() => onOpenChat()} />
      )}
    </div>
  )
}

function ChatColumn({ runId, onClose }: { runId: number; onClose: () => void }) {
  return (
    <div data-testid="chat-column" className="p-chat-column">
      <div className="p-chat-header">
        <span>Chat</span>
        <button className="p-chat-close" onClick={onClose} aria-label="Close chat">
          <Icon name="close" />
        </button>
      </div>
      <div className="p-chat-messages" />
      <div className="p-chat-input">
        <textarea placeholder="Type a message..." />
        <button>Send</button>
      </div>
    </div>
  )
}
