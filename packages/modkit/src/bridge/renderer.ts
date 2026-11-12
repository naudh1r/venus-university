/**
 * The bridge for the window: every type and function of core's `src/renderer` that the kit hands
 * a mod, re-exported here and nowhere else in the kit (see `shared.ts`).
 */
export { interludeNow, useInterludeNow } from '../../../../src/renderer/mods/interlude'
export { profileUrl, spriteUrl, useSpriteVersion } from '../../../../src/renderer/stores/characterStore'
export type { PromptState } from '../../../../src/renderer/prompts/scenePrompt'
export type { SlotIntroInput } from '../../../../src/renderer/prompts/slotIntroPrompt'
export type { HangoutVerdict } from '../../../../src/renderer/prompts/hangoutClassifierPrompt'
export type { TextingPromptState } from '../../../../src/renderer/prompts/textingPrompt'
export type { useGameStore } from '../../../../src/renderer/stores/gameStore'
export type { ManualSaveOffer } from '../../../../src/renderer/stores/gameLoop'
export type { ResolvedSave } from '../../../../src/renderer/stores/saveStore'
export type { ViewName } from '../../../../src/renderer/stores/uiStore'
export type { ScreenTheme } from '../../../../src/renderer/views/clockTheme'
export type { ModalShell } from '../../../../src/renderer/components/useModalShell'
export { useModalShell, useDismissLayer } from '../../../../src/renderer/components/useModalShell'
export type { SceneInputLayout } from '../../../../src/renderer/components/useSceneInput'
export { useSceneInput } from '../../../../src/renderer/components/useSceneInput'
export { modIsOn, modOptionOn, useModOn, useModOption } from '../../../../src/renderer/stores/modsStore'
export { PostCommentAction, PostCommentsView, PostPicture } from '../../../../src/renderer/components/PostSpots'
export { EmojiTool, SentText, useBareMessage, useEmojiTool } from '../../../../src/renderer/components/TextSpots'
export { submitAction, takeTurnFromReply } from '../../../../src/renderer/stores/gameLoop'
export type { SceneLineOptions } from '../../../../src/renderer/stores/sceneLines'
export {
  boxParts,
  dropTransientLines,
  reachTurn,
  readerSaysInScene,
  sayInScene
} from '../../../../src/renderer/stores/sceneLines'
export { finishSlotActivity } from '../../../../src/renderer/stores/slotActivity'
export { fileLatePost } from '../../../../src/renderer/stores/loop/feed'
export { Card, Locked } from '../../../../src/renderer/views/ContactPage'
export type { TurnFieldProps } from '../../../../src/renderer/views/Dialogue'
export { TurnField } from '../../../../src/renderer/views/Dialogue'
export type { DividerWord, SceneDividerProps } from '../../../../src/renderer/views/SceneChrome'
export { SceneDivider } from '../../../../src/renderer/views/SceneChrome'
export type { TitleTabProps } from '../../../../src/renderer/components/TitleTab'
export { TitleTab } from '../../../../src/renderer/components/TitleTab'
export type { TextFieldProps } from '../../../../src/renderer/components/TextField'
export { TextField } from '../../../../src/renderer/components/TextField'
export type { SelectFieldOption, SelectFieldProps } from '../../../../src/renderer/components/SelectField'
export { SelectField } from '../../../../src/renderer/components/SelectField'
export type { CheckFieldProps } from '../../../../src/renderer/components/CheckField'
export { CheckField } from '../../../../src/renderer/components/CheckField'
export type { ConfirmModalProps } from '../../../../src/renderer/components/ConfirmModal'
export { ConfirmModal } from '../../../../src/renderer/components/ConfirmModal'
export type { TextEditModalProps } from '../../../../src/renderer/views/TextEditModal'
export { TextEditModal } from '../../../../src/renderer/views/TextEditModal'
export type { PromptBlock } from '../../../../src/renderer/prompts/promptBlocks'
export { defaultBlockText, isNewGameBlock, PROMPT_BLOCKS } from '../../../../src/renderer/prompts/promptBlocks'
export { currentRun, runStale } from '../../../../src/renderer/stores/loop/state'
export { isOrientationSlot } from '../../../../src/renderer/prompts/introScript'
export { isGraduationSlot } from '../../../../src/renderer/prompts/graduation'
export {
  buildLabel,
  gameFacts,
  lessNsfwText,
  modsOnLine,
  showError,
  useGameFacts,
  useLessNsfwText,
  useScenePersona,
  useSfxGain
} from '../../../../src/renderer/mods/readers'
export { cancelCalls, completeStructured } from '../../../../src/renderer/mods/llm'
export type { SilentRetryOptions } from '../../../../src/renderer/stores/silentRetry'
export { retrySilently } from '../../../../src/renderer/stores/silentRetry'
export { objectSchema } from '../../../../src/renderer/prompts/schema'
export {
  bunnyHop,
  dealt,
  fadeIn,
  gestures,
  lift,
  noteIn,
  panelUnderTab,
  press,
  quietLift,
  quietPress,
  rowLift,
  rowPress,
  slideInQuick,
  toggleLift,
  typingDot,
  veilIn
} from '../../../../src/renderer/views/motion'

