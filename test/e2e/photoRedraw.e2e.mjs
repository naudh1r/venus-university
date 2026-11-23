// Real Photo views, protocol and disk writes with only the Comfy render replaced by test pictures.
// Run after a build with xvfb-run -a node test/e2e/photoRedraw.e2e.mjs.
import { _electron } from 'playwright'
import { createServer } from 'vite'
import sharp from 'sharp'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const data = await mkdtemp(join(tmpdir(), 'photo-app-'))
const folder = join(data, 'saves/1/mod-data/photo-feature/a')
await mkdir(folder, { recursive: true })
const settings = { schemaVersion: 1, apiProvider: 'gemini', apiModel: 'gemini-3.8-flash', thinkingLevel: 'minimal', apiKey: 'e2e-not-a-key', comfyDeferred: true, noNsfwImages: true, lessNsfwText: true, sfwAsked: true, removedDefaults: [], checkUpdates: false, fullscreen: false }
await writeFile(join(data, 'settings.json'), JSON.stringify(settings))
await writeFile(join(data, 'mods.json'), JSON.stringify({ schemaVersion: 1, on: { 'photo-feature': true }, options: { 'photo-feature': { webp: false } } }))
const files = ['sarah_chat_001.png', 'sarah_bunnyboard_001.png']
const photo = file => ({ file, tier: 'everyday', scene: 'At the cafe' })
const snapshot = { bunnyboard: { conversations: { a: { charId: 'a', unread: 0, summary: null, messages: [{ id: 'reply', sender: 'contact', text: 'Here!', date: 0, time: 0, photo: photo(files[0]) }] } } }, charInfo: { a: { memories: [], flags: {}, nameKnown: true, year: 1, dorm: 'lowrise_1', major: 'Biology', schedule: {}, feed: [{ id: 'post', date: 0, time: 0, text: 'At the cafe', likes: 1, photo: photo(files[1]) }] } } }
await writeFile(join(data, 'saves/1/older.json'), JSON.stringify(snapshot))
const old = await sharp({ create: { width: 64, height: 96, channels: 3, background: '#c04040' } }).png().toBuffer()
for (const file of files) {
  await writeFile(join(folder, file), old)
  await writeFile(join(folder, file.replace('.png', '.json')), JSON.stringify({ schemaVersion: 1, seed: 1, tier: 'everyday', positive: 'old', negative: '' }))
}
let generation = 0
const harness = `
import React from 'react'
import { createRoot } from 'react-dom/client'
import { useGameStore } from '/stores/gameStore.ts'
import { useSettingsStore } from '/stores/settingsStore.ts'
import { useSetupStore } from '/stores/setupStore.ts'
import { useModsStore } from '/stores/modsStore.ts'
import { withMod, withOption } from '@shared/mods'
import { bindPhotoOptionReader } from '@shared/photoSwitches'
import { modOptionOn } from '@vx/modkit/renderer'
import { MessagePhoto, PostPhoto, PhotoLightboxHost, openShot } from '/components/PhotoBubble.tsx'
import { GalleryPanel } from '/views/ContactGallery.tsx'
import { redrawMessagePhoto } from '/stores/photoTurn.ts'
import { redrawPostPhoto } from '/stores/photoPost.ts'
import { photoInvoke } from '/stores/photoInvoke.ts'
import { photoUrl } from '@shared/photoFiles'
const girl = { schemaVersion: 3, charId: 'a', firstName: 'Sarah', lastName: 'Rose', traits: [], baseAppearance: ['long_hair'], outfit: ['coat'], expressionTags: {}, generationSeed: 1, setSeeds: {}, seedFollowsMain: {} }
let snapshot
function Harness() {
  const dm = useGameStore(s => s.bunnyboard.conversations.a.messages[0].photo)
  const post = useGameStore(s => s.charInfo.a.feed[0].photo)
  return React.createElement(React.Fragment, null,
    React.createElement('div', { id: 'photo-test-dm' }, React.createElement(MessagePhoto, { charId: 'a', photo: dm, onOpen: openShot, onRedraw: options => redrawMessagePhoto('a', 'reply', options) })),
    React.createElement('div', { id: 'photo-test-post' }, React.createElement(PostPhoto, { charId: 'a', postId: 'post', photo: post })),
    React.createElement('div', { id: 'photo-test-gallery' }, React.createElement(GalleryPanel, { charId: 'a', isContact: true })),
    React.createElement(PhotoLightboxHost))
}
export function mount(saved) {
  snapshot = saved
  useGameStore.setState({ playthroughId: '1', chars: ['a'], characters: { a: girl }, ...structuredClone(saved) })
  useSettingsStore.setState({ settings: { ...useSettingsStore.getState().settings, comfyDeferred: false, noNsfwImages: true, lessNsfwText: true } })
  useSetupStore.setState({ status: { comfyReady: true } })
  let switches = withMod(useModsStore.getState().switches, 'photo-feature', true)
  switches = withOption(switches, 'photo-feature', 'photos', true)
  useModsStore.setState({ switches })
  bindPhotoOptionReader(option => modOptionOn('photo-feature', option))
  const host = document.createElement('div')
  host.id = 'photo-test-host'
  Object.assign(host.style, { position: 'absolute', inset: '0', zIndex: '100', background: '#eee', overflow: 'auto', padding: '25px', display: 'grid', gridTemplateColumns: '280px 280px 1fr' })
  document.getElementById('root').append(host)
  createRoot(host).render(React.createElement(Harness))
}
export async function redraw(kind) {
  if (kind === 'dm') await redrawMessagePhoto('a', 'reply', { orientation: 'wide', seed: 17 })
  else await redrawPostPhoto('a', 'post', { orientation: 'wide', seed: 18 })
}
export function loadOlder() { useGameStore.setState(structuredClone(snapshot)) }
export function open(kind) { openShot(photoUrl('1', 'a', kind === 'dm' ? '${files[0]}' : '${files[1]}')) }
export function closePicture() { openShot(null) }
export function sweep() { return photoInvoke('sweep', ['1']) }
`
const server = await createServer({
  configFile: false, root: join(repo, 'src/renderer'),
  define: { __APP_VERSION__: JSON.stringify('photo-e2e') },
  resolve: { alias: {
    '@shared': join(repo, 'src/shared'),
    '@vx/modkit/host': join(repo, 'packages/modkit/src/host'),
    '@vx/modkit/shared': join(repo, 'packages/modkit/src/shared'),
    '@vx/modkit/renderer': join(repo, 'packages/modkit/src/renderer'),
    '@vx/modkit/main': join(repo, 'packages/modkit/src/main')
  } },
  server: { host: '127.0.0.1', port: 0, fs: { allow: [repo] } },
  esbuild: { jsx: 'automatic' },
  plugins: [{
    name: 'photo-test-render',
    resolveId(id) { if (id === '/__photo-harness__.js') return '\0photo-harness' },
    load(id) { if (id === '\0photo-harness') return harness },
    transform(_code, id) {
      if (id.endsWith('/stores/photoWebp.ts')) return `export async function renderPhoto(pid, character, tier, scene, file, friend, options) { const response = await fetch('/__photo-render', { method: 'POST', body: JSON.stringify({file, options}) }); if (!response.ok) throw new Error(await response.text()); return {ok:true,data:file} }`
    },
    configureServer(server) {
      server.middlewares.use('/__photo-render', async (request, response) => {
        try {
          let body = ''
          for await (const chunk of request) body += chunk
          const { file, options } = JSON.parse(body)
          assert.match(file, /^[a-z0-9]{10}\.(png|webp)$/)
          const bytes = await sharp({ create: { width: 96, height: 64, channels: 3, background: generation++ % 2 ? '#40b040' : '#4060d0' } }).png().toBuffer()
          await writeFile(join(folder, file.replace(/\.(png|webp)$/, '.png')), bytes)
          await writeFile(join(folder, file.replace(/\.(png|webp)$/, '.json')), JSON.stringify({ schemaVersion: 1, tier: 'everyday', seed: options.seed, positive: 'new prompt', negative: '', orientation: 'wide' }))
          response.end('ok')
        } catch (error) { response.statusCode = 500; response.end(String(error)) }
      })
    }
  }]
})
await server.listen()
const url = server.resolvedUrls.local[0]
let app
let page
let checks = 0
function check(name, condition) { assert.ok(condition, name); console.log('ok  ' + name); checks++ }
async function until(condition) {
  const deadline = Date.now() + 10000
  while (!await condition()) {
    assert.ok(Date.now() < deadline, 'background sweep did not finish')
    await new Promise(resolve => setTimeout(resolve, 50))
  }
}
async function launch(expectImages = true) {
  app = await _electron.launch({ args: ['--no-sandbox', repo], env: { ...process.env, VU_DATA_PATH: data, ELECTRON_RENDERER_URL: url } })
  page = await app.firstWindow()
  await page.waitForSelector('#menu-mods, #mods-notice, #app-error', { timeout: 60000 })
  for (let n = 0; n < 3 && await page.$('#app-error'); n++) await page.click('#app-error-dismiss')
  await page.evaluate(async snapshot => { const harness = await import('/__photo-harness__.js'); harness.mount(snapshot) }, snapshot)
  if (expectImages) await page.waitForFunction(() => [...document.querySelectorAll('#photo-test-host img')].length >= 4 && [...document.querySelectorAll('#photo-test-host img')].every(image => image.complete && image.naturalWidth))
}
async function currentImages(file) {
  return page.locator(`#photo-test-host img[src*="${file}"]`).evaluateAll(images => images.map(image => ({ src: image.src, width: image.naturalWidth, height: image.naturalHeight })))
}
try {
  await launch()
  const saveBefore = await readFile(join(data, 'saves/1/older.json'))
  for (const kind of ['dm', 'post']) {
    const file = files[kind === 'dm' ? 0 : 1]
    await page.evaluate(async kind => (await import('/__photo-harness__.js')).open(kind), kind)
    await page.waitForSelector('.vu-photo-lightbox img')
    await page.evaluate(async kind => (await import('/__photo-harness__.js')).redraw(kind), kind)
    await page.waitForFunction(file => [...document.querySelectorAll(`#photo-test-host img[src*="${file}"]`)].every(image => image.complete && image.naturalWidth === 96), file)
    const images = await currentImages(file)
    check(`${kind} and gallery immediately show the replacement`, images.length >= 2 && images.every(image => image.src.includes('?v=1') && image.width === 96))
    check(`${kind} lightbox refreshes while open`, await page.locator('.vu-photo-lightbox img').evaluate(image => image.src.includes('?v=1') && image.naturalWidth === 96))
    await page.evaluate(async () => (await import('/__photo-harness__.js')).closePicture())
    await page.waitForSelector('.vu-photo-lightbox', { state: 'detached' })
    await page.locator(`#photo-test-${kind} button[aria-label="Photo info"]`).evaluate(button => button.click())
    await page.waitForFunction(() => [...document.querySelectorAll('textarea')].some(area => area.value === 'new prompt'))
    check(`${kind} info reads the replacement sidecar`, true)
    await page.locator('.vu-photo-info button').filter({ hasText: /^Close$/ }).evaluate(button => button.click())
    await page.waitForSelector('.vu-photo-info', { state: 'detached' })
    check(`${kind} leaves one image and one sidecar`, (await readdir(folder)).filter(name => name.startsWith(file.replace('.png', ''))).length === 2)
  }
  check('redraws never write the saved photo records', saveBefore.equals(await readFile(join(data, 'saves/1/older.json'))))
  await page.evaluate(async () => (await import('/__photo-harness__.js')).loadOlder())
  check('older photo records still resolve to the replacement', (await currentImages(files[0])).every(image => image.width === 96))
  await writeFile(join(folder, 'zzzzzzzzzz.png'), old)
  await page.evaluate(async () => (await import('/__photo-harness__.js')).sweep())
  await until(async () => !(await readdir(folder)).includes('zzzzzzzzzz.png'))
  check('background load sweep removes an unnamed stray', !(await readdir(folder)).includes('zzzzzzzzzz.png'))
  await app.close()
  app = undefined
  await launch()
  check('restart did not write a new save', (await readdir(join(data, 'saves/1'))).filter(name => name.endsWith('.json')).join() === 'older.json' && saveBefore.equals(await readFile(join(data, 'saves/1/older.json'))))
  check('quit without saving and restart retains both replacements', (await currentImages(files[0])).every(image => image.width === 96) && (await currentImages(files[1])).every(image => image.width === 96))
  await app.close()
  app = undefined
  await writeFile(join(data, 'saves/1/keep.json'), JSON.stringify({ photo: photo(files[1]) }))
  await rm(join(data, 'saves/1/older.json'))
  await launch(false)
  await until(async () => !(await readdir(folder)).includes(files[0]))
  check('launch sweep removes the deleted save’s exclusive photo', !(await readdir(folder)).includes(files[0]))
  check('launch sweep preserves a photo named by another save', (await readdir(folder)).includes(files[1]))
  console.log(`${checks} Photo app checks passed`)
} finally {
  await app?.close()
  await server.close()
  await rm(data, { recursive: true, force: true })
}
