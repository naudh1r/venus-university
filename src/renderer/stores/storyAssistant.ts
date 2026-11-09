import { useEffect } from 'react'
import { STAT_ATTRACTIONS } from '@shared/playerStats'
import { loveLifeBlurb } from '@shared/relationship'
import { memoryBudgetFor } from '@shared/settingsRules'
import {
  cancelCalls,
  completeStructured,
  isGraduationSlot,
  isOrientationSlot,
  lessNsfwText,
  modState,
  useModOption
} from '@vx/modkit/renderer'
import {
  affectionFor,
  dedupedMemoriesFor,
  dispositionOf,
  emptyFlags,
  globalSlotOf,
  messageOf,
  relationshipTagOf,
  type Character,
  type CharFlags,
  type SceneLine,
  type StructuredRequest,
  type TimeSlot
} from '@vx/modkit/shared'
import {
  ASSISTANT_CHOICES,
  cleanAssistantPrompt,
  STORY_ASSISTANT,
  storyAssistantReplyOf,
  type ChoiceCount,
  type StoryAssistantReply
} from '../../shared/storyAssistant'
import { formatChatDivider, formatDateBanner } from '../prompts/gameDate'
import { memoryLines, notesLines, secretLines } from '../prompts/scenePrompt'
import { transcriptStubs } from '../prompts/schedulePrompt'
import {
  buildStoryAssistantPrompt,
  DEFAULT_ASSISTANT_PROMPT,
  wholeWord,
  type AssistantContext,
  type AssistantGirl,
  type AssistantName
} from '../prompts/storyAssistantPrompt'
import { upcomingPlanLines } from '../prompts/upcomingPlans'
import { useGameStore } from './gameStore'
import { settingNow } from './lorebookStore'
import { replyRowOfferOf } from './loop/playback'
import { memoryBudgetsNow, reader, sceneSoFar, secretBudgetNow } from './loop/promptState'

type GameState = ReturnType<typeof useGameStore.getState>

/** How the assistant's seat stands on the rail. */
export type AssistantSeat = 'shown' | 'dim' | 'gone'

/**
 * Where the seat stands: gone wherever there is no cast scene to talk about — a replay, a created
 * scene, an exam, a solo scene, the orientation and the graduation epilogue, a scene into its
 * ending — and shown only where every line delivered has been read and a turn could go out.
 */
function assistantSeatOf(s: GameState): AssistantSeat {
  if (s.replaying || s.createdScene || s.activeGameOver || s.sceneQuiz) return 'gone'
  if (s.sceneEnding || s.statusShown || s.statusModal !== null) return 'gone'
  if (s.cast.length === 0) return 'gone'
  if (isOrientationSlot(s.date, s.time, s.semesterIndex) || isGraduationSlot(s.date, s.time)) return 'gone'
  if (s.busy || s.streaming || s.pendingLines.length > 0 || s.turnError) return 'dim'
  return s.awaitingInput || replyRowOfferOf(s) === 'open' ? 'shown' : 'dim'
}

/** {@link assistantSeatOf} for a component, kept current as the game moves. */
export function useAssistantSeat(): AssistantSeat {
  return useGameStore(assistantSeatOf)
}

/** Whether the scene has lines on it yet. */
export function useSceneStarted(): boolean {
  return useGameStore((s) => s.currentSceneTranscript.length > 0)
}

/** How many ways forward a read is asked for, off the choices option. */
export function useChoiceCount(): ChoiceCount {
  return useModOption(STORY_ASSISTANT, ASSISTANT_CHOICES.fit) ? 'fit' : 'four'
}

/** Where the player's own prompt is kept: on this computer, in the window's own storage. */
const KEPT_PROMPT = 'vu-story-assistant:prompt'

/** The player's own prompt, or undefined where the shipped one stands or storage cannot be read. */
export function storedAssistantPrompt(): string | undefined {
  try {
    return cleanAssistantPrompt(localStorage.getItem(KEPT_PROMPT))
  } catch {
    return undefined
  }
}

