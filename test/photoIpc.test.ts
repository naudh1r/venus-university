import { access, mkdir, mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type { InvokeContext } from '@vx/modkit/main'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { character } from './fixtures'

let root = ''
const mocks = vi.hoisted(() => ({ render: vi.fn(), send: vi.fn() }))
vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => root, getPath: () => root },
  BrowserWindow: { getAllWindows: () => [{ isDestroyed: () => false, webContents: { send: mocks.send } }] }
}))
vi.mock('@vx/modkit/main', async original => ({
  ...await original<typeof import('@vx/modkit/main')>(), renderComfyImage: mocks.render
}))
const { photoInvocations } = await import('../src/main/photoIpc')
const girl = character({ charId: 'photo-cancel-test' })
const file = 'sarah_chat_001.png'
const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
const handlers = photoInvocations()
const event: InvokeContext = { id: 'photo-feature', signal: new AbortController().signal }
const generate = (id = '1', seed = 1) => handlers.generate(
  event, id, girl, 'everyday', 'At the cafe', file, { seed }
) as Promise<string>
const drop = (options?: { cancelOnly?: boolean; replacement?: string }) =>
  handlers.drop(event, '1', girl.charId, file, options) as Promise<void>
const exists = (id = '1') => access(join(root, 'data', 'saves', id,
  'mod-data', 'photo-feature', girl.charId, file)).then(() => true, () => false)
let finish: ((bytes: Uint8Array) => void) | undefined
let signal: AbortSignal | undefined

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'photo-ipc-'))
  for (const pid of ['1', '2']) await mkdir(join(root, 'data', 'saves', pid), { recursive: true })
  finish = undefined
  signal = undefined
  mocks.send.mockReset()
  mocks.render.mockReset().mockImplementationOnce(async (_owner, _request, options) => {
    signal = options.signal
    return new Promise<Uint8Array>(resolve => { finish = resolve })
  }).mockResolvedValue(PNG)
})
afterEach(async () => { await rm(root, { recursive: true, force: true }) })

it.each([
  { cancelOnly: true },
  { replacement: 'sarah_chat_002.png' },
  undefined
])('cancels and writes no file through the drop path %j', async options => {
  const pending = generate()
  const failed = expect(pending).rejects.toMatchObject({ code: 'CANCELLED' })
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
  const cancelling = drop(options)
  expect(signal!.aborted).toBe(true)
  finish!(PNG)
  await cancelling
  await failed
  expect(await exists()).toBe(false)
})

it('replaces a duplicate request only after the cancelled writer settles', async () => {
  const first = generate()
  const failed = expect(first).rejects.toMatchObject({ code: 'CANCELLED' })
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
  const second = generate('1', 2)
  expect(signal!.aborted).toBe(true)
  expect(mocks.render).toHaveBeenCalledOnce()
  finish!(PNG)
  await failed
  await expect(second).resolves.toBe(file)
  expect(await exists()).toBe(true)
})

it('does not cancel the same photo name in a different playthrough', async () => {
  const first = generate()
  const failed = expect(first).rejects.toMatchObject({ code: 'CANCELLED' })
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
  await expect(generate('2')).resolves.toBe(file)
  const cancelling = drop({ cancelOnly: true })
  finish!(PNG)
  await cancelling
  await failed
  expect(await exists()).toBe(false)
  expect(await exists('2')).toBe(true)
})

it('forwards early render progress from the hook to the requesting window', async () => {
  mocks.render.mockReset().mockImplementation(async (_owner, _request, options) => {
    options.onProgress('Rendering')
    return PNG
  })
  await generate()
  expect(mocks.send).toHaveBeenCalledWith('jobs:progress', expect.objectContaining({
    group: girl.charId, key: `photo:1:${file}`, status: 'running', step: 'Rendering'
  }))
  expect(mocks.send).toHaveBeenCalledWith('jobs:progress', expect.objectContaining({ status: 'done' }))
})

it('cancels a lead before it submits the graph to the kit', async () => {
  const pending = generate()
  const failed = expect(pending).rejects.toMatchObject({ code: 'CANCELLED' })
  await drop({ cancelOnly: true })
  await failed
  expect(mocks.render).not.toHaveBeenCalled()
  expect(await exists()).toBe(false)
})
