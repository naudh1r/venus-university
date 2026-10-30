import { completeStructured } from '@vx/modkit/renderer'
import { MEANWHILE_MOD, meanwhileEvents, validateMeanwhile, type MeanwhileScene } from '../../shared/meanwhile'
import { buildMeanwhilePrompt } from '../prompts/meanwhilePrompt'
import { useGameStore } from './gameStore'
import { modIsOn } from './modsStore'
import { manualSaveOffer, persistMeanwhileScene } from './loop/saves'

export function meanwhileReady(): boolean {
  const game = useGameStore.getState()
  return modIsOn(MEANWHILE_MOD) && !game.sceneEnding && manualSaveOffer() === 'open'
}

/** Closing the viewer cancels generation and prevents uncommitted results from reaching the write queue. */
export async function generateMeanwhile(id: string, group: string, active: () => boolean): Promise<MeanwhileScene> {
  const game = useGameStore.getState()
  const event = meanwhileEvents(game).find(e => e.id === id)
  if (!event || !meanwhileReady()) throw Error('Wait for the current turn to settle before watching a conversation.')
  if (event.lines.length) return event
  const isCurrent = (): boolean => {
    const live = useGameStore.getState()
    return active() && meanwhileReady() && live.playthroughId === game.playthroughId && live.loads === game.loads &&
      live.date === game.date && live.time === game.time && meanwhileEvents(live).some(e => e.id === id)
  }
  const result = await completeStructured<unknown>(MEANWHILE_MOD, buildMeanwhilePrompt(event, game), { group })
  if (!isCurrent()) throw Error('The game changed. No conversation was saved.')
  if (!result.ok) throw Error(result.error.message)
  const scene = { ...event, lines: validateMeanwhile(result.data,event.participants) }
  await persistMeanwhileScene(scene,isCurrent)
  return scene
}
