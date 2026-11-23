import { describe, expect, it } from 'vitest'
import { PROFILE_FIELDS } from '@shared/application'
import { GLOBAL_TEXT_IDS, type GlobalTextId, type TextEdits } from '@shared/promptText'
import {
  buildClassPartPrompt,
  classAsksOf,
  NO_FILLED_CATALOG
} from '../src/renderer/prompts/classPrompt'
import {
  buildGraduatePrompt,
  buildMajorPrompt,
  buildReturningPrompt,
  buildStudentPrompt
} from '../src/renderer/prompts/profilePrompt'
import { newGameText, textingPersonaFor } from '../src/renderer/prompts/promptBlocks'
import { character } from './fixtures'

const person = character({ gender: 'male' })
const secrets = { character: person, tiers: ['friendly', 'trusted', 'devoted'] as const, held: [] }
const student = {
  character: person,
  decided: {},
  fields: PROFILE_FIELDS,
  secrets,
  setting: 'A test university'
}
const edits: TextEdits<GlobalTextId> = Object.fromEntries(
  GLOBAL_TEXT_IDS.filter((id) => id.startsWith('newgame.')).map((id) => [id, `EDIT ${id} END`])
)

describe('prompt edits across the split New Game calls', () => {
  it('keeps profile and secret edits together without changing the fields requested', () => {
    const original = buildStudentPrompt(student)!
    const request = buildStudentPrompt(student, edits)!
    expect(request.schema).toEqual(original.schema)
    for (const id of [
      'newgame.profiles.system',
      'newgame.profiles.additions',
      'newgame.secrets.system',
      'newgame.secrets.additions'
    ] as const) {
      expect(request.system).toContain(edits[id])
    }
    for (const id of [
      'newgame.profiles.instructions',
      'newgame.profiles.housing',
      'newgame.profiles.freeTime',
      'newgame.profiles.handle',
      'newgame.profiles.springBreak',
      'newgame.secrets.instructions',
      'newgame.secrets.tiers'
    ] as const) {
      expect(request.user).toContain(edits[id])
      expect(original.user).toContain(newGameText(undefined, id))
    }
    expect(request.user).toContain('ACTIVITY LOCATIONS')
    expect(request.user).not.toContain(edits['newgame.profiles.next.newcomers'])
    expect(request.user).not.toContain(edits['newgame.profiles.next.housing'])
  })

  it('routes later-semester edits to newcomers, returning students and graduates', () => {
    const newcomer = buildStudentPrompt({ ...student, next: true }, edits)!
    expect(newcomer.user).toContain(edits['newgame.profiles.next.newcomers'])
    expect(newcomer.user).toContain(edits['newgame.profiles.next.housing'])
    expect(newcomer.user).not.toContain(edits['newgame.profiles.housing'])
    const returning = buildReturningPrompt(
      { character: person, season: 'spring', secrets, setting: '' },
      edits
    )
    expect(returning.user).toContain(edits['newgame.profiles.springBreak'])
    expect(returning.user).toContain(edits['newgame.secrets.tiers'])
    const graduate = buildGraduatePrompt(
      { graduate: { character: person, major: 'Art' }, season: 'fall', setting: '' },
      edits
    )
    expect(graduate.user).toContain(edits['newgame.profiles.next.graduates'])
    expect(graduate.system).toContain(edits['newgame.profiles.additions'])
    const majors = buildMajorPrompt({ students: [person], otherMajors: [], setting: '' }, edits)!
    expect(majors.system).toContain(edits['newgame.profiles.system'])
  })

  it('keeps selective secrets and decided profile fields out of the request', () => {
    const request = buildStudentPrompt(
      { ...student, fields: [], secrets: { ...secrets, tiers: ['trusted'] } },
      edits
    )!
    expect(request.schema).toEqual(
      buildStudentPrompt({ ...student, fields: [], secrets: { ...secrets, tiers: ['trusted'] } })!
        .schema
    )
    expect(request.system).toContain(edits['newgame.secrets.system'])
    expect(request.system).not.toContain(edits['newgame.profiles.system'])
    expect(request.user).not.toContain(edits['newgame.profiles.instructions'])
    expect(buildStudentPrompt({ ...student, fields: [], secrets: undefined }, edits)).toBeNull()
  })

  it('carries edited pool sizes into each request while preserving counts and schemas', () => {
    const asks = classAsksOf({
      students: [{ character: person, major: 'Art' }],
      filled: NO_FILLED_CATALOG,
      catalog: { pe: 3, filler: 2, perMajor: 6 },
      setting: ''
    })
    expect(asks.filter((ask) => ask.kind !== 'interest').map((ask) => ask.count)).toEqual([
      3, 2, 2, 2, 6
    ])
    for (const ask of asks) {
      const original = buildClassPartPrompt(ask, 'SETTING_FIXTURE')
      const request = buildClassPartPrompt(ask, 'SETTING_FIXTURE', edits)
      expect(request.schema).toEqual(original.schema)
      expect(request.system).toContain(edits['newgame.classes.system'])
      expect(request.system).toContain(edits['newgame.classes.additions'])
      expect(request.user).toContain(edits['newgame.classes.instructions'])
      if (ask.kind !== 'interest') expect(request.user).toContain(`Create ${ask.count}`)
    }
  })

  it('keeps the unedited texting persona suitable for either character gender', () => {
    const persona = textingPersonaFor(undefined)
    expect(persona).toContain('their own texting voice')
    expect(persona).not.toMatch(/how SHE|make the women/)
  })
})
