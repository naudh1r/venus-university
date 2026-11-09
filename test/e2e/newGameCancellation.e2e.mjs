// Real setup screens with held enrollment writes. No provider or personal-data access.
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from 'playwright'

const repo = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const html = resolve(repo, '__qa_cancel.html'), tsx = resolve(repo, '__qa_cancel.tsx')
const fixture = `
import React from 'react';import {createRoot} from 'react-dom/client';import {MotionConfig} from 'motion/react';
import './src/renderer/vu_styles/index.css';
window.api={platform:'web',jobs:{onProgress:()=>()=>{}},comfy:{onState:()=>()=>{}},llm:{structured:()=>{throw Error('Provider access forbidden')}},echo:{cancel:async()=>{}},bg:{},chars:{},saves:{},lorebook:{}};
const {useGameStore}=await import('./src/renderer/stores/gameStore');
const {useModsStore}=await import('./src/renderer/stores/modsStore');
const {useUiStore}=await import('./src/renderer/stores/uiStore');
const {useCharacterStore}=await import('./src/renderer/stores/characterStore');
const {useSaveStore}=await import('./src/renderer/stores/saveStore');
const {useSettingsStore}=await import('./src/renderer/stores/settingsStore');
const {useAudioStore}=await import('./src/renderer/stores/audioStore');useAudioStore.setState({play:()=>{}});
const {useCrossingStore,cancelCrossing}=await import('./src/renderer/stores/crossingStore');
const {stageEnrollment,stageContinuation}=await import('./src/renderer/stores/newGame');
const {MODS}=await import('./src/shared/mods');
const {NewGameView}=await import('./src/renderer/views/NewGameView');
const {character,enrollment,classEntry,peClassEntry,playthroughRecord}=await import('./test/fixtures');
const {stampEnrollment}=await import('./src/shared/saveRules');
const {slotFullLabel}=await import('./src/shared/classes');
const root=createRoot(document.getElementById('root')), calls={enroll:0,create:0}, girl=character({charId:'a',firstName:'Test',lastName:'Student'});
let release,visit=0;
const draw=()=>root.render(<MotionConfig reducedMotion="always">{['classSelect','nextSemester'].includes(useUiStore.getState().view)?<NewGameView key={visit}/>:<p>Main menu fixture</p>}</MotionConfig>);
useUiStore.subscribe((state,previous)=>{if(state.view!==previous.view)draw()});
useCharacterStore.setState({characters:{a:girl},load:async()=>{}});useSettingsStore.setState({settings:null});
useSaveStore.setState({enroll:async draft=>{calls.enroll++;calls.lastDraft=structuredClone(draft);return await new Promise(resolve=>{release=()=>resolve({ok:true,data:{playthroughId:'7000001'}})})},
createPlaythrough:async()=>{calls.create++;return {ok:false,error:{code:'QA_CAPTURED',message:'No disk write'}}}});
const classes=Object.fromEntries([peClassEntry({slot:0,code:'PE 100',name:'Fixture PE'}),...[1,2,3].map(slot=>classEntry({slot,code:'QA '+slot,name:'Fixture Course '+slot}))].map(c=>[c.code,c]));
window.__qa={calls,labels:[0,1,2,3].map(slot=>'Enroll in a course on '+slotFullLabel(slot)),
start:({dynamics=false,echo=false}={})=>{root.render(null);visit++;release=undefined;calls.enroll=0;calls.create=0;useGameStore.getState().reset();cancelCrossing();useCrossingStore.setState({phase:'idle'});
useModsStore.setState({switches:{on:Object.fromEntries(MODS.map(m=>[m.id,m.id==='echo'&&echo])),options:{}}});
const draft=enrollment({chars:['a'],mods:dynamics?['character-dynamics']:[],classes,perChar:{a:{year:2,major:'Art',dorm:'lowrise_1',schedule:{}}}});
stageEnrollment({playthroughId:'7000001',enrollment:stampEnrollment(draft,1),characters:[girl]});useUiStore.setState({view:'classSelect',error:null});draw()},
next:()=>{root.render(null);visit++;release=undefined;calls.enroll=0;calls.create=0;useGameStore.getState().reset();cancelCrossing();useCrossingStore.setState({phase:'idle'});
useModsStore.setState({switches:{on:Object.fromEntries(MODS.map(m=>[m.id,false])),options:{}}});
const handoff={index:1,continuing:['a'],graduated:[],alumni:[],priorProfiles:{},jobs:{},haunts:{},majorLoads:{},carry:{...useGameStore.getState().toGameSave(),mods:{}}};
const continued={...handoff,id:'next-fixture',taken:[]},semester={schedules:{classes,perChar:{a:{year:2,major:'Art',dorm:'lowrise_1',schedule:{}}}},jobs:{},haunts:{},feeds:{},springBreakPlans:{},occasions:[],fixedEdits:{},secrets:{},starts:{},pairs:{}};
window.__qa.composed=[semester,{firstName:'Avrix',lastName:'Test',stats:{brain:-60,body:-30,heart:0}},[girl],continued,[]];
stageContinuation({playthroughId:'7000001',record:playthroughRecord({mods:[]}),handoff,from:undefined,ending:'0-123-1'});useUiStore.setState({view:'nextSemester',error:null});draw()},
release:()=>release(),leave:()=>useUiStore.getState().setView('mainMenu'),unmount:()=>root.render(<p>Unmounted fixture</p>)};
document.getElementById('root').style.width='1920px';document.getElementById('root').style.height='1080px';
`
if (existsSync(html) || existsSync(tsx)) throw Error('QA entry already exists')
writeFileSync(html, '<!doctype html><html><body><div id="root"></div><script type="module" src="/__qa_cancel.tsx"></script></body></html>')
writeFileSync(tsx, fixture)
let server, browser
try {
  server = await createServer({ root: repo, configFile: false, logLevel: 'error', plugins: [{
    // Exercise the real controller callback with a completed synthetic semester; no generation calls.
    name: 'qa-composed-semester',
    enforce: 'pre',
    resolveId(id, importer) { if (/NewGameFlow(?:\.tsx)?$/.test(id) && importer?.replaceAll('\\', '/').endsWith('/views/NewGameView.tsx')) return '\0qa-composed-semester' },
    load(id) { if (id === '\0qa-composed-semester') return "import {createElement} from 'react';export function NewGameFlow({onComposed}){return createElement('button',{onClick:()=>onComposed(...window.__qa.composed)},'Finish fixture setup')}" }
  }], resolve: { alias: {
    '@shared': resolve(repo, 'src/shared'), '@vx/modkit/host': resolve(repo, 'packages/modkit/src/host'),
    '@vx/modkit/shared': resolve(repo, 'packages/modkit/src/shared'), '@vx/modkit/renderer': resolve(repo, 'packages/modkit/src/renderer')
  } }, esbuild: { jsx: 'automatic' }, define: { __APP_VERSION__: JSON.stringify('cancellation-regression') }, server: { host: '127.0.0.1', port: 0, fs: { allow: [repo, resolve(repo, '..')] } } })
  await server.listen()
  browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined) })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce' }), errors = []
  page.setDefaultTimeout(15000)
  page.on('pageerror', error => { errors.push(error.message); console.error(error.stack) })
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
  await page.goto('http://127.0.0.1:' + server.httpServer.address().port + '/__qa_cancel.html')
  await page.waitForFunction(() => window.__qa)
  for (const scenario of ['cancel', 'unmount', 'dynamics', 'echo', 'success']) {
    await page.evaluate(scenario => window.__qa.start({ dynamics: scenario === 'dynamics', echo: scenario === 'echo' }), scenario)
    const labels = await page.evaluate(() => window.__qa.labels)
    for (let i = 0; i < 4; i++) {
      await page.getByRole('button', { name: labels[i], exact: true }).click()
      await page.getByRole('button', { name: i === 0 ? /Fixture PE/ : new RegExp('Fixture Course ' + i) }).click()
    }
    await page.getByRole('button', { name: 'Enroll', exact: true }).click()
    if (scenario === 'dynamics') await page.getByRole('button', { name: 'Continue', exact: true }).click()
    if (scenario === 'echo') await page.getByRole('button', { name: 'Begin semester', exact: true }).click()
    await page.waitForFunction(() => window.__qa.calls.enroll === 1)
    if (scenario === 'cancel') await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    else if (scenario === 'unmount') await page.evaluate(() => window.__qa.unmount())
    else if (scenario !== 'success') await page.evaluate(() => window.__qa.leave())
    if (scenario !== 'success') await page.getByText(scenario === 'unmount' ? 'Unmounted fixture' : 'Main menu fixture', { exact: true }).waitFor()
    await page.evaluate(() => window.__qa.release())
    // Drain the resolved promise, React effects and deferred screen transitions.
    await page.waitForTimeout(350)
    assert.equal(await page.evaluate(() => window.__qa.calls.enroll), 1, scenario + ': stale follow-up enrollment write')
    assert.equal(await page.evaluate(() => window.__qa.calls.create), scenario === 'success' ? 1 : 0, scenario + ': stale opening-save write')
    if (scenario !== 'success') assert.equal(await page.getByRole('dialog', { name: 'Echoes', exact: true }).count(), 0)
    console.log('PASS ' + scenario)
  }
  for (const scenario of ['next-semester', 'next-cancel', 'next-unmount']) {
    await page.evaluate(() => window.__qa.next())
    await page.getByRole('button', { name: 'Finish fixture setup', exact: true }).click()
    await page.waitForFunction(() => window.__qa.calls.enroll === 1)
    if (scenario === 'next-cancel') await page.evaluate(() => window.__qa.leave())
    if (scenario === 'next-unmount') await page.evaluate(() => window.__qa.unmount())
    if (scenario !== 'next-semester') await page.getByText(scenario === 'next-unmount' ? 'Unmounted fixture' : 'Main menu fixture', { exact: true }).waitFor()
    await page.evaluate(() => window.__qa.release())
    if (scenario === 'next-semester') {
      await page.getByRole('button', { name: 'Enroll', exact: true }).waitFor()
      assert.equal(await page.evaluate(() => window.__qa.calls.lastDraft.continued.index), 1)
      assert.deepEqual(await page.evaluate(() => window.__qa.calls.lastDraft.stats), { brain: -60, body: -30, heart: 0 })
    } else {
      await page.waitForTimeout(350)
      assert.equal(await page.getByRole('button', { name: 'Enroll', exact: true }).count(), 0, scenario + ': abandoned registrar reopened')
    }
    assert.equal(await page.evaluate(() => window.__qa.calls.create), 0)
    console.log('PASS ' + scenario)
  }
  assert.deepEqual(errors, [])
} finally {
  await browser?.close(); await server?.close()
  if (readFileSync(tsx, 'utf8') !== fixture) throw Error('QA fixture changed')
  unlinkSync(html); unlinkSync(tsx)
}