export { ChevronIcon, CloseIcon, HeartIcon, BunnyMark, EyeIcon, EyeOffIcon, PlusIcon } from '../../../../src/renderer/views/screenIcons'
export { formatNumericGameDate, formatShortGameDate, slotHalf } from '../../../../src/renderer/prompts/gameDate'
export { SETTING } from '../../../../src/renderer/prompts/setting'
export { hasTexted } from '../../../../src/renderer/prompts/textingPrompt'
export { isFeedContact, FEED_PAGE } from '../../../../src/renderer/stores/feedView'
export { newestFirst } from '../../../../src/renderer/stores/feedRolls'
export { FEED_EMOJI, FEED_EMOJI_BAG, FEED_HANDLE_BAG, FEED_HANDLE_POOL } from '../../../../src/renderer/prompts/feedRandoms'

export { bunnybotSays } from '../../../../src/renderer/mods/bunnybot'
export { invoke } from '../../../../src/renderer/mods/invoke'
export { addMemory, addPostComments, toggleFeedLike } from '../../../../src/renderer/mods/records'
export { saveChanges } from '../../../../src/renderer/stores/loop/saves'

export { Lightbox } from '../../../../src/renderer/components/Lightbox'
export { relationshipLines } from '../../../../src/renderer/prompts/relationship'
export type { RelationshipMedium, RelationshipProgress } from '../../../../src/renderer/prompts/relationship'
export { memoryLines, profileLines, spaced } from '../../../../src/renderer/prompts/scenePrompt'

export {
  noNsfwImages,
  subscribeNoNsfwImages,
  useNoNsfwImages,
  imageApiConfigured,
  subscribeImageApiConfigured,
  useImageApiConfigured,
  localImageSource,
  subscribeLocalImageSource,
  useLocalImageSource,
  canRenderLocalImages,
  subscribeCanRenderLocalImages,
  phoneOpen,
  viewingThread,
  subscribePhoneView,
  useViewingThread,
  drawFeedHandles,
  drawFeedEmoji
} from '../../../../src/renderer/mods/readers'

export {
  character,
  useCharacter,
  subscribeCharacter,
  characterInfo,
  useCharacterInfo,
  subscribeCharacterInfo,
  rosterIds,
  subscribeRosterIds,
  useRosterIds,
  conversation,
  useConversation,
  subscribeConversation,
  feed,
  useFeed,
  subscribeFeed,
  npcRelationships,
  useNpcRelationships,
  subscribeNpcRelationships,
  clock,
  chatClock,
  useClock,
  subscribeClock,
  playerStats,
  usePlayerStats,
  subscribePlayerStats,
  playerProfilePicture,
  usePlayerProfilePicture,
  subscribePlayerProfilePicture,
  feedReadThrough,
  useFeedReadThrough,
  subscribeFeedReadThrough,
  sceneActive,
  useSceneActive,
  subscribeSceneActive,
  readerPromptText,
  useReaderPromptText,
  subscribeReaderPromptText,
  useProfileImageUrl,
  profileImageUrl,
  subscribeProfileImageUrl
} from '../../../../src/renderer/mods/gameReaders'

export { scene, useScene, subscribeScene, holdTurn } from '../../../../src/renderer/mods/sceneView'
export type { SceneView, SceneViewLine, ScriptedSlot } from '../../../../src/renderer/mods/sceneView'

export { canInviteToScene, freeForInvitation, subscribeInvitations, startInvitedScene } from '../../../../src/renderer/mods/sceneInvitations'
export { charCommitmentAt } from '../../../../src/renderer/stores/timetable'
export type { Commitment } from '../../../../src/renderer/prompts/slotIntroPrompt'

export { hasDesktopSurfaces, canRecordSceneTurn, openSceneExchange, sceneExchangeContext, subscribeSceneTurns } from '../../../../src/renderer/mods/sceneExchange'
export type { ExternalSceneTurn, SceneExchange, SceneExchangeContext } from '../../../../src/renderer/mods/sceneExchange'
export { setSceneSuggestionsPaused, sceneSuggestionsPaused, useSceneSuggestionsPaused, subscribeSceneSuggestionsPaused } from '../../../../src/renderer/mods/sceneSuggestions'
