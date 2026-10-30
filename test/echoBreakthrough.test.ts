import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { normalizeEcho } from '@shared/echo'
import { ECHO_ASPECTS } from '@shared/echoAspects'
import { ECHO_BREAKTHROUGH_ABILITIES, ECHO_BREAKTHROUGH_OPTION, echoBreakthroughAbility } from '@shared/echoBreakthrough'
import { breakthroughSpent, normalizeBreakthrough } from '@shared/breakthrough'
import { withOption } from '@shared/mods'
import type { GameSave, StructuredRequest } from '@shared/types'
import { activateBreakthrough, availableEchoBreakthrough, canBreakthrough, finishBreakthrough, rearmBreakthrough, withBreakthrough } from '../src/renderer/stores/breakthrough'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { resetLoopState } from '../src/renderer/stores/loop/state'
import { failTurn } from '../src/renderer/stores/loop/turn'
import { writesSettled } from '../src/renderer/stores/loop/saves'
import { character, charactersById, charInfo, playthroughRecord, restoreApi, sceneLines, stubApi } from './fixtures'

const a=character({charId:'a'}),b=character({charId:'b',firstName:'Mina'})
const game=()=>useGameStore.getState()
const request:StructuredRequest={system:'scene',user:'Established scene context',schema:{name:'scene',schema:{}}}
function playerAspect(aspect:string):void {
  useGameStore.setState({exEcho:normalizeEcho({player:{aspect,name:'Zeiselle'},girls:{a:{aspect:'heartthread',name:'Other Echo'}}})})
}
beforeEach(()=>{
  game().reset();resetLoopState()
  useModsStore.setState({switches:{on:{echo:true},options:{}}})
  useGameStore.setState({playthroughId:'echo-run',date:15,time:0,chars:['a','b'],cast:['a','b'],
    characters:charactersById(a,b),charInfo:{a:charInfo({nameKnown:true}),b:charInfo({nameKnown:true})},
    awaitingInput:true,currentSceneTranscript:sceneLines('An ordinary conversation in the courtyard.'),
    exBreakthrough:normalizeBreakthrough({meters:{a:100,b:75}})})
  playerAspect('horizonbound')
  stubApi({saves:{autosave:async(_id,draft)=>({ok:true,data:{...draft,playthroughId:'echo-run',saveId:'autosave',saveDate:0}})}})
})
afterEach(async()=>{await writesSettled();restoreApi()})

