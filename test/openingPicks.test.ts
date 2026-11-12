import { describe, expect, it } from 'vitest'
import { picksWithout } from '../src/shared/openingPicks'

describe('the picks a bonus scene keeps, without the girls it spent with him', () => {
  it('takes her off the invitations and the reach-out, and leaves the posts', () => {
    const picks = {
      posters: ['lili_m', 'mina_k'],
      askers: ['lili_m', 'mina_k'],
      invites: { lili_m: { kind: 'herRoom' as const }, mina_k: null },
      reachOut: { charKey: 'lili_m', topic: 'wellbeing' as const }
    }
    expect(picksWithout(picks, ['lili_m'])).toEqual({
      posters: ['lili_m', 'mina_k'],
      askers: ['mina_k'],
      invites: { mina_k: null },
      reachOut: null
    })
    expect(picksWithout(picks, ['ami_t'])).toEqual(picks)
  })
})
