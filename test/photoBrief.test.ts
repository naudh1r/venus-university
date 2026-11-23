import './fixtures/photoRecordKit'
import { describe, expect, it } from 'vitest'
import {
  photoLines,
  PHOTO_SCHEMA_FIELDS,
  PHOTO_SCHEMA_REQUIRED
} from '../src/renderer/prompts/photoBrief'
import { photoReasonOf } from '../src/shared/photoGate'
import { emptyFlags } from '../src/shared/relationship'
import { character } from './fixtures'

const contacted = { ...emptyFlags(), gaveContactInfo: true }

describe('photo prompt eligibility', () => {
  it.each([undefined, 'male'] as const)(
    'asks nothing without a renderer or contact for gender %s',
    (gender) => {
      const person = character({ gender })
      const noRenderer = photoLines(person, { flags: contacted } as never, {
        date: 0,
        canRenderImages: false
      })
      const noContact = photoLines(person, { flags: emptyFlags() } as never, {
        date: 0,
        canRenderImages: true
      })
      const blocked = photoLines(person, { flags: { ...contacted, blocked: true } } as never, {
        date: 0,
        canRenderImages: true
      })

      expect(noRenderer).toEqual([])
      expect(noContact).toEqual([])
      expect(blocked).toEqual([])
    }
  )

  it.each([undefined, 'male'] as const)(
    'supplies both reply and reach-out prompts for a contact of gender %s',
    (gender) => {
      const person = character({ gender })
      const state = { date: 0, canRenderImages: true, noNsfwImages: true }

      const reply = photoLines(person, { flags: contacted } as never, state)
      const reachOut = photoLines(person, { flags: contacted } as never, state, 'reachOut')

      expect(reply.length).toBeGreaterThan(0)
      expect(reachOut.length).toBeGreaterThan(0)
      expect(Object.keys(PHOTO_SCHEMA_FIELDS).sort()).toEqual([...PHOTO_SCHEMA_REQUIRED].sort())
    }
  )
})

describe('the saved reason for an intimate photo', () => {
  it('uses the intimate history only when it exists', () => {
    expect(photoReasonOf({ ...contacted, hadSex: true }, [])).toBe('intimate')
    expect(photoReasonOf(contacted, [])).toBeNull()
  })

  it('does not invent history for a promiscuous character', () => {
    expect(photoReasonOf(contacted, ['Promiscuous'])).toBe('promiscuous')
  })

  it('recognises a crush without claiming intimacy', () => {
    expect(photoReasonOf({ ...contacted, hasCrush: true }, [])).toBe('crush')
  })

  it('takes existing intimacy before a trait', () => {
    expect(photoReasonOf({ ...contacted, benefits: true }, ['Promiscuous'])).toBe('intimate')
  })
})
