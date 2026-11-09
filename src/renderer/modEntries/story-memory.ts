// Carry registration follows catalogue loading and runs even while switched off.
import '../../shared/storyMemoryCarry'
import { acceptStoryFacts, recallPayload, STORY_MEMORY_LIGHT_OPTION } from '../../shared/storyMemory'
import { withNativeStoryRecall, withStoryExtraction } from '../prompts/storyMemoryPrompt'
import { currentStorySnapshot } from '../stores/storyMemory'
import { useGameStore } from '../stores/gameStore'
import { modOptionOn, registerHooks } from '@vx/modkit/renderer'
import { createElement, lazy, Suspense } from 'react'
import type { GameModalProps, ScreenSlotProps } from '@vx/modkit/renderer'

const screens = () => import('../views/StoryMemoryEntry')
const Menu = lazy(() => screens().then(module => ({ default: module.StoryMemoryMenuEntry })))
const Panel = lazy(() => screens().then(module => ({ default: module.StoryMemoryPanel })))

registerHooks('story-memory', {
  gameMenuEntry: (props: ScreenSlotProps['gameMenuEntry']) => createElement(Suspense, { fallback: null }, createElement(Menu, props)),
  gameModals: {
    'story-memory': (props: GameModalProps) => createElement(Suspense, { fallback: null }, createElement(Panel, props))
  },
  requests: {
    scene: (request, { cast, state, query }) => withNativeStoryRecall(
      request, state.storyMemory, cast.map(c => c.charId), query, state.calendar.season),
    dm: (request, { character, state, newMessage }) => withNativeStoryRecall(
      request, state.storyMemory ?? currentStorySnapshot(), [character.charId], newMessage, state.calendar.season),
    ledger: (request, { state, charKeys }) => withStoryExtraction(request, state.storyMemory, charKeys, {
      mode: modOptionOn('story-memory', STORY_MEMORY_LIGHT_OPTION) ? 'light' : 'standard',
      cast: charKeys.flatMap(key => {
        const id = useGameStore.getState().charKeyToId[key]
        return id ? [id] : []
      })
    }),
    'slot-intro': (request, { input }) => {
      const dm = [...new Set([...input.askers, ...input.breakups].map(person => person.character.charId))]
      const posts = [...new Set(input.posters.map(person => person.character.charId))]
      const payload = recallPayload(input.storyMemory, [...dm, ...posts], input.recent.join(' '))
      if (payload.storyMemory) payload.storyMemory.slotAuthors = { dm, posts }
      return { ...request, ...payload }
    }
  },
  slotSettled: ({ before, ledger, closingCast }) => {
    if (!before.playthroughId || before.createdScene || before.replaying) return
    const live = useGameStore.getState()
    useGameStore.setState({ exStoryMemory: acceptStoryFacts(live.exStoryMemory, ledger?.exStoryFacts, {
      date: before.date, time: before.time,
      cast: [...new Set([...before.cast, ...closingCast.map(c => c.charId)])],
      charKeyToId: before.charKeyToId,
      transcript: [...live.sceneLog, ...live.pendingLines, ...live.currentSceneTranscript]
    }) })
  }
})
