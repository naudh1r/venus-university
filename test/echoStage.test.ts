import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { assignEchoes, editEchoCreature, editEchoSettings, editEchoStage, normalizeEcho, renameEcho, withEchoArtwork } from '@shared/echo'
import { echoStageOpacity, echoStageStyle, normalizeEchoStage, resolveEchoStage } from '@shared/echoStage'
import { carryModFields } from '@shared/modCarry'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { writeEcho, writesSettled } from '../src/renderer/stores/loop/saves'
import { resetLoopState } from '../src/renderer/stores/loop/state'
import '../src/renderer/modEntries/echo'
import { character, charactersById, charInfo, restoreApi, stubApi } from './fixtures'
import type { GameSave } from '@shared/types'

const game=()=>useGameStore.getState()
const placement={x:135,y:-80,scale:1.4}
beforeEach(()=>{
  game().reset();resetLoopState()
  useModsStore.setState({switches:{on:{echo:true},options:{}}})
  useGameStore.setState({playthroughId:'echo-stage-test',date:7,chars:['a','b'],characters:charactersById(character({charId:'a'}),character({charId:'b'})),charInfo:{a:charInfo(),b:charInfo()},exEcho:normalizeEcho({player:{aspect:'daylark',name:'First Light'},girls:{a:{aspect:'daylark',name:'Morning Song'},b:{aspect:'veilkeeper',name:'Hidden Star'}}})})
  stubApi({saves:{autosave:async(id,draft)=>({ok:true,data:{...draft,playthroughId:id,saveId:'autosave',saveDate:0}})}})
})
afterEach(async()=>{await writesSettled();restoreApi()})

