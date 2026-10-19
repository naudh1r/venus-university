import { describe, expect, it } from 'vitest'
import { affectionOf } from '@shared/relationship'
import { calendarOf, semesterOf, type SemesterView } from '@shared/semesters'
import { emptyTallies } from '@shared/tallies'
import { DEFAULT_PLAYER_STATS } from '@shared/playerStats'
import type { CharInfo, CharProfile, JobState } from '@shared/types'
import { emptyBunnyboard } from '@shared/types'
import { carryOf, type CarryInput } from '../src/renderer/stores/semesterCarry'
import { charInfo, playthroughRecord } from './fixtures'

/**
 * The carry from one semester's ending into the next: a date left on the old clock, a profile
 * field leaking into a save, or a year moved on the wrong ending writes a next semester that is
 * wrong for every save after it, and nothing throws.
 */

/** A settled half with only what the carry reads. */
function profile(year: number, intake?: CharProfile['intake']): CharProfile {
  return {
    year,
    dorm: 'lowrise_2',
    major: 'History',
    schedule: { 0: 'HIS 101' },
    hiddenSchedule: { 3: { location: 'library', kind: 'study' } },
    springBreakPlans: 'Go home.',
    ...(intake ? { intake } : {})
  }
}

/** The ending's state, with nothing in it unless a test puts it there. */
function input(over: Partial<CarryInput> = {}): CarryInput {
  return {
    date: 123,
    stats: DEFAULT_PLAYER_STATS,
    money: 250,
    bio: 'a runner',
    tallies: { ...emptyTallies(), kisses: 3 },
    charInfo: {},
    bunnyboard: emptyBunnyboard(),
    inventory: [{ itemId: 'rose', count: 2 }],
    job: null,
    jobsClosed: [],
    formerJobs: {},
    transcript: null,
    gradesStanding: 'good',
    classRecords: {},
    classes: {},
    playerSchedule: { 0: 'HIS 101' },
    calendar: calendarOf('spring', []),
    finalsScoresShown: true,
    history: { 4: { 0: 'met Ana' } },
    replays: {},
    events: [],
    bunnymapUnlocked: true,
    bunnyshopUnlocked: true,
    venusJobIntroSent: true,
    bunnybotContactIntroSent: true,
    bunnybotFirstPostNudgeSent: false,
    bunnybotTwoTimingTipSent: false,
    bunnybotSeenTipSent: false,
    bunnybotDeferred: [],
    bunnybotThrough: 245,
    npcRelationships: {},
    npcFriendships: [],
    ...over
  }
}

/** A spring's view of a roster and its profiles. */
function springView(profiles: Record<string, CharProfile>): SemesterView {
  return semesterOf(playthroughRecord({ chars: Object.keys(profiles), profiles }))
}

/** One girl's merged entry, as the store holds it, over her profile. */
function entry(of: CharProfile, over: Partial<CharInfo> = {}): CharInfo {
  return charInfo({ ...of, ...over })
}

describe('who stays and who graduates', () => {
  it('graduates a spring’s seniors and moves only the August intake up a year', () => {
    const profiles = {
      fresh: profile(1),
      junior: profile(3),
      senior: profile(4)
    }
    const handoff = carryOf(input(), springView(profiles))

    expect(handoff.index).toBe(1)
    expect(handoff.graduated).toEqual(['senior'])
    expect(handoff.continuing).toEqual(['fresh', 'junior'])
    expect(handoff.alumni).toEqual(['senior'])
    expect(handoff.priorProfiles.fresh).toMatchObject({ year: 1, intake: 'spring' })
    expect(handoff.priorProfiles.junior).toMatchObject({ year: 4, intake: 'fall' })
    // A graduate keeps her year and major, and her week is emptied.
    expect(handoff.priorProfiles.senior).toMatchObject({ year: 4, major: 'History', schedule: {} })
    expect(handoff.priorProfiles.senior.hiddenSchedule).toBeUndefined()
    // Break plans are asked again before the next spring.
    expect(handoff.priorProfiles.fresh.springBreakPlans).toBeUndefined()
  })

  it('graduates a fall’s January seniors and its early pick, and moves the January intake up', () => {
    const view: SemesterView = {
      ...springView({}),
      id: '200',
      index: 1,
      season: 'fall',
      chars: ['fresh', 'august-senior', 'picked', 'january-senior'],
      alumni: ['old'],
      profiles: {
        fresh: profile(1, 'spring'),
        'august-senior': profile(4, 'fall'),
        picked: profile(4, 'fall'),
        'january-senior': profile(4, 'spring'),
        old: { ...profile(4, 'fall'), schedule: {}, pursuing: 'teaching' }
      },
      fallGraduate: 'picked'
    }
    const handoff = carryOf(input({ calendar: calendarOf('fall', []) }), view)

    expect(handoff.index).toBe(2)
    expect(handoff.graduated).toEqual(['picked', 'january-senior'])
    expect(handoff.continuing).toEqual(['fresh', 'august-senior'])
    expect(handoff.alumni).toEqual(['old', 'picked', 'january-senior'])
    expect(handoff.priorProfiles.fresh.year).toBe(2)
    expect(handoff.priorProfiles['august-senior'].year).toBe(4)
    expect(handoff.priorProfiles.old.pursuing).toBe('teaching')
  })
})

