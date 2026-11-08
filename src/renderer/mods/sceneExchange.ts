import { charKeyOf } from '@shared/types'
import { isEmotion } from '@shared/emotions'
import type { Character, CharInfo, Emotion } from '@shared/types'
import type { Disposition } from '@shared/relationship'
import type { NpcRelationshipMap } from '@shared/npcRelationships'
import { parseSpriteRef, spriteRef } from '@shared/outfits'
import { effectiveDisposition } from '@shared/sceneCreator'
import { useGameStore } from '../stores/gameStore'
import { modIsOn } from '../stores/modsStore'
import { currentRun, loopState, runStale } from '../stores/loop/state'
import { splitOverflow } from '../stores/sceneSanitizer'
import { prepareAutosave } from '../stores/loop/saves'
import { sceneInputHeld, subscribeSceneInput } from '../components/useSceneInput'
import { isOrientationSlot } from '../prompts/introScript'
import { isGraduationSlot } from '../prompts/graduation'
import { boxFits } from '../views/boxRows'
import { useUiStore } from '../stores/uiStore'
import { ownsTurnHold } from './sceneView'

type Game = ReturnType<typeof useGameStore.getState>
function present(game: Game, id: string): boolean {
  return Boolean(game.cast.includes(id) && !game.departed.includes(id) && game.characters[id]?.pose &&
    (game.createdScene || game.charInfo[id]?.nameKnown))
}

/** Whether a native scene is accepting an exchange already displayed outside its dialogue box. */
export function canRecordSceneTurn(modId?: string): boolean {
  const g = useGameStore.getState()
  return Boolean((g.playthroughId || g.createdScene) && !g.createdScene?.over && !g.activeGameOver && g.currentSceneTranscript.length &&
    g.awaitingInput && (!g.busy || !!modId && ownsTurnHold(modId)) && !g.streaming && !g.pendingLines.length && !g.sceneEnding && !g.endingInFlight &&
    !g.replaying && !g.sceneQuiz && !g.sceneActivity && !sceneInputHeld() &&
    (g.createdScene || (!isOrientationSlot(g.date,g.time,g.semesterIndex) && !isGraduationSlot(g.date,g.time))) &&
    g.cast.some(id => present(g, id)))
}

export function subscribeSceneTurns(listener: () => void): () => void {
  const stopGame = useGameStore.subscribe(listener)
  const stopInput = subscribeSceneInput(listener)
  return () => { stopGame(); stopInput() }
}

export interface SceneExchangeContext {
  people: Array<{
    id: string
    profile: Pick<Character,'charId'|'firstName'|'lastName'|'personality'|'behavior'|'backstory'|'likes'|'dislikes'>
    relationship: Pick<CharInfo,'memories'|'flags'|'nameKnown'|'notes'> & {disposition?: Disposition}
  }>
  onScreen: (string|null)[]
  reader: string
  scene: {kind: 'creator'|'story';location:string|null;summary:string|null;readerBio:string;premise?:string;relationships?:NpcRelationshipMap}
}

/** Detached scene-local participant data, also available in Creator without a story save. */
export function sceneExchangeContext(): SceneExchangeContext {
  const g = useGameStore.getState()
  const people = g.cast.filter(id => present(g,id)).map(id => {
    const person = g.characters[id], info = g.charInfo[id]
    const entry = g.createdScene?.setup.cast.find(row => row.charId === id)
    const { charId, firstName, lastName, personality, behavior, backstory, likes, dislikes } = person
    return { id, profile: {charId, firstName, lastName, personality, behavior, backstory, likes, dislikes},
      relationship: {memories: info?.memories.slice(-6) ?? [], flags: info?.flags, nameKnown: info?.nameKnown,
        notes: info?.notes, disposition: entry ? effectiveDisposition(entry) : undefined} }
  })
  return structuredClone({ people, onScreen: g.slots.filter(id => id && present(g,id)),
    reader: [g.playerFirstName,g.playerLastName].join(' '), scene: {
      kind: g.createdScene ? 'creator' : 'story', location:g.sceneLocation, summary:g.sceneSummary, readerBio:g.bio,
      ...(g.createdScene ? {premise:g.createdScene.setup.prompt,relationships:g.npcRelationships} : {}) } })
}

