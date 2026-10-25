import { useMemo } from 'react'
import type { Kid, Group, TimeWindow } from '@/v2/types'

interface HoursTimelineProps {
  windows: TimeWindow[]
  kids: Kid[]
  groups: Group[]
}

type TextureType = 'solid' | 'crosshatch' | 'horizontal'

function getTextureForWindow(window: TimeWindow): TextureType {
  if (window.kid_id) return 'crosshatch'
  if (window.group_id) return 'horizontal'
  return 'solid'
}

const DAY = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** "Every day" / "Weekdays" / "Weekends" / "M W F" from a days string like "01234" (0 = Monday). */
export function daysLabel(days: string): string {
  const set = Array.from(new Set(days.split(''))).sort().join('')
  if (set === '0123456') return 'Every day'
  if (set === '01234') return 'Weekdays'
  if (set === '56') return 'Weekends'
  return set.split('').map((d) => DAY[Number(d)]).join(' ')
}

function getWindowLabel(window: TimeWindow, kids: Kid[], groups: Group[]): string {
  const who = window.kid_id
    ? kids.find((k) => k.id === window.kid_id)?.full_name ?? 'A kid'
    : window.group_id
      ? groups.find((g) => g.id === window.group_id)?.name ?? 'A group'
      : 'Everyone'
  return `${who} · ${window.kind === 'free' ? 'Free time' : 'Allowed'} · ${daysLabel(window.days)}`
}

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Bar segments in % of the day; an overnight window (22:00-02:00) becomes two. */
export function segments(start: string, end: string): Array<[number, number]> {
  const s = (minutes(start) / 1440) * 100
  const e = (minutes(end) / 1440) * 100
  if (s === e) return [[0, 100]]
  return s < e ? [[s, e]] : [[s, 100], [0, e]]
}

function TimelineRow({ window, kids, groups }: { window: TimeWindow; kids: Kid[]; groups: Group[] }) {
  const texture = getTextureForWindow(window)
  const label = getWindowLabel(window, kids, groups)
  const initial = window.kid_id ? (kids.find((k) => k.id === window.kid_id)?.full_name ?? '?').charAt(0).toUpperCase() : null

  return (
    <div className={`timeline-row texture-${texture}`} data-kind={window.kind}>
      <div className="timeline-label" title={label}>
        {label}
      </div>
      <div className="timeline-bars">
        {segments(window.start, window.end).map(([from, to]) => (
          <div
            key={from}
            className="timeline-bar"
            style={{ left: `${from}%`, width: `${to - from}%` }}
            role="img"
            aria-label={`${window.start} to ${window.end}`}
          >
            {initial && <b>{initial}</b>}
          </div>
        ))}
      </div>
    </div>
  )
}

export function HoursTimeline({ windows, kids, groups }: HoursTimelineProps) {
  const usedTextures = useMemo(() => {
    const textures = new Set<TextureType>()
    windows.forEach((w) => {
      textures.add(getTextureForWindow(w))
    })
    return Array.from(textures)
  }, [windows])

  const textureLabels: Record<TextureType, string> = {
    solid: 'Family-wide',
    crosshatch: 'Per child',
    horizontal: 'Per group',
  }

  return (
    <div className="hours-timeline">
      <div className="timeline-header">
        <div className="timeline-label-area"></div>
        <div className="timeline-axis">
          <div className="timeline-tick">12a</div>
          <div className="timeline-tick">6a</div>
          <div className="timeline-tick">12p</div>
          <div className="timeline-tick">6p</div>
          <div className="timeline-tick">12a</div>
        </div>
      </div>

      <div className="timeline-rows">
        {windows.length === 0 && (
          <p className="m-empty">Add a window to set when devices can be online.</p>
        )}
        {windows.map((window) => (
          <TimelineRow key={`${window.id}`} window={window} kids={kids} groups={groups} />
        ))}
      </div>

      {usedTextures.length > 0 && (
        <div className="timeline-legend" role="region" aria-label="Legend">
          <h3>Legend</h3>
          <div className="legend-items">
            {usedTextures.map((texture) => (
              <div key={texture} className={`legend-item texture-${texture}`}>
                <div className="legend-sample"></div>
                <span className="legend-label">{textureLabels[texture]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
