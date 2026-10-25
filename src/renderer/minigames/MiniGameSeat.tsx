import { MINI_GAMES } from '@shared/minigames'
import { scenePlace } from './place'
import { gameById } from './prefs'
import { useEffect, useRef, type JSX } from 'react'
import type { SceneSeatProps } from '../mods/hooks'
import { fewestWith } from '@shared/minigames'
import { useGameStore } from '../stores/gameStore'
import { DiceIcon } from '../views/screenIcons'
import { agreementAvailable, keptAgreed, useTableStore } from './session'
import { resumeMiniGameResult, useAtTurn, useGamesOffered, useSceneSpent, useTableOpen } from './table'

/**
 * The framework's seat on a scene's rail: there while a game is on offer in this scene, dim
 * while the reader cannot take a turn, and gone otherwise, the scene's closing included.
 */
export function MiniGameSeat({ Seat, visible, open }: SceneSeatProps): JSX.Element {
  const offered = useGamesOffered()
  const tableOpen = useTableOpen()
  // A game she agreed to opens by itself, once her answer has been read out.
  const agreed = useTableStore((s) => s.agreed)
  const atTurn = useAtTurn()
  const activity = useGameStore(s => s.sceneActivity)
  const training = activity?.owner === MINI_GAMES && activity.status === 'pending' ? activity : null
  const openedTraining = useRef<unknown>(null)
  const saved = useGameStore(state => state.sceneMods.miniGame)
  const active = useTableStore(state => state.active)
  const busy = useGameStore(state => state.busy)
  const turnError = useGameStore(state => state.turnError)
  useEffect(() => {
    if (atTurn && !active && !busy && !turnError && saved?.match?.status === 'result') resumeMiniGameResult()
  }, [atTurn, active, busy, turnError, saved])
  // Read at the effect rather than depended on: the rail hands down a new one every render.
  const opener = useRef(open)
  opener.current = open
  useEffect(() => {
    if (!atTurn || !visible || active || saved?.match?.status === 'result') return
    // In hand, or kept beside the save for exactly this point of the scene: a game reloaded
    // between her yes and the table.
    const due = agreed ?? keptAgreed()
    if (!due) {
      if (training && offered.some(game => game.id === training.id) && openedTraining.current !== training) {
        openedTraining.current = training
        opener.current()
      }
      return
    }
    // A girl who has left the scene since she said yes is not sat down; with too few left for
    // the game, there is no game.
    const scene = useGameStore.getState()
    const here = due.charIds.filter(
      (charId) => scene.cast.includes(charId) && !scene.departed.includes(charId)
    )
    const game = gameById(due.gameId)
    if (!game || here.length < (due.charIds.length === 0 && game.players.min === 0 ? 0 : fewestWith(game))) {
      useTableStore.getState().setAgreed(null)
      return
    }
    // Destination context is permission to discuss, not permission to open early.
    if (!agreementAvailable(due, scenePlace(), offered)) return
    if (!agreed || here.length !== due.charIds.length) {
      useTableStore.getState().setAgreed({ ...due, charIds: here })
    }
    opener.current()
  }, [agreed, atTurn, visible, training, offered, active, saved])

  const spent = useSceneSpent()
  // Absent where there is nothing to offer; dim where there is, but not this moment.
  const state =
    !visible || spent || offered.length === 0 ? 'gone' : tableOpen ? 'shown' : 'dim'
  return (
    <Seat
      label={offered.length === 1 ? `Play ${offered[0].name}` : 'Play a game'}
      state={state}
      onClick={open}
    >
      <DiceIcon pips={5} />
    </Seat>
  )
}
