import { access, copyFile, mkdir, mkdtemp, readFile, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { character } from './fixtures'

let root = ''
const mocks = vi.hoisted(() => ({ path: vi.fn(), copy: vi.fn(), read: vi.fn(), remove: vi.fn(), route: vi.fn() }))
vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => root, getPath: () => root },
  protocol: { handle: (_scheme: string, handler: unknown) => mocks.route.mockImplementation(handler as never) },
  net: { fetch: async (url: string) => new Response(await readFile(fileURLToPath(url))) }
}))
vi.mock('fs/promises', async original => {
  const actual = await original<typeof import('fs/promises')>()
  return { ...actual, readFile: mocks.read.mockImplementation(actual.readFile), copyFile: mocks.copy.mockImplementation(actual.copyFile),
    rm: mocks.remove.mockImplementation(actual.rm) }
})
vi.mock('@vx/modkit/main', async original => {
  const actual = await original<typeof import('@vx/modkit/main')>()
  return { ...actual, modDataPath: mocks.path.mockImplementation(actual.modDataPath) }
})
const files = await import('../src/main/photoFiles')
const service = await import('../src/main/services/localPhotoService')
const { photoRoute } = await import('../src/main/photoProtocol')
const PNG = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(24)])
const info = { schemaVersion: 1, seed: 41, tier: 'everyday', positive: 'At the cafe', negative: 'bad hands' }
const image = 'lia_chat_001.png', sidecar = 'lia_chat_001.json'
const old = (file: string, pid = '100') => join(root, 'data', 'saves', pid, 'photos', 'lia', file)
const dest = (file: string, pid = '100') => files.getPhotoPath(pid, 'lia', file)
const exists = (path: string) => access(path).then(() => true, () => false)
async function put(path: string, bytes: Buffer | string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, bytes)
}

