import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MEANWHILE_MOD, meanwhileEvents, normalizeMeanwhile, validateMeanwhile, withMeanwhile, type MeanwhileScene, type MeanwhileResponse } from '@shared/meanwhile'
import type { GameSave, Result } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { generateMeanwhile } from '../src/renderer/stores/meanwhile'
import { writesSettled } from '../src/renderer/stores/loop/saves'
import { character, charactersById, charInfo, playthroughRecord, restoreApi, stubApi } from './fixtures'

const lines = Array.from({length:6},(_,i)=>({speaker:i%2?'b':'a',text:`Line ${i}`}))
function scene(): MeanwhileScene {
  return { id:'scene',date:7,participants:['a','b'],title:'A and B',where:'the park',ref:'green_hill_park',kind:'hangout',positive:true,lines }
}
function seed(): void {
  useGameStore.getState().reset()
  useModsStore.setState({switches:{on:{},options:{}}})
  useGameStore.setState({playthroughId:'p',date:7,time:0,chars:['a','b'],
    characters:charactersById(character({charId:'a'}),character({charId:'b',firstName:'Mina'})),
    charInfo:{a:charInfo({nameKnown:true}),b:charInfo({nameKnown:true})},
    npcRelationships:{'a|b':{affinity:2,encounter:{date:6,kind:'hangout',ref:'green_hill_park',positive:true}}}})
}
const game=()=>useGameStore.getState()
const eventId=()=>meanwhileEvents(game())[0].id
beforeEach(seed)
afterEach(async()=>{await writesSettled();restoreApi();vi.restoreAllMocks()})

describe('spectator cache rules',()=>{
  it('bounds and validates imported records, including both speakers and no additional participants',()=>{
    expect(normalizeMeanwhile({scenes:[null,{...scene(),date:NaN},{...scene(),lines:[{speaker:'player',text:'Hi'}]},scene()]}).scenes).toHaveLength(1)
    expect(normalizeMeanwhile({scenes:Array.from({length:80},(_,i)=>({...scene(),id:String(i)}))}).scenes).toHaveLength(50)
    expect(()=>validateMeanwhile({lines:lines.map(l=>({...l,speaker:'a'}))},['a','b'])).toThrow()
    expect(()=>validateMeanwhile({lines:[...lines,{speaker:'player',text:'Hello'}]},['a','b'])).toThrow()
    expect(()=>validateMeanwhile({lines:lines.map(l=>({...l,text:'x'.repeat(401)}))},['a','b'])).toThrow()
  })
  it('only offers known pairs and recent ungenerated events; rewinds hide future cached entries',()=>{
    expect(meanwhileEvents(game())).toHaveLength(1)
    useGameStore.setState({exNpcWatch:withMeanwhile(normalizeMeanwhile(null),{...scene(),date:8})})
    expect(meanwhileEvents(game())).toHaveLength(1)
    useGameStore.setState(s=>({charInfo:{...s.charInfo,b:{...s.charInfo.b,nameKnown:false}}}))
    expect(meanwhileEvents(game())).toEqual([])
    seed(); useGameStore.setState({date:20})
    expect(meanwhileEvents(game())).toEqual([])
  })
  it('keeps cached records on repeat watch and round-trips through saves even when switched off',()=>{
    const cache=withMeanwhile(withMeanwhile(normalizeMeanwhile(null),scene()),scene())
    expect(cache.scenes).toHaveLength(1)
    useGameStore.setState({exNpcWatch:cache})
    const save={...game().toGameSave(),playthroughId:'p',saveId:'save',saveDate:0} as GameSave
    const roster=game().characters
    useModsStore.setState({switches:{on:{[MEANWHILE_MOD]:false},options:{}}})
    game().loadSave(save,playthroughRecord({chars:['a','b']}),roster)
    expect(game().exNpcWatch).toEqual(cache)
    expect(game().toGameSave().exNpcWatch).toEqual(cache)
  })
})

function api(){
  const complete=vi.fn(async():Promise<Result<MeanwhileResponse>>=>({ok:true,data:{lines}}))
  const save=vi.fn(async()=>({ok:true as const,data:game().toGameSave() as GameSave}))
  stubApi({llm:{completeMod:complete},saves:{autosave:save}})
  return {complete,save}
}
describe('spectator generation and persistence',()=>{
  it('writes the cache before showing it, preserving canonical state and reusing a replay for free',async()=>{
    const {complete,save}=api(),before=game().toGameSave(),id=eventId()
    save.mockImplementationOnce(async()=>{
      expect(game().exNpcWatch.scenes).toEqual([])
      return {ok:true,data:game().toGameSave() as GameSave}
    })
    await generateMeanwhile(id,'test',()=>true)
    expect(complete).toHaveBeenCalledWith(MEANWHILE_MOD, expect.objectContaining({schema:expect.objectContaining({name:'meanwhile'})}), 'mod:meanwhile-conversations:test')
    const after=game().toGameSave()
    expect({...after,exNpcWatch:undefined}).toEqual({...before,exNpcWatch:undefined})
    expect(game().exNpcWatch.scenes).toHaveLength(1)
    await generateMeanwhile(id,'again',()=>true)
    expect(complete).toHaveBeenCalledOnce();expect(save).toHaveBeenCalledOnce()
  })
  it('keeps the cache empty after invalid output or failed disk writes',async()=>{
    const {complete}=api()
    complete.mockResolvedValueOnce({ok:true,data:{lines:[{speaker:'reader',text:'No'}]}})
    await expect(generateMeanwhile(eventId(),'test',()=>true)).rejects.toThrow('two-character')
    expect(game().exNpcWatch.scenes).toEqual([])
    stubApi({llm:{completeMod:async()=>({ok:true,data:{lines}})},
      saves:{autosave:async()=>({ok:false,error:{code:'DISK',message:'Disk full'}})}})
    await expect(generateMeanwhile(eventId(),'test',()=>true)).rejects.toThrow('Disk full')
    expect(game().exNpcWatch.scenes).toEqual([])
  })
  it('discards results after close, reload, or mod disable',async()=>{
    for(const mode of ['close','load','off']){
      seed(); const {complete,save}=api(); let active=true
      let finish!:(v:Result<MeanwhileResponse>)=>void
      complete.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
      const pending=generateMeanwhile(eventId(),'test',()=>active)
      if(mode==='close')active=false
      if(mode==='load')useGameStore.setState(s=>({loads:s.loads+1}))
      if(mode==='off')useModsStore.setState({switches:{on:{[MEANWHILE_MOD]:false},options:{}}})
      finish({ok:true,data:{lines}})
      await expect(pending).rejects.toThrow('changed')
      expect(save).not.toHaveBeenCalled();expect(game().exNpcWatch.scenes).toEqual([])
    }
  })
})
