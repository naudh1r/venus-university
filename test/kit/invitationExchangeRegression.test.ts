import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { installMods } from '@shared/mods'
import { character, charInfo, stubApi, restoreApi } from '../fixtures'
stubApi({jobs:{onProgress:()=>()=>{}}})
const {useGameStore:game}=await import('../../src/renderer/stores/gameStore')
const {useModsStore:mods}=await import('../../src/renderer/stores/modsStore')
const {resetLoopState,loopState}=await import('../../src/renderer/stores/loop/state')
const {canInviteToScene,freeForInvitation,startInvitedScene}=await import('../../src/renderer/mods/sceneInvitations')
const {openSceneExchange,subscribeSceneTurns}=await import('../../src/renderer/mods/sceneExchange')
const {holdTurn}=await import('../../src/renderer/mods/sceneView')
beforeEach(()=>{
  installMods(['exchange-a','exchange-b'].map(id=>({id,name:id,author:'test',version:'1.0.0',scope:'anytime',defaultOn:true,blurb:''})))
  game.getState().reset(); resetLoopState()
  mods.setState({switches:{on:{'exchange-a':true,'exchange-b':true},options:{}}})
  game.setState({playthroughId:'fixture',date:7,time:0,chars:['a'],characters:{a:character({charId:'a',firstName:'Ana',pose:'standing'})},charInfo:{a:charInfo({nameKnown:true})},charKeyToId:{ANA:'a'}})
})
afterEach(()=>{game.getState().reset();resetLoopState();restoreApi();vi.restoreAllMocks()})
it.each(['turnError','classifierError','introError','statusModal','memoryEdit'] as const)('refuses an invitation while %s is active', async key=>{
  game.setState({[key]:{code:'TEST',message:'held'}} as never)
  expect(canInviteToScene()).toBe(false)
  await expect(startInvitedScene('exchange-a','a','Meet me.',vi.fn())).rejects.toThrow()
})
it('refuses an armed hangout and an unknown participant',()=>{
  loopState.hangoutPrefetch={} as never
  expect(canInviteToScene()).toBe(false)
  loopState.hangoutPrefetch=null
  game.setState({charInfo:{a:charInfo({nameKnown:false})}})
  expect(freeForInvitation('a')).toBe(false)
})
it('starts a valid invitation through the native full cast setup before initialization', async()=>{
  const prompt = await import('../../src/renderer/stores/loop/promptState')
  const turns = await import('../../src/renderer/stores/loop/turn')
  const builder = await import('../../src/renderer/prompts/scenePrompt')
  const stream = await import('../../src/renderer/stores/loop/stream')
  const order: string[] = []
  const cast = vi.spyOn(prompt,'applyCast').mockImplementation(async()=>{order.push('cast')})
  vi.spyOn(builder,'buildScenePrompt').mockReturnValue({} as never)
  vi.spyOn(turns,'runSceneTurn').mockResolvedValue(undefined)
  vi.spyOn(stream,'streamScene').mockResolvedValue({} as never)
  await startInvitedScene('exchange-a','a','Meet me.',()=>{order.push('initialize')})
  expect(cast).toHaveBeenCalledWith(['a'])
  expect(order).toEqual(['cast','initialize'])
})
function scene(){
  game.setState({cast:['a'],departed:[],awaitingInput:true,currentSceneTranscript:[{speaker:'ANA',text:'Hello.'}],sceneLog:[]})
}
it('rejects reentrant appends and repeats without duplicating actions',()=>{
  scene()
  const exchange=openSceneExchange('exchange-a')!
  expect(exchange).not.toBeNull()
  const turn={id:1,participants:['a'],actions:['Wave.'],lines:[],deferSave:true}
  const stop=subscribeSceneTurns(()=>{expect(exchange.append(turn)).toBe(false)})
  expect(exchange.append(turn)).toBe(true)
  stop()
  const length=game.getState().currentSceneTranscript.length
  expect(exchange.append(turn)).toBe(true)
  expect(game.getState().currentSceneTranscript).toHaveLength(length)
  exchange.close()
})
it('accepts its own hold, refuses a different owner, and releases on switch-off',()=>{
  scene()
  const exchange=openSceneExchange('exchange-a')!
  const hold=holdTurn('exchange-a')
  expect(hold.ok).toBe(true)
  expect(exchange.current()).toBe(true)
  expect(openSceneExchange('exchange-b')).toBeNull()
  mods.setState({switches:{on:{'exchange-a':false},options:{}}})
  expect(exchange.current()).toBe(false)
  expect(game.getState().busy).toBe(false)
  if(hold.ok)hold.data()
  exchange.close()
})
it('invalidates a retained exchange after another scene is loaded',()=>{
  scene();const exchange=openSceneExchange('exchange-a')!
  game.setState(s=>({loads:s.loads+1}))
  expect(exchange.current()).toBe(false)
  exchange.close()
})