beforeEach(async () => {
  files.forgetPhotoMoves()
  root = await mkdtemp(join(tmpdir(), 'photo-move-'))
  for (const pid of ['100', '200']) await mkdir(join(root, 'data', 'saves', pid), { recursive: true })
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises')
  const kit = await vi.importActual<typeof import('@vx/modkit/main')>('@vx/modkit/main')
  mocks.path.mockReset().mockImplementation(kit.modDataPath)
  mocks.read.mockReset().mockImplementation(actual.readFile)
  mocks.copy.mockReset().mockImplementation(actual.copyFile)
  mocks.remove.mockReset().mockImplementation(actual.rm)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(async () => {
  vi.restoreAllMocks()
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises')
  await actual.rm(root, { recursive: true, force: true })
})

it('moves a referenced image and sidecar without changing its prompt, seed or save', async () => {
  const save = JSON.stringify({ message: { photo: { file: image } } })
  await put(join(root, 'data', 'saves', '100', 'autosave.json'), save)
  await put(old(image), PNG)
  await put(old(sidecar), JSON.stringify(info))
  await files.movePhotoFiles('100')
  expect(await readFile(dest(image))).toEqual(PNG)
  expect(await exists(old(image))).toBe(false)
  expect(await exists(dirname(old(image)))).toBe(false)
  expect(await readFile(join(root, 'data', 'saves', '100', 'autosave.json'), 'utf8')).toBe(save)
  expect(await service.photoInfo('100', character({ charId: 'lia' }), undefined,
    'everyday', 'At the cafe', image)).toMatchObject({ ...info, recorded: true })
})

it('serves the legacy photo while a move fails, then resumes without a done flag', async () => {
  await put(old(image), PNG)
  await put(old(sidecar), JSON.stringify(info))
  mocks.copy.mockRejectedValue(new Error('Copy interrupted'))
  const response = await photoRoute(new Request(`vxmod://photo-feature/@/photos/100/lia/${image}`)) as Response
  expect(response.status).toBe(200)
  expect(Buffer.from(await response.arrayBuffer())).toEqual(PNG)
  expect(await exists(old(image))).toBe(true)
  expect(await service.photoInfo('100', character({ charId: 'lia' }), undefined,
    'everyday', 'At the cafe', image)).toMatchObject({ recorded: true, seed: 41 })
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises')
  mocks.copy.mockImplementation(actual.copyFile)
  // A pass that moved nothing waits for the next session.
  files.forgetPhotoMoves()
  await files.movePhotoFiles('100')
  expect(await readFile(dest(image))).toEqual(PNG)
  expect(await exists(old(image))).toBe(false)
})

it('resumes after copying succeeded but retiring the old copy was interrupted', async () => {
  await put(old(image), PNG)
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises')
  mocks.remove.mockImplementationOnce(async () => { throw new Error('Interrupted before unlink') })
  await files.movePhotoFiles('100')
  expect(await readFile(dest(image))).toEqual(PNG)
  expect(await exists(old(image))).toBe(true)
  mocks.remove.mockImplementation(actual.rm)
  // A pass that moved nothing waits for the next session.
  files.forgetPhotoMoves()
  await files.movePhotoFiles('100')
  expect(await readFile(dest(image))).toEqual(PNG)
  expect(await exists(old(image))).toBe(false)
})

it('repairs a partial destination, but retains an original conflicting with a valid image', async () => {
  await put(old(image), PNG)
  await put(dest(image), 'partial')
  await files.movePhotoFiles('100')
  expect(await readFile(dest(image))).toEqual(PNG)
  const different = Buffer.concat([PNG, Buffer.from('different')])
  await put(old(image), different)
  await files.movePhotoFiles('100')
  expect(await readFile(old(image))).toEqual(different)
  expect(await readFile(dest(image))).toEqual(PNG)
})

it('retains legacy originals while a checkpoint is unreadable, then retries', async () => {
  await put(old(image), PNG)
  await put(join(root, 'data', 'saves', '100', 'autosave.json'), '{')
  await files.movePhotoFiles('100')
  expect(await readFile(dest(image))).toEqual(PNG)
  expect(await exists(old(image))).toBe(true)
  await put(join(root, 'data', 'saves', '100', 'autosave.json'), JSON.stringify({ photo: { file: image } }))
  // A pass that moved nothing waits for the next session.
  files.forgetPhotoMoves()
  await files.movePhotoFiles('100')
  expect(await exists(old(image))).toBe(false)
  expect(await service.photoLanded('100', 'lia', image)).toBe(true)
})

it('moves images without metadata while preserving malformed sidecars and native photos', async () => {
  await put(old(image), PNG)
  await put(old(sidecar), '{')
  const native = join(root, 'data', 'saves', '100', 'photos', '1790000000000.png')
  await put(native, PNG)
  await put(native.replace('.png', '.json'), '{"native":true}')
  const unrelated = join(dirname(native), 'native-cache')
  await mkdir(unrelated)
  await files.movePhotoFiles('100')
  expect(await readFile(dest(image))).toEqual(PNG)
  expect(await exists(old(image))).toBe(false)
  expect(await readFile(old(sidecar), 'utf8')).toBe('{')
  expect(await readFile(native)).toEqual(PNG)
  expect(await exists(unrelated)).toBe(true)
})

it('carries images and sidecars from both roots into the destination mod data', async () => {
  const second = 'lia_bunnyboard_002.png'
  await put(old(image), PNG)
  await put(old(sidecar), JSON.stringify(info))
  await put(dest(second), PNG)
  await put(dest('lia_bunnyboard_002.json'), JSON.stringify({ ...info, seed: 42 }))
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises')
  mocks.copy.mockImplementation(async (...args: Parameters<typeof copyFile>) => {
    if (String(args[1]).includes(join('100', 'mod-data'))) throw new Error('Legacy move interrupted')
    return actual.copyFile(...args)
  })
  await service.carryPhotos('100', '200')
  expect(await readFile(dest(image, '200'))).toEqual(PNG)
  expect(await readFile(dest(second, '200'))).toEqual(PNG)
  expect(JSON.parse(await readFile(dest(sidecar, '200'), 'utf8')).seed).toBe(41)
  expect(JSON.parse(await readFile(dest('lia_bunnyboard_002.json', '200'), 'utf8')).seed).toBe(42)
  expect(await exists(old(image))).toBe(true)
})

it('moves and reads a WebP twin of a legacy PNG-named saved photo', async () => {
  const logical = 'photo_123_abcd1234.png'
  const physical = logical.replace('.png', '.webp')
  const webp = Buffer.from([...Buffer.from('RIFF'), 4, 0, 0, 0, ...Buffer.from('WEBPVP8 ')])
  await put(old(physical), webp)
  expect(await service.readPhotoBytes('100', 'lia', logical)).toEqual(new Uint8Array(webp))
  expect(await exists(old(physical))).toBe(false)
  expect(await readFile(dest(physical))).toEqual(webp)
})

it('does not attach a carried prompt to a different image already kept by the destination', async () => {
  await put(dest(image), PNG)
  await put(dest(sidecar), JSON.stringify(info))
  const kept = Buffer.concat([PNG, Buffer.from('kept in the destination')])
  await put(dest(image, '200'), kept)
  await service.carryPhotos('100', '200')
  expect(await readFile(dest(image, '200'))).toEqual(kept)
  expect(await exists(dest(sidecar, '200'))).toBe(false)
})

it('retries the new path when a move removes the legacy path between lookup and reading', async () => {
  await put(old(image), PNG)
  mocks.copy.mockRejectedValue(new Error('Move initially interrupted'))
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises')
  mocks.read.mockImplementationOnce(async (path: string) => {
    expect(path).toBe(old(image))
    await actual.copyFile(old(image), dest(image))
    await actual.rm(old(image))
    throw Object.assign(new Error('A concurrent move retired the pathname'), { code: 'ENOENT' })
  })
  expect(await service.readPhotoBytes('100', 'lia', image)).toEqual(new Uint8Array(PNG))
  expect(await exists(old(image))).toBe(false)
  expect(await readFile(dest(image))).toEqual(PNG)
})

it('continues reading the legacy image when the new playthrough directory is unwritable', async () => {
  await put(old(image), PNG)
  const kit = await vi.importActual<typeof import('@vx/modkit/main')>('@vx/modkit/main')
  mocks.path.mockImplementation((id: string, pid?: string) => {
    if (pid === '100') throw Object.assign(new Error('Destination is read only'), { code: 'EACCES' })
    return kit.modDataPath(id, pid)
  })
  expect(await service.readPhotoBytes('100', 'lia', image)).toEqual(new Uint8Array(PNG))
  expect(await exists(old(image))).toBe(true)
})

it('keeps photo work inside the playthrough, creating no global mod-data folder', async () => {
  await put(old(image), PNG)
  await files.movePhotoFiles('100')
  expect(await files.findPhotoImage('100', 'lia', image)).toBe(dest(image))
  expect(await exists(join(root, 'data', 'mod-data', 'photo-feature'))).toBe(false)
})

it('reads no save again while the only things left in an old folder will not move', async () => {
  const leftover = join(root, 'data', 'saves', '100', 'photos', 'lia', 'lia_chat_009.png.tmp')
  await put(leftover, 'half written')
  await files.movePhotoFiles('100')
  mocks.read.mockClear()
  await files.findPhotoImage('100', 'lia', image)
  await files.findPhotoImage('100', 'lia', image)
  expect(mocks.read.mock.calls.filter(call => String(call[0]).endsWith('.json'))).toEqual([])
  expect(await exists(leftover)).toBe(true)
})
