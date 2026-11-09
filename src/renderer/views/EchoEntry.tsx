import type { JSX } from 'react'
import { openPanel, type GameModalProps, type ScreenSlotProps } from '@vx/modkit/renderer'
import { EchoIcon } from './EchoIcon'
import { EchoPanel } from './EchoPanel'

export function EchoRailButton({ Seat, visible, dead }: ScreenSlotProps['railButton']): JSX.Element {
  return <Seat label="Echoes" state={!visible ? 'gone' : dead ? 'dim' : 'shown'}
    onClick={() => { if (visible && !dead) openPanel('echo') }}><EchoIcon /></Seat>
}

export function EchoLandingTool({ Tool, visible }: ScreenSlotProps['landingTool']): JSX.Element | null {
  return visible ? <Tool label="Echoes" onClick={() => { openPanel('echo') }}><EchoIcon /></Tool> : null
}

export function EchoGamePanel({ theme, covered, onClose }: GameModalProps): JSX.Element {
  return <EchoPanel hidden={covered} theme={theme} onClose={onClose} />
}
