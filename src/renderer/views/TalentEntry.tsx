import type { JSX } from 'react'
import { openPanel, type GameModalProps, type ScreenSlotProps } from '@vx/modkit/renderer'
import { TalentIcon } from './TalentIcon'
import { TalentPanel } from './TalentPanel'

export function TalentRailButton({ Seat, visible, dead }: ScreenSlotProps['railButton']): JSX.Element {
  return <Seat label="Skill trees" state={!visible ? 'gone' : dead ? 'dim' : 'shown'}
    onClick={() => { if (visible && !dead) openPanel('campus-talents') }}><TalentIcon /></Seat>
}

export function TalentLandingTool({ Tool, visible }: ScreenSlotProps['landingTool']): JSX.Element | null {
  return visible ? <Tool label="Skill trees" onClick={() => { openPanel('campus-talents') }}><TalentIcon /></Tool> : null
}

export function TalentGamePanel({ theme, onClose }: GameModalProps): JSX.Element {
  return <TalentPanel theme={theme} onClose={onClose} />
}
