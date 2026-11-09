import { useSyncExternalStore } from 'react'
import {
  charKeyOf,
  DEFAULT_PLAYER_STATS,
  type Character,
  type CharInfo,
  type Conversation,
  type NpcRelationshipMap,
  type PlayerStats,
  type Season,
  type TimeSlot
} from '@vx/modkit/shared'
import {
  character,
  characterInfo,
  conversation,
  rosterIds,
  clock,
  gameFacts,
  npcRelationships,
  playerStats,
  playerProfilePicture,
  currentRun,
  subscribeCharacter,
  subscribeCharacterInfo,
  subscribeConversation,
  subscribeRosterIds,
  subscribeClock,
  subscribeNpcRelationships,
  subscribePlayerStats,
  subscribePlayerProfilePicture,
  useGameFacts
} from '@vx/modkit/renderer'

/** The records Bunnyfeeds uses, assembled from the kit's detached snapshots. */
export interface BunnyfeedsContext {
  playthroughId: string | null
  playerFirstName: string
  date: number
  time: TimeSlot
  calendar: { season: Season }
  chars: readonly string[]
  characters: Readonly<Record<string, Readonly<Character>>>
  charInfo: Readonly<Record<string, Readonly<CharInfo>>>
  charKeyToId: Readonly<Record<string, string>>
  npcRelationships: Readonly<NpcRelationshipMap> | undefined
  stats: Readonly<PlayerStats>
  profilePicture: string | null
  bunnyboard: { conversations: Readonly<Record<string, Readonly<Conversation>>> }
}

let keys: readonly unknown[] = []
let value: BunnyfeedsContext | undefined

/** Keeps one view until one of the public records or facts it contains changes. */
export function readBunnyfeedsContext(): BunnyfeedsContext {
  const ids = rosterIds({ alumni: true })
  const chars = rosterIds()
  const definitions = ids.map(character)
  const infos = ids.map(characterInfo)
  const chats = ids.map(conversation)
  const at = clock()
  const facts = gameFacts()
  const pairs = npcRelationships()
  const stats = playerStats()
  const picture = playerProfilePicture()
  const next = [ids, chars, ...definitions, ...infos, ...chats, at, facts.playthroughId,
    facts.readerName, pairs, stats, picture, currentRun()]
  if (value && next.length === keys.length && next.every((one, i) => one === keys[i])) return value

  const characters: Record<string, Readonly<Character>> = Object.create(null)
  const charInfo: Record<string, Readonly<CharInfo>> = Object.create(null)
  const conversations: Record<string, Readonly<Conversation>> = Object.create(null)
  const charKeyToId: Record<string, string> = Object.create(null)
  ids.forEach((id, i) => {
    const definition = definitions[i]
    if (definition) {
      characters[id] = definition
      charKeyToId[charKeyOf(definition.firstName, definition.lastName)] = id
    }
    if (infos[i]) charInfo[id] = infos[i]
    if (chats[i]) conversations[id] = chats[i]
  })
  keys = next
  value = {
    playthroughId: facts.playthroughId,
    playerFirstName: facts.readerName,
    date: at?.date ?? 0,
    time: at?.time ?? 0,
    calendar: { season: at?.season ?? 'spring' },
    chars,
    characters: Object.freeze(characters),
    charInfo: Object.freeze(charInfo),
    charKeyToId: Object.freeze(charKeyToId),
    npcRelationships: pairs,
    stats: stats ?? DEFAULT_PLAYER_STATS,
    profilePicture: picture,
    bunnyboard: { conversations: Object.freeze(conversations) }
  }
  return value
}

/** Follows the roster and only the records represented in the view, including alumni. */
function followBunnyfeedsContext(onChange: () => void): () => void {
  let records: Array<() => void> = []
  const bind = (): void => {
    records.forEach(stop => stop())
    records = rosterIds({ alumni: true }).flatMap(id => [
      subscribeCharacter(id, onChange),
      subscribeCharacterInfo(id, onChange),
      subscribeConversation(id, onChange)
    ])
  }
  bind()
  const stops = [
    subscribeRosterIds(() => { bind(); onChange() }, { alumni: true }),
    subscribeRosterIds(onChange),
    subscribeClock(onChange),
    subscribeNpcRelationships(onChange),
    subscribePlayerStats(onChange),
    subscribePlayerProfilePicture(onChange)
  ]
  return () => {
    records.forEach(stop => stop())
    stops.forEach(stop => stop())
  }
}

/** The same stable view for a component, refreshed by the kit's narrow subscriptions. */
export function useBunnyfeedsContext<T>(select: (view: BunnyfeedsContext) => T): T {
  useGameFacts()
  return select(useSyncExternalStore(
    followBunnyfeedsContext, readBunnyfeedsContext, readBunnyfeedsContext
  ))
}
