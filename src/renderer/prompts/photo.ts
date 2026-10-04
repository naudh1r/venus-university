import { andList } from '@shared/sentences'

/**
 * A Bunnyboard photo's prompt: the player's own words, then the app's lines saying which
 * reference picture is which girl and which is the background.
 */

/** What the Create Photo modal's prompt opens on, before the player has written a word. */
export const PHOTO_PROMPT_BRIEF = [
  'Create a candid photo of these characters [your prompt here]',
  '',
  'Before you finalize your composition, check these things:',
  '- All characters in the provided reference images are present.',
  '- All characters appear once; none are duplicated.',
  '- The illustration style of the original art has been preserved.'
].join('\n')

/** How the girls reach the model: one picture each, or one lineup sheet of them all. */
export type PhotoCastLayout = 'each' | 'sheet'

/**
 * The exact prompt a photo is sent with: `words` as the player left them, then who is in which
 * reference picture — in the rows' order, the sheet's left to right — so words that name a girl
 * can be followed, and, where a background picture follows them, a line saying it is the place.
 */
export function photoPrompt(
  words: string,
  names: readonly string[],
  layout: PhotoCastLayout,
  background: boolean
): string {
  const first = background ? 'The first reference image' : 'The reference image'
  const cast =
    names.length === 1
      ? `${first} shows this character on a black background: ${names[0]}.`
      : layout === 'sheet'
        ? `${first} shows these ${names.length} characters on a black background, from left to right: ${andList(names)}.`
        : `${background ? `The first ${names.length} reference images` : 'The reference images'} show one character each on a black background, in this order: ${andList(names)}.`
  const lines = [words.trim(), '', cast]
  if (background) {
    lines.push(
      'The last reference image is a background. Use it as reference only, do not copy the camera angle, lighting, or composition.'
    )
  }
  return lines.join('\n')
}
