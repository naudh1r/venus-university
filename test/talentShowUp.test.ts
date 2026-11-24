import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buyTalent, normalizeTalents, setTalentRules, TALENTS } from '@shared/campusTalents'
import { showUpHeart, type ShowUpContext } from '@shared/talentShowUp'
import type { CalendarEvent, LedgerResponse, GameSave } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import '../src/renderer/modEntries/campus-talents'
import '../src/renderer/modEntries/starting-challenge'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { slotSettled } from '../src/renderer/mods/hooks'
import { showUpHeartForScene } from '../src/renderer/stores/loop/talentShowUp'
import { loopState, resetLoopState } from '../src/renderer/stores/loop/state'
import { writesSettled } from '../src/renderer/stores/loop/saves'
import { character, charInfo, sceneLines, stubApi, restoreApi } from './fixtures'

// Stop after the real boundary has applied stats; no next-slot AI or UI is needed.
const crossing = vi.hoisted(() => ({ release: () => {} }))
vi.mock('../src/renderer/stores/slotCrossing', async importOriginal => ({
  ...await importOriginal<typeof import('../src/renderer/stores/slotCrossing')>(),
  coverSlotCrossing: () => new Promise<void>(resolve => { crossing.release = resolve })
}))
stubApi({ jobs: { onProgress: () => () => {} } })
const { advance } = await import('../src/renderer/stores/gameLoop')

const state = (rank = 2) => normalizeTalents({ initialized:true, earned:1000, spent:55, ranks:{'heart.pride':rank} })
const scene = (patch: Partial<ShowUpContext> = {}): ShowUpContext => ({
  term:0, date:7, time:0, cast:['a'], acceptedInvite:'a', events:[],
  memories:[{charId:'a',type:'liked'}], ...patch
})
const plan = (patch: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id:'plan', date:7, time:0, title:'Coffee', description:'Meet for coffee',
  charIds:['a'], madeOn:{date:6,time:1}, noShow:[], ...patch
})
const ledger: LedgerResponse = { memories:[{charKey:'sarah_rose',type:'liked',desc:'the reader followed through on their plans'}] }
const game = () => useGameStore.getState()

beforeEach(() => {
  game().reset(); resetLoopState(); setTalentRules(true)
  useModsStore.setState({switches:{on:{'campus-talents':true,'starting-challenge':true,echo:false,reckoning:false},options:{}}})
  useGameStore.setState({playthroughId:'show-up-test',date:7,time:0,chars:['a'],cast:['a'],
    characters:{a:character({charId:'a'})},charInfo:{a:charInfo({nameKnown:true})},
    charKeyToId:{sarah_rose:'a'},sceneTextLedgerSkip:'a',exTalents:state(),
    stats:{brain:0,body:0,heart:-30},exStartingChallenge:{version:2,floors:{brain:-15,body:-15,heart:-30}},
    currentSceneTranscript:sceneLines('They enjoy coffee together.')})
  stubApi({jobs:{onProgress:()=>()=>{}},saves:{autosave:async (id,draft)=>({ok:true,data:{...draft,playthroughId:id,saveId:'auto',saveDate:0}})}})
})
afterEach(async () => { resetLoopState(); crossing.release(); await writesSettled(); restoreApi(); setTalentRules() })

describe('Show Up eligibility and persistence', () => {
  it('keeps purchased ranks, prices and the next Growth skill prerequisite', () => {
    const skill = TALENTS.find(s=>s.id==='heart.pride')!
    expect(skill.name).toBe('Show Up'); expect(skill.costs).toEqual([20,35])
    const restored = normalizeTalents(JSON.parse(JSON.stringify(state())))
    expect(restored.ranks['heart.pride']).toBe(2); expect(restored.spent).toBe(55)
    expect(buyTalent(restored,'heart.feet',()=>true).ranks['heart.feet']).toBe(1)
    expect(showUpHeart(state(1),scene())).toBe(1)
    expect(showUpHeart(restored,scene({memories:[{charId:'a',type:'loved'}]}))).toBe(2)
  })
  it('counts attended calendar plans as well as accepted immediate hangouts', () => {
    expect(showUpHeart(state(),scene({acceptedInvite:null,events:[plan()]}))).toBe(2)
    expect(showUpHeart(state(),scene({acceptedInvite:null}))).toBe(0)
    expect(showUpHeart(state(),scene({cast:[]}))).toBe(0)
  })
  it.each([
    {noShow:['a']}, {noShow:undefined}, {date:8}, {time:1 as const}
  ])('rejects missed, unsettled or wrong-slot plans: %j', patch => {
    expect(showUpHeart(state(),scene({acceptedInvite:null,events:[plan(patch)]}))).toBe(0)
  })
  it('requires a positive scene outcome from an invitee and rejects mixed outcomes', () => {
    for (const memories of [[],[{charId:'a',type:'disliked' as const}],
      [{charId:'b',type:'loved' as const}],
      [{charId:'a',type:'liked' as const},{charId:'a',type:'hated' as const}]]) {
      expect(showUpHeart(state(),scene({cast:['a','b'],memories}))).toBe(0)
    }
    expect(showUpHeart(state(),scene({cast:['a','b'],events:[plan({charIds:['a','b']})],
      memories:[{charId:'a',type:'liked'},{charId:'b',type:'disliked'}]}))).toBe(0)
  })
  it('pays once total per game day across invitees and slots, with a new allowance next day or term', () => {
    const paid = normalizeTalents(JSON.parse(JSON.stringify({...state(),showUpDay:{term:0,date:7}})))
    expect(showUpHeart(paid,scene())).toBe(0)
    expect(showUpHeart(paid,scene({time:1,cast:['b'],acceptedInvite:'b',memories:[{charId:'b',type:'loved'}]}))).toBe(0)
    expect(showUpHeart(paid,scene({date:8}))).toBe(2)
    expect(showUpHeart(paid,scene({term:1}))).toBe(2)
    expect(paid.showUpDay).toEqual({term:0,date:7})
  })
  it('does not multiply rewards for duplicate memories, multiple guests or repeated previews', () => {
    const before = structuredClone(state()), s = structuredClone(before)
    const group = scene({cast:['a','b'],events:[plan({charIds:['a','b']})],memories:[
      {charId:'a',type:'liked'},{charId:'a',type:'loved'},{charId:'b',type:'loved'}]})
    expect(showUpHeart(s,group)).toBe(2); expect(showUpHeart(s,group)).toBe(2)
    expect(s).toEqual(before)
  })
  it('preserves a valid paid-day stamp and ignores malformed imported stamps', () => {
    for(const stamp of [{term:'0',date:7},{term:0,date:-1},{term:0,date:7.5},{term:Infinity,date:7},null])
      expect(normalizeTalents({...state(),showUpDay:stamp}).showUpDay).toBeUndefined()
    expect(showUpHeart({...state(),initialized:false},scene())).toBe(0)
    expect(showUpHeart(state(0),scene())).toBe(0)
    setTalentRules(false); expect(showUpHeart(state(),scene())).toBe(0)
    setTalentRules(true)
    expect(showUpHeart({...state(),showUpDay:{term:0,date:7}},scene())).toBe(0)
  })
})