describe('Per-character Echo staging',()=>{
  it('keeps a per-girl visibility choice through saves and semester carry without disabling other Echoes', async()=>{
    const before=game().exEcho
    const next=editEchoStage(before,'a',{...placement,visible:false})
    await writeEcho(next,before,()=>true)
    const saved=normalizeEcho(JSON.parse(JSON.stringify(game().toGameSave().exEcho)))
    expect(saved.girls.a.stage).toEqual({...placement,visible:false})
    expect(saved.girls.b).toEqual(before.girls.b)
    expect(saved.player).toEqual(before.player)
    expect(saved.visible).toBe(true)
    expect(saved.girls.a.aspect).toBe(before.girls.a.aspect)
    expect(assignEchoes(saved,'next',game().characters,'Reader','').girls.a.stage?.visible).toBe(false)
    expect(editEchoStage(saved,'a',{...placement,visible:true}).girls.a.stage?.visible).toBe(true)
    expect(normalizeEchoStage({visible:'false'}).visible).toBeUndefined()
  })
  it('saves name, creature, staging and opacity together in one write, preserving other owners and artwork',async()=>{
    const before=withEchoArtwork(game().exEcho,'a','d058c3ab-01f7-4994-aed8-ec004e9b243a','uploaded')
    useGameStore.setState({exEcho:before})
    let writes=0
    stubApi({saves:{autosave:async(id,draft)=>{writes++;return {ok:true,data:{...draft,playthroughId:id,saveId:'autosave',saveDate:0}}}}})
    const next=editEchoSettings(before,'a',{name:'Zephyra',creature:{type:'moonlit fox',description:'silver markings'},stage:{...placement,visible:false,floating:true,floatSeconds:17},opacity:.4})
    await writeEcho(next,before,()=>true)
    expect(writes).toBe(1)
    expect(game().exEcho.girls.a).toMatchObject({name:'Zephyra',creature:{type:'moonlit fox',description:'silver markings'},stage:{...placement,visible:false,floating:true,floatSeconds:17},art:before.girls.a.art,aspect:before.girls.a.aspect})
    expect(game().exEcho.girls.b).toEqual(before.girls.b)
    expect(game().exEcho.player).toEqual(before.player)
    expect(game().exEcho.opacity).toBe(.4)
    expect(before.girls.a.name).toBe('Morning Song')
  })
  it('keeps every pending field unchanged on validation or disk failure',async()=>{
    const before=game().exEcho,original=structuredClone(before)
    expect(()=>editEchoSettings(before,'a',{name:'Zephyra',creature:{type:'',description:''},stage:{...placement,visible:false}})).toThrow('monster type')
    expect(before).toEqual(original)
    const next=editEchoSettings(before,'a',{name:'Zephyra',stage:{...placement,visible:false}})
    stubApi({saves:{autosave:async()=>({ok:false,error:{code:'DISK',message:'Disk full'}})}})
    await expect(writeEcho(next,before,()=>true)).rejects.toThrow('Disk full')
    expect(game().exEcho).toBe(before)
  })
  it('uses the large reader default only when unset, preserving saved placements and girls',()=>{
    expect(resolveEchoStage(undefined,true)).toEqual({x:25,y:600,scale:2.39})
    expect(resolveEchoStage(undefined)).toEqual({x:0,y:0,scale:1})
    const custom={x:0,y:0,scale:1,opacity:.35,floating:false,floatSeconds:8}
    expect(resolveEchoStage(custom,true)).toEqual(custom)
    const saved=normalizeEcho(JSON.parse(JSON.stringify(game().exEcho)))
    expect(saved.player?.stage).toBeUndefined()
    expect(resolveEchoStage(saved.player?.stage,true).scale).toBe(2.39)
    expect(saved.girls.a.stage).toBeUndefined()
    const positioned=editEchoStage(saved,'player',custom)
    expect(resolveEchoStage(normalizeEcho(positioned).player?.stage,true)).toEqual(custom)
  })
  it('uses a faint player default independent of shared visibility, while respecting explicit per-owner choices',()=>{
    expect(echoStageOpacity(undefined,.8,true)).toBe(.18)
    expect(echoStageOpacity({x:100,y:-50,scale:1.2},.5,true)).toBe(.18)
    expect(echoStageOpacity({opacity:.35},.5,true)).toBe(.35)
    expect(echoStageOpacity(undefined,.5)).toBe(.5)
    expect(echoStageOpacity({opacity:.25},.5)).toBe(.25)
  })
  it('saves player placement and per-owner opacity/motion without changing other owners or artwork',async()=>{
    const before=game().exEcho
    const motion={...placement,opacity:.42,floating:true,floatSeconds:14}
    const player=editEchoStage(before,'player',motion)
    expect(player.player?.stage).toEqual(motion)
    expect(player.girls).toEqual(before.girls)
    const next=editEchoStage(player,'b',{x:-70,y:20,scale:1,opacity:.2,floating:false,floatSeconds:5})
    await writeEcho(next,before,()=>true)
    expect(normalizeEcho(game().toGameSave().exEcho).player?.stage).toEqual(motion)
    expect(game().exEcho.girls.a.stage).toBeUndefined()
    expect(game().exEcho.girls.b.stage?.floating).toBe(false)
    expect(normalizeEchoStage({floating:'yes',floatSeconds:Infinity,opacity:NaN})).toEqual({x:0,y:0,scale:1})
    expect(normalizeEchoStage({floating:true,floatSeconds:900,opacity:-2})).toMatchObject({floating:true,floatSeconds:20,opacity:.05})
  })
  it('preserves the original layout for old saves and bounds malformed imported coordinates',()=>{
    expect(game().exEcho.girls.a.stage).toBeUndefined()
    expect(normalizeEchoStage()).toEqual({x:0,y:0,scale:1})
    expect(normalizeEchoStage({x:9999,y:-9999,scale:99})).toEqual({x:600,y:-600,scale:2.5})
    expect(normalizeEchoStage({x:NaN,y:Infinity,scale:'2'})).toEqual({x:0,y:0,scale:1})
    expect(normalizeEchoStage({scale:-1})).toEqual({x:0,y:0,scale:.25})
    expect(normalizeEchoStage([])).toEqual({x:0,y:0,scale:1})
    expect(echoStageStyle()).toEqual({'--echo-x':'0px','--echo-y':'0px','--echo-scale':1})
    const preview=echoStageStyle({x:192,y:108,scale:1.5},true)
    expect(preview).toMatchObject({'--echo-x':'10%','--echo-y':'10%','--echo-scale':1.5})
  })
  it('edits only the selected girl without mutating previous state or global visibility',()=>{
    const before=game().exEcho,original=structuredClone(before)
    const next=editEchoStage(before,'a',placement)
    expect(before).toEqual(original)
    expect(next.girls.a).toEqual({...before.girls.a,stage:placement})
    expect(next.girls.b).toEqual(before.girls.b)
    expect(next.player).toEqual(before.player)
    expect(next.opacity).toBe(before.opacity);expect(next.visible).toBe(before.visible)
    for(const id of ['missing','__proto__','constructor'])expect(()=>editEchoStage(before,id,placement)).toThrow('Choose an Echo')
    expect(editEchoStage(next,'a',{x:0,y:0,scale:1}).girls.a.stage).toEqual({x:0,y:0,scale:1})
  })
  it('retains placement through save/load, renaming, creature edits, new artwork and semester carry even when off',()=>{
    const positioned=editEchoStage(game().exEcho,'a',placement)
    expect(normalizeEcho(JSON.parse(JSON.stringify(positioned))).girls.a.stage).toEqual(placement)
    expect(renameEcho(positioned,'a','Zephyra').girls.a.stage).toEqual(placement)
    expect(editEchoCreature(positioned,'a','moonlit fox','silver markings').girls.a.stage).toEqual(placement)
    expect(withEchoArtwork(positioned,'a','d058c3ab-01f7-4994-aed8-ec004e9b243a','uploaded').girls.a.stage).toEqual(placement)
    expect(assignEchoes(positioned,'next',game().characters,'Reader','').girls.a.stage).toEqual(placement)
    useGameStore.setState({exEcho:positioned})
    useModsStore.setState({switches:{on:{echo:false},options:{}}})
    const save={...game().toGameSave(),playthroughId:'p',saveId:'autosave',saveDate:0} as GameSave
    expect(carryModFields(save,{term:0,back:120,characters:game().characters}).exEcho?.girls.a.stage).toEqual(placement)
  })
  it('saves per-character placement through the native save lane',async()=>{
    const before=game().exEcho
    await writeEcho(editEchoStage(before,'a',placement),before,()=>true)
    expect(game().exEcho.girls.a.stage).toEqual(placement)
    expect(game().toGameSave().exEcho?.girls.a.stage).toEqual(placement)
    expect(game().exEcho.girls.b.stage).toBeUndefined()
  })
  it('leaves the live stage unchanged on disk failure or a dismissed stale edit',async()=>{
    const before=game().exEcho,next=editEchoStage(before,'a',placement)
    stubApi({saves:{autosave:async()=>({ok:false,error:{code:'DISK',message:'Disk full'}})}})
    await expect(writeEcho(next,before,()=>true)).rejects.toThrow('Disk full')
    expect(game().exEcho).toBe(before)
    await expect(writeEcho(next,before,()=>false)).rejects.toThrow('safe save')
    expect(game().exEcho).toBe(before)
  })
})
