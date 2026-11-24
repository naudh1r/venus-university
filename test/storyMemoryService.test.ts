import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { formatStoryRecall, type StoryRecallRequest } from '@shared/storyMemory'
import type { ModSwitches } from '@shared/mods'
import { inspectStoryMemory, prepareStoryRequest } from '../src/main/services/storyMemoryService'
import { inspectStoryMemory as webRecall, prepareStoryRequest as prepareWebStoryRequest } from '../src/web/storyMemory'

const env = vi.hoisted(() => ({ root: '', switches: { on: {}, options: {} } as ModSwitches }))
vi.mock('../src/main/paths', () => ({ getPlaythroughPath: (id: string) => join(env.root, id) }))
vi.mock('../src/main/services/modsService', async () => {
  const { modOn, optionOn } = await import('../src/shared/mods')
  return {
    getModSwitches: async () => env.switches,
    modIsOn: async (id: string) => modOn(env.switches, id),
    modOptionOn: (id: string, option: string) => optionOn(env.switches, id, option)
  }
})
vi.mock('../src/web/mods', () => ({ readModSwitches: () => env.switches }))
const p: StoryRecallRequest = {
  playthroughId: '123',
  date: 3,
  time: 0,
  cast: ['a'],
  query: 'atlas',
  names: { reader: 'The reader', a: 'Sarah' },
  records: [
    {
      id: 'encounter:1:0',
      kind: 'encounter',
      subject: 'reader',
      subjects: ['a'],
      text: 'Sarah borrowed an atlas.',
      date: 1,
      time: 0,
      knownBy: [],
      public: false,
      timeline: 'unspecified',
      certainty: 'event',
      claimant: null,
      evidence: '',
      source: 'Saved summary',
      supersedes: []
    }
  ]
}
beforeEach(() => {
  env.root = mkdtempSync(join(tmpdir(), 'vu-memory-service-'))
  env.switches = { on: {}, options: {} }
  mkdirSync(join(env.root, '123'))
})
afterEach(() => {
  const path = resolve(env.root)
  if (dirname(path) !== resolve(tmpdir()) || !path.includes('vu-memory-service-'))
    throw Error('Invalid test cleanup path')
  rmSync(path, { recursive: true })
  vi.restoreAllMocks()
})
it('creates a real per-playthrough SQLite cache with desktop/browser recall parity', async () => {
  const native = await inspectStoryMemory(p)
  expect(native.engine).toBe('SQLite')
  expect(existsSync(join(env.root, '123', 'story-memory.sqlite'))).toBe(true)
  expect(native.text).toBe(webRecall(p).text)
  expect(webRecall(p).engine).toBe('Save snapshot')
})
it('does not index or send extra context with the switch off, even on an old captured request', async () => {
  env.switches.on['story-memory'] = false
  expect((await inspectStoryMemory(p)).text).toBe('')
  expect(existsSync(join(env.root, '123', 'story-memory.sqlite'))).toBe(false)
  const request = {
    system: 'rules',
    user: 'action',
    schema: { name: 'scene', schema: {} },
    storyMemory: p
  }
  expect(await prepareStoryRequest(request)).toEqual({
    system: 'rules',
    user: 'action',
    schema: request.schema
  })
  expect(webRecall(p).text).toBe('')
})
it('falls back for corrupt/unavailable indexes without overwriting them or recreating a deleted game', async () => {
  const file = join(env.root, '123', 'story-memory.sqlite')
  writeFileSync(file, 'corrupt test data')
  const fallback = await inspectStoryMemory(p)
  expect(fallback.engine).toBe('Save snapshot')
  expect(fallback.warning).toBeTruthy()
  expect(fallback.text).toBe(formatStoryRecall(p).text)
  const gone = { ...p, playthroughId: '456' }
  expect((await inspectStoryMemory(gone)).engine).toBe('Save snapshot')
  expect(existsSync(join(env.root, '456'))).toBe(false)
})
it('strips local payloads before generation and skips malformed optional data safely', async () => {
  const request = {
    system: 'rules',
    user: 'action',
    schema: { name: 'scene', schema: {} },
    storyMemory: p
  }
  const clean = await prepareStoryRequest(request)
  expect(clean).not.toHaveProperty('storyMemory')
  expect(clean.user).toContain('Sarah borrowed an atlas.')
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const malformed = await prepareStoryRequest({
    ...request,
    storyMemory: { ...p, playthroughId: '../private' }
  })
  expect(malformed.user).toBe('action')
  expect(malformed).not.toHaveProperty('storyMemory')
  expect(warning.mock.calls.flat().join(' ')).not.toContain('private')
})
it('honors the live Light toggle on desktop, browser and fallback without changing its snapshot', async () => {
  const before = JSON.stringify(p)
  const standard = (await inspectStoryMemory(p)).text
  env.switches.options['story-memory:light-memory'] = true
  const light = await inspectStoryMemory(p)
  expect(light.text).toBe(formatStoryRecall({ ...p, mode: 'light' }).text)
  expect(light.text).toBe(webRecall(p).text)
  expect(light.text).not.toBe(standard)
  writeFileSync(join(env.root, '123', 'story-memory.sqlite'), 'corrupt test data')
  expect((await inspectStoryMemory(p)).text).toBe(light.text)
  env.switches.options['story-memory:light-memory'] = false
  expect((await inspectStoryMemory({ ...p, mode: 'light' })).text).toBe(standard)
  expect(webRecall({ ...p, mode: 'light' }).text).toBe(standard)
  expect(JSON.stringify(p)).toBe(before)
  env.switches.options['story-memory:light-memory'] = true
  env.switches.on['story-memory'] = false
  expect((await inspectStoryMemory(p)).text).toBe('')
  expect(webRecall(p).text).toBe('')
})

