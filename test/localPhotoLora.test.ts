import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Character } from '@shared/types'
import { character } from './fixtures'

let root = ''
const mocks = vi.hoisted(() => ({ render: vi.fn(), afterWrite: vi.fn() }))
vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => root, getPath: () => root }
}))
// A prompt-only copy without her LoRA makes using her stored record observable.
vi.mock('../src/main/bodySetting', () => ({
  withBodySetting: async (stored: Character) => ({ ...stored, lora: undefined })
}))
vi.mock('@vx/modkit/main', async original => {
  const actual = await original<typeof import('@vx/modkit/main')>()
  return {
    ...actual,
    renderComfyImage: mocks.render,
    writeAtomicBytes: async (...args: Parameters<typeof actual.writeAtomicBytes>) => {
      await actual.writeAtomicBytes(...args)
      mocks.afterWrite(args[0])
    }
  }
})
const { generateDuoPhoto, generatePhoto } = await import('../src/main/services/localPhotoService')
const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
const file = 'sarah_chat_001.png'
const folder = () => join(root, 'data', 'saves', '100', 'mod-data', 'photo-feature', 'char-1')
const graphOf = async (name: string) =>
  JSON.parse(await readFile(resolve('assets/workflows', name), 'utf8'))

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'venus-photo-lora-'))
  await mkdir(folder(), { recursive: true })
  mocks.render.mockReset().mockResolvedValue(PNG)
  mocks.afterWrite.mockReset()
})
afterEach(async () => {
  vi.restoreAllMocks()
  await rm(root, { recursive: true, force: true })
})

it.each([undefined, { name: 'her.safetensors', weight: 0.65 }])(
  'sends the solo graph and stored character LoRA %j to the kit', async lora => {
    const her = character({ lora })
    const prompts = { positive: 'On the grass', negative: 'bad hands' }
    await generatePhoto('100', her, 'everyday', 'sitting on the grass', file, {}, { seed: 42, prompts })
    const [owner, request, options] = mocks.render.mock.calls[0]
    expect(owner).toBe('photo-feature')
    expect(request.workflow).toEqual(await graphOf('characterPhoto.json'))
    expect(request.nodes.characterLora).toBe('100')
    expect(request.lora).toEqual(lora ?? null)
    expect(request.prompts).toEqual(prompts)
    expect(request.seed).toBe(42)
    expect(options.signal).toBeInstanceOf(AbortSignal)
    for (const id of Object.values(request.nodes) as string[]) {
      expect(request.workflow).toHaveProperty(id)
    }
    expect(new Uint8Array(await readFile(join(folder(), file)))).toEqual(PNG)
    expect(JSON.parse(await readFile(join(folder(), 'sarah_chat_001.json'), 'utf8'))).toMatchObject({
      seed: 42, ...prompts, ...(lora ? { lora } : {})
    })
  }
)

it('sends the duo scene and both girls to the kit without a character LoRA node', async () => {
  const lora = { name: 'her.safetensors', weight: 0.65 }
  const prompts = { positive: 'At the cafe', negative: 'bad hands', left: 'Sarah', right: 'Her friend' }
  await generateDuoPhoto('100', character({ lora }), character({ charId: 'friend-1', lora }),
    'everyday', 'sitting on the grass', file, {}, { seed: 43, prompts })
  const request = mocks.render.mock.calls[0][1]
  expect(request.workflow).toEqual(await graphOf('characterPhotoDuo.json'))
  expect(request).not.toHaveProperty('lora')
  expect(request.nodes).not.toHaveProperty('characterLora')
  expect(request.prompts).toEqual({ positive: prompts.positive, negative: prompts.negative })
  expect(request.texts).toEqual({ '50': prompts.left, '51': prompts.right })
  for (const id of [...Object.values(request.nodes), ...Object.keys(request.texts)] as string[]) {
    expect(request.workflow).toHaveProperty(id)
  }
  expect(JSON.parse(await readFile(join(folder(), 'sarah_chat_001.json'), 'utf8'))).toMatchObject({
    seed: 43, ...prompts
  })
})

it.each(['solo', 'duo'] as const)('writes nothing for a cancelled %s render returning late', async kind => {
  const controller = new AbortController()
  mocks.render.mockImplementationOnce(async () => {
    controller.abort()
    return PNG
  })
  const her = character()
  const result = kind === 'solo'
    ? generatePhoto('100', her, 'everyday', 'At the cafe', file, { signal: controller.signal })
    : generateDuoPhoto('100', her, character({ charId: 'friend-1' }), 'everyday',
      'At the cafe', file, { signal: controller.signal })
  await expect(result).rejects.toMatchObject({ code: 'CANCELLED' })
  expect(await readdir(folder())).toEqual([])
})

it.each(['png', 'json'])('cleans up cancellation during the %s write', async extension => {
  const controller = new AbortController()
  mocks.afterWrite.mockImplementation(path => {
    if (path.endsWith(`.${extension}`)) controller.abort()
  })
  await expect(generatePhoto('100', character(), 'everyday', 'At the cafe', file,
    { signal: controller.signal })).rejects.toMatchObject({ code: 'CANCELLED' })
  expect(await readdir(folder())).toEqual([])
})

it('retires an older WebP twin after the replacement PNG lands', async () => {
  await writeFile(join(folder(), 'sarah_chat_001.webp'), PNG)
  await generatePhoto('100', character(), 'everyday', 'At the cafe', file)
  expect((await readdir(folder())).sort()).toEqual(['sarah_chat_001.json', file])
})
