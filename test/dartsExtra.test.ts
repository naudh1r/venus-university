import { describe, expect, it } from 'vitest'
import { newExtraMatch, extraSummary, extraThrow, extraModeUnavailable, planExtraVisit, applyExtraPlan, targetRegion, scoreHit, type ExtraDartsMatch, type ExtraDartsMode } from '../src/shared/minigameRules/darts'
const seats = [
 { id:'reader',name:'You',kind:'reader' as const },
 { id:'a',name:'Ana',kind:'npc' as const,skill:5,traits:{version:1,accuracy:90,consistency:90,composure:90} },
 { id:'b',name:'Bea',kind:'npc' as const,skill:4,traits:{version:1,accuracy:80,consistency:80,composure:80} }
]
const fresh = (mode:ExtraDartsMode, seed=42, long=false) => newExtraMatch({id:'test',mode,seed,long,target:301,seats: mode==='precision'||mode==='exact'?seats.slice(0,2):seats})
const dart=(g:ExtraDartsMatch,n:number,kind:'single'|'double'|'triple'='single')=>extraThrow(g,targetRegion(n,kind))
const miss=(g:ExtraDartsMatch)=>extraThrow(g,{x:1.3,y:0})
const visit=(g:ExtraDartsMatch,points=0)=>{const index=extraSummary(g).visit;while(!extraSummary(g).done&&extraSummary(g).visit===index)g=points?dart(g,points):miss(g);return g}

