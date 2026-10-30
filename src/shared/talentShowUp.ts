import { talentEffect, talentsEnabled, type TalentState } from './campusTalents'
import type { GameSave, MemoryType, TimeSlot } from '@vx/modkit/shared'

export interface ShowUpContext {
  term: number
  date: number
  time: TimeSlot
  cast: readonly string[]
  /** Native hangout/reminder scene marker, persisted in SceneState. */
  acceptedInvite: string | null
  events: Readonly<GameSave['events']>
  /** Validated scene memories only, never texts, gifts or old memories. */
  memories: readonly { charId: string; type: MemoryType }[]
}

/** Pure preview: only the real slot boundary may save the paid-day stamp. */
export function showUpHeart(s: TalentState, scene: ShowUpContext): number {
  if (!talentsEnabled() || !s.initialized ||
      (s.showUpDay?.term === scene.term && s.showUpDay.date === scene.date)) return 0
  const bonus = Math.min(2, Math.max(0, Math.floor(talentEffect(s, 'heart.show-up'))))
  if (!bonus) return 0
  const invited = new Set<string>()
  if (scene.acceptedInvite) invited.add(scene.acceptedInvite)
  for (const event of scene.events) {
    // noShow's presence proves native scene opening settled attendance. A newly
    // generated plan at the ending, or an unrelated calendar entry, is not attendance.
    if (event.date !== scene.date || event.time !== scene.time || !Array.isArray(event.noShow)) continue
    for (const id of event.charIds) if (!event.noShow.includes(id)) invited.add(id)
  }
  const memories = scene.memories.filter(m => invited.has(m.charId) && scene.cast.includes(m.charId))
  // Mixed/negative outcomes do not count as a successful meeting. A bystander's
  // approval cannot qualify an invitation its actual invitees did not enjoy.
  if (memories.some(m => m.type === 'disliked' || m.type === 'hated')) return 0
  return memories.some(m => m.type === 'liked' || m.type === 'loved') ? bonus : 0
}
