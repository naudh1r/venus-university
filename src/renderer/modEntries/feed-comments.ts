import { FEED_COMMENTS } from '@shared/feedComments'
import { charKeyOf, type Character } from '@shared/types'
import { createElement, lazy, Suspense } from 'react'
import { registerHooks } from '../mods/hooks'
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
const LazyThread = lazy(() =>
  import('../components/FeedThread').then((module) => ({ default: module.FeedThread }))
)

/** The thread under a post, drawn once its code has loaded. */
function FeedThreadView(props: CommentViewProps): ReturnType<typeof createElement> {
  return createElement(Suspense, { fallback: null }, createElement(LazyThread, props))
}

/**
 * Feed Comments, plugged in. Photo Feature's replies are taken over through its comment hand-off;
 * everything else goes through the game's hooks.
 */

handOffComments({
  active: () => modIsOn(FEED_COMMENTS),
  lines: slotCommentLines,
  field: slotCommentsField,
  dress: (charId, written, photoTier) =>
    rollFeedComments(charId, writtenComments(written, charId), photoTier),
  View: FeedThreadView
})

/** The thread call, loaded the first time it is needed. */
function threads(): Promise<typeof import('../stores/feedThreads')> {
  return import('../stores/feedThreads')
}

// Closing the phone ends a visit: everything he commented during it goes out as one call.
useBunnyboardStore.subscribe((state, before) => {
  if (!before.open || state.open || !takeCommented()) return
  void threads().then((module) => module.armFeedThreads('next'))
})

/** What his comments on her posts left her with, for a prompt that has her in it. */
function feedMemoryLines(characters: readonly Character[]): string[] {
  const { charInfo } = useGameStore.getState()
  return characters.flatMap((character) => {
    const memory = charInfo[character.charId]?.feedMemory
    return memory
      ? [`On Bunnyboard, ${character.firstName} ${memory.type} that ${memory.desc}.`]
      : []
  })
}

registerHooks(FEED_COMMENTS, {
  prompts: {
    scene: { lines: ({ cast }) => feedMemoryLines(cast) },
    dm: { lines: ({ character }) => feedMemoryLines([character]) }
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

  gameEntered: () => {
    takeCommented()
    void threads().then((module) => module.resetFeedThreads())
  }
})
