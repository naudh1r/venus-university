import { useCallback, useSyncExternalStore } from 'react'
import type {
  Character, CharInfo, Conversation, Season, SocialPost, TimeSlot
} from '@shared/types'
import type { NpcRelationshipMap } from '@shared/npcRelationships'
import type { PlayerStats } from '@shared/playerStats'
import { useGameStore } from '../stores/gameStore'
import { profileUrl, useCharacterStore } from '../stores/characterStore'
import { sceneActiveOf } from '../stores/textingLoop'
import { reader } from '../stores/loop/promptState'

/** Read-only views of the loaded game. No snapshot shares mutable objects with a store. */
type Game = ReturnType<typeof useGameStore.getState>
type Watch = (onChange: () => void) => () => void
const snapshots = new WeakMap<object, unknown>()

/** A record's own entry by id; an inherited key such as `constructor` is never a record. */
function own<T>(records: Readonly<Record<string, T>> | undefined, id: string): T | undefined {
  return records && Object.hasOwn(records, id) ? records[id] : undefined
}

/** Freezes the copy, never the native object a game action may still update. */
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child)
    Object.freeze(value)
  }
  return value
}

/** Native records use immutable replacement; keep one detached snapshot per native identity. */
function snapshot<T>(value: T): T {
  if (!value || typeof value !== 'object') return value
  if (snapshots.has(value)) return snapshots.get(value) as T
  const copy = freeze(structuredClone(value))
  snapshots.set(value, copy)
  return copy
}

/** Calls back only when this getter's value changes, and releases every native subscription. */
function watch<T>(read: () => T, sources: readonly Watch[], onChange: () => void): () => void {
  let before = read()
  const changed = (): void => {
    const next = read()
    if (Object.is(next, before)) return
    before = next
    onChange()
  }
  const stops = sources.map(source => source(changed))
  return () => { for (const stop of stops) stop() }
}

const gameChanges: Watch = onChange => useGameStore.subscribe(onChange)
const imageChanges: Watch = onChange => useCharacterStore.subscribe(onChange)

/** One projected value with a component hook and a filtered subscription for plain code. */
function valueReader<T>(select: (game: Game) => T) {
  const read = (): T => snapshot(select(useGameStore.getState()))
  const subscribe = (onChange: () => void): (() => void) => watch(read, [gameChanges], onChange)
  return { read, subscribe, use: (): T => useSyncExternalStore(subscribe, read, read) }
}

/** One record by id, with no updates from other records or unrelated stores. */
function recordReader<T>(select: (game: Game, id: string) => T, sources = [gameChanges]) {
  const read = (id: string): T => snapshot(select(useGameStore.getState(), id))
  const subscribe = (id: string, onChange: () => void): (() => void) =>
    watch(() => read(id), sources, onChange)
  const use = (id: string): T => {
    const get = useCallback(() => read(id), [id])
    const follow = useCallback((onChange: () => void) => subscribe(id, onChange), [id])
    return useSyncExternalStore(follow, get, get)
  }
  return { read, subscribe, use }
}

const characters = recordReader<Readonly<Character> | undefined>((game, id) =>
  game.playthroughId ? own(game.characters, id) : undefined)
/** Her loaded definition, or undefined without a game or that character. @since 0.8.0 */
export const character = characters.read
/** Her definition in a component. @since 0.8.0 */
export const useCharacter = characters.use
/** Watches only that character's definition and its availability. @since 0.8.0 */
export const subscribeCharacter = characters.subscribe

const infos = recordReader<Readonly<CharInfo> | undefined>((game, id) =>
  game.playthroughId ? own(game.charInfo, id) : undefined)
/** Her current game state, detached from the game's record. @since 0.8.0 */
export const characterInfo = infos.read
/** Her game state in a component. @since 0.8.0 */
export const useCharacterInfo = infos.use
/** Watches only her state record and its availability. @since 0.8.0 */
export const subscribeCharacterInfo = infos.subscribe

const EMPTY_IDS: readonly string[] = Object.freeze([])
let roster: { chars: readonly string[]; alumni: readonly string[]; ids: readonly string[] } | undefined
/** Active roster ids, with alumni appended once when requested. @since 0.8.0 */
export function rosterIds(options: { alumni?: boolean } = {}): readonly string[] {
  const game = useGameStore.getState()
  if (!game.playthroughId) return EMPTY_IDS
  if (!options.alumni) return snapshot(game.chars)
  if (roster?.chars === game.chars && roster.alumni === game.alumni) return roster.ids
  const ids = Object.freeze([...new Set([...game.chars, ...game.alumni])])
  roster = { chars: game.chars, alumni: game.alumni, ids }
  return ids
}
/** Watches the requested roster, including changes when a game is loaded or left. @since 0.8.0 */
export function subscribeRosterIds(
  onChange: () => void, options: { alumni?: boolean } = {}
): () => void {
  const alumni = options.alumni === true
  return watch(() => rosterIds({ alumni }), [gameChanges], onChange)
}
/** The requested roster in a component. @since 0.8.0 */
export function useRosterIds(options: { alumni?: boolean } = {}): readonly string[] {
  const alumni = options.alumni === true
  const get = useCallback(() => rosterIds({ alumni }), [alumni])
  const follow = useCallback((onChange: () => void) => subscribeRosterIds(onChange, { alumni }), [alumni])
  return useSyncExternalStore(follow, get, get)
}

