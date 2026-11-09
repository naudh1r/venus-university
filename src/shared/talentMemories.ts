import { talentAffinity, talentMemories, talentMemoryKey, type TalentState } from './campusTalents'
import { echoAffinity, type EchoState } from './echo'
import { talentHeartBonus } from './talentPerks'
import type { CharInfo, CharMemory } from '@vx/modkit/shared'

/** The same earned weights for the opening preview and the final save; neither pays rewards. */
export function settleTalentMemories(
  talents: TalentState,
  before: Record<string, CharInfo>,
  after: Record<string, CharInfo>,
  date: number,
  cast: readonly string[],
  anticipation: Record<string, string>,
  echo?: EchoState
): Record<string, CharInfo> {
  const charInfo = { ...after }
  const castIds = new Set(cast)
  for (const [id, info] of Object.entries(charInfo)) {
    const old = new Set(talentMemories(before[id]).map(talentMemoryKey))
    const hasEcho = echo?.player && echo.girls[id]
    const mark = (m: CharMemory, source: 'scene' | 'text' | 'gift'): CharMemory => {
      if (m.date !== date || old.has(talentMemoryKey(m))) return m
      const anticipated = source === 'scene' && anticipation[id] === talentMemoryKey(m)
      const heart = m.talentHeartMultiplier === undefined ? {
        talentHeartMultiplier: talentHeartBonus(talents, m, source, castIds.size > 1 && castIds.has(id)) + (anticipated ? .25 : 0),
        ...(anticipated ? { talentAnticipation: true as const } : {})
      } : {}
      const affinity = hasEcho && ['liked', 'loved'].includes(m.type) && m.talentEchoMultiplier === undefined
        ? { talentEchoMultiplier: talentAffinity(talents, echoAffinity(echo!, id)) } : {}
      return { ...m, ...heart, ...affinity }
    }
    charInfo[id] = {
      ...info,
      memories: info.memories.map(m => mark(m, 'scene')),
      ...(info.textMemory ? { textMemory: mark(info.textMemory, 'text') } : {}),
      ...(info.giftMemories ? { giftMemories: info.giftMemories.map(m => mark(m, 'gift')) } : {})
    }
  }
  return charInfo
}
