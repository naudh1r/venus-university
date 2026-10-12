import type { CharInfo } from '@shared/types'
import { messageOf } from '@shared/errors'
import {
  threadWork,
  type FeedThreadsResponse,
  type HeldFeedMemory,
  type ThreadWork
} from '@shared/feedComments'
import { globalSlotOf } from '@shared/jobs'
import { areNpcFriends } from '@shared/npcRelationships'
import type { PostComment } from '@shared/postComments'
import {
  charKeyOf,
  type MemoryType,
  type SocialPost,
  type StructuredRequest
} from '@shared/types'
import {
  buildFeedThreadsPrompt,
  type FeedThread,
  type ThreadLine
} from '../prompts/feedCommentsPrompt'
import {
  FEED_EMOJI,
  FEED_EMOJI_BAG,
  FEED_HANDLE_BAG,
  FEED_HANDLE_POOL
} from '../prompts/feedRandoms'
import { SETTING } from '../prompts/setting'
import { hasTexted } from '../prompts/textingPrompt'
import { markCommented } from './feedVisit'
import { repliersFor, type Replier } from './feedComments'
import { fileDueFeedMemories, holdFeedMemories } from './feedMemory'
import { useGameStore } from './gameStore'
import { useGrabBagStore } from './grabBagStore'
import { lessNsfwTextNow, reader } from './loop/promptState'
import { currentRun, loopState, runStale, LOOP_LLM_GROUP } from './loop/state'
import { retrySilently } from './silentRetry'

/**
 * The feed's comment threads: once a slot, one call answers whatever was said under her posts
 * since the last round — the reader's comments always, other people's within her reply cap.
 */

/** The most posts one call answers; the rest wait a slot, the reader's first in line. */
const MAX_THREADS = 8

const MEMORY_TYPES: readonly MemoryType[] = ['loved', 'liked', 'disliked', 'hated']

/** The reader's own name on a comment he left. */
const PLAYER_HANDLE = 'you'

/** One post owed an answer, with where it lives. */
interface Owed {
  charId: string
  post: SocialPost
  work: ThreadWork
}

/** Every post the thread call owes something to as of global slot `now`, the reader's first. */
function owedThreads(now: number): Owed[] {
  const game = useGameStore.getState()
  const owed: Owed[] = []
  for (const charId of game.chars) {
    for (const post of game.charInfo[charId]?.feed ?? []) {
      const work = threadWork(post.comments, charId, post.threadedThrough, now)
      if (work) owed.push({ charId, post, work })
    }
  }
  return owed
    .sort((a, b) => b.work.player.length - a.work.player.length)
    .slice(0, MAX_THREADS)
}

/** A post's repliers with every girl the reader tagged under it added, once each. */
function withTagged(
  repliers: Replier[],
  comments: readonly PostComment[],
  posterId: string
): Replier[] {
  const game = useGameStore.getState()
  const listed = new Set(repliers.map(({ character }) => character.charId))
  const added: Replier[] = []
  for (const tagged of comments.flatMap((one) => one.tags ?? [])) {
    const character = game.characters[tagged]
    if (!character || tagged === posterId || listed.has(tagged)) continue
    listed.add(tagged)
    added.push({
      character,
      charKey: charKeyOf(character.firstName, character.lastName),
      friend: areNpcFriends(game.npcRelationships, posterId, tagged),
      info: game.charInfo[tagged]
    })
  }
  return [...repliers, ...added]
}

/** Who said a comment, worded for the thread block. */
function whoSaid(comment: PostComment, posterId: string): string {
  const game = useGameStore.getState()
  if (comment.player) return 'the reader'
  const character = comment.charId ? game.characters[comment.charId] : undefined
  if (!character) return `@${comment.handle} (a stranger)`
  const key = charKeyOf(character.firstName, character.lastName)
  return comment.charId === posterId
    ? `${character.firstName} (the poster)`
    : `${character.firstName} ("${key}")`
}

/** Sends the prompt, re-sending itself quietly for as long as its budget lasts. */
async function send(request: StructuredRequest, run: object): Promise<FeedThreadsResponse | null> {
  for (let spent = 0; ; spent++) {
    const result = await window.api.llm.completeFeedThreads(request, LOOP_LLM_GROUP)
    if (runStale(run)) return null
    if (result.ok) return result.data
    const again = await retrySilently('feed threads', result.error, spent, {
      onSleep: (cancel) => loopState.parkedWaiters.push(cancel)
    })
    if (runStale(run)) return null
    if (!again) {
      console.warn('[feed] no thread replies:', result.error.message)
      return null
    }
  }
}

/** The thread call is out; a second waits for it rather than racing it. */
let out = false

