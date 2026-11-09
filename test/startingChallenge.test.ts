import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { challengeStatFloor, challengeForStartingStats, challengeStartingStats, readStartingChallenge, startingChallengeForSetup, type StartingChallenge } from '@shared/startingChallenge'
import { applyStatDeltas, breakDecayedStats, describePlayer, displayedTierOf, nextTierPoints, statsForStartingTiers, tierName, tierOf, tierUps } from '@shared/playerStats'
import { examScore, projectScore } from '@shared/academics'
import { carriedModFields, carryModFields } from '@shared/modCarry'
import { withMod, withOption } from '@shared/mods'
import type { GameSave } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { playthroughRecord } from './fixtures'
import { loopState, resetLoopState } from '../src/renderer/stores/loop/state'
import '../src/renderer/modEntries/starting-challenge'
import { statFloor } from '../src/renderer/mods/hooks'

const stats = (value: number) => ({ brain: value, body: value, heart: value })
const game = () => useGameStore.getState()
const originalSwitches = useModsStore.getState().switches
beforeEach(() => { game().reset(); resetLoopState(); loopState.record = playthroughRecord({mods:['starting-challenge']}) })
afterEach(() => { game().reset(); resetLoopState(); useModsStore.setState({ switches: originalSwitches }) })

describe('Starting Challenge save rules', () => {
  it('uses the saved playthrough choice through the hook, not the current new-game switch', () => {
    useModsStore.setState({switches:{on:{'starting-challenge':false},options:{}}})
    useGameStore.setState({exStartingChallenge:{version:2,floors:{brain:-100,body:-30,heart:-15}}})
    expect(['brain','body','heart'].map(key=>statFloor(key as 'brain'|'body'|'heart'))).toEqual([-100,-30,-15])
    // A normal record cannot acquire challenge floors from stray imported fields.
    loopState.record=playthroughRecord({mods:[]})
    expect(statFloor('brain')).toBeUndefined()
    game().applyStatDeltas(stats(-200))
    expect(game().stats).toEqual(stats(-15))
  })
  it('round-trips mixed -80/-100 starts and locks each original floor across save/carry', () => {
    const opening=statsForStartingTiers({brain:-4,body:-3,heart:-2})
    expect(opening).toEqual({brain:-100,body:-80,heart:-60})
    const chosen=challengeForStartingStats(opening,startingChallengeForSetup(undefined,true))
    expect(chosen).toEqual({version:2,floors:opening})
    expect(startingChallengeForSetup({exStartingChallenge:chosen},false)).toEqual(chosen)
    useGameStore.setState({exStartingChallenge:chosen,stats:opening})
    game().applyStatDeltas({brain:25,body:25,heart:25})
    const saved=JSON.parse(JSON.stringify({...game().toGameSave(),playthroughId:'deep-test',saveId:'autosave',saveDate:0})) as GameSave
    game().reset();game().loadSave(saved,playthroughRecord({mods:['starting-challenge']}),{})
    expect(game().stats).toEqual({brain:-75,body:-55,heart:-35})
    expect(carriedModFields(carryModFields(saved,{term:0,back:140,characters:{}})).exStartingChallenge).toEqual(chosen)
    game().applyStatDeltas(stats(-200));expect(game().stats).toEqual(opening)
    expect(breakDecayedStats(opening)).toEqual(opening)
  })

  it('recognizes every deep recovery boundary and supplies readable descriptions', () => {
    const chosen=challengeForStartingStats(stats(-100),startingChallengeForSetup(undefined,true))
    for(const [before,after,tier] of [[-81,-80,-3],[-61,-60,-2],[-31,-30,-1],[-16,-15,0],[-1,0,1]] as const){
      expect(nextTierPoints(before)).toBe(after)
      expect(displayedTierOf(after)).toBe(tier)
      expect(tierUps(stats(before),stats(1),key=>challengeStatFloor(chosen,key))).toEqual(['brain','body','heart'])
    }
    expect(tierName(-80)).toBe('Life’s Punchline');expect(tierName(-100)).toBe('Peaked in the Womb')
    for(let n=-100;n<=0;n++){
      expect(applyStatDeltas(stats(n),stats(1),key=>challengeStatFloor(chosen,key))).toEqual(stats(n+1))
      expect(tierOf(n)).toBe(n<0?0:1)
      const prose=describePlayer(stats(n));expect(prose).not.toContain('undefined');expect(prose.length).toBeGreaterThan(35)
    }
    expect(applyStatDeltas(stats(-80),stats(0))).toEqual(stats(-15))
    for(const n of [-101,-99,-81,-79,NaN,Infinity])expect(readStartingChallenge({version:2,floors:stats(n)})).toBeUndefined()
  })

  it.each([-80,-100])('preserves native academic penalties at %i rather than compensating the challenge', n => {
    expect(examScore({present:true,correct:10,asked:10,skipped:0,brain:n,difficulty:'easy',exam:'midterm'})).toBe(0)
    expect(projectScore({present:true,worked:10,needed:10,brain:n,heart:n,difficulty:'easy',exam:'midterm'})).toBe(0)
    expect(examScore({present:true,correct:10,asked:10,skipped:0,brain:0,difficulty:'easy',exam:'midterm'})).toBe(50)
  })

  it('seeds only a fresh enabled setup and preserves a resumed choice or an older normal enrollment', () => {
    expect(startingChallengeForSetup(undefined, false)).toBeUndefined()
    expect(startingChallengeForSetup(undefined, true)).toEqual({ version: 2, floors: stats(-100) })
    expect(startingChallengeForSetup({ exStartingChallenge: 'uphill-battle' }, false)).toBe('uphill-battle')
    expect(startingChallengeForSetup({}, true)).toBeUndefined()
    expect(startingChallengeForSetup({ exStartingChallenge: 'edited' }, true)).toBeUndefined()
    const chosen = { brain: 15, body: 35, heart: -15 }
    expect(challengeStartingStats(chosen)).toEqual(chosen)
    expect(challengeStartingStats(chosen, 'rock-bottom')).toEqual(stats(-60))
    expect(chosen).toEqual({ brain: 15, body: 35, heart: -15 })
  })

  it('banks independent floors and preserves earned mixed progress across registration, saves and carry', () => {
    const opening = statsForStartingTiers({ brain: -1, body: -2, heart: 1 })
    expect(opening).toEqual({ brain: -30, body: -60, heart: 0 })
    const chosen = challengeForStartingStats(opening, startingChallengeForSetup(undefined, true))
    expect(chosen).toEqual({ version: 2, floors: { brain: -30, body: -60, heart: -15 } })
    expect(startingChallengeForSetup({ exStartingChallenge: chosen }, false)).toEqual(chosen)
    useGameStore.setState({ exStartingChallenge: chosen, stats: opening })
    game().applyStatDeltas({ brain: 16, body: 31, heart: 3 })
    const saved = JSON.parse(JSON.stringify({ ...game().toGameSave(), playthroughId: 'mixed-test', saveId: 'autosave', saveDate: 0 })) as GameSave
    game().reset()
    game().loadSave(saved, playthroughRecord({mods:['starting-challenge']}), {})
    expect(game().stats).toEqual({ brain: -14, body: -29, heart: 3 })
    expect(game().exStartingChallenge).toEqual(chosen)
    expect(carriedModFields(carryModFields(saved, { term: 0, back: 140, characters: {} })).exStartingChallenge).toEqual(chosen)
    game().applyStatDeltas(stats(-200))
    expect(game().stats).toEqual({ brain: -30, body: -60, heart: -15 })
    expect(readStartingChallenge({ version: 2, floors: { brain: -999, body: -60, heart: -15 } })).toBeUndefined()
    expect(readStartingChallenge({ version: 2, floors: { brain: -30 } })).toBeUndefined()
  })

  it('recognizes lower recovery milestones without renumbering native job and attraction tiers', () => {
    const chosen = challengeForStartingStats(stats(-60), startingChallengeForSetup(undefined, true))
    expect(tierUps({ brain: -31, body: -16, heart: -1 }, stats(1), key=>challengeStatFloor(chosen,key))).toEqual(['brain', 'body', 'heart'])
    expect(nextTierPoints(-59)).toBe(-30)
    expect(nextTierPoints(-30)).toBe(-15)
    expect(nextTierPoints(-15)).toBe(0)
    expect(tierOf(-60)).toBe(0)
    expect(tierOf(15)).toBe(2)
    expect(statsForStartingTiers({ brain: 0, body: 2, heart: 5 })).toEqual({ brain: -15, body: 15, heart: 100 })
  })

  it.each<[StartingChallenge, number]>([['uphill-battle', -30], ['rock-bottom', -60]])(
    'keeps %s below the native floor, pays only earned gains and respects its loss floor', (mode, floor) => {
      const start = challengeStartingStats(stats(0), mode)
      expect(applyStatDeltas(start, stats(1), key=>challengeStatFloor(mode,key))).toEqual(stats(floor + 1))
      expect(applyStatDeltas(start, stats(0), key=>challengeStatFloor(mode,key))).toEqual(start)
      expect(applyStatDeltas(stats(floor + 2), stats(-5), key=>challengeStatFloor(mode,key))).toEqual(start)
      expect(applyStatDeltas(stats(-16), stats(2), key=>challengeStatFloor(mode,key))).toEqual(stats(-14))
      expect(applyStatDeltas(stats(-1), stats(2), key=>challengeStatFloor(mode,key))).toEqual(stats(1))
      expect(tierUps(stats(-1), stats(1), key=>challengeStatFloor(mode,key))).toEqual(['brain', 'body', 'heart'])
      expect(tierUps(start, stats(1), key=>challengeStatFloor(mode,key))).toEqual([])
      expect(breakDecayedStats(start)).toEqual(start)
      expect(applyStatDeltas(stats(0), stats(-90))).toEqual(stats(-15))
    }
  )

  it('round-trips earned progress and its difficulty through saves and semester carry, regardless of current switches', () => {
    useGameStore.setState({ exStartingChallenge: 'rock-bottom', stats: stats(-60) })
    game().applyStatDeltas(stats(7))
    const saved = JSON.parse(JSON.stringify({ ...game().toGameSave(), playthroughId: 'challenge-test', saveId: 'autosave', saveDate: 0 })) as GameSave
    let switches = withMod(originalSwitches, 'starting-challenge', false)
    switches = withOption(switches, 'starting-challenge', 'uphill-battle', true)
    useModsStore.setState({ switches })
    game().reset()
    game().loadSave(saved, playthroughRecord({mods:['starting-challenge']}), {})
    expect(game().stats).toEqual(stats(-53))
    expect(game().exStartingChallenge).toBe('rock-bottom')
    game().applyStatDeltas(stats(1))
    expect(game().stats).toEqual(stats(-52))
    const carried = carryModFields(saved, { term: 0, back: 140, characters: {} })
    expect(carriedModFields(carried).exStartingChallenge).toBe('rock-bottom')
    // Loading a normal save after a challenge must clear the challenge floor.
    delete saved.exStartingChallenge
    saved.stats = stats(-15)
    game().loadSave(saved, playthroughRecord({mods:['starting-challenge']}), {})
    expect(game().exStartingChallenge).toBeUndefined()
    game().applyStatDeltas(stats(-10))
    expect(game().stats).toEqual(stats(-15))
  })
})
