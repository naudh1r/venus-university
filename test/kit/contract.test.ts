import { globSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import * as sharedKit from '@vx/modkit/shared'
import * as mainKit from '@vx/modkit/main'
import * as hostShared from '@vx/modkit/host/shared'
import { HOOKS, KIT_APIS, KIT_VERSION, type HookRow, type StructuredRequest } from '@vx/modkit/shared'
import type { ModHooks, PromptSpot, RequestSpots } from '@vx/modkit/renderer'
import { stubApi } from '../fixtures'
import { stripComments } from './boundaryScan'

/**
 * The kit's contract: each entry point exports exactly what `KIT_APIS` lists; every hook in the
 * table fires, registered through the kit and asked through core's own path, for a mod that is
 * on and not for one that is off; and every hook is asked somewhere in the game, so none is left
 * present but inert.
 */

stubApi({ jobs: { onProgress: () => () => {} } })
// The window's entries load the stores, which read the bridge stubbed above, so they load after it.
const rendererKit = await import('@vx/modkit/renderer')
const hostRenderer = await import('@vx/modkit/host/renderer')
const hooksShim = await import('../../src/renderer/mods/hooks')
const slotShim = await import('../../src/renderer/mods/ModSlot')
const saveFieldKit = await import('../../packages/modkit/src/renderer/saveField')
const modStateKit = await import('../../packages/modkit/src/renderer/modState')

const ROOT = resolve(__dirname, '../..')

const runtime = (module: object): string[] => Object.keys(module).filter((name) => name !== 'default').sort()
const listed = (side: string): string[] =>
  KIT_APIS.filter((api) => api.startsWith(`${side}:`)).map((api) => api.slice(side.length + 1)).sort()

describe('the entry points', () => {
  it('export exactly what KIT_APIS lists, side by side', () => {
    expect(runtime(sharedKit)).toEqual(listed('shared'))
    expect(runtime(rendererKit)).toEqual(listed('renderer'))
    expect(runtime(mainKit)).toEqual(listed('main'))
  })

  it('keep the host side to themselves', () => {
    expect(runtime(hostShared).filter((name) => name in sharedKit)).toEqual([])
    expect(runtime(hostRenderer).filter((name) => name in rendererKit)).toEqual([])
  })

  it('shares the native modal dismissal stack instead of creating a second one for mods', async () => {
    const native = await import('../../src/renderer/components/useModalShell')
    expect(rendererKit.useModalShell).toBe(native.useModalShell)
    expect(rendererKit.useDismissLayer).toBe(native.useDismissLayer)
  })

  it('split every runtime export of hooks.ts, ModSlot, saveField.ts and modState.ts between the host and the mod', () => {
    const moved = [...runtime(hooksShim), ...runtime(slotShim), ...runtime(saveFieldKit), ...runtime(modStateKit)].sort()
    const host = runtime(hostRenderer)
    const mod = runtime(rendererKit).filter((name) => moved.includes(name))
    expect([...host, ...mod].sort()).toEqual(moved)
  })

  it('record the version package.json says', () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, 'packages/modkit/package.json'), 'utf8')) as { version: string }
    expect(KIT_VERSION).toBe(pkg.version)
  })
})

type Host = typeof hooksShim
type RendererHook = Extract<(typeof HOOKS)[number], { side: 'renderer' }>['name']

/** One mod's registration of one hook, and the way the game asks it. */
interface Probe {
  hooks: ModHooks
  /** Asks through core's path; true where the probe was asked (or answered). */
  ask: (host: Host) => boolean | Promise<boolean>
}

/** A flag the probe raises when asked, read and lowered by the ask. */
function flag(): { hit: () => void; take: () => boolean } {
  let asked = false
  return {
    hit: () => void (asked = true),
    take: () => {
      const was = asked
      asked = false
      return was
    }
  }
}

const Comp = (): null => null
const never = {} as never
const post = { id: 'p1', text: 'hi', date: 1, time: 0 as const, likes: 0 }
const offer = (owner: string) => ({ owner, id: 'game', label: 'Train', location: 'gym', stat: 'body' as const })

/** A hook that is a function: the probe raises its flag and answers `value`. */
function fn<K extends keyof ModHooks>(key: K, value: unknown, ask: (host: Host) => unknown | Promise<unknown>) {
  return (): Probe => {
    const f = flag()
    return {
      hooks: { [key]: () => (f.hit(), value) } as ModHooks,
      ask: async (host) => {
        await ask(host)
        return f.take()
      }
    }
  }
}

/** A hook that is a thing the game picks up: asked where the dispatcher hands it back under the probe's id. */
function thing<K extends keyof ModHooks>(key: K, value: ModHooks[K], ask: (host: Host, id: string) => boolean) {
  return (id: string): Probe => ({ hooks: { [key]: value } as ModHooks, ask: (host) => ask(host, id) })
}

