/** `@vx/modkit/shared`: what a mod may import on either side of the process boundary. */
export type {
  AppError,
  BunnyboardState,
  Character,
  CharacterTrait,
  CharacterTraitDefinition,
  CharInfo,
  CharMemory,
  ChatMessage,
  GameOverReason,
  GameSave,
  NativeGameSave,
  ImagePromptDraft,
  ImagePromptKind,
  ImagePromptParts,
  LedgerResponse,
  LedgerStats,
  ModDef,
  ModEnrollmentFields,
  ModOption,
  ModOptionGroup,
  ModSceneFields,
  ModSlice,
  ModScope,
  ModSwitches,
  PlayerStats,
  PlaythroughRecord,
  PostComment,
  ProjectSession,
  PromptEdit,
  Result,
  SceneLine,
  SlotActivity,
  SlotActivityOffer,
  SocialPost,
  StatContext,
  StatKey,
  StatTier,
  StatusText,
  StructuredRequest,
  TextingResponse,
  TimeSlot
} from '../bridge/shared'
export {
  hasTrait,
  MAX_TIER,
  memoryStatusLine,
  modById,
  modOn,
  optionKey,
  optionOn,
  pointsForTier,
  registerCharacterTrait,
  registerImagePromptDraft,
  registerRomanceRequirement
} from '../bridge/shared'
export { sharedModOn } from './modRules'
export { carryModFiles, registerPostCarry, registerTermCarry, registerTermFiles } from './modCarry'
export type { ModCarryFields, TermCarryContext, TermFilesContext } from './modCarry'
export { DEPRECATED_HOOKS, HOOKS, KIT_APIS, REMOVED_HOOKS } from './hookTable'
export type { DeprecatedHook, HookKind, HookName, HookRow, HookSide, KitApiName, RemovedHook } from './hookTable'
export { KIT_VERSION } from './version'
