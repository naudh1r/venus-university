import { mkdtemp, readFile, readdir, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { COMFY_MODEL_SLOTS } from '@shared/comfyModels'
import type { Character } from '@shared/types'
import { character } from './fixtures'

let root = ''
vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => process.cwd(), getPath: () => root }
}))
vi.mock('../src/main/photoProtocol', () => ({
  getPhotoPath: (_save: string, _char: string, file: string) => join(root, file),
  getPhotosPath: () => root,
  getPhotosRoot: () => root
}))
// A prompt-only copy without her LoRA makes using her stored record observable.
vi.mock('../src/main/bodySetting', () => ({
  withBodySetting: async (stored: Character) => ({ ...stored, lora: undefined })
}))
vi.mock('../src/main/services/comfyService', async original => {
  const actual = await original<typeof import('../src/main/services/comfyService')>()
  return {
    ...actual,
    runGenerationJob: vi.fn((spec, options) => actual.runGenerationJob(spec, {
      ...options,
      target: { source: 'external', baseUrl: 'http://photo.test', picks: { lora: 'usnrStyle.safetensors' }, loraWeight: 1 }
    }))
  }
})

import { runGenerationJob } from '../src/main/services/comfyService'
import { generateDuoPhoto, generatePhoto } from '../src/main/services/localPhotoService'

type Graph = Record<string, {
  class_type: string
  _meta: { title: string }
  inputs: Record<string, unknown>
}>
const workflows = resolve('assets/workflows')
const graphOf = async (file: string): Promise<Graph> =>
  JSON.parse(await readFile(join(workflows, file), 'utf-8'))
let submitted: Graph

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'venus-photo-lora-'))
  vi.clearAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  const listing: Record<string, { input: { required: Record<string, [string[]]> } }> = {}
  for (const file of await readdir(workflows)) {
    if (!file.endsWith('.json')) continue
    for (const node of Object.values(await graphOf(file))) {
      listing[node.class_type] ??= { input: { required: {} } }
    }
  }
  for (const slot of COMFY_MODEL_SLOTS) {
    const inputs = listing[slot.nodeClass].input.required
    inputs[slot.input] ??= [[]]
    inputs[slot.input][0].push(slot.shipped)
  }
  listing.LoraLoader.input.required.lora_name[0].push('her.safetensors')
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/object_info')) return Response.json(listing)
    if (url.endsWith('/prompt')) {
      submitted = JSON.parse(init!.body as string).prompt
      return Response.json({ prompt_id: 'photo' })
    }
    if (url.endsWith('/history/photo')) return Response.json({ photo: {
      status: { completed: true, status_str: 'success' },
      outputs: { '41': { images: [{ filename: 'photo.png', subfolder: '', type: 'output' }] } }
    } })
    if (url.includes('/view?')) return new Response(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]))
    throw new Error(`Unexpected request: ${url}`)
  }))
})

afterEach(async () => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  await rm(root, { recursive: true, force: true })
})

it('chains the solo character LoRA after the style LoRA for every model and clip consumer', async () => {
  const graph = await graphOf('characterPhoto.json')
  expect(graph['100']).toEqual({
    class_type: 'LoraLoader',
    _meta: { title: 'Character LoRA' },
    inputs: {
      model: ['3', 0], clip: ['3', 1], lora_name: 'characterLora.safetensors',
      strength_model: 1, strength_clip: 1
    }
  })
  const readers = Object.entries(graph).filter(([, node]) =>
    Object.values(node.inputs).some(value => Array.isArray(value) && value[0] === '3')
  ).map(([id]) => id)
  expect(readers).toEqual(['100'])
  for (const [id, input, output] of [
    ['4', 'clip', 1], ['5', 'clip', 1], ['7', 'model', 0],
    ['20', 'model', 0], ['20', 'clip', 1]
  ] as const) expect(graph[id].inputs[input]).toEqual(['100', output])
})

it.each([undefined, { name: 'her.safetensors', weight: 0.65 }])(
  'renders a solo photo with her stored LoRA %j, bypassing the loader when absent', async lora => {
    const her = character({ lora })
    await generatePhoto('100', her, 'everyday', 'sitting on the grass', 'sarah_chat_001.png')
    const spec = vi.mocked(runGenerationJob).mock.calls[0][0]
    expect(spec.nodes.characterLora).toBe('100')
    expect(spec.lora).toEqual(lora ?? null)
    if (lora) {
      expect(submitted['100'].inputs).toEqual({
        model: ['3', 0], clip: ['3', 1], lora_name: lora.name,
        strength_model: lora.weight, strength_clip: lora.weight
      })
      expect(spec.logContext).toContain(', lora=her.safetensors@0.65')
    } else {
      expect(submitted).not.toHaveProperty('100')
      expect(spec.logContext).not.toContain('lora=')
    }
    for (const [id, input, output] of [
      ['4', 'clip', 1], ['5', 'clip', 1], ['7', 'model', 0],
      ['20', 'model', 0], ['20', 'clip', 1]
    ] as const) expect(submitted[id].inputs[input]).toEqual([lora ? '100' : '3', output])
  }
)

it('sends neither a character LoRA nor its node map for a duo photo, even when both girls have one', async () => {
  const lora = { name: 'her.safetensors', weight: 0.65 }
  await generateDuoPhoto('100', character({ lora }), character({ charId: 'friend-1', lora }),
    'everyday', 'sitting on the grass', 'sarah_chat_001.png')
  const spec = vi.mocked(runGenerationJob).mock.calls[0][0]
  expect(spec).not.toHaveProperty('lora')
  expect(spec.nodes).not.toHaveProperty('characterLora')
  expect(submitted).not.toHaveProperty('100')
  expect(Object.values(submitted).filter(node => node.class_type === 'LoraLoader'))
    .toEqual([submitted['3']])
})
