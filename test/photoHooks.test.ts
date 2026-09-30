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
  return readFileSync(join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')
}

/**
 * The body of one top-level function, from its signature to the brace that closes it at the
 * start of a line. Empty when the signature is not in the file, which fails the check below.
 */
function bodyOf(text: string, signature: string): string {
  const start = text.indexOf(signature)
  if (start < 0) return ''
  const end = text.indexOf('\n}\n', start)
  return text.slice(start, end < 0 ? undefined : end)
}

/**
 * Each core file, and the call that must still be written in it — inside one function, where
 * `within` names it. Being somewhere in the file was once not enough: the held-render trigger sat
 * in the day-0 opening, which shares its first three lines with `submitAction`, and passed.
 */
const HOOKS: readonly {
  file: string
  needs: readonly string[]
  within?: string
  why: string
}[] = [
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
    needs: ["| 'photos'", "| 'bodyDetails'"],
    why: 'the switches are optional, so the guard must not require them'
  },
  {
    file: 'src/shared/settingsRules.ts',
    within: 'export function mergePatch(',
    needs: ['bodyDetails: patch.bodyDetails'],
    why: 'the body switch writes nothing and springs back off'
  },
  {
    file: 'src/renderer/stores/settingsStore.ts',
    within: 'export function patchOf(',
    needs: ['bodyDetails: settings.bodyDetails'],
    why: 'a save made from any other control turns the body switch back off'
  },
  {
    file: 'src/shared/imagePrompt.ts',
    within: 'export function spriteDraft(',
    needs: ["bodyAppearance(character, set === 'nude' ? 'nude' : 'sprite')", 'bodyNegative(character)'],
    why: 'her sprites are drawn without her body, and a petite one with nothing keeping her adult'
  },
  {
    file: 'src/shared/imagePrompt.ts',
    within: 'export function cgSetDraft(',
    needs: ["bodyAppearance(character, 'cg')", 'bodyNegative(character)'],
    why: 'her CGs are drawn without her body, and a petite one with nothing keeping her adult'
  },
  {
    file: 'src/main/services/comfyService.ts',
    within: 'export async function generateSprite(',
    needs: ['character = await withBodySetting(character)'],
    why: 'a sprite draws her body whether or not the switch is on'
  },
  {
    file: 'src/main/services/comfyService.ts',
    within: 'export async function generateCg(',
    needs: ['character = await withBodySetting(character)'],
    why: 'a CG draws her body whether or not the switch is on'
  },
  {
    file: 'src/main/services/comfyService.ts',
    within: 'export async function fixHands(',
    needs: ['character = await withBodySetting(character)'],
    why: 'a hand fix redraws her frame with a body the base was drawn without'
  },
  {
    file: 'src/renderer/views/ManageCharactersView.tsx',
    needs: ['<BodyDetailsToggle />'],
    why: 'the body switch cannot be turned on'
  },
  {
    file: 'src/renderer/stores/textingLoop.ts',
    needs: ['sendPhoto(charId, character, data)', 'canRenderImages:', 'noNsfwImages:'],
    why: 'she is never asked for a photo, and never sends one, without these'
  },
  {
    file: 'src/renderer/stores/gameLoop.ts',
    needs: ['settlePendingPhotos()', 'await deliverSlotPosts('],
    why: 'a picture that outlived its save is never found, and posts are never filed'
  },
  {
    file: 'src/renderer/stores/gameLoop.ts',
    within: 'export async function submitAction(',
    needs: ['startHeldPostPhoto()'],
    why: "every choice goes through here; without it a post's picture is never drawn and the post never appears"
  },
  {
    file: 'src/renderer/stores/loop/hangouts.ts',
    within: 'export async function startHangoutScene(',
    needs: ['startHeldPostPhoto()'],
    why: "Begin on a hangout skips submitAction; without it that slot's photo posts never appear"
  },
  {
    file: 'src/renderer/stores/loop/feed.ts',
    needs: [
      'preparePostPhoto(',
      'holdPostPhoto(',
      'rollComments(',
      'postLikes(',
      'strangerLikes('
    ],
    why: 'a post carries no picture and no replies, and its likes ignore her following, without these'
  },
  {
    file: 'src/renderer/stores/loop/feed.ts',
    within: 'export async function deliverSlotPosts(',
    needs: ['postIsOut(post)'],
    why: 'a post still waiting for its picture is used to fill out the feed before it exists'
  },
  {
    file: 'src/renderer/stores/feedView.ts',
    within: 'export function contactFeedPosts(',
    needs: ['.filter(postIsOut)'],
    why: 'a post still waiting for its picture shows on the Updates tab before it exists'
  },
  {
    file: 'src/renderer/views/ContactPage.tsx',
    needs: ['.filter(postIsOut)'],
    why: 'a post still waiting for its picture shows on her page before it exists'
  },
  {
    file: 'src/renderer/views/BunnyboardModal.tsx',
    needs: ['<PostPhoto '],
    why: 'a post whose picture failed has no frame saying so and nothing to reroll it with'
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
    needs: ['bodyBriefLines()', 'bodySchemaRequired()', 'bodySchemaFields()', 'bodyOfDraft('],
    why: 'a character is written without a body while the switch is on'
  },
  {
    file: 'src/renderer/views/BunnyboardModal.tsx',
    needs: ['MessagePhotoBubble', 'messageId={message.id}', 'PhotoLightboxHost', 'PostComments'],
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
    needs: [
      '<BodyFieldsSection',
      'bodyForm(',
      'cleanBody(',
      "} from './bodyDrafts'",
      "import type { PromptGroup } from '@shared/regenTags'"
    ],
    why: 'her body cannot be read or written by hand, and a regenerate draws it with the switch off'
  }
]

describe('every core file still calls into the photo feature', () => {
  for (const hook of HOOKS) {
    for (const needle of hook.needs) {
      const where = hook.within ? ` in ${hook.within.replace(/^export |async |function |\($/g, '')}` : ''
      it(`${hook.file} — ${needle}${where}`, () => {
        const text = source(hook.file)
        expect(hook.within ? bodyOf(text, hook.within) : text, hook.why).toContain(needle)
      })
    }
  }
})
