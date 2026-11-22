import { beginPhotoFile, readPhotoSidecar } from '../src/main/photoFiles'
import { savedPhoto } from '../src/shared/photoTypes'
import { photoCalls } from './fixtures/photoCalls'
import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { character, charactersById, charInfo, restoreApi, stubApi } from './fixtures'

let root = ''
const mocks = vi.hoisted(() => ({ save: vi.fn(), render: vi.fn(), ppm: vi.fn(), comfy: vi.fn(), random: vi.fn() }))
vi.mock('crypto', async original => ({ ...await original<object>(), randomBytes: mocks.random }))
vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => root, getPath: () => root }
}))
vi.mock('../src/renderer/stores/loop/saves', () => ({ writeAutosave: mocks.save, saveChanges: async () => {
  const { useGameStore } = await import('../src/renderer/stores/gameStore')
  const game = useGameStore.getState()
  if (game.currentSceneTranscript.length && !game.awaitingInput) return { ok: true, data: 'deferred' }
  await mocks.save(); return { ok: true, data: 'written' } } }))
vi.mock('@vx/modkit/main', async original => ({ ...await original<object>(), comfyNodePackState: mocks.ppm, renderComfyImage: mocks.comfy }))
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
const { dropPhoto, replacePhoto, reserveRedrawName, reservePhotoName, sweepPhotos, photoInfo, generateDuoPhoto, validatePhotoOverrides } = await import(
  '../src/main/services/localPhotoService'
)
const girl = character({ charId: 'a' })
const run = (): string => join(root, 'data', 'saves', '1')
const image = (file: string): string => join(run(), 'mod-data', 'photo-feature', 'a', file)
const exists = (path: string): Promise<boolean> => access(path).then(() => true, () => false)
let currentFile: () => string

beforeEach(async () => {
  const crypto = await vi.importActual<typeof import('crypto')>('crypto')
  mocks.random.mockReset().mockImplementation((size: number) => crypto.randomBytes(size))
  mocks.ppm.mockReset().mockResolvedValue('installed')
  mocks.comfy.mockReset().mockResolvedValue(new Uint8Array([1, 2, 3]))
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
    await writeFile(image(file.replace(/\.(png|webp)$/, '.json')), JSON.stringify({ schemaVersion: 1, seed: 88, tier: 'everyday', positive: 'new prompt', negative: 'new negative', orientation: 'wide' }))
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
      await writeFile(image(oldFile.replace('.png', '.json')), JSON.stringify({ schemaVersion: 1, seed: 7, tier: 'everyday', positive: 'old prompt', negative: 'old negative' }))
      stubApi({ jobs: { onProgress: () => () => {} }, ...photoCalls({
        reserveRedraw: async (pid, character, saved) => {
          const file = await reserveRedrawName(pid, character, saved)
          return { ok: true, data: file }
        },
        replace: async (pid, charId, file, temporary) => {
          await replacePhoto(pid, charId, file, temporary)
          return { ok: true, data: undefined }
        },
        drop: async (id, charId, file) => {
          await dropPhoto(id, charId, file)
          return { ok: true, data: undefined }
        }
      }) })
    })

    it.each([false, true])('replaces in place without a record write or save, during scene %s', async scene => {
      if (scene) useGameStore.setState({ currentSceneTranscript: [{ speaker: 'a', text: 'A scene' }] as never, awaitingInput: false })
      const before = JSON.stringify(useGameStore.getState().bunnyboard)
      await redraw()
      expect(currentFile()).toBe(oldFile)
      expect(mocks.save).not.toHaveBeenCalled()
      expect(JSON.stringify(useGameStore.getState().bunnyboard)).toBe(before)
      expect(JSON.parse(await readFile(join(run(), 'autosave.json'), 'utf8')).photo.file).toBe(oldFile)
      expect(await readFile(image(oldFile), 'utf8')).toBe('new picture')
      expect(await readPhotoSidecar(image(oldFile.replace('.png', '.json')))).toMatchObject({ seed: 88, positive: 'new prompt', orientation: 'wide' })
      expect((await readdir(image('.'))).sort()).toEqual([oldFile.replace('.png', '.json'), oldFile].sort())
    })

    it.each(['failure', 'cancelled', 'load', 'timeout'] as const)('keeps original bytes and removes the temporary render after %s', async outcome => {
      const original = await readFile(image(oldFile))
      const sidecar = await readFile(image(oldFile.replace('.png', '.json')))
      const draw = mocks.render.getMockImplementation()!
      mocks.render.mockImplementationOnce(async (...args: unknown[]) => {
        await draw(...args)
        if (outcome === 'load') useGameStore.setState({ playthroughId: '2' })
        if (outcome === 'timeout') {
          const { RENDER_PATIENCE_MS } = await import('../src/renderer/stores/photoRedraw')
          await vi.advanceTimersByTimeAsync(RENDER_PATIENCE_MS)
        }
        return outcome === 'load' || outcome === 'timeout' ? { ok: true, data: args[4] } : { ok: false, error: { code: outcome === 'cancelled' ? 'CANCELLED' : 'FAILED', message: outcome } }
      })
      if (outcome === 'timeout') vi.useFakeTimers()
      try { await redraw() } finally { vi.useRealTimers() }
      expect(await readFile(image(oldFile))).toEqual(original)
      expect(await readFile(image(oldFile.replace('.png', '.json')))).toEqual(sidecar)
      expect((await readdir(image('.'))).sort()).toEqual([oldFile.replace('.png', '.json'), oldFile].sort())
    })
  })
}


