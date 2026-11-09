type SceneLines = typeof import('../../src/renderer/stores/sceneLines')
type GameLoop = typeof import('../../src/renderer/stores/gameLoop')

/**
 * Core's scene lines and game loop, once loaded. They reach the kit's entry themselves, through
 * the stores they import, so the mock below cannot wait for them: it hands out functions that call
 * through to them, and {@link miniGamesReady} waits for them before a test calls one.
 */
let lines: SceneLines | undefined
let loop: GameLoop | undefined
let loading: Promise<unknown> = Promise.resolve()

function loaded<T>(module: T | undefined): T {
  if (!module) throw new Error('The scene lines and game loop are still loading: await miniGamesReady first.')
  return module
}

/** Mini-games switched on, and the kit's late-loaded parts in place: a test file's `beforeAll`. */
export async function miniGamesReady(): Promise<void> {
  const { useModsStore } = await import('../../src/renderer/stores/modsStore')
  const { MINI_GAMES } = await import('../../src/shared/minigames')
  const { switches } = useModsStore.getState()
  useModsStore.setState({ switches: { ...switches, on: { ...switches.on, [MINI_GAMES]: true } } })
  await loading
}

/**
 * The kit's renderer entry as Mini-games' tests need it. The real entry loads the game's stores,
 * which subscribe to the window's bridge as they load, and these tests run without one; so each
 * name Mini-games imports is taken from the game's own module that the kit re-exports.
 */
export async function miniGamesKit(): Promise<Record<string, unknown>> {
  loading = Promise.all([
    import('../../src/renderer/stores/sceneLines').then((module) => { lines = module }),
    import('../../src/renderer/stores/gameLoop').then((module) => { loop = module })
  ])
  const readers = await import('../../src/renderer/mods/readers')
  const llm = await import('../../src/renderer/mods/llm')
  const schema = await import('../../src/renderer/prompts/schema')
  const state = await import('../../src/renderer/stores/loop/state')
  const intro = await import('../../src/renderer/prompts/introScript')
  const graduation = await import('../../src/renderer/prompts/graduation')
  const mods = await import('../../src/renderer/stores/modsStore')
  const field = await import('../../packages/modkit/src/renderer/sceneField')
  return {
    ...readers,
    boxParts: (...args: Parameters<SceneLines['boxParts']>) => loaded(lines).boxParts(...args),
    dropTransientLines: (...args: Parameters<SceneLines['dropTransientLines']>) => loaded(lines).dropTransientLines(...args),
    reachTurn: () => loaded(lines).reachTurn(),
    readerSaysInScene: (...args: Parameters<SceneLines['readerSaysInScene']>) => loaded(lines).readerSaysInScene(...args),
    sayInScene: (...args: Parameters<SceneLines['sayInScene']>) => loaded(lines).sayInScene(...args),
    sceneField: field.sceneField,
    submitAction: (...args: Parameters<GameLoop['submitAction']>) => loaded(loop).submitAction(...args),
    takeTurnFromReply: () => loaded(loop).takeTurnFromReply(),
    completeStructured: llm.completeStructured,
    currentRun: state.currentRun,
    runStale: state.runStale,
    isOrientationSlot: intro.isOrientationSlot,
    isGraduationSlot: graduation.isGraduationSlot,
    objectSchema: schema.objectSchema,
    useModOption: mods.useModOption
  }
}
