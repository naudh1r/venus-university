import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

/**
 * That every core file the photo feature hooks into still calls into it.
 *
 * This is a port. Everything the feature *is* lives in files of its own, but a handful of the
 * build's own files have to call into them, and those files belong to somebody else — they are
 * replaced wholesale when a new release is synced. A hook that does not survive that sync mostly
 * fails silently: the game builds, launches and plays, and only the photographs quietly stop.
 * Half of them cannot even fail loudly in principle, a stylesheet's scheme allowlist and a
 * prompt's brief having no compiler to answer to.
 *
 * So this reads the files as text and asserts the call is still written in them. It is a crude
 * test and it knows it: it proves the line exists, not that it runs, and a rename will fail it
 * for a hook that is perfectly fine. Both are the right way round for what it is guarding —
 * after a sync the question is "did anything fall out", and a false alarm costs a glance while a
 * missed one costs a playthrough.
 *
 * What it cannot see, `photoFlow.test.ts` covers: a hook that survived in the text but no longer
 * runs where it has to.
 */

const ROOT = join(__dirname, '..')

function source(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf-8')
}

/** Each core file, and the call that must still be written in it. */
const HOOKS: readonly { file: string; needs: readonly string[]; why: string }[] = [
  {
    file: 'src/renderer/index.html',
    needs: ['playimg:'],
    why: 'the CSP names every scheme an image may load from; without it every photo is blocked'
  },
  {
    file: 'src/main/services/comfyService.ts',
    needs: ['export async function runGenerationJob'],
    why: 'photoService renders on this pipeline'
  },
  {
    file: 'src/main/charImageProtocol.ts',
    needs: ['PHOTO_SCHEME'],
    why: 'a second registerSchemesAsPrivileged replaces the first, so playimg joins this one'
  },
  {
    file: 'src/main/index.ts',
    needs: ['handlePhotoProtocol()'],
    why: 'nothing serves the photo folder otherwise'
  },
  {
    file: 'src/main/ipc.ts',
    needs: ['registerPhotoIpc(handle)'],
    why: 'the three photo channels are registered from here'
  },
  {
    file: 'src/preload/index.ts',
    needs: ['...photoApi'],
    why: 'the renderer reaches the channels through api.photo'
  },
  {
    file: 'src/web/bridge.ts',
    needs: ['...photoBridge'],
    why: 'the browser build answers the same three calls, with refusals'
  },
  {
    file: 'src/shared/characterRules.ts',
    needs: ["| 'body'"],
    why: 'her body is optional on the record, so the guard must not require it'
  },
  {
    file: 'src/shared/settingsRules.ts',
    needs: ["| 'photos'"],
    why: 'the switch is optional, so the guard must not require it'
  },
  {
    file: 'src/renderer/stores/textingLoop.ts',
    needs: ['sendPhoto(charId, character, data)', 'canRenderImages:', 'noNsfwImages:'],
    why: 'she is never asked for a photo, and never sends one, without these'
  },
  {
    file: 'src/renderer/stores/gameLoop.ts',
    needs: ['startHeldPostPhoto()', 'settlePendingPhotos()', 'await deliverSlotPosts('],
    why: 'the held render never fires, and a picture that outlived its save is never found'
  },
  {
    file: 'src/renderer/stores/loop/feed.ts',
    needs: [
      'beginSlotPhotos()',
      'preparePostPhoto(',
      'holdPostPhoto(',
      'rollComments(',
      'postLikes(',
      'strangerLikes('
    ],
    why: 'a post carries no picture and no replies, and its likes ignore her following, without these'
  },
  {
    file: 'src/renderer/views/NewGameView.tsx',
    needs: ['rollAudienceLikes(', 'reachOf('],
    why: 'her winter posts are liked by her roster friends alone, not by her following'
  },
  {
    file: 'src/renderer/prompts/textingPrompt.ts',
    needs: ['photoLines(', 'photoStub(', 'PHOTO_SCHEMA_FIELDS', 'PHOTO_SCHEMA_REQUIRED'],
    why: 'she is not told she may send one, and has no field to answer in'
  },
  {
    file: 'src/renderer/prompts/slotIntroPrompt.ts',
    needs: ['postPhotoLines(', 'postCommentLines(', 'POST_PHOTO_SCHEMA_FIELD'],
    why: 'a post is never asked for a picture or for what the crowd said'
  },
  {
    file: 'src/renderer/prompts/characterPrompt.ts',
    needs: ['BODY_FIELD_LINES', 'cleanBody(', "'body',"],
    why: 'characters are written without a body, so every photograph is a face and a room'
  },
  {
    file: 'src/renderer/views/BunnyboardModal.tsx',
    needs: ['MessagePhotoBubble', 'PhotoLightboxHost', 'MessagePhoto', 'PostComments'],
    why: 'nothing draws the picture on a text, on a post, or the replies under one'
  },
  {
    file: 'src/renderer/views/ContactPage.tsx',
    needs: ['useContactGallery(', 'gallery.tabs', 'gallery.panel'],
    why: 'her gallery has no tab to open it and nothing to draw'
  },
  {
    file: 'src/renderer/views/AppSettingsModal.tsx',
    needs: ['settings-photos'],
    why: 'the player cannot turn photographs off'
  },
  {
    file: 'src/renderer/vu_styles/PhotoBubble.css',
    needs: ['.vu-bb-bubble.vu-bb-bubble--photo'],
    why: 'at one class the build’s own bubble rule wins on load order and the picture sits in a padded bubble'
  },
  {
    file: 'src/renderer/vu_styles/ContactGallery.css',
    needs: ['.vu-gallery-grid.vu-contact-shots', '.vu-gallery-cell.vu-contact-shot'],
    why: 'at one class the CG grid wins on load order and her gallery draws in landscape cells'
  },
  {
    file: 'src/renderer/views/EditCharacterModal.tsx',
    needs: ['BODY_FIELDS.map', 'bodyForm(', 'cleanBody('],
    why: 'her body cannot be read or written by hand'
  }
]

describe('every core file still calls into the photo feature', () => {
  for (const hook of HOOKS) {
    for (const needle of hook.needs) {
      it(`${hook.file} — ${needle}`, () => {
        expect(source(hook.file), hook.why).toContain(needle)
      })
    }
  }
})
