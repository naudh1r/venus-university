import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ECHO_ASPECTS, ECHO_MOTIFS, aspectOf, assignEchoes, changePlayerEcho, echoAffinity, echoCreatureOf, echoImagePrompt, echoMultiplier, editEchoCreature, matchingEcho, normalizeEcho, profileAspect, renameEcho, setEchoBonusEnabled, settleEchoMemories, uniqueEchoName, withEchoArtwork } from '@shared/echo'
import { explainEchoAspect } from '@shared/echoReasons'
import { echoNameArtDirection, suggestEchoName, suggestEchoCreature, mythicalEchoName } from '@shared/echoNaming'
import { affectionOf } from '@shared/relationship'
import { carryModFields } from '@shared/modCarry'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { prepareAutosave, writeEcho, writesSettled } from '../src/renderer/stores/loop/saves'
import { resetLoopState } from '../src/renderer/stores/loop/state'
import { ensureEchoes } from '../src/renderer/stores/echoAssignments'
import '../src/renderer/modEntries/echo'
import { slotSettled } from '../src/renderer/mods/hooks'
import { character, charactersById, charInfo, restoreApi, stubApi } from './fixtures'
import type { GameSave, MemoryType, SaveDraft } from '@shared/types'

const game = () => useGameStore.getState()
const m = (type:MemoryType,desc:string=type,date=7) => ({type,desc,date})
const matching = () => normalizeEcho({player:{aspect:'daylark',name:'First Light'},girls:{a:{aspect:'daylark',name:'Morning Song'},b:{aspect:'veilkeeper',name:'Hidden Star'}}})
const art='d058c3ab-01f7-4994-aed8-ec004e9b243a'
beforeEach(()=>{
  game().reset();resetLoopState()
  useModsStore.setState({switches:{on:{echo:true},options:{}}})
  useGameStore.setState({playthroughId:'echo-test',date:7,chars:['a','b'],characters:charactersById(character({charId:'a'}),character({charId:'b'})),charInfo:{a:charInfo(),b:charInfo()},exEcho:matching()})
  stubApi({saves:{autosave:async(id,draft)=>({ok:true,data:{...draft,playthroughId:id,saveId:'autosave',saveDate:0}})}})
})
afterEach(async()=>{await writesSettled();restoreApi();vi.restoreAllMocks();setEchoBonusEnabled(false)})