describe('gender in recorded and rebuilt photo info', () => {
  const guy = { ...girl, gender: 'male' as const, baseAppearance: ['1boy', 'male_focus', 'brown_hair'], outfit: ['blue_shirt'] }

  it('rebuilds a male single from the current character, keeping the saved seed', async () => {
    await writeFile(image('adam_chat_001.json'), JSON.stringify({ schemaVersion: 1, seed: 42, tier: 'everyday', positive: 'old prompt', negative: 'old negative' }))

    const info = await photoInfo('1', guy, undefined, 'everyday', 'shirtless in his shorts', 'adam_chat_001.png', true)

    expect(info.recorded).toBe(false)
    expect(info.seed).toBe(42)
    expect(info.positive).toContain('1boy')
    expect(info.positive).toContain('mature_male')
    expect(info.positive).not.toMatch(/1girl|breasts|pussy/)
    expect(info.negative).toMatch(/\bpenis\b/)
  })

  it('rebuilds mixed halves from each current character', async () => {
    const info = await photoInfo('1', guy, character({ charId: 'b' }), 'everyday', 'Him and his friend in their everyday clothes', 'adam_bunnyboard_001.png', true)

    expect(info.positive).toMatch(/\b1girl\b/)
    expect(info.positive).toMatch(/\b1boy\b/)
    expect(info.left).toContain('mature_male')
    expect(info.right).toContain('mature_female')
    expect(info.negative).not.toMatch(/\b1boy\b|\b1girl\b/)
  })

  it('returns a female photo’s recorded request unchanged until a rebuild is asked for', async () => {
    const saved = { schemaVersion: 1, seed: 41, tier: 'explicit', positive: '1girl, mature_female, nude', negative: '1boy, sex' }
    await writeFile(image('sarah_chat_001.json'), JSON.stringify(saved))

    const info = await photoInfo('1', girl, undefined, 'explicit', 'nude', 'sarah_chat_001.png')

    expect(info).toEqual({ ...saved, recorded: true, orientation: 'portrait' })
    expect(JSON.parse(await readFile(image('sarah_chat_001.json'), 'utf8'))).toEqual(saved)
  })
})

describe('a photo\u2019s orientation', () => {
  it('reads a recorded wide picture, and refuses a record naming any other orientation', async () => {
    const saved = { schemaVersion: 1, seed: 7, tier: 'everyday', positive: 'at the cafe', negative: 'lowres' }
    await writeFile(image('sarah_chat_001.json'), JSON.stringify({ ...saved, orientation: 'wide' }))
    await writeFile(image('sarah_chat_002.json'), JSON.stringify({ ...saved, orientation: 'portrait' }))

    expect(await photoInfo('1', girl, undefined, 'everyday', 'at the cafe', 'sarah_chat_001.png'))
      .toEqual({ ...saved, recorded: true, orientation: 'wide' })
    const refused = await photoInfo('1', girl, undefined, 'everyday', 'at the cafe', 'sarah_chat_002.png')
    expect(refused.recorded).toBe(false)
    expect(refused.seed).toBeUndefined()
    expect(refused.orientation).toBe('portrait')
  })

  it('accepts a redraw in either orientation and refuses any other', () => {
    for (const orientation of ['portrait', 'wide'] as const) {
      expect(() => validatePhotoOverrides({ orientation }, true)).not.toThrow()
    }
    for (const orientation of ['landscape', 1, null]) {
      expect(() => validatePhotoOverrides({ orientation }, false)).toThrow(/orientation/)
    }
  })
})


