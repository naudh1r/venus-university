import { useMemo, useSyncExternalStore } from 'react'
import type { AppError } from '@shared/types'
import { busGain, volumesOf } from '@shared/audio'
import { BUILD, modNames, modsOn } from '@shared/mods'
import { useModsStore } from '../stores/modsStore'
import { useGameStore } from '../stores/gameStore'
import { noNsfwImagesOf, useSettingsStore } from '../stores/settingsStore'
import { useUiStore } from '../stores/uiStore'
import { comfyAvailable, useSetupStore } from '../stores/setupStore'
import { useBunnyboardStore } from '../stores/bunnyboardStore'
import { useGrabBagStore } from '../stores/grabBagStore'
import { FEED_HANDLE_BAG, FEED_HANDLE_POOL, FEED_EMOJI_BAG, FEED_EMOJI } from '../prompts/feedRandoms'
import { pictureKeySet } from '@shared/settingsRules'
import { comfySourceOf } from '@shared/comfyModels'

/**
 * The player has Less NSFW text on: the game's own writing is toned down, and a mod's should be.
 * True until the settings have been read, so nothing explicit is written before they are known.
 */
export function lessNsfwText(): boolean {
  return useSettingsStore.getState().settings?.lessNsfwText !== false
}

/** {@link lessNsfwText} for a component, which renders again when the player changes it. */
export function useLessNsfwText(): boolean {
  return useSettingsStore((state) => state.settings?.lessNsfwText !== false)
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

/** Raises the game's error modal over whatever is showing, as the game does for its own failures. */
export function showError(error: AppError): void {
  useUiStore.getState().showError(error)
}

/** The playthrough being played, if any, and the reader's first name. */
export function gameFacts(): { playthroughId: string | null; readerName: string } {
  const game = useGameStore.getState()
  return { playthroughId: game.playthroughId, readerName: game.playerFirstName }
}

/** {@link gameFacts} for a component: it renders again when either changes. */
export function useGameFacts(): { playthroughId: string | null; readerName: string } {
  const playthroughId = useGameStore((state) => state.playthroughId)
  const readerName = useGameStore((state) => state.playerFirstName)
  return useMemo(() => ({ playthroughId, readerName }), [playthroughId, readerName])
}

/** The cast-scene persona the player has stored, or undefined until settings are read or when none is stored. */
export function useScenePersona(): string | undefined {
  return useSettingsStore((state) => state.settings?.scenePersona)
}

/** The game's No NSFW images rule, false until settings have been read. */
export function noNsfwImages(): boolean {
  return noNsfwImagesOf(useSettingsStore.getState())
}

/** Calls back only when the image rule changes; the returned function stops listening. */
export function subscribeNoNsfwImages(onChange: () => void): () => void {
  return useSettingsStore.subscribe((state, before) => {
    if (noNsfwImagesOf(state) !== noNsfwImagesOf(before)) onChange()
  })
}

/** The image rule for a component, following changes to the player's settings. */
export function useNoNsfwImages(): boolean {
  return useSyncExternalStore(subscribeNoNsfwImages, noNsfwImages, noNsfwImages)
}

/** Whether the selected image API has credentials configured, not a connectivity check. */
export function imageApiConfigured(): boolean {
  const settings = useSettingsStore.getState().settings
  return !!settings && !!pictureKeySet(settings)
}

/** Fires only when the image API's configured/not-configured answer changes. */
export function subscribeImageApiConfigured(onChange: () => void): () => void {
  let before = imageApiConfigured()
  return useSettingsStore.subscribe(() => {
    const next = imageApiConfigured()
    if (next !== before) { before = next; onChange() }
  })
}

export function useImageApiConfigured(): boolean {
  return useSyncExternalStore(subscribeImageApiConfigured, imageApiConfigured, imageApiConfigured)
}

/** Selected local rendering source, or null until settings load; no address or secrets. */
export function localImageSource(): 'managed' | 'external' | null {
  const settings = useSettingsStore.getState().settings
  return settings ? comfySourceOf(settings) : null
}

/** Fires only when the selected source changes, independently of setup readiness. */
export function subscribeLocalImageSource(onChange: () => void): () => void {
  let before = localImageSource()
  return useSettingsStore.subscribe(() => {
    const next = localImageSource()
    if (next !== before) { before = next; onChange() }
  })
}

export function useLocalImageSource(): 'managed' | 'external' | null {
  return useSyncExternalStore(subscribeLocalImageSource, localImageSource, localImageSource)
}

/** Local image generation as core gates it, including external ComfyUI and the browser build. */
export function canRenderLocalImages(): boolean {
  return comfyAvailable(useSettingsStore.getState().settings, useSetupStore.getState().status)
}

/** Watches settings and setup, notifying only when local rendering availability changes. */
export function subscribeCanRenderLocalImages(onChange: () => void): () => void {
  let before = canRenderLocalImages()
  const changed = (): void => {
    const next = canRenderLocalImages()
    if (next === before) return
    before = next
    onChange()
  }
  const stopSettings = useSettingsStore.subscribe(changed)
  const stopSetup = useSetupStore.subscribe(changed)
  return () => { stopSettings(); stopSetup() }
}

/** Whether the phone is open, independently of its selected tab or page. */
export function phoneOpen(): boolean {
  return useBunnyboardStore.getState().open
}

/** The charId of the phone's selected DM thread, or null on its list. */
export function viewingThread(): string | null {
  return useBunnyboardStore.getState().viewingCharId
}

/** Watches only phone-open and selected-thread changes, without exposing its actions or store. */
export function subscribePhoneView(onChange: () => void): () => void {
  return useBunnyboardStore.subscribe((state, before) => {
    if (state.open !== before.open || state.viewingCharId !== before.viewingCharId) onChange()
  })
}

/** The selected DM thread for a component, following the phone's navigation. */
export function useViewingThread(): string | null {
  return useSyncExternalStore(subscribePhoneView, viewingThread, viewingThread)
}

/** Spends feed handles from the game's persistent bag, using each entry's native key. */
export function drawFeedHandles(count: number): string[] {
  return useGrabBagStore.getState()
    .drawMany(FEED_HANDLE_BAG, FEED_HANDLE_POOL, count, entry => entry.key)
    .map(entry => entry.handle)
}

/** Spends feed faces independently, so keeping an old handle does not spend a new one. */
export function drawFeedEmoji(count: number): string[] {
  return useGrabBagStore.getState().drawMany(FEED_EMOJI_BAG, FEED_EMOJI, count)
}
