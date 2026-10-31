// The installed mods in the real app: `npm run test:electron`, after `npm run build`. Playwright
// launches `out/main/index.js` with the data folder pointed at a temp copy holding the fixture
// mods, laid out as an install lays them out, and a settings file that skips the first run.
// Never against this checkout's own `data/`, and never against a player's. Run by hand for a
// pull request; it needs a build and a window, and takes a minute or two.
import { _electron as electron } from 'playwright'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const fixtures = join(root, 'test/fixtures/mods')
const main = join(root, 'out/main/index.js')
if (!existsSync(main)) {
  console.error('No build: run `npm run build` first.')
  process.exit(2)
}

const SETTINGS = {
  schemaVersion: 1,
  apiProvider: 'gemini',
  apiModel: 'gemini-3.8-flash',
  thinkingLevel: 'minimal',
  apiKey: 'e2e-not-a-key',
  comfyDeferred: true,
  noNsfwImages: false,
  lessNsfwText: false,
  sfwAsked: true,
  removedDefaults: [],
  checkUpdates: false,
  fullscreen: false
}

const MODS_JSON = JSON.stringify({ schemaVersion: 1, on: { 'missing-hook': true }, options: {} }, null, 2)

let failures = 0
const firstLine = (text) => text.split(String.fromCharCode(10))[0]
function check(name, ok, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `: ${detail}` : ''}`)
  if (!ok) failures++
}

/** A temp data folder with the named fixtures installed under `mods/<id>/1.0.0/`. */
function dataFolder(ids, settings = SETTINGS) {
  const data = mkdtempSync(join(tmpdir(), 'vu-e2e-'))
  mkdirSync(join(data, 'mods'), { recursive: true })
  for (const id of ids) cpSync(join(fixtures, id), join(data, 'mods', id, '1.0.0'), { recursive: true })
  // The installer's record, approving each one's main.js. The hash is the zip's; these are folder copies.
  const records = Object.fromEntries(
    ids.map((id) => [id, { '1.0.0': { source: `https://github.com/venus-extracurriculars/${id}`, sha256: '', approved: true, installedAt: '2026-10-27T00:00:00Z' } }])
  )
  writeFileSync(join(data, 'mods', 'installed.json'), JSON.stringify({ schemaVersion: 1, mods: records }, null, 2))
  writeFileSync(join(data, 'settings.json'), JSON.stringify(settings, null, 2))
  writeFileSync(join(data, 'mods.json'), MODS_JSON)
  return data
}

async function launch(data) {
  // The project folder, not the built file, so `app.getAppPath()` is the checkout and `assets/` is found.
  const app = await electron.launch({ args: [root], env: { ...process.env, VU_DATA_PATH: data } })
  const page = await app.firstWindow()
  const cspViolations = []
  const consoleErrors = []
  page.on('console', (message) => {
    const text = message.text()
    if (/Content Security Policy/i.test(text)) cspViolations.push(text)
    if (message.type() === 'error') consoleErrors.push(text)
  })
  await settle(page)
  return { app, page, cspViolations, consoleErrors }
}

/**
 * Waits for the menu or the mods' notice, dismissing any error the app raises about this checkout
 * itself on the way (a dev checkout without the shipped assets reports its pose manifest), which
 * is not what is under test here.
 */
async function settle(page) {
  await page.waitForSelector('#menu-mods, #mods-notice, #app-error', { timeout: 60000 })
  for (let tries = 0; tries < 3 && (await page.$('#app-error')) !== null; tries++) {
    console.log(`     (dismissing an app error: ${(await page.textContent('#app-error .vu-dialog-code')) ?? ''})`)
    await page.click('#app-error-dismiss')
    await page.waitForSelector('#menu-mods, #mods-notice, #app-error', { timeout: 60000 })
  }
}

async function openSettingsGameTab(page) {
  await page.click('#menu-settings')
  await page.waitForSelector('#settings-modal')
  await page.click('#settings-tab-game')
}

