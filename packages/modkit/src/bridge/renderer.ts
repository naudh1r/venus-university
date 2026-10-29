/**
 * The bridge for the window: every type and function of core's `src/renderer` that the kit hands
 * a mod, re-exported here and nowhere else in the kit (see `shared.ts`).
 */
export type { PromptState } from '../../../../src/renderer/prompts/scenePrompt'
export type { SlotIntroInput } from '../../../../src/renderer/prompts/slotIntroPrompt'
export type { TextingPromptState } from '../../../../src/renderer/prompts/textingPrompt'
export type { useGameStore } from '../../../../src/renderer/stores/gameStore'
export type { ManualSaveOffer } from '../../../../src/renderer/stores/gameLoop'
export type { ResolvedSave } from '../../../../src/renderer/stores/saveStore'
export type { ViewName } from '../../../../src/renderer/stores/uiStore'
export type { ScreenTheme } from '../../../../src/renderer/views/clockTheme'
export type { ModalShell } from '../../../../src/renderer/components/useModalShell'
export { useModalShell, useDismissLayer } from '../../../../src/renderer/components/useModalShell'
export { modIsOn, useModOn, useModOption } from '../../../../src/renderer/stores/modsStore'
export { PostCommentAction, PostCommentsView, PostPicture } from '../../../../src/renderer/components/PostSpots'
export { EmojiTool, SentText, useBareMessage, useEmojiTool } from '../../../../src/renderer/components/TextSpots'
export { submitAction, takeTurnFromReply } from '../../../../src/renderer/stores/gameLoop'
export { finishSlotActivity } from '../../../../src/renderer/stores/slotActivity'
export { fileLatePost } from '../../../../src/renderer/stores/loop/feed'
export { Card, Locked } from '../../../../src/renderer/views/ContactPage'
