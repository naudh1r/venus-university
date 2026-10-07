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
    why: 'localPhotoService renders on this pipeline'
  },
  {
    file: 'src/renderer/stores/loop/feed.ts',
    needs: ['pickTeaser(featured.length > 0 ? featured : fresh)'],
    why: "a stranger's photo post is never the slot's teaser, and her picture is drawn for nobody"
  },
  {
    file: 'src/renderer/stores/feedView.ts',
    needs: ['if (!post || !postVisible(post)) continue'],
    why: 'a teaser with a picture shows before the picture exists'
  },
  {
    file: 'src/renderer/views/UpdateModal.tsx',
    needs: ['${PHOTO_MOD_UPDATE_NOTE}'],
    why: 'the update offer never says that updating removes the mod'
  },
  {
    file: 'src/main/ipc.ts',
    needs: ['await exportLocalPhotos(filePath)', 'await importLocalPhotos(filePaths[0])'],
    why: 'a backup leaves her DM and feed photos behind, and a restore never puts them back'
  },
  {
    file: 'src/main/imageProtocols.ts',
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
    needs: ["| 'photos'", "| 'bodyDetails'", "| 'photoLoader'"],
    why: 'the switches are optional, so the guard must not require them'
  },
  {
    file: 'src/shared/settingsRules.ts',
    within: 'export function mergePatch(',
    needs: ['bodyDetails: patch.bodyDetails', 'photoLoader: patch.photoLoader'],
    why: 'the body switch writes nothing and springs back off'
  },
  {
    file: 'src/renderer/stores/settingsStore.ts',
    within: 'export function patchOf(',
    needs: ['bodyDetails: settings.bodyDetails', 'photoLoader: settings.photoLoader'],
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
    needs: ['afterDmReply({ charId, character, reply: data })'],
    why: 'she never sends the photo she offered'
  },
  {
    file: 'src/renderer/stores/gameLoop.ts',
    needs: ['gameEntered()', 'await deliverSlotPosts('],
    why: 'a picture that outlived its save is never found, and posts are never filed'
  },
  {
    file: 'src/renderer/stores/gameLoop.ts',
    within: 'export async function submitAction(',
    needs: ['playerActs()'],
    why: "every choice goes through here; without it a post's picture is never drawn and the post never appears"
  },
  {
    file: 'src/renderer/stores/loop/hangouts.ts',
    within: 'export async function startHangoutScene(',
    needs: ['playerActs()'],
    why: "Begin on a hangout skips submitAction; without it that slot's photo posts never appear"
  },
  {
    file: 'src/renderer/stores/loop/feed.ts',
    needs: ['fileFeedPost(', "postLikes({ kind: 'ending'", "postLikes({ kind: 'stranger'"],
    why: 'a post carries no picture and no replies, and its likes ignore her following, without these'
  },
  {
    file: 'src/renderer/stores/loop/feed.ts',
    within: 'export async function deliverSlotPosts(',
    needs: ['postVisible(post)'],
    why: 'a post still waiting for its picture is used to fill out the feed before it exists'
  },
  {
    file: 'src/renderer/stores/feedView.ts',
    within: 'export function contactFeedPosts(',
    needs: ['.filter(postVisible)'],
    why: 'a post still waiting for its picture shows on the Updates tab before it exists'
  },
  {
    file: 'src/renderer/views/ContactPage.tsx',
    needs: ['.filter(postVisible)'],
    why: 'a post still waiting for its picture shows on her page before it exists'
  },
  {
    file: 'src/renderer/mods/photoFeatureScreens.tsx',
    needs: ['<PostPhoto '],
    why: 'a post whose picture failed has no frame saying so and nothing to reroll it with'
  },
  {
    file: 'src/renderer/views/NewGameView.tsx',
    needs: ["postLikes(\n        { kind: 'winter'"],
    why: 'her winter posts are liked by her roster friends alone, not by her following'
  },
  {
    file: 'src/renderer/prompts/textingPrompt.ts',
    needs: [
      "promptLines('dm',",
      "promptFields('dm')",
      "promptRequired('dm')",
      'dmHistoryNotes(message)'
    ],
    why: 'she is not told she may send one, and has no field to answer in'
  },
  {
    file: 'src/renderer/prompts/slotIntroPrompt.ts',
    needs: ["promptLines('slot-posts',", "promptFields('slot-posts')", "promptRequired('slot-posts')"],
    why: 'a post is never asked for a picture or for what the crowd said'
  },
  {
    file: 'src/renderer/prompts/characterPrompt.ts',
    needs: [
      "promptLines('character',",
      "promptRequired('character')",
      "promptFields('character')",
      'characterFromDraft('
    ],
    why: 'a character is written without a body while the switch is on'
  },
  {
    file: 'src/renderer/views/BunnyboardModal.tsx',
    needs: [
      '<ModSlot slot="dm-message" message={message} />',
      '<ModSlot slot="feed-post" charId={charId} post={post} />',
      '<ModSlot slot="bunnyboard-overlay" />'
    ],
    why: 'nothing draws the picture on a text, on a post, the replies under one, or opens it'
  },
  {
    file: 'src/renderer/mods/photoFeatureScreens.tsx',
    needs: ['MessagePhotoBubble', 'messageId={message.id}', 'PhotoLightboxHost', 'PostComments'],
    why: 'the slots are there but Photo Feature draws nothing into them'
  },
  {
    file: 'src/renderer/mods/index.ts',
    needs: ["import './photoFeatureScreens'"],
    why: "Photo Feature's screen pieces are never registered"
  },
  {
    file: 'src/renderer/views/ContactPage.tsx',
    needs: ['useContactGallery(', 'gallery.tabs', 'gallery.panel'],
    why: 'her gallery has no tab to open it and nothing to draw'
  },
  {
    file: 'src/renderer/views/ContactPage.tsx',
    needs: ['<PostPhotoLink charId={charId} photo={entry.post.photo} />'],
    why: "a post's picture cannot be opened from her profile's feed list"
  },
  {
    file: 'src/renderer/views/sfwFields.ts',
    needs: ['note: NO_NSFW_IMAGES_NOTE'],
    why: 'the NSFW switch does not say it covers photos too'
  },
  {
    file: 'src/renderer/stores/modsStore.ts',
    needs: ['setPhotoSwitches(photoSwitchesOf(switches))'],
    why: 'the Mods screen cannot turn photographs off or pick how a photo waits'
  },
  {
    file: 'src/main/services/modsService.ts',
    needs: ['withPhotoSettingsCarried(cleanSwitches(file), await settingsToCarry())'],
    why: 'what the player set in Settings before the Mods screen is lost'
  },
  {
    file: 'src/renderer/mods/index.ts',
    needs: ["import './photoFeature'"],
    why: 'the mod is never registered, so the game asks it nothing'
  },
  {
    file: 'src/renderer/App.tsx',
    needs: ["import './mods'"],
    why: 'no mod is registered at boot'
  },
  {
    file: 'src/renderer/stores/modsStore.ts',
    needs: ['setHookRules('],
    why: 'the hooks ask every mod, switched off or not'
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
