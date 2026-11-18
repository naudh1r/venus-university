/**
 * `@vx/modkit/host/shared`: core's side of the shared kit. The binder the mods store sets at boot,
 * and the runners New Game+ calls. Not for mods; the boundary test refuses it in a mod file.
 */
export { setSharedModRules } from '../shared/modRules'
export { carriedModFields, carryModFields, carryPostFields } from '../shared/modCarry'
export { checkCompat, CORE_SURFACE, hookNamesOf, manifestHooks } from '../shared/compat'
export type { Compat, CoreSurface, MissingHook } from '../shared/compat'
export { CORE_DATA_NAMES, CORE_PLAYTHROUGH_NAMES, MANIFEST_SCHEMA, MOD_ID_RULE, RESERVED_MOD_IDS, parseManifest, modDefOf, hookNameKind } from '../shared/manifest'
export type { Manifest, ParsedManifest, HookNameKind } from '../shared/manifest'
export { SOURCE_SCHEMA, MAX_SOURCE_SCREENSHOTS, parseSource } from '../shared/source'
export type { SourceApproval, SourceRelease, ListedRelease, SourceScreenshot, SourceMod, ModSource, ParsedSource } from '../shared/source'
export { resolveInstall, resolveRemoval } from '../shared/install'
export type { InstalledMod, InstallSource, InstallRequest, InstallInput, InstallChange, InstallResolution, RemovalResolution } from '../shared/install'
export { orderMods } from '../shared/order'
export type { OrderInput, Ordered } from '../shared/order'
