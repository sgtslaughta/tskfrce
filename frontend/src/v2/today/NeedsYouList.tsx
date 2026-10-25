import type { NeedsItem } from '../types'
import { useApproveChore, useSendBack } from '../hooks/useToday'
import { Chip } from '../parent/Chip'
import { withUndo } from '../notify'
import { EmptyState } from '../parent/states'

export function NeedsYouList({ items }: { items: NeedsItem[] }) {
  const approve = useApproveChore()
  const sendBack = useSendBack()

  if (items.length === 0) {
    return <EmptyState icon="celebration" tone="acc" title="All caught up" body="Nothing needs your OK right now. Nice." />
  }

  return (
    <div className="p-needs-list">
      {items.map((item) => (
        <div key={`${item.kid_id}-${item.type}-${item.id}`} className="p-needs-item">
          <div className="p-needs-header">
            <span className="p-needs-kid">{item.kid_name}</span>
            <span className="p-needs-title">{item.title}</span>
          </div>
          <div className="p-needs-actions">
            {item.type === 'chore' && (
              <>
                <button
                  className="p-btn"
                  onClick={() =>
                    withUndo(() => approve.mutateAsync(item.id), 'Approved')
                  }
                >
                  Approve +{item.cost ?? 10}
                </button>
                <button
                  className="p-btn"
                  onClick={() =>
                    sendBack.mutateAsync({ id: item.id, note: '' })
                  }
                >
                  Send back
                </button>
              </>
            )}
            {item.type === 'reward' && (
              <>
                <button
                  className="p-btn"
                  onClick={() => approve.mutateAsync(item.id)}
                >
                  Approve
                </button>
                <button
                  className="p-btn"
                  onClick={() => approve.mutateAsync(item.id)}
                >
                  Decline
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
