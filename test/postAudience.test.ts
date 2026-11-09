import { describe, expect, it } from 'vitest'
import {
  MAX_COMMENTS,
  reachOf,
  rollAudienceLikes,
  rollCrowdCount
} from '../src/shared/postAudience'
import { character } from './fixtures'

/**
 * A post's audience is her following, derived from the playthrough and her id. The rolls are
 * checked against a fixed `rand`, since a spread tested by sampling is a flaky test.
 */
describe('reachOf', () => {
  it('is the same girl every time within one playthrough', () => {
    expect(reachOf('run-1', 'mina', undefined)).toBe(reachOf('run-1', 'mina', undefined))
  })

  it('stays inside the curve it is drawn from', () => {
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const reach = reachOf('run-1', id, undefined)
      expect(reach).toBeGreaterThanOrEqual(40)
      expect(reach).toBeLessThanOrEqual(500)
    }
  })

  it('doubles for somebody who lives on the app', () => {
    const online = character({ charId: 'mina', traits: ['Terminally Online'] })
    expect(reachOf('run-1', 'mina', online)).toBe(2 * reachOf('run-1', 'mina', undefined))
  })
})

describe('rollAudienceLikes', () => {
  it('adds everybody she is close to on top of her following', () => {
    const alone = rollAudienceLikes({ reach: 200, friends: 0, photoTier: 'none' }, () => 0.5)
    const liked = rollAudienceLikes({ reach: 200, friends: 5, photoTier: 'none' }, () => 0.5)
    expect(liked - alone).toBe(5)
  })

  it('draws more for a picture, and more again for one with skin in it', () => {
    const roll = (photoTier: 'none' | 'everyday' | 'suggestive'): number =>
      rollAudienceLikes({ reach: 300, friends: 0, photoTier }, () => 0.5)
    expect(roll('everyday')).toBeGreaterThan(roll('none'))
    expect(roll('suggestive')).toBeGreaterThan(roll('everyday'))
  })
})

describe('rollCrowdCount', () => {
  it('never runs past the cap, however loud the post', () => {
    expect(rollCrowdCount({ photoTier: 'suggestive', reach: 1000 }, () => 0.99)).toBe(MAX_COMMENTS)
  })

  it('lets a quiet post stay quiet', () => {
    expect(rollCrowdCount({ photoTier: 'none', reach: 40 }, () => 0)).toBe(0)
  })
})