describe('additional mode gates',()=>{
 it('enforces companion counts and inclusive skill boundaries',()=>{
  expect(extraModeUnavailable('girls-team',[1,1])).toBeNull();expect(extraModeUnavailable('girls-team',[5])).toBeTruthy()
  expect(extraModeUnavailable('leader',[1,1])).toBeNull();expect(extraModeUnavailable('precision',[3])).toBeTruthy()
  expect(extraModeUnavailable('precision',[4])).toBeNull();expect(extraModeUnavailable('precision',[5,5])).toBeTruthy()
  expect(extraModeUnavailable('exact',[2])).toBeTruthy();expect(extraModeUnavailable('exact',[3])).toBeNull()
  expect(()=>newExtraMatch({id:'low',mode:'precision',seed:1,seats:[seats[0],{...seats[1],skill:3}]})).toThrow(/tier 4/)
 })
})
describe('two girls versus the reader',()=>{
 it('shares the girls balance and orders girl 1, girl 2, reader',()=>{
  let g=fresh('girls-team');expect(extraSummary(g).currentSeatId).toBe('a')
  g=visit(g,20);expect(extraSummary(g).girlsBalance).toBe(241);expect(extraSummary(g).currentSeatId).toBe('b')
  g=visit(g,10);expect(extraSummary(g).girlsBalance).toBe(211);expect(extraSummary(g).balances.reader).toBe(301);expect(extraSummary(g).currentSeatId).toBe('reader')
  g=visit(g,5);expect(extraSummary(g).balances.reader).toBe(286);expect(extraSummary(g).girlsBalance).toBe(211)
 })
 it('cancels a bust visit, preserves the other girl’s earlier points, and skips unused darts',()=>{
  let g=fresh('girls-team');for(let i=0;i<5;i++)g=dart(g,20,'triple'); // team at 1; first girl contributed 180
  g=dart(g,2);expect(extraSummary(g).girlsBalance).toBe(121);expect(extraSummary(g).currentSeatId).toBe('reader');expect(extraSummary(g).visits.at(-1)?.bust).toBe(true)
 })
 it('ends immediately on either side’s checkout and credits both girls',()=>{
  let g=fresh('girls-team');for(let i=0;i<5;i++)g=dart(g,20,'triple');g=dart(g,1)
  expect(extraSummary(g)).toMatchObject({done:true,outcome:'lost',winnerIds:['a','b'],girlsBalance:0});expect(()=>miss(g)).toThrow()
 })
 it('limits both sides to three rounds and uses lower remaining balance',()=>{
  let g=fresh('girls-team');for(let i=0;i<27;i++)g=miss(g)
  expect(extraSummary(g)).toMatchObject({done:true,outcome:'draw',visit:9});expect(g.throws.filter(d=>d.seatId==='reader')).toHaveLength(9)
 })
})
describe('chase the leader',()=>{
 it('gives each successful challenger a point, including exact ties',()=>{
  let g=fresh('leader');g=visit(g,10);g=visit(g,10);g=visit(g,20)
  expect(extraSummary(g).points).toEqual({reader:0,a:1,b:1})
 })
 it('reports a reader loss when the two girls share first place',()=>{
  let g=fresh('leader');g=visit(g);g=visit(g,20);g=visit(g,20)
  g=visit(g,20);g=visit(g,20);g=visit(g)
  g=visit(g,20);g=visit(g);g=visit(g,20)
  expect(extraSummary(g)).toMatchObject({done:true,outcome:'lost',winnerIds:['a','b']})
 })
 it('gives the leader exactly one point only if both challengers fail',()=>{
  let g=fresh('leader');g=visit(g,20);g=visit(g,10);g=visit(g,5)
  expect(extraSummary(g).points).toEqual({reader:1,a:0,b:0})
 })
 it.each([false,true])('rotates leaders equally, completes all rounds and supports shared wins (long=%s)',long=>{
  let g=fresh('leader',42,long);while(!extraSummary(g).done)g=miss(g)
  const s=extraSummary(g);expect(s.outcome).toBe('draw');expect(s.winnerIds).toEqual(['reader','a','b'])
  const leaders=s.visits.filter(v=>v.index%3===0).map(v=>v.seatId)
  for(const seat of seats)expect(leaders.filter(id=>id===seat.id)).toHaveLength(long?3:1)
 })
})
describe('precision duel',()=>{
 it('seeds a non-repeating set of two doubles, two triples and a bull',()=>{
  const g=fresh('precision');expect(g.precisionTargets).toEqual(fresh('precision').precisionTargets);expect(g.precisionTargets).not.toEqual(fresh('precision',43).precisionTargets)
  expect(g.precisionTargets.filter(t=>t.kind==='double')).toHaveLength(2);expect(g.precisionTargets.filter(t=>t.kind==='triple')).toHaveLength(2)
  expect(new Set(g.precisionTargets.map(t=>`${t.kind}-${t.number}`)).size).toBe(5)
  expect(JSON.parse(JSON.stringify(g)).precisionTargets).toEqual(g.precisionTargets)
 })
 it('awards only the exact ring and number, with three scoring darts each',()=>{
  let g=fresh('precision');const t=g.precisionTargets[0];g=extraThrow(g,targetRegion(t.number,t.kind));g=miss(g);g=extraThrow(g,targetRegion(t.number,t.kind))
  expect(extraSummary(g).points.reader).toBe(2);expect(extraSummary(g).round).toBe(0)
  g=extraThrow(g,targetRegion(t.number,t.kind==='double'?'triple':'single'));expect(extraSummary(g).points.a).toBe(0)
 })
 it('ends after five shared targets without cutting off the second player',()=>{
  let g=fresh('precision');while(!extraSummary(g).done)g=miss(g)
  expect(g.throws).toHaveLength(30);expect(extraSummary(g).outcome).toBe('draw')
 })
})
describe('exact total',()=>{
 it('accepts equivalent score combinations and compares darts used',()=>{
  let g=fresh('exact');g={...g,exactTargets:[12,...g.exactTargets.slice(1)]};g=dart(g,6,'double');g=dart(g,6);g=dart(g,6)
  expect(extraSummary(g).points).toEqual({reader:1,a:0});expect(extraSummary(g).round).toBe(1)
 })
 it('resets on bust without refunding darts, then permits a later exact finish',()=>{
  let g=fresh('exact');g={...g,exactTargets:[12,...g.exactTargets.slice(1)]};g=dart(g,6);g=dart(g,7)
  expect(extraSummary(g)).toMatchObject({dart:3,currentSeatId:'reader'});expect(extraSummary(g).visits[0].remaining).toBe(12)
  g=dart(g,4,'triple');expect(extraSummary(g).visits[0]).toMatchObject({success:true,closed:true,total:12});expect(extraSummary(g).currentSeatId).toBe('a')
 })
 it('makes a successful third-dart finish beat failure, while equal finishes share a point',()=>{
  let g=fresh('exact');g={...g,exactTargets:[12,12,...g.exactTargets.slice(2)]};g=miss(miss(g));g=dart(g,4,'triple');g=visit(g)
  expect(extraSummary(g).points.reader).toBe(1);g=dart(g,6,'double');g=dart(g,4,'triple');expect(extraSummary(g).points).toEqual({reader:2,a:1})
 })
 it('generates five reachable distinct targets and ends after five rounds',()=>{
  let g=fresh('exact');expect(new Set(g.exactTargets).size).toBe(5);for(const n of g.exactTargets){expect(n).toBeGreaterThan(20);expect(n).toBeLessThanOrEqual(60);expect(n===50||n<=40&&n%2===0||n%3===0).toBe(true)}
  while(!extraSummary(g).done)g=miss(g);expect(g.throws).toHaveLength(30)
 })
})
describe('mode-specific NPC simulation',()=>{
 it.each(['girls-team','leader','precision','exact'] as const)('plans deterministic visits and rejects reapplication in %s',mode=>{
  let g=fresh(mode)
  if(extraSummary(g).currentSeatId==='reader')g=visit(g)
  const saved=JSON.stringify(g),plan=planExtraVisit(g);expect(plan).toEqual(planExtraVisit(g));expect(JSON.stringify(g)).toBe(saved)
  expect(plan.length).toBeGreaterThan(0);expect(plan.length).toBeLessThanOrEqual(3)
  for(const item of plan){g=applyExtraPlan(g,item);expect(()=>applyExtraPlan(g,item)).toThrow(/Stale/)}
 })
 it('aims at the actual precision target, not triple 20',()=>{
  let g=fresh('precision');g=visit(g);const t=g.precisionTargets[0]
  for(const item of planExtraVisit(g))expect(scoreHit(item.target.x,item.target.y)).toMatchObject({kind:t.kind,number:t.number})
 })
})
