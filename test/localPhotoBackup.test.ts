import { mkdir, mkdtemp, readFile, readdir, rm, writeFile, access } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

let root = ''
const mocks = vi.hoisted(() => ({ render: vi.fn(), afterWrite: vi.fn() }))
vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => root, getPath: () => root }
}))
vi.mock('@vx/modkit/main', async original => {
  const actual = await original<typeof import('@vx/modkit/main')>()
  return { ...actual, renderComfyImage: mocks.render,
    writeAtomicBytes: async (...args: Parameters<typeof actual.writeAtomicBytes>) => {
      await actual.writeAtomicBytes(...args)
      await mocks.afterWrite(args[0])
    }
  }
})
const { photoBackupPart: part, localPhotosBackupPath } = await import('../src/main/localPhotoBackup')
const files = await import('../src/main/photoFiles')
const { photoInfo, generatePhoto } = await import('../src/main/services/localPhotoService')
const { character } = await import('./fixtures')
const { createZip } = await import('../src/main/services/archiveService')
const PNG = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(24)])
const info = { schemaVersion: 1, seed: 91, tier: 'everyday', positive: 'At the cafe', negative: 'bad hands' }
const image = 'lia_chat_001.png', sidecar = 'lia_chat_001.json'
const dest = (file: string) => files.getPhotoPath('100', 'lia', file)
const legacy = () => ({ record: {}, dirs: [], archive: join(root, 'backup.zip') })
const exists = (path: string) => access(path).then(() => true, () => false)
async function put(path: string, data: Buffer | string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, data)
}
async function restoreOwnPhase(): Promise<void> {
  await rm(join(root, 'data', 'saves'), { recursive: true, force: true })
  await mkdir(join(root, 'data', 'saves', '100'), { recursive: true })
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'photo-backup-'))
  await mkdir(join(root, 'data', 'saves', '100'), { recursive: true })
  mocks.render.mockReset().mockResolvedValue(PNG)
  mocks.afterWrite.mockReset()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(async () => {
  vi.restoreAllMocks()
  await rm(root, { recursive: true, force: true })
})

it('exports finished images and sidecars, leaving an unfinished render out', async () => {
  await put(dest(image), PNG)
  await put(dest(sidecar), JSON.stringify(info))
  await put(dest('lia_chat_002.png'), PNG)
  await put(dest('lia_chat_002.json'), JSON.stringify({ ...info, seed: 92 }))
  let release!: () => void
  mocks.afterWrite.mockImplementation(async (path: string) => {
    if (path.endsWith('lia_chat_002.png')) await new Promise<void>(resolve => { release = resolve })
  })
  const drawing = generatePhoto('100', character({ charId: 'lia' }), 'everyday',
    'At the cafe', 'lia_chat_002.png')
  await vi.waitFor(() => expect(release).toBeTypeOf('function'))
  try {
    const output = await part.export({ scratch: join(root, 'share'), playthroughIds: ['100'] })
    expect([...output.files!].sort()).toEqual([`100/lia/${sidecar}`, `100/lia/${image}`].sort())
    expect(await readFile(join(root, 'share', '100', 'lia', image))).toEqual(PNG)
  } finally { release(); await drawing }
})

it('fails a finished image export instead of silently omitting unreadable data', async () => {
  await put(dest(image), 'not an image')
  await expect(part.export({ scratch: join(root, 'share'), playthroughIds: ['100'] })).rejects
    .toMatchObject({ code: 'PHOTO_FILE_INVALID' })
})

it('restores a new backup after core replaces the playthrough folders, preserving recorded info', async () => {
  await put(dest(image), PNG)
  await put(dest(sidecar), JSON.stringify(info))
  await put(dest('lia_chat_002.png'), PNG)
  const output = await part.export({ scratch: join(root, 'share'), playthroughIds: ['100'] })
  const restore = await part.prepare(output.json,
    { dir: join(root, 'share'), list: output.files! }, legacy())
  await restoreOwnPhase()
  await restore.commit()
  expect(await readFile(dest(image))).toEqual(PNG)
  expect(await readFile(dest('lia_chat_002.png'))).toEqual(PNG)
  expect(await photoInfo('100', character({ charId: 'lia' }), undefined, 'everyday', 'At the cafe', image))
    .toMatchObject({ ...info, recorded: true })
  await restore.discard()
})