async function closeTopModal(page) {
  await page.keyboard.press('Escape')
}

async function scenario(name, ids, run, settings) {
  console.log(`\n== ${name}`)
  const data = dataFolder(ids, settings)
  let launched = null
  try {
    launched = await launch(data)
    await run({ ...launched, data })
  } catch (err) {
    check(`${name} ran to the end`, false, err instanceof Error ? firstLine(err.message) : String(err))
  } finally {
    await launched?.app.close().catch(() => {})
    rmSync(data, { recursive: true, force: true })
  }
}

// 1. hello-mod loads: no notice, its section in App settings, one React, its style, its image, its route.
await scenario('hello-mod loads', ['hello-mod'], async ({ page, cspViolations }) => {
  check('the main menu appears with no notice', (await page.$('#mods-notice')) === null)
  await openSettingsGameTab(page)
  await page.waitForSelector('#hello-mod-section', { timeout: 10000 })
  const before = await page.textContent('#hello-mod-count')
  await page.click('#hello-mod-count')
  const after = await page.textContent('#hello-mod-count')
  check('clicking its button changes its useState text', before === 'clicked 0' && after === 'clicked 1', `${before} -> ${after}`)
  check("the mod's React is the page's", (await page.textContent('#hello-mod-react')) === (await page.evaluate(() => globalThis[Symbol.for('vx.host')].react.version)))
  const color = await page.$eval('#hello-mod-section', (el) => getComputedStyle(el).color)
  check('its class from style.css is applied', color === 'rgb(1, 2, 3)', color)
  const width = await page.$eval('#hello-mod-dot', (img) => img.naturalWidth)
  check('its image has a natural width', width === 1, String(width))
  check('useModOn answers on', (await page.textContent('#hello-mod-on')) === 'on')
  const ping = await page.evaluate(() => fetch('vxmod://hello-mod/@/ping').then((r) => r.text()))
  check("fetch('vxmod://hello-mod/@/ping') answers ok (its main.js ran)", ping === 'ok', ping)
  const echoed = await page.evaluate(() => globalThis[Symbol.for('vx.host')]['@vx/modkit/renderer'].invoke('hello-mod', 'echo', ['hello']))
  check('invoke reaches its own main handler with an id and signal', echoed.ok && echoed.data.id === 'hello-mod' && echoed.data.signal && echoed.data.args[0] === 'hello')
  const failed = await page.evaluate(() => globalThis[Symbol.for('vx.host')]['@vx/modkit/renderer'].invoke('hello-mod', 'fail', []))
  check('a throwing invoke handler answers a redacted error Result', !failed.ok && failed.error.code === 'FIXTURE_INVOKE' && failed.error.detail.includes('<'))
  const cancelled = await page.evaluate(async () => {
    const controller = new AbortController()
    const pending = globalThis[Symbol.for('vx.host')]['@vx/modkit/renderer'].invoke('hello-mod', 'wait', [], { signal: controller.signal })
    controller.abort()
    return await pending
  })
  check('aborting invoke answers CANCELLED before a late handler can win', !cancelled.ok && cancelled.error.code === 'CANCELLED')
  const mainOn = await page.evaluate(() => fetch('vxmod://hello-mod/@/on').then((r) => r.text()))
  check("its main.js sees itself on through sharedModOn", mainOn === 'true', mainOn)
  check('the console has no CSP violation', cspViolations.length === 0, cspViolations.join(' | '))
})

