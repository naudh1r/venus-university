import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { normalizeWhisper, VENUS_WHISPER_MOD } from '@shared/venusWhisper'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { VenusWhisperPage } from '../src/renderer/views/VenusWhisperModal'
import { profileUrl } from '../src/renderer/stores/characterStore'

// The portrait URL builder needs no running Electron generation-job subscription.
vi.mock('../src/renderer/stores/jobStore', () => ({ useJobStore: {} }))

beforeEach(() => {
  useGameStore.getState().reset()
  useModsStore.setState({ switches: { on: { [VENUS_WHISPER_MOD]: true }, options: {} } })
  useGameStore.setState({ playthroughId: 'picture-test', date: 2, playerFirstName: 'Avrix',
    exVenusWhisper: normalizeWhisper({ version: 1, issues: [{
      id: 'whisper:0:2', term: 0, day: 2, title: 'Studio news', body: 'Practice went well.',
      subjects: [], answered: [], read: true, comments: [
        { id: 'reader-comment', player: true, person: { id: 'reader', name: 'Avrix', handle: 'avrix' }, text: 'Looking forward to next week.', mentions: [] },
        { id: 'character-comment', player: false, person: { id: 'maestro', name: 'Maestro Leeds', handle: 'maestro' }, text: 'See you there.', mentions: [] }
      ]
    }], dismissed: [] })
  })
})
afterEach(() => {
  useGameStore.getState().reset()
  useModsStore.setState({ switches: { on: {}, options: {} } })
})

function avatarMarkup(): string[] {
  // Zustand's server renderer reads its boot snapshot; supply this test's live state
  // only for the synchronous render, then restore it before the next test.
  const game = useGameStore.getInitialState(), mods = useModsStore.getInitialState()
  const originalGame = { ...game }, originalMods = { ...mods }
  try {
    Object.assign(game, useGameStore.getState()); Object.assign(mods, useModsStore.getState())
    const html = renderToStaticMarkup(createElement(VenusWhisperPage))
    return [...html.matchAll(/<span class="vu-whisper-avatar"[^>]*><span>.*?<\/span>(.*?)<\/span>/g)].map(m => m[1])
  } finally { Object.assign(game, originalGame); Object.assign(mods, originalMods) }
}

it('uses the reader picture on reader comments while keeping character portraits separate', () => {
  useGameStore.getState().setProfilePicture('blob:reader-picture')
  const avatars = avatarMarkup()
  expect(avatars).toHaveLength(2)
  expect(avatars[0]).toContain('src="blob:reader-picture"')
  expect(avatars[1]).toContain(`src="${profileUrl('maestro')}"`)
  expect(avatars[1]).not.toContain('blob:reader-picture')
})

it('keeps the initial fallback when no reader picture is set', () => {
  expect(avatarMarkup()[0]).not.toContain('<img')
})

it('uses a replacement picture and drops it when the player removes it', () => {
  useGameStore.getState().setProfilePicture('blob:first-picture')
  expect(avatarMarkup()[0]).toContain('blob:first-picture')
  useGameStore.getState().setProfilePicture('blob:replacement-picture')
  expect(avatarMarkup()[0]).toContain('blob:replacement-picture')
  useGameStore.getState().setProfilePicture(null)
  expect(avatarMarkup()[0]).not.toContain('<img')
})
