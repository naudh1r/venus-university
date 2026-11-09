import type { ComponentType } from 'react'
import type { Emotion } from '@shared/types'
import type { Chattiness } from '@shared/minigames'
import type { RoundAsk } from './round'

export type { RoundAsk } from './round'

/** A native sprite expression that appears with a spoken line. */
export type TableExpression = Emotion

/**
 * What a mini-game is to the framework while it is being played: a component handed a
 * {@link GamePlay}, which is everything it may ask of the scene it is played in. What goes on
 * inside the component is the pack's own business.
 */

/**
 * How a game came out. `played` is a game with nobody to beat. `broken` is never a game's own: it
 * is the framework's, for a game whose screen failed and was taken down part way.
 */
export type PlayOutcome = 'won' | 'lost' | 'draw' | 'played' | 'abandoned' | 'broken'

export interface PlayResult {
  outcome: PlayOutcome
  /** What happened, in a sentence or two of the scene's own narration ("You ..."). */
  summary: string
  /**
   * What the game wants the scene's writer to know about how it went, for a game played with a
   * girl: the moves, the turns of luck, whatever she might bring up. One line each. The reader is
   * not shown it; she reacts to it in the reply that follows the game. What goes in is the
   * game's own call.
   */
  account?: readonly string[]
}

/** A girl at the table. */
export interface Opponent {
  charId: string
  /** What the reader calls her. */
  name: string
  /** How well she plays, from 1 to 5. */
  skill: 1 | 2 | 3 | 4 | 5
  /** How she plays, in a few words; empty where nothing was judged. */
  style: string
  /** Optional game-specific signed tendencies, from -2 to 2. */
  biases?: Readonly<Record<string, number>>
}

export interface GamePlay {
  /** The girls playing against the reader; none for a game played alone. */
  opponents: readonly Opponent[]
  /** The id of the place the scene is at, or null where it has none: a pool, or the sea. */
  location: string | null
  /**
   * The game's text is being read at the reader's own pace: {@link GamePlay.narrate} resolves
   * only once he has moved past the line before it. A game played in turns then waits on each
   * line it narrates before its next move, and drops its own pauses for reading.
   */
  stepped: boolean
  /** Which of the game's aids are on, by id, as the game and the player have them. */
  aids: Readonly<Record<string, boolean>>
  /**
   * The reader has made a move by key: at his own pace, that is him moving on, and the line on
   * the box counts as read. A press on the table's surface is taken so already; a game says it
   * for a move made on the keyboard. Nothing where the text keeps its own time.
   */
  moved: () => void
  /**
   * Resolves once the reader has moved past everything the game has said so far: the moment for
   * the next move at a table read at his own pace. At once where the text keeps its own time.
   */
  read: () => Promise<void>
  /** What is riding on the game, as the scene settled it; empty where nothing is. */
  stake: string
  /** How much she is to say for herself, as the player has it set; what that comes to is the game's. */
  chattiness: Chattiness
  /** How this game is to be played: every option the game declares, settled or at its default. */
  options: Readonly<Record<string, number>>
  /** The first move is made: from here, leaving the table is walking away from a game. */
  started: () => void
  /**
   * Whether {@link GamePlay.narrate} puts the game's moves in the dialogue box, as the game and
   * the player have it. Mostly it does not: the box keeps to what people say, and anything the
   * reader needs to notice has to be on the game's own surface, not only in its narration.
   */
  playByPlay: boolean
  /**
   * Says something in the scene's own dialogue box, in the game's words and at once: a move
   * made, a card turned. It goes onto the scene's transcript like any narration. The first one
   * is a first move: whatever of a reply was still unread is dropped. Resolves once the line is
   * on the box, which is after everything said before it; most games need not wait. Where
   * {@link GamePlay.playByPlay} is off, nothing is shown and it resolves after a short beat.
   */
  narrate: (text: string) => Promise<void>
  /**
   * Has a girl at the table say something: the model writes her one short line from `cue`, the
   * game's plain account of what just happened ("she called lower on a queen and an ace came").
   * Each is a call to the model and takes a moment, so a game keeps them for the moments worth
   * one. Resolves when her line is on the box, or when there will be none.
   */
  say: (charId: string, cue: string) => Promise<void>
  /**
   * Puts a girl's line on the dialogue box as hers, in words the game already has: what a
   * {@link GamePlay.round} wrote for her. Resolves once it has had its time on the box.
   */
  speak: (charId: string, text: string, expression?: TableExpression) => Promise<void>
  /**
   * Something the reader says as part of the game, typed into the game's own field: an answer, a
   * question, a pick. It goes onto the scene as his words; nobody answers it unless the game asks.
   */
  readerSays: (text: string) => void
  /**
   * Asks the reader to type something, in the scene's own line under the dialogue box: the one
   * place he types, whatever is asked of him. `placeholder` says what is wanted ("Your answer…").
   * Resolves with what he sent, or null where the asking ended first: the table closed, the game
   * asked for something else, or called {@link GamePlay.stopAsking}. Nothing goes on the scene
   * by itself: a game puts his words there with {@link GamePlay.readerSays}.
   */
  ask: (placeholder: string) => Promise<string | null>
  /** Takes back a question the reader has not answered: he chose another way, a button say. */
  stopAsking: () => void
  /**
   * Asks the model to run one round no code can play: what a girl asks or dares, what she makes
   * of an answer, who she picks. Comes back as the fields the game named, or null where the model
   * could not be had, which a game has to be able to carry on from. Takes a few seconds.
   */
  round: (ask: RoundAsk) => Promise<Record<string, string> | null>
  /**
   * Tells the framework how the game stands, in a sentence or two, whenever that changes. It is
   * what she is reminded of when she speaks, the reader's own remarks at the table included.
   */
  situation: (text: string) => void
  /**
   * What the scene should know of the game so far, should the reader walk away from it now: the
   * same lines an account is made of, said again whenever there is more to say. A game that never
   * says leaves a game walked away from as only that.
   */
  progress: (account: readonly string[]) => void
  /**
   * The game is over. The component keeps showing how it ended for a beat; then the framework
   * clears the table and takes the result into the scene.
   */
  finish: (result: PlayResult) => void
}

export type GameComponent = ComponentType<{ play: GamePlay }>

const components = new Map<string, GameComponent>()

/** A game's component, registered once from its pack's own files, under the game's id. */
export function registerGame(gameId: string, component: GameComponent): void {
  components.set(gameId, component)
}

export function gameComponent(gameId: string): GameComponent | undefined {
  return components.get(gameId)
}
