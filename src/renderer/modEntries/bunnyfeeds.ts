import { BUNNYFEEDS, carriedThread } from '@shared/bunnyfeeds'
import { globalSlotOf } from '@shared/jobs'
import { registerPostCarry } from '@shared/modCarry'
import { shownComments } from '@shared/postComments'
import { charKeyOf, type Character } from '@shared/types'
import { formatShortGameDate } from '../prompts/gameDate'
import { createElement, lazy, Suspense } from 'react'
import {
  ownsPostComments,
  postVisible,
  registerHooks,
  type OptionPreviewProps,
  type PostCommentsProps
} from '../mods/hooks'
import {
  crowdBlock,
  replierBlock,
  slotCommentLines,
  slotCommentsField
} from '../prompts/bunnyfeedsPrompt'
import {
  planSlotCrowds,
  repliersFor,
  rollFeedComments,
  writtenComments
} from '../stores/bunnyfeedsReplies'
import { useBunnyboardStore } from '../stores/bunnyboardStore'
import { fileDueFeedMemories } from '../stores/bunnyfeedsMemory'
import { takeCommented } from '../stores/bunnyfeedsVisit'
import { settleFeedReadMark, unreadFeedNotesOf } from '../stores/bunnyfeedsNotes'
import { useGameStore } from '../stores/gameStore'

// Loaded on first draw, so registering the mod pulls in no screen code.
const screens = (): Promise<typeof import('../components/BunnyfeedsThread')> =>
  import('../components/BunnyfeedsThread')
const LazyPreview = lazy(() => screens().then((module) => ({ default: module.FeedPreview })))
const LazyPill = lazy(() => screens().then((module) => ({ default: module.CommentPill })))
const notifications = (): Promise<typeof import('../components/BunnyfeedsNotifications')> =>
  import('../components/BunnyfeedsNotifications')
const LazyNotes = lazy(() =>
  notifications().then((module) => ({ default: module.FeedNotificationsPage }))
)
const LazyMarkAll = lazy(() =>
  notifications().then((module) => ({ default: module.MarkAllFeedNotes }))
)

/** Notifications, drawn once its code has loaded. */
function FeedNotificationsView(): ReturnType<typeof createElement> {
  return createElement(Suspense, { fallback: null }, createElement(LazyNotes))
}

const LazyFaces = lazy(() =>
  import('../components/BunnyfeedsFaces').then((module) => ({ default: module.FacesPreview }))
)

/** The faces option's preview on the Mods screen, drawn once its code has loaded. */
function FacesPreviewView(props: OptionPreviewProps): ReturnType<typeof createElement> {
  return createElement(Suspense, { fallback: null }, createElement(LazyFaces, props))
}

/** Mark all as read, over Notifications, drawn once its code has loaded. */
function MarkAllView(): ReturnType<typeof createElement> {
  return createElement(Suspense, { fallback: null }, createElement(LazyMarkAll))
}

/** The thread's preview under a post, drawn once its code has loaded. */
function FeedPreviewView(props: PostCommentsProps): ReturnType<typeof createElement> {
  return createElement(Suspense, { fallback: null }, createElement(LazyPreview, props))
}

/** The comment count beside the post's like, drawn once its code has loaded. */
function CommentPillView(props: PostCommentsProps): ReturnType<typeof createElement> {
  return createElement(Suspense, { fallback: null }, createElement(LazyPill, props))
}

/** How many of her newest posts a prompt with her in it is shown. */
const RECENT_POSTS = 2

/**
 * Her newest posts as the feed shows them, and under each what the reader said there and what
 * she answered: so a girl he talks to knows what she posted and what he wrote under it.
 */
function recentPostLines(characters: readonly Character[]): string[] {
  const { charInfo, date, time, calendar } = useGameStore.getState()
  return characters.flatMap((character) => {
    const posts = (charInfo[character.charId]?.feed ?? [])
      .filter(postVisible)
      .slice(-RECENT_POSTS)
    if (posts.length === 0) return []
    const name = character.firstName
    return [
      `${name}'s latest feed posts, which everyone can see:`,
      ...posts.flatMap((post) => {
        const said = shownComments(post.comments, date, time)
        const hers = said.filter(
          (one) =>
            one.charId === character.charId &&
            said.some((his) => his.player && his.id === one.replyTo)
        )
        // Only what she has answered where everyone can see: a comment still waiting on her
        // answer is one she has not read yet, in texts or in person either.
        const answered = new Set(hers.map((one) => one.replyTo))
        const his = said.filter((one) => one.player && answered.has(one.id))
        return [
          `- ${formatShortGameDate(post.date, calendar.season)}: "${post.text}"`,
          ...his.map((one) => `  The reader commented: "${one.text}"`),
          ...hers.map((one) => `  ${name} answered him: "${one.text}"`)
        ]
      })
    ]
  })
}

