import { describe, expect, it } from 'vitest'
import { buyTalent, normalizeTalents, seedTalents, settleTalentPoints, talentBalance } from '@shared/campusTalents'
import { readBondFraction, talentBondRate } from '@shared/talentBondPoints'
import { breakDecayedStats, type PlayerStats } from '@shared/playerStats'
import { charInfo } from './fixtures'

const stats=(n:number):PlayerStats=>({brain:n,body:n,heart:n})
const state=()=>normalizeTalents({initialized:true,earned:0})
const liked={a:charInfo({memories:[{date:7,type:'liked',desc:'A good meeting'}]})}
const loved={a:charInfo({memories:[{date:7,type:'loved',desc:'A wonderful meeting'}]})}

describe('BP scaling across the full stat range',()=>{
  it.each([
    [-100,3],[-80,2.8],[-60,2.6],[-30,1.5],[-15,1.25],[-1,1+1/60],
    [0,1],[1,.995],[30,.85],[60,.7],[100,.5]
  ])('uses the expected reward multiplier at average %i', (n,rate)=>{
    const result=talentBondRate(stats(n))
    expect(result.average).toBeCloseTo(n,12)
    expect(result.multiplier).toBeCloseTo(rate,12)
  })
  it('matches the independently calculated playtest curve at fractional values and clamped endpoints',()=>{
    for(let n=-150;n<=150;n+=.125) {
      const a=Math.max(-100,Math.min(100,n))
      const expected=a<=-60?2-a/100:a<=-30?.4-a*1.1/30:a<=0?1-a/60:1-a/200
      expect(talentBondRate(stats(n)).multiplier).toBeCloseTo(expected,12)
    }
    for(const n of [-100,-80,-60,-30,-15,0,100]) {
      expect(Math.abs(talentBondRate(stats(n-1e-6)).multiplier-talentBondRate(stats(n+1e-6)).multiplier)).toBeLessThan(1e-7)
    }
    expect(talentBondRate(stats(-.5)).multiplier).toBeCloseTo(1+1/120,12)
  })
  it('uses all three stats equally and caps the final rate, including beyond Godly',()=>{
    expect(talentBondRate({brain:-100,body:0,heart:100})).toEqual({average:0,multiplier:1})
    expect(talentBondRate({brain:0,body:0,heart:-60}).multiplier).toBeCloseTo(4/3)
    expect(talentBondRate(stats(-1000)).multiplier).toBe(3)
    expect(talentBondRate(stats(1000)).multiplier).toBe(.5)
    expect(talentBondRate({brain:NaN,body:Infinity,heart:0})).toEqual({average:0,multiplier:1})
  })
  it.each([[-100,3,6],[-80,2.8,5.6],[-60,2.6,5.2],[-30,1.5,3],[-15,1.25,2.5],[0,1,2],[100,.5,1]])(
    'awards scaled liked/loved BP and banks the fraction at %i',(n,like,love)=>{
      for(const [after,expected] of [[liked,like],[loved,love]] as const) {
        const s=settleTalentPoints(state(),{},after,0,7,0,stats(n))
        expect(s.earned).toBe(Math.floor(expected))
        expect(s.earned+(s.bpFraction??0)).toBeCloseTo(expected,12)
      }
    })
  it('carries fractional BP through repeated save/load cycles without rounding each reward up',()=>{
    let s=state()
    for(let term=0;term<5;term++) {
      s=normalizeTalents(JSON.parse(JSON.stringify(settleTalentPoints(s,{},loved,term,7,0,stats(-15)))))
    }
    expect(s.earned).toBe(12)
    expect(s.bpFraction).toBe(.5)
  })
  it('shares no BP between stat buckets and accumulates mixed-stat fractional rates accurately',()=>{
    let s=state()
    for(let term=0;term<3;term++) s=settleTalentPoints(s,{},liked,term,7,0,{brain:-100,body:0,heart:0})
    expect(s.earned).toBe(4);expect(s.bpFraction).toBeCloseTo(13/15,12)
  })
  it('keeps the existing fractional balance when the player crosses zero or earns nothing',()=>{
    const first=settleTalentPoints(state(),{},liked,0,7,0,stats(-15))
    const changed=settleTalentPoints(first,{},liked,0,7,1,stats(100))
    expect(changed.earned).toBe(1);expect(changed.bpFraction).toBeCloseTo(.75,12)
    const none=settleTalentPoints(changed,liked,liked,1,7,0,stats(-100))
    expect(none.earned).toBe(changed.earned);expect(none.bpFraction).toBe(changed.bpFraction)
    expect(settleTalentPoints(changed,{},liked,0,7,1,stats(-100))).toEqual(changed)
  })
  it('scales the deduplicated total across characters and sources once, ignoring negative memories',()=>{
    const positive=liked.a.memories[0]
    const after={a:charInfo({memories:[positive],textMemory:positive,giftMemories:loved.a.memories}),
      b:charInfo({memories:[loved.a.memories[0],{date:7,type:'hated',desc:'A bad meeting'}]})}
    const s=settleTalentPoints(state(),{},after,0,7,0,stats(-100))
    expect(s.earned).toBe(15);expect(s.bpFraction).toBeCloseTo(0,12)
    expect(s.recent.at(-1)).toMatchObject({points:15,characters:2})
    expect(settleTalentPoints(s,{},after,0,7,0,stats(-100))).toEqual(s)
  })
  it('preserves existing grants and purchases; fractions are not spendable until whole',()=>{
    const legacy={initialized:true,earned:123,seed:70,spent:15,ranks:{wages:1}}
    const s=normalizeTalents(legacy)
    expect(s).toMatchObject(legacy);expect(s.bpFraction).toBeUndefined()
    expect(seedTalents(s,999,0,7)).toEqual(s)
    expect(seedTalents(normalizeTalents(),100,0,7).seed).toBe(100)
    const poor=normalizeTalents({initialized:true,earned:14,bpFraction:.99})
    expect(talentBalance(poor)).toBe(14)
    expect(()=>buyTalent(poor,'wages',()=>true)).toThrow('more Bond')
    expect(buyTalent({...poor,earned:15},'wages',()=>true).bpFraction).toBe(.99)
  })
  it('earns more after native semester decay without issuing a break grant or changing saved progress',()=>{
    const ending=stats(48), opening=breakDecayedStats(ending)
    expect(opening).toEqual(stats(15))
    const s=normalizeTalents({initialized:true,earned:100,spent:60,ranks:{'brain.focus':2},growth:stats(.25)})
    const old=structuredClone(s)
    const before=settleTalentPoints(s,{},loved,0,7,0,ending)
    const after=settleTalentPoints(s,{},loved,1,7,0,opening)
    expect(before.earned+(before.bpFraction??0)-s.earned).toBeCloseTo(1.52,12)
    expect(after.earned+(after.bpFraction??0)-s.earned).toBeCloseTo(1.85,12)
    expect(s).toEqual(old)
    expect(after).toMatchObject({spent:60,ranks:s.ranks,growth:s.growth})
  })
  it('rejects invalid saved fractions and preserves the wallet ceiling',()=>{
    for(const n of [-1,1,NaN,Infinity,'0.5',null]) {
      expect(readBondFraction(n)).toBeUndefined()
      expect(normalizeTalents({bpFraction:n}).bpFraction).toBeUndefined()
    }
    expect(readBondFraction(.99)).toBe(.99)
    const s=settleTalentPoints(normalizeTalents({initialized:true,earned:99999999,bpFraction:.5}),{},loved,0,7,0,stats(-100))
    expect(s.earned).toBe(100000000);expect(s.bpFraction).toBe(0)
    expect(s.recent.at(-1)?.points).toBe(1)
  })
})
