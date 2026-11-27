/**
 * Every mod that plugs into the game's hooks, registered once at boot. The in-repo mods: each
 * file in `src/renderer/modEntries/`, named for the mod's id, is loaded here and calls
 * `registerHooks`. The installed mods: each one's `renderer.js`, imported from `vxmod://` by
 * {@link loadInstalledMods} before the first screen. Nothing here names a mod. The order they
 * load in does not matter for the hooks, which are asked in the order `MODS` lists the mods.
 */

import { hookNameKind } from '@vx/modkit/host/shared'
import { setDeclaredHooks, setLoadingMod, subscribeHookRules } from '@vx/modkit/host/renderer'
import { shiftIsHeld } from '../installedMods'
import { useModSessionStore } from '../stores/modSessionStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useUiStore } from '../stores/uiStore'
import { exposeHost } from './host'

// Held in a binding of its own, not read inline: Vite turns `Object.keys(import.meta.glob(…))`
// into the file names alone and never loads the files, and loading them is the point.
const loaded = import.meta.glob('../modEntries/*.ts', { eager: true })

/** The hook files loaded, for the log and the tests. */
export const REGISTERED = Object.keys(loaded)

/** The stylesheets added for the installed mods, by id, kept only while each mod is on. */
const styles = new Map<string, HTMLLinkElement>()

/** Enables each mod's stylesheet while its mod is on: a stylesheet cannot ask whether its mod is. */
function followSwitches(isOn: (id: string) => boolean): void {
  // `media`, not `disabled`: Chromium never fetches a sheet disabled before it loads, so a mod off
  // at start would come on later unstyled. A sheet on `not all` still loads, and applies nowhere.
  const apply = (): void => {
    for (const [id, link] of styles) link.media = isOn(id) ? 'all' : 'not all'
  }
  apply()
  subscribeHookRules(apply)
  useModSessionStore.subscribe(apply)
}

/** Adds a mod's `style.css`; a sheet that will not load is a warning on the row, and the mod still runs. */
function addStyle(id: string, url: string): void {
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = url
  link.dataset.mod = id
  link.onerror = () => console.warn(`[mods] ${id}: style.css did not load`)
  document.head.appendChild(link)
  styles.set(id, link)
}

/** What a developer folder's change asks of the window: a reload at once off a game, an offer in one. */
function onDevChanged(change: { id: string; kind: 'renderer' | 'main' }): void {
  if (change.kind === 'renderer' && useUiStore.getState().view !== 'game') {
    console.log(`[mods] ${change.id} changed; reloading`)
    window.location.reload()
    return
  }
  useModSessionStore.getState().setDevChange(change)
}

/**
 * Imports every loaded installed mod's `renderer.js`, in load order and one at a time, so a
 * registration is always attributed to the mod being imported, then adds each one's stylesheet.
 * A throw, or a refusal from `registerHooks`, turns the mod off for the session. Called from
 * `boot()` once the switches are read, and finished before the first real view is set.
 */
export async function loadInstalledMods(isOn: (id: string) => boolean): Promise<void> {
  const store = useModSessionStore.getState()
  const { table } = store
  if (table.mods.length === 0) return
  window.api.mods.onDevChanged(onDevChanged)

  if (shiftIsHeld()) {
    store.setShiftStart()
    console.warn('[mods] Shift held at start: no installed mod is imported this session')
  } else if (table.safeStart === null && table.loaderError === null) {
    await exposeHost()
    setDeclaredHooks({
      declared: (id) => table.mods.find((mod) => mod.id === id)?.manifest?.hooks.filter((hook) => hookNameKind(hook).kind !== 'export'),
      onRefused: (id, message) => useModSessionStore.getState().markFailed(id, 'refused', message)
    })
    for (const id of table.order) {
      const mod = table.mods.find((one) => one.id === id)
      if (!mod?.manifest || !useModSessionStore.getState().running(id)) continue
      const gone = Object.keys(mod.manifest.requires ?? {}).find((dep) => !useModSessionStore.getState().running(dep))
      if (gone) {
        const name = table.mods.find((one) => one.id === gone)?.manifest?.name ?? gone
        useModSessionStore.getState().markFailed(id, 'blocked', `needs ${name}, which did not load`)
        continue
      }
      if (mod.renderer) {
        setLoadingMod(id)
        try {
          await import(/* @vite-ignore */ mod.renderer)
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          useModSessionStore.getState().markFailed(id, 'failed', `renderer.js failed to load: ${message}`)
          console.error(err)
        } finally {
          setLoadingMod(null)
        }
      }
      if (mod.style && useModSessionStore.getState().running(id)) addStyle(id, mod.style)
    }
    followSwitches(isOn)
  }

  useModSessionStore.getState().noticeAtStart(useSettingsStore.getState().settings?.modNoticesSeen ?? {})
}