describe('Echo Breakthrough prototype',()=>{
  it('covers every aspect exactly once with distinct abilities',()=>{
    const abilities=Object.values(ECHO_BREAKTHROUGH_ABILITIES)
    expect(Object.keys(ECHO_BREAKTHROUGH_ABILITIES).sort()).toEqual(ECHO_ASPECTS.map(a=>a.id).sort())
    expect(new Set(abilities.map(a=>a.name)).size).toBe(ECHO_ASPECTS.length)
    expect(new Set(abilities.map(a=>a.instruction)).size).toBe(ECHO_ASPECTS.length)
  })
  it.each(ECHO_ASPECTS.map(a=>a.id))('activates %s once at its listed price and preserves unspent spirit',aspect=>{
    playerAspect(aspect)
    const ability=ECHO_BREAKTHROUGH_ABILITIES[aspect],echo=structuredClone(game().exEcho),charInfoBefore=structuredClone(game().charInfo)
    activateBreakthrough('a',ability.action,()=>true,aspect)
    expect(game().exBreakthrough.meters).toEqual({a:100-ability.cost,b:75})
    expect(game().exBreakthrough.pending?.echoAspect).toBe(aspect)
    expect(game().exBreakthrough.pending?.spent).toBe(ability.cost)
    const persisted=normalizeBreakthrough(JSON.parse(JSON.stringify(game().exBreakthrough)))
    expect(persisted.pending?.echoAspect).toBe(aspect)
    expect(persisted.pending?.spent).toBe(ability.cost)
    expect(normalizeBreakthrough(persisted,true)).toMatchObject({meters:{a:100,b:75},pending:null})
    expect(game().breakthroughFlash?.echoAspect).toBe(aspect)
    const prompt=withBreakthrough(request,[a,b],false)
    expect(prompt.user).toContain(ability.instruction)
    expect(prompt.user).toContain(`spent ${ability.cost} spirit`)
    expect(prompt.user).toContain(`Influence: ${echoBreakthroughAbility(aspect)!.strength}`)
    expect(prompt.user).toContain(`Scope: ${ability.scope}`)
    expect(prompt.user.match(/ECHO BREAKTHROUGH — ONE-TURN ABILITY/g)).toHaveLength(1)
    expect(prompt.user).not.toContain('ONE-TURN NARRATIVE ADVANTAGE')
    expect(prompt.system).toBe(request.system);expect(prompt.schema).toBe(request.schema)
    finishBreakthrough(game().exBreakthrough.pending!.id,false,sceneLines('They decide to discuss a new idea.'),1)
    expect(withBreakthrough(request,[a,b],false).user).toBe(request.user)
    expect(game().exBreakthrough.moments.a[0].outcome).toContain('discuss a new idea')
    expect(game().exBreakthrough.moments.a[0].outcome).not.toContain(ability.instruction)
    expect(game().exBreakthrough.meters.a).toBe(100-ability.cost)
    expect(game().exEcho).toEqual(echo);expect(game().charInfo).toEqual(charInfoBefore)
  })
  it('uses the player aspect, rejects unavailable choices before spending, and permits a normal Breakthrough',()=>{
    expect(availableEchoBreakthrough(game())?.aspect).toBe('horizonbound')
    expect(()=>activateBreakthrough('a','I try to connect.',()=>true,'heartthread')).toThrow('current player Echo')
    expect(game().exBreakthrough.meters.a).toBe(100)
    activateBreakthrough('a','I make an ordinary appeal.',()=>true)
    expect(withBreakthrough(request,[a],false).user).toContain('ONE-TURN NARRATIVE ADVANTAGE')
    expect(game().exBreakthrough.pending).not.toHaveProperty('echoAspect')
  })
  it.each(['', 'An unrelated action left in the normal Breakthrough box.'])('uses only the preset Echo action when a caller supplies %j',direction=>{
    const ability=ECHO_BREAKTHROUGH_ABILITIES.horizonbound
    let sent=''
    activateBreakthrough('a',direction,action=>{sent=action;return true},'horizonbound')
    expect(sent).toBe(ability.action)
    expect(game().exBreakthrough.pending?.direction).toBe(ability.action)
    expect(game().exBreakthrough.meters.a).toBe(100-ability.cost)
    const prompt=withBreakthrough(request,[a],false)
    expect(prompt.user).toContain(ability.action)
    expect(prompt.user).not.toContain('An unrelated action')
    expect(prompt.user).not.toContain('ONE-TURN NARRATIVE ADVANTAGE')
  })
  it('still requires and dispatches the custom action for normal Breakthrough',()=>{
    expect(()=>activateBreakthrough('a','   ',()=>true)).toThrow()
    expect(game().exBreakthrough.meters.a).toBe(100)
    let sent=''
    activateBreakthrough('a','  I admit my mistake and ask for a fresh start.  ',action=>{sent=action;return true})
    expect(sent).toBe('I admit my mistake and ask for a fresh start.')
    expect(game().exBreakthrough.pending?.direction).toBe(sent)
    expect(game().exBreakthrough.meters.a).toBe(0)
    expect(withBreakthrough(request,[a],false).user).toContain('ONE-TURN NARRATIVE ADVANTAGE')
  })
  it.each(['mod','option','aspect'] as const)('refunds when the Echo %s becomes unavailable and refuses to rearm it',kind=>{
    activateBreakthrough('a','A new possibility.',()=>true,'horizonbound')
    const pending=game().exBreakthrough.pending!
    if(kind==='mod')useModsStore.setState({switches:{on:{echo:false},options:{}}})
    if(kind==='option')useModsStore.setState({switches:withOption(useModsStore.getState().switches,'echo',ECHO_BREAKTHROUGH_OPTION,false)})
    if(kind==='aspect')playerAspect('stoneward')
    expect(withBreakthrough(request,[a],false).user).toBe(request.user)
    expect(game().exBreakthrough.meters.a).toBe(100)
    rearmBreakthrough(pending)
    expect(game().exBreakthrough.pending).toBeNull()
    expect(game().exBreakthrough.meters.a).toBe(100)
  })
  it('keeps missing Echo data on standard Breakthrough and validates imported metadata',()=>{
    useGameStore.setState({exEcho:normalizeEcho()})
    expect(availableEchoBreakthrough(game())).toBeNull()
    expect(echoBreakthroughAbility('__proto__')).toBeNull()
    activateBreakthrough('a','I reach out.',()=>true)
    const state=normalizeBreakthrough({...game().exBreakthrough,pending:{...game().exBreakthrough.pending,echoAspect:'arbitrary instruction'}})
    expect(state.pending).not.toHaveProperty('echoAspect')
    expect(withBreakthrough(request,[a],false).user).toContain('ONE-TURN NARRATIVE ADVANTAGE')
  })
  it.each(['off','option-off','no-echo-save'] as const)('preserves ordinary Breakthrough with Echo %s',kind=>{
    if(kind==='off')useModsStore.setState({switches:{on:{echo:false},options:{}}})
    if(kind==='option-off')useModsStore.setState({switches:withOption(useModsStore.getState().switches,'echo',ECHO_BREAKTHROUGH_OPTION,false)})
    if(kind==='no-echo-save')useGameStore.setState({exEcho:normalizeEcho()})
    expect(availableEchoBreakthrough(game())).toBeNull()
    expect(canBreakthrough(game(),'a')).toBe(true)
    const memories=structuredClone(game().charInfo)
    activateBreakthrough('a','I offer an honest apology.',()=>true)
    expect(game().exBreakthrough.meters.a).toBe(0)
    expect(game().exBreakthrough.pending).not.toHaveProperty('echoAspect')
    expect(withBreakthrough(request,[a],false).user).toContain('ONE-TURN NARRATIVE ADVANTAGE')
    expect(withBreakthrough(request,[a],false).user).not.toContain('ECHO BREAKTHROUGH')
    finishBreakthrough(game().exBreakthrough.pending!.id,false,sceneLines('She agrees to hear the apology.'),1)
    expect(game().exBreakthrough.pending).toBeNull()
    expect(game().exBreakthrough.moments.a[0].outcome).toContain('hear the apology')
    expect(game().charInfo).toEqual(memories)
  })
  it('refunds dispatch failure, preserves the ability on retry, and recovers an interrupted load',()=>{
    expect(()=>activateBreakthrough('a','I try a new approach.',()=>false,'horizonbound')).toThrow('returned')
    expect(game().exBreakthrough.meters.a).toBe(100)
    activateBreakthrough('a','I try again.',()=>true,'horizonbound')
    const pending=game().exBreakthrough.pending!
    finishBreakthrough(pending.id,true)
    rearmBreakthrough(pending)
    expect(game().exBreakthrough.meters.a).toBe(50)
    expect(withBreakthrough(request,[a],false).user).toContain('Open Horizon')
    const restored=normalizeBreakthrough(JSON.parse(JSON.stringify(game().exBreakthrough)),true)
    expect(restored.pending).toBeNull();expect(restored.meters.a).toBe(100)
  })
  it('refunds a stale/absent target and cannot activate during replays or created scenes',()=>{
    activateBreakthrough('a','A new possibility.',()=>true,'horizonbound')
    expect(withBreakthrough(request,[b],false).user).toBe(request.user)
    expect(game().exBreakthrough.meters.a).toBe(100)
    useGameStore.setState({replaying:{}})
    expect(canBreakthrough(game(),'a')).toBe(false)
    useGameStore.setState({replaying:null,createdScene:{setup:{
      reader:{firstName:'Sam',lastName:'Lee',bio:'',tiers:{brain:1,body:1,heart:1}},
      cast:[],pairs:{},date:15,time:0,weather:'clear',prompt:'A courtyard conversation.'
    }}})
    expect(canBreakthrough(game(),'a')).toBe(false)
  })

  it.each(ECHO_ASPECTS.map(a=>a.id))('gates %s at its own threshold and refunds a partial bar without filling it',aspect=>{
    playerAspect(aspect)
    const {cost,action}=ECHO_BREAKTHROUGH_ABILITIES[aspect]
    useGameStore.setState({exBreakthrough:normalizeBreakthrough({meters:{a:cost-1,b:75}})})
    expect(canBreakthrough(game(),'a',aspect)).toBe(false)
    expect(()=>activateBreakthrough('a',action,()=>true,aspect)).toThrow(`At least ${cost}`)
    expect(game().exBreakthrough.meters.a).toBe(cost-1)
    useGameStore.setState({exBreakthrough:normalizeBreakthrough({meters:{a:cost,b:75}})})
    expect(canBreakthrough(game(),'a')).toBe(false)
    expect(canBreakthrough(game(),'a',aspect)).toBe(true)
    activateBreakthrough('a',action,()=>true,aspect)
    const token=game().exBreakthrough.pending!.id
    expect(game().exBreakthrough.meters.a).toBe(0)
    expect(canBreakthrough(game(),'a',aspect)).toBe(false)
    finishBreakthrough(token,true)
    finishBreakthrough(token,true)
    expect(game().exBreakthrough.meters).toEqual({a:cost,b:75})
    expect(game().exBreakthrough.pending).toBeNull()
  })

  it.each([
    ['stoneward',4,0],['horizonbound',2,0],['heartthread',1,25]
  ] as const)('allows %s to be used repeatedly only while enough spirit remains', (aspect,uses,remainder)=>{
    playerAspect(aspect)
    for(let i=0;i<uses;i++){
      activateBreakthrough('a','I try the opening.',()=>true,aspect)
      const token=game().exBreakthrough.pending!.id
      expect(()=>activateBreakthrough('a','A duplicate.',()=>true,aspect)).toThrow()
      finishBreakthrough(token,false,sceneLines('One exchange completes.'),i)
    }
    expect(game().exBreakthrough.meters.a).toBe(remainder)
    expect(game().exBreakthrough.moments.a).toHaveLength(uses)
    expect(canBreakthrough(game(),'a',aspect)).toBe(false)
  })

  it('refunds and retries the native failed turn at the recorded price on a partial bar',()=>{
    useGameStore.setState({exBreakthrough:normalizeBreakthrough({meters:{a:70,b:75}})})
    activateBreakthrough('a','Find another approach.',()=>true,'horizonbound')
    const pending=game().exBreakthrough.pending!
    const snapshot={action:pending.direction,scene:game().captureScene(),breakthrough:pending}
    failTurn({code:'LLM_FAILED',message:'offline test'},snapshot)
    expect(game().exBreakthrough.meters.a).toBe(70)
    useGameStore.setState({turnError:null,awaitingInput:true})
    rearmBreakthrough(pending)
    expect(game().exBreakthrough.meters.a).toBe(20)
    expect(game().exBreakthrough.pending?.spent).toBe(50)
    const saved={...game().toGameSave(),playthroughId:'echo-run',saveId:'save',saveDate:0} as GameSave
    game().loadSave(saved,playthroughRecord({chars:['a','b']}),charactersById(a,b))
    expect(game().exBreakthrough.meters.a).toBe(70)
    expect(game().exBreakthrough.pending).toBeNull()
  })

  it('returns only the paid amount after rejection or cancellation, keeping later gains bounded',()=>{
    playerAspect('stoneward')
    useGameStore.setState({exBreakthrough:normalizeBreakthrough({meters:{a:40}})})
    expect(()=>activateBreakthrough('a','Offer a plan.',()=>false,'stoneward')).toThrow('returned')
    expect(game().exBreakthrough.meters.a).toBe(40)
    activateBreakthrough('a','Offer a plan.',()=>true,'stoneward')
    const pending=game().exBreakthrough.pending!
    expect(game().exBreakthrough.meters.a).toBe(15)
    useGameStore.setState({exBreakthrough:{...game().exBreakthrough,meters:{a:25}}})
    finishBreakthrough(pending.id,true)
    expect(game().exBreakthrough.meters.a).toBe(50)
    finishBreakthrough(pending.id,true)
    expect(game().exBreakthrough.meters.a).toBe(50)
    expect(normalizeBreakthrough({meters:{a:90},pending},true).meters.a).toBe(100)
  })

  it('refunds disabled or stale abilities at their paid price rather than granting a full bar',()=>{
    useGameStore.setState({exBreakthrough:normalizeBreakthrough({meters:{a:60}})})
    activateBreakthrough('a','Offer a new direction.',()=>true,'horizonbound')
    useModsStore.setState({switches:{on:{echo:false},options:{}}})
    expect(withBreakthrough(request,[a],false).user).toBe(request.user)
    expect(game().exBreakthrough.meters.a).toBe(60)
    expect(canBreakthrough(game(),'a')).toBe(false)
  })

  it('treats older full-bar Echo saves as 100 spent and validates imported prices',()=>{
    playerAspect('stoneward')
    activateBreakthrough('a','Offer a plan.',()=>true,'stoneward')
    const {spent:ignored,...legacy}=game().exBreakthrough.pending!
    const restored=normalizeBreakthrough({meters:{a:0},pending:legacy},true)
    expect(restored.meters.a).toBe(100)
    expect(normalizeBreakthrough(restored,true).meters.a).toBe(100)
    for(const spent of [0,-25,1,101,'25',NaN,Infinity]){
      const state=normalizeBreakthrough({meters:{a:0},pending:{...legacy,spent}})
      expect(breakthroughSpent(state.pending!)).toBe(100)
    }
    finishBreakthrough(legacy.id,true)
    rearmBreakthrough(legacy)
    expect(game().exBreakthrough.meters.a).toBe(0)
    expect(withBreakthrough(request,[a],false).user).toContain('spent 100 spirit')
    finishBreakthrough(legacy.id,true)
    expect(game().exBreakthrough.meters.a).toBe(100)
  })
})
