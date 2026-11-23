import { afterEach, describe, expect, it } from 'vitest'
import {
  registerComfyNodePack, registeredNodePack, registeredNodePacks, type ComfyNodePack
} from '../src/main/services/comfyNodePacks'
import { groupMissingNodes } from '../src/shared/comfyModels'

const pack: ComfyNodePack = {
  id: 'fixture-pack',
  label: 'Fixture nodes',
  owner: 'fixture-owner',
  repo: 'ComfyUI-Fixture',
  dirName: 'ComfyUI-Fixture',
  sha: '0123456789abcdef0123456789abcdef01234567',
  bytes: 4096,
  sha256: 'AB'.repeat(32),
  modules: ['fixture_dep'],
  classes: ['FixtureNode']
}
const disposers: (() => void)[] = []
function register(...args: Parameters<typeof registerComfyNodePack>): () => void {
  const dispose = registerComfyNodePack(...args)
  disposers.push(dispose)
  return dispose
}
afterEach(() => { disposers.splice(0).forEach(dispose => dispose()) })

describe('mod ComfyUI node packs', () => {
  it('keeps a frozen copy the caller cannot change afterwards', () => {
    const own = { ...pack, modules: [...pack.modules] }
    register('fixture', own)
    own.modules.push('later')
    const kept = registeredNodePack('fixture', 'fixture-pack')
    expect(kept).toEqual({ ...pack, modId: 'fixture' })
    expect(Object.isFrozen(kept) && Object.isFrozen(kept.modules)).toBe(true)
  })

  it.each<[string, Partial<ComfyNodePack>]>([
    ['camel id', { id: 'fixturePack' }],
    ['branch for a commit', { sha: 'main' }],
    ['upper-case commit', { sha: pack.sha.toUpperCase() }],
    ['short archive hash', { sha256: 'ab'.repeat(31) }],
    ['zero bytes', { bytes: 0 }],
    ['fractional bytes', { bytes: 1.5 }],
    ['folder escaping custom_nodes', { dirName: '..' }],
    ['folder with a separator', { dirName: 'a/b' }],
    ['repo with a separator', { repo: 'a\\b' }],
    ['dotted module', { modules: ['a.b'] }],
    ['repeated module', { modules: ['a', 'a'] }],
    ['no classes', { classes: [] }],
    ['blank label', { label: ' ' }]
  ])('refuses a %s', (_, change) => {
    expect(() => register('fixture', { ...pack, ...change }))
      .toThrowError(expect.objectContaining({ code: 'COMFY_NODE_PACK_INVALID' }))
    expect(registeredNodePacks()).toEqual([])
  })

  it('refuses a repeated id and a folder core or another mod already uses, in any case', () => {
    register('fixture', pack)
    for (const [modId, change] of [
      ['fixture', { dirName: 'Other' }],
      ['other', { id: 'other' }],
      ['other', { id: 'other', dirName: 'comfyui-fixture' }],
      ['other', { id: 'other', dirName: 'comfyui-impact-pack' }]
    ] as const) {
      expect(() => register(modId, { ...pack, ...change }))
        .toThrowError(expect.objectContaining({ code: 'COMFY_NODE_PACK_DUPLICATE' }))
    }
    register('other', { ...pack, dirName: 'Other' })
    expect(registeredNodePacks().map(entry => entry.modId)).toEqual(['fixture', 'other'])
  })

  it('names a mod pack missing classes under its repo, and forgets it once disposed', () => {
    const dispose = register('fixture', pack)
    expect(groupMissingNodes(['FixtureNode', 'Unknown'], registeredNodePacks()))
      .toEqual([{ pack: 'ComfyUI-Fixture', classes: ['FixtureNode'] }, { pack: null, classes: ['Unknown'] }])
    dispose()
    dispose()
    expect(registeredNodePacks()).toEqual([])
    expect(() => registeredNodePack('fixture', 'fixture-pack'))
      .toThrowError(expect.objectContaining({ code: 'COMFY_NODE_PACK_UNKNOWN' }))
    register('fixture', pack)
  })
})
