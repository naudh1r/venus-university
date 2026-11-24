type SceneView = typeof import('../../src/renderer/mods/sceneView')

/**
 * The kit's scene view, for a mock of the kit's renderer entry. Its own imports reach the kit's
 * entry, so a mock cannot wait for it: {@link loadSceneView} loads it beside the mock, and its
 * names call through once it has. A test file that calls one awaits the load first.
 */
let view: SceneView | undefined
let loading: Promise<unknown> | undefined

/** Loads the scene view, once. */
export function loadSceneView(): Promise<unknown> {
  loading ??= import('../../src/renderer/mods/sceneView').then((module) => { view = module })
  return loading
}

function loaded(): SceneView {
  if (!view) throw new Error("The kit's scene view is not loaded: await loadSceneView first.")
  return view
}

/**
 * The scene view's names, and the game readers Mini-games uses. The kit's game readers load the
 * character store, which needs the window's bridge, so these read the game store by the same
 * rules: nothing without a playthrough.
 */
export async function kitScene(): Promise<Record<string, unknown>> {
  const { useGameStore } = await import('../../src/renderer/stores/gameStore')
  const own = <T,>(records: Readonly<Record<string, T>>, id: string): T | undefined =>
    Object.hasOwn(records, id) ? records[id] : undefined
  return {
    scene: () => loaded().scene(),
    useScene: (...args: Parameters<SceneView['useScene']>) => loaded().useScene(...args),
    subscribeScene: (...args: Parameters<SceneView['subscribeScene']>) => loaded().subscribeScene(...args),
    holdTurn: (...args: Parameters<SceneView['holdTurn']>) => loaded().holdTurn(...args),
    character: (id: string) => {
      const game = useGameStore.getState()
      return game.playthroughId ? own(game.characters, id) : undefined
    },
    characterInfo: (id: string) => {
      const game = useGameStore.getState()
      return game.playthroughId ? own(game.charInfo, id) : undefined
    },
    clock: () => {
      const game = useGameStore.getState()
      return game.playthroughId ? { date: game.date, time: game.time, season: game.calendar.season } : undefined
    }
  }
}
