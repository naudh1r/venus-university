import { describe, expect, it } from 'vitest'
import { assertEchoEdit, assignEchoes, changePlayerEcho, editEchoCreature, editEchoStage, normalizeEcho, renameEcho, withEchoArtwork } from '@shared/echo'
import { chooseSetupEchoAspect, echoSetupLocks, finalizeEchoSetup, prepareEchoSetup } from '@shared/echoSetup'
import { stampSave, SAVE_READ } from '@shared/saveRules'
import { validateRecord } from '@shared/jsonValidate'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { character } from './fixtures'

const roster=[character({charId:'a',personality:'reserved private guarded',backstory:'She protects her secrets.'}),character({charId:'b',personality:'cheerful bubbly',backstory:'She was raised to be outgoing.'})]
const fresh=()=>prepareEchoSetup(undefined,'new-run',roster,'Reader','creative innovative engineer')
const art='d058c3ab-01f7-4994-aed8-ec004e9b243a'
describe('Echo setup before the semester',()=>{
  it('preassigns every selected girl from personality and backstory without any met-name requirement',()=>{
    const state=fresh()
    expect(state.player?.aspect).toBe('sparkweaver')
    expect(state.girls.a.aspect).toBe('veilkeeper');expect(state.girls.b.aspect).toBe('daylark')
    expect(Object.keys(state.girls)).toEqual(['a','b'])
    expect(state.girls.a.reasonExamples.some(e=>e.source==='Backstory')).toBe(true)
    expect(state.playerChangeUsed).toBe(false)
    expect(state.playerAutoArtAttempted).toBe(false)
    expect(prepareEchoSetup(state,'new-run',roster,'Reader','changed')).toEqual(state)
  })
  it('allows unlimited player and girl starting aspect choices while preserving names, artwork and placement',()=>{
    const original=withEchoArtwork(editEchoStage(editEchoCreature(renameEcho(fresh(),'a','Elyndra'),'a','armored fox','silver fur'),'a',{x:100,y:-90,scale:1.2}),'a',art,'uploaded')
    let state=original
    for(const aspect of ['heartthread','wildspark','stoneward'] as const){
      state=chooseSetupEchoAspect(state,'a',aspect,roster,'')
      state=chooseSetupEchoAspect(state,'player',aspect,roster,'')
      expect(state.playerChangeUsed).toBe(false)
    }
    expect(state.girls.a).toMatchObject({aspect:'stoneward',name:'Elyndra',art,source:'uploaded',creature:{type:'armored fox',description:'silver fur'},stage:{x:100,y:-90,scale:1.2},assignment:'chosen'})
    expect(state.girls.b).toEqual(original.girls.b)
    expect(original.girls.a.aspect).toBe('veilkeeper')
    expect(state.girls.a.reason).toContain('her story')
    const final=finalizeEchoSetup(state,roster)
    expect(assignEchoes(final,'entered-game',Object.fromEntries(roster.map(c=>[c.charId,c])),'Reader','new bio')).toEqual(final)
    expect(changePlayerEcho(final,'daylark').playerChangeUsed).toBe(true)
  })
  it('does not weaken ordinary in-game aspect restrictions',()=>{
    const original=fresh(),next=chooseSetupEchoAspect(original,'a','heartthread',roster,'')
    expect(()=>assertEchoEdit(original,next)).toThrow('fixed')
    const player=chooseSetupEchoAspect(original,'player','heartthread',roster,'')
    expect(()=>assertEchoEdit(original,player)).toThrow('Only one')
  })
  it('persists the customized state in the first native save and restores it on load',()=>{
    const state=finalizeEchoSetup(chooseSetupEchoAspect(fresh(),'a','heartthread',roster,''),roster)
    useGameStore.getState().reset()
    const save=stampSave({...useGameStore.getState().toGameSave(),exEcho:state},'123','autosave',1)
    const loaded=validateRecord(JSON.parse(JSON.stringify(save)),'autosave.json',SAVE_READ)
    expect(normalizeEcho(loaded.exEcho)).toEqual(state)
    expect(loaded.exEcho?.playerChangeUsed).toBe(false)
  })
  it('rejects unknown owners/aspects and incomplete starting rosters',()=>{
    for(const owner of ['missing','constructor','__proto__'])expect(()=>chooseSetupEchoAspect(fresh(),owner,'daylark',roster,'')).toThrow('roster')
    expect(()=>chooseSetupEchoAspect(fresh(),'a','fake' as never,roster,'')).toThrow('existing')
    expect(()=>finalizeEchoSetup(normalizeEcho(),roster)).toThrow('Every selected character')
    const state=fresh();delete state.girls.b
    expect(()=>finalizeEchoSetup(state,roster)).toThrow('Every selected character')
  })
  it('preserves returning aspects, the spent player change and customization while letting newcomers choose',()=>{
    const carried=changePlayerEcho(fresh(),'wildspark')
    const nextRoster=[...roster,character({charId:'c'})]
    const draft=prepareEchoSetup(carried,'next-term',nextRoster,'Reader','')
    const locked=echoSetupLocks(carried)
    expect(locked).toEqual(['player','a','b'])
    for(const owner of locked)expect(()=>chooseSetupEchoAspect(draft,owner,'heartthread',nextRoster,'',locked)).toThrow('previous semester')
    const next=chooseSetupEchoAspect(draft,'c','heartthread',nextRoster,'',locked)
    const final=finalizeEchoSetup(next,nextRoster,carried)
    expect(final.playerChangeUsed).toBe(true)
    expect(final.player).toEqual(carried.player);expect(final.girls.a).toEqual(carried.girls.a)
    expect(final.girls.c.aspect).toBe('heartthread')
    expect(()=>finalizeEchoSetup({...final,player:{...final.player!,aspect:'daylark'}},nextRoster,carried)).toThrow('returning player')
    expect(()=>finalizeEchoSetup({...final,girls:{...final.girls,a:{...final.girls.a,aspect:'daylark'}}},nextRoster,carried)).toThrow('returning students')
  })
})
