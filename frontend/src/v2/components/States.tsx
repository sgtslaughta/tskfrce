import { Button, Skeleton } from '@mantine/core'
import { errorText } from '../errorText'

/** Grey placeholder cards while a page loads: same rhythm as the real cards, so nothing jumps. */
export function LoadingCards({ n = 2, h = 120 }: { n?: number; h?: number }) {
  return (
    <div role="status" aria-label="Loading" style={{ display: 'grid', gap: 12 }}>
      {Array.from({ length: n }, (_, i) => (
        <Skeleton key={i} height={h} radius={8} />
      ))}
    </div>
  )
}

/** A failed load: what happened, in plain words, with a way to try again. */
export function LoadError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="f-card" role="alert" data-tone="red" style={{ display: 'grid', gap: 8, justifyItems: 'start' }}>
      <p style={{ margin: 0 }}>{errorText(error)}</p>
      {onRetry && (
        <Button variant="default" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
