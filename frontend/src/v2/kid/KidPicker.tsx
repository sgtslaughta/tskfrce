import type { KidWhoami } from '../types'

type K = KidWhoami['kids'][number]

/** Big avatar cards in the kid look (kid-gate.css). Never picks for the kid. */
export function KidPicker({ kids, onPick }: { kids: K[]; onPick: (k: K) => void }) {
  return (
    <div className="k-picks">
      {kids.map((k) => (
        <button key={k.id} type="button" className="k-pick" onClick={() => onPick(k)}>
          <span aria-hidden className="k-pick-av">
            {k.avatar || '🙂'}
          </span>
          <span className="k-pick-nm">{k.full_name || 'Me'}</span>
        </button>
      ))}
    </div>
  )
}
