import type { JSX } from 'react'
import { openPanel, type GameModalProps, type ScreenSlotProps } from '@vx/modkit/renderer'
import { StoryMemoryModal } from './StoryMemoryModal'

export function StoryMemoryMenuEntry({ Item }: ScreenSlotProps['gameMenuEntry']): JSX.Element {
  // Reading is available while a scene settles; the editor owns its write restrictions.
  return <Item onClick={() => { openPanel('story-memory') }}>Story Memory…</Item>
}

export function StoryMemoryPanel({ theme, openGameMenu }: GameModalProps): JSX.Element {
  return <StoryMemoryModal theme={theme} onClose={openGameMenu} />
}
