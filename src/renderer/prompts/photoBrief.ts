import { fillPronouns, genderOf } from '../../shared/photoGender'
import { messagePhoto } from '../stores/photoRecords'
import { photoFeatureOn } from '../../shared/photoSwitches'
import {
  allowedPhotoTier,
  PHOTO_TIERS,
  photoReasonOf,
  type PhotoReason,
  type PhotoTier
} from '../../shared/photoGate'
import { affectionFor, type Character, type CharInfo, type ChatMessage } from '@vx/modkit/shared'
import { wardrobeLine } from '../../shared/photoWardrobe'
import type { TextingPromptState } from '@vx/modkit/renderer'

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

/** "Dorm" read back beside an undressed picture gets the next reply refused, so it is her room. */
function withoutDorm(scene: string): string {
  return scene
    .replace(/\bdorm(itory)?\s+(room|bed)\b/gi, '$2')
    .replace(/\bdorm(itory)?\b/gi, 'room')
}

/**
 * The picture that went with a text, as the thread remembers it. Written beside her words so the
 * next turn knows she sent one and what was in it — otherwise every photo is new to her.
 */
export function photoStub(
  message: ChatMessage,
  flatText: (text: string) => string,
  // Who the friend in it is called, from her charId; absent, she is left unnamed.
  nameOf: (charId: string) => string | undefined = () => undefined
): string {
  const photo = messagePhoto.read(message)
  const scene = photo?.scene?.trim()
  if (!scene) return ''
  const friend = photo?.with ? nameOf(photo.with) : undefined
  return ` [attached a photo${friend ? ` with ${friend}` : ''}: ${flatText(withoutDorm(scene))}]`
}

/**
 * What she may attach to this reply, and what she must not. The tier is the gate's, decided from
 * the save before this call: the prompt is told what she would send, never asked to judge it, and
 * what comes back is read again on the way in.
 */
export function photoLines(
  character: Character,
  info: CharInfo | undefined,
  state: Pick<TextingPromptState, 'date' | 'canRenderImages' | 'noNsfwImages'>,
  occasion: PhotoOccasion = 'reply'
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
  const lines =
    tier === 'explicit'
      ? intimateBrief(character, photoReasonOf(info?.flags, character.traits) ?? 'crush', occasion)
      : normalBrief(character, tier, occasion)
  if (genderOf(character) === 'male') {
    lines.push(
      'A bare chest is ordinary. Nudity below the waist and sexual activity are explicit; underwear and swimwear are suggestive.'
    )
  }
  return lines.map((line) => fillPronouns(line, genderOf(character)))
}

/** What her picture goes with: her answer to the reader, or texts she sends him first. */
export type PhotoOccasion = 'reply' | 'reachOut'

/** An everyday or a suggestive picture: what she will send, and the rules every picture keeps. */
function normalBrief(
  character: Character,
  tier: 'everyday' | 'suggestive',
  occasion: PhotoOccasion
): string[] {
  const name = character.firstName
  return [
    ...opening(name, occasion),
    tier === 'suggestive'
      ? `${name} will send a flirty one — what {they} is wearing, a swimsuit, underwear — but nothing more than that. Nothing undressed.`
      : `${name} only sends ordinary pictures: where {they} is, what {they} is eating, {their} outfit, something that made {them} laugh. Nothing flirty, nothing undressed.`,
    ...captioning(character, occasion),
    ...keeping(name, occasion)
  ]
}

/**
 * An undressed picture. Why she would send one is said as what is true of the two of them, since
 * a model told she has slept with somebody she has not writes the history in: what they have
 * done, or who she is, or that she is into the reader and it is her own decision.
 */