/** The thread call, loaded the first time it is needed. */
function threads(): Promise<typeof import('../stores/bunnyfeedsThreads')> {
  return import('../stores/bunnyfeedsThreads')
}

// Closing the phone ends a visit: everything he commented during it goes out as one call.
useBunnyboardStore.subscribe((state, before) => {
  if (!before.open || state.open || !takeCommented()) return
  void threads().then((module) => module.armFeedThreads('next'))
})

/** Whether Bunnyfeeds is the mod drawing post comments, and so the one asking for them. */
function writesComments(): boolean {
  return ownsPostComments(BUNNYFEEDS)
}

registerHooks(BUNNYFEEDS, {
  prompts: {
    scene: { lines: ({ cast }) => recentPostLines(cast) },
    dm: { lines: ({ character }) => recentPostLines([character]) },
    // The replies each post arrives with, asked for while Bunnyfeeds draws the comments.
    'slot-posts': {
      lines: () => (writesComments() ? slotCommentLines() : []),
      fields: (): Record<string, unknown> =>
        writesComments() ? { comments: slotCommentsField() } : {},
      required: () => (writesComments() ? ['comments'] : [])
    },
  },

  // The roster girls who may reply under each of the slot's posts, described in their own voices.
  requests: {
    'slot-intro': (request, { input }) => {
      const { npcRelationships } = useGameStore.getState()
      const repliers = replierBlock(
        input.posters.map(({ character }) => ({
          character,
          charKey: charKeyOf(character.firstName, character.lastName),
          repliers: repliersFor(character.charId, npcRelationships)
        }))
      )
      // How many reply under each post, rolled now so the call writes those and no more.
      const planned = writesComments()
        ? planSlotCrowds(input.posters.map(({ character }) => character.charId))
        : new Map<string, { words: number; picture: number }>()
      const crowd = crowdBlock(
        input.posters.flatMap(({ character }) => {
          const plan = planned.get(character.charId)
          return plan
            ? [
                {
                  name: character.firstName,
                  charKey: charKeyOf(character.firstName, character.lastName),
                  ...plan
                }
              ]
            : []
        })
      )
      const block = [...repliers, ...(repliers.length > 0 && crowd.length > 0 ? [''] : []), ...crowd]
      if (block.length === 0) return request
      const at = request.user.lastIndexOf('YOUR TURN')
      const text = [...block, ''].join('\n')
      const user =
        at >= 0
          ? `${request.user.slice(0, at)}${text}\n${request.user.slice(at)}`
          : `${request.user}\n\n${text}`
      return { ...request, user }
    }
  },

  // Held memories whose answers show next slot are filed now, so the boundary save carries them;
  // then whatever the phone-close call never answered is asked for.
  slotSettled: () => {
    const { date, time } = useGameStore.getState()
    fileDueFeedMemories(globalSlotOf(date, time) + 1)
    void threads().then((module) => module.armFeedThreads('next'))
  },

  // Files the replies too. A post another mod is putting a picture on (its "image") draws more.
  fileFeedPost: (filing) => {
    if (!writesComments()) return
    const reply = filing.reply as { comments?: unknown; image?: unknown }
    const picture = typeof reply.image === 'string' && reply.image.trim() !== ''
    const comments = rollFeedComments(
      filing.charId,
      writtenComments(reply.comments, filing.charId),
      picture
    )
    if (comments.length > 0) filing.post = { ...filing.post, comments }
  },

  // The threads under each post, and the comment count beside its like.
  postComments: {
    View: FeedPreviewView,
    Action: CommentPillView,
    // His own, a roster girl's, and every reply: comments only Bunnyfeeds writes.
    claims: (comment) => Boolean(comment.player || comment.charId || comment.replyTo)
  },

  // What each choice of followers' faces looks like, under the choice on the Mods screen.
  optionPreviews: { faces: FacesPreviewView },

  // Every reply to his comments, beside the feed in Updates, counting what he has not seen.
  updatesTab: {
    id: 'notifications',
    word: 'Notifications',
    Page: FeedNotificationsView,
    Action: MarkAllView,
    unread: unreadFeedNotesOf
  },

  gameEntered: () => {
    takeCommented()
    settleFeedReadMark()
    void threads().then((module) => module.resetFeedThreads())
  }
})

// New Game+ moves her posts onto the next semester's clock; a thread's last round and its held
// memories move with them, as the game moves the comments. Runs with the mod off too.
registerPostCarry(BUNNYFEEDS, carriedThread)
