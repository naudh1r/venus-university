import { useGameStore } from './gameStore'
import { savePhotoState, setFeedPostPhoto, setMessagePhoto } from './localPhotoStore'

/**
 * Settles every picture a bubble was still waiting for when the game was last closed.
 *
 * A render outlives the save that started it: the picture is written to disk, and the bubble is
 * told about it in memory, which only reaches the save at the *next* write. Close the game in
 * between and the bubble comes back saying it is still waiting, forever, for a picture that is
 * sitting right there. Since the name is settled before the render, the bubble already knows what
 * to look for — so it asks, and takes the answer either way.
 */
export async function settlePendingPhotos(): Promise<void> {
  const game = useGameStore.getState()
  const playthroughId = game.playthroughId
  if (!playthroughId) return
  let settled = false

  // A picture on a post on somebody's feed.
  for (const charId of Object.keys(game.charInfo)) {
    for (const post of game.charInfo[charId]?.feed ?? []) {
      const photo = post.photo
      if (!photo?.pending) continue
      // A bubble from before pictures were named cannot be looked for; it stops waiting.
      const landed = photo.file
        ? await window.api.photo.landed(playthroughId, charId, photo.file)
        : { ok: true as const, data: false }
      const found = landed.ok && landed.data
      if (useGameStore.getState().playthroughId !== playthroughId) return
      setFeedPostPhoto(charId, post.id, {
        tier: photo.tier,
        scene: photo.scene,
        ...(photo.file ? { file: photo.file } : {}),
        ...(found ? {} : { failed: true })
      })
      settled = true
      console.log(
        `[feed] a post's picture was still waiting: ${photo.file ?? 'unnamed'} — ${
          found ? 'found it' : 'gone'
        }`
      )
    }
  }

  // The same race on a thread: she sent the picture, the render outlived the save.
  for (const [charId, thread] of Object.entries(game.bunnyboard.conversations)) {
    for (const message of thread?.messages ?? []) {
      const photo = message.photo
      if (!photo?.pending) continue
      const landed = photo.file
        ? await window.api.photo.landed(playthroughId, charId, photo.file)
        : { ok: true as const, data: false }
      const found = landed.ok && landed.data
      if (useGameStore.getState().playthroughId !== playthroughId) return
      setMessagePhoto(charId, message.id, {
        tier: photo.tier,
        scene: photo.scene,
        ...(photo.file ? { file: photo.file } : {}),
        ...(found ? {} : { failed: true })
      })
      settled = true
      console.log(
        `[texting] her picture was still waiting: ${photo.file ?? 'unnamed'} — ${
          found ? 'found it' : 'gone'
        }`
      )
    }
  }

  // Whatever the sweep settled goes to disk now, so a save that is loaded and closed without
  // playing does not ask the same questions again next time.
  if (settled) savePhotoState()
}
