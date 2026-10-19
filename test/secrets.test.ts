import { describe, expect, it, vi } from 'vitest'
import { affectionOfDisposition } from '@shared/relationship'
import { observedSecretTiers, pendingSecretOf, withSecretTold } from '@shared/secrets'
import { charKeyOf, type CharSecret } from '@shared/types'
import { validateSecretDraft } from '../src/renderer/prompts/secretsPrompt'
import { character, charInfo } from './fixtures'

/**
 * Which secrets a girl has reached, which one she tells and what the boundary files as told: a
 * wrong step loses a secret for good or has her tell one twice, and nothing throws.
 */

const untold = (): CharSecret[] => [
  { text: 'A.', tier: 'friendly' },
  { text: 'B.', tier: 'trusted' },
  { text: 'C.', tier: 'devoted' }
]

describe('observedSecretTiers', () => {
  it('marks every tier she stands at or above, a tier jumped over included', () => {
    const marked = observedSecretTiers(untold(), affectionOfDisposition('trusted'))
    expect(marked?.map((secret) => secret.reached === true)).toEqual([true, true, false])
  })

  it('marks nothing below friendly, and keeps the array when nothing moved', () => {
    const secrets = untold()
    expect(observedSecretTiers(secrets, affectionOfDisposition('neutral'))).toBe(secrets)
    const marked = observedSecretTiers(secrets, affectionOfDisposition('friendly'))
    // A mark is never taken back, so a fall below the tier keeps it.
    expect(observedSecretTiers(marked, affectionOfDisposition('hostile'))).toBe(marked)
    expect(observedSecretTiers(marked, affectionOfDisposition('friendly'))).toBe(marked)
  })
})

describe('pendingSecretOf', () => {
  it('waits for a reached secret and tells the lowest tier first', () => {
    expect(pendingSecretOf(charInfo({ secrets: untold() }))).toBeUndefined()
    // A devoted secret written before an older trusted one still waits behind it.
    const secrets: CharSecret[] = [
      { text: 'New devoted.', tier: 'devoted', reached: true },
      { text: 'Old trusted.', tier: 'trusted', reached: true }
    ]
    expect(pendingSecretOf(charInfo({ secrets }))).toBe('Old trusted.')
  })
})

describe('withSecretTold', () => {
  const reached = untold().map((secret) => ({ ...secret, reached: true as const }))
  const before = { a: charInfo({ secrets: reached }), b: charInfo() }

  it('moves the one secret told onto the end of her told list', () => {
    const after = withSecretTold(before, ['a'], 'A.')
    expect(after.a.secrets?.map((secret) => secret.text)).toEqual(['B.', 'C.'])
    expect(after.a.toldSecrets).toEqual(['A.'])
    expect(after.b).toBe(before.b)
  })

  it('tells nothing outside a scene she was alone in, nor the same secret twice', () => {
    expect(withSecretTold(before, ['a', 'b'], 'A.')).toBe(before)
    expect(withSecretTold(before, ['a'], null)).toBe(before)
    const once = withSecretTold(before, ['a'], 'A.')
    // The ending's projection and the boundary each step once off the same entries.
    expect(withSecretTold(before, ['a'], 'A.')).toEqual(once)
    expect(withSecretTold(once, ['a'], 'A.')).toBe(once)
  })

  it('drops the untold list once the last is told', () => {
    const last = { a: charInfo({ secrets: [reached[2]], toldSecrets: ['A.', 'B.'] }) }
    const after = withSecretTold(last, ['a'], 'C.')
    expect('secrets' in after.a).toBe(false)
    expect(after.a.toldSecrets).toEqual(['A.', 'B.', 'C.'])
  })
})

describe('validateSecretDraft', () => {
  const sara = character({ firstName: 'Sara', lastName: 'Lee' })
  const mia = character({ charId: 'mia', firstName: 'Mia', lastName: 'Park' })
  const entries = [
    { character: sara, tiers: ['friendly', 'trusted', 'devoted'] as const, held: [] },
    { character: mia, tiers: ['devoted'] as const, held: ['Mia is afraid of birds.'] }
  ]

  it('keeps each tier written, closed with a stop, and drops a blank one', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const secrets = validateSecretDraft(
      {
        characters: [
          {
            key: charKeyOf('Sara', 'Lee'),
            friendly: ' Sara knits ',
            trusted: '',
            devoted: 'Sara lied.'
          }
        ],
        returning: [
          { key: charKeyOf('Mia', 'Park'), devoted: 'Mia has a twin' },
          { key: 'nobody', devoted: 'x' }
        ]
      },
      entries
    )
    expect(secrets[charKeyOf('Sara', 'Lee')]).toEqual([
      { text: 'Sara knits.', tier: 'friendly' },
      { text: 'Sara lied.', tier: 'devoted' }
    ])
    expect(secrets[charKeyOf('Mia', 'Park')]).toEqual([
      { text: 'Mia has a twin.', tier: 'devoted' }
    ])
  })

  it('refuses a reply that leaves a girl without a secret', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    // Mia, asked for one, is left out of the reply altogether.
    const reply = { characters: [{ key: charKeyOf('Sara', 'Lee'), friendly: 'Sara knits.' }] }
    expect(() => validateSecretDraft(reply, entries)).toThrow(
      expect.objectContaining({ code: 'SECRET_GEN_INVALID' })
    )
  })
})