describe('Original Echo assignments',()=>{
  it('rolls varied creature drafts without repeating the current field',()=>{
    const suggestions=new Set<string>()
    for(let i=0;i<300;i++){
      const creature=suggestEchoCreature(`roll-${i}`)
      suggestions.add(creature)
      expect(creature.length).toBeLessThanOrEqual(100)
      expect(creature).toMatch(/^\S+ .+/)
      expect(suggestEchoCreature(`roll-${i}`,` ${creature.toUpperCase()} `)).not.toBe(creature)
    }
    expect(suggestions.size).toBeGreaterThan(150)
  })
  it('can name an unsaved creature draft without saving or changing its aspect or artwork',()=>{
    const state=matching(),before=structuredClone(state)
    state.player!.art=art
    before.player!.art=art
    const name=suggestEchoName(state,'player','draft-roll','','armored wolf')
    expect(name).toMatch(/^[A-Z][a-z]+$/)
    expect(suggestEchoName(state,'player','draft-roll','','moonlit crane')).not.toBe(name)
    expect(state).toEqual(before)
    expect(suggestEchoName(state,'player','draft-roll',name,'armored wolf')).not.toBe(name)
  })
  it('offers thousands of mythical names per owner instead of a small compound-word list',()=>{
    const names=new Set<string>(),state=matching(),before=structuredClone(state)
    for(let i=0;i<10000;i++){
      const name=suggestEchoName(state,'player',`myth-roll-${i}`)
      expect(name).toMatch(/^[A-Z][a-z]{2,19}$/)
      expect(name).not.toMatch(/(fang|claw|tail|howl|glint|crest|paw)$/i)
      names.add(name)
    }
    expect(names.size).toBeGreaterThan(8000)
    expect(state).toEqual(before)
  })
  it('avoids numbered duplicates and honors history and the current draft case-insensitively',()=>{
    const state=matching()
    const first=suggestEchoName(state,'player','repeat')
    expect(suggestEchoName(state,'player','repeat',` ${first.toUpperCase()} `)).not.toBe(first)
    const used=new Set<string>()
    for(let i=0;i<500;i++){
      const name=mythicalEchoName('repeat',used)
      expect(used.has(name.toLowerCase())).toBe(false)
      expect(name).not.toMatch(/\d|of the|\s/i)
      used.add(name.toLowerCase())
    }
  })
  it('defines 22 distinct types with symmetric, non-self competing pairs',()=>{
    expect(new Set(ECHO_ASPECTS.map(a=>a.name)).size).toBe(22)
    for(const a of ECHO_ASPECTS){expect(a.opposite).not.toBe(a.id);expect(aspectOf(a.opposite).opposite).toBe(a.id)}
  })
  it('assigns unseen girls from their personality and history, not randomly, and retains returning choices',()=>{
    const profiles=charactersById(character({charId:'a',personality:'cheerful outgoing bubbly',backstory:''}),character({charId:'b',personality:'',backstory:'She grew up caring for family, a supportive caregiver.'}))
    const a=assignEchoes(normalizeEcho(),'run-a',profiles,'Test Reader','ambitious competitive driven')
    expect(a.player?.aspect).toBe('trailblazer')
    expect(a.girls.a.aspect).toBe('daylark');expect(a.girls.b.aspect).toBe('hearthwarden')
    expect(a.girls.b.reasonExamples).toContainEqual(expect.objectContaining({source:'Backstory',quote:'She grew up caring for family, a supportive caregiver.',supportsType:true}))
    expect(new Set([a.player?.name,...Object.values(a.girls).map(e=>e.name)]).size).toBe(3)
    expect(assignEchoes(normalizeEcho(),'run-a',profiles,'Test Reader','ambitious competitive driven')).toEqual(a)
    const other=assignEchoes(normalizeEcho(),'run-b',profiles,'Test Reader','ambitious competitive driven')
    expect(other.girls.a.aspect).toBe(a.girls.a.aspect)
    expect(other.girls.a.name).not.toBe(a.girls.a.name)
    const returning=assignEchoes(a,'next-semester',{...profiles,a:character({charId:'a',personality:'reserved quiet private'}),c:character({charId:'c',personality:'reserved quiet private'})},'Changed','changed')
    expect(returning.girls.a).toEqual(a.girls.a);expect(returning.player).toEqual(a.player)
    expect(returning.girls.c.aspect).toBe('veilkeeper')
  })
  it('weights present personality above equal history cues and excludes simple negations',()=>{
    expect(profileAspect('A',[{label:'personality',text:'cheerful bubbly',weight:3},{label:'backstory',text:'reserved private',weight:2}]).aspect).toBe('daylark')
    expect(profileAspect('B',[{label:'bio',text:'Not cheerful. Reserved, private, guarded.',weight:3}]).aspect).toBe('veilkeeper')
    expect(profileAspect('C',[])).toEqual({aspect:'horizonbound',reason:expect.stringContaining('No strong profile cues')})
  })
  it('migrates old choices once, keeping previously generated artwork',()=>{
    const old=normalizeEcho({version:1,player:{aspect:'lovers',art},girls:{a:{aspect:'sun',art}},opacity:.5})
    const profiles=charactersById(character({charId:'a',personality:'reserved private guarded',backstory:''}))
    const migrated=assignEchoes(old,'run',profiles,'Reader','creative innovative engineer')
    expect(migrated.player?.aspect).toBe('sparkweaver');expect(migrated.girls.a.aspect).toBe('veilkeeper')
    expect(migrated.player?.art).toBe(art);expect(migrated.girls.a.art).toBe(art)
    expect(migrated.playerChangeUsed).toBe(false)
    expect(assignEchoes(normalizeEcho(JSON.parse(JSON.stringify(migrated))),'run',profiles,'Changed','quiet')).toEqual(migrated)
  })
  it('bounds imported values and rejects paths or invented aspects',()=>{
    const value=normalizeEcho({player:{aspect:'fake'},girls:{a:{aspect:'daylark',art:'../../settings.json',motif:-1},b:{aspect:'unknown'}},opacity:999,playerChangeUsed:'true'})
    expect(value.player).toBeNull();expect(value.opacity).toBe(.8);expect(value.playerChangeUsed).toBe(false)
    expect(value.girls.a.art).toBeUndefined();expect(value.girls.a.motif).toBe(0);expect(value.girls.b).toBeUndefined()
    expect(normalizeEcho({opacity:NaN}).opacity).toBe(.3)
  })
  it('assigns short unique names, including repeated random seeds',()=>{
    const state=matching(),names=new Set(state.usedNames)
    for(let i=0;i<50;i++){
      const name=uniqueEchoName(state,'daylark','same seed')
      expect(name).not.toMatch(/of the/i)
      expect(names.has(name)).toBe(false);names.add(name);state.usedNames.push(name)
    }
    expect(names.size).toBe(50)
    expect(uniqueEchoName(normalizeEcho(JSON.parse(JSON.stringify(state))),'daylark','same seed')).not.toBe(state.usedNames[0])
  })
  it('sends the unique name, type and both profile fields into the image prompt',()=>{
    const identity={...matching().girls.a,name:'Aurora'}
    const prompt=echoImagePrompt({requestId:art,identity,name:'Test Student',bio:'A thoughtful artist.',backstory:'Grew up near the sea.'})
    for(const value of [identity.name,'Daylark','A thoughtful artist.','Grew up near the sea.'])expect(prompt).toContain(value)
    for(const value of ['fantasy monster','cel shading','ink linework','balanced anatomy','plain white background','without making it stern or grim'])expect(prompt).toContain(value)
  })
  it('shortens old generated names once, resolves collisions, and preserves art/type locks',()=>{
    const old=normalizeEcho({version:2,playerChangeUsed:true,player:{aspect:'daylark',name:'Caelith of the Glass Daybreak',art},girls:{a:{aspect:'veilkeeper',name:'Caelith of the Silver Veil',art}}})
    const next=assignEchoes(old,'run',charactersById(character({charId:'a'})),'Reader','')
    expect(next.player?.name).toBe('Caelith');expect(next.girls.a.name).toBe('Caelith 2')
    expect(next.playerChangeUsed).toBe(true);expect(next.player?.art).toBe(art);expect(next.girls.a.aspect).toBe('veilkeeper')
    expect(assignEchoes(next,'run',charactersById(character({charId:'a'})),'Reader','')).toEqual(next)
    const custom=renameEcho(next,'player','Lady of the Lake')
    expect(assignEchoes(custom,'run',{},'Reader','').player?.name).toBe('Lady of the Lake')
  })
  it('uses actual backstory examples with an explanation and distinguishes weak contextual evidence',()=>{
    const backstory='At sixteen she became a caregiver for her younger sister. She made their small home a supportive refuge.'
    const detailed=explainEchoAspect('hearthwarden',[{label:'backstory',text:backstory,weight:2},{label:'personality',text:'She is warm and compassionate.',weight:3}])
    expect(detailed.reasonExamples.filter(e=>e.source==='Backstory')).toHaveLength(2)
    for(const e of detailed.reasonExamples.filter(e=>e.source==='Backstory')){expect(backstory).toContain(e.quote);expect(e.connection).toContain('Hearthwarden');expect(e.supportsType).toBe(true)}
    const weak=explainEchoAspect('daylark',[{label:'backstory',text:'She studied mathematics in a seaside city.',weight:2}])
    expect(weak.reason).toContain('loose fit');expect(weak.reasonExamples[0].supportsType).toBe(false)
    expect(weak.reasonExamples[0].connection).toContain('On its own')
    expect(explainEchoAspect('daylark',[],true).reason).toContain('your choice')
  })
  it('upgrades explanations once without changing identities, artwork, or saved locks',()=>{
    const previous=normalizeEcho({playerChangeUsed:true,playerAutoArtAttempted:true,player:{aspect:'daylark',name:'Solace',nameFormat:'short',reasonVersion:1,art},girls:{a:{aspect:'hearthwarden',name:'Hearthpaw',nameFormat:'short',reasonVersion:1,art}}})
    const profiles=charactersById(character({charId:'a',personality:'warm compassionate',backstory:'She became a caregiver for her family.'}))
    const next=assignEchoes(previous,'run',profiles,'Reader','cheerful bubbly')
    expect(next.girls.a.reasonVersion).toBe(2)
    expect(next.girls.a.reasonExamples).toContainEqual(expect.objectContaining({quote:'She became a caregiver for her family.',supportsType:true}))
    for(const [before,after] of [[previous.player,next.player],[previous.girls.a,next.girls.a]]){
      expect(after).toMatchObject({name:before!.name,aspect:before!.aspect,art:before!.art})
    }
    expect(next.playerChangeUsed).toBe(true);expect(next.playerAutoArtAttempted).toBe(true)
    expect(assignEchoes(next,'run',profiles,'Reader','changed bio')).toEqual(next)
  })
  it('suggests unused short names for either owner without changing the saved state',()=>{
    const state=withEchoArtwork(changePlayerEcho(matching(),'dreamglass'),'player',art,'generated')
    const original=structuredClone(state)
    const first=suggestEchoName(state,'player','seed')
    expect(first).not.toMatch(/of the/i)
    expect(suggestEchoName(state,'player','seed',first)).not.toBe(first)
    expect(state).toEqual(original)
    let saved=state
    for(let i=0;i<22;i++){
      const name=suggestEchoName(saved,'a','same seed')
      expect(saved.usedNames.map(n=>n.toLowerCase())).not.toContain(name.toLowerCase())
      saved=renameEcho(saved,'a',name)
    }
    expect(saved.player?.art).toBe(art);expect(saved.playerChangeUsed).toBe(true)
    expect(saved.girls.a.aspect).toBe(state.girls.a.aspect)
    expect(()=>suggestEchoName(state,'missing','seed')).toThrow('Choose an Echo')
  })
  it('turns the saved name into concrete art direction without changing the aspect or prompt scope',()=>{
    const request={requestId:art,identity:matching().girls.a,name:'Test Student',bio:'A cheerful painter.'}
    const frost=echoImagePrompt({...request,identity:{...request.identity,name:'Frostfang'}})
    const ember=echoImagePrompt({...request,identity:{...request.identity,name:'Emberwing'}})
    expect(frost).toContain('icy crystalline details');expect(frost).toContain('tooth or claw motif')
    expect(ember).toContain('warm ember colors');expect(ember).toContain('wing or feather silhouette')
    expect(ember).not.toContain('icy crystalline details')
    for(const prompt of [frost,ember]){expect(prompt).toContain('Daylark');expect(prompt).toContain('A cheerful painter.');expect(prompt).toContain('not text to print')}
    expect(echoNameArtDirection('Veloria')).toContain('sound and mood')
  })
  it('renames either owner while leaving their type, art and one-change state alone',()=>{
    const state=changePlayerEcho(matching(),'dreamglass')
    const named=renameEcho(withEchoArtwork(state,'player',art,'generated'),'player','  Star   Paws  ')
    const girl=renameEcho(named,'a','Frostbite')
    expect(girl.player?.name).toBe('Star Paws');expect(girl.player?.nameSource).toBe('custom');expect(girl.playerChangeUsed).toBe(true)
    expect(girl.player?.art).toBe(art);expect(girl.girls.a.aspect).toBe(state.girls.a.aspect)
    const regenerated=withEchoArtwork(girl,'a',art,'generated')
    expect(regenerated.girls.a.name).toBe('Frostbite');expect(regenerated.playerChangeUsed).toBe(true)
    expect(()=>renameEcho(girl,'b','frostbite')).toThrow('already has');expect(()=>renameEcho(girl,'b','   ')).toThrow('Enter a name')
    expect(()=>renameEcho(girl,'b','x'.repeat(61))).toThrow('60 characters')
    expect(normalizeEcho(JSON.parse(JSON.stringify(girl)))).toEqual(girl)
  })
  it('preserves the chosen type and lock through serialization and carry even when disabled',()=>{
    ensureEchoes()
    useGameStore.setState({exEcho:changePlayerEcho(game().exEcho,'dreamglass')})
    useModsStore.setState({switches:{on:{echo:false},options:{}}})
    const save={...game().toGameSave(),playthroughId:'p',saveId:'autosave',saveDate:0} as GameSave
    const carried=carryModFields(save,{term:0,back:120,characters:game().characters}).exEcho!
    expect(carried).toEqual(save.exEcho);expect(carried.playerChangeUsed).toBe(true)
    expect(normalizeEcho(JSON.parse(JSON.stringify(save)).exEcho)).toEqual(game().exEcho)
    expect(()=>changePlayerEcho(carried,'daylark')).toThrow('already been used')
  })
})
describe('Editable Echo creature design',()=>{
  it('reads old saves without losing their original design and bounds imported custom descriptions',()=>{
    const old=matching()
    expect(echoCreatureOf(old.girls.a)).toEqual({type:ECHO_MOTIFS[old.girls.a.motif],description:''})
    const next=normalizeEcho({...old,girls:{...old.girls,a:{...old.girls.a,creature:{type:'x'.repeat(200),description:'y'.repeat(1400)}},b:{...old.girls.b,creature:{type:' ',description:'invalid'}}}})
    expect(next.girls.a.creature?.type).toHaveLength(100);expect(next.girls.a.creature?.description).toHaveLength(1200)
    expect(next.girls.b.creature).toBeUndefined()
    expect(next.girls.a.aspect).toBe(old.girls.a.aspect)
    expect(()=>editEchoCreature(old,'a',' ','')).toThrow('Enter a monster type')
    expect(()=>editEchoCreature(old,'a','x'.repeat(101),'')).toThrow('100 characters')
    expect(()=>editEchoCreature(old,'a','Wolf','x'.repeat(1201))).toThrow('1,200')
  })
  it('keeps design edits through artwork changes, assignment, serialization and semester carry',()=>{
    ensureEchoes()
    const old=withEchoArtwork(withEchoArtwork(game().exEcho,'player',art,'generated'),'a',art,'uploaded')
    const snapshot=structuredClone(old)
    let next=editEchoCreature(old,'player','  Armored   wolf  ','Silver plates.\r\nA crooked grin.')
    next=editEchoCreature(next,'a','Crystal serpent','Teal scales with amber eyes.')
    expect(old).toEqual(snapshot)
    expect(next.player?.creature).toEqual({type:'Armored wolf',description:'Silver plates.\nA crooked grin.'})
    expect(next.player?.name).toBe(old.player?.name);expect(next.player?.art).toBe(art);expect(next.playerChangeUsed).toBe(false)
    expect(next.girls.a.aspect).toBe(old.girls.a.aspect);expect(next.girls.a.art).toBe(art)
    const changed=changePlayerEcho(next,next.player?.aspect==='dreamglass'?'daylark':'dreamglass')
    expect(changed.player?.creature).toEqual(next.player?.creature);expect(changed.playerChangeUsed).toBe(true)
    const regenerated=withEchoArtwork(changed,'a',art,'generated')
    expect(regenerated.girls.a.creature).toEqual(next.girls.a.creature)
    expect(assignEchoes(regenerated,'next',game().characters,'Reader','').girls.a.creature).toEqual(next.girls.a.creature)
    expect(normalizeEcho(JSON.parse(JSON.stringify(regenerated)))).toEqual(regenerated)
    useGameStore.setState({exEcho:regenerated})
    useModsStore.setState({switches:{on:{echo:false},options:{}}})
    const save={...game().toGameSave(),playthroughId:'p',saveId:'autosave',saveDate:0} as GameSave
    expect(carryModFields(save,{term:0,back:120,characters:game().characters}).exEcho).toEqual(regenerated)
  })
  it('uses the edited species and details in prompts and suggestions without the old creature foundation',()=>{
    const next=editEchoCreature(matching(),'a','Armored wolf','Long legs, copper armor, and a sly smile.')
    const identity={...next.girls.a,name:'Frostfang'}
    const prompt=echoImagePrompt({requestId:art,identity,name:'Student',bio:'Cheerful and bold.'})
    for(const v of ['Armored wolf','Long legs, copper armor, and a sly smile.','Frostfang','icy crystalline details','Daylark','Avoid chibi proportions','without making it stern or grim'])expect(prompt).toContain(v)
    expect(prompt).not.toContain(ECHO_MOTIFS[identity.motif])
    expect(suggestEchoName(next,'a','fixed seed')).toBe(suggestEchoName(matching(),'a','fixed seed','','Armored wolf'))
  })
  it('keeps a committed edit when a scene exchange flushes an older decision', async () => {
    const autosave = vi.spyOn(window.api.saves, 'autosave')
    const flush = prepareAutosave(null)
    const previous = game().exEcho
    const next = editEchoCreature(previous, 'a', 'Copper stag', 'Swept antlers.')
    await writeEcho(next, previous, () => true)
    await flush()
    expect(autosave).toHaveBeenCalledOnce()
    expect(autosave.mock.calls[0][1].exEcho?.girls.a.creature).toEqual(next.girls.a.creature)
  })
  it('saves design changes through the native queue and leaves state alone on failure',async()=>{
    const before=game().exEcho,next=editEchoCreature(before,'a','Copper stag','Swept antlers and a curious expression.')
    await writeEcho(next,before,()=>true)
    expect(game().exEcho.girls.a.creature).toEqual(next.girls.a.creature)
    expect(game().exEcho.girls.a.aspect).toBe(before.girls.a.aspect)
    stubApi({saves:{autosave:async()=>({ok:false,error:{code:'DISK',message:'Disk full'}})}})
    const saved=game().exEcho
    await expect(writeEcho(editEchoCreature(saved,'a','New wolf',''),saved,()=>true)).rejects.toThrow('Disk full')
    expect(game().exEcho).toBe(saved)
  })
})

