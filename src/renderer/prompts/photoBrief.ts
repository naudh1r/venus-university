import { photoFeatureOn } from '@shared/photoSwitches'
import {
  allowedPhotoTier,
  PHOTO_TIERS,
  photoReasonOf,
  type PhotoReason,
  type PhotoTier
} from '@shared/photoGate'
import { affectionFor } from '@shared/relationship'
import { wardrobeLine } from '@shared/photoWardrobe'
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

  // Two briefs, and she reads only hers: how an undressed picture is captioned, and why she would
  // send one, are said only to a girl who may.
  return tier === 'explicit'
    ? intimateBrief(character, photoReasonOf(info?.flags, character.traits) ?? 'crush')
    : normalBrief(character, tier)
}

/** An everyday or a suggestive picture: what she will send, and the rules every picture keeps. */
function normalBrief(character: Character, tier: 'everyday' | 'suggestive'): string[] {
  const name = character.firstName
  return [
    ...opening(name),
    tier === 'suggestive'
      ? `${name} will send a flirty one — what she is wearing, a swimsuit, underwear — but nothing more than that. Nothing undressed.`
      : `${name} only sends ordinary pictures: where she is, what she is eating, her outfit, something that made her laugh. Nothing flirty, nothing undressed.`,
    ...captioning(character),
    ...keeping(name)
  ]
}

/**
 * An undressed picture. Why she would send one is said as what is true of the two of them, since
 * a model told she has slept with somebody she has not writes the history in: what they have
 * done, or who she is, or that she is into him and it is her own decision.
 */
function intimateBrief(character: Character, reason: PhotoReason): string[] {
  const name = character.firstName
  return [
    ...opening(name),
    `${name} will send anything of herself, undressed included. ${INTIMATE_REASON[reason]}`,
    ...captioning(character),
    // The gate has already allowed this; a caption that will not say it renders a picture that
    // does not show it, and the tease is read as the whole of what she sent.
    `So a picture of ${name} undressed is captioned as one, in plain words: what is bare, what she is doing, what the shot shows. Coy wording is a coy picture — "the top of a shirt" is a photograph of a shirt.`,
    `Write it as she would, not as a catalogue: she is sending this to ${reason === 'intimate' ? 'somebody she has slept with' : "somebody she's into"}, and she knows what she is doing.`,
    ...keeping(name)
  ]
}

/** Why an undressed picture is hers to send, in the order `photoReasonOf` settles it. */
const INTIMATE_REASON: Readonly<Record<PhotoReason, string>> = {
  intimate: 'She has already been that far with him, so nothing is being asked for the first time.',
  promiscuous:
    "This is nothing new for her: she sends pictures like this to people she's into, and he has her number.",
  crush:
    "She's into him, but they haven't been together. Sending one is her own decision, and not a small one: she does it when she wants to, never because he pushed."
}

/** Both briefs open the same way. */
function opening(name: string): string[] {
  return [
    'PHOTOS',
    `${name} can attach one picture to this reply. Set "sendPhoto" and describe it in "photoPrompt".`
  ]
}

/** When a picture is worth sending, how it is captioned, and what it is. Both briefs. */
function captioning(character: Character): string[] {
  const name = character.firstName
  return [
    'A picture is worth sending when the texts are already about one — she offers it, or he asked and she wants to. Most replies are just words: set "sendPhoto" false and leave "photoPrompt" empty.',
    `Write "photoPrompt" as what the picture shows, the way ${name} would caption it to herself. One sentence, and a full one: where she is, what she is wearing, how she is sitting or lying or standing, what her hands are doing, how close the shot is, and where she is looking.`,
    // The three kinds of picture the renderer draws, named together so no one of them is the
    // default: with "a selfie" as the only example, every picture came back a selfie.
    'It can be a selfie, a mirror selfie, or a photo a friend took of her, whichever fits the moment.',
    'What is not written is not drawn. A caption that says only "a photo of me" gets a picture of nobody in particular.',
    wardrobeLine(character),
    'Then set "photoTier" to what that picture is, which is a separate question from whether she would send it: "everyday" for one with nothing on show, "suggestive" for underwear, swimwear or a towel, "explicit" for one where any part of her usually covered is not. Judge the picture you described, not the words you described it in — a caption that never says a word for it can still be a picture of one. "none" where there is no picture.'
  ]
}

/** What every picture keeps to, whatever it shows. Both briefs close on it. */
function keeping(name: string): string[] {
  return [
    // Not every picture is a selfie: somebody else may have taken it, or a timer, so the phone is
    // in it only where it would be.
    "Describe the picture itself: how she looks in it, not how it was taken or sent. A phone only appears in it when it's a mirror selfie.",
    // The renderer draws one girl and nobody else, and the gate refuses a caption that says otherwise.
    `${name} is the only person in the picture. Whoever took it stays behind the camera: nobody else is in it, touching her, or doing anything with her.`,
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
  // The field is in the schema either way, which is fixed so the call stays cacheable, so it
  // is told it is empty rather than left to guess: unexplained, it comes back as file names.
  if (!canRenderImages) return ['Leave "image" empty on every post: nobody posts a picture today.']
  return [
    'A post may carry a picture of her. Describe it in "image" — what the photograph shows, the way she would caption it to herself: where she is, what she is wearing, how she is standing or sitting, how close the shot is. One sentence, and a full one. Leave "image" empty on a post that is just words, which most of them are.',
    'It can be a selfie, a mirror selfie, or a photo a friend took of her, whichever fits the moment.',
    'What is not written is not drawn: "a photo of me" gets a picture of nobody in particular.',
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
export function postCommentLines(on: boolean = photoFeatureOn()): string[] {
  // The field is in the schema either way, so the call stays cacheable; off, it is told empty.
  if (!on) return ['Leave "comments" empty on every post.']
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
