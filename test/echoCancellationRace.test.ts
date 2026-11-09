import { beforeEach, expect, it, vi } from 'vitest'
import { normalizeEcho } from '@shared/echo'
import { type ModSwitches } from '@shared/mods'

// DOTS regression fixtures: no real files, Electron windows, models or image API calls.
const mocks = vi.hoisted(() => ({
  switches: vi.fn(), cloud: vi.fn(), local: vi.fn(), prepare: vi.fn(), cutout: vi.fn(),
  mkdir: vi.fn(), write: vi.fn(), read: vi.fn(), stat: vi.fn(), rename: vi.fn(),
  character: vi.fn(), sprite: vi.fn(), rm: vi.fn(), readdir: vi.fn()
}))
vi.mock('../src/main/services/modsService', async () => {
  const { modOn, optionOn } = await import('../src/shared/mods')
  let switches: import('../src/shared/mods').ModSwitches = { on: {}, options: {} }
  return {
    getModSwitches: mocks.switches,
    modIsOn: async (id: string) => { switches = await mocks.switches(); return modOn(switches, id) },
    modOptionOn: (id: string, option: string) => optionOn(switches, id, option)
  }
})
vi.mock('@shared/llm/cloudImage', () => ({ generateImage: mocks.cloud }))
vi.mock('../src/main/services/echoLocalImage', () => ({ generateLocalEcho: mocks.local }))
vi.mock('../src/main/services/reflectionLocalImage', () => ({ generateLocalReflection: vi.fn(), resolveLocalReflectionTarget: vi.fn() }))
vi.mock('../src/main/services/echoArtImage', () => ({ decodeEchoArt: async (bytes: Uint8Array) => Buffer.from(bytes), MAX_ECHO_ART_BYTES: 20 * 1024 * 1024 }))
vi.mock('../src/main/services/echoCutout', () => ({
  prepareEchoCutout: mocks.prepare, cutoutEchoImage: mocks.cutout, releaseEchoCutout: vi.fn()
}))
vi.mock('../src/main/services/echoModelSetup', () => ({ installEchoModels: vi.fn() }))
vi.mock('../src/main/services/echoMatte', () => ({ clearEchoMatte: vi.fn() }))
vi.mock('../src/main/paths', () => ({ getDataPath: () => 'qa-review-fixture-only' }))
vi.mock('fs/promises', () => ({
  mkdir: mocks.mkdir, writeFile: mocks.write, readFile: mocks.read, stat: mocks.stat,
  rename: mocks.rename, rm: mocks.rm, readdir: mocks.readdir
}))
vi.mock('../src/main/services/characterService', () => ({
  getCharacter: mocks.character, readCharacterImage: mocks.sprite
}))
vi.mock('electron', () => ({ nativeImage: { createFromBuffer: (bytes: Buffer) => ({
  isEmpty: () => false, getSize: () => ({ width: 1, height: 1 }), toPNG: () => bytes
}) } }))

import { cancelEchoArt, generateEchoArt, generateReflectionPortrait } from '../src/main/services/echoService'

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')
const id = 'fdc99b1a-bd3b-41ca-897f-757b3bf983c3'
const request = () => ({ requestId: id, identity: normalizeEcho({ player: { name: 'Vaelum', aspect: 'veilkeeper', motif: 0 } }).player!, name: 'Fictional reader', bio: 'Thoughtful.' })

beforeEach(() => {
  vi.resetAllMocks()
  mocks.switches.mockResolvedValue({ on: { echo: true, reckoning: true }, options: {} })
  mocks.cloud.mockResolvedValue(png)
  mocks.cutout.mockResolvedValue(png)
  mocks.read.mockRejectedValue(Object.assign(Error('fixture has no saved reflection'), { code: 'ENOENT' }))
  mocks.character.mockResolvedValue({ charId: 'nina', firstName: 'Nina', lastName: 'Bell', personality: 'Thoughtful.', backstory: 'Fictional profile.' })
  mocks.sprite.mockResolvedValue(png)
})

it.each(['Echo', 'Unheard Soul'] as const)('honors %s cancellation while the initial settings read is pending', async kind => {
  let finishSettings!: (switches: ModSwitches) => void
  mocks.switches.mockReturnValueOnce(new Promise<ModSwitches>(resolve => { finishSettings = resolve }))

  const pending = kind === 'Echo'
    ? generateEchoArt({ requestId: id, identity: normalizeEcho({ player: { name: 'Vaelum', aspect: 'veilkeeper', motif: 0 } }).player!, name: 'Fictional reader', bio: 'Thoughtful.' }, 7)
    : generateReflectionPortrait('nina', id, 7)
  expect(mocks.switches).toHaveBeenCalledTimes(1)

  // The renderer already owns this request ID and exposes Stop/Cancel at this point.
  cancelEchoArt(id, 7)
  finishSettings({ on: { echo: true, reckoning: true }, options: {} })
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })

  // Expected behavior: cancellation before any image work must prevent a paid request.
  expect(mocks.cloud).not.toHaveBeenCalled()
  expect(mocks.prepare).not.toHaveBeenCalled()
  expect(mocks.write).not.toHaveBeenCalled()
})

it('reserves one job during settings lookup, retains ownership and releases it on cancellation', async () => {
  let finish!: (switches: ModSwitches) => void
  mocks.switches.mockReturnValueOnce(new Promise<ModSwitches>(resolve => { finish = resolve }))
  const pending = generateEchoArt(request(), 7)
  await expect(generateReflectionPortrait('nina', crypto.randomUUID(), 8)).rejects.toThrow('already being generated')
  cancelEchoArt(id, 8)
  finish({ on: { echo: true, reckoning: true }, options: {} })
  await expect(pending).resolves.toBeTypeOf('string')
  expect(mocks.cloud).toHaveBeenCalledTimes(1)
  mocks.prepare.mockImplementationOnce(() => { cancelEchoArt(id, 7) })
  await expect(generateEchoArt(request(), 7)).rejects.toMatchObject({ name: 'AbortError' })
  expect(mocks.cloud).toHaveBeenCalledTimes(1)
  await expect(generateEchoArt(request(), 7)).resolves.toBeTypeOf('string')
})

it('releases an admitted job when settings fail or the mod is disabled', async () => {
  mocks.switches.mockRejectedValueOnce(Error('settings unavailable'))
  await expect(generateEchoArt(request(), 7)).rejects.toThrow('settings unavailable')
  mocks.switches.mockResolvedValueOnce({ on: { reckoning: false }, options: {} })
  await expect(generateReflectionPortrait('nina', id, 7)).rejects.toThrow('Enable Reckoning')
  expect(mocks.cloud).not.toHaveBeenCalled()
  await expect(generateEchoArt(request(), 7)).resolves.toBeTypeOf('string')
})
