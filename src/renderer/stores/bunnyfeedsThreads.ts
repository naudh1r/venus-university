import type { CharInfo } from '@shared/types'
import { messageOf } from '@shared/errors'
import {
  threadWork,
  type FeedThreadsResponse,
  type HeldFeedMemory,
  type ThreadWork
} from '@shared/bunnyfeeds'
import {
  ADDRESSED_FOLLOWER_CHANCE,
  ADDRESSED_GIRL_CHANCE,
  followerChance,
  followingOf
} from '@shared/bunnyfeedsCrowd'
import { globalSlotOf } from '@shared/jobs'
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
} from '../prompts/bunnyfeedsPrompt'
import {
  FEED_EMOJI,
  FEED_EMOJI_BAG,
  FEED_HANDLE_BAG,
  FEED_HANDLE_POOL
} from '../prompts/feedRandoms'
import { SETTING } from '../prompts/setting'
import { hasTexted } from '../prompts/textingPrompt'
import { markCommented } from './bunnyfeedsVisit'
import { joiningFriendOf, replierOf, type Replier } from './bunnyfeedsReplies'
import { fileDueFeedMemories, holdFeedMemories } from './bunnyfeedsMemory'
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

/** Who besides the poster the game let into one post's round, so the filing holds to it. */
interface Joiners {
  /** Roster girls: the friend the roll offered, girls he tagged, girls answering him back. */
  girls: Set<string>
  /** Whether one new follower may chime in. */
  follower: boolean
  /** Followers answering him back, by handle. */
  followersBack: Set<string>
  /** Girls he answered directly who let it go unanswered this round; each still remembers it. */
  silent: Set<string>
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

/** A post's repliers with each girl in `charIds` added, once each and never the poster. */
function withGirls(repliers: Replier[], charIds: readonly string[], posterId: string): Replier[] {
  const { npcRelationships } = useGameStore.getState()
  const listed = new Set(repliers.map(({ character }) => character.charId))
  const added: Replier[] = []
  for (const charId of charIds) {
    if (charId === posterId || listed.has(charId)) continue
    const replier = replierOf(charId, posterId, npcRelationships)
    if (!replier) continue
    listed.add(charId)
    added.push(replier)
  }
  return [...repliers, ...added]
}

/**
 * Whom each of the reader's comments answers directly, other than the poster: the author of the
 * comment it went under, and anybody whose handle he wrote in it. A roster girl by her id, a
 * follower by handle.
 */
function addressedBy(
  mine: PostComment,
  shown: readonly PostComment[],
  posterId: string
): Array<{ charId?: string; handle: string }> {
  const others = shown.filter((one) => !one.player && one.charId !== posterId)
  const under = others.find((one) => one.id === mine.replyTo)
  const named = others.filter((one) =>
    new RegExp(`(^|\\s)@${one.handle.replace(/\./g, '\\.')}(?![\\w.])`).test(mine.text)
  )
  const seen = new Set<string>()
  return [...(under ? [under] : []), ...named].flatMap((one) => {
    const key = one.charId ?? `@${one.handle}`
    if (seen.has(key)) return []
    seen.add(key)
    return [{ ...(one.charId ? { charId: one.charId } : {}), handle: one.handle }]
  })
}

/** Who said a comment, worded for the thread block. */
function whoSaid(comment: PostComment, posterId: string): string {
  const game = useGameStore.getState()
  if (comment.player) return 'the reader'
  const character = comment.charId ? game.characters[comment.charId] : undefined
  if (!character) return `@${comment.handle} (a follower)`
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
  // And the posts themselves, for a new comment left on one rather than under a comment.
  const postByRef = new Map<string, Owed>()
  const joiners = new Map<string, Joiners>()
  const threads: FeedThread[] = []
  for (const entry of owed) {
    const { charId, post, work } = entry
    const character = game.characters[charId]
    const info = game.charInfo[charId]
    if (!character || !info) continue
    const shown = (post.comments ?? []).filter((one) => one.at <= now)
    const postRef = `p${postByRef.size + 1}`
    postByRef.set(postRef, entry)
    for (const comment of shown) {
      const ref = `c${byRef.size + 1}`
      byRef.set(ref, { owed: entry, comment })
      refOf.set(comment.id, ref)
    }
    // Who joins this round besides her: rolled here, so the model is told who rather than handed
    // a crowd. A thread winding down hears only from the girls he tagged.
    const open = work.player.length > 0 && !work.windingDown
    const tagged = work.player.flatMap((one) => (one.tags ?? []).filter((id) => id !== charId))
    const friend = open ? joiningFriendOf(charId, game.npcRelationships) : null
    const answersBack: Array<{ ref: string; who: string }> = []
    const girlsBack: string[] = []
    const silent: Array<{ ref: string; charId: string }> = []
    const followersBack = new Set<string>()
    for (const mine of open ? work.player : []) {
      for (const target of addressedBy(mine, shown, charId)) {
        if (target.charId) {
          const girl = game.characters[target.charId]
          if (!girl || tagged.includes(target.charId) || girlsBack.includes(target.charId)) continue
          if (silent.some((one) => one.charId === target.charId)) continue
          if (Math.random() >= ADDRESSED_GIRL_CHANCE) {
            silent.push({ ref: refOf.get(mine.id) ?? '', charId: target.charId })
            continue
          }
          girlsBack.push(target.charId)
          answersBack.push({
            ref: refOf.get(mine.id) ?? '',
            who: `${girl.firstName} ("${charKeyOf(girl.firstName, girl.lastName)}")`
          })
        } else {
          if (followersBack.has(target.handle) || Math.random() >= ADDRESSED_FOLLOWER_CHANCE) continue
          followersBack.add(target.handle)
          answersBack.push({ ref: refOf.get(mine.id) ?? '', who: `@${target.handle}` })
        }
      }
    }
    const follower =
      open &&
      Math.random() < followerChance(followingOf(game.playthroughId, charId, character))
    const repliers = withGirls(friend ? [friend] : [], [...tagged, ...girlsBack], charId)
    joiners.set(post.id, {
      girls: new Set(repliers.map(({ character: girl }) => girl.charId)),
      follower,
      followersBack,
      silent: new Set(silent.map((one) => one.charId))
    })

    const lines: ThreadLine[] = shown.map((comment) => ({
      ref: refOf.get(comment.id) ?? '',
      who: whoSaid(comment, charId),
      text: comment.text,
      ...(comment.replyTo && refOf.has(comment.replyTo)
        ? { replyTo: refOf.get(comment.replyTo) }
        : {})
    }))
    threads.push({
      postRef,
      character,
      info,
      charKey: charKeyOf(character.firstName, character.lastName),
      texted: hasTexted(game.bunnyboard.conversations[charId]),
      post: {
        text: post.text,
        date: post.date,
        time: post.time,
        ...(pictureOf(post) ? { picture: pictureOf(post) } : {})
      },
      lines,
      mustAnswer: work.player.map((one) => refOf.get(one.id) ?? ''),
      mayAnswer: work.others.map((one) => refOf.get(one.id) ?? ''),
      mayAnswerCount: work.othersLeft,
      ...(work.windingDown ? { windingDown: true } : {}),
      repliers,
      follower,
      answersBack,
      silent: silent.flatMap(({ ref, charId: girlId }) => {
        const replier = replierOf(girlId, charId, game.npcRelationships)
        return replier ? [{ ref, replier }] : []
      }),
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
      season: game.calendar.season,
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
    fileReplies(reply, owed, byRef, postByRef, joiners, now, showAt === 'next' ? now + 1 : now)
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
 * people's than her cap allows; anybody else only where the round let them in (`joiners`), a
 * few at most, to anyone in the thread or to the post.
 */
function fileReplies(
  reply: FeedThreadsResponse,
  owed: readonly Owed[],
  byRef: ReadonlyMap<string, { owed: Owed; comment: PostComment }>,
  postByRef: ReadonlyMap<string, Owed>,
  joiners: ReadonlyMap<string, Joiners>,
  now: number,
  shownAt: number
): void {
  const game = useGameStore.getState()
  const filed = new Map<string, PostComment[]>()
  // Girls other than the poster who answered him here, met or not; each keeps a memory too.
  const answeredHim = new Set<string>()
  // Whose post each girl's memory happened under: the first post she was owed or answered on.
  const posterOf = new Map<string, string>()
  const capLeft = new Map<string, number>(owed.map(({ post, work }) => [post.id, work.othersLeft]))
  // Everybody but the poster says one thing a post a round, by girl or by follower's handle.
  const spoke = new Set<string>()
  // One new follower a post at most, where the round let one in.
  const followerLeft = new Map<string, boolean>(
    owed.map(({ post }) => [post.id, joiners.get(post.id)?.follower ?? false])
  )
  const owedIds = new Set(
    owed.flatMap(({ work }) => [...work.player, ...work.others].map((one) => one.id))
  )

  for (const one of reply.replies ?? []) {
    const to = one.to?.trim() ?? ''
    const target = byRef.get(to)
    const onPost = target ? undefined : postByRef.get(to)
    const text = one.text?.trim()
    if ((!target && !onPost) || !text) continue
    const entry = target?.owed ?? (onPost as Owed)
    const comment = target?.comment
    const posterId = entry.charId
    const from = one.from?.trim() ?? ''
    const fromId = from && !from.startsWith('@') ? game.charKeyToId[from] : undefined
    if (from && !from.startsWith('@') && !fromId) {
      console.warn(`[feed] thread reply from unknown key "${one.from}"`)
    }
    // A follower answering him back is named by her handle, and keeps the face she had.
    const back = from.startsWith('@')
      ? (entry.post.comments ?? []).find(
          (said) => !said.charId && !said.player && said.handle === from.slice(1)
        )
      : undefined
    const letIn = joiners.get(entry.post.id)

    if (fromId === posterId) {
      // She answers what is owed under her own post; she does not comment on it.
      if (!comment || !owedIds.has(comment.id)) continue
      if (!comment.player) {
        const left = capLeft.get(entry.post.id) ?? 0
        if (left <= 0) continue
        capLeft.set(entry.post.id, left - 1)
      }
    } else {
      // Nobody answers themselves, only who the round let in speaks, and each of them once.
      if (comment && fromId && comment.charId === fromId) continue
      const speaker = `${entry.post.id}:${fromId ?? back?.handle ?? ''}`
      if (fromId) {
        if (!letIn?.girls.has(fromId) || spoke.has(speaker)) continue
      } else if (from.startsWith('@')) {
        if (!back || !letIn?.followersBack.has(back.handle) || comment?.handle === back.handle) continue
        if (spoke.has(speaker)) continue
      } else {
        if (!followerLeft.get(entry.post.id)) continue
        followerLeft.set(entry.post.id, false)
      }
      if (fromId || back) spoke.add(speaker)
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
            ...(comment ? { replyTo: comment.id } : {}),
            at: shownAt
          }
        : {
            id: crypto.randomUUID(),
            handle: back?.handle ?? strangerHandle(),
            emoji:
              back?.emoji ??
              useGrabBagStore.getState().drawMany(FEED_EMOJI_BAG, FEED_EMOJI, 1)[0] ??
              FEED_EMOJI[0],
            text,
            ...(comment ? { replyTo: comment.id } : {}),
            at: shownAt
          }
    )
    filed.set(entry.post.id, list)
    const known = fromId ? game.charInfo[fromId] : undefined
    if (
      comment?.player &&
      fromId &&
      fromId !== posterId &&
      known
    ) {
      answeredHim.add(fromId)
      if (!posterOf.has(fromId)) posterOf.set(fromId, posterId)
    }
  }

  for (const { charId, post } of owed) {
    const comments = filed.get(post.id)
    if (comments) addComments(charId, post.id, comments)
    patchPost(charId, post.id, (one) => ({ ...one, threadedThrough: now }))
  }

  for (const { charId, work } of owed) {
    if (work.player.length > 0) posterOf.set(charId, charId)
  }
  // Girls he answered who stayed quiet saw it all the same, so they remember it too.
  const sawHim = owed.flatMap(({ charId: posterId, post }) =>
    [...(joiners.get(post.id)?.silent ?? [])].filter((girl) => {
      if (answeredHim.has(girl)) return false
      if (!posterOf.has(girl)) posterOf.set(girl, posterId)
      return true
    })
  )
  const commentedOn = new Set([
    ...owed.filter(({ work }) => work.player.length > 0).map((o) => o.charId),
    ...answeredHim,
    ...sawHim
  ])
  const remembered: string[] = []
  const held: HeldFeedMemory[] = []
  for (const memory of reply.memories ?? []) {
    const charId = game.charKeyToId[memory.char?.trim() ?? '']
    const type = MEMORY_TYPES.find((one) => one === memory.type)
    const desc = memory.desc?.trim().replace(SAID_WHERE, '')
    if (!charId || !commentedOn.has(charId) || !type || !desc) continue
    // One a call: a girl met under two posts keeps what the first of them left her.
    commentedOn.delete(charId)
    const posterId = posterOf.get(charId)
    held.push({ charId, at: shownAt, type, desc, ...(posterId ? { posterId } : {}) })
    remembered.push(game.characters[charId]?.firstName ?? charId)
  }

  // Held with the answers: the slot they show in files them, so she remembers what is on the feed.
  if (owed[0]) holdFeedMemories(owed[0].charId, owed[0].post.id, held)
  if (shownAt <= now) fileDueFeedMemories(now)

  const replies = [...filed.values()].reduce((total, list) => total + list.length, 0)
  console.log(
    `[bunnyfeeds] answered ${owed.length} post(s): ${replies} repl${replies === 1 ? 'y' : 'ies'}, ` +
      (remembered.length > 0 ? `memory for ${remembered.join(', ')}` : 'no memory')
  )
}

/**
 * Where it happened, said at the end of a memory although the call is told the game adds that
 * itself: "under her post", "on Ami's post", "in her comments". Taken off, so it is said once.
 */
const SAID_WHERE =
  /,?\s+(?:under|on|in|beneath)\s+(?:her|his|their|my|a|the|[\p{L}'’.-]+(?:'s|’s))\s+(?:own\s+)?(?:post|feed|comments?|comment section|thread)\s*\.?$/iu

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

/**
 * What the picture on a post shows, where another mod put one there and described it: read off
 * the post as plain data, so the thread can answer the picture without that mod being installed.
 */
function pictureOf(post: object): string | undefined {
  const photo = (post as { photo?: { scene?: unknown } }).photo
  return typeof photo?.scene === 'string' && photo.scene.trim() ? photo.scene : undefined
}
