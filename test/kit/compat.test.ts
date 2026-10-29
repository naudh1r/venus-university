import { describe, expect, it } from 'vitest'
import { checkCompat, CORE_SURFACE, hookNamesOf, manifestHooks, type CoreSurface } from '@vx/modkit/host/shared'
import { HOOKS, KIT_APIS } from '@vx/modkit/shared'
import type { ModHooks } from '@vx/modkit/renderer'

/** The per-hook compatibility check: a manifest's list against the dispatcher table. */

const core: CoreSurface = {
  hooks: ['afterDmReply', 'prompts.dm', 'oldWay'],
  apis: ['renderer:useModOn'],
  deprecated: [{ name: 'oldWay', replacedBy: 'newWay', goesIn: '0.8.0' }],
  removed: [{ name: 'postShown', removedIn: '0.7.0', replacedBy: 'postVisible' }]
}

describe('checkCompat', () => {
  it('refuses a required backup export on a core that can only omit failed parts', () => {
    const required = ['main:requiredBackupPart']
    expect(checkCompat(required).status).toBe('loads')
    const older = { ...CORE_SURFACE, apis: KIT_APIS.filter(api => api !== 'main:requiredBackupPart') }
    expect(checkCompat(['main:backupPart'], undefined, older).status).toBe('loads')
    expect(checkCompat(required, undefined, older)).toMatchObject({
      status: 'needs-update', missing: [{ name: 'main:requiredBackupPart' }]
    })
  })

  it('loads a mod whose every hook and API is present', () => {
    expect(checkCompat(['afterDmReply', 'prompts.dm', 'renderer:useModOn'], undefined, core)).toEqual({
      status: 'loads',
      deprecated: []
    })
  })

  it('loads a mod on a deprecated hook, naming it', () => {
    const result = checkCompat(['oldWay'], undefined, core)
    expect(result.status).toBe('loads')
    if (result.status === 'loads') expect(result.deprecated.map((hook) => hook.name)).toEqual(['oldWay'])
  })

  it('needs an update for a removed hook, naming the hook and the release that dropped it', () => {
    const result = checkCompat(['afterDmReply', 'postShown'], undefined, core)
    expect(result.status).toBe('needs-update')
    if (result.status !== 'needs-update') return
    expect(result.missing).toEqual([{ name: 'postShown', removedIn: '0.7.0', replacedBy: 'postVisible' }])
    expect(result.message).toBe('needs an update: `postShown` no longer exists in core 0.7.0 (replaced by `postVisible`)')
  })

  it('needs an update for a name this core never had, with every missing name in the message', () => {
    const result = checkCompat(['fromTheFuture', 'postShown'], ['fromTheFuture'], core)
    expect(result.status).toBe('needs-update')
    if (result.status !== 'needs-update') return
    expect(result.missing.map((hook) => hook.name)).toEqual(['fromTheFuture', 'postShown'])
    expect(result.message).toMatch(/^needs an update: `fromTheFuture` is not in this core; `postShown` no longer exists/)
  })

  it('refuses a mod that registers a hook its manifest does not declare', () => {
    const result = checkCompat(['afterDmReply'], ['afterDmReply', 'prompts.dm'], core)
    expect(result).toEqual({
      status: 'refused',
      undeclared: ['prompts.dm'],
      message: 'registers `prompts.dm` but does not declare it: the build and the manifest disagree'
    })
  })

  it("reads this build's table by default", () => {
    expect(CORE_SURFACE.hooks).toEqual(HOOKS.map((hook) => hook.name))
    expect(CORE_SURFACE.apis).toBe(KIT_APIS)
    expect(checkCompat(['afterDmReply', 'renderer:registerHooks']).status).toBe('loads')
    expect(checkCompat(['afterDmReply', 'nothing']).status).toBe('needs-update')
  })
})

describe('hookNamesOf', () => {
  it('spells a registration the way a manifest does, prompts and requests per spot', () => {
    const hooks: ModHooks = {
      afterDmReply: () => {},
      prompts: { dm: { lines: () => [] }, character: undefined },
      requests: { 'slot-intro': (request) => request },
      statFloor: undefined
    }
    expect(hookNamesOf(hooks).sort()).toEqual(['afterDmReply', 'prompts.dm', 'requests.slot-intro'])
  })

  it('gives exactly the renderer rows of the table for a registration that sets every hook', () => {
    const probe: Record<string, unknown> = {}
    for (const row of HOOKS) {
      const [key, spot] = row.name.split('.')
      if (spot) probe[key] = { ...(probe[key] as object | undefined), [spot]: true }
      else probe[key] = true
    }
    expect(hookNamesOf(probe).sort()).toEqual(HOOKS.map((hook) => hook.name).sort())
  })
})

describe('manifestHooks', () => {
  it('takes a list of distinct trimmed names and nothing else', () => {
    expect(manifestHooks(['afterDmReply', 'prompts.dm'])).toEqual(['afterDmReply', 'prompts.dm'])
    expect(manifestHooks([])).toEqual([])
    expect(manifestHooks(undefined)).toBeNull()
    expect(manifestHooks('afterDmReply')).toBeNull()
    expect(manifestHooks(['afterDmReply', 'afterDmReply'])).toBeNull()
    expect(manifestHooks([' afterDmReply'])).toBeNull()
    expect(manifestHooks([''])).toBeNull()
    expect(manifestHooks([1])).toBeNull()
  })
})