/**
 * Keeps `text` as the player's prompt, or goes back to the shipped one where it is blank or the
 * shipped text itself; null once kept, or the sentence saying why it was not.
 */
export function saveAssistantPrompt(text: string): string | null {
  const prompt = cleanAssistantPrompt(text)
  try {
    if (prompt === undefined || prompt === DEFAULT_ASSISTANT_PROMPT) localStorage.removeItem(KEPT_PROMPT)
    else localStorage.setItem(KEPT_PROMPT, prompt)
    return null
  } catch {
    return 'Could not save the Story Assistant prompt.'
  }
}

/** The point in the scene a read is taken at; any change to the scene since makes it stale. */
interface ScenePoint {
  playthroughId: string | null
  loads: number
  transcript: readonly SceneLine[]
  marks: GameState['sceneSummaries']
}

/** The point a game stands at. */
function pointOf(game: Pick<GameState, 'playthroughId' | 'loads' | 'currentSceneTranscript' | 'sceneSummaries'>): ScenePoint {
  return {
    playthroughId: game.playthroughId,
    loads: game.loads,
    transcript: game.currentSceneTranscript,
    marks: game.sceneSummaries
  }
}

/**
 * Whether two points are one: the same game and the very same scene, line for line. A copy of the
 * same lines is the same point; a cut, a new line or a rewritten one — a new line object — is not.
 */
function samePoint(a: ScenePoint, b: ScenePoint): boolean {
  return (
    a.playthroughId === b.playthroughId &&
    a.loads === b.loads &&
    a.transcript.length === b.transcript.length &&
    a.transcript.every((line, at) => line === b.transcript[at]) &&
    a.marks.length === b.marks.length &&
    a.marks.every((mark, at) => mark.at === b.marks[at].at && mark.summary === b.marks[at].summary)
  )
}

/** A read that came back: where it was taken, what was asked, and what the assistant said. */
interface AssistantRead {
  point: ScenePoint
  question: string
  /** The cancel group it went out under, which tells one read from the next. */
  group: string
  reply: StoryAssistantReply
}

/** The newest read, the read under way and the newest failure, each by the group it went out under. */
interface AssistantState {
  read: AssistantRead | null
  asking: { point: ScenePoint; question: string; group: string } | null
  failed: { point: ScenePoint; question: string; group: string; message: string } | null
}

/** Story Assistant's state; nothing of it is saved, and a game entered or left starts it over. */
const assistant = modState<AssistantState>(STORY_ASSISTANT, {
  initial: { read: null, asking: null, failed: null },
  lifetime: 'game'
})

/** The group of the one call still out, kept apart from the state, which a game boundary resets. */
let out: string | null = null

/** What the assistant has where the scene stands now: a read, one under way, or a failure. */
export type AssistantNow = AssistantState

/** {@link AssistantNow} off the two stores; anything taken at another point is none. */
function assistantNowOf(state: AssistantState, game: GameState): AssistantNow {
  const now = pointOf(game)
  const at = <T extends { point: ScenePoint }>(entry: T | null): T | null =>
    entry && samePoint(entry.point, now) ? entry : null
  return { read: at(state.read), asking: at(state.asking), failed: at(state.failed) }
}

/** {@link AssistantNow} as the stores stand this moment. */
export function assistantNow(): AssistantNow {
  return assistantNowOf(assistant.get(), useGameStore.getState())
}

/** {@link AssistantNow} for a component, kept current as either store moves. */
export function useAssistantNow(): AssistantNow {
  const state = assistant.use()
  // Each a field of its own, so the hook answers to the scene moving and nothing else.
  useGameStore((s) => s.currentSceneTranscript)
  useGameStore((s) => s.sceneSummaries)
  useGameStore((s) => s.loads)
  useGameStore((s) => s.playthroughId)
  return assistantNowOf(state, useGameStore.getState())
}

