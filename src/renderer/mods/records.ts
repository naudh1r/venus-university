import { appError, toAppError } from '@shared/errors'
import { modById } from '@shared/mods'
import type { PostComment } from '@shared/postComments'
import { MEMORY_TYPES, type CharMemory, type ModSlice, type Result, type SocialPost } from '@shared/types'
import { bindRecordWrites, postCommentsOwner, type RecordChange } from '@vx/modkit/host/renderer'
import type { ModDataRecord, RecordRef, RecordWriteOptions } from '@vx/modkit/renderer'
import { useGameStore } from '../stores/gameStore'
import { loopState, runStale } from '../stores/loop/state'
import { modIsOn } from '../stores/modsStore'

/**
 * A mod's writes to the game's own records: its slice on a text, a post or a comment, the
 * comments under a post, and a memory of hers. Each one is in memory only, and goes out with the
 * next save; a refusal changes nothing and comes back as the result's error, never as a throw.
 */

type GameState = ReturnType<typeof useGameStore.getState>

const DONE: Result<null> = { ok: true, data: null }

const STALE_MESSAGE = 'The game changed. Reopen this and try again.'

function refused(code: string, message: string): Result<null> {
  return { ok: false, error: appError(code, message) }
}

/** Why `modId` cannot write to the game now, or null where it can. */
function writeRefusal(modId: string, run: object | undefined): Result<null> | null {
  if (!modIsOn(modId, loopState.record)) return refused('MOD_WRITE_OFF', 'That mod is off.')
  if (!useGameStore.getState().playthroughId) return refused('MOD_WRITE_NO_GAME', 'There is no game to write into.')
  if (run !== undefined && runStale(run)) return refused('MOD_WRITE_STALE', STALE_MESSAGE)
  return null
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Whether `ex` holds nothing but a slice of `modId`'s own. */
function ownSlicesOnly(ex: unknown, modId: string): boolean {
  if (ex === undefined) return true
  if (!isPlainObject(ex)) return false
  return Object.entries(ex).every(
    ([key, slice]) => key === modId && isPlainObject(slice) && typeof slice.v === 'string'
  )
}

/** A record found in the store, and the change that puts a new copy of it in its place. */
interface Found<R> {
  record: R
  put: (state: GameState, next: R) => Partial<GameState>
}

/** Her post `postId` in `state`, or null. */
function findPost(state: GameState, charId: string, postId: string): Found<SocialPost> | null {
  if (!Object.hasOwn(state.charInfo, charId)) return null
  const at = state.charInfo[charId].feed?.findIndex((post) => post.id === postId) ?? -1
  if (at < 0) return null
  return {
    record: state.charInfo[charId].feed![at],
    put: (now, next) => {
      const info = now.charInfo[charId]
      const feed = [...info.feed!]
      feed[at] = next
      return { charInfo: { ...now.charInfo, [charId]: { ...info, feed } } }
    }
  }
}

/** The live record `ref` names in `state`, or null where there is none. */
function findRecord(state: GameState, ref: RecordRef): Found<ModDataRecord> | null {
  if (!isPlainObject(ref) || typeof ref.charId !== 'string') return null
  switch (ref.kind) {
    case 'message': {
      const chats = state.bunnyboard.conversations
      if (typeof ref.messageId !== 'string' || !Object.hasOwn(chats, ref.charId)) return null
      const at = chats[ref.charId].messages.findIndex((message) => message.id === ref.messageId)
      if (at < 0) return null
      return {
        record: chats[ref.charId].messages[at],
        put: (now, next) => {
          const chat = now.bunnyboard.conversations[ref.charId]
          const messages = [...chat.messages]
          messages[at] = next as (typeof messages)[number]
          const conversations = { ...now.bunnyboard.conversations, [ref.charId]: { ...chat, messages } }
          return { bunnyboard: { ...now.bunnyboard, conversations } }
        }
      }
    }
    case 'post': {
      if (typeof ref.postId !== 'string') return null
      const post = findPost(state, ref.charId, ref.postId)
      return post && { record: post.record, put: (now, next) => post.put(now, next as typeof post.record) }
    }
    case 'comment': {
      if (typeof ref.postId !== 'string' || typeof ref.commentId !== 'string') return null
      const post = findPost(state, ref.charId, ref.postId)
      const at = post?.record.comments?.findIndex((comment) => comment.id === ref.commentId) ?? -1
      if (!post || at < 0) return null
      return {
        record: post.record.comments![at],
        put: (now, next) => {
          const current = findPost(now, ref.charId, ref.postId)!.record
          const comments = [...current.comments!]
          comments[at] = next as PostComment
          return post.put(now, { ...current, comments })
        }
      }
    }
    default:
      return null
  }
}

/**
 * A record field's write: the live record `ref` names, handed to `change`, gets the mod's slice
 * it answers with and loses the legacy keys it names. Refused where the mod is off, there is no
 * game, `run` has been left, or the record is not there.
 */
function updateRecord(
  modId: string,
  ref: RecordRef,
  change: (record: Readonly<ModDataRecord>) => RecordChange | undefined,
  options: RecordWriteOptions
): Result<null> {
  try {
    const refusal = writeRefusal(modId, options.run)
    if (refusal) return refusal
    const found = findRecord(useGameStore.getState(), ref)
    if (!found) return refused('MOD_WRITE_GONE', 'That record is no longer in the game.')
    const next = change(found.record)
    if (next === undefined) return DONE
    const record: Record<string, unknown> = { ...found.record }
    for (const key of next.drop) {
      if (key !== 'id' && key !== 'ex') delete record[key]
    }
    record.ex = { ...found.record.ex, [modId]: next.slice }
    let outcome = refused('MOD_WRITE_STALE', STALE_MESSAGE)
    useGameStore.setState((state) => {
      // The mod's `change` ran in between: a record it moved is not the one this write was made from.
      const again = findRecord(state, ref)
      if (again?.record !== found.record) return {}
      outcome = DONE
      return again.put(state, record as ModDataRecord)
    })
    return outcome
  } catch (err) {
    return { ok: false, error: toAppError(err, 'MOD_WRITE_FAILED') }
  }
}

bindRecordWrites({ update: updateRecord })

// The native comment's own fields only. Partial, so a field other code adds to `PostComment`
// stays off the list, and a comment holding one is refused.
const COMMENT_KEYS = {
  id: 'string',
  handle: 'string',
  emoji: 'string',
  text: 'string',
  at: 'number',
  ex: 'ex'
} as const satisfies Partial<Record<keyof PostComment, 'string' | 'number' | 'ex'>>

/** Why `comment` cannot go under a post for `modId`, or null where it can. */
function commentRefusal(comment: unknown, modId: string): string | null {
  if (!isPlainObject(comment)) return 'A comment is not an object.'
  for (const [key, value] of Object.entries(comment)) {
    const kind = Object.hasOwn(COMMENT_KEYS, key) ? COMMENT_KEYS[key as keyof typeof COMMENT_KEYS] : undefined
    if (kind === undefined) return `A comment has \`${key}\`, which is not a comment's; a mod keeps its own in its slice.`
    if (kind === 'ex' ? !ownSlicesOnly(value, modId) : kind === 'number' ? !Number.isFinite(value) : typeof value !== 'string') {
      return `A comment's \`${key}\` is not what a comment holds there.`
    }
  }
  if (typeof comment.id !== 'string' || comment.id === '') return 'A comment has no id.'
  for (const key of ['handle', 'emoji', 'text', 'at'] as const) {
    if (!Object.hasOwn(comment, key)) return `A comment has no \`${key}\`.`
  }
  return null
}

/**
 * Adds `comments` under her post, after the ones already there, for the mod that draws the
 * feed's comments. Each is a comment's own fields and the mod's slice, under an id no comment of
 * the post has. Refused with `MOD_WRITE_NOT_OWNER` for any other mod, `MOD_WRITE_INVALID` for a
 * comment that is not one, `MOD_WRITE_GONE` where the post is not there, and as a record write is.
 */
export function addPostComments(
  modId: string,
  post: { charId: string; postId: string },
  comments: readonly PostComment[],
  options: RecordWriteOptions = {}
): Result<null> {
  try {
    const refusal = writeRefusal(modId, options.run)
    if (refusal) return refusal
    if (postCommentsOwner()?.modId !== modId) {
      return refused('MOD_WRITE_NOT_OWNER', "Another mod draws the feed's comments.")
    }
    if (!Array.isArray(comments)) return refused('MOD_WRITE_INVALID', 'The comments are not a list.')
    for (const comment of comments) {
      const why = commentRefusal(comment, modId)
      if (why) return refused('MOD_WRITE_INVALID', why)
    }
    const copies = structuredClone(comments) as PostComment[]
    if (new Set(copies.map((comment) => comment.id)).size < copies.length) {
      return refused('MOD_WRITE_INVALID', 'Two comments share an id.')
    }
    let outcome = refused('MOD_WRITE_GONE', 'That post is no longer in the game.')
    useGameStore.setState((state) => {
      const found = findPost(state, post?.charId, post?.postId)
      if (!found) return {}
      const before = found.record.comments ?? []
      if (before.some((one) => copies.some((comment) => comment.id === one.id))) {
        outcome = refused('MOD_WRITE_INVALID', 'A comment has the id of one already under the post.')
        return {}
      }
      outcome = DONE
      return found.put(state, { ...found.record, comments: [...before, ...copies] })
    })
    return outcome
  } catch (err) {
    return { ok: false, error: toAppError(err, 'MOD_WRITE_FAILED') }
  }
}

const MEMORY_KEYS = new Set(['date', 'type', 'desc', 'ex'])

/** Why `memory` cannot be one of hers for `modId`, or null where it can. */
function memoryRefusal(memory: unknown, modId: string): string | null {
  if (!isPlainObject(memory)) return 'The memory is not an object.'
  const stray = Object.keys(memory).find((key) => !MEMORY_KEYS.has(key))
  if (stray !== undefined) return `The memory has \`${stray}\`, which a new memory does not; a mod keeps its own in its slice.`
  if (!Number.isInteger(memory.date)) return "The memory's date is not a game date."
  if (!MEMORY_TYPES.includes(memory.type as CharMemory['type'])) return "The memory's type is not one of the game's."
  if (typeof memory.desc !== 'string' || memory.desc.trim() === '') return 'The memory says nothing.'
  if (!ownSlicesOnly(memory.ex, modId)) return "The memory holds a slice that is not the mod's own."
  return null
}

/**
 * Adds a memory of hers, where every prompt, her affection and the memory list read memories,
 * marked as the mod's: it carries the mod's slice, an empty one where it brings none. `replacing`
 * picks which of her memories the mod marked before go in its place; no other memory is asked.
 * `adopting` picks only from memories with no slices, for migrating older saves. These include
 * the game's own memories, so it must match only what the mod wrote before its switch.
 * Refused with `MOD_WRITE_INVALID` for a memory that is not one, `MOD_WRITE_GONE` where she is
 * not in the game, and as a record write is.
 */
export function addMemory(
  modId: string,
  charId: string,
  memory: CharMemory,
  options: RecordWriteOptions & {
    replacing?: (memory: Readonly<CharMemory>) => boolean
    adopting?: (memory: Readonly<CharMemory>) => boolean
  } = {}
): Result<null> {
  try {
    const refusal = writeRefusal(modId, options.run)
    if (refusal) return refusal
    const why = memoryRefusal(memory, modId)
    if (why) return refused('MOD_WRITE_INVALID', why)
    const copy = structuredClone(memory)
    const slice: ModSlice = { v: modById(modId)?.version ?? '0.0.0', data: null }
    copy.ex = { [modId]: copy.ex?.[modId] ?? slice }
    const state = useGameStore.getState()
    if (!Object.hasOwn(state.charInfo, charId)) return refused('MOD_WRITE_GONE', 'She is not in the game.')
    const memories = state.charInfo[charId].memories
    const { replacing, adopting } = options
    const kept = replacing || adopting
      ? memories.filter((one) => {
          if (one.ex !== undefined && Object.hasOwn(one.ex, modId)) return !replacing?.(one)
          if (one.ex === undefined || Object.keys(one.ex).length === 0) return !adopting?.(one)
          return true
        })
      : memories
    let outcome = refused('MOD_WRITE_STALE', STALE_MESSAGE)
    useGameStore.setState((now) => {
      const info = now.charInfo[charId]
      // A matcher ran in between: memories it changed are not the ones it was asked about.
      if (info?.memories !== memories) return {}
      outcome = DONE
      return { charInfo: { ...now.charInfo, [charId]: { ...info, memories: [...kept, copy] } } }
    })
    return outcome
  } catch (err) {
    return { ok: false, error: toAppError(err, 'MOD_WRITE_FAILED') }
  }
}

/** The reader's like on her post, put on or taken off as his heart on it does; nothing for a post that is not there. */
export function toggleFeedLike(charId: string, postId: string): void {
  useGameStore.getState().toggleFeedLike(charId, postId)
}
