import { allowedPhotoTier, PHOTO_TIERS, type PhotoTier } from '@shared/photoGate'
import { affectionFor } from '@shared/relationship'
import type { Character, CharInfo, ChatMessage } from '@shared/types'
import type { TextingPromptState } from './textingPrompt'

/**
 * What she is told she may photograph, what the thread remembers of the pictures she has already
 * sent, and the three reply fields that carry one.
 *
 * All of it lives here rather than inside `textingPrompt`, which keeps four hook lines: the rules
 * block, the history stub, and the schema's two spreads. The two state fields below are declared
 * from here too, so `TextingPromptState` needs no edit.
 */

declare module './textingPrompt' {
  interface TextingPromptState {
    /**
     * Whether a picture can be drawn at all: the local renderer is optional, and absent on the
     * web. Absent here reads as no renderer, so a caller that has not thought about it gets a
     * thread with no photos in it rather than one that offers pictures it cannot deliver.
     */
    canRenderImages?: boolean
    /** The player's switch: with it on, no picture of her is ever undressed. */
    noNsfwImages?: boolean
  }
}

/**
 * The picture that went with a text, as the thread remembers it. Written beside her words so the
 * next turn knows she sent one and what was in it — otherwise every photo is new to her.
 */
export function photoStub(message: ChatMessage, flatText: (text: string) => string): string {
  const scene = message.photo?.scene?.trim()
  if (!scene) return ''
  return ` [attached a photo: ${flatText(scene)}]`
}

/**
 * What she may attach to this reply, and what she must not. The tier is the gate's, decided from
 * the save before this call: the prompt is told what she would send, never asked to judge it, and
 * what comes back is read again on the way in.
 */
export function photoLines(
  character: Character,
  info: CharInfo | undefined,
  state: TextingPromptState
): string[] {
  const name = character.firstName
  // Settled from the save before she is asked anything, and read again when the reply lands.
  const tier: PhotoTier = allowedPhotoTier({
    flags: info?.flags,
    affection: affectionFor(info, state.date, character),
    traits: character.traits,
    noNsfwImages: state.noNsfwImages === true,
    canRender: state.canRenderImages === true
  })

  if (tier === 'none') {
    // Nothing is said about photos at all: an instruction not to send one is an idea to send one.
    return []
  }

  const may =
    tier === 'explicit'
      ? `${name} will send anything, undressed included. She has already been that far with him, so nothing is being asked for the first time.`
      : tier === 'suggestive'
        ? `${name} will send a flirty one — what she is wearing, a swimsuit, underwear — but nothing more than that. Nothing undressed.`
        : `${name} only sends ordinary pictures: where she is, what she is eating, her outfit, something that made her laugh. Nothing flirty, nothing undressed.`

  return [
    'PHOTOS',
    `${name} can attach one picture to this reply. Set "sendPhoto" and describe it in "photoPrompt".`,
    may,
    'A picture is worth sending when the texts are already about one — she offers it, or he asked and she wants to. Most replies are just words: set "sendPhoto" false and leave "photoPrompt" empty.',
    `Write "photoPrompt" as what the picture shows, the way ${name} would caption it to herself. One sentence, and a full one: where she is, what she is wearing, how she is sitting or lying or standing, what her hands are doing, how close the shot is, and where she is looking.`,
    'What is not written is not drawn. A caption that says only "a selfie" gets a picture of nobody in particular.',
    'Then set "photoTier" to what that picture is, which is a separate question from whether she would send it: "everyday" for one with nothing on show, "suggestive" for underwear, swimwear or a towel, "explicit" for one where any part of her usually covered is not. Judge the picture you described, not the words you described it in — a caption that never says a word for it can still be a picture of one. "none" where there is no picture.',
    ...(tier === 'explicit'
      ? [
          // The gate has already allowed this; a caption that will not say it renders a picture
          // that does not show it, and the tease is read as the whole of what she sent.
          `So a picture of ${name} undressed is captioned as one, in plain words: what is bare, what she is doing, what the shot shows. Coy wording is a coy picture — "the top of a shirt" is a photograph of a shirt.`,
          'Write it as she would, not as a catalogue: she is sending this to somebody she has slept with, and she knows what she is doing.',
          'Nothing anal.'
        ]
      : []),
    'Write the picture, not the sending of it: no phone in her hand unless it is a mirror shot, and no words about pressing send.',
    // The renderer draws one girl and nobody else, and the gate refuses a caption that says otherwise.
    `${name} is alone in the picture and took it herself. Nobody else is in it or touching her, and nothing in it is done with anybody else.`,
    'Name nobody and nowhere: not herself, not the reader, not a building, a dorm or a place on the map. A picture cannot show a name. "her room", "a lecture hall", "the cafe" — what it looks like, never what it is called.',
    'Her texts should read like somebody who just sent that picture. Do not describe it in them.',
    'Any picture she has already sent is written into RECENT MESSAGES beside the text it came with. She knows what she sent him and would not send the same one twice.',
    ''
  ]
}

