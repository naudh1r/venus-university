import './fixtures/maestroModelKit'
import { talkInReckoningDungeon } from '../src/renderer/stores/reckoningDungeon'
import { enterTestDungeon } from './dungeonFixture'
import { unlockReckoningDungeon } from '../src/renderer/stores/reckoning'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { normalizeBreakthrough } from '@shared/breakthrough'
import type { Result } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { useSettingsStore } from '../src/renderer/stores/settingsStore'
import { reckoningPreparationStatus, retryReckoningPreparation, startReckoning, watchReckoningPreparation } from '../src/renderer/stores/reckoning'
import { resetLoopState } from '../src/renderer/stores/loop/state'
import { writesSettled } from '../src/renderer/stores/loop/saves'
import { GRADUATION_DATE } from '../src/renderer/prompts/occasions'
import { character, charactersById, charInfo, restoreApi, sceneLines, stubApi } from './fixtures'

const game=()=>useGameStore.getState()
const memories=Array.from({length:6},(_,i)=>({date:15,type:'loved' as const,desc:`The reader listened to her concerns, on occasion ${i}.`}))
const thoughts={thoughts:[
  {belief:'If I ask for help, I am a burden.',challenge:'You will eventually get tired of me.',evidence:['e1','e4']},
  {belief:'One mistake makes me a failure.',challenge:'Why would anyone stay if I fail?',evidence:['e1','e4']},
  {belief:'I have to earn every bit of kindness.',challenge:'What would be left if I stopped proving myself?',evidence:['e1','e4']}
]}
let stop:(()=>void)|undefined
let complete:Mock<typeof window.api.llm.completeMod>,save:Mock<typeof window.api.saves.autosave>,cancel:Mock<typeof window.api.jobs.cancelGroup>
const tick=()=>vi.advanceTimersByTimeAsync(650)

beforeEach(()=>{
  vi.useFakeTimers()
  game().reset();resetLoopState()
  useSettingsStore.setState({settings:null})
  useModsStore.setState({switches:{on:{echo:false,reckoning:true,breakthrough:true},options:{'reckoning:prepare-questions':true}}})
  useGameStore.setState({playthroughId:'preparation-test',date:15,time:0,chars:['a','b'],cast:['a'],playerFirstName:'Sam',playerLastName:'Lee',
    characters:charactersById(character({charId:'a',firstName:'Nina',personality:'Outspoken but afraid of failing.'}),character({charId:'b',firstName:'Bea',personality:'Quiet but determined.'})),
    charInfo:{a:charInfo({nameKnown:true,memories}),b:charInfo({nameKnown:true,memories})},awaitingInput:true,
    currentSceneTranscript:sceneLines('We talked about asking for help.'),exBreakthrough:normalizeBreakthrough({meters:{a:100,b:100}})})
  complete=vi.fn(async()=>({ok:true,data:thoughts}))
  save=vi.fn(async(_id,draft)=>({ok:true,data:{...draft,playthroughId:'preparation-test',saveId:'autosave',saveDate:0}}))
  cancel=vi.fn(async()=>({ok:true,data:undefined}))
  stubApi({llm:{completeMod:complete},jobs:{cancelGroup:cancel},saves:{autosave:save}})
})
afterEach(async()=>{stop?.();stop=undefined;await writesSettled();restoreApi();vi.useRealTimers()})

