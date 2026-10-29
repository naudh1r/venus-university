/**
 * The dispatcher table: every hook core asks, as data with no imports, so the main process can
 * read it at boot without loading the renderer. A hook cannot exist without a row here: the
 * renderer's `hookTie.ts` fails the typecheck when `ModHooks` and this list disagree, and the
 * contract test checks that each row's dispatchers are asked somewhere in core. A mod's manifest
 * names the rows and the kit APIs it uses, and the compatibility check (`compat.ts`) reads them
 * against this table at install and at start.
 */

/** Which process asks the hook. */
export type HookSide = 'shared' | 'renderer' | 'main'

/**
 * How several mods' answers are put together:
 * - `add`: every answer is used, in list order
 * - `merge`: each mod adds its own keyed slice
 * - `pipeline`: each mod receives the last one's result
 * - `first`: the first mod that answers decides; the game's own is the fallback
 * - `any`: any `true` (or any `false`) decides
 * - `event`: every mod is told; nothing is returned
 * - `owner`: one mod at a time draws it, the first that is on and has one
 * - `slot`: every mod's component is drawn at the place, in list order
 * - `registry`: what a mod's code exports is collected once, at load
 */
export type HookKind = 'add' | 'merge' | 'pipeline' | 'first' | 'any' | 'event' | 'owner' | 'slot' | 'registry'

export interface HookRow {
  /** The name a manifest uses: a key of `ModHooks`, or `prompts.<spot>` and `requests.<spot>`. */
  readonly name: string
  readonly side: HookSide
  readonly kind: HookKind
  /** The host functions that ask it, in `@vx/modkit/host/<side>`. */
  readonly dispatch: readonly string[]
  /** Asked of a mod whether or not it is on. */
  readonly askedWhenOff?: true
  /** The kit version it arrived in. */
  readonly since: string
}

// The names stay literal (`const` type parameters) so `hookTie.ts` can compare them with `ModHooks`.
const prompt = <const S extends string>(spot: S) =>
  ({ name: `prompts.${spot}` as `prompts.${S}`, side: 'renderer', kind: 'add', dispatch: ['promptLines', 'promptFields', 'promptRequired'], since: '0.1.0' }) as const
const request = <const S extends string>(spot: S) =>
  ({ name: `requests.${spot}` as `requests.${S}`, side: 'renderer', kind: 'pipeline', dispatch: ['modRequest'], since: '0.1.0' }) as const
const slot = <const N extends string>(name: N) =>
  ({ name, side: 'renderer', kind: 'slot', dispatch: ['screenSlot'], since: '0.1.0' }) as const

