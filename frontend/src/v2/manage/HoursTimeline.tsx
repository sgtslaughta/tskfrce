import { useMemo } from 'react'
import type { Kid, Group, TimeWindow } from '@/v2/types'

interface HoursTimelineProps {
  windows: TimeWindow[]
  kids: Kid[]
  groups: Group[]
}

type TextureType = 'solid' | 'crosshatch' | 'horizontal'

type WindowScope = 'family' | 'kid' | 'group'

function getTextureForWindow(window: TimeWindow): TextureType {
  if (window.kid_id) return 'crosshatch'
  if (window.group_id) return 'horizontal'
  return 'solid'
}

function getWindowScope(window: TimeWindow): WindowScope {
  if (window.kid_id) return 'kid'
  if (window.group_id) return 'group'
  return 'family'
}

function getWindowLabel(window: TimeWindow, kids: Kid[], groups: Group[]): string {
  if (window.kid_id) {
    const kid = kids.find((k) => k.id === window.kid_id)
    const initials = kid?.full_name ? kid.full_name.charAt(0).toUpperCase() : '?'
    const kindLabel = window.kind === 'free' ? 'Free time' : 'Allowed'
    return `${kindLabel} (${initials})`
  }
  if (window.group_id) {
    const group = groups.find((g) => g.id === window.group_id)
    return `${window.kind === 'free' ? 'Free time' : 'Allowed'}: ${group?.name || 'Unknown group'}`
  }
  return window.kind === 'free' ? 'Free time' : 'Allowed'
}

function TimelineRow({ window, kids, groups }: { window: TimeWindow; kids: Kid[]; groups: Group[] }) {
  const texture = getTextureForWindow(window)
  const label = getWindowLabel(window, kids, groups)

  const startPercent = (parseInt(window.start.split(':')[0]) * 60 + parseInt(window.start.split(':')[1])) / (24 * 60) * 100
  const endPercent = (parseInt(window.end.split(':')[0]) * 60 + parseInt(window.end.split(':')[1])) / (24 * 60) * 100
  const width = endPercent - startPercent

  return (
    <div className={`timeline-row texture-${texture}`}>
      <div className="timeline-label">{label}</div>
      <div className="timeline-bars">
        <div
          className="timeline-bar"
          style={{
            left: `${startPercent}%`,
            width: `${width}%`,
          }}
          aria-label={`${window.start} - ${window.end}`}
        />
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
          <h4>Legend</h4>
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
