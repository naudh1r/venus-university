import { FEED_COMMENTS } from '@shared/feedComments'
import { PHOTO_FEATURE } from '@shared/mods'
import { shownComments } from '@shared/postComments'
import { charKeyOf, type Character } from '@shared/types'
import { formatShortGameDate } from '../prompts/gameDate'
import { createElement, lazy, Suspense } from 'react'
import { postVisible, registerHooks } from '../mods/hooks'
import {
  replierBlock,
  slotCommentLines,
  slotCommentsField
} from '../prompts/feedCommentsPrompt'
import { handOffComments } from '../stores/commentHandoff'
import { repliersFor, rollFeedComments, writtenComments } from '../stores/feedComments'
import { useBunnyboardStore } from '../stores/bunnyboardStore'
import { takeCommented } from '../stores/feedVisit'
import { useGameStore } from '../stores/gameStore'
import { modIsOn } from '../stores/modsStore'
import type { CommentViewProps } from '../stores/commentHandoff'

// Loaded on first draw, so registering the mod pulls in no screen code.
const screens = (): Promise<typeof import('../components/FeedThread')> =>
  import('../components/FeedThread')
const LazyPreview = lazy(() => screens().then((module) => ({ default: module.FeedPreview })))
const LazyPill = lazy(() => screens().then((module) => ({ default: module.CommentPill })))

/** The thread's preview under a post, drawn once its code has loaded. */
function FeedPreviewView(props: CommentViewProps): ReturnType<typeof createElement> {
  return createElement(Suspense, { fallback: null }, createElement(LazyPreview, props))
}

/** The comment count beside the post's like, drawn once its code has loaded. */
function CommentPillView(props: CommentViewProps): ReturnType<typeof createElement> {
  return createElement(Suspense, { fallback: null }, createElement(LazyPill, props))
}

handOffComments({
  active: () => modIsOn(FEED_COMMENTS),
  lines: slotCommentLines,
  field: slotCommentsField,
  dress: (charId, written, photoTier) =>
    rollFeedComments(charId, writtenComments(written, charId), photoTier),
  View: FeedPreviewView,
  Action: CommentPillView,
  // His own, a roster girl's, and every reply: none of them a comment Photo Feature makes.
  claims: (comment) => Boolean(comment.player || comment.charId || comment.replyTo)
})

/** How many of her newest posts a prompt with her in it is shown. */
const RECENT_POSTS = 2

/**
 * Her newest posts as the feed shows them, and under each what the reader said there and what
 * she answered: so a girl he talks to knows what she posted and what he wrote under it.
 */
function recentPostLines(characters: readonly Character[]): string[] {
  const { charInfo, date, time } = useGameStore.getState()
  return characters.flatMap((character) => {
    const posts = (charInfo[character.charId]?.feed ?? [])
      .filter(postVisible)
      .slice(-RECENT_POSTS)
    if (posts.length === 0) return []
    const name = character.firstName
    return [
      `${name}'s latest Bunnyboard posts, which everyone can see:`,
      ...posts.flatMap((post) => {
        const said = shownComments(post.comments, date, time)
        const his = said.filter((one) => one.player)
        const hisIds = new Set(his.map((one) => one.id))
        const hers = said.filter(
          (one) => one.charId === character.charId && one.replyTo && hisIds.has(one.replyTo)
        )
        return [
          `- ${formatShortGameDate(post.date)}: "${post.text}"`,
          ...his.map((one) => `  The reader commented: "${one.text}"`),
          ...hers.map((one) => `  ${name} answered him: "${one.text}"`)
        ]
      })
    ]
  })
}

/** The thread call, loaded the first time it is needed. */
function threads(): Promise<typeof import('../stores/feedThreads')> {
  return import('../stores/feedThreads')
}

// Closing the phone ends a visit: everything he commented during it goes out as one call.
useBunnyboardStore.subscribe((state, before) => {
  if (!before.open || state.open || !takeCommented()) return
  void threads().then((module) => module.armFeedThreads('next'))
})

/** Photo Feature is acting, so it asks for and files the replies itself, through the hand-off. */
function photoFeatureActing(): boolean {
  return modIsOn(PHOTO_FEATURE)
}

registerHooks(FEED_COMMENTS, {
  prompts: {
    scene: { lines: ({ cast }) => recentPostLines(cast) },
    dm: { lines: ({ character }) => recentPostLines([character]) },
    // Alone, the mod asks for the replies itself; with Photo Feature on they come through it.
    'slot-posts': {
      lines: () => (photoFeatureActing() ? [] : slotCommentLines()),
      fields: (): Record<string, unknown> =>
        photoFeatureActing() ? {} : { comments: slotCommentsField() },
      required: () => (photoFeatureActing() ? [] : ['comments'])
    },
  },

  // The roster girls who may reply under each of the slot's posts, described in their own voices.
  requests: {
    'slot-intro': (request, { input }) => {
      const { npcRelationships } = useGameStore.getState()
      const block = replierBlock(
        input.posters.map(({ character }) => ({
          character,
          charKey: charKeyOf(character.firstName, character.lastName),
          repliers: repliersFor(character.charId, npcRelationships)
        }))
      )
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

  // Whatever the phone-close call never answered is asked for once the slot's books are settled.
  slotSettled: () => void threads().then((module) => module.armFeedThreads('next')),

  // Alone, it files the replies too; a post with no picture coming draws the plain post's crowd.
  fileFeedPost: (filing) => {
    if (photoFeatureActing()) return
    const reply = filing.reply as { comments?: unknown }
    const comments = rollFeedComments(
      filing.charId,
      writtenComments(reply.comments, filing.charId),
      'none'
    )
    if (comments.length > 0) filing.post = { ...filing.post, comments }
  },

  gameEntered: () => {
    takeCommented()
    void threads().then((module) => module.resetFeedThreads())
  }
})
