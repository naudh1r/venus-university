import { beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeVerdict } from '@shared/classifier'

/**
 * The classifier's decoding contract: the verdict is advisory, but what it decodes into
 * decides who is cast and who is only described, which is what keeps a girl the reader merely
 * bought a present for out of the room she was never in.
 */

const ROSTER = ['sarah_rose', 'mia_tran']

beforeEach(() => {
  // An off-roster key warns; the cases below provoke it deliberately.
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

/** A full reply, so a case only has to say what it is about. */
function reply(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    characters: [],
    mentionedOnly: [],
    goingToClass: false,
    classCode: '',
    goingToWork: false,
    workingOnProject: false,
    projectClassCode: '',
    inPublic: true,
    sceneLocation: '',
    ...over
  }
}

describe('normalizeVerdict — the two character lists', () => {
  it('filters off-roster keys out of both lists', () => {
    const verdict = normalizeVerdict(
      reply({ characters: ['sarah_rose', 'ghost'], mentionedOnly: ['nobody', 'mia_tran'] }),
      ROSTER
    )
    expect(verdict.characters).toEqual(['sarah_rose'])
    expect(verdict.mentionedOnly).toEqual(['mia_tran'])
  })

  it('resolves a key in both lists to present', () => {
    // Casting her is the answer that can still be narrated; describing her as
    // absent while she stands in the room is the one unrecoverable reading.
    const verdict = normalizeVerdict(
      reply({ characters: ['sarah_rose'], mentionedOnly: ['sarah_rose'] }),
      ROSTER
    )
    expect(verdict.characters).toEqual(['sarah_rose'])
    expect(verdict.mentionedOnly).toEqual([])
  })

  it('collapses duplicates and normalizes casing and whitespace', () => {
    const verdict = normalizeVerdict(
      reply({ mentionedOnly: [' Sarah_Rose ', 'sarah_rose', 7] }),
      ROSTER
    )
    expect(verdict.mentionedOnly).toEqual(['sarah_rose'])
  })
})

describe('normalizeVerdict — the rest of the verdict', () => {
  it('keeps the action ladder and the location intact beside the new list', () => {
    const verdict = normalizeVerdict(
      reply({
        mentionedOnly: ['mia_tran'],
        goingToClass: true,
        classCode: 'BIO 210',
        sceneLocation: '  the quad  '
      }),
      ROSTER
    )
    expect(verdict.actionType).toBe('goto_class:BIO 210')
    expect(verdict.sceneLocation).toBe('the quad')
    expect(verdict.inPublic).toBe(true)
    expect(verdict.mentionedOnly).toEqual(['mia_tran'])
  })

  it('reads a class code without the flag as class only when nothing else is claimed', () => {
    // A project class meets in its own slot, so its code can arrive beside project work.
    const codes = ['ART 110', 'BIO 210']
    const project = normalizeVerdict(
      reply({ classCode: 'ART 110', workingOnProject: true }),
      ROSTER,
      codes
    )
    expect(project.actionType).toBe('project:ART 110')
    const named = normalizeVerdict(
      reply({ classCode: 'ART 110', workingOnProject: true, projectClassCode: 'ART 120' }),
      ROSTER,
      codes
    )
    expect(named.actionType).toBe('project:ART 120')
    const work = normalizeVerdict(reply({ classCode: 'BIO 210', goingToWork: true }), ROSTER, codes)
    expect(work.actionType).toBe('job')
    const forgotten = normalizeVerdict(reply({ classCode: 'BIO 210' }), ROSTER, codes)
    expect(forgotten.actionType).toBe('goto_class:BIO 210')
  })
})
