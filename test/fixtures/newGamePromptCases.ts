import { createHash } from 'node:crypto'
import { PROFILE_FIELDS, type ProfileField } from '@shared/application'
import type { StructuredRequest } from '@shared/types'
import type * as classes from '../../src/renderer/prompts/classPrompt'
import type * as profiles from '../../src/renderer/prompts/profilePrompt'
import { character } from '../fixtures'

type Builders = Pick<typeof classes, 'buildClassPartPrompt' | 'classAsksOf'> &
  Pick<typeof profiles, 'buildMajorPrompt' | 'buildStudentPrompt' | 'buildReturningPrompt' | 'buildGraduatePrompt'>

/** Ignore object-key order; retain every request value, including exact text whitespace. */
export function promptFingerprint(request: StructuredRequest | null): string {
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) :
    value && typeof value === 'object' ? Object.fromEntries(Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)])) : value
  return createHash('sha256').update(JSON.stringify(canonical(request))).digest('hex')
}

/** Shared inputs for the current builders and the pinned, unmodified upstream builders. */
export function newGamePromptCases(builders: Builders): { name: string; request: StructuredRequest | null }[] {
  const rows: { name: string; request: StructuredRequest | null }[] = []
  const add = (name: string, request: StructuredRequest | null): void => { rows.push({ name, request }) }
  for (const gender of ['female', 'male'] as const) {
    const person = character(gender === 'male' ? { gender } : {})
    const secrets = { character: person, tiers: ['friendly', 'trusted', 'devoted'] as const, held: [] }
    const student = { character: person, decided: {}, fields: PROFILE_FIELDS, setting: 'A fixture university' }
    for (const next of [false, true]) {
      for (const withSecrets of [false, true]) {
        add(`${gender}/student/all/next=${next}/secrets=${withSecrets}`,
          builders.buildStudentPrompt({ ...student, next, ...(withSecrets ? { secrets } : {}) }))
      }
    }
    for (const field of PROFILE_FIELDS) {
      add(`${gender}/student/field=${field}`, builders.buildStudentPrompt({ ...student, fields: [field] }))
    }
    const haunts: ProfileField[] = ['homeSlots', 'study', 'fun', 'activity', 'meal']
    for (let mask = 0; mask < 32; mask++) {
      add(`${gender}/student/haunts=${mask}`, builders.buildStudentPrompt({
        ...student, fields: haunts.filter((_, bit) => mask & (1 << bit)), decided: { major: 'Art' }
      }))
    }
    for (const tier of secrets.tiers) {
      add(`${gender}/student/secret=${tier}`, builders.buildStudentPrompt({
        ...student, fields: [], secrets: { ...secrets, tiers: [tier] }
      }))
    }
    for (const season of ['spring', 'fall'] as const) {
      for (const withSecrets of [false, true]) {
        add(`${gender}/returning/${season}/secrets=${withSecrets}`, builders.buildReturningPrompt({
          character: person, season, setting: student.setting, ...(withSecrets ? { secrets } : {})
        }))
      }
      add(`${gender}/graduate/${season}`, builders.buildGraduatePrompt({
        graduate: { character: person, major: 'Art' }, season, setting: student.setting
      }))
    }
    add(`${gender}/majors`, builders.buildMajorPrompt({
      students: [person], otherMajors: ['Biology', 'Art'], notes: { sarah_rose: 'Enjoys practical work.' },
      setting: student.setting
    }))
    const asks = builders.classAsksOf({
      students: [{ character: person, major: 'Art' }],
      filled: { pe: [], humanities: [], arts: [], misc: [], major: {} },
      setting: student.setting
    })
    for (const ask of asks) {
      const label = ask.kind === 'pool' ? `pool=${ask.pool}` : ask.kind
      add(`${gender}/classes/${label}`, builders.buildClassPartPrompt(ask, student.setting))
      if (ask.kind !== 'interest') {
        add(`${gender}/classes/${label}/existing`, builders.buildClassPartPrompt({
          ...ask, taken: [{ code: 'ART 101', name: 'Previous art', category: 'major', major: 'Art' }],
          written: [{ code: 'ART 102', title: 'Current art', description: 'Current course.' }]
        }, student.setting))
      }
    }
  }
  add('majors/none', builders.buildMajorPrompt({ students: [], otherMajors: [], setting: '' }))
  return rows
}