describe('Echo relationship affinity',()=>{
  it('amplifies matching gains and reduces competing gains, never old or negative memories',()=>{
    const before={a:charInfo({memories:[m('liked','old')]}),b:charInfo()}
    const after={a:charInfo({memories:[m('liked','old'),m('loved','new'),m('hated','bad')],textMemory:m('liked','text'),giftMemories:[m('liked','gift')]}),b:charInfo({memories:[m('loved','competing'),m('disliked','bad')]})}
    const next=settleEchoMemories(matching(),before,after,7)
    setEchoBonusEnabled(true)
    expect(next.a.memories.map(x=>x.echoAffinity)).toEqual([undefined,'matching',undefined])
    expect(next.a.textMemory?.echoAffinity).toBe('matching');expect(next.a.giftMemories?.[0].echoAffinity).toBe('matching')
    expect(next.b.memories.map(x=>x.echoAffinity)).toEqual(['competing',undefined])
    expect(affectionOf(next.a.memories,7)).toBe(6) // 4 + 10 - 8
    expect(affectionOf(next.b.memories,7)).toBe(2) // 6 - 4
    expect(affectionOf(next.a.memories,20)).toBe(3)
    expect(settleEchoMemories(matching(),before,next,7)).toEqual(next)
    expect(after.a.memories[1]).not.toHaveProperty('echoAffinity')
    setEchoBonusEnabled(false);expect(affectionOf(next.a.memories,7)).toBe(4);expect(affectionOf(next.b.memories,7)).toBe(4)
  })
  it('keeps neutral gains unchanged and does not rewrite earned affinity after a type change',()=>{
    const state=matching(),before={a:charInfo(),b:charInfo()},after={a:charInfo({memories:[m('liked')]}),b:charInfo({memories:[m('loved')]})}
    const earned=settleEchoMemories(state,before,after,7)
    expect(echoAffinity(changePlayerEcho(state,'dreamglass'),'a')).toBe('neutral')
    expect(settleEchoMemories(changePlayerEcho(state,'dreamglass'),before,after,7)).toEqual(after)
    expect(settleEchoMemories(changePlayerEcho(state,'veilkeeper'),before,earned,7)).toEqual(earned)
    expect(echoAffinity(changePlayerEcho(state,'veilkeeper'),'a')).toBe('competing')
    setEchoBonusEnabled(true)
    expect(echoMultiplier({...m('liked'),echoBoosted:true})).toBe(1.25)
    expect(echoMultiplier({...m('hated'),echoAffinity:'competing'})).toBe(1)
  })
  it('runs through the enabled settlement hook only, without crossing loaded games',()=>{
    const before=game()
    useGameStore.setState({charInfo:{a:charInfo({memories:[m('liked')]}),b:charInfo()}})
    useModsStore.setState({switches:{on:{echo:false},options:{}}})
    slotSettled({before,ledger:null,closingCast:[]})
    expect(game().charInfo.a.memories[0].echoAffinity).toBeUndefined()
    useModsStore.setState({switches:{on:{echo:true},options:{}}})
    slotSettled({before,ledger:null,closingCast:[]})
    expect(game().charInfo.a.memories[0].echoAffinity).toBe('matching')
    expect(matchingEcho(game().exEcho,'a')).toBe(true)
    useGameStore.setState({playthroughId:'other',charInfo:{a:charInfo({memories:[m('liked')]}),b:charInfo()}})
    slotSettled({before,ledger:null,closingCast:[]})
    expect(game().charInfo.a.memories[0].echoAffinity).toBeUndefined()
  })
})
describe('Echo edits use the save lane',()=>{
  it('persists names and the once-only automatic artwork flag without consuming the type change',async()=>{
    const before=game().exEcho,named=renameEcho(before,'a','Snowdrop')
    await writeEcho({...named,playerAutoArtAttempted:true},before,()=>true)
    expect(game().exEcho.girls.a.name).toBe('Snowdrop');expect(game().exEcho.playerChangeUsed).toBe(false)
    expect(game().toGameSave().exEcho?.playerAutoArtAttempted).toBe(true)
    await expect(writeEcho({...game().exEcho,playerAutoArtAttempted:false},game().exEcho,()=>true)).rejects.toThrow('cannot be reset')
  })
  it('writes the native checkpoint before applying edits',async()=>{
    const save=vi.fn(async(id:string,draft:SaveDraft)=>({ok:true as const,data:{...draft,playthroughId:id,saveId:'autosave',saveDate:0}}))
    stubApi({saves:{autosave:save}})
    const before=game().exEcho,next={...before,opacity:.55}
    await writeEcho(next,before,()=>true)
    expect(save).toHaveBeenCalledWith('echo-test',expect.objectContaining({exEcho:next,scene:null}))
    expect(game().exEcho).toEqual(next)
  })
  it('allows one player change and saves the lock, without carrying the previous type artwork',async()=>{
    const before={...game().exEcho,player:{...game().exEcho.player!,art}}
    useGameStore.setState({exEcho:before})
    const next=changePlayerEcho(before,'dreamglass')
    expect(next.player?.art).toBeUndefined();expect(next.player?.name).not.toBe(before.player.name)
    expect(changePlayerEcho(before,before.player.aspect).playerChangeUsed).toBe(false)
    await writeEcho(next,before,()=>true)
    expect(game().exEcho.playerChangeUsed).toBe(true)
    const locked=game().exEcho
    await expect(writeEcho({...locked,player:{...locked.player!,aspect:'daylark'}},locked,()=>true)).rejects.toThrow('Only one')
    await expect(writeEcho({...locked,playerChangeUsed:false},locked,()=>true)).rejects.toThrow('cannot be reset')
  })
  it('rejects girl type edits at the save boundary but accepts artwork changes for both owners',async()=>{
    const before=game().exEcho
    await expect(writeEcho({...before,girls:{...before.girls,a:{...before.girls.a,aspect:'dreamglass'}}},before,()=>true)).rejects.toThrow('fixed')
    await expect(writeEcho({...before,playerChangeUsed:true},before,()=>true)).rejects.toThrow('artwork')
    const next={...before,girls:{...before.girls,a:{...before.girls.a,art}},player:{...before.player!,art}}
    await writeEcho(next,before,()=>true)
    expect(game().exEcho.playerChangeUsed).toBe(false)
    const locked=changePlayerEcho(game().exEcho,'dreamglass')
    await writeEcho(locked,game().exEcho,()=>true)
    await writeEcho({...locked,player:{...locked.player!,art}},game().exEcho,()=>true)
    expect(game().exEcho.playerChangeUsed).toBe(true);expect(game().exEcho.player?.aspect).toBe('dreamglass')
  })
  it('does not consume the change on failed or stale writes',async()=>{
    const before=game().exEcho,next=changePlayerEcho(before,'dreamglass')
    stubApi({saves:{autosave:async()=>({ok:false,error:{code:'DISK',message:'Disk full'}})}})
    await expect(writeEcho(next,before,()=>true)).rejects.toThrow('Disk full')
    expect(game().exEcho).toBe(before);expect(game().exEcho.playerChangeUsed).toBe(false)
    await expect(writeEcho(next,before,()=>false)).rejects.toThrow('safe save')
  })
})
