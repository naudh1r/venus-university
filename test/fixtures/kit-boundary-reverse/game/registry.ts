// A registry loads mods' entries, found by a glob or named, and nothing else of theirs.
export const found = import.meta.glob('../modEntries/*.ts', { eager: true })
export { alpha } from '../modEntries/alpha'
export { state } from '../alpha/state'