const conversations = recordReader<Readonly<Conversation> | undefined>((game, id) =>
  game.playthroughId ? own(game.bunnyboard.conversations, id) : undefined)
/** One thread as the loaded game holds it, including its messages. @since 0.8.0 */
export const conversation = conversations.read
/** One thread in a component. @since 0.8.0 */
export const useConversation = conversations.use
/** Watches only this thread, not other conversations or phone navigation. @since 0.8.0 */
export const subscribeConversation = conversations.subscribe

const EMPTY_FEED: readonly Readonly<SocialPost>[] = Object.freeze([])
const feeds = recordReader<readonly Readonly<SocialPost>[]>((game, id) =>
  game.playthroughId ? own(game.charInfo, id)?.feed ?? EMPTY_FEED : EMPTY_FEED)
/**
 * Her posts in saved order, without filtering visibility or arrival dates. To show what the
 * player sees, keep the posts the kit's `postVisible` passes. @since 0.8.0
 */
export const feed = feeds.read
/** Her feed in a component. @since 0.8.0 */
export const useFeed = feeds.use
/** Watches only her post list and its availability. @since 0.8.0 */
export const subscribeFeed = feeds.subscribe

const relationships = valueReader<Readonly<NpcRelationshipMap> | undefined>(game =>
  game.playthroughId ? game.npcRelationships : undefined)
/** The loaded game's NPC pair records. @since 0.8.0 */
export const npcRelationships = relationships.read
/** The NPC pair records in a component. @since 0.8.0 */
export const useNpcRelationships = relationships.use
/** Watches only the relationship map and its availability. @since 0.8.0 */
export const subscribeNpcRelationships = relationships.subscribe

let seenClock: Readonly<{ date: number; time: TimeSlot; season: Season }> | undefined
const clocks = valueReader(game => {
  if (!game.playthroughId) return undefined
  const { date, time } = game
  const season = game.calendar.season
  if (seenClock?.date !== date || seenClock.time !== time || seenClock.season !== season) {
    seenClock = { date, time, season }
  }
  return seenClock
})
/** The game date, half-day and season; undefined without a playthrough. @since 0.8.0 */
export const clock = clocks.read
/** The clock in a component. @since 0.8.0 */
export const useClock = clocks.use
/** Watches only date, time, season and availability. @since 0.8.0 */
export const subscribeClock = clocks.subscribe

const stats = valueReader<Readonly<PlayerStats> | undefined>(game =>
  game.playthroughId ? game.stats : undefined)
/** The player's current stats, not default character-generation values. @since 0.8.0 */
export const playerStats = stats.read
/** The player's current stats in a component. @since 0.8.0 */
export const usePlayerStats = stats.use
/** Watches only the stats and their availability. @since 0.8.0 */
export const subscribePlayerStats = stats.subscribe

const pictures = valueReader(game => game.playthroughId ? game.profilePicture : null)
/** The player's profile picture, or null without a game or picture. @since 0.8.0 */
export const playerProfilePicture = pictures.read
/** The player's profile picture in a component. @since 0.8.0 */
export const usePlayerProfilePicture = pictures.use
/** Watches only the player's picture. @since 0.8.0 */
export const subscribePlayerProfilePicture = pictures.subscribe

const readMarks = valueReader(game => {
  if (!game.playthroughId) return undefined
  const marker = (game.bunnyboard as { feedReadThrough?: unknown }).feedReadThrough
  return typeof marker === 'number' ? marker : undefined
})
/** Bunnyfeeds' old board-wide read marker, for migration; undefined when absent. @since 0.8.0 */
export const feedReadThrough = readMarks.read
/** The legacy marker in a component. @since 0.8.0 */
export const useFeedReadThrough = readMarks.use
/** Watches only the legacy marker and its availability. @since 0.8.0 */
export const subscribeFeedReadThrough = readMarks.subscribe

const active = valueReader(game => Boolean(game.playthroughId) && sceneActiveOf(game))
/** Core's exact scene-ownership predicate, false without a loaded playthrough. @since 0.8.0 */
export const sceneActive = active.read
/** Whether a scene owns the screen, for a component. @since 0.8.0 */
export const useSceneActive = active.use
/** Watches changes to scene ownership, not changes to every scene field. @since 0.8.0 */
export const subscribeSceneActive = active.subscribe

const prompts = valueReader(game => game.playthroughId ? reader() : undefined)
/** The native READER prompt block, or undefined without a playthrough. @since 0.8.0 */
export const readerPromptText = prompts.read
/** The native READER block in a component. @since 0.8.0 */
export const useReaderPromptText = prompts.use
/** Watches only changes in the native block's output. @since 0.8.0 */
export const subscribeReaderPromptText = prompts.subscribe

const profileImages = recordReader((game, id) => {
  if (!game.playthroughId || !own(game.characters, id)) return undefined
  return profileUrl(id, own(useCharacterStore.getState().spriteVersion, id) ?? 0)
}, [gameChanges, imageChanges])
/** Her profile image URL with native cache invalidation; undefined without her game. @since 0.8.0 */
export const profileImageUrl = profileImages.read
/** Her profile image in a component. @since 0.8.0 */
export const useProfileImageUrl = profileImages.use
/** Watches only her profile image URL, including a new sprite version. @since 0.8.0 */
export const subscribeProfileImageUrl = profileImages.subscribe