it('imports an older companion zip, including 1.7.0 sidecars and photos without one', async () => {
  const source = join(root, 'old-share')
  await put(join(source, '100', 'lia', image), PNG)
  await put(join(source, '100', 'lia', sidecar), JSON.stringify(info))
  await put(join(source, '100', 'lia', 'lia_chat_002.png'), PNG)
  await put(join(source, '100', 'lia', 'lia_chat_002.json'), '{')
  await createZip(source, localPhotosBackupPath(legacy().archive))
  const restore = await part.prepare(undefined, { dir: join(root, 'empty'), list: [] }, legacy())
  await restoreOwnPhase()
  await restore.commit()
  expect(await readFile(dest(image))).toEqual(PNG)
  expect(JSON.parse(await readFile(dest(sidecar), 'utf8'))).toEqual(info)
  expect(await readFile(dest('lia_chat_002.png'))).toEqual(PNG)
  expect(await exists(dest('lia_chat_002.json'))).toBe(false)
})

it('does not let unreadable optional sidecars block restoring their images', async () => {
  const share = join(root, 'share')
  await put(join(share, '100', 'lia', image), PNG)
  await put(join(share, '100', 'lia', sidecar), '{"schemaVersion":999}')
  const restore = await part.prepare({ schemaVersion: 1 }, {
    dir: share, list: [`100/lia/${image}`, `100/lia/${sidecar}`]
  }, legacy())
  await restore.commit()
  expect(await readFile(dest(image))).toEqual(PNG)
  expect(await exists(dest(sidecar))).toBe(false)
})

it('rejects a broken image before core restore and discards its staging', async () => {
  await put(dest(image), PNG)
  const share = join(root, 'share')
  await put(join(share, '100', 'lia', image), 'corrupt')
  await expect(part.prepare({ schemaVersion: 1 }, {
    dir: share, list: [`100/lia/${image}`]
  }, legacy())).rejects.toMatchObject({ code: 'PHOTO_FILE_INVALID' })
  expect(await readFile(dest(image))).toEqual(PNG)
  expect((await readdir(tmpdir())).filter(name => name.startsWith('vx-photo-restore-'))).toEqual([])
  // Staging makes no global mod-data folder.
  await expect(access(join(root, 'data', 'mod-data', 'photo-feature'))).rejects.toBeTruthy()
})

it('never includes or replaces native cloud photos', async () => {
  const native = join(root, 'data', 'saves', '100', 'photos', '1790000000000.png')
  await put(native, PNG)
  await put(native.replace('.png', '.json'), '{"native":true}')
  await put(dest(image), PNG)
  const output = await part.export({ scratch: join(root, 'share'), playthroughIds: ['100'] })
  expect(output.files).toEqual([`100/lia/${image}`])
  const restore = await part.prepare(output.json,
    { dir: join(root, 'share'), list: output.files! }, legacy())
  await restore.commit()
  expect(await readFile(native)).toEqual(PNG)
  expect(await readFile(native.replace('.png', '.json'), 'utf8')).toBe('{"native":true}')
})

it('restores an older backup with no companion as an empty Photo share', async () => {
  const restore = await part.prepare(undefined, { dir: join(root, 'empty'), list: [] }, legacy())
  await restoreOwnPhase()
  await restore.commit()
  expect(await exists(dest(image))).toBe(false)
})

it('backs up the new copy of a name, leaving a conflicting older copy where it is', async () => {
  await put(dest(image), PNG)
  const legacy = join(root, 'data', 'saves', '100', 'photos', 'lia', image)
  const older = Buffer.concat([PNG, Buffer.from('different legacy image')])
  await put(legacy, older)
  const output = await part.export({ scratch: join(root, 'share'), playthroughIds: ['100'] })
  expect(output.files).toEqual([`100/lia/${image}`])
  expect(await readFile(join(root, 'share', '100', 'lia', image))).toEqual(PNG)
  expect(await readFile(legacy)).toEqual(older)
})

it('names the photo that stops a backup', async () => {
  await put(dest(image), 'not an image')
  await expect(part.export({ scratch: join(root, 'share'), playthroughIds: ['100'] })).rejects
    .toMatchObject({ code: 'PHOTO_FILE_INVALID', detail: image })
})