function intimateBrief(
  character: Character,
  reason: PhotoReason,
  occasion: PhotoOccasion
): string[] {
  const name = character.firstName
  return [
    ...opening(name, occasion),
    `${name} will send anything of {themself}, undressed included. ${INTIMATE_REASON[reason]}`,
    ...captioning(character, occasion),
    // The gate has already allowed this; a caption that will not say it renders a picture that
    // does not show it, and the tease is read as the whole of what she sent.
    `So a picture of ${name} undressed is captioned as one, in plain words: what is bare, what {they} is doing, what the shot shows. Coy wording is a coy picture — "the top of a shirt" is a photograph of a shirt.`,
    `Write it as {they} would, not as a catalogue: {they} is sending this to ${reason === 'intimate' ? 'somebody {they} has slept with' : "somebody {they}'s into"}, and {they} knows what {they} is doing.`,
    ...keeping(name, occasion)
  ]
}

/** Why an undressed picture is hers to send, in the order `photoReasonOf` settles it. */
const INTIMATE_REASON: Readonly<Record<PhotoReason, string>> = {
  intimate:
    '{They} has already been that far with the reader, so nothing is being asked for the first time.',
  promiscuous:
    "This is nothing new for {them}: {they} sends pictures like this to people {they}'s into, and the reader has {their} number.",
  crush:
    "{They}'s into the reader, but they haven't been together. Sending one is {their} own decision, and not a small one: {they} does it when {they} wants to, never because the reader pushed."
}

/** Both briefs open the same way. */
function opening(name: string, occasion: PhotoOccasion): string[] {
  return [
    'PHOTOS',
    occasion === 'reply'
      ? `${name} can attach one picture to this reply. Set "sendPhoto" and describe it in "photoPrompt".`
      : `${name} can attach one picture to these texts. Set "sendPhoto" in {their} entry and describe it in "photoPrompt".`
  ]
}

/** When a picture is worth sending, how it is captioned, and what it is. Both briefs. */
function captioning(character: Character, occasion: PhotoOccasion): string[] {
  const name = character.firstName
  return [
    occasion === 'reply'
      ? 'A picture is worth sending when the conversation is already about one — {they} offers it, or the reader asked and {they} wants to. Most replies are just words: set "sendPhoto" false and leave "photoPrompt" empty.'
      : 'A picture is worth sending when it is part of what {they} is texting about, and {they} would rather show the reader than tell the reader. Most texts like these are just words: set "sendPhoto" false and leave "photoPrompt" empty.',
    `Write "photoPrompt" as what the picture shows, the way ${name} would caption it to {themself}. One sentence, and a full one: where {they} is, what {they} is wearing, how {they} is sitting or lying or standing, what {their} hands are doing, where {they} is looking, the light, and the shot.`,
    // His request decides the picture; the shots after it are the ones the tags can draw.
    'If the reader asked for a particular picture — a selfie, {their} outfit, {their} face — that is the picture. Otherwise the shot is whichever suits the moment, and not the one {they} sent last: {their} face up close, from the waist up, from the knees up, head to toe, or further back with more of the place; straight on, from above, from below, from the side, or from behind.',
    'Either {they} takes it now, where {they} is and at this time of day, or it is one {they} already has, from earlier — today, a weekend, a trip, a night out. Either way, say its light: morning sun, the lamp in {their} room, a street at night. A selfie is for showing the reader right now.',
    'A mirror selfie only where there would be a mirror: {their} room, a bathroom, a changing room. Write it as what the photo shows, {them} facing the mirror with {their} phone up, not the mirror or {their} reflection. A picture of {them} from behind has no mirror and no phone in it.',
    'A close-up of {their} face is for {their} look, not {their} outfit or the place: say "a close-up of {their} face".',
    'What is not written is not drawn. A caption that says only "a photo of me" gets a picture of nobody in particular.',
    '{They} holds one thing at most, and in a selfie the phone already takes one hand: a bubble tea, a book, a bouquet — not an umbrella and a crepe as well. Hands that hold nothing do whatever {they} would do with them in a photo: a peace sign, maybe, or a hand in {their} hair, or nothing in particular.',
    wardrobeLine(character),
    `Then set "photoTier" to what that picture is, which is a separate question from whether {they} would send it: "everyday" for one with nothing on show, "suggestive" for underwear, swimwear or a towel, "explicit" for ${genderOf(character) === 'male' ? 'nudity below the waist or sexual activity' : 'one where any part of {them} usually covered is not'}. Judge the picture you described, not the words you described it in — a caption that never says a word for it can still be a picture of one. "none" where there is no picture.`
  ]
}