// 2. missing-hook: the notice, the menu, the Mods screen row with its switch disabled, mods.json unchanged.
await scenario('missing-hook needs an update', ['hello-mod', 'missing-hook'], async ({ page, data }) => {
  await page.waitForSelector('#mods-notice', { timeout: 10000 })
  const notice = await page.textContent('#mods-notice')
  check('the notice names it with the reason', /Missing hook.*needs an update: `notARealHook` is not in this core/.test(notice ?? ''), notice ?? '')
  await page.click('#mods-notice-continue')
  await page.waitForSelector('#menu-mods')
  check('the game reaches the main menu', true)
  await page.click('#menu-mods')
  await page.waitForSelector('#mods-modal')
  const row = await page.textContent('#mods-pick-missing-hook')
  check('the Mods screen row says the same', /Not running this session: needs an update/.test(row ?? ''), row ?? '')
  const disabled = await page.$eval('#mods-switch-missing-hook', (el) => el.disabled)
  const checked = await page.$eval('#mods-switch-missing-hook', (el) => el.getAttribute('aria-checked'))
  check("its switch is disabled in the player's position (on)", disabled && checked === 'true', `disabled=${disabled} checked=${checked}`)
  check('hello-mod is listed as on', (await page.textContent('#mods-pick-hello-mod'))?.includes('Hello mod') === true)
  check('data/mods.json is unchanged', readFileSync(join(data, 'mods.json'), 'utf8') === MODS_JSON)
})

// 3. undeclared, throws, cycle: each listed with its reason; hello-mod still works beside them.
await scenario('undeclared, throws and the cycle', ['hello-mod', 'undeclared', 'throws', 'cycle-a', 'cycle-b'], async ({ page }) => {
  await page.waitForSelector('#mods-notice', { timeout: 10000 })
  const notice = (await page.textContent('#mods-notice')) ?? ''
  check('undeclared is refused for registering gameEntered', /Undeclared.*registers `gameEntered` but does not declare it/.test(notice), notice)
  check('throws is failed with its error', /Throws.*renderer\.js failed to load: .*throws at top level/.test(notice), notice)
  check('cycle-a is blocked with the path', /Cycle a.*requires itself through cycle-a → cycle-b → cycle-a/.test(notice), notice)
  check('cycle-b is blocked', /Cycle b.*requires itself/.test(notice), notice)
  check('hello-mod is not in the notice', !/Hello mod/.test(notice))
  await page.click('#mods-notice-continue')
  await openSettingsGameTab(page)
  await page.waitForSelector('#hello-mod-section', { timeout: 10000 })
  check('hello-mod still works beside them', true)
  check("undeclared's section is not drawn", (await page.$('#undeclared-section')) === null)
})

// 4. lib / uses-lib: uses-lib draws greet()'s answer, imported from the library.
await scenario('a library and its dependent', ['lib', 'uses-lib'], async ({ page }) => {
  check('no notice', (await page.$('#mods-notice')) === null)
  await openSettingsGameTab(page)
  await page.waitForSelector('#uses-lib-section', { timeout: 10000 })
  check("uses-lib draws greet()'s answer", (await page.textContent('#uses-lib-section')) === 'hello from lib')
  await closeTopModal(page)
  await page.click('#menu-mods')
  await page.waitForSelector('#mods-modal')
  check('the library has no row', (await page.$('#mods-pick-lib')) === null)
  check('uses-lib has one', (await page.$('#mods-pick-uses-lib')) !== null)
})

