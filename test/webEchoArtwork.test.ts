import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it, vi } from 'vitest'
import { normalizeEcho } from '@shared/echo'
import { NO_SWITCHES } from '@shared/mods'
const mocks = vi.hoisted(() => ({ switches: vi.fn(), cloud: vi.fn(), prepare: vi.fn(), normalize: vi.fn(), cutout: vi.fn(), pick: vi.fn(), download: vi.fn() }))
vi.mock('../src/web/mods', () => ({ readModSwitches: mocks.switches }))
vi.mock('@shared/llm/cloudImage', () => ({ generateImage: mocks.cloud }))
vi.mock('../src/renderer/art/echoCutoutClient', () => ({ preparePortableCutout: mocks.prepare, portableCutout: mocks.cutout, normalizePortableImage: mocks.normalize }))
vi.mock('../src/web/transfer', () => ({ pickFile: mocks.pick }))
vi.mock('../src/web/download', () => ({ offerDownload: mocks.download }))
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')
let echo: typeof import('../src/web/echoArtwork')
let database: typeof import('../src/web/db/open').database
const request = () => ({ requestId: crypto.randomUUID(), identity: normalizeEcho({ player: { name: 'Vaelum', aspect: 'veilkeeper', motif: 0 } }).player!, name: 'Fictional owner', bio: 'Thoughtful.' })
beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory(); vi.resetModules(); vi.resetAllMocks()
  mocks.switches.mockResolvedValue({ on: { echo: true, reckoning: true }, options: {} }); mocks.cloud.mockResolvedValue(png)
  mocks.normalize.mockResolvedValue(png); mocks.cutout.mockResolvedValue(png)
  echo = await import('../src/web/echoArtwork'); ({ database } = await import('../src/web/db/open'))
})
it('initializes segmentation before charging, then stores separate source and immutable artwork', async () => {
  const id = await echo.generateEchoArt(request())
  expect(mocks.prepare.mock.invocationCallOrder[0]).toBeLessThan(mocks.cloud.mock.invocationCallOrder[0])
  expect(await echo.readEchoArt(id)).toBe(`data:image/png;base64,${png.toString('base64')}`)
  const db = await database()
  expect(await db.count('echoArt')).toBe(1); expect(await db.count('echoSources')).toBe(1)
  await echo.exportEchoArt(id, '../Vaelum?')
  expect(mocks.download).toHaveBeenCalledWith('Vaelum.png', expect.any(Uint8Array), 'image/png')
})
it('does not charge if preparation fails or local-only generation is selected', async () => {
  mocks.prepare.mockRejectedValueOnce(Error('offline'))
  await expect(echo.generateEchoArt(request())).rejects.toThrow('offline')
  mocks.switches.mockResolvedValue({ on: { echo: true }, options: { 'echo:megaten-art': true } })
  await expect(echo.generateEchoArt(request())).rejects.toThrow('desktop')
  expect(mocks.cloud).not.toHaveBeenCalled()
})
it('preserves a paid source if cutout fails and does not replace existing artwork', async () => {
  const id = await echo.generateEchoArt(request())
  mocks.cutout.mockRejectedValue(Error('bad mask'))
  await expect(echo.generateEchoArt(request())).rejects.toThrow('no automatic paid retry')
  expect(await echo.readEchoArt(id)).not.toBeNull()
  const db = await database(); expect(await db.count('echoArt')).toBe(1); expect(await db.count('echoSources')).toBe(2)
  expect(mocks.cloud).toHaveBeenCalledTimes(2)
})
it('cancels before publishing an image and accepts a later request', async () => {
  const first = request()
  mocks.cutout.mockImplementationOnce(async (_png, signal) => { echo.cancelEchoArt(first.requestId); signal.throwIfAborted() })
  await expect(echo.generateEchoArt(first)).rejects.toMatchObject({ name: 'AbortError' })
  expect(await (await database()).count('echoArt')).toBe(0)
  await expect(echo.generateEchoArt(request())).resolves.toBeTypeOf('string')
})
it('uploads, cancels the picker, validates ids and never asks the provider', async () => {
  mocks.pick.mockResolvedValueOnce(null)
  expect(await echo.uploadEchoArt()).toBeNull()
  mocks.pick.mockResolvedValueOnce(new File([png], 'own.png', { type: 'image/png' }))
  expect(await echo.readEchoArt((await echo.uploadEchoArt())!)).not.toBeNull()
  await expect(echo.readEchoArt('../settings')).rejects.toThrow('Invalid')
  expect(mocks.cloud).not.toHaveBeenCalled(); expect(mocks.prepare).not.toHaveBeenCalled()
})

it('cancels during settings lookup, rejects overlapping jobs, and permits the next request', async () => {
  let finish!: (switches: typeof NO_SWITCHES) => void
  mocks.switches.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  const first = request(), pending = echo.generateEchoArt(first)
  await expect(echo.generateEchoArt(request())).rejects.toThrow('already being generated')
  echo.cancelEchoArt(first.requestId); finish({ on: { echo: true, reckoning: true }, options: {} })
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  expect(mocks.prepare).not.toHaveBeenCalled(); expect(mocks.cloud).not.toHaveBeenCalled()
  const db = await database()
  expect(await db.count('echoArt')).toBe(0); expect(await db.count('echoSources')).toBe(0)
  await expect(echo.generateEchoArt(request())).resolves.toBeTypeOf('string')
})

it('checks cancellation again after preparation before calling the paid provider', async () => {
  const first = request()
  mocks.prepare.mockImplementationOnce(() => { echo.cancelEchoArt(first.requestId) })
  await expect(echo.generateEchoArt(first)).rejects.toMatchObject({ name: 'AbortError' })
  expect(mocks.cloud).not.toHaveBeenCalled()
})
