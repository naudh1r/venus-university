import { BUNNYFEEDS, type HeldFeedMemory } from '../../shared/bunnyfeeds'
import { memoryStatusLine, type CharMemory, type Result, type SceneLine } from '@vx/modkit/shared'
import { addMemory, currentRun, modIsOn, modOptionOn } from '@vx/modkit/renderer'
import { TEXT_LEDGER_FEED_LINES } from '../prompts/bunnyfeedsPrompt'
import { commentData, postData } from './bunnyfeedsData'
import { readBunnyfeedsContext } from './bunnyfeedsReadContext'

/** Where a held memory without a poster says it happened, as earlier test builds wrote it. */
const FEED_MEMORY_TAG = ', on the feed'

/** How a feed memory is found again to be replaced, earlier test builds' wordings included. */
const FEED_MEMORY_END = /, (on the feed|on Bunnyboard|on her post|under [^,]+'s post)$/

/** Where a feed memory says it happened: her own post, or the girl's she answered under. */
function whereTag(charId: string, posterId: string | undefined): string {
  if (!posterId) return FEED_MEMORY_TAG
  if (posterId === charId) return ', on her post'
  const poster = readBunnyfeedsContext().characters[posterId]
  return poster ? `, under ${poster.firstName}'s post` : FEED_MEMORY_TAG
}

/** Publishes the newest feed memory, including replacement of its unmarked legacy predecessor. */
function fileFeedMemory(
  charId: string, entry: CharMemory, where: string, run: object
): Result<null> {
  const onFeed = (memory: Readonly<CharMemory>): boolean => FEED_MEMORY_END.test(memory.desc)
  return addMemory(BUNNYFEEDS, charId, { ...entry, desc: `${entry.desc}${where}` }, {
    run, replacing: onFeed, replacingUnmarked: onFeed
  })
}

/** Keeps a thread's memories on one post until the slot its answers show. */
export function holdFeedMemories(
  posterId: string,
  postId: string,
  memories: readonly HeldFeedMemory[],
  run: object = currentRun()
): Result<null> {
  if (memories.length === 0) return { ok: true, data: null }
  return postData.update({ kind: 'post', charId: posterId, postId }, data => ({
    ...data, heldMemories: [...(data.heldMemories ?? []), ...memories]
  }), { run })
}

/** Identifies one pending memory after a reader supplied a detached copy. */
function sameHeld(a: HeldFeedMemory, b: HeldFeedMemory): boolean {
  return a.charId === b.charId && a.at === b.at && a.type === b.type &&
    a.desc === b.desc && a.posterId === b.posterId
}

/** Files due memories and removes each held entry only after its native memory write succeeds. */
export function fileDueFeedMemories(through: number, run: object = currentRun()): void {
  const game = readBunnyfeedsContext()
  for (const posterId of game.chars) {
    for (const post of game.charInfo[posterId]?.feed ?? []) {
      const due = (postData.read(post).heldMemories ?? []).filter(one => one.at <= through)
      for (const one of due) {
        const result = fileFeedMemory(one.charId, {
          date: game.date, type: one.type, desc: one.desc
        }, whereTag(one.charId, one.posterId), run)
        if (!result.ok) continue
        postData.update({ kind: 'post', charId: posterId, postId: post.id }, data => {
          const held = data.heldMemories ?? []
          const at = held.findIndex(entry => sameHeld(entry, one))
          if (at < 0) return undefined
          const left = held.filter((_, index) => index !== at)
          const { heldMemories: _done, ...rest } = data
          return left.length ? { ...rest, heldMemories: left } : rest
        }, { run })
      }
    }
  }
}

/** Every memory held for this global slot or before, not yet filed. */
function dueFeedMemories(through: number): HeldFeedMemory[] {
  const game = readBunnyfeedsContext()
  return game.chars.flatMap(charId => (game.charInfo[charId]?.feed ?? []).flatMap(post =>
    (postData.read(post).heldMemories ?? []).filter(one => one.at <= through)
  ))
}

/** The closing's feed-memory announcements, with the same names and words as native memories. */
export function feedStatusLines(through: number): SceneLine[] {
  if (!modIsOn(BUNNYFEEDS) || !modOptionOn(BUNNYFEEDS, 'announce')) return []
  const game = readBunnyfeedsContext()
  return dueFeedMemories(through).map(({ charId, type, desc, posterId }) => {
    const character = game.characters[charId]
    const name = character && game.charInfo[charId]?.nameKnown ? character.firstName : '???'
    return memoryStatusLine(name, { type, desc: `${desc}${whereTag(charId, posterId)}` })
  })
}

/** The texting ledger's note when one of the girls has player comments under her posts. */
export function textLedgerFeedLines(charKeys: readonly string[]): string[] {
  if (!modIsOn(BUNNYFEEDS)) return []
  const { charKeyToId, charInfo } = readBunnyfeedsContext()
  const commented = charKeys.some(key =>
    (charInfo[charKeyToId[key] ?? '']?.feed ?? []).some(post =>
      (post.comments ?? []).some(one => commentData.read(one).player)
    )
  )
  return commented ? [...TEXT_LEDGER_FEED_LINES, ''] : []
}
