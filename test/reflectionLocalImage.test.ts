import { SHIPPED_DEFAULT_TAGS } from '@shared/defaultTags'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import type { Character } from '@shared/types'
import type { ComfyTarget } from '../src/main/services/comfyService'

const mocks = vi.hoisted(() => ({ start: vi.fn(), run: vi.fn(), read: vi.fn(), rm: vi.fn(), fetch: vi.fn() }))
vi.mock('../src/main/services/comfyService', () => ({ start: mocks.start, runGenerationJob: mocks.run, resolveTarget: vi.fn() }))
vi.mock('../src/main/paths', () => ({ getTempPath: () => 'test-temp' }))
vi.mock('fs/promises', async original => ({ ...await original<typeof import('fs/promises')>(), readFile: mocks.read, rm: mocks.rm }))
import { generateLocalReflection } from '../src/main/services/reflectionLocalImage'

const character = { baseAppearance: ['brown_hair', 'blue_eyes'], negativeTags: [], lora: { name: 'portrait.safetensors', weight: 0.8 } } as unknown as Character
const reference = () => sharp({ create: { width: 24, height: 40, channels: 4, background: { r: 70, g: 90, b: 100, alpha: 0 } } }).png().toBuffer()
const target: ComfyTarget = { source: 'external', baseUrl: 'http://127.0.0.1:8189', picks: { checkpoint: 'my-model.safetensors' }, loraWeight: 0.7, tags: SHIPPED_DEFAULT_TAGS }

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('fetch', mocks.fetch)
  mocks.fetch.mockResolvedValue(Response.json({ name: 'accepted.png', subfolder: 'venus-university/unheard-soul' }))
  mocks.read.mockResolvedValue(Buffer.from('generated'))
})
afterEach(() => vi.unstubAllGlobals())

it.each(['managed', 'external'] as const)('uploads the reference and renders on the same %s target with its model picks', async source => {
  const settled = { ...target, source }, signal = new AbortController().signal
  expect(await generateLocalReflection(character, await reference(), signal, settled)).toEqual(Buffer.from('generated'))
  expect(mocks.start).toHaveBeenCalledWith(settled)
  const [url, init] = mocks.fetch.mock.calls[0]
  expect(url).toBe(`${target.baseUrl}/upload/image`)
  const upload = init.body.get('image') as Blob
  const png = Buffer.from(await upload.arrayBuffer())
  expect(await sharp(png).metadata()).toMatchObject({ format: 'png', width: 768, height: 1024, hasAlpha: false })
  const pixel = await sharp(png).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer()
  expect([...pixel]).toEqual([238, 238, 238])
  expect(mocks.run).toHaveBeenCalledWith(expect.objectContaining({
    sourceImageName: 'venus-university/unheard-soul/accepted.png', lora: { name: 'portrait.safetensors', weight: 0.8 }, format: 'raw'
  }), { signal, target: settled })
  expect(mocks.rm.mock.calls.map(call => call[0])).toEqual([mocks.run.mock.calls[0][0].destPath, `${mocks.run.mock.calls[0][0].destPath}.partial`])
})

it('does not submit a render when upload fails or returns an unusable path', async () => {
  const png = await reference(), signal = new AbortController().signal
  for (const response of [new Response('unavailable', { status: 503 }), Response.json(null), Response.json({ name: '../outside.png' })]) {
    mocks.fetch.mockResolvedValueOnce(response)
    await expect(generateLocalReflection(character, png, signal, target)).rejects.toMatchObject({ code: 'COMFY_UPLOAD_FAILED' })
  }
  expect(mocks.run).not.toHaveBeenCalled()
  expect(mocks.read).not.toHaveBeenCalled()
})

it('cancels an outstanding reference upload without submitting a render', async () => {
  const controller = new AbortController()
  mocks.fetch.mockImplementationOnce(async (_url, init) => {
    controller.abort()
    init.signal.throwIfAborted()
  })
  await expect(generateLocalReflection(character, await reference(), controller.signal, target)).rejects.toMatchObject({ name: 'AbortError' })
  expect(mocks.run).not.toHaveBeenCalled()
})

it('cleans failed output and refuses a late completed render after cancellation', async () => {
  const controller = new AbortController(), png = await reference()
  mocks.run.mockImplementationOnce(async () => { controller.abort() })
  await expect(generateLocalReflection(character, png, controller.signal, target)).rejects.toMatchObject({ name: 'AbortError' })
  expect(mocks.read).not.toHaveBeenCalled()
  expect(mocks.rm).toHaveBeenCalledTimes(2)
})
