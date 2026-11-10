import { useEffect, useState } from 'react'
import type { CompanionApi } from '../shared/screenCompanion'

export function CompanionMoveHandle({ api, enabled }: { api: CompanionApi; enabled: boolean }) {
  const [hovering, setHovering] = useState(false)
  useEffect(() => {
    return api.onMoveHandle(setHovering)
  }, [api])
  return enabled ? <div className={`companion-move-handle${hovering ? ' is-visible' : ''}`} title="Drag to move her" aria-label="Drag to move her">✥</div> : null
}
