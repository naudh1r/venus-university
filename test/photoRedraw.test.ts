import { savedPhoto } from '../src/shared/photoTypes'
import { photoCalls } from './fixtures/photoCalls'
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { character, charactersById, charInfo, restoreApi, stubApi } from './fixtures'

let root = ''
const mocks = vi.hoisted(() => ({ save: vi.fn(), render: vi.fn() }))
vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => root, getPath: () => root }
}))
vi.mock('../src/renderer/stores/loop/saves', () => ({ writeAutosave: mocks.save, saveChanges: async () => {
  const { useGameStore } = await import('../src/renderer/stores/gameStore')
  const game = useGameStore.getState()
  if (game.currentSceneTranscript.length && !game.awaitingInput) return { ok: true, data: 'deferred' }
  await mocks.save(); return { ok: true, data: 'written' } } }))
vi.mock('../src/renderer/stores/photoWebp', () => ({ renderPhoto: mocks.render }))
vi.mock('../src/renderer/stores/photoTipDelivery', () => ({ tellAboutDmPhotos: vi.fn() }))
stubApi({ jobs: { onProgress: () => () => {} } })
const { useGameStore } = await import('../src/renderer/stores/gameStore')
const { useSettingsStore } = await import('../src/renderer/stores/settingsStore')
const { useSetupStore } = await import('../src/renderer/stores/setupStore')
const { setModSwitches } = await import('../src/main/services/modsService')
const { setRendererPhotoSwitches } = await import('./fixtures/photoSwitchState')
const { redrawMessagePhoto } = await import('../src/renderer/stores/photoTurn')
const { redrawPostPhoto } = await import('../src/renderer/stores/photoPost')
const { dropPhoto, retirePhoto, flushRetiredPhotos } = await import(
  '../src/main/services/localPhotoService'
)
const girl = character({ charId: 'a' })
const run = (): string => join(root, 'data', 'saves', '1')
const image = (file: string): string => join(run(), 'mod-data', 'photo-feature', 'a', file)
const exists = (path: string): Promise<boolean> => access(path).then(() => true, () => false)
let currentFile: () => string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'photo-redraw-'))
  await mkdir(join(run(), 'mod-data', 'photo-feature', 'a'), { recursive: true })
  useGameStore.getState().reset()
  const { useModsStore } = await import('../src/renderer/stores/modsStore')
  useModsStore.setState({ switches: { on: { 'photo-feature': true }, options: {} } })
  setRendererPhotoSwitches({ on: true, photos: true, explicit: true, webp: false })
  // This integration test runs both processes' services in one VM; seed main's real known switches too.
  await setModSwitches(useModsStore.getState().switches)
  useSettingsStore.setState({ settings: { comfyDeferred: false } as never })
  useSetupStore.setState({ status: { comfyReady: true } as never })
  useGameStore.setState({ playthroughId: '1', chars: ['a'], characters: charactersById(girl) })
  mocks.save.mockReset().mockImplementation(async () => {
    await writeFile(join(run(), 'autosave.json'), JSON.stringify({ photo: { file: currentFile() } }))
  })
  mocks.render.mockReset().mockImplementation(async (...args: unknown[]) => {
    const file = args[4] as string
    await writeFile(image(file), 'new picture')
    return { ok: true, data: file }
  })
})
afterEach(async () => {
  restoreApi()
  await rm(root, { recursive: true, force: true })
})

for (const kind of ['chat', 'bunnyboard'] as const) {
  describe(`${kind} redraw persistence`, () => {
    const oldFile = `sarah_${kind}_001.png`
    const newFile = `sarah_${kind}_002.png`
    let redraw: () => Promise<void>
    beforeEach(async () => {
      const photo = { file: oldFile, tier: 'everyday', scene: 'At the cafe' }
      useGameStore.setState(s => ({
        charInfo: { a: { ...charInfo(), feed: [{ id: 'post', photo }] } } as never,
        bunnyboard: { ...s.bunnyboard, conversations: { a: {
          charId: 'a', unread: 0, summary: null,
          messages: [{ id: 'reply', sender: 'contact', text: 'Here!', date: 0, time: 0, photo }]
        } } }
      }))
      currentFile = () => kind === 'chat'
        ? savedPhoto(useGameStore.getState().bunnyboard.conversations.a.messages[0] ?? {})!.file!
        : savedPhoto(useGameStore.getState().charInfo.a.feed![0] ?? {})!.file!
      redraw = () => kind === 'chat'
        ? redrawMessagePhoto('a', 'reply', {})
        : redrawPostPhoto('a', 'post', {})
      await writeFile(image(oldFile), 'old picture')
      await mocks.save()
      mocks.save.mockClear()
      stubApi({ jobs: { onProgress: () => () => {} }, ...photoCalls({
        reserveName: async () => ({ ok: true, data: newFile }),
        drop: async (id, charId, file, options) => {
          if (options?.replacement) await retirePhoto(id, charId, file, options.replacement)
          else await dropPhoto(id, charId, file)
          return { ok: true, data: undefined }
        }
      }) })
    })

    it('keeps the old picture through a scene and removes it after the next written save', async () => {
      useGameStore.setState({ currentSceneTranscript: [{ speaker: 'a', text: 'A scene' }] as never,
        awaitingInput: false })
      await redraw()
      expect(mocks.save).not.toHaveBeenCalled()
      expect(JSON.parse(await readFile(join(run(), 'autosave.json'), 'utf8')).photo.file).toBe(oldFile)
      expect(await exists(image(oldFile))).toBe(true)
      expect(await exists(image(newFile))).toBe(true)
      await mocks.save()
      // The filesystem notification, rather than another Photo action, triggers deferred cleanup.
      await vi.waitFor(async () => expect(await exists(image(oldFile))).toBe(false))
      expect(JSON.parse(await readFile(join(run(), 'autosave.json'), 'utf8')).photo.file).toBe(newFile)
      expect(await exists(image(newFile))).toBe(true)
    })

    it.each(['slot', 'replay', 'unreadable'] as const)('retains files protected by a %s', async type => {
      const checkpoint = type === 'replay' ? join(run(), 'replays', '0_0.json') : join(run(), '0_0.json')
      if (type === 'replay') await mkdir(join(run(), 'replays'))
      await writeFile(checkpoint, type === 'unreadable' ? '{' : JSON.stringify({ photo: { file: oldFile } }))
      await redraw()
      await flushRetiredPhotos('1')
      expect(await exists(image(oldFile))).toBe(true)
      expect(await exists(image(newFile))).toBe(true)
    })

    it('awaits an autosave before deleting the old picture outside a scene', async () => {
      let release!: () => void
      const write = mocks.save.getMockImplementation()!
      mocks.save.mockImplementationOnce(async () => {
        expect(await exists(image(oldFile))).toBe(true)
        await new Promise<void>(resolve => { release = resolve })
        await write()
      })
      const drawing = redraw()
      await vi.waitFor(() => expect(release).toBeTypeOf('function'))
      expect(await exists(image(oldFile))).toBe(true)
      release()
      await drawing
      expect(JSON.parse(await readFile(join(run(), 'autosave.json'), 'utf8')).photo.file).toBe(newFile)
      expect(await exists(image(oldFile))).toBe(false)
    })
  })
}
