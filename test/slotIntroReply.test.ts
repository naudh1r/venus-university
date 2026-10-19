import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sanitizeSlotIntro, type SlotIntroAsked } from '../src/renderer/stores/slotIntroReply'

/**
 * What the slot opening delivers to the phone and the feed. A stray entry here adds a contact,
 * files an invitation or a breakup, or posts for a girl the slot never rolled.
 */

const asked: SlotIntroAsked = {
  askers: new Set(['sarah_rose']),
  breakups: new Set(['mina_kwon']),
  // An asker who also posts is in both lists.
  posters: new Set(['sarah_rose', 'eve_lang']),
  leavers: new Set(['ada_park']),
  reachOuts: new Set(['joy_lee']),
  visitors: new Set(['lia_moss'])
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('sanitizeSlotIntro', () => {
  it('keeps each list to the girls it was asked for', () => {
    const reply = sanitizeSlotIntro(
      {
        lines: [{ text: ' Morning. ' }],
        hangouts: [
          { char: 'sarah_rose', text: 'coffee?', description: 'Coffee with Sarah' },
          // Posting is not asking.
          { char: 'eve_lang', text: 'come out?', description: 'Hanging out with Eve' }
        ],
        breakups: [
          { char: 'mina_kwon', texts: ['we are done'] },
          { char: 'joy_lee', texts: ['it is over'] }
        ],
        posts: [
          { char: 'sarah_rose', text: 'sunny' },
          { char: 'eve_lang', text: 'tired' },
          { char: 'mina_kwon', text: 'ugh' }
        ],
        springBreakTexts: [
          { char: 'ada_park', texts: ['off to the coast'] },
          { char: 'eve_lang', texts: ['leaving saturday'] }
        ],
        reachOuts: [
          { char: 'joy_lee', texts: ['how are you?'] },
          { char: 'sarah_rose', texts: ['hey'] }
        ],
        homecomingTexts: [
          { char: 'lia_moss', texts: ['back in town!'] },
          // Leaving for the break is not coming back.
          { char: 'ada_park', texts: ['guess who'] }
        ]
      },
      asked
    )
    expect(reply).toEqual({
      lines: ['Morning.'],
      hangouts: [{ char: 'sarah_rose', text: 'coffee?', description: 'Coffee with Sarah' }],
      breakups: [{ char: 'mina_kwon', texts: ['we are done'] }],
      posts: [
        { char: 'sarah_rose', text: 'sunny' },
        { char: 'eve_lang', text: 'tired' }
      ],
      springBreakTexts: [{ char: 'ada_park', texts: ['off to the coast'] }],
      reachOuts: [{ char: 'joy_lee', texts: ['how are you?'] }],
      homecomingTexts: [{ char: 'lia_moss', texts: ['back in town!'] }]
    })
  })

  it('keeps only the first deliverable entry per girl', () => {
    const reply = sanitizeSlotIntro(
      {
        lines: [],
        hangouts: [
          { char: 'sarah_rose', text: '  ', description: 'blank text' },
          { char: 'sarah_rose', text: 'movie?', description: 'A movie with Sarah' },
          { char: 'sarah_rose', text: 'dinner?', description: 'Dinner with Sarah' }
        ],
        breakups: [
          { char: 'mina_kwon', texts: ['first'] },
          { char: 'mina_kwon', texts: ['second'] }
        ],
        posts: [
          { char: 'eve_lang', text: 'one' },
          { char: 'eve_lang', text: 'two' }
        ]
      },
      asked
    )
    expect(reply.hangouts).toEqual([
      { char: 'sarah_rose', text: 'movie?', description: 'A movie with Sarah' }
    ])
    expect(reply.breakups).toEqual([{ char: 'mina_kwon', texts: ['first'] }])
    expect(reply.posts).toEqual([{ char: 'eve_lang', text: 'one' }])
  })

  it('never throws on a reply that ignores the schema', () => {
    const empty = {
      lines: [],
      hangouts: [],
      breakups: [],
      posts: [],
      springBreakTexts: [],
      reachOuts: [],
      homecomingTexts: []
    }
    for (const data of [null, 'lines', [], 42]) {
      expect(sanitizeSlotIntro(data, asked)).toEqual(empty)
    }

    const reply = sanitizeSlotIntro(
      {
        lines: [null, { text: 7 }, 'loose', { text: 'Kept.' }],
        hangouts: [null, { char: 'sarah_rose', text: 5, description: 'x' }],
        breakups: 'mina_kwon',
        posts: [{ text: 'no char' }],
        springBreakTexts: [{ char: 'ada_park', texts: 'a lone string' }],
        reachOuts: [{ char: 'joy_lee', texts: [' hi ', 3, '', 'there'] }]
      },
      asked
    )
    expect(reply).toEqual({
      lines: ['Kept.'],
      hangouts: [],
      breakups: [],
      posts: [],
      springBreakTexts: [],
      reachOuts: [{ char: 'joy_lee', texts: ['hi', 'there'] }],
      homecomingTexts: []
    })
    expect(sanitizeSlotIntro({ lines: 'Morning.' }, asked).lines).toEqual([])
  })

  it('keeps the fields a mod asked for on a post and a reach-out', () => {
    const reply = sanitizeSlotIntro(
      {
        posts: [{ char: 'eve_lang', text: 'tired', image: 'a selfie in bed', comments: ['same'] }],
        reachOuts: [{ char: 'joy_lee', texts: ['hey'], sendPhoto: true, photoPrompt: 'a mirror pic' }]
      },
      asked
    )
    expect(reply.posts).toEqual([
      { char: 'eve_lang', text: 'tired', image: 'a selfie in bed', comments: ['same'] }
    ])
    expect(reply.reachOuts).toEqual([
      { char: 'joy_lee', texts: ['hey'], sendPhoto: true, photoPrompt: 'a mirror pic' }
    ])
  })
})
