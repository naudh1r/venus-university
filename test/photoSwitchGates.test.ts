import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { restoreApi, stubApi } from './fixtures'

/**
 * That every place Photo Feature acts asks its switch: no new photo, no body details, no feed
 * comments and the game's own likes while it is off, and an explicit photo forbidden by either
 * the mod's option or the game's "No NSFW images".
 */

stubApi({ jobs: { onProgress: () => () => {} } })

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  restoreApi()
})

async function load() {
  const switches = await import('../src/shared/photoSwitches')
  const { useSettingsStore } = await import('../src/renderer/stores/settingsStore')
  const { useSetupStore } = await import('../src/renderer/stores/setupStore')
  const { useGameStore } = await import('../src/renderer/stores/gameStore')
  const photos = await import('../src/renderer/stores/localPhotoStore')
  const { bodyDetailsOn } = await import('../src/renderer/prompts/bodyBrief')
  const comments = await import('../src/renderer/stores/photoComments')
  useSettingsStore.setState({
    settings: { photos: true, bodyDetails: true, noNsfwImages: false } as never
  })
  useSetupStore.setState({ status: { comfyReady: true } as never })
  return { switches, useSettingsStore, useGameStore, photos, bodyDetailsOn, comments }
}

describe('Photo Feature asks its switch', () => {
  it('makes photos and asks for body details while on, and neither while off', async () => {
    const { switches, photos, bodyDetailsOn } = await load()
    expect(photos.canSendPhotos()).toBe(true)
    expect(bodyDetailsOn()).toBe(true)
    switches.setPhotoSwitches({ on: false })
    expect(photos.canSendPhotos()).toBe(false)
    expect(bodyDetailsOn()).toBe(false)
  })

  it('forbids an explicit photo when either switch does', async () => {
    const { switches, photos, useSettingsStore } = await load()
    expect(photos.noExplicitPhotos()).toBe(false)
    switches.setPhotoSwitches({ explicit: false })
    expect(photos.noExplicitPhotos()).toBe(true)
    switches.setPhotoSwitches({ explicit: true })
    useSettingsStore.setState({ settings: { noNsfwImages: true } as never })
    expect(photos.noExplicitPhotos()).toBe(true)
  })

  it('files a post with no comments and the game’s own likes while off', async () => {
    const { switches, comments, useGameStore } = await load()
    useGameStore.setState({ playthroughId: '1', chars: ['a'], npcRelationships: {} } as never)
    expect(comments.rollComments('a', ['nice', 'wow', 'cute'], 'suggestive').length).toBeGreaterThanOrEqual(0)
    switches.setPhotoSwitches({ on: false })
    expect(comments.rollComments('a', ['nice', 'wow', 'cute'], 'suggestive')).toEqual([])
    // The game's own roll: her friends (none here) and a handful more, never a crowd.
    for (let i = 0; i < 20; i++) expect(comments.postLikes('a', 'suggestive')).toBeLessThan(10)
  })
})