const prompt = (spot: PromptSpot) => (): Probe => {
  const f = flag()
  return {
    hooks: { prompts: { [spot]: { lines: () => (f.hit(), ['probe']), fields: () => ({ probe: {} }), required: () => ['probe'] } } },
    ask: (host) => {
      const lines = host.promptLines(spot, never)
      const fields = host.promptFields(spot)
      const required = host.promptRequired(spot)
      return f.take() && lines.includes('probe') && 'probe' in fields && required.includes('probe')
    }
  }
}

const request = (spot: keyof RequestSpots) => (): Probe => {
  const f = flag()
  return {
    hooks: { requests: { [spot]: (req: StructuredRequest) => (f.hit(), req) } },
    ask: (host) => {
      host.modRequest(spot, never, never)
      return f.take()
    }
  }
}

const slot = (name: keyof ModHooks) => thing(name, Comp as never, (host, id) => host.screenSlot(name as never).some((one) => one.modId === id))

const PROBES: Record<RendererHook, (id: string) => Probe> = {
  'prompts.scene': prompt('scene'),
  'prompts.dm': prompt('dm'),
  'prompts.slot-posts': prompt('slot-posts'),
  'prompts.slot-poster': prompt('slot-poster'),
  'prompts.slot-reach-outs': prompt('slot-reach-outs'),
  'prompts.text-ledger': prompt('text-ledger'),
  'prompts.character': prompt('character'),
  'requests.scene': request('scene'),
  'requests.dm': request('dm'),
  'requests.ledger': request('ledger'),
  'requests.slot-intro': request('slot-intro'),
  dmHistoryNote: fn('dmHistoryNote', ' note', (host) => host.dmHistoryNotes(never)),
  characterFromDraft: fn('characterFromDraft', {}, (host) => host.characterFromDraft({}, { baseAppearance: [] })),
  afterDmReply: fn('afterDmReply', undefined, (host) => host.afterDmReply({ charId: 'c', character: never, reply: never })),
  afterSceneReply: fn('afterSceneReply', undefined, (host) => host.afterSceneReply({ reply: {}, cast: [], solo: true, ending: false })),
  afterReachOut: fn('afterReachOut', undefined, (host) => host.afterReachOut({ charId: 'c', character: never, reply: {} })),
  playerActs: fn('playerActs', undefined, (host) => host.playerActs()),
  gameEntered: fn('gameEntered', undefined, (host) => host.gameEntered()),
  slotSettled: fn('slotSettled', undefined, (host) => host.slotSettled(never)),
  slotStatusLines: fn('slotStatusLines', [], (host) => host.slotStatusLines({ nextSlot: 1 })),
  projectSlotMemories: fn('projectSlotMemories', {}, (host) => host.projectSlotMemories(never, {})),
  exercisedStats: fn('exercisedStats', undefined, (host) => host.exercisedStats(undefined, never)),
  settleSceneStats: fn('settleSceneStats', { deltas: never, lines: [] }, (host) => host.settleSceneStats({ deltas: never, lines: [] }, never)),
  statFloor: fn('statFloor', 1, (host) => host.statFloor('body')),
  statActivities: (id) => {
    const f = flag()
    return {
      hooks: { statActivities: (stat) => (f.hit(), [{ ...offer(id), stat }]), slotActivityAvailable: () => true },
      ask: (host) => host.statActivities('body').some((one) => one.owner === id) && f.take()
    }
  },
  slotActivityAvailable: (id) => {
    const f = flag()
    return {
      hooks: { slotActivityAvailable: () => (f.hit(), true) },
      ask: (host) => host.slotActivityAvailable(offer(id)) && f.take()
    }
  },
  saveNote: fn('saveNote', 'kept', (host) => host.saveNotes({})),
  fileFeedPost: fn('fileFeedPost', undefined, (host) => host.fileFeedPost({ charId: 'c', post, reply: {}, held: false, featured: false }, { nudge: () => {} })),
  postLikes: fn('postLikes', 3, (host) => host.postLikes({ kind: 'stranger', author: 'a', friends: 0 }, () => 0)),
  postVisible: fn('postVisible', true, (host) => host.postVisible(post)),
  postOutAt: fn('postOutAt', 5, (host) => host.postOutAt(post)),
  postComments: () => {
    const f = flag()
    return {
      hooks: { postComments: { View: Comp, claims: () => (f.hit(), false) } },
      // `claims` is asked of every mod that draws comments, on or off, so another mod leaves its comments out.
      ask: (host) => {
        host.ownedComments([{ id: 'c1', author: 'a', text: 't', date: 1 } as never], 'someone-else')
        return f.take()
      }
    }
  },
  postPicture: thing('postPicture', Comp, (host) => host.postPicture() === Comp),
  emojiTool: thing('emojiTool', Comp, (host) => host.emojiTool() === Comp),
  sentText: thing('sentText', { Text: Comp }, (host) => host.sentText()?.Text === Comp),
  endingChoice: fn('endingChoice', { label: 'On', prepare: async () => null }, (host) => host.endingChoice({ reason: never, playthroughId: null })),
  saveChoice: fn('saveChoice', { title: 'T', message: 'M', label: 'L', prepare: async () => null }, (host) => host.saveChoice({ playthroughId: 'p', save: never })),
  modDetail: fn('modDetail', Comp, (host) => host.modDetail(never)),
  // Asked by the mod's own id, on or off, so a player sees the preview before switching the mod on.
  optionPreviews: thing('optionPreviews', { group: Comp }, (host, id) => host.optionPreview(id, 'group') === Comp),
  bunnyboardPage: (id) => thing('bunnyboardPage', { id, word: 'W', Mark: Comp, Page: Comp }, (host) => host.bunnyboardPages().some((page) => page.id === id))(id),
  updatesTab: (id) => thing('updatesTab', { id, word: 'W', Page: Comp }, (host) => host.updatesTabs().some((tab) => tab.id === id))(id),
  scenePlay: thing('scenePlay', { Seat: Comp, Panel: Comp }, (host, id) => host.scenePlays().some((one) => one.modId === id)),
  gameModals: (id) => thing('gameModals', { [id]: Comp }, (host) => host.gameModal(id) === Comp)(id),
  contactTab: (id) => thing('contactTab', { id, label: 'L', Panel: Comp }, (host) => host.contactTabs({ charId: 'c', isContact: true }).some((one) => one.modId === id))(id),
  editorField: thing('editorField', { read: () => null, write: () => ({}), Field: Comp }, (host, id) => host.editorFields().some((one) => one.modId === id)),
  settingsSection: slot('settingsSection'),
  portraitOverlay: slot('portraitOverlay'),
  phoneOverlay: slot('phoneOverlay'),
  conversationFoot: slot('conversationFoot'),
  mapOverlay: slot('mapOverlay'),
  photosPageSection: slot('photosPageSection'),
  editCharacterImages: slot('editCharacterImages'),
  stageLayer: slot('stageLayer'),
  panelLayer: slot('panelLayer'),
  messageAttachment: slot('messageAttachment'),
  contactPostExtra: slot('contactPostExtra'),
  railButton: slot('railButton'),
  landingTool: slot('landingTool'),
  gameMenuEntry: slot('gameMenuEntry')
}

