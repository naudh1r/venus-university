import {expect,it} from 'vitest'
import {firstPersonThought} from '@shared/reckoningVoice'
import {unspokenWhispers} from '@shared/unspokenVoice'
import {parseReckoningThoughts,normalizeReckoning,type ReckoningContext} from '@shared/reckoning'
import type {ReckoningDungeon} from '@shared/reckoningDungeonState'
import {beginReckoningPrompt} from '../src/renderer/prompts/reckoningPrompt'

const context:ReckoningContext={name:'Zira Vale',reader:'Reader',evidence:[{id:'e1',kind:'profile',text:'Competitive and guarded.'}]}
const thoughts=[
 {belief:'Zira believes everything is a power struggle.',challenge:'I cannot afford to let my guard down.',evidence:['e1']},
 {belief:'She expects everyone to leave.',challenge:'I feel alone when I need someone.',evidence:['e1']},
 {belief:'My mistakes decide what I am worth.',challenge:'Why would you stay with me?',evidence:['e1']}
]
const dungeon:ReckoningDungeon={id:'link',charId:'zira',aspect:'wildspark',phase:'unlocked',unlockedByReckoning:true,context,replies:0,farewellReplies:0,lines:[],thoughts}

it('repairs the named narrator opener without losing its belief, and keeps direct first-person thoughts intact',()=>{
 expect(firstPersonThought(thoughts[0].belief,context.name)).toBe('I believe everything is a power struggle.')
 expect(firstPersonThought('Zira Vale is always one mistake away from losing everything.',context.name)).toBe('I am always one mistake away from losing everything.')
 expect(firstPersonThought("Zira’s worth depends on winning.",context.name)).toBe('My worth depends on winning.')
 for(const line of ['People only care about me when I entertain them.','If I ask for help, I am a burden.',"I’m afraid my mother will leave; she has done it before."])
  expect(firstPersonThought(line,context.name)).toBe(line)
 expect(firstPersonThought('“My mistakes decide what I am worth.”',context.name)).toBe(thoughts[2].belief)
})

it('does not rewrite ambiguous other-person pronouns or print outside narration as a whisper',()=>{
 expect(firstPersonThought('Zira feels her sister never listens to her.',context.name)).toBeNull()
 expect(firstPersonThought('Her attitude is defensive.',context.name)).toBeNull()
 expect(firstPersonThought('Zira argues that I will let her down.',context.name)).toBeNull()
 const legacy={...dungeon,thoughts:[{...thoughts[0],belief:'Zira feels her sister never listens to her.'},{...thoughts[1],belief:'Everything is a power struggle.',challenge:'The reader should challenge this.'},thoughts[2]]}
 expect(unspokenWhispers(legacy)).toEqual([thoughts[0].challenge,thoughts[2].belief])
 expect(legacy.thoughts[0].belief).toBe('Zira feels her sister never listens to her.')
 expect(unspokenWhispers({...dungeon,thoughts:undefined,voice:{turns:0,index:0,date:0,time:0,serial:0,beat:'Her thoughts intrude. “Zira believes everything is a power struggle.”'}})).toEqual(['I believe everything is a power struggle.'])
})

it('validates new generation while retaining old saved encounters and their answers',()=>{
 expect(parseReckoningThoughts({thoughts},context,true).map(t=>t.belief)).toEqual(['I believe everything is a power struggle.','I expect everyone to leave.',thoughts[2].belief])
 const bad=thoughts.map(t=>({...t}));bad[0].belief='Zira feels her sister never listens to her.'
 expect(()=>parseReckoningThoughts({thoughts:bad},context,true)).toThrow('first-person')
 const active={id:dungeon.id,charId:dungeon.charId,context,thoughts:bad,answers:[{reply:'I will listen.',reframe:'I can accept support.'}],challenge:bad[1].challenge,feedback:'A new possibility.',attempts:1}
 const loaded=normalizeReckoning({version:1,active,dungeon:{...dungeon,phase:'inside',thoughts:bad}})
 expect(loaded.active).toEqual(active)
 expect(unspokenWhispers(loaded.dungeon!)[0]).toBe(bad[0].challenge)
 const prompt=beginReckoningPrompt(context)
 expect(prompt.system).toContain('every belief as her own first-person thought')
})