describe('Reckoning background preparation',()=>{
  it('makes no background request with the new default, then prepares after explicit opt-in', async () => {
    useModsStore.setState({ switches: { on: { reckoning: true, breakthrough: true }, options: {} } })
    stop = watchReckoningPreparation()
    await tick()
    expect(complete).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
    useModsStore.setState({ switches: {
      on: { reckoning: true, breakthrough: true }, options: { 'reckoning:prepare-questions': true }
    } })
    await tick()
    expect(complete).toHaveBeenCalledTimes(1)
    expect(reckoningPreparationStatus(game(), 'a').status).toBe('ready')
    expect(game().exBreakthrough.meters.a).toBe(100)
    expect(save).not.toHaveBeenCalled()
  })
  it.each([0,1] as const)('does not spend a background request at the semester cutoff (time %s)',async time=>{
    const date=time===1?GRADUATION_DATE-1:GRADUATION_DATE
    useGameStore.setState({date,time,charInfo:{a:charInfo({nameKnown:true,memories:memories.map(m=>({...m,date}))})}})
    stop=watchReckoningPreparation();await tick()
    expect(complete).not.toHaveBeenCalled();expect(save).not.toHaveBeenCalled()
    expect(game().exBreakthrough.meters.a).toBe(100)
  })
  it('prepares before the panel opens without spending or saving, then reuses the questions',async()=>{
    stop=watchReckoningPreparation()
    expect(complete).not.toHaveBeenCalled()
    await tick()
    expect(complete).toHaveBeenCalledTimes(1)
    expect(reckoningPreparationStatus(game(),'a').status).toBe('ready')
    expect(game().exReckoning.active).toBeNull()
    expect(game().exBreakthrough.meters.a).toBe(100)
    expect(save).not.toHaveBeenCalled()
    await enterTestDungeon();await startReckoning('a')
    expect(complete).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledTimes(3)
    expect(game().exReckoning.active?.thoughts[0].belief).toBe(thoughts.thoughts[0].belief)
    expect(game().exBreakthrough.meters.a).toBe(0)
    await tick()
    expect(complete).toHaveBeenCalledTimes(1)
  })

  it.each(['meter','affection','unknown','absent','replay','created','rewarded','mod','breakthrough','option'] as const)('does not prepare an ineligible or disabled case: %s',async(kind)=>{
    if(kind==='meter')useGameStore.setState({exBreakthrough:normalizeBreakthrough({meters:{a:99}})})
    if(kind==='affection')useGameStore.setState({charInfo:{a:charInfo({nameKnown:true,memories:[]})}})
    if(kind==='unknown')useGameStore.setState({charInfo:{a:charInfo({nameKnown:false,memories})}})
    if(kind==='absent')useGameStore.setState({cast:[]})
    if(kind==='replay')useGameStore.setState({replaying:{} as never})
    if(kind==='created')useGameStore.setState({createdScene:{} as never})
    if(kind==='rewarded')useGameStore.setState({exCharacterDynamics:{version:1,characters:{a:{traits:[],growth:{id:'earned',name:'A New Step',description:'She can ask for help.',reframes:['one','two','three']}}}}})
    if(kind==='mod')useModsStore.setState({switches:{on:{reckoning:false},options:{'reckoning:prepare-questions':true}}})
    if(kind==='breakthrough')useModsStore.setState({switches:{on:{reckoning:true,breakthrough:false},options:{'reckoning:prepare-questions':true}}})
    if(kind==='option')useModsStore.setState({switches:{on:{reckoning:true,breakthrough:true},options:{'reckoning:prepare-questions':false}}})
    stop=watchReckoningPreparation();await tick()
    expect(complete).not.toHaveBeenCalled()
    expect(save).not.toHaveBeenCalled()
  })

  it('serializes multiple eligible girls instead of generating a burst of parallel calls',async()=>{
    let release!:(value:Result<unknown>)=>void
    complete.mockImplementationOnce(()=>new Promise(r=>{release=r}))
    useGameStore.setState({cast:['a','b']});stop=watchReckoningPreparation();await tick()
    expect(complete).toHaveBeenCalledTimes(1)
    expect(reckoningPreparationStatus(game(),'b').status).toBe('queued')
    release({ok:true,data:thoughts});await tick()
    expect(complete).toHaveBeenCalledTimes(2)
    expect(reckoningPreparationStatus(game(),'a').status).toBe('ready')
    expect(reckoningPreparationStatus(game(),'b').status).toBe('ready')
    expect(save).not.toHaveBeenCalled()
  })

  it('retains questions through unrelated state changes, rereading and temporarily closed controls',async()=>{
    stop=watchReckoningPreparation();await tick()
    useGameStore.setState({busy:true,reread:1})
    await tick()
    useGameStore.setState({busy:false,reread:0})
    useModsStore.setState({switches:{on:{reckoning:true,breakthrough:true},options:{'reckoning:prepare-questions':true,'reckoning:glitch-effects':false}}})
    await tick()
    expect(complete).toHaveBeenCalledTimes(1)
    expect(reckoningPreparationStatus(game(),'a').status).toBe('ready')
  })

  it.each(['scene','history','profile','load','playthrough','slot','provider','spirit','switch'] as const)('rejects a late opening after %s changes',async(kind)=>{
    let release!:(value:Result<unknown>)=>void
    complete.mockImplementationOnce(()=>new Promise(r=>{release=r}))
    stop=watchReckoningPreparation();await tick()
    const group=complete.mock.calls[0][2]
    expect(complete.mock.calls[0][0]).toBe('reckoning')
    expect(group).toMatch(/^mod:reckoning:/)
    if(kind==='scene')useGameStore.setState({currentSceneTranscript:sceneLines('An entirely different conversation.')})
    if(kind==='history')useGameStore.setState({charInfo:{...game().charInfo,a:{...game().charInfo.a,memories:[...memories,{date:15,type:'hated',desc:'A recent argument.'}]}}})
    if(kind==='profile')useGameStore.setState({characters:{...game().characters,a:{...game().characters.a,personality:'Guarded and proud.'}}})
    if(kind==='load')useGameStore.setState({loads:game().loads+1})
    if(kind==='playthrough')useGameStore.setState({playthroughId:'another-game'})
    if(kind==='slot')useGameStore.setState({time:1})
    if(kind==='provider')useSettingsStore.setState({settings:{apiProvider:'openai',endpointModel:'new-writer'} as never})
    if(kind==='spirit')useGameStore.setState({exBreakthrough:normalizeBreakthrough({meters:{a:75}})})
    if(kind==='switch')useModsStore.setState({switches:{on:{reckoning:false},options:{'reckoning:prepare-questions':true}}})
    expect(cancel).toHaveBeenCalledWith(group)
    release({ok:true,data:thoughts});await vi.advanceTimersByTimeAsync(0)
    expect(reckoningPreparationStatus(game(),'a').status).not.toBe('ready')
    expect(game().exReckoning.active).toBeNull();expect(save).not.toHaveBeenCalled()
  })

  it('keeps failures quiet and retries only on request, without spending spirit',async()=>{
    complete.mockResolvedValueOnce({ok:false,error:{code:'OFFLINE',message:'Connection unavailable'}})
    stop=watchReckoningPreparation();await tick()
    expect(reckoningPreparationStatus(game(),'a')).toEqual({status:'error',error:'Connection unavailable'})
    useGameStore.setState({reread:0});await vi.advanceTimersByTimeAsync(30_000)
    expect(complete).toHaveBeenCalledTimes(1)
    retryReckoningPreparation('a');await tick()
    expect(complete).toHaveBeenCalledTimes(2)
    expect(reckoningPreparationStatus(game(),'a').status).toBe('ready')
    expect(game().exBreakthrough.meters.a).toBe(100);expect(save).not.toHaveBeenCalled()
  })

  it('rejects malformed prepared text and preserves ready text after a save failure',async()=>{
    complete.mockResolvedValueOnce({ok:true,data:{thoughts:[]}})
    stop=watchReckoningPreparation();await tick()
    expect(reckoningPreparationStatus(game(),'a').status).toBe('error')
    retryReckoningPreparation('a');await tick()
    save.mockResolvedValueOnce({ok:false,error:{code:'QA_DISK',message:'Disk unavailable'}})
    await expect(unlockReckoningDungeon('a')).rejects.toThrow('Disk unavailable')
    expect(game().exBreakthrough.meters.a).toBe(100)
    expect(reckoningPreparationStatus(game(),'a').status).toBe('ready')
    await enterTestDungeon();await startReckoning('a')
    expect(complete).toHaveBeenCalledTimes(2)
    expect(game().exBreakthrough.meters.a).toBe(0)
  })

  it('joins an in-flight preparation if a direct start races its result',async()=>{
    let release!:(value:Result<unknown>)=>void
    complete.mockImplementationOnce(()=>new Promise(r=>{release=r}))
    await enterTestDungeon();save.mockClear()
    stop=watchReckoningPreparation();await tick()
    const start=startReckoning('a')
    release({ok:true,data:thoughts});await start
    expect(complete).toHaveBeenCalledTimes(1);expect(save).toHaveBeenCalledTimes(1)
  })

  it('debounces mount rehearsal, stops on unmount and retains on-demand behavior when opted out',async()=>{
    const rehearsal=watchReckoningPreparation();rehearsal()
    await tick();expect(complete).not.toHaveBeenCalled()
    useModsStore.setState({switches:{on:{reckoning:true,breakthrough:true},options:{'reckoning:prepare-questions':false}}})
    stop=watchReckoningPreparation();await tick()
    await enterTestDungeon();await startReckoning('a')
    expect(complete).toHaveBeenCalledTimes(1);expect(save).toHaveBeenCalledTimes(3)
  })
})

it('keeps prepared dungeon questions across private conversation saves',async()=>{
 await enterTestDungeon();stop=watchReckoningPreparation();await tick();expect(complete).toHaveBeenCalledTimes(1);complete.mockResolvedValueOnce({ok:true,data:{reply:'I wonder why you keep coming back.'}});await talkInReckoningDungeon('Hello');await tick();expect(complete).toHaveBeenCalledTimes(2);expect(reckoningPreparationStatus(game(),'a').status).toBe('ready');await startReckoning('a');expect(complete).toHaveBeenCalledTimes(2)
})