export interface ExternalSceneTurn {
  /** Positive monotonically increasing identity within this exchange. */
  id: number
  participants: readonly string[]
  actions: readonly string[]
  lines: readonly {charId: string; emotion: Emotion; text: string}[]
  deferSave?: boolean
}
export interface SceneExchange {
  /** Whether this handle still belongs to the loaded enabled scene. */
  current(): boolean
  /** Append a validated turn once. Synchronous reentry is refused. */
  append(turn: ExternalSceneTurn): boolean
  /** Request persistence of the last retained story decision. */
  flush(): void
  /** Stop accepting turns and flush any retained decision. */
  close(): void
}

/** Bind display, retries and autosaving to one native decision point, including Creator. */
export function openSceneExchange(modId: string): SceneExchange | null {
  if (!modIsOn(modId, loopState.record) || !canRecordSceneTurn(modId)) return null
  const origin = useGameStore.getState(), run = currentRun()
  let transcript = origin.currentSceneTranscript, log = origin.sceneLog
  let closed = false, applying = false, lastId = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: (() => Promise<void>) | undefined
  const flush = () => {
    clearTimeout(timer); timer = undefined
    const save = pending
    pending = undefined
    if (save) void save().catch(() => useUiStore.getState().showError({
      code:'EXCHANGE_SAVE',message:'Could not save this conversation. Keep the game open and save again.'
    }))
  }
  const current = () => {
    const g = useGameStore.getState()
    return !closed && !runStale(run) && modIsOn(modId, loopState.record) && (applying ||
      (g.playthroughId === origin.playthroughId && g.date === origin.date && g.time === origin.time &&
      g.loads === origin.loads && g.createdScene === origin.createdScene && g.cast === origin.cast &&
      g.currentSceneTranscript === transcript && g.sceneLog === log && canRecordSceneTurn(modId)))
  }
  return {current,flush,close() {closed = true; flush()},append(turn) {
    if (applying || !current() || !Number.isSafeInteger(turn.id) || turn.id < 1 || turn.id < lastId) return false
    if (turn.id === lastId) return true
    const g = useGameStore.getState()
    if (!turn.participants.length || new Set(turn.participants).size !== turn.participants.length ||
        turn.participants.some(id => !present(g,id)) || turn.actions.some(a => typeof a !== 'string' || !a.trim() || a.length > 4000) ||
        turn.lines.some(l => !turn.participants.includes(l.charId) || !isEmotion(l.emotion) || typeof l.text !== 'string' || !l.text.trim() || l.text.length > 4000)) return false
    const dialogue = turn.lines.flatMap(line => {
      const person = g.characters[line.charId], key = charKeyOf(person.firstName,person.lastName)
      const outfit = parseSpriteRef(g.emotions[line.charId] ?? 'neutral')?.set ?? null
      return splitOverflow({speaker:key,text:line.text,actions:[`sprite:${key},${spriteRef(line.emotion,outfit)}`]},boxFits)
    })
    applying = true
    try {
      for (const action of turn.actions) g.logPlayerAction(action,true)
      if (dialogue.length) {
        g.appendSceneLines(dialogue); g.appendPendingLines(dialogue)
        for (const _ of dialogue) g.advanceLine()
      }
      const live = useGameStore.getState()
      transcript = live.currentSceneTranscript; log = live.sceneLog
      loopState.decisionSave = live.captureScene(); loopState.lastTurn = null
      lastId = turn.id
      if (!live.createdScene) {
        const scene = loopState.decisionSave
        pending = prepareAutosave(scene)
        if (!turn.deferSave) flush()
        else if (!timer) timer = setTimeout(flush,15000)
      }
      return true
    } finally { applying = false }
  }}
}

/** Whether the host supports the restricted auxiliary-window bridge. */
export function hasDesktopSurfaces(): boolean {return typeof window !== 'undefined' && Boolean(window.api) && window.api.platform !== 'web'}