describe('a duo photo’s recorded method', () => {
  const saved = { schemaVersion: 1, seed: 9, tier: 'everyday', positive: 'a cafe', negative: 'lowres', left: '1girl, solo', right: '1boy, solo, male_focus' }

  it.each([undefined, 'ppm'] as const)('reads a valid sidecar with method %s', async couple => {
    const record = { ...saved, ...(couple ? { couple } : {}) }
    await writeFile(image('sarah_bunnyboard_001.json'), JSON.stringify(record))
    expect(await readPhotoSidecar(image('sarah_bunnyboard_001.json'))).toEqual(record)
  })

  it.each(['area', 'other', null, 1])('refuses a sidecar with method %s', async couple => {
    await writeFile(image('sarah_bunnyboard_001.json'), JSON.stringify({ ...saved, couple }))
    expect(await readPhotoSidecar(image('sarah_bunnyboard_001.json'))).toBeUndefined()
  })

  it('refuses ppm on a solo sidecar', async () => {
    const { left: _left, right: _right, ...solo } = saved
    await writeFile(image('sarah_chat_001.json'), JSON.stringify({ ...solo, couple: 'ppm' }))
    expect(await readPhotoSidecar(image('sarah_chat_001.json'))).toBeUndefined()
  })

  it('validates duo method overrides without accepting them on solo photos', () => {
    for (const couple of ['ppm'] as const) {
      expect(() => validatePhotoOverrides({ couple }, true)).not.toThrow()
      expect(() => validatePhotoOverrides({ couple }, false)).toThrow(/couple method/)
    }
    for (const couple of ['area', 'wide', 'other', null, 1]) {
      expect(() => validatePhotoOverrides({ couple }, true)).toThrow(/couple method/)
    }
  })

  it('rebuilds old halves for ppm while keeping the recorded scene, negative and seed', async () => {
    await writeFile(image('sarah_bunnyboard_001.json'), JSON.stringify(saved))
    const friend = character({ charId: 'b', gender: 'male', baseAppearance: ['1boy', 'black_hair'] })
    const current = await photoInfo('1', girl, friend, 'everyday', 'Me and my friend at the cafe', 'sarah_bunnyboard_001.png')
    expect(current).toMatchObject({ couple: 'ppm', positive: saved.positive, negative: saved.negative, seed: saved.seed })
    expect(current.left).not.toBe(saved.left)
    expect(current.right).not.toBe(saved.right)
    const rebuilt = await photoInfo('1', girl, friend, 'everyday', 'Me and my friend at the cafe', 'sarah_bunnyboard_001.png', true)
    expect(rebuilt.couple).toBe('ppm')
    expect(rebuilt.seed).toBe(saved.seed)
    expect(JSON.parse(await readFile(image('sarah_bunnyboard_001.json'), 'utf8'))).toEqual(saved)
  })
  it('keeps recorded ppm prompts when inspecting or changing orientation without Rebuild', async () => {
    const record = { ...saved, couple: 'ppm', left: 'edited left', right: 'edited right' }
    await writeFile(image('sarah_bunnyboard_001.json'), JSON.stringify(record))
    for (const orientation of ['portrait', 'wide'] as const) {
      const info = await photoInfo('1', girl, character({ charId: 'b' }), 'everyday', 'different scene', 'sarah_bunnyboard_001.png', false, orientation)
      expect(info).toEqual({ ...record, recorded: true, orientation })
    }
    expect(await readPhotoSidecar(image('sarah_bunnyboard_001.json'))).toEqual(record)
  })

  it.each(['portrait', 'wide'] as const)('redraws old halves with ppm in %s and records the new method', async orientation => {
    const file = 'sarah_bunnyboard_001.png'
    await writeFile(image('sarah_bunnyboard_001.json'), JSON.stringify(saved))
    await generateDuoPhoto('1', girl, character({ charId: 'b' }), 'everyday', 'Me and my friend at the cafe', file, {}, { seed: saved.seed, orientation })
    const after = await readPhotoSidecar(image('sarah_bunnyboard_001.json'))
    expect(after).toMatchObject({ couple: 'ppm', positive: saved.positive, negative: saved.negative, seed: saved.seed })
    expect(after!.left).not.toBe(saved.left)
    expect(after!.right).not.toBe(saved.right)
    expect(after!.orientation).toBe(orientation === 'wide' ? 'wide' : undefined)
    expect(mocks.comfy).toHaveBeenCalledTimes(1)
  })

  it('keeps edited ppm halves on a plain redraw and never retries with another method', async () => {
    const prompts = { positive: 'player scene', negative: 'player negative', left: 'player left', right: 'player right' }
    const file = 'sarah_bunnyboard_002.png'
    await generateDuoPhoto('1', girl, character({ charId: 'b' }), 'everyday', 'original caption', file, {}, { prompts, couple: 'ppm' })
    expect(await readPhotoSidecar(image('sarah_bunnyboard_002.json'))).toMatchObject({ ...prompts, couple: 'ppm', orientation: 'wide' })
    mocks.comfy.mockClear().mockRejectedValue({ code: 'COMFY_NODES_MISSING' })
    await expect(generateDuoPhoto('1', girl, character({ charId: 'b' }), 'everyday', 'original caption', 'sarah_bunnyboard_003.png'))
      .rejects.toMatchObject({ code: 'COMFY_NODES_MISSING' })
    expect(mocks.comfy).toHaveBeenCalledTimes(1)
    expect(await exists(image('sarah_bunnyboard_003.json'))).toBe(false)
  })

  it.each(['missing', 'invalid', 'unmanaged'] as const)('refuses a duo redraw with ppm %s without changing its files', async state => {
    const file = 'sarah_bunnyboard_001.png'
    await writeFile(image(file), 'old picture')
    await writeFile(image('sarah_bunnyboard_001.json'), JSON.stringify(saved))
    mocks.ppm.mockResolvedValue(state)
    await expect(generateDuoPhoto('1', girl, character({ charId: 'b' }), 'everyday', 'caption', file))
      .rejects.toMatchObject({ code: 'PHOTO_WIDE_NEEDS_PPM' })
    expect(mocks.comfy).not.toHaveBeenCalled()
    expect(await readFile(image(file), 'utf8')).toBe('old picture')
    expect(await readPhotoSidecar(image('sarah_bunnyboard_001.json'))).toEqual(saved)
  })

})

