import { describe, expect, it } from 'vitest'
import { sanitizeSlotIntro } from '../src/renderer/stores/slotIntroReply'
import { postsWithModFields } from '../src/renderer/stores/slotPostsForMods'

const asked = {
  askers: new Set(['ana']),
  breakups: new Set<string>(),
  posters: new Set(['bea', 'cleo']),
  leavers: new Set<string>(),
  reachOuts: new Set<string>(),
  visitors: new Set<string>()
}
const askers = [{ charKey: 'ana' }]
const posters = [{ charKey: 'bea' }, { charKey: 'cleo' }]

describe('slot posts for mods', () => {
  it('keeps the fields a mod asked for on a post', () => {
    const raw = { lines: [], posts: [{ char: 'bea', text: ' hi ', photo: 'beach' }] }
    const posts = postsWithModFields(raw, sanitizeSlotIntro(raw, asked), askers, posters)
    expect(posts).toEqual([{ char: 'bea', text: 'hi', photo: 'beach' }])
  })

  it("gives an asked poster's stray invitation back as her post", () => {
    const raw = {
      lines: [],
      hangouts: [
        { char: 'cleo', text: 'beach day!', description: 'x' },
        { char: 'dora', text: 'come over', description: 'y' },
        { char: 'ana', text: 'coffee?', description: 'z' }
      ],
      posts: [{ char: 'bea', text: 'hi' }]
    }
    const reply = sanitizeSlotIntro(raw, asked)
    expect(reply.hangouts.map(({ char }) => char)).toEqual(['ana'])
    expect(postsWithModFields(raw, reply, askers, posters)).toEqual([
      { char: 'bea', text: 'hi' },
      { char: 'cleo', text: 'beach day!' }
    ])
  })

  it('never adds a second post for a girl who posted', () => {
    const raw = {
      posts: [{ char: 'bea', text: 'hi' }],
      hangouts: [{ char: 'bea', text: 'again', description: 'x' }]
    }
    expect(postsWithModFields(raw, sanitizeSlotIntro(raw, asked), askers, posters)).toEqual([
      { char: 'bea', text: 'hi' }
    ])
  })
})
