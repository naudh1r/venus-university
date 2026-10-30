/**
 * The kit's renderer entry as Mini-games' tests need it. The real entry loads the game's stores,
 * which subscribe to the window's bridge as they load, and these tests run without one; so each
 * name Mini-games imports is taken from the game's own module that the kit re-exports.
 */
export async function miniGamesKit(): Promise<Record<string, unknown>> {
  const readers = await import('../../src/renderer/mods/readers')
  const state = await import('../../src/renderer/stores/loop/state')
  const intro = await import('../../src/renderer/prompts/introScript')
  const graduation = await import('../../src/renderer/prompts/graduation')
  const mods = await import('../../src/renderer/stores/modsStore')
  return {
    ...readers,
    currentRun: state.currentRun,
    runStale: state.runStale,
    isOrientationSlot: intro.isOrientationSlot,
    isGraduationSlot: graduation.isGraduationSlot,
    useModOption: mods.useModOption
  }
}