describe('Show Up in native scene settlement', () => {
  it('applies the full positive-stat reward at settlement and saves its daily use', async () => {
    useGameStore.setState({stats:{brain:0,body:0,heart:0},sceneEnding:true,statusShown:false,
      awaitingInput:false,pendingLines:[],exTalents:normalizeTalents({...state(),growth:{brain:0,body:0,heart:.25}})})
    const before = game()
    loopState.pendingLedgerResult = ledger
    advance()
    expect(game().currentLine?.text).toContain('Show Up: Heart went up by 2.')
    expect(game().stats.heart).toBe(0)
    expect(game().exTalents.growth?.heart).toBe(.25)
    expect(game().exTalents.showUpDay).toBeUndefined()
    useGameStore.setState({pendingLines:[],statusModal:null,statusShown:true})
    loopState.statusSteps=[]
    advance()
    expect(game().stats.heart).toBe(2)
    expect(game().exTalents.growth?.heart).toBe(.25)
    expect(game().exTalents.showUpDay).toBeUndefined()
    // The boundary pauses for memory edits; its mod callback commits the daily stamp afterward.
    slotSettled({before,ledger,closingCast:[before.characters.a]})
    expect(game().exTalents.showUpDay).toEqual({term:0,date:7})
    const save = JSON.parse(JSON.stringify(game().toGameSave())) as GameSave
    expect(normalizeTalents(save.exTalents).growth?.heart).toBe(.25)
    expect(showUpHeartForScene(ledger,false)).toBe(0)
    resetLoopState(); crossing.release(); await Promise.resolve()
  })
  it('uses saved hangout markers and validates memories, never texts or old affection', () => {
    const snapshot = JSON.parse(JSON.stringify(game().captureScene()))
    game().setCast([]); game().restoreScene(snapshot)
    expect(showUpHeartForScene(ledger,false)).toBe(2)
    for(const invalid of [null,{}, {textMemories:ledger.memories},
      {memories:[{charKey:'unknown',type:'loved',desc:'Good'}]},
      {memories:[{charKey:'sarah_rose',type:'liked',desc:' '}]}] as Array<LedgerResponse|null>)
      expect(showUpHeartForScene(invalid,false)).toBe(0)
  })
  it('does not award in replay, creator, class, shift, project, illness or without a playthrough', () => {
    const original = game()
    for(const patch of [{replaying:{}},{createdScene:{}},{sceneClass:'ART'},
      {sceneJob:'barista'},{sceneProject:'ART'},{playthroughId:null}]) {
      useGameStore.setState({...original,...patch} as Partial<typeof original>)
      expect(showUpHeartForScene(ledger,false)).toBe(0)
    }
    useGameStore.setState(original)
    expect(showUpHeartForScene(ledger,true)).toBe(0)
  })
  it('previews the exact award then banks Heart and the daily stamp at the actual boundary', async () => {
    // Owning training/recovery must not amplify this attendance award.
    useGameStore.setState({exTalents:normalizeTalents({...state(),ranks:{...state().ranks,'heart.ease':2,'heart.feet':2}}),
      sceneEnding:true,statusShown:false,awaitingInput:false,pendingLines:[]})
    const before = game()
    loopState.pendingLedgerResult = ledger
    advance()
    expect(game().currentLine?.text).toContain('Show Up: Heart went up by 2.')
    expect(game().stats.heart).toBe(-30); expect(game().exTalents.showUpDay).toBeUndefined()
    useGameStore.setState({pendingLines:[],statusModal:null,statusShown:true})
    loopState.statusSteps=[]
    advance()
    expect(game().stats.heart).toBe(-28)
    expect(game().exTalents.showUpDay).toBeUndefined()
    // The boundary pauses for memory edits; its mod callback commits the daily stamp afterward.
    slotSettled({before,ledger,closingCast:[before.characters.a]})
    expect(game().exTalents.showUpDay).toEqual({term:0,date:7})
    const save = JSON.parse(JSON.stringify(game().toGameSave())) as GameSave
    expect(normalizeTalents(save.exTalents).showUpDay).toEqual({term:0,date:7})
    expect(showUpHeartForScene(ledger,false)).toBe(0)
    resetLoopState(); crossing.release(); await Promise.resolve()
  })
})