describe('the clock across the break', () => {
  it('moves every carried date onto the next semester and freezes a memory’s age at the ending', () => {
    const girl = profile(2)
    const handoff = carryOf(
      input({
        charInfo: {
          a: entry(girl, {
            memories: [{ date: 123, type: 'loved', desc: 'the reader danced with her' }],
            jealousyMemories: [{ date: 90, type: 'hated', desc: 'saw him with Bea' }],
            giftMemories: [{ date: 100, type: 'liked', desc: 'roses' }],
            textMemory: { date: 120, type: 'liked', desc: 'texted' },
            feed: [
              { id: 'late', text: 'b', date: 125, time: 0, likes: 2, liked: true, likedOn: 125 },
              { id: 'early', text: 'a', date: -10, time: 1, likes: 1 }
            ],
            datingSince: 60,
            brokeUpOn: 110
          })
        },
        npcFriendships: [{ a: 'a', b: 'b', date: 40, time: 1 }],
        inventory: [
          { itemId: 'rose', count: 1 },
          { itemId: 'coin', count: 1, from: { charId: 'a', date: 100 } }
        ],
        npcRelationships: {
          'a|b': { affinity: 30, encounter: { date: 120, kind: 'class', ref: 'X', positive: true } }
        }
      }),
      springView({ a: girl })
    )
    const carried = handoff.carry.charInfo.a

    expect(carried.memories[0]).toMatchObject({ date: 123 - 210, breakDays: 87 })
    expect(carried.jealousyMemories?.[0].date).toBe(90 - 210)
    expect(carried.giftMemories?.[0].date).toBe(100 - 210)
    expect(carried.textMemory).toMatchObject({ date: 120 - 210, breakDays: 87 })
    expect(carried.feed?.map((post) => [post.id, post.date])).toEqual([
      ['early', -220],
      ['late', -85]
    ])
    expect(carried.feed?.[1].likedOn).toBe(-85)
    expect(carried.datingSince).toBe(60 - 210)
    expect(carried.brokeUpOn).toBe(110 - 210)
    expect(handoff.carry.npcFriendships?.[0].date).toBe(40 - 210)
    expect(handoff.carry.inventory).toEqual([
      { itemId: 'rose', count: 1 },
      { itemId: 'coin', count: 1, from: { charId: 'a', date: 100 - 210 } }
    ])
    expect(handoff.carry.npcRelationships['a|b']).toEqual({ affinity: 30 })

    // On the next semester's first day, the ending's memory weighs what it did on the ending.
    expect(affectionOf(carried.memories, 0)).toBe(affectionOf([{ date: 123, type: 'loved', desc: '' }], 123))
  })

  it('moves a fall’s dates on by the shorter winter break', () => {
    const girl = profile(2, 'fall')
    const view: SemesterView = { ...springView({ a: girl }), index: 1, season: 'fall' }
    const handoff = carryOf(
      input({
        calendar: calendarOf('fall', []),
        charInfo: { a: entry(girl, { memories: [{ date: 100, type: 'liked', desc: 'x', breakDays: 87 }] }) }
      }),
      view
    )
    expect(handoff.carry.charInfo.a.memories[0]).toMatchObject({ date: 100 - 155, breakDays: 87 + 32 })
  })

  it('moves every thread’s texts on and drops what was still pending in them', () => {
    const bunnyboard = {
      ...emptyBunnyboard(),
      conversations: {
        a: {
          charId: 'a',
          messages: [{ id: 'm', sender: 'contact' as const, text: 'hi', date: 118, time: 1 as const }],
          unread: 1,
          summary: 'they talked',
          pendingHangout: { description: 'coffee' },
          declined: 2,
          turnedDown: true as const
        }
      },
      requestsSent: ['a', 'senior'],
      requestsReceived: ['senior'],
      suggestions: ['a']
    }
    const handoff = carryOf(input({ bunnyboard }), springView({ a: profile(2), senior: profile(4) }))
    const thread = handoff.carry.bunnyboard.conversations.a

    expect(thread.messages[0].date).toBe(118 - 210)
    expect(thread).toMatchObject({ unread: 1, summary: 'they talked' })
    expect(thread).not.toHaveProperty('pendingHangout')
    expect(thread).not.toHaveProperty('declined')
    expect(thread).not.toHaveProperty('turnedDown')
    expect(handoff.carry.bunnyboard.requestsSent).toEqual(['a'])
    expect(handoff.carry.bunnyboard.requestsReceived).toEqual([])
    expect(handoff.carry.bunnyboard).not.toHaveProperty('suggestions')
  })
})

