import type { JSX } from 'react'
import { openPanel, type GameModalProps, type ScreenSlotProps } from '@vx/modkit/renderer'
import { PlotTwistModal } from './PlotTwistModal'

export function PlotTwistMenuEntry({ Item, saveOffer }: ScreenSlotProps['gameMenuEntry']): JSX.Element {
  return <Item dead={saveOffer !== 'open'} note="Wait for a safe save point"
    onClick={() => { if (saveOffer === 'open') openPanel('plot-twist') }}>Plot Twist</Item>
}

export function PlotTwistPanel({ theme, onClose }: GameModalProps): JSX.Element {
  return <PlotTwistModal theme={theme} onClose={onClose} />
}
