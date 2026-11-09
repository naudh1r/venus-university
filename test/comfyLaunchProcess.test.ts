import { EventEmitter } from 'node:events'
import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComfyTarget } from '../src/main/services/comfyService'
import { SHIPPED_DEFAULT_TAGS } from '@shared/defaultTags'

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(), open: vi.fn(() => 17), close: vi.fn(), fetch: vi.fn()
}))
vi.mock('child_process', () => ({ spawn: mocks.spawn }))
vi.mock('fs', async importOriginal => ({
  ...await importOriginal<typeof import('fs')>(), openSync: mocks.open, closeSync: mocks.close
}))
vi.mock('fs/promises', async importOriginal => ({
  ...await importOriginal<typeof import('fs/promises')>(), readFile: async () => '', readdir: async () => []
}))
vi.mock('../src/main/paths', () => ({
  getComfyUiPath: () => 'C:/fixture/comfy', getComfyPythonPath: () => 'C:/fixture/python.exe',
  getComfyAppPath: () => 'C:/fixture/comfy/app', getComfyLogPath: () => 'C:/fixture/comfy/log',
  getWorkflowsPath: () => 'C:/fixture/workflows'
}))
vi.mock('../src/main/services/assetService', () => ({ getPoseTags: vi.fn() }))
vi.mock('../src/main/services/downloadService', () => ({ redactUrl: (url: string) => url }))
vi.mock('../src/main/services/settingsService', () => ({ getSettings: vi.fn() }))
vi.mock('../src/main/services/characterService', () => ({ assertSafeCharId: vi.fn() }))
vi.mock('../src/main/services/imageFiles', () => ({}))
vi.mock('../src/main/services/profileService', () => ({ tryCutProfile: vi.fn() }))
vi.mock('../src/main/services/processTree', () => ({
  killStrayProcesses: vi.fn(), killTree: vi.fn(), listProcessIds: () => [123]
}))
vi.mock('@shared/retry', () => ({ sleep: async () => {} }))

const managed: ComfyTarget = {
  source: 'managed', baseUrl: 'http://127.0.0.1:8188', picks: undefined, loraWeight: 1, tags: SHIPPED_DEFAULT_TAGS
}
// Assertions must not print the host's environment if they fail.
function environmentHash(env: NodeJS.ProcessEnv): string {
  return createHash('sha256').update(JSON.stringify(Object.entries(env).sort())).digest('hex')
}
let service: typeof import('../src/main/services/comfyService')
let registry: typeof import('../src/main/services/comfyLaunchEnvironment')
beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  mocks.fetch.mockResolvedValue({ ok: false, json: async () => ({}) })
  vi.stubGlobal('fetch', mocks.fetch)
  mocks.spawn.mockImplementation(() => {
    const child = Object.assign(new EventEmitter(), { pid: 123 })
    // Deliberately stop the fake child: this tests the real launch boundary without a runtime.
    queueMicrotask(() => { child.emit('error', Error('fixture child stopped')); child.emit('exit', 1) })
    return child
  })
  registry = await import('../src/main/services/comfyLaunchEnvironment')
  service = await import('../src/main/services/comfyService')
})
afterEach(() => { vi.unstubAllGlobals() })

describe('ComfyUI service launch boundary', () => {
  it('passes provider additions to the managed child and retains inherited environment', async () => {
    const parentHash = environmentHash(process.env)
    const provide = vi.fn((ctx: { root: string }) => ({ FIXTURE_MODEL_HOME: ctx.root }))
    registry.registerComfyLaunchEnvironment('fixture', provide)
    await expect(service.start(managed)).rejects.toMatchObject({ code: 'COMFY_START_FAILED' })
    expect(provide).toHaveBeenCalledExactlyOnceWith({ root: 'C:/fixture/comfy', platform: process.platform })
    expect(mocks.spawn).toHaveBeenCalledOnce()
    const options = mocks.spawn.mock.calls[0][2]
    expect(options.cwd).toBe('C:/fixture/comfy')
    expect(options.env.FIXTURE_MODEL_HOME).toBe('C:/fixture/comfy')
    const inherited = { ...options.env }
    if (Object.hasOwn(process.env, 'FIXTURE_MODEL_HOME')) inherited.FIXTURE_MODEL_HOME = process.env.FIXTURE_MODEL_HOME
    else delete inherited.FIXTURE_MODEL_HOME
    expect(environmentHash(inherited)).toBe(parentHash)
    expect(environmentHash(process.env)).toBe(parentHash)
    expect(mocks.close).toHaveBeenCalledExactlyOnceWith(17)
  })

  it('preserves native environment inheritance with no provider', async () => {
    await expect(service.start(managed)).rejects.toMatchObject({ code: 'COMFY_START_FAILED' })
    expect(mocks.spawn.mock.calls[0][2].env).toBeUndefined()
  })

  it('reports a conflict before opening a log or spawning, and a removed provider permits retry', async () => {
    registry.registerComfyLaunchEnvironment('alpha', () => ({ FIXTURE_CACHE: 'first' }))
    const dispose = registry.registerComfyLaunchEnvironment('beta', () => ({ FIXTURE_CACHE: 'second' }))
    const sink = vi.fn()
    service.setStateSink(sink)
    await expect(service.start(managed)).rejects.toMatchObject({ code: 'COMFY_ENV_CONFLICT' })
    expect(mocks.open).not.toHaveBeenCalled()
    expect(mocks.spawn).not.toHaveBeenCalled()
    expect(sink).toHaveBeenCalledWith({ state: 'error', error: expect.objectContaining({ code: 'COMFY_ENV_CONFLICT' }) })
    dispose()
    await expect(service.start(managed)).rejects.toMatchObject({ code: 'COMFY_START_FAILED' })
    expect(mocks.spawn.mock.calls[0][2].env.FIXTURE_CACHE).toBe('first')
  })

  it.each(['external', 'managed'] as const)('never evaluates launch providers for an already-running %s server', async source => {
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({}) })
    const provide = vi.fn(() => { throw Error('Must not run') })
    registry.registerComfyLaunchEnvironment('fixture', provide)
    await expect(service.start({ ...managed, source })).resolves.toBeUndefined()
    expect(provide).not.toHaveBeenCalled()
    expect(mocks.spawn).not.toHaveBeenCalled()
    expect(mocks.open).not.toHaveBeenCalled()
  })

  it('shares one preflight between concurrent start callers', async () => {
    const provide = vi.fn(() => ({ FIXTURE_CACHE: 'one' }))
    registry.registerComfyLaunchEnvironment('fixture', provide)
    const first = service.start(managed)
    const second = service.start(managed)
    expect(second).toBe(first)
    const results = await Promise.allSettled([first, second])
    expect(results.every(result => result.status === 'rejected')).toBe(true)
    expect(provide).toHaveBeenCalledOnce()
    expect(mocks.spawn).toHaveBeenCalledOnce()
  })
})
