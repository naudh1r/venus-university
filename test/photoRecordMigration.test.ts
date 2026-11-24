import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import type { GameSave, SaveDraft } from '@shared/types'
import { character, charInfo, playthroughRecord, restoreApi, sceneLines, stubApi } from './fixtures'

stubApi({ jobs: { onProgress: () => () => {} } })
const kit = await import('@vx/modkit/renderer')
const { useGameStore } = await import('../src/renderer/stores/gameStore')
const { useModsStore } = await import('../src/renderer/stores/modsStore')
const { resetLoopState, loopState } = await import('../src/renderer/stores/loop/state')
const { writeAutosave, writesSettled } = await import('../src/renderer/stores/loop/saves')
const { messagePhoto, postPhoto } = await import('../src/renderer/stores/photoRecords')
const { savePhotoStateAwaitable, setMessagePhoto } = await import('../src/renderer/stores/localPhotoStore')
let root = ''
const girl = character({ charId: 'a' }), friend = character({ charId: 'b' })
const people = { a: girl, b: friend }
const record = playthroughRecord({ chars: ['a', 'b'] })
const message = () => kit.conversation('a')!.messages[0]
const posts = () => kit.feed('a')
const snapshot = () => ({ message: messagePhoto.read(message()), posts: posts().map(p => postPhoto.read(p)) })
const photo = { tier: 'everyday', scene: 'At the cafe', file: 'sarah_chat_001.png' }
const held = { ...photo, file: 'sarah_bunnyboard_001.png', held: true as const }
const duo = { ...photo, file: 'sarah_bunnyboard_002.png', with: 'b', outAt: 123 }
const other = { other: { v: '1.0.0', data: { kept: true } } }

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'photo-roundtrip-'))
  await mkdir(root, { recursive: true })
  resetLoopState(); useGameStore.getState().reset()
  useModsStore.setState({ switches: { on: { 'photo-feature': true }, options: {} } })
  useGameStore.setState(s => ({ playthroughId: '1', chars: ['a', 'b'], characters: people,
    charInfo: { a: charInfo({ feed: [held, duo].map((photo, i) => ({ id: `p${i}`, text: 'At the cafe',
      date: 0, time: 0, likes: 1, photo, ex: other })) }), b: charInfo() },
    bunnyboard: { ...s.bunnyboard, conversations: { a: { charId: 'a', summary: null, unread: 0,
      messages: [{ id: 'm', sender: 'contact', text: 'Look', date: 0, time: 0, photo, ex: other }] } } }
  }))
  stubApi({ jobs: { onProgress: () => () => {} }, saves: { autosave: async (_id, draft) => {
    const saved = { ...draft, playthroughId: '1', saveId: 'auto', saveDate: 0 } as GameSave
    await writeFile(join(root, 'autosave.json'), JSON.stringify(saved))
    return { ok: true, data: saved }
  } } })
})
afterEach(async () => { await writesSettled(); restoreApi(); await rm(root, { recursive: true, force: true }) })

it('loads legacy texts, held posts and duo photos, plays a round, saves and reloads identically', async () => {
  // Load through the game's real hydration path, from the old on-disk shape.
  const legacy = { ...useGameStore.getState().toGameSave(), playthroughId: '1', saveId: 'old', saveDate: 0 } as GameSave
  await writeFile(join(root, 'old.json'), JSON.stringify(legacy))
  useGameStore.getState().loadSave(JSON.parse(await readFile(join(root, 'old.json'), 'utf8')), record, people)
  const before = snapshot()
  const run = kit.currentRun()
  expect(messagePhoto.update({ kind: 'message', charId: 'a', messageId: 'm' }, p => p, { run }).ok).toBe(true)
  for (const post of posts()) expect(postPhoto.update({ kind: 'post', charId: 'a', postId: post.id }, p => p, { run }).ok).toBe(true)
  // A completed conversation round leaves the existing attachments intact.
  useGameStore.setState(s => ({ bunnyboard: { ...s.bunnyboard, conversations: { ...s.bunnyboard.conversations,
    a: { ...s.bunnyboard.conversations.a, messages: [...s.bunnyboard.conversations.a.messages,
      { id: 'reply', sender: 'contact', text: 'It was a good afternoon.', date: 0, time: 0 }] } } } }))
  await savePhotoStateAwaitable(run)
  const saved = JSON.parse(await readFile(join(root, 'autosave.json'), 'utf8')) as GameSave
  expect(saved.bunnyboard.conversations.a.messages[0]).not.toHaveProperty('photo')
  expect(saved.charInfo.a.feed![0]).not.toHaveProperty('photo')
  expect(saved.charInfo.a.feed![0].ex?.other).toEqual(other.other)
  useGameStore.getState().loadSave(saved, record, people)
  expect(snapshot()).toEqual(before)
  expect(kit.conversation('a')!.messages.at(-1)?.text).toBe('It was a good afternoon.')
})

it('refuses vanished and stale attachment writes without changing the game or throwing', () => {
  const before = useGameStore.getState().toGameSave()
  expect(setMessagePhoto('a', 'gone', photo)).toMatchObject({ ok: false, error: { code: 'MOD_WRITE_GONE' } })
  const run = kit.currentRun(); resetLoopState()
  expect(setMessagePhoto('a', 'm', photo, { run })).toMatchObject({ ok: false, error: { code: 'MOD_WRITE_STALE' } })
  expect(useGameStore.getState().toGameSave()).toEqual(before)
})

it('persists an arrival outside scenes and defers mid-line until the next loop save', async () => {
  setMessagePhoto('a', 'm', { ...photo, pending: true })
  expect(await kit.saveChanges('photo-feature', { run: kit.currentRun() })).toEqual({ ok: true, data: 'written' })
  const lines = sceneLines('She smiles at the picture.')
  useGameStore.setState({ currentSceneTranscript: lines, sceneLog: lines, awaitingInput: true })
  loopState.decisionSave = useGameStore.getState().captureScene()
  useGameStore.setState({ awaitingInput: false })
  setMessagePhoto('a', 'm', photo)
  expect(await kit.saveChanges('photo-feature', { run: kit.currentRun() })).toEqual({ ok: true, data: 'deferred' })
  const pending = JSON.parse(await readFile(join(root, 'autosave.json'), 'utf8')) as SaveDraft
  expect(messagePhoto.read(pending.bunnyboard.conversations.a.messages[0])?.pending).toBe(true)
  await writeAutosave(loopState.decisionSave)
  const saved = JSON.parse(await readFile(join(root, 'autosave.json'), 'utf8')) as GameSave
  useGameStore.getState().loadSave(saved, record, people)
  expect(messagePhoto.read(message())).toEqual(photo)
})
