import { database, storage, type StoredBackground } from './open'

/** The player's own backgrounds: one row each, keyed by name, record and pictures together. */

/** Every row with the name it is kept under, in name order. */
export async function allBackgroundRows(): Promise<[string, StoredBackground][]> {
  return storage('read the backgrounds', async () => {
    const tx = (await database()).transaction('backgrounds')
    const store = tx.objectStore('backgrounds')
    // Both read in one transaction, so the two lists are of the same rows in the same order.
    const [keys, rows] = await Promise.all([store.getAllKeys(), store.getAll()])
    await tx.done
    return keys.map((key, index): [string, StoredBackground] => [key, rows[index]])
  })
}

/** The row kept under `name`, or undefined where there is none. */
export async function readBackgroundRow(name: string): Promise<StoredBackground | undefined> {
  return storage('read the background', async () => (await database()).get('backgrounds', name))
}

/** Writes `row` under its name where nothing is kept under it yet; answers whether it did. */
export async function insertBackgroundRow(row: StoredBackground): Promise<boolean> {
  return storage('save the background', async () => {
    const tx = (await database()).transaction('backgrounds', 'readwrite')
    const store = tx.objectStore('backgrounds')
    // Both are database requests, so the transaction is still open for the put.
    const free = (await store.getKey(row.record.name)) === undefined
    if (free) void store.put(row, row.record.name)
    await tx.done
    return free
  })
}

/** Removes the row kept under `name`; one already gone is success. */
export async function deleteBackgroundRow(name: string): Promise<void> {
  await storage('delete the background', async () =>
    (await database()).delete('backgrounds', name)
  )
}