describe('what a carried entry keeps', () => {
  it('drops every settled field and the semester’s own state, and keeps the rest', () => {
    const girl = profile(2)
    const handoff = carryOf(
      input({
        charInfo: {
          a: entry(girl, {
            moodCycleOffset: 4,
            handle: 'ana',
            nameKnown: true,
            gifts: ['rose'],
            notes: 'likes jazz',
            job: { jobId: 'cutetea', shifts: [3] },
            metSlots: [3],
            ignoredInvitation: true,
            suspicions: [{ subject: 'b', slot: 200 }],
            cold: { strain: 190, since: 200, incubation: 2 },
            coldsHad: [190],
            romanceScenes: 1,
            breakPenalty: { points: 12, halved: true }
          })
        }
      }),
      springView({ a: girl })
    )
    const carried = handoff.carry.charInfo.a as unknown as Record<string, unknown>

    for (const key of ['year', 'dorm', 'major', 'schedule', 'hiddenSchedule', 'moodCycleOffset', 'handle', 'springBreakPlans', 'intake', 'pursuing']) {
      expect(carried).not.toHaveProperty(key)
    }
    for (const key of ['job', 'metSlots', 'ignoredInvitation', 'suspicions', 'cold', 'coldsHad']) {
      expect(carried).not.toHaveProperty(key)
    }
    expect(carried).toMatchObject({
      nameKnown: true,
      gifts: ['rose'],
      notes: 'likes jazz',
      romanceScenes: 1,
      breakPenalty: { points: 12, halved: true }
    })
  })

  it('folds a graduate’s texting memory into her memories, said as texted, and settles her romance and break penalty', () => {
    const senior = profile(4)
    const handoff = carryOf(
      input({
        charInfo: {
          s: entry(senior, {
            memories: [
              { date: 100, type: 'liked', desc: 'first' },
              { date: 122, type: 'liked', desc: 'last' }
            ],
            textMemory: { date: 110, type: 'loved', desc: 'the reader sent her a song' },
            romanceScenes: 1,
            breakPenalty: { points: 12 }
          })
        }
      }),
      springView({ s: senior })
    )
    const carried = handoff.carry.charInfo.s

    expect(carried.textMemory).toBeUndefined()
    expect(carried.romanceScenes).toBeUndefined()
    expect(carried.breakPenalty).toBeUndefined()
    expect(carried.memories.map((memory) => memory.desc)).toEqual([
      'first',
      'the reader sent her a song over text.',
      'last'
    ])
  })
})

describe('the reader’s bookkeeping', () => {
  it('ends the job with the term and reopens an employer he quit, never one that fired him', () => {
    const job = { jobId: 'cutetea', raises: 2 } as JobState
    const handoff = carryOf(
      input({
        job,
        jobsClosed: ['fast_eats', 'springmart', 'lumiere'],
        formerJobs: {
          fast_eats: { raises: 1, left: 'fired' },
          springmart: { raises: 0, left: 'quit' }
        }
      }),
      springView({})
    )

    expect(handoff.carry.formerJobs).toEqual({
      fast_eats: { raises: 1, left: 'fired' },
      springmart: { raises: 0, left: 'quit' },
      cutetea: { raises: 2, left: 'term' }
    })
    // An employer with no record of how he left stays closed.
    expect(handoff.carry.jobsClosed).toEqual(['fast_eats', 'lumiere'])
  })

  it('adds this semester’s meetings to the transcript and keeps the reader’s own state', () => {
    const handoff = carryOf(
      input({
        transcript: { gradePoints: [3.7], aced: 1, attended: 20, held: 24 },
        classRecords: {
          'HIS 101': {
            meetings: [
              { date: 0, attended: true },
              { date: 7, attended: false }
            ]
          }
        }
      }),
      springView({})
    )

    expect(handoff.carry.transcript).toMatchObject({ gradePoints: [3.7], aced: 1, attended: 21, held: 26 })
    expect(handoff.carry).toMatchObject({
      money: 250,
      bio: 'a runner',
      gradesStanding: 'good',
      bunnybotThrough: 245,
      inventory: [{ itemId: 'rose', count: 2 }]
    })
    expect(handoff.carry.tallies.kisses).toBe(3)
    expect(handoff.carry.before).toEqual({
      history: { 4: { 0: 'met Ana' } },
      playerSchedule: { 0: 'HIS 101' },
      events: []
    })
  })
})