describe('every hook in the table', () => {
  // One mod per row, on only while its row is asked; the registrations stay, as in the game.
  let on = ''
  hooksShim.setHookRules({ isOn: (id) => id === on, order: () => 0 })

  for (const row of HOOKS) {
    if (row.side !== 'renderer') continue
    const id = `probe:${row.name}`
    const askedWhenOff = (row as HookRow).askedWhenOff === true
    it(`${row.name}: registered through the kit, asked through the game's path${askedWhenOff ? ', on or off' : ' while on'}`, async () => {
      const probe = PROBES[row.name](id)
      rendererKit.registerHooks(id, probe.hooks)
      on = id
      expect(await probe.ask(hooksShim)).toBe(true)
      on = ''
      expect(await probe.ask(hooksShim)).toBe(askedWhenOff)
    })
  }

  it('is asked somewhere in the game, outside the kit', () => {
    const shims = ['src/renderer/mods/hooks.ts', 'src/renderer/mods/ModSlot.tsx']
    const sources = globSync(['src/**/*.ts', 'src/**/*.tsx'], { cwd: ROOT })
      .map((file) => file.split('\\').join('/'))
      .filter((file) => !shims.includes(file))
      .map((file) => readFileSync(resolve(ROOT, file), 'utf8'))
      .filter((source) => /from\s*['"][^'"]*(mods\/hooks|mods\/ModSlot|@vx\/modkit\/host\/renderer)['"]/.test(source))
      // The import statements go, so a dispatcher counts only where the file uses it: called, or handed on.
      .map((source) => stripComments(source).replace(/^import\s[\s\S]*?from\s*['"][^'"]+['"]/gm, ''))
    const silent = HOOKS.filter((row) => row.side === 'renderer').filter((row) => {
      // A place on screen is asked by name where a screen mounts the slot; anything else by its dispatchers.
      if (row.kind === 'slot') return !sources.some((source) => new RegExp(`['"]${row.name}['"]`).test(source))
      return !row.dispatch.every((name) => sources.some((source) => new RegExp(`\\b${name}\\b`).test(source)))
    })
    expect(silent.map((row) => row.name)).toEqual([])
  })
})
