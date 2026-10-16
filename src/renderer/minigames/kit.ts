import { useEffect, useRef, useState } from 'react'
import type { Chattiness } from '@shared/minigames'
import type { GamePlay } from './play'
import { busGain, volumesOf } from '@shared/audio'
import { useSettingsStore } from '../stores/settingsStore'

/**
 * Everything a game pack may use from outside its own files, for the half of a pack that is
 * drawn: its component and the entry that registers it. A pack imports from here, from
 * `@shared/minigameKit`, from React and `motion`, and from nowhere else in the game, so the game
 * can change underneath without a pack noticing. `test/minigamePacks.test.ts` holds packs to it.
 *
 * What a pack's styles may use is the game's own design system, as `UI_STYLE_GUIDE.md` gives it:
 * the theme-role variables and the shared classes. That is not wrapped here.
 */

// What a game is handed, and how it is registered.
export {
  registerGame,
  type GameComponent,
  type GamePlay,
  type Opponent,
  type PlayOutcome,
  type PlayResult,
  type TableExpression,
  type RoundAsk
} from './play'

// The game's own controls, so a pack's buttons and fields behave as every other does.
export { gestures, lift, press, quietLift, quietPress, toggleLift } from '../views/motion'
export { TextField } from '../components/TextField'
export { BunnyMark } from '../views/screenIcons'
/** Keys for a game played on the keyboard; `typingIn` is true for a key meant for a text field. */
export { typingIn, useWindowKeydown } from '../components/useWindowKeydown'
/** True where the player has asked for less motion: skip a flourish, never an input. */
export { useReducedMotion } from 'motion/react'

/**
 * Asks whether the game is still on the table: false once it has been taken down, which can
 * happen at any moment. A timer or a promise that comes back late checks it before acting.
 */
export function useOnTable(): () => boolean {
  const on = useRef(true)
  useEffect(() => {
    on.current = true
    return () => {
      on.current = false
    }
  }, [])
  return () => on.current
}

/**
 * True while the player is looking elsewhere: the window has lost focus or the page is hidden.
 * A game on a clock stops it for as long, so nothing is missed that he could not have played.
 */
export function useAway(): boolean {
  const [away, setAway] = useState(() => document.hidden || !document.hasFocus())
  useEffect(() => {
    const read = (): void => setAway(document.hidden || !document.hasFocus())
    document.addEventListener('visibilitychange', read)
    window.addEventListener('blur', read)
    window.addEventListener('focus', read)
    return () => {
      document.removeEventListener('visibilitychange', read)
      window.removeEventListener('blur', read)
      window.removeEventListener('focus', read)
    }
  }, [])
  return away
}

/**
 * Has a girl say something, and waits for her no longer than `capMs`: her line is written by the
 * model and may be slow, and a game goes on rather than stand still for it. The line may then
 * arrive over the next move. Never rejects.
 */
export function sayCapped(
  play: GamePlay,
  charId: string,
  cue: string,
  capMs = 3000
): Promise<void> {
  const said = Promise.resolve()
    .then(() => play.say(charId, cue))
    .catch(() => undefined)
  const cap = new Promise<void>((resolve) => setTimeout(resolve, capMs))
  return Promise.race([said, cap])
}

/**
 * How many remarks a game may still ask for, for the whole table, by how much the player has her
 * talk. `take()` spends one and says whether there was one to spend; `back()` returns one that
 * was not used after all.
 */
export function remarkBudget(
  chattiness: Chattiness,
  caps: Readonly<Record<Chattiness, number>>
): { take: () => boolean; back: () => void; left: () => number } {
  let left = caps[chattiness]
  return {
    take: () => {
      if (left <= 0) return false
      left--
      return true
    },
    back: () => {
      left = Math.min(caps[chattiness], left + 1)
    },
    left: () => left
  }
}

/**
 * Where a pointer is, in an SVG's own units. The surface a game is drawn on hangs slightly
 * tilted, so the element's bounding box is not its coordinate space; this reads through the tilt.
 * Null where the SVG is not on screen.
 */
export function pointIn(
  svg: SVGSVGElement,
  event: { clientX: number; clientY: number }
): { x: number; y: number } | null {
  const matrix = svg.getScreenCTM()
  if (!matrix) return null
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
  return { x: point.x, y: point.y }
}

/** A pack's synthesized effects follow the saved SFX slider's squared gain. */
export function useEffectsGain(): number {
  return useSettingsStore(state => busGain(volumesOf(state.settings?.volumes).sfx))
}