describe('random photo reservations', () => {
  it('uses ten lowercase letters and digits, and retries disk and reserved clashes', async () => {
    const { randomBytes } = await import('crypto')
    const random = mocks.random
    random.mockReturnValueOnce(Buffer.alloc(16, 0) as never)
      .mockReturnValueOnce(Buffer.alloc(16, 0) as never)
      .mockReturnValueOnce(Buffer.alloc(16, 1) as never)
      .mockReturnValueOnce(Buffer.alloc(16, 1) as never)
      .mockReturnValueOnce(Buffer.alloc(16, 2) as never)
    try {
      await writeFile(image('aaaaaaaaaa.webp'), 'taken')
      const first = await reservePhotoName('1', girl)
      const second = await reservePhotoName('1', girl)
      expect(first).toBe('bbbbbbbbbb.png')
      expect(second).toBe('cccccccccc.png')
      expect(first).toMatch(/^[a-z0-9]{10}\.png$/)
      expect(randomBytes).toHaveBeenCalledTimes(5)
    } finally { random.mockReset() }
  })

  it('serializes concurrent reservations even when the random generator repeats', async () => {
    const random = mocks.random
    random.mockReturnValueOnce(Buffer.alloc(16, 3) as never)
      .mockReturnValueOnce(Buffer.alloc(16, 3) as never)
      .mockReturnValueOnce(Buffer.alloc(16, 4) as never)
    try {
      const names = await Promise.all([reservePhotoName('1', girl), reservePhotoName('1', girl)])
      expect(new Set(names).size).toBe(2)
    } finally { random.mockReset() }
  })
})

