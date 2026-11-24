import type { JSX } from 'react'
import type { ScreenSlotProps } from '@vx/modkit/renderer'
import { ReckoningContinuation, ReckoningPreparation } from './ReckoningModal'
import { UnspokenVoice } from './UnspokenVoice'

/** Ordinary-scene presence. The active dungeon keeps its separate recovery lifecycle. */
export function ReckoningPanelLayer({ blocked, covered, uiHidden, cinematic }: ScreenSlotProps['panelLayer']): JSX.Element {
  return <>
    <ReckoningPreparation />
    <UnspokenVoice hidden={blocked || covered || uiHidden || cinematic} />
    <ReckoningContinuation blocked={blocked || covered} />
  </>
}