/** Cancels the call still out, if any; its answer is then dropped unseen. */
function cancelAssistant(): void {
  if (out !== null) void cancelCalls(STORY_ASSISTANT, out)
  out = null
  if (assistant.get().asking) assistant.set({ ...assistant.get(), asking: null })
}

/**
 * Cancels a read under way that the scene has moved past, and leaving the game cancels any: for
 * whatever stands over the stage for as long as the assistant is on.
 */
export function useAssistantCancels(): void {
  const transcript = useGameStore((s) => s.currentSceneTranscript)
  const marks = useGameStore((s) => s.sceneSummaries)
  const loads = useGameStore((s) => s.loads)
  const playthroughId = useGameStore((s) => s.playthroughId)
  useEffect(() => cancelAssistant, [])
  useEffect(() => {
    if (out === null) return
    // A reset state has no read under way, though its call may still be out.
    const { asking } = assistant.get()
    if (!asking || !samePoint(asking.point, pointOf(useGameStore.getState()))) cancelAssistant()
  }, [transcript, marks, loads, playthroughId])
}

/** How many earlier slots are carried whatever they were about. */
const EARLIER_NEWEST = 4
/** How many more, further back, are carried for naming a girl in the scene. */
const EARLIER_NAMING = 4

/**
 * The finished slots before this one worth the assistant knowing, dated and oldest first: the
 * newest few, and a few further back that name a girl in the scene by the name he knows her by.
 */
function earlierSlots(game: GameState, names: readonly string[]): string[] {
  const now = globalSlotOf(game.date, game.time)
  const slots = Object.entries(game.history)
    .flatMap(([day, halves]) =>
      ([0, 1] as TimeSlot[]).flatMap((time) => {
        const summary = halves?.[time]?.trim()
        const date = Number(day)
        return summary && globalSlotOf(date, time) < now ? [{ date, time, summary }] : []
      })
    )
    .sort((a, b) => globalSlotOf(b.date, b.time) - globalSlotOf(a.date, a.time))
  const naming = (summary: string): boolean => names.some((name) => wholeWord(name).test(summary))
  const picked = [
    ...slots.slice(0, EARLIER_NEWEST),
    ...slots.slice(EARLIER_NEWEST).filter((slot) => naming(slot.summary)).slice(0, EARLIER_NAMING)
  ]
  return picked
    .reverse()
    .map((slot) => `${formatChatDivider(slot.date, slot.time, game.calendar.season)}: ${slot.summary}`)
}

/** Which of her contact page's cards are open to the reader: each on its persisted flag or the live condition. */
function revealsOf(flags: CharFlags, affection: number): { traits: boolean; backstory: boolean; loveLife: boolean } {
  const disposition = dispositionOf(affection)
  const trusted = disposition === 'trusted' || disposition === 'devoted'
  return {
    traits: flags.knowsTraits || trusted || disposition === 'friendly',
    backstory: flags.knowsBackstory || trusted,
    loveLife: flags.knowsLoveLife || flags.isLover
  }
}

/** A girl of the cast as the request may name her: by her first name once the reader has learned it. */
function nameOf(game: GameState, character: Character): AssistantName {
  return {
    name: game.charInfo[character.charId]?.nameKnown ? character.firstName : null,
    names: [character.firstName, character.lastName]
  }
}

