import type { CgSfx, CgVoice, Character, CustomCg, CustomCgSlot, Position } from './types'
import type { PromptEdit } from './imagePrompt'
import { customOutfitInstructions, customOutfitName } from './outfits'
import { afterOf, CUSTOM_CG_SLOTS, customCgSlotOf, isAfterPosition, POSITIONS } from './positions'
import { withoutRegenEdits } from './regenTags'

/**
 * The player-authored CG pairs: their slots' labels, tags, voice and act loop, the writes that
 * change one, and the names the writer is offered them under. Names, instructions and their
 * limits are the custom wardrobes' (`outfits.ts`).
 */

/** The breaths a custom CG's main image can play, in the order the editor lists them. */
export const CG_VOICES: readonly CgVoice[] = ['fast', 'slow', 'none'] as const

/** The act loops a custom CG's main image can play, in the order the editor lists them. */
export const CG_SFXS: readonly CgSfx[] = ['sex', 'foreplay', 'oral', 'handjob', 'none'] as const

/** The breath a custom CG plays until its record names another. */
export const DEFAULT_CG_VOICE: CgVoice = 'fast'

/** The act loop a custom CG plays until its record names another. */
export const DEFAULT_CG_SFX: CgSfx = 'sex'

/** The tag that makes a custom CG's second image the aftermath of its first. */
export const AFTER_TAG = 'after_sex'

/** Type guard narrowing a value read off a hand-editable record to {@link CgVoice}. */
export function isCgVoice(value: unknown): value is CgVoice {
  return (CG_VOICES as readonly unknown[]).includes(value)
}

/** Type guard narrowing a value read off a hand-editable record to {@link CgSfx}. */
export function isCgSfx(value: unknown): value is CgSfx {
  return (CG_SFXS as readonly unknown[]).includes(value)
}

/** Which of the four slots this is, 1 to 4 — what an unnamed CG is called by. */
export function customCgSlotNumber(slot: CustomCgSlot): number {
  return CUSTOM_CG_SLOTS.indexOf(slot) + 1
}

/** What one custom slot's main CG is called on screen: her name for it, or its number. */
export function customCgLabelOf(character: Character, slot: CustomCgSlot): string {
  const name = customOutfitName(character.customCgs?.[slot]?.name)
  return name ? name : `Custom CG ${customCgSlotNumber(slot)}`
}

/** What one of her CGs is called on screen: a stock one by its words, a custom one by its name. */
export function cgLabelOf(character: Character, position: Position): string {
  const slot = customCgSlotOf(position)
  if (!slot) return position.replace(/_/g, ' ')
  if (!isAfterPosition(position)) return customCgLabelOf(character, slot)
  const name = customOutfitName(character.customCgs?.[slot]?.name)
  return name ? `${name}_after` : `Custom CG ${customCgSlotNumber(slot)} after`
}

/**
 * The position tags both images of one custom slot render from. Read defensively, since a
 * hand-edited record reaches the prompt builder unvalidated.
 */
export function customCgTagsFor(character: Character, slot: CustomCgSlot): readonly string[] {
  const tags = character.customCgs?.[slot]?.tags
  return Array.isArray(tags) ? tags.filter((tag) => typeof tag === 'string') : []
}

/** The breath a custom slot's main image plays: its record's where valid, else the default. */
export function customCgVoiceOf(
  character: Pick<Character, 'customCgs'>,
  slot: CustomCgSlot
): CgVoice {
  const voice = character.customCgs?.[slot]?.voice
  return isCgVoice(voice) ? voice : DEFAULT_CG_VOICE
}

/** The act loop a custom slot's main image plays: its record's where valid, else the default. */
export function customCgSfxOf(
  character: Pick<Character, 'customCgs'>,
  slot: CustomCgSlot
): CgSfx {
  const sfx = character.customCgs?.[slot]?.sfx
  return isCgSfx(sfx) ? sfx : DEFAULT_CG_SFX
}

/**
 * The record with a write merged into one player-authored CG pair: a field the patch leaves
 * `undefined` keeps what the slot holds, a name or instructions left blank are dropped, and a
 * voice or act loop outside the vocabulary is dropped, leaving what the slot held.
 */