/** What every picture keeps to, whatever it shows. Both briefs close on it. */
function keeping(name: string, occasion: PhotoOccasion): string[] {
  return [
    // Not every picture is a selfie: somebody else may have taken it, or a timer, so the phone is
    // in it only where it would be.
    "Describe the picture itself: how {they} looks in it, not how it was taken or sent. A phone only appears in it when it's a mirror selfie.",
    // The renderer draws one girl and nobody else, and the gate refuses a caption that says otherwise.
    `${name} is the only person in the picture. Whoever took it stays behind the camera: nobody else is in it, touching {them}, or doing anything with {them}.`,
    'Name nobody and nowhere: not {themself}, not the reader, not a building or a place on the map. A picture cannot show a name. "{their} room", "a lecture hall", "the cafe" — what it looks like, never what it is called. {Their} own room is "{their} room" or "{their} bedroom", never a dorm.',
    '{Their} texts should read like somebody who just sent that picture. Do not describe it in them.',
    // The slot's opening sums her thread up rather than quoting it, so only a reply is told where
    // her pictures are written.
    occasion === 'reply'
      ? 'Any picture {they} has already sent is written into RECENT MESSAGES beside the text it came with. {They} knows what {they} sent the reader and would not send the same one twice, or the same kind of shot every time.'
      : '{They} knows what {they} has already sent the reader and would not send the same picture twice, or the same kind of shot every time.',
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
    'Each entry under STATUS UPDATES says whether its post carries a picture. Where it does, describe it in "image" — what the photograph shows, the way they would caption it to themself. One sentence, and a full one: where they are, what they are wearing, how they are standing or sitting, what their hands are doing, the light, and the shot. Where it says the post is just words, leave "image" empty.',
    'The shot is whichever suits the post, and not the one they posted last: their face up close, from the waist up, from the knees up, head to toe, or further back with more of the place; straight on, from above, from below, from the side, or from behind.',
    'What they own is listed under their name above.',
    'It can be a candid one where they are not posing. Either it is from now, where they are and at this time of day, or from earlier — today, a weekend, a trip, a night out. Either way, say its light: morning sun, the lamp in their room, a street at night. A selfie is for showing their year right now.',
    'A mirror selfie only where there would be a mirror: their room, a bathroom, a changing room. Write it as what the photo shows, them facing the mirror with their phone up, not the mirror or their reflection. A picture of them from behind has no mirror and no phone in it.',
    'A close-up of their face is for their look, not their outfit or the place: say "a close-up of their face".',
    'What is not written is not drawn: "a photo of me" gets a picture of nobody in particular.',
    'They hold one thing at most, and in a selfie the phone already takes one hand: a bubble tea, a book, a bouquet — not an umbrella and a crepe as well. Hands that hold nothing do whatever they would do with them in a photo: a peace sign, maybe, or a hand in their hair, or nothing in particular.',
    'Their whole year sees this, so it is an ordinary picture or a flirty one at most — what they are wearing, a day out, a swimsuit. Never anything undressed, whatever they might send one person in a message.',
    'Name nobody and nowhere: a picture cannot show a name. "their room", "the quad", "a cafe" — what it looks like, never what it is called.',
    'They are the only person in the picture, unless their entry says it is a picture with a friend.',
    'The post’s own "text" should read like somebody who just posted that picture, without describing it.'
  ]
}

/**
 * One poster's wardrobe, under her name in the slot's opening, so the picture on her post has her
 * in her own clothes rather than ones the model reaches for. Nothing where no picture is drawn.
 */
export function posterPhotoLines(character: Character, canRenderImages: boolean): string[] {
  return canRenderImages ? [`  ${wardrobeLine(character)}`] : []
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
    'They are strangers from the four thousand this campus holds, not the characters above: they do not know the author, they are not the reader, and none of them may be named. No handles and no @s — just what each one said.',
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
