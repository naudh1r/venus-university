import { mkdtemp, mkdir, readdir, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { enqueue } from '@shared/jobQueue'
import { renderComfyImage, type ComfyRenderRequest } from '../src/main/services/comfyService'

const fixture = vi.hoisted(() => ({ root: '', settings: vi.fn(), fetch: vi.fn() }))
vi.mock('../src/main/paths', () => ({
  getTempPath: () => join(fixture.root, 'scratch'),
  getWorkflowsPath: () => join(fixture.root, 'workflows')
}))
vi.mock('../src/main/services/settingsService', () => ({ getSettings: fixture.settings }))
vi.mock('../src/main/services/assetService', () => ({ getPoseTags: vi.fn() }))
vi.mock('../src/main/services/characterService', () => ({ assertSafeCharId: vi.fn() }))
vi.mock('../src/main/services/profileService', () => ({ tryCutProfile: vi.fn() }))

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
const request: ComfyRenderRequest = {
  workflow: {
    '1': { class_type: 'PreviewImage', inputs: {} },
    '2': { class_type: 'CLIPTextEncode', inputs: { text: 'old' } },
    '3': { class_type: 'KSampler', inputs: { seed: 1 } },
    '4': { class_type: 'CLIPTextEncode', inputs: { text: 'old' } }
  },
  nodes: { saveImage: '1', positivePrompt: '2', seed: '3' },
  prompts: { positive: 'portrait', negative: '' }, seed: 42, texts: { '4': 'friend' }
}
let submitted: ComfyRenderRequest['workflow'][]
let view: () => Response
let history: () => Response
beforeAll(async () => {
  fixture.root = await mkdtemp(join(tmpdir(), 'mod-comfy-'))
  await mkdir(join(fixture.root, 'workflows'))
  await mkdir(join(fixture.root, 'scratch'))
})
afterAll(async () => { await rm(fixture.root, { recursive: true, force: true }) })
beforeEach(() => {
  submitted = []
  fixture.settings.mockClear().mockResolvedValue({ comfySource: 'external', comfyUrl: 'http://localhost:8188' })
  view = () => new Response(png)
  history = () => Response.json({ render: { status: { completed: true }, outputs: {
    '1': { images: [{ filename: 'render.png', subfolder: '', type: 'temp' }] }
  } } })
  fixture.fetch.mockReset().mockImplementation(async (url: string, options?: RequestInit) => {
    const path = new URL(url).pathname
    if (path === '/object_info' || path === '/system_stats') return Response.json({})
    if (path === '/prompt') {
      submitted.push(JSON.parse(options!.body as string).prompt)
      return Response.json({ prompt_id: 'render' })
    }
    if (path.startsWith('/history/')) return history()
    if (path === '/view') return view()
    if (path === '/queue' || path === '/interrupt') return Response.json({})
    throw Error(`Unexpected request: ${path}`)
  })
  vi.stubGlobal('fetch', fixture.fetch)
})
afterEach(async () => {
  vi.unstubAllGlobals()
  expect(await readdir(join(fixture.root, 'scratch'))).toEqual([])
})

/** Runs the actual queue and graph pipeline against a mocked external ComfyUI. */
function render(signal = new AbortController().signal): Promise<Uint8Array> {
  return renderComfyImage('photo-feature', request, { signal })
}

describe('mod-owned ComfyUI renders', () => {
  it('returns image bytes, fills solo/extra prompt inputs, and leaves the graph unchanged', async () => {
    const original = structuredClone(request)
    for (const bytes of [png, new Uint8Array([255, 216, 255]),
      new TextEncoder().encode('RIFF0000WEBP')]) {
      view = () => new Response(bytes)
      expect(await render()).toEqual(bytes)
    }
    expect(submitted[0]['2'].inputs.text).toBe('portrait')
    expect(submitted[0]['3'].inputs.seed).toBe(42)
    expect(submitted[0]['4'].inputs.text).toBe('friend')
    expect(request).toEqual(original)
  })

  it('refuses oversized declared or streamed bodies and non-image bytes without retrying', async () => {
    for (const [code, response] of [
      ['RENDER_TOO_LARGE', () => new Response(png, { headers: { 'content-length': String(32 * 1024 * 1024 + 1) } })],
      ['RENDER_TOO_LARGE', () => new Response(new Uint8Array(32 * 1024 * 1024 + 1))],
      ['RENDER_NOT_IMAGE', () => new Response('not an image')]
    ] as const) {
      view = response
      const before = submitted.length
      await expect(render()).rejects.toMatchObject({ code })
      expect(submitted.length).toBe(before + 1)
      expect(await readdir(join(fixture.root, 'scratch'))).toEqual([])
    }
  })

  it('cancels before enqueueing and while queued without cancelling a sibling', async () => {
    const aborted = new AbortController(); aborted.abort()
    await expect(render(aborted.signal)).rejects.toMatchObject({ code: 'CANCELLED' })
    expect(fixture.settings).not.toHaveBeenCalled()
    let release!: () => void
    const blocker = enqueue({ group: 'fixture', run: () => new Promise<void>(resolve => { release = resolve }) })
    const controller = new AbortController()
    const pending = render(controller.signal)
    const rejection = expect(pending).rejects.toMatchObject({ code: 'CANCELLED' })
    // Target resolution finishes before the abort, leaving this render queued.
    await vi.waitFor(() => expect(fixture.settings).toHaveBeenCalledOnce())
    controller.abort()
    await rejection
    const sibling = render()
    release(); await blocker
    expect(await sibling).toEqual(png)
    expect(submitted).toHaveLength(1)
  })

  it('interrupts a running prompt on abort and cleans scratch before rejecting', async () => {
    const controller = new AbortController()
    history = () => { controller.abort(); return Response.json({}) }
    await expect(render(controller.signal)).rejects.toMatchObject({ code: 'CANCELLED' })
    expect(fixture.fetch.mock.calls.some(([url]) => new URL(url).pathname === '/interrupt')).toBe(true)
    expect(submitted).toHaveLength(1)
  })

  it('refuses a bad mod id and a non-graph before reading settings or queueing', async () => {
    await expect(renderComfyImage('../other', request, { signal: new AbortController().signal }))
      .rejects.toMatchObject({ code: 'MOD_ID_INVALID' })
    await expect(renderComfyImage('photo-feature', { ...request, workflow: 'path.json' as never },
      { signal: new AbortController().signal })).rejects.toMatchObject({ code: 'RENDER_REQUEST_INVALID' })
    expect(fixture.settings).not.toHaveBeenCalled()
    expect(submitted).toEqual([])
  })
})