describe('orphan sweeps', () => {
  it('keeps saves, replays, reserved and in-flight names while removing only Photo files', async () => {
    await mkdir(join(run(), 'replays'))
    await writeFile(join(run(), 'slot.json'), JSON.stringify({ file: 'sarah_chat_001.webp' }))
    await writeFile(join(run(), 'replays', 'scene.json'), JSON.stringify({ file: 'photo_1_a1b2c3d4.png' }))
    const reserved = await reserveRedrawName('1', girl, [])
    const inflight = 'sarah_chat_002.png'
    const release = beginPhotoFile('1', 'a', inflight)
    const protectedNames = ['sarah_chat_001.png', 'sarah_chat_001.webp', 'sarah_chat_001.json', 'photo_1_a1b2c3d4.png', reserved, reserved.replace('.png', '.json'), inflight, inflight.replace('.png', '.json'), 'not-a-photo.png']
    const orphanNames = ['sarah_chat_099.png', 'sarah_chat_099.webp', 'sarah_chat_099.json', 'zzzzzzzzzz.json']
    for (const file of [...protectedNames, ...orphanNames]) await writeFile(image(file), 'bytes')
    const { symlink } = await import('fs/promises')
    const outside = join(root, 'outside.png')
    await writeFile(outside, 'outside')
    await symlink(outside, image('yyyyyyyyyy.png'))
    try {
      expect(await sweepPhotos('1')).toBe(orphanNames.length)
      for (const file of protectedNames) expect(await exists(image(file))).toBe(true)
      for (const file of orphanNames) expect(await exists(image(file))).toBe(false)
      expect(await readFile(outside, 'utf8')).toBe('outside')
      expect(await exists(image('yyyyyyyyyy.png'))).toBe(true)
    } finally { release() }
  })

  it.each(['save', 'replay'])('removes nothing when a %s is unreadable', async kind => {
    if (kind === 'replay') await mkdir(join(run(), 'replays'))
    await writeFile(join(run(), kind === 'replay' ? 'replays/broken.json' : 'broken.json'), '{')
    await writeFile(image('zzzzzzzzzz.png'), 'orphan')
    await expect(sweepPhotos('1')).rejects.toThrow()
    expect(await readFile(image('zzzzzzzzzz.png'), 'utf8')).toBe('orphan')
  })

  it('removes a photo after its only save is deleted, preserving another save’s picture', async () => {
    await writeFile(image('sarah_chat_001.png'), 'first')
    await writeFile(image('sarah_chat_002.png'), 'second')
    await writeFile(join(run(), 'first.json'), JSON.stringify({ file: 'sarah_chat_001.png' }))
    await writeFile(join(run(), 'second.json'), JSON.stringify({ file: 'sarah_chat_002.png' }))
    expect(await sweepPhotos('1')).toBe(0)
    await rm(join(run(), 'first.json'))
    expect(await sweepPhotos('1')).toBe(1)
    expect(await exists(image('sarah_chat_001.png'))).toBe(false)
    expect(await readFile(image('sarah_chat_002.png'), 'utf8')).toBe('second')
  })
})

describe('interrupted swaps', () => {
  it.each([false, true])('recovers a matching pair when the image rename happened: %s', async landed => {
    const { createHash } = await import('crypto')
    const { readPhotoImage } = await import('../src/main/photoFiles')
    const file = 'photo_1_a1b2c3d4.png'
    const temporary = 'zzzzzzzzzz.png'
    const old = JSON.stringify({ schemaVersion: 1, seed: 1, tier: 'everyday', positive: 'old', negative: '' })
    const next = JSON.stringify({ schemaVersion: 1, seed: 2, tier: 'everyday', positive: 'new', negative: '', orientation: 'wide' })
    await writeFile(image(file), landed ? 'new' : 'old')
    await writeFile(image(file.replace('.png', '.json')), old)
    await writeFile(image(temporary), 'new')
    await writeFile(image(temporary.replace('.png', '.json')), next)
    await writeFile(image('.redraw-' + file.replace('.png', '.json')), JSON.stringify({ schemaVersion: 1, image: file, temporary, digest: createHash('sha256').update('new').digest('hex'), sidecar: next, oldSidecar: Buffer.from(old).toString('base64') }))
    expect(Buffer.from(await readPhotoImage('1', 'a', file)).toString()).toBe(landed ? 'new' : 'old')
    expect(await readFile(image(file.replace('.png', '.json')), 'utf8')).toBe(landed ? next : old)
    expect((await readdir(image('.'))).sort()).toEqual([file, file.replace('.png', '.json')].sort())
  })

  it('rolls back both files byte for byte when cancellation arrives after the image write', async () => {
    const file = 'sarah_chat_001.png'
    await writeFile(image(file), 'old image')
    await writeFile(image('sarah_chat_001.json'), 'old sidecar bytes')
    const temporary = await reserveRedrawName('1', girl, [])
    await mocks.render('1', girl, 'everyday', 'scene', temporary)
    const controller = new AbortController()
    const kit = await import('@vx/modkit/main')
    const realWrite = kit.writeAtomicBytes
    const spy = vi.spyOn(kit, 'writeAtomicBytes').mockImplementation(async (path, bytes, options) => {
      await realWrite(path, bytes, options)
      if (path === image(file)) controller.abort()
    })
    try {
      await expect(replacePhoto('1', 'a', file, temporary, controller.signal)).rejects.toMatchObject({ code: 'CANCELLED' })
      await dropPhoto('1', 'a', temporary)
      expect(await readFile(image(file), 'utf8')).toBe('old image')
      expect(await readFile(image('sarah_chat_001.json'), 'utf8')).toBe('old sidecar bytes')
      expect((await readdir(image('.'))).sort()).toEqual(['sarah_chat_001.json', file].sort())
    } finally { spy.mockRestore() }
  })
})

