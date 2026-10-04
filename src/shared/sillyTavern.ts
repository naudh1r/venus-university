import type { LineupBox } from './lineup'
import { PROFILE_FACE_CENTRE, PROFILE_FRAME } from './profileCrop'
import type { Character, Emotion, ProfileCrop } from './types'

/** What one export button hands the save dialog: her card, or her sprite pack. */
export type ExportKind = 'card' | 'sprites'

/**
 * The names each emotion's sprite is written under for SillyTavern's Character Expressions
 * extension: its own label first, then the extension's default labels we render no face for
 * that read closest to it, so every one of its 28 defaults finds a sprite.
 */
export const SILLYTAVERN_EMOTIONS: Readonly<Record<Emotion, readonly string[]>> = {
  neutral: ['neutral', 'curiosity'],
  happy: [
    'joy',
    'admiration',
    'amusement',
    'approval',
    'caring',
    'excitement',
    'gratitude',
    'love',
    'optimism',
    'pride',
    'relief'
  ],
  sad: ['sadness', 'disappointment', 'grief', 'remorse'],
  angry: ['anger', 'annoyance', 'disapproval', 'disgust'],
  surprised: ['surprise', 'confusion', 'fear', 'realization'],
  embarrassed: ['embarrassment', 'nervousness'],
  aroused: ['desire']
}

/** The card image's pixel size — SillyTavern's own upload crop, 2:3. */
export const CARD_SIZE = { width: 512, height: 768 } as const

/** How tall the card's frame is, in face heights. */
export const CARD_FRAME = 3.0

/** How far down the card's frame the face's centre sits, as a share of its height. */
export const CARD_FACE_CENTRE = 0.4

/** The background the card is composed on: the Venus Quad by day. */
export const CARD_BG = 'quad'

/**
 * The chest-up frame a card is cut from, derived from the portrait frame's own face geometry
 * rather than clamped to it: the frame may overhang the sprite, and the background shows there.
 */
export function cardFrame(suggested: ProfileCrop): LineupBox {
  const faceHeight = suggested.height / PROFILE_FRAME
  const faceCentreX = suggested.x + suggested.width / 2
  const faceCentreY = suggested.y + suggested.height * PROFILE_FACE_CENTRE

  const height = faceHeight * CARD_FRAME
  const width = (height * CARD_SIZE.width) / CARD_SIZE.height
  return {
    x: faceCentreX - width / 2,
    y: faceCentreY - height * CARD_FACE_CENTRE,
    width,
    height
  }
}

/** Her name, made safe for a filesystem — the stem `exportFileName` builds a zip name from. */
function fileStem(character: Pick<Character, 'firstName' | 'lastName'>): string {
  const stem = `${character.firstName}_${character.lastName}`
    .trim()
    .replace(/[^A-Za-z0-9._ -]+/g, '_')
  return stem === '' || stem === '_' ? 'character' : stem
}

/** The name a SillyTavern card is offered under. */
export function cardFileName(character: Pick<Character, 'firstName' | 'lastName'>): string {
  return `${fileStem(character)}.png`
}

/** The name a SillyTavern sprite pack is offered under. */
export function spritePackFileName(character: Pick<Character, 'firstName' | 'lastName'>): string {
  return `${fileStem(character)}_sprites.zip`
}
