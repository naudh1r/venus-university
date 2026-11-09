import { access, mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

let root = ''
const mocks = vi.hoisted(() => ({ read: vi.fn(), changed: vi.fn(), close: vi.fn() }))
vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => root, getPath: () => root }
}))
vi.mock('fs/promises', async original => {
  const actual = await original<typeof import('fs/promises')>()
  return { ...actual, readFile: mocks.read.mockImplementation(actual.readFile) }
})
vi.mock('fs', async original => ({
  ...await original<typeof import('fs')>(),
  watch: (_path: string, _options: unknown, changed: (event: string, file: string | null) => void) => {
    mocks.changed.mockImplementation(changed)
    return { on: () => {}, close: mocks.close }
  }
}))
const { retirePhoto, flushRetiredPhotos, dropPhoto } = await import(
  '../src/main/services/localPhotoService'
)
let runId = 1000
const oldFile = 'lia_chat_001.png'
const newFile = 'lia_chat_002.png'
const folder = () => join(root, 'data', 'saves', String(runId))
const image = (file: string) => join(folder(), 'photos', 'lia', file)
const exists = (file: string) => access(image(file)).then(() => true, () => false)
const save = (files: string[]) => writeFile(join(folder(), 'autosave.json'),
  JSON.stringify({ photos: files.map(file => ({ file })) }))
const flush = () => flushRetiredPhotos(String(runId))
const retire = (old = oldFile, next = newFile) => retirePhoto(String(runId), 'lia', old, next)

beforeEach(async () => {
  runId += 1
  root = await mkdtemp(join(tmpdir(), 'photo-retirement-'))
  await mkdir(join(folder(), 'photos', 'lia'), { recursive: true })
  await mkdir(join(folder(), 'replays'))
  await writeFile(image(oldFile), 'old')
  await writeFile(image(newFile), 'new')
  await save([oldFile])
  await writeFile(join(folder(), 'replays', 'day.json'), '{}')
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises')
  mocks.read.mockReset().mockImplementation(actual.readFile)
  mocks.close.mockClear()
  vi.useFakeTimers()
})
afterEach(async () => {
  vi.clearAllTimers()
  vi.useRealTimers()
  await rm(root, { recursive: true, force: true })
})

it('does not scan saves when a photo, WebP, sidecar or temporary write changes', async () => {
  await retire()
  mocks.read.mockClear()
  for (const file of [
    'photos/lia/lia_chat_001.png', 'photos/lia/lia_chat_002.webp',
    'photos/lia/lia_chat_002.json', 'autosave.json.tmp', 'unrelated/nested.json'
  ]) mocks.changed('rename', file)
  await vi.advanceTimersByTimeAsync(200)
  expect(mocks.read).not.toHaveBeenCalled()
  expect(await exists(oldFile)).toBe(true)
})

it.each(['autosave.json', 'replays/day.json', 'replays\\day.json', 'replays', null])(
  'retries retirement after a checkpoint event: %s', async file => {
    await retire()
    mocks.read.mockClear()
    await save([newFile])
    mocks.changed('rename', file)
    await vi.advanceTimersByTimeAsync(101)
    await flush()
    expect(await exists(oldFile)).toBe(false)
    expect(await exists(newFile)).toBe(true)
    expect(mocks.close).toHaveBeenCalledOnce()
  }
)

it('reads each save and replay once for a batch of retired pictures', async () => {
  const secondOld = 'lia_bunnyboard_001.png', secondNew = 'lia_bunnyboard_002.png'
  await writeFile(image(secondOld), 'old feed picture')
  await writeFile(image(secondNew), 'new feed picture')
  await save([oldFile, secondOld])
  await retire()
  await retire(secondOld, secondNew)
  await save([newFile, secondNew])
  mocks.read.mockClear()
  await flush()
  expect(mocks.read.mock.calls.map(call => call[0]).sort()).toEqual([
    join(folder(), 'autosave.json'), join(folder(), 'replays', 'day.json')
  ].sort())
  expect(await exists(oldFile)).toBe(false)
  expect(await exists(secondOld)).toBe(false)
  expect(await exists(newFile)).toBe(true)
  expect(await exists(secondNew)).toBe(true)
})

it('retains the original when a checkpoint changes during a reference scan', async () => {
  await retire()
  await save([newFile])
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises')
  mocks.read.mockImplementationOnce(async (...args: Parameters<typeof actual.readFile>) => {
    const contents = await actual.readFile(...args)
    await save([oldFile])
    mocks.changed('rename', 'autosave.json')
    return contents
  })
  await flush()
  expect(await exists(oldFile)).toBe(true)
  await vi.advanceTimersByTimeAsync(101)
  await flush()
  expect(await exists(oldFile)).toBe(true)
  expect(await exists(newFile)).toBe(true)
})

it('keeps the reference check for a direct drop outside a retirement batch', async () => {
  await dropPhoto(String(runId), 'lia', oldFile)
  expect(await exists(oldFile)).toBe(true)
  expect(mocks.read).toHaveBeenCalled()
})

it('retries a retained picture when a manual checkpoint is deleted', async () => {
  await writeFile(join(folder(), 'manual_1.json'), JSON.stringify({ photo: { file: oldFile } }))
  await save([newFile])
  await retire()
  expect(await exists(oldFile)).toBe(true)
  await rm(join(folder(), 'manual_1.json'))
  mocks.changed('rename', 'manual_1.json')
  await vi.advanceTimersByTimeAsync(101)
  await flush()
  expect(await exists(oldFile)).toBe(false)
  expect(await exists(newFile)).toBe(true)
})