describe('replacement write failures and image twins', () => {
  it('restores both original files when the sidecar write fails after the image lands', async () => {
    const file = 'sarah_chat_001.webp'
    await writeFile(image(file), 'old webp')
    await writeFile(image('sarah_chat_001.json'), 'old sidecar')
    const temporary = await reserveRedrawName('1', girl, [])
    await mocks.render('1', girl, 'everyday', 'scene', temporary)
    const kit = await import('@vx/modkit/main')
    const realWrite = kit.writeAtomicBytes
    let failed = false
    const spy = vi.spyOn(kit, 'writeAtomicBytes').mockImplementation(async (path, bytes, options) => {
      if (path === image('sarah_chat_001.json') && !failed) { failed = true; throw new Error('disk write refused') }
      return realWrite(path, bytes, options)
    })
    try {
      await expect(replacePhoto('1', 'a', file, temporary)).rejects.toThrow('disk write refused')
      await dropPhoto('1', 'a', temporary)
      expect(await readFile(image(file), 'utf8')).toBe('old webp')
      expect(await readFile(image('sarah_chat_001.json'), 'utf8')).toBe('old sidecar')
      expect((await readdir(image('.'))).sort()).toEqual([file, 'sarah_chat_001.json'].sort())
    } finally { spy.mockRestore() }
  })

  it.each(['sarah_chat_001.webp', 'photo_1_a1b2c3d4.png'])('keeps the identity %s and removes the previous image format', async file => {
    const stem = file.replace(/\.(png|webp)$/, '')
    await writeFile(image(stem + '.webp'), 'old webp')
    await writeFile(image(stem + '.png'), 'old png')
    const temporary = await reserveRedrawName('1', girl, [])
    await mocks.render('1', girl, 'everyday', 'scene', temporary)
    await replacePhoto('1', 'a', file, temporary)
    await dropPhoto('1', 'a', temporary)
    expect(await readFile(image(stem + '.png'), 'utf8')).toBe('new picture')
    expect(await exists(image(stem + '.webp'))).toBe(false)
    expect((await readdir(image('.'))).sort()).toEqual([stem + '.png', stem + '.json'].sort())
  })
})

describe('legacy sweep safety', () => {
  it('waits for legacy files to move before sweeping them', async () => {
    const pid = '2'
    const playthrough = join(root, 'data/saves', pid)
    const legacy = join(playthrough, 'photos/a')
    const modern = join(playthrough, 'mod-data/photo-feature/a')
    await mkdir(legacy, { recursive: true })
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex')
    const sidecar = JSON.stringify({ schemaVersion: 1, seed: 1, tier: 'everyday', positive: 'photo', negative: '' })
    for (const stem of ['sarah_chat_001', 'photo_1_a1b2c3d4']) {
      await writeFile(join(legacy, stem + '.png'), png)
      await writeFile(join(legacy, stem + '.json'), sidecar)
    }
    await writeFile(join(playthrough, 'slot.json'), JSON.stringify({ file: 'sarah_chat_001.png' }))
    expect(await sweepPhotos(pid)).toBe(2)
    expect(await readFile(join(modern, 'sarah_chat_001.png'))).toEqual(png)
    expect(await readFile(join(modern, 'sarah_chat_001.json'), 'utf8')).toBe(sidecar)
    expect(await exists(join(modern, 'photo_1_a1b2c3d4.png'))).toBe(false)
    expect(await exists(join(legacy, 'sarah_chat_001.png'))).toBe(false)
  })

  it('does not follow a photo-root link outside the photo folders', async () => {
    const { symlink } = await import('fs/promises')
    const outside = join(root, 'unowned')
    await mkdir(join(outside, 'a'), { recursive: true })
    await writeFile(join(outside, 'a/zzzzzzzzzz.png'), 'unowned')
    await symlink(outside, join(run(), 'photos'))
    expect(await sweepPhotos('1')).toBe(0)
    expect(await readFile(join(outside, 'a/zzzzzzzzzz.png'), 'utf8')).toBe('unowned')
  })
})