/** Forgets a second call owed by a game being left. */
export function resetFeedThreads(): void {
  askAgain = false
}

/** A comment arrived while a call was out; asked again once it lands. */
let askAgain = false

/**
 * Asks for the thread replies owed right now, unless nothing is owed. `next` stamps what lands
 * for the slot after this one, so an answer to a comment he just left is waiting when the slot
 * turns; the slot opening's catch-up shows its answers at once. What lands is filed under each
 * post and the post marked answered through this slot; a call that never lands leaves every
 * post owed, so the next slot asks again.
 */
export async function armFeedThreads(showAt: 'now' | 'next' = 'now'): Promise<void> {
  if (out) {
    askAgain = true
    return
  }
  const game = useGameStore.getState()
  const now = globalSlotOf(game.date, game.time)
  const owed = owedThreads(now)
  if (owed.length === 0) return

  // Short refs the reply names comments by, unique across the whole call.
  const byRef = new Map<string, { owed: Owed; comment: PostComment }>()
  const refOf = new Map<string, string>()
  const threads: FeedThread[] = []
  for (const entry of owed) {
    const { charId, post, work } = entry
    const character = game.characters[charId]
    const info = game.charInfo[charId]
    if (!character || !info) continue
    const shown = (post.comments ?? []).filter((one) => one.at <= now)
    for (const comment of shown) {
      const ref = `c${byRef.size + 1}`
      byRef.set(ref, { owed: entry, comment })
      refOf.set(comment.id, ref)
    }
    const lines: ThreadLine[] = shown.map((comment) => ({
      ref: refOf.get(comment.id) ?? '',
      who: whoSaid(comment, charId),
      text: comment.text,
      ...(comment.replyTo && refOf.has(comment.replyTo)
        ? { replyTo: refOf.get(comment.replyTo) }
        : {})
    }))
    threads.push({
      character,
      info,
      charKey: charKeyOf(character.firstName, character.lastName),
      texted: hasTexted(game.bunnyboard.conversations[charId]),
      post: {
        text: post.text,
        date: post.date,
        time: post.time,
        ...(post.photo?.scene ? { picture: post.photo.scene } : {})
      },
      lines,
      mustAnswer: work.player.map((one) => refOf.get(one.id) ?? ''),
      mayAnswer: work.others.map((one) => refOf.get(one.id) ?? ''),
      mayAnswerCount: work.othersLeft,
      repliers: withTagged(
        work.player.length > 0 ? repliersFor(charId, game.npcRelationships) : [],
        work.player,
        charId
      ),
      tagged: work.player.flatMap((one) =>
        (one.tags ?? []).flatMap((tagged) => {
          const girl = game.characters[tagged]
          return girl && tagged !== charId
            ? [{ ref: refOf.get(one.id) ?? '', name: girl.firstName }]
            : []
        })
      )
    })
  }
  if (threads.length === 0) return

  const request = buildFeedThreadsPrompt(
    {
      playthroughId: game.playthroughId ?? 'unsaved',
      stats: game.stats,
      lessNsfwText: lessNsfwTextNow(),
      date: game.date,
      threads
    },
    SETTING,
    reader()
  )

  const run = currentRun()
  out = true
  try {
    const reply = await send(request, run)
    if (runStale(run) || !reply) return
    fileReplies(reply, owed, byRef, now, showAt === 'next' ? now + 1 : now)
  } catch (err) {
    console.warn('[feed] no thread replies:', messageOf(err))
  } finally {
    out = false
    if (!runStale(run)) {
      if (askAgain) {
        askAgain = false
        void armFeedThreads('next')
      }
    }
  }
}

/**
 * Files what the call wrote: the poster answers only what her post owed and no more of other
 * people's than her cap allows; anybody else only answers the reader.
 */
