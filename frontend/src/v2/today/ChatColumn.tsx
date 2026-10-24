import { Icon } from '../parent/Icon'

export function ChatColumn({ runId, onClose }: { runId: number; onClose: () => void }) {
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