/** The reply fields a photo needs, spread into `textingSchema`'s required list. */
export const PHOTO_SCHEMA_REQUIRED = ['sendPhoto', 'photoPrompt', 'photoTier'] as const

/** The same three as schema properties, spread into `textingSchema`'s property map. */
export const PHOTO_SCHEMA_FIELDS: Record<string, unknown> = {
  sendPhoto: { type: 'boolean' },
  photoPrompt: { type: 'string' },
  // What she says the picture is. Required and answered "none" where there is no picture, since
  // an optional field is one a model leaves out.
  photoTier: { type: 'string', enum: [...PHOTO_TIERS] }
}

/**
 * What a picture on a feed post may be, told to the slot-intro call.
 *
 * Flat, because a post is public: `allowedPostTier` caps every one of them at the same place
 * whoever is posting, so unlike the thread's brief there is nothing here to read off a save.
 * Returned empty when no picture can be drawn at all, since an instruction not to attach one is
 * an idea to attach one.
 */
export function postPhotoLines(canRenderImages: boolean): string[] {
  if (!canRenderImages) return []
  return [
    'A post may carry a picture she took. Describe it in "image" — what the photograph shows, the way she would caption it to herself: where she is, what she is wearing, how she is standing or sitting, how close the shot is. One sentence, and a full one. Leave "image" empty on a post that is just words, which most of them are.',
    'What is not written is not drawn: "a selfie" gets a picture of nobody in particular.',
    'Her whole year sees this, so it is an ordinary picture or a flirty one at most — what she is wearing, a day out, a swimsuit. Never anything undressed, whatever she might send one person in a message.',
    'Name nobody and nowhere: a picture cannot show a name. "her room", "the quad", "a cafe" — what it looks like, never what it is called.',
    'She is the only person in the picture.',
    'The post’s own "text" should read like somebody who just posted that picture, without describing it.'
  ]
}

/**
 * The replies under a post, which the model writes because a canned line cannot answer what she
 * actually posted. How many are kept is rolled against how many girls she is close to; this only
 * has to supply enough of them, and the right kind.
 */
export function postCommentLines(): string[] {
  return [
    'Each post also carries "comments": what other students replied underneath it, in their own voices — up to five, and an empty array on the posts nobody answers, which is most of them. A post with a picture draws more than one without.',
    'They are strangers from the four thousand this campus holds, not the characters above: they do not know her, they are not the reader, and none of them may be named. No handles and no @s — just what each one said.',
    'They answer the post they are under. A reply to a picture is a reply to that picture; one under a picture with skin in it reads like a public feed at its least charming, which is strangers being obvious at somebody who did not ask.'
  ]
}

/** The fields a post's picture and its replies need, spread into the slot-intro schema. */
export const POST_PHOTO_SCHEMA_FIELD: Record<string, unknown> = {
  image: { type: 'string' },
  comments: { type: 'array', items: { type: 'string' } }
}

/**
 * Both are **required and answered empty**, never omitted: a field a model may leave out is a
 * field it leaves out, and `image` decides whether a picture happens at all.
 */
export const POST_PHOTO_SCHEMA_REQUIRED = ['image', 'comments'] as const