export const HOOKS = [
  // Prompts and requests
  prompt('scene'),
  prompt('dm'),
  prompt('slot-posts'),
  prompt('slot-poster'),
  prompt('slot-reach-outs'),
  prompt('text-ledger'),
  prompt('character'),
  request('scene'),
  request('dm'),
  request('ledger'),
  request('slot-intro'),
  { name: 'dmHistoryNote', side: 'renderer', kind: 'add', dispatch: ['dmHistoryNotes'], since: '0.1.0' },
  { name: 'characterFromDraft', side: 'renderer', kind: 'merge', dispatch: ['characterFromDraft'], since: '0.1.0' },

  // The turn and the game's life
  { name: 'afterDmReply', side: 'renderer', kind: 'event', dispatch: ['afterDmReply'], since: '0.1.0' },
  { name: 'afterSceneReply', side: 'renderer', kind: 'event', dispatch: ['afterSceneReply'], since: '0.1.0' },
  { name: 'afterReachOut', side: 'renderer', kind: 'event', dispatch: ['afterReachOut'], since: '0.1.0' },
  { name: 'playerActs', side: 'renderer', kind: 'event', dispatch: ['playerActs'], since: '0.1.0' },
  { name: 'gameEntered', side: 'renderer', kind: 'event', dispatch: ['gameEntered'], since: '0.1.0' },
  { name: 'slotSettled', side: 'renderer', kind: 'event', dispatch: ['slotSettled'], since: '0.1.0' },
  { name: 'slotStatusLines', side: 'renderer', kind: 'add', dispatch: ['slotStatusLines'], since: '0.1.0' },
  { name: 'projectSlotMemories', side: 'renderer', kind: 'pipeline', dispatch: ['projectSlotMemories'], since: '0.1.0' },
  { name: 'exercisedStats', side: 'renderer', kind: 'pipeline', dispatch: ['exercisedStats'], since: '0.1.0' },
  { name: 'settleSceneStats', side: 'renderer', kind: 'pipeline', dispatch: ['settleSceneStats'], since: '0.1.0' },
  { name: 'statFloor', side: 'renderer', kind: 'first', dispatch: ['statFloor'], since: '0.1.0' },
  { name: 'statActivities', side: 'renderer', kind: 'add', dispatch: ['statActivities'], since: '0.1.0' },
  { name: 'slotActivityAvailable', side: 'renderer', kind: 'any', dispatch: ['slotActivityAvailable', 'statActivities'], since: '0.1.0' },
  { name: 'saveNote', side: 'renderer', kind: 'add', dispatch: ['saveNotes'], since: '0.1.0' },

  // The feed
  { name: 'fileFeedPost', side: 'renderer', kind: 'pipeline', dispatch: ['fileFeedPost'], since: '0.1.0' },
  { name: 'postLikes', side: 'renderer', kind: 'first', dispatch: ['postLikes'], since: '0.1.0' },
  { name: 'postVisible', side: 'renderer', kind: 'any', dispatch: ['postVisible'], since: '0.1.0' },
  { name: 'postOutAt', side: 'renderer', kind: 'first', dispatch: ['postOutAt'], since: '0.1.0' },
  { name: 'postComments', side: 'renderer', kind: 'owner', dispatch: ['postCommentsOwner', 'ownedComments'], askedWhenOff: true, since: '0.1.0' },
  { name: 'postPicture', side: 'renderer', kind: 'owner', dispatch: ['postPicture'], since: '0.1.0' },
  { name: 'emojiTool', side: 'renderer', kind: 'owner', dispatch: ['emojiTool'], since: '0.1.0' },
  { name: 'sentText', side: 'renderer', kind: 'owner', dispatch: ['sentText'], since: '0.1.0' },

  // Ways on and the Mods screen
  { name: 'endingChoice', side: 'renderer', kind: 'first', dispatch: ['endingChoice', 'prepareWayOn'], since: '0.1.0' },
  { name: 'saveChoice', side: 'renderer', kind: 'first', dispatch: ['saveChoice', 'prepareWayOn'], since: '0.1.0' },
  { name: 'modDetail', side: 'renderer', kind: 'first', dispatch: ['modDetail'], since: '0.1.0' },
  { name: 'optionPreviews', side: 'renderer', kind: 'add', dispatch: ['optionPreview'], askedWhenOff: true, since: '0.1.0' },

  // Screens
  { name: 'bunnyboardPage', side: 'renderer', kind: 'add', dispatch: ['bunnyboardPages'], since: '0.1.0' },
  { name: 'updatesTab', side: 'renderer', kind: 'add', dispatch: ['updatesTabs'], since: '0.1.0' },
  { name: 'scenePlay', side: 'renderer', kind: 'add', dispatch: ['scenePlays'], since: '0.1.0' },
  { name: 'gameModals', side: 'renderer', kind: 'add', dispatch: ['gameModal', 'setPanelOpener'], since: '0.2.0' },
  { name: 'contactTab', side: 'renderer', kind: 'add', dispatch: ['contactTabs'], since: '0.1.0' },
  { name: 'editorField', side: 'renderer', kind: 'add', dispatch: ['editorFields'], since: '0.1.0' },
  slot('settingsSection'),
  slot('portraitOverlay'),
  slot('phoneOverlay'),
  { name: 'conversationFoot', side: 'renderer', kind: 'slot', dispatch: ['screenSlot'], since: '0.3.0' },
  slot('mapOverlay'),
  slot('photosPageSection'),
  slot('editCharacterImages'),
  slot('stageLayer'),
  slot('panelLayer'),
  slot('messageAttachment'),
  slot('contactPostExtra'),
  { ...slot('railButton'), since: '0.2.0' },
  { ...slot('landingTool'), since: '0.2.0' },
  { ...slot('gameMenuEntry'), since: '0.2.0' },

  // The main process: what a mod's `main.js` exports, collected by the loader at start
  { name: 'protocols', side: 'main', kind: 'registry', dispatch: ['collectRoutes'], since: '0.3.0' }
] as const satisfies readonly HookRow[]

