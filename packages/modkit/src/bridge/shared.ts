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

export { SAFE_CHAR_ID, assertSafeCharId } from '@shared/characterRules'
export { SAFE_NUMERIC_ID, assertSafePlaythroughId } from '@shared/saveRules'
export { appError } from '@shared/errors'
export { imageTypeOf } from '@shared/imageBytes'
export { characterLoraOf } from '@shared/comfyModels'
export { DORM_IDS, dormLabel } from '@shared/dorms'
export { LOCATIONS, NARRATIVE_LOCATIONS } from '@shared/locations'
export { customOutfitSlotsIn, outfitTagsFor } from '@shared/outfits'
export { affectionFor, dispositionOf, dedupedMemoriesFor, emptyFlags, relationshipTagOf } from '@shared/relationship'
export { areNpcFriends, npcFriendsOf, npcPairOf, zoneOf } from '@shared/npcRelationships'
export { hashString, seededRand } from '@shared/hash'
export { fullNameOf } from '@shared/types'
export { slotFromId } from '@shared/jobs'
export { shownComments } from '@shared/postComments'
export { fallbackHandleOf, rollPostLikes } from '@shared/feed'
export { BACKUP_ZIP_LIMITS } from '@shared/backup'
export { readerize } from '@shared/readerVoice'
export { DEFAULT_PLAYER_STATS } from '@shared/playerStats'
export type { CharFlags, CustomOutfitSlot, Season } from '@shared/types'
export type { NpcRelationshipMap } from '@shared/npcRelationships'