/** One girl in the scene as the player has been shown her, off her contact page's own rule. */
function girlOf(game: GameState, character: Character, castSize: number, plans: string[]): AssistantGirl {
  const info = game.charInfo[character.charId]
  const flags = info?.flags ?? emptyFlags()
  const affection = affectionFor(info, game.date, character)
  const reveals = revealsOf(flags, affection)
  const { name, names } = nameOf(game, character)
  const profile: string[] = []
  const record: string[] = []
  if (name !== null && flags.gaveContactInfo) {
    if (character.likes?.length) profile.push(`${name} likes: ${character.likes.join(', ')}.`)
    if (character.dislikes?.length) profile.push(`${name} dislikes: ${character.dislikes.join(', ')}.`)
    if (reveals.traits) profile.push(`${name} likes guys with ${STAT_ATTRACTIONS[character.preferredStat]}.`)
    if (reveals.backstory && character.backstory?.trim()) profile.push(`Backstory: ${character.backstory.trim()}`)
    const loveLife = loveLifeBlurb(character, flags)
    if (reveals.loveLife && loveLife) profile.push(`Love life: ${loveLife}`)
    const budget = memoryBudgetFor(memoryBudgetsNow(), castSize)
    record.push(
      ...memoryLines(character, dedupedMemoriesFor(info).slice(-budget), info?.textMemory, game.calendar.season)
    )
  }
  if (name !== null) {
    record.push(...secretLines(info?.toldSecrets, secretBudgetNow()))
    record.push(...notesLines(name, info?.notes))
    record.push(...plans)
  }
  return { name, names, tag: relationshipTagOf(flags, affection), flags, profile, record }
}

/** What one read of the scene is built from, off the store as it stands. */
function contextNow(question: string, choices: ChoiceCount): AssistantContext {
  const game = useGameStore.getState()
  const season = game.calendar.season
  const cast = game.cast.flatMap((charId) => game.characters[charId] ?? [])
  const present = cast.filter((character) => !game.departed.includes(character.charId))
  // From the next slot on: a plan for this one is the scene being played.
  const plans = upcomingPlanLines(game.events, game.characters, globalSlotOf(game.date, game.time) + 1, season)
  const girls = present.map((character) =>
    girlOf(game, character, present.length, plans[character.charId] ?? [])
  )
  const known = girls.flatMap((girl) => (girl.name ? [girl.name] : []))
  return {
    setting: settingNow(),
    reader: reader(),
    stats: game.stats,
    when: formatDateBanner(game.date, game.time, season),
    earlier: earlierSlots(game, known),
    girls,
    departed: cast
      .filter((character) => game.departed.includes(character.charId))
      .map((character) => nameOf(game, character)),
    summary: game.sceneSummary,
    lines: transcriptStubs(sceneSoFar(), cast, true),
    question,
    prompt: storedAssistantPrompt() ?? '',
    choices,
    lessNsfwText: lessNsfwText()
  }
}

/** Tells the asks apart, so only the newest one's answer lands. */
let asks = 0

/**
 * Asks for a read of the scene where it stands, `question` answered where one is given, in place
 * of any read still under way. What comes back is kept on the store; an answer that lands after
 * the scene has moved, or after a later ask, is dropped unseen.
 */
export async function askAssistant(question: string, choices: ChoiceCount): Promise<void> {
  cancelAssistant()
  const point = pointOf(useGameStore.getState())
  const asked = question.trim()
  const group = `read-${++asks}`
  let request: StructuredRequest
  try {
    request = buildStoryAssistantPrompt(contextNow(asked, choices))
  } catch (err) {
    assistant.set({ ...assistant.get(), failed: { point, question: asked, group, message: messageOf(err) } })
    return
  }
  assistant.set({ ...assistant.get(), asking: { point, question: asked, group }, failed: null })
  out = group
  const result = await completeStructured<unknown>(STORY_ASSISTANT, request, { group })
  if (out === group) out = null
  if (assistant.get().asking?.group !== group) return
  if (!samePoint(point, pointOf(useGameStore.getState()))) {
    assistant.set({ ...assistant.get(), asking: null })
    return
  }
  const reply = result.ok ? storyAssistantReplyOf(result.data) : null
  if (reply) {
    assistant.set({ ...assistant.get(), asking: null, read: { point, question: asked, group, reply } })
    return
  }
  const message = result.ok
    ? 'The assistant came back with nothing to say.'
    : result.error.message
  assistant.set({ ...assistant.get(), asking: null, failed: { point, question: asked, group, message } })
}
