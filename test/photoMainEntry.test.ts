import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { character } from './fixtures'
import { MODS } from '../src/shared/mods'
import { loadMods, type LoaderResult } from '../src/main/mods/loader'
import { ModInvocations } from '../src/main/mods/invoke'
import { handleModProtocol } from '../src/main/mods/protocol'

let root = ''
const mocks = vi.hoisted(() => ({ handle: vi.fn(),
  reservePhotoName: vi.fn(), carryPhotos: vi.fn(), photoLanded: vi.fn(), readPhotoBytes: vi.fn(),
  storeWebpPhoto: vi.fn(), photoInfo: vi.fn(), dropPhoto: vi.fn(), retirePhoto: vi.fn(),
  generatePhoto: vi.fn(), generateDuoPhoto: vi.fn(), validatePhotoOverrides: vi.fn() }))
vi.mock('electron', () => ({ protocol: { handle: mocks.handle }, net: { fetch: vi.fn() },
  app: { isPackaged: false, getAppPath: () => root, getPath: () => root },
  BrowserWindow: { getAllWindows: () => [] } }))
vi.mock('../src/main/services/localPhotoService', () => mocks)
const { BUILT_IN_MAIN_ENTRIES } = await import('../src/main/modEntries')
const { getPhotoPath } = await import('../src/main/photoFiles')
let result: LoaderResult
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'photo-main-entry-'))
  result = loadMods({ modsDir: join(root, 'mods'), devFolders: [], allowUnreviewedMain: false,
    builtIn: MODS.map(mod => mod.id), builtInMain: BUILT_IN_MAIN_ENTRIES,
    coreVersion: '0.7.0', gameVersion: '0.7.0', safeStart: null, log: () => {}, warn: () => {} })
  expect(result.table.mods.find(mod => mod.id === 'photo-feature')?.status).toBe('loaded')
})
afterEach(async () => { vi.clearAllMocks(); await rm(root, { recursive: true, force: true }) })

it('reaches every Photo handler through the real start/result dispatch with the original arguments', async () => {
  const girl = character({ charId: 'lia' }), friend = character({ charId: 'bea' })
  const bytes = new Uint8Array([1, 2, 3]), file = 'lia_chat_001.png'
  const cases = [
    ['reserve-name', mocks.reservePhotoName, ['100', girl, 'chat', []]],
    ['carry', mocks.carryPhotos, ['100', '200', ['lia']]],
    ['landed', mocks.photoLanded, ['100', 'lia', file]],
    ['read', mocks.readPhotoBytes, ['100', 'lia', file]],
    ['store-webp', mocks.storeWebpPhoto, ['100', 'lia', file, bytes]],
    ['info', mocks.photoInfo, ['100', girl, friend, 'everyday', 'At the cafe', file, true]],
    ['drop', mocks.dropPhoto, ['100', 'lia', file]],
    ['generate', mocks.generatePhoto, ['100', girl, 'everyday', 'At the cafe', file, { seed: 42 }]],
    ['generate-duo', mocks.generateDuoPhoto, ['100', girl, friend, 'everyday', 'At the cafe', file, { seed: 42 }]]
  ] as const
  const invocations = new ModInvocations()
  invocations.replace(result.table, result.invokes)
  expect([...result.invokes.get('photo-feature')!.keys()].sort()).toEqual(cases.map(c => c[0]).sort())
  for (const [name, service, args] of cases) {
    service.mockResolvedValueOnce(file)
    const requestId = invocations.dispatch(1, 'photo-feature', { kind: 'start', name, args: [...args] })
    expect(await invocations.dispatch(1, 'photo-feature', { kind: 'result', requestId })).toBe(file)
    const forwarded = service.mock.lastCall!
    const count = name === 'generate' ? 5 : name === 'generate-duo' ? 6 : args.length
    expect(forwarded.slice(0, count)).toEqual(args.slice(0, count))
    if (name.startsWith('generate')) expect(forwarded.at(-1)).toEqual({ seed: 42 })
  }
})

it('serves an existing photo through the registered vxmod route', async () => {
  const file = 'lia_chat_001.png'
  const folder = join(root, 'data', 'saves', '100')
  await mkdir(folder, { recursive: true })
  const path = getPhotoPath('100', 'lia', file)
  await mkdir(join(path, '..'), { recursive: true })
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
  await writeFile(path, png)
  handleModProtocol({ served: () => result.served, routes: () => result.routes, hostNames: () => null })
  const respond = mocks.handle.mock.lastCall![1] as (request: Request) => Promise<Response>
  const response = await respond(new Request(`vxmod://photo-feature/@/photos/100/lia/${file}`))
  expect(response.status).toBe(200)
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(png)
  expect((await respond(new Request('vxmod://photo-feature/@/photos/100/lia/nope.txt'))).status).toBe(404)
})
