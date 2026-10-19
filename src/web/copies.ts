import { database, storage } from './db/open'
import { isShipped, shippedCharIds } from './packs'

/**
 * Which shipped characters the player has edited. A shipped character is read out of her pack
 * until the first write that would change her; that write copies her into the browser's storage
 * under her own id, and from then on the copy is what every read uses.
 */

/** The shipped ids that have a row in storage: the copies. */
const copied = new Set<string>()

/** Whether this character is still read out of her pack rather than out of storage. */
export function isPackRead(charId: string): boolean {
  return isShipped(charId) && !copied.has(charId)
}

/** Every shipped id that has been copied into storage. */
export function copiedIds(): string[] {
  return [...copied]
}

/** Records that a shipped character is now kept in storage. */
export function markCopied(charId: string): void {
  copied.add(charId)
}

/** Records that a shipped character's copy is gone and the pack is hers again. */
export function unmarkCopied(charId: string): void {
  copied.delete(charId)
}

/**
 * Rebuilds the set from the character rows storage holds. Run once before the first picture is
 * asked for, and again after a restore, which can bring copies in.
 */
export async function loadCopied(): Promise<void> {
  const keys = await storage('read the characters', async () =>
    (await database()).getAllKeys('characters')
  )
  const stored = new Set(keys)
  copied.clear()
  for (const charId of shippedCharIds()) {
    if (stored.has(charId)) copied.add(charId)
  }
}
