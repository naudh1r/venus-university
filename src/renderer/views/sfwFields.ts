import type { Settings } from '@shared/types'
import { NO_NSFW_IMAGES_NOTE } from './photoSettingsNotes'

/** Which `Settings` booleans the content toggles write. */
export type SfwKey = 'noNsfwImages' | 'lessNsfwText'

/** The first-run question's boxes: the two settings, and the sound box that sets the NSFW slider. */
export type SfwPromptKey = SfwKey | 'noNsfwSound'

/** What each content setting is called on screen, and what it is said to do. */
export interface SfwField<K extends string = SfwKey> {
  key: K
  id: string
  label: string
  /** The note under the checkbox — what turning it on actually costs the player. */
  note: string
}

/**
 * The content settings as the player meets them, in the order both screens show them: the
 * first-run question (the Boot screen) and the Settings Modal.
 */
export const SFW_FIELDS: readonly SfwField[] = [
  {
    key: 'noNsfwImages',
    id: 'settings-no-nsfw-images',
    label: 'No NSFW images',
    note: NO_NSFW_IMAGES_NOTE
  },
  {
    key: 'lessNsfwText',
    id: 'settings-less-nsfw-text',
    label: 'Less NSFW text',
    note: 'NSFW might still be generated based on your choices'
  }
]

/** The first-run question's last box, which puts the NSFW slider at 0 rather than storing a switch. */
export const NO_NSFW_SOUND_FIELD: SfwField<'noNsfwSound'> = {
  key: 'noNsfwSound',
  id: 'settings-no-nsfw-sound',
  label: 'No NSFW sound',
  note: ''
}

/** The two as a settings record holds them, for a screen staging its own copy. */
export function sfwValuesOf(settings: Pick<Settings, SfwKey>): Record<SfwKey, boolean> {
  return {
    noNsfwImages: settings.noNsfwImages,
    lessNsfwText: settings.lessNsfwText
  }
}