export type HookName = (typeof HOOKS)[number]['name']

/** A hook announced as going: still asked for one Venus Dev update cycle. */
export interface DeprecatedHook {
  readonly name: string
  /** The hook that replaces it. */
  readonly replacedBy: string
  /** The build's release it goes in (`BUILD.version`), not the game's. */
  readonly goesIn: string
}

/** A hook that is gone: what the compatibility check names in "needs an update". */
export interface RemovedHook {
  readonly name: string
  /** The build's release that dropped it (`BUILD.version`), not the game's. */
  readonly removedIn: string
  readonly replacedBy?: string
}

export const DEPRECATED_HOOKS: readonly DeprecatedHook[] = []

export const REMOVED_HOOKS: readonly RemovedHook[] = []

/**
 * Every runtime export of the three mod-facing entry points, as `<side>:<name>`, so a manifest's
 * one `hooks` list can name a kit API beside a hook without the two colliding. Types are not
 * listed: a type that goes breaks a build, not a running mod. The contract test holds this list to
 * the entry points' actual exports, both ways.
 */
export const KIT_APIS = [
  'shared:carryModFiles',
  'shared:DEPRECATED_HOOKS',
  'shared:hasTrait',
  'shared:HOOKS',
  'shared:KIT_APIS',
  'shared:KIT_VERSION',
  'shared:MAX_TIER',
  'shared:memoryStatusLine',
  'shared:modById',
  'shared:modOn',
  'shared:optionKey',
  'shared:optionOn',
  'shared:pointsForTier',
  'shared:registerCharacterTrait',
  'shared:registerImagePromptDraft',
  'shared:registerPostCarry',
  'shared:registerRomanceRequirement',
  'shared:registerTermCarry',
  'shared:registerTermFiles',
  'shared:REMOVED_HOOKS',
  'shared:sharedModOn',
  'renderer:Card',
  'renderer:EmojiTool',
  'renderer:fileLatePost',
  'renderer:finishSlotActivity',
  'renderer:Locked',
  'renderer:modIsOn',
  'renderer:modState',
  'renderer:openPanel',
  'renderer:ownsPostComments',
  'renderer:PostCommentAction',
  'renderer:PostCommentsView',
  'renderer:PostPicture',
  'renderer:postVisible',
  'renderer:promptFields',
  'renderer:promptLines',
  'renderer:promptRequired',
  'renderer:recordField',
  'renderer:registerHooks',
  'renderer:safePoint',
  'renderer:saveField',
  'renderer:SentText',
  'renderer:submitAction',
  'renderer:takeTurnFromReply',
  'renderer:useBareMessage',
  'renderer:useDismissLayer',
  'renderer:useEmojiTool',
  'renderer:useModalShell',
  'renderer:useModOn',
  'renderer:useModOption',
  'renderer:useSafePoint',
  'renderer:writeModField',
  'renderer:writeModFields',
  'main:backupPart',
  'main:characterTransferPart',
  'main:modDataPath',
  'main:registerComfyLaunchEnvironment'
] as const

export type KitApiName = (typeof KIT_APIS)[number]
