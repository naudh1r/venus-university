/**
 * `@vx/modkit/host/renderer`: core's side of the hooks. The rules the mods store sets, every
 * dispatcher the game asks at its hook points, and the slot that draws the mods' components. Not
 * for mods; the boundary test refuses it in a mod file. A mod's side is `../renderer/index.ts`,
 * and the two together are every runtime export of `hooks.ts`, `saveField.ts` and `modState.ts` (the contract
 * test holds them so).
 */
export {
  afterDmReply,
  afterReachOut,
  afterSceneReply,
  bunnyboardPages,
  characterFromDraft,
  contactTabs,
  dmHistoryNotes,
  editorFields,
  editorWrites,
  emojiTool,
  endingChoice,
  exercisedStats,
  fileFeedPost,
  gameEntered,
  gameModal,
  modDetail,
  modRequest,
  optionPreview,
  ownedComments,
  playerActs,
  postCommentsOwner,
  postLikes,
  postOutAt,
  postPicture,
  prepareWayOn,
  projectSlotMemories,
  saveChoice,
  saveNotes,
  scenePlays,
  screenSlot,
  sentText,
  setDeclaredHooks,
  setHookRules,
  setLoadingMod,
  setPanelOpener,
  settleSceneStats,
  slotActivityAvailable,
  slotSettled,
  slotStatusLines,
  statActivities,
  statFloor,
  subscribeHookRules,
  updatesTabs
} from '../renderer/hooks'
export type { DeclaredHooks } from '../renderer/hooks'
export { bindModWrites, bindSaveFieldStore, carryModSlices, readModSlices, saveFields, writeModSlices } from '../renderer/saveField'
export type { ModWrites, ReadModSlices, SaveFieldStore } from '../renderer/saveField'
export { bindGameBoundary } from '../renderer/modState'
export { ModSlot, slotElements, SlotBoundary } from '../renderer/ModSlot'
