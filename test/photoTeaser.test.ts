import { describe, expect, it } from 'vitest'
import { updatesFeed } from '../src/renderer/stores/feedView'
// The mod plugs into the game's hooks as the app does at boot.
import '../src/renderer/mods/photoFeature'
import type { SocialPost } from '../src/shared/types'
import { character, charactersById, charInfo } from './fixtures'

/**
 * The slot's teaser, when the stranger's post came with a picture: it is the post the feed
 * surfaces, and like every post it stays off the feed until the picture is drawn.
 */
const DATE = 10
const NOW = 1

function strangerFeed(post: SocialPost) {
  return updatesFeed({
    chars: ['s'],
    characters: charactersById(character({ charId: 's', firstName: 'Cass' })),
    charInfo: { s: charInfo({ nameKnown: true, feed: [post] }) },
    npcFriendships: [],
    feedExtras: {
      date: DATE,
      time: NOW,
      teaser: { charId: 's', postId: post.id },
      randomPost: null
    },
    checkIns: [],
    date: DATE,
    time: NOW
  })
}

const posted = (entries: ReturnType<typeof updatesFeed>): string[] =>
  entries.flatMap((entry) => (entry.kind === 'post' ? [entry.post.id] : []))

describe('a teaser with a picture', () => {
  const base: SocialPost = { id: 's1', text: 'library again', date: DATE, time: NOW, likes: 3 }

  it('stays off the feed while its picture is held', () => {
    const held = {
      ...base,
      photo: { tier: 'everyday', file: 'cass_bunnyboard_001.png', held: true as const }
    }
    expect(posted(strangerFeed(held))).toEqual([])
  })

  it('comes out once the picture is drawn', () => {
    const drawn = { ...base, photo: { tier: 'everyday', file: 'cass_bunnyboard_001.png' } }
    expect(posted(strangerFeed(drawn))).toEqual(['s1'])
  })
})

describe('the post photo brief', () => {
  it('tells the model to leave "image" empty when no picture can be drawn', async () => {
    const { postPhotoLines } = await import('../src/renderer/prompts/photoBrief')
    const off = postPhotoLines(false)
    expect(off).toHaveLength(1)
    expect(off[0]).toContain('Leave "image" empty')
    expect(postPhotoLines(true).join(' ')).toContain('Describe it in "image"')
  })
})