// 5. Dev folder: hello-mod's folder as a developer folder; a change to its renderer.js reloads the window,
//    and a change to its manifest reaches main's rule.
{
  const devFolder = mkdtempSync(join(tmpdir(), 'vu-e2e-dev-'))
  cpSync(join(fixtures, 'hello-mod'), devFolder, { recursive: true })
  await scenario('a developer folder reloads on change', [], async ({ page }) => {
    check('no notice', (await page.$('#mods-notice')) === null)
    await openSettingsGameTab(page)
    await page.waitForSelector('#hello-mod-section', { timeout: 10000 })
    check('the folder is loaded as a mod', (await page.textContent('#hello-mod-section h4')) === 'Hello mod')
    await closeTopModal(page)
    await page.click('#menu-mods')
    await page.waitForSelector('#mods-modal')
    check('the row says it is from a folder', /from folder/.test((await page.textContent('#mods-pick-hello-mod')) ?? ''))
    await closeTopModal(page)
    const file = join(devFolder, 'renderer.js')
    // Off a game the window reloads at once; the page's load event is the reload landing.
    const reloaded = page.waitForEvent('load', { timeout: 15000 })
    writeFileSync(file, readFileSync(file, 'utf8').replace("children: 'Hello mod'", "children: 'Hello again'"))
    await reloaded
    check('the window reloaded on the change', true)
    await settle(page)
    await openSettingsGameTab(page)
    await page.waitForSelector('#hello-mod-section', { timeout: 10000 })
    const heading = await page.textContent('#hello-mod-section h4')
    check('the window reloaded with the new text', heading === 'Hello again', heading ?? '')
    await closeTopModal(page)
    const manifestFile = join(devFolder, 'vxmod.json')
    const reloadedAgain = page.waitForEvent('load', { timeout: 15000 })
    writeFileSync(manifestFile, readFileSync(manifestFile, 'utf8').replace('"defaultOn": true', '"defaultOn": false'))
    await reloadedAgain
    await settle(page)
    const mainOn = await page.evaluate(() => fetch('vxmod://hello-mod/@/on').then((r) => r.text()))
    check("main's rule reads the manifest's new defaultOn after the reload", mainOn === 'false', mainOn)
  }, { ...SETTINGS, devModFolders: [devFolder] })
  rmSync(devFolder, { recursive: true, force: true })
}

await scenario('installed modal and native settings share one dismissal stack', ['modal-shell'], async ({ page }) => {
  await openSettingsGameTab(page)
  await page.click('#fixture-modal-open')
  await page.waitForSelector('#fixture-modal')
  await page.click('#fixture-modal-open-layer')
  await page.waitForSelector('#fixture-modal-layer')
  await page.keyboard.press('Escape')
  await page.waitForSelector('#fixture-modal-layer', { state: 'detached' })
  check('Escape closes the inner layer alone', (await page.$('#fixture-modal')) !== null && (await page.$('#settings-modal')) !== null)
  await page.keyboard.press('Escape')
  await page.waitForSelector('#fixture-modal', { state: 'detached' })
  check('the next Escape closes the mod modal alone', (await page.$('#settings-modal')) !== null)

  await page.click('#fixture-modal-open')
  await page.waitForSelector('#fixture-modal')
  await page.click('#fixture-modal-open-layer')
  await page.click('#fixture-modal-input', { button: 'right' })
  check('a field keeps its right-click menu without dismissing its layer', (await page.$('#fixture-modal-layer')) !== null)
  await page.locator('#fixture-modal-layer span').click({ button: 'right' })
  await page.waitForSelector('#fixture-modal-layer', { state: 'detached' })
  check('right-click outside a field dismisses the inner layer alone', (await page.$('#fixture-modal')) !== null && (await page.$('#settings-modal')) !== null)
  await page.locator('#fixture-modal p').click({ button: 'right' })
  await page.waitForSelector('#fixture-modal', { state: 'detached' })
  check('right-click dismisses the mod modal without closing settings', (await page.$('#settings-modal')) !== null)

  await page.click('#fixture-modal-open')
  await page.waitForSelector('#fixture-modal')
  const overlay = page.locator('#fixture-modal-overlay')
  await overlay.click({ position: { x: 5, y: 5 } })
  await page.waitForSelector('#fixture-modal', { state: 'detached' })
  check('outside click dismisses the mod modal alone', (await page.$('#settings-modal')) !== null)
  await closeTopModal(page)
  await page.waitForSelector('#settings-modal', { state: 'detached' })
  check('native settings regains Escape after every mod layer is gone', (await page.$('#menu-settings')) !== null)
})

console.log(failures === 0 ? '\nEvery check passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
