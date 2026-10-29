import { busGain, volumesOf } from '@shared/audio'
import { BUILD, modNames, modsOn } from '@shared/mods'
import { useModsStore } from '../stores/modsStore'
import { useSettingsStore } from '../stores/settingsStore'

/** The player has Less NSFW text on: the game's own writing is toned down, and a mod's should be. */
export function lessNsfwText(): boolean {
  return useSettingsStore.getState().settings?.lessNsfwText === true
}

/** {@link lessNsfwText} for a component, which renders again when the player changes it. */
export function useLessNsfwText(): boolean {
  return useSettingsStore((state) => state.settings?.lessNsfwText === true)
}

/** The gain a mod's own sound effects play at: the player's effects volume, as the game's mix applies it. */
export function useSfxGain(): number {
  return useSettingsStore((state) => busGain(volumesOf(state.settings?.volumes).sfx))
}

/** The build being played, its name and version, as the main menu and the log name it. */
export function buildLabel(): string {
  return `${BUILD.name} ${BUILD.version}`
}

/** The mods that are on, each with its version, as the game's log lists them: for a bug report. */
export function modsOnLine(): string {
  return modNames(modsOn(useModsStore.getState().switches))
}