it('applies native coverage equally on desktop and web without leaking metadata or losing the next request\'s recall', async () => {
  const covered = { ...p, coveredEncounters: ['encounter:1:0'] }
  const request = { system: 'rules', user: 'Native context already carries the dated atlas recap.',
    schema: { name: 'scene', schema: {} }, storyMemory: covered }
  for (const light of [false, true]) {
    env.switches.options['story-memory:light-memory'] = light
    const native = await prepareStoryRequest(request)
    expect(native).toEqual(await prepareWebStoryRequest(request))
    expect(native.user).toBe(request.user)
    expect(native).not.toHaveProperty('storyMemory')
    expect(JSON.stringify(native)).not.toContain('coveredEncounters')
    expect((await inspectStoryMemory(p)).included).toContain('encounter:1:0')
    writeFileSync(join(env.root, '123', 'story-memory.sqlite'), 'corrupt test data')
    expect(await prepareStoryRequest(request)).toEqual(native)
  }
})

it('retains native-covered recaps when a later prompt preset may remove the native context', async () => {
  const covered = { ...p, coveredEncounters: ['encounter:1:0'] }
  const request = { system: 'rules', user: 'LOREBOOK\nNative dated recap.\nYOUR TURN\nTalk.',
    schema: { name: 'scene', schema: {} }, storyMemory: covered,
    preset: { spot: 'opening' as const, playthroughId: '123', vars: {}, names: { user: 'Sam', char: 'Sarah', group: 'Sarah' } } }
  const before = JSON.stringify(request)
  for (const light of [false, true]) {
    env.switches.options['story-memory:light-memory'] = light
    const native = await prepareStoryRequest(request)
    expect(native.user).toContain('Sarah borrowed an atlas.')
    expect(native).toEqual(await prepareWebStoryRequest(request))
    expect(native).not.toHaveProperty('storyMemory')
    expect(native).toHaveProperty('preset', request.preset)
    expect(JSON.stringify(native)).not.toContain('coveredEncounters')
    writeFileSync(join(env.root, '123', 'story-memory.sqlite'), 'corrupt test data')
    expect(await prepareStoryRequest(request)).toEqual(native)
    const { preset: _preset, ...withoutPreset } = request
    expect((await prepareStoryRequest(withoutPreset)).user).toBe(request.user)
  }
  expect(JSON.stringify(request)).toBe(before)
  env.switches.on['story-memory'] = false
  expect((await prepareStoryRequest(request)).user).toBe(request.user)
  expect((await prepareWebStoryRequest(request)).user).toBe(request.user)
})