export function withCustomCg(
  character: Character,
  slot: CustomCgSlot,
  patch: Partial<CustomCg>
): Character {
  const held = character.customCgs?.[slot]
  const tags = patch.tags ?? held?.tags ?? []
  const name = customOutfitName(patch.name !== undefined ? patch.name : held?.name)
  const instructions = customOutfitInstructions(
    patch.instructions !== undefined ? patch.instructions : held?.instructions
  )
  const voice = isCgVoice(patch.voice) ? patch.voice : isCgVoice(held?.voice) ? held.voice : null
  const sfx = isCgSfx(patch.sfx) ? patch.sfx : isCgSfx(held?.sfx) ? held.sfx : null
  return {
    ...character,
    customCgs: {
      ...character.customCgs,
      [slot]: {
        tags,
        ...(name ? { name } : {}),
        ...(instructions ? { instructions } : {}),
        ...(voice ? { voice } : {}),
        ...(sfx ? { sfx } : {})
      }
    }
  }
}

/**
 * The record with one player-authored CG pair gone, seed provenance included, and the tags the
 * buttons for the pair and for each of its images last sent: the next run in that slot is a
 * fresh pair, armed to follow her main seed.
 */
export function withoutCustomCg(character: Character, slot: CustomCgSlot): Character {
  const { [slot]: _gone, ...rest } = character.customCgs ?? {}
  const { [slot]: _seed, ...setSeeds } = character.setSeeds
  const { [slot]: _flag, ...seedFollowsMain } = character.seedFollowsMain
  const { customCgs: _all, ...without } = character
  return withoutRegenEdits(
    {
      ...without,
      setSeeds,
      seedFollowsMain,
      ...(Object.keys(rest).length > 0 ? { customCgs: rest } : {})
    },
    [slot, `cg:${slot}`, `cg:${afterOf(slot)}`]
  )
}

/** One custom CG pair the writer is offered, under the word it writes the main image with. */
export interface OfferedCg {
  slot: CustomCgSlot
  /**
   * Her name for it, or the slot id where that is blank or answers to a CG; its after is
   * `<name>_after`.
   */
  name: string
  tags: readonly string[]
  instructions: string
}

/**
 * The custom CG pairs the writer may show, in slot order: those whose two images are both on
 * disk and that are given instructions. Each name, and the `_after` after it, is unique to her
 * and never a CG id.
 */
export function offeredCustomCgs(
  character: Character,
  ready: readonly CustomCgSlot[] | undefined
): OfferedCg[] {
  const taken = new Set<string>(POSITIONS)
  const offered: OfferedCg[] = []
  for (const slot of CUSTOM_CG_SLOTS) {
    if (!ready?.includes(slot)) continue
    const entry = character.customCgs?.[slot]
    const instructions = customOutfitInstructions(entry?.instructions)
    if (!instructions) continue
    const name = customOutfitName(entry?.name)
    const written = name && !taken.has(name) && !taken.has(`${name}_after`) ? name : slot
    taken.add(written)
    taken.add(`${written}_after`)
    offered.push({ slot, name: written, tags: customCgTagsFor(character, slot), instructions })
  }
  return offered
}

/**
 * The custom CG a written id stands for — `bunny` -> `customcg1`, `bunny_after` ->
 * `customcg1_after` — or `null` where it names no offered pair.
 */
export function storedCgOf(written: string, offered: readonly OfferedCg[]): Position | null {
  for (const cg of offered) {
    if (written === cg.name) return cg.slot
    if (written === `${cg.name}_after`) return afterOf(cg.slot)
  }
  return null
}

/**
 * A stored CG as the writer reads it: a stock position as it is, an offered custom one under its
 * name, a custom one not offered under its slot id.
 */
export function writtenCgOf(position: Position, offered: readonly OfferedCg[]): string {
  const slot = customCgSlotOf(position)
  if (!slot) return position
  const hit = offered.find((cg) => cg.slot === slot)
  if (!hit) return position
  return isAfterPosition(position) ? `${hit.name}_after` : hit.name
}

/** A custom main's position tags as its aftermath image renders them: the after tag added once. */
export function withAfterTag(tags: readonly string[]): string[] {
  return tags.includes(AFTER_TAG) ? [...tags] : [...tags, AFTER_TAG]
}

/**
 * A CG edit rewritten for the slot's after image: the after tag added and her own `happy` face in
 * place of whatever the main's Expression group held. Any other kind of edit comes back as it is.
 */
export function customCgAfterEdit(edit: PromptEdit, character: Character): PromptEdit {
  if (edit.kind !== 'cg') return edit
  return {
    ...edit,
    position: withAfterTag(edit.position),
    expression: [...character.expressionTags.happy]
  }
}
