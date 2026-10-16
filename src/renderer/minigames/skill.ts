import type { MiniGameDef } from '@shared/minigames'
import type { Character, StructuredRequest } from '@shared/types'
import { objectSchema } from '../prompts/schema'
import { useGameStore } from '../stores/gameStore'

/**
 * How well a girl plays a game: judged once from who she is, by the model, and kept for the
 * playthrough so she plays the same way the next time.
 */

export type SkillLevel = 1 | 2 | 3 | 4 | 5

export interface Skill {
  level: SkillLevel
  /** How she plays, in a few words. */
  style: string
}

/** What she plays at when nothing could be judged. */
const MIDDLING: Skill = { level: 3, style: '' }

function request(character: Character, game: MiniGameDef): StructuredRequest {
  return {
    system: [
      'You judge how good a fictional character would be at a game, from who she is.',
      'Answer in JSON only.'
    ].join('\n'),
    user: [
      `CHARACTER: ${character.firstName} ${character.lastName}`.trim(),
      `Personality: ${character.personality}`,
      `Traits: ${character.traits.join(', ')}`,
      `Likes: ${character.likes.join(', ')}`,
      `Backstory: ${character.backstory}`,
      '',
      `GAME: ${game.name}, ${game.blurb}.`,
      game.skillBrief,
      '',
      '"skill": how well she plays, from "1" (hopeless) to "5" (hard to beat). Most people are a "2" or a "3"; give a "5" only where who she is really earns it.',
      '"style": how she plays, in under ten words, as a note on her at the table.'
    ].join('\n'),
    schema: objectSchema('minigame_skill', ['skill', 'style'], {
      skill: { type: 'string', enum: ['1', '2', '3', '4', '5'] },
      style: { type: 'string' }
    })
  }
}

function keyOf(charId: string, gameId: string): string {
  const playthrough = useGameStore.getState().playthroughId ?? 'none'
  return `vu-minigames:skill:${playthrough}:${charId}:${gameId}`
}

function stored(key: string): Skill | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const { level, style } = JSON.parse(raw) as Partial<Skill>
    if (typeof level !== 'number' || level < 1 || level > 5) return null
    return { level: Math.round(level) as SkillLevel, style: typeof style === 'string' ? style : '' }
  } catch {
    return null
  }
}

/** The judgments under way, so a second ask for the same girl and game waits on the first. */
const judging = new Map<string, Promise<Skill>>()

/**
 * Her skill at a game: what was kept, or a judgment made now. Never fails: a call that does, or
 * an answer that is not one, leaves her middling for this game and is asked again the next time.
 */
export function skillOf(character: Character, game: MiniGameDef): Promise<Skill> {
  const key = keyOf(character.charId, game.id)
  const kept = stored(key)
  if (kept) return Promise.resolve(kept)
  const running = judging.get(key)
  if (running) return running

  // The one bridge call that takes any schema and answers whole, with no stream and no group.
  const call = window.api.llm.classifyHangout(request(character, game)) as Promise<
    { ok: true; data: unknown } | { ok: false; error: unknown }
  >
  const judged = call
    .then((result): Skill => {
      if (!result.ok) return MIDDLING
      const { skill, style } = result.data as { skill?: unknown; style?: unknown }
      const level = Number(skill)
      if (!Number.isInteger(level) || level < 1 || level > 5) return MIDDLING
      const found: Skill = {
        level: level as SkillLevel,
        style: typeof style === 'string' ? style.trim() : ''
      }
      try {
        localStorage.setItem(key, JSON.stringify(found))
      } catch {
        // Kept for this game only.
      }
      return found
    })
    .catch((): Skill => MIDDLING)
    .finally(() => judging.delete(key))
  judging.set(key, judged)
  return judged
}
