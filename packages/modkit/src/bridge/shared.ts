/**
 * The bridge: the one place the kit names core. Every type and function of core's `src/shared`
 * that the kit hands a mod is re-exported here, so a change to any of them shows in the kit's
 * API report, and nothing else in the kit reaches core (the boundary test checks).
 */
export type {
  AppError,
  BunnyboardState,
  Character,
  CharInfo,
  CharMemory,
  ChatMessage,
  GameSave,
  NativeGameSave,
  ModSlice,
  LedgerResponse,
  MemoryType,
  ModEnrollmentFields,
  ModSceneFields,
  PlaythroughRecord,
  ProjectSession,
  Result,
  SceneLine,
  SocialPost,
  StructuredRequest,
  TextingResponse,
  TimeSlot
} from '@shared/types'
export { charKeyOf, READER_SPEAKER } from '@shared/types'
export type { GameOverReason } from '@shared/gameOver'
export type { LedgerStats, PlayerStats, StatContext, StatKey, StatTier, StatusText } from '@shared/playerStats'
export { MAX_TIER, pointsForTier } from '@shared/playerStats'
export type { PostComment } from '@shared/postComments'
export type { SlotActivity, SlotActivityOffer } from '@shared/slotActivity'
export type { ModDef, ModOption, ModOptionGroup, ModPlaythroughFields, ModScope, ModSwitches } from '@shared/mods'
export { modById, modOn, optionKey, optionOn } from '@shared/mods'
export { registerRomanceRequirement } from '@shared/romanceRequirements'
export { hasTrait, registerCharacterTrait } from '@shared/traits'
export type { CharacterTrait, CharacterTraitDefinition } from '@shared/traits'
export { memoryStatusLine } from '@shared/relationship'
export { registerImagePromptDraft } from '@shared/imagePromptDrafts'
export type { ImagePromptDraft, ImagePromptKind, ImagePromptParts } from '@shared/imagePromptDrafts'
export type { PromptEdit } from '@shared/imagePrompt'
export { globalSlotOf } from '@shared/jobs'
export { messageOf } from '@shared/errors'
