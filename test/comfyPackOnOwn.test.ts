import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings } from '../src/shared/settingsRules'
import type { SettingsPatch } from '../src/shared/types'
import { registerComfyNodePack } from '../src/main/services/comfyNodePacks'

let root = ''
vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => root, getPath: () => root },
  safeStorage: { isEncryptionAvailable: () => false }
}))
const { applySettingsPatch, getRendererSettings } = await import('../src/main/services/settingsService')
const { comfyNodePackState, installComfyNodePack } = await import('../src/main/services/setupService')
const fetcher = vi.fn<typeof fetch>()
let dispose: () => void

/** Applies a complete renderer patch while retaining the currently selected source. */
async function patch(change: Partial<SettingsPatch>): Promise<void> {
  await applySettingsPatch({ ...defaultSettings(), ...await getRendererSettings(), ...change })
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'pack-on-own-'))
  vi.stubGlobal('fetch', fetcher.mockReset())
  dispose = registerComfyNodePack('fixture', {
    id: 'nodes', label: 'Fixture nodes', owner: 'fixture', repo: 'Fixture', dirName: 'Fixture',
    sha: 'ab'.repeat(20), bytes: 100, sha256: 'ab'.repeat(32), modules: [], classes: ['One', 'Two']
  })
  await patch({ comfySource: 'external', comfyUrl: 'http://localhost:8199' })
})
afterEach(async () => {
  dispose()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  await rm(root, { recursive: true, force: true })
})

/** A fake server response with its loaded classes. */
function answer(classes: Record<string, unknown>): void {
  fetcher.mockImplementation(async () => new Response(JSON.stringify(classes)))
}

describe('a pack on the player’s own ComfyUI', () => {
  it.each([
    [{ One: {}, Two: {} }, 'installed'],
    [{ One: {} }, 'missing']
  ] as const)('reads loaded classes %j as %s', async (listing, expected) => {
    answer(listing)
    expect(await comfyNodePackState('fixture', 'nodes')).toBe(expected)
    expect(fetcher.mock.calls[0][0]).toBe('http://localhost:8199/object_info')
  })

  it('answers unmanaged for an unreachable server and shares the failure briefly', async () => {
    fetcher.mockRejectedValue(new Error('offline'))
    expect(await comfyNodePackState('fixture', 'nodes')).toBe('unmanaged')
    expect(await comfyNodePackState('fixture', 'nodes')).toBe('unmanaged')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('shares concurrent probes, expires after a minute and clears on source or address changes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    answer({ One: {}, Two: {} })
    expect(await Promise.all([comfyNodePackState('fixture', 'nodes'), comfyNodePackState('fixture', 'nodes')]))
      .toEqual(['installed', 'installed'])
    expect(fetcher).toHaveBeenCalledTimes(1)
    vi.setSystemTime(Date.now() + 60_001)
    answer({ One: {} })
    expect(await comfyNodePackState('fixture', 'nodes')).toBe('missing')
    expect(fetcher).toHaveBeenCalledTimes(2)
    await patch({ comfyUrl: 'http://localhost:8200' })
    answer({ One: {}, Two: {} })
    expect(await comfyNodePackState('fixture', 'nodes')).toBe('installed')
    await patch({ comfyUrl: 'http://localhost:8199' })
    expect(await comfyNodePackState('fixture', 'nodes')).toBe('installed')
    await patch({ comfySource: 'managed' })
    await patch({ comfySource: 'external' })
    expect(await comfyNodePackState('fixture', 'nodes')).toBe('installed')
    expect(fetcher).toHaveBeenCalledTimes(5)
  })

  it('never installs into managed ComfyUI while an external server is selected', async () => {
    answer({ One: {} })
    await expect(installComfyNodePack('fixture', 'nodes')).rejects.toMatchObject({ code: 'COMFY_NODE_PACK_UNMANAGED' })
    expect(fetcher).not.toHaveBeenCalled()
  })
})
