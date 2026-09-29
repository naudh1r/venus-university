import type { CharacterBody } from './characterBody'
import type { PostComment } from './postComments'
import type { Character, Result } from './types'

/**
 * What the photo feature adds to the save's shapes, added from outside them.
 *
 * Every field here could have been written into `types.ts` beside the interface it belongs to,
 * and in the build this was ported from it was. It is declared here instead because this
 * feature lives alongside a codebase it does not own: the upstream build is synced in whole
 * files, and a field added inside `types.ts` is a line that has to be found and re-inserted by
 * hand on every sync. An interface is open, so the same field can be declared from here and
 * mean exactly the same thing to the compiler — and a sync that overwrites `types.ts` carries
 * nothing away with it.
 *
 * Nothing imports this file for a value; it has none. It reaches the compiler because the
 * project includes `src`, and the augmentations below apply to the whole program from there.
 */

/** One picture on a thread, in whichever state the render left it. */
export interface ChatPhoto {
  /** How far it goes, as the gate settled it; the bubble covers an explicit one until tapped. */
  tier: string
  /**
   * What the picture shows, in her own words. The render reads it, and so does the next turn's
   * history: a girl who cannot remember what she sent cannot be teased about it, and sends the
   * same shot twice.
   */
  scene?: string
  /** File name under the playthrough's own photo folder; absent until the render lands. */
  file?: string
  /** Still being drawn: the bubble holds a placeholder in its place. */
  pending?: true
  /** The render failed and nothing arrived; the bubble says so once, quietly. */
  failed?: true
}

declare module './types' {
  interface Character {
    /**
     * Her body, one pooled tag per field, drawn into her pictures while the body switch is on.
     * Optional throughout: a character written before it existed has none, and is drawn as she
     * always was.
     */
    body?: CharacterBody
  }

  interface ChatMessage {
    /** The picture this message carries, if it carries one. */
    photo?: ChatPhoto
  }

  interface SocialPost {
    /** The picture attached to the post. */
    photo?: ChatPhoto
    /**
     * What other students replied underneath it. Written by the same call that wrote the post,
     * kept back until each one's slot arrives (`shownComments`).
     */
    comments?: PostComment[]
  }

  interface TextingResponse {
    /** She attaches a picture to this reply. What it may show is `photoGate`'s to decide. */
    sendPhoto?: boolean
    /** The picture she wants, in her own words. */
    photoPrompt?: string
    /**
     * What she says that picture is — a `PhotoTier`. Read alongside the caption rather than
     * instead of it: it may only raise the reading, never lower it.
     */
    photoTier?: string
  }

  interface Settings {
    /**
     * Whether a character may send the reader a photograph of herself at all — in a DM, and on
     * the feed. Off leaves every thread as it was before the feature existed.
     */
    photos?: boolean
    /**
     * Whether a character's body is asked for, edited and drawn: her build, chest, hips,
     * backside and hair, one pooled tag each, in her sprites, CGs and photographs. Off, and
     * absent, leaves every picture as the build draws it.
     */
    bodyDetails?: boolean
  }
}

/**
 * The three channels the renderer calls, on `api.photo`.
 *
 * Declared from this folder rather than beside the implementation in `preload/photoApi.ts`
 * because `src/shared` is the only tree both `tsconfig.node.json` and `tsconfig.web.json`
 * include — the renderer cannot see a declaration made in `src/preload`, and `api.d.ts`'s own
 * `comfy` key is an inline literal that merging cannot reach.
 */
declare module '../preload/api' {
  interface VenusUniversityApi {
    photo: {
      /**
       * The name the next picture of `kind` will land under, settled before it is drawn so the
       * bubble waiting for it carries that name into the save immediately.
       */
      reserveName: (
        playthroughId: string,
        character: Character,
        kind: string
      ) => Promise<Result<string>>
      /**
       * Whether a picture a bubble is still waiting for is on disk after all. Asked on load: a
       * render can finish after the save that was waiting for it was written.
       */
      landed: (playthroughId: string, charId: string, file: string) => Promise<Result<boolean>>
      /**
       * Resolves with the file name when the queued render finishes. `tier` has already been
       * settled by `photoGate`; nothing downstream re-opens it.
       */
      generate: (
        playthroughId: string,
        character: Character,
        tier: string,
        photoPrompt: string,
        file: string
      ) => Promise<Result<string>>
    }
  }
}