function fileReplies(
  reply: FeedThreadsResponse,
  owed: readonly Owed[],
  byRef: ReadonlyMap<string, { owed: Owed; comment: PostComment }>,
  now: number,
  shownAt: number
): void {
  const game = useGameStore.getState()
  const filed = new Map<string, PostComment[]>()
  // Girls who know him, other than the poster, who answered him here; each keeps a memory too.
  const answeredHim = new Set<string>()
  const capLeft = new Map<string, number>(owed.map(({ post, work }) => [post.id, work.othersLeft]))
  const owedIds = new Set(
    owed.flatMap(({ work }) => [...work.player, ...work.others].map((one) => one.id))
  )

  for (const one of reply.replies ?? []) {
    const target = byRef.get(one.to?.trim() ?? '')
    const text = one.text?.trim()
    if (!target || !text) continue
    const { owed: entry, comment } = target
    const posterId = entry.charId
    const fromId = one.from?.trim() ? game.charKeyToId[one.from.trim()] : undefined
    if (one.from?.trim() && !fromId) console.warn(`[feed] thread reply from unknown key "${one.from}"`)

    if (fromId === posterId) {
      if (!owedIds.has(comment.id)) continue
      if (!comment.player) {
        const left = capLeft.get(entry.post.id) ?? 0
        if (left <= 0) continue
        capLeft.set(entry.post.id, left - 1)
      }
    } else if (!comment.player) {
      continue
    }

    const list = filed.get(entry.post.id) ?? []
    list.push(
      fromId
        ? {
            id: crypto.randomUUID(),
            charId: fromId,
            handle: game.charInfo[fromId]?.handle ?? strangerHandle(),
            emoji: '',
            text,
            replyTo: comment.id,
            at: shownAt
          }
        : {
            id: crypto.randomUUID(),
            handle: strangerHandle(),
            emoji: useGrabBagStore.getState().drawMany(FEED_EMOJI_BAG, FEED_EMOJI, 1)[0] ?? FEED_EMOJI[0],
            text,
            replyTo: comment.id,
            at: shownAt
          }
    )
    filed.set(entry.post.id, list)
    const known = fromId ? game.charInfo[fromId] : undefined
    if (fromId && fromId !== posterId && known && (known.nameKnown || known.memories.length > 0)) {
      answeredHim.add(fromId)
    }
  }

  for (const { charId, post } of owed) {
    const comments = filed.get(post.id)
    if (comments) addComments(charId, post.id, comments)
    patchPost(charId, post.id, (one) => ({ ...one, threadedThrough: now }))
  }

  const commentedOn = new Set([
    ...owed.filter(({ work }) => work.player.length > 0).map((o) => o.charId),
    ...answeredHim
  ])
  const remembered: string[] = []
  const held: HeldFeedMemory[] = []
  for (const memory of reply.memories ?? []) {
    const charId = game.charKeyToId[memory.char?.trim() ?? '']
    const type = MEMORY_TYPES.find((one) => one === memory.type)
    const desc = memory.desc?.trim()
    if (!charId || !commentedOn.has(charId) || !type || !desc) continue
    // One a call: a girl met under two posts keeps what the first of them left her.
    commentedOn.delete(charId)
    held.push({ charId, at: shownAt, type, desc })
    remembered.push(game.characters[charId]?.firstName ?? charId)
  }

  // Held with the answers: the slot they show in files them, so she remembers what is on the feed.
  if (owed[0]) holdFeedMemories(owed[0].charId, owed[0].post.id, held)
  if (shownAt <= now) fileDueFeedMemories(now)

  const replies = [...filed.values()].reduce((total, list) => total + list.length, 0)
  console.log(
    `[feed comments] answered ${owed.length} post(s): ${replies} repl${replies === 1 ? 'y' : 'ies'}, ` +
      (remembered.length > 0 ? `memory for ${remembered.join(', ')}` : 'no memory')
  )
}

/** A stranger's handle off the shared bag, so the four thousand do not repeat too soon. */
function strangerHandle(): string {
  const [one] = useGrabBagStore
    .getState()
    .drawMany(FEED_HANDLE_BAG, FEED_HANDLE_POOL, 1, (entry) => entry.key)
  return one?.handle ?? FEED_HANDLE_POOL[0].handle
}

/** Leaves a comment of the reader's under one of her posts; closing the phone asks for the answer. */
export function leavePlayerComment(
  charId: string,
  postId: string,
  text: string,
  replyTo?: string,
  tags: readonly string[] = []
): void {
  const trimmed = text.trim()
  if (!trimmed) return
  const game = useGameStore.getState()
  addComments(charId, postId, [
    {
      id: crypto.randomUUID(),
      player: true,
      handle: PLAYER_HANDLE,
      emoji: '',
      text: trimmed,
      ...(replyTo ? { replyTo } : {}),
      ...(tags.length > 0 ? { tags: [...tags] } : {}),
      at: globalSlotOf(game.date, game.time)
    }
  ])
  markCommented()
}

/** One of her posts, changed in place; inert for a post that is not there. */
function patchPost(charId: string, postId: string, next: (post: SocialPost) => SocialPost): void {
  useGameStore.setState((state) => {
    const info: CharInfo | undefined = state.charInfo[charId]
    if (!info?.feed?.some((post) => post.id === postId)) return {}
    const feed = info.feed.map((post) => (post.id === postId ? next(post) : post))
    return { charInfo: { ...state.charInfo, [charId]: { ...info, feed } } }
  })
}

/** Adds comments under one of her posts. */
function addComments(charId: string, postId: string, comments: readonly PostComment[]): void {
  patchPost(charId, postId, (post) => ({ ...post, comments: [...(post.comments ?? []), ...comments] }))
}
