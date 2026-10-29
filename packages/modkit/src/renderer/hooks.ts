import type { ComponentType, ReactNode } from 'react'
import { checkCompat, hookNamesOf } from '../shared/compat'
import { declaredHooksNow, refusedAsForeign } from './attribution'
import type { StructuredRequest, LedgerResponse } from '../bridge/shared'
import type { PromptState } from '../bridge/renderer'
import type { SlotIntroInput } from '../bridge/renderer'
import type { useGameStore } from '../bridge/renderer'
import type {
  Character,
  CharInfo,
  ChatMessage,
  SocialPost,
  TextingResponse
} from '../bridge/shared'
import type { GameOverReason } from '../bridge/shared'
import type { LedgerStats, PlayerStats, StatContext, StatKey, StatusText } from '../bridge/shared'
import type { PostComment } from '../bridge/shared'
import type { SlotActivityOffer } from '../bridge/shared'
import type { ModSceneFields, PlaythroughRecord, SceneLine, TimeSlot } from '../bridge/shared'
import type { TextingPromptState } from '../bridge/renderer'
import type { ResolvedSave } from '../bridge/renderer'
import type { ViewName } from '../bridge/renderer'
import type { ManualSaveOffer } from '../bridge/renderer'
import type { ScreenTheme } from '../bridge/renderer'
import type { ModDef } from '../bridge/shared'

/**
 * The places in the game a mod adds to, without editing the game's code there.
 *
 * The game asks here at each place: one line in its own file, the same whichever mods are
 * installed. A mod answers by registering, once, from its own files ({@link registerHooks}).
 * Mods are asked in the order `MODS` lists them, and **only while they are on**: a mod that is
 * off is not asked at all, so the game runs as it would without it.
 *
 * No imports at run time, so any file of the game can ask here without a circle of imports;
 * whether a mod is on is handed in by the mods store ({@link setHookRules}).
 */

/** What each prompt hands the mods adding to it. */
export interface PromptSpots {
  scene: { cast: readonly Character[]; state: PromptState; query: string }

  /** Her reply in a DM thread. */
  dm: { character: Character; info: CharInfo | undefined; state: TextingPromptState }
  /** The status updates the slot's opening writes, one entry per post. */
  'slot-posts': Record<string, never>
  /**
   * One girl posting this slot, under her name in the slot's opening: lines only. The opening
   * can be written while the slot before it is still playing, so `date` and `time` name the slot
   * it is for.
   */
  'slot-poster': { character: Character; info: CharInfo; date: number; time: TimeSlot }
  /** The girl the slot's opening has texting the reader just to talk, one call per girl. */
  'slot-reach-outs': { character: Character; info: CharInfo; date: number }
  /**
   * The texting bookkeeping after a slot of texts, below its messages: lines only. `charKeys` are
   * the girls he texted, as the call keys them.
   */
  'text-ledger': { charKeys: readonly string[] }
  /** A character being generated. */
  character: Record<string, never>
}

export type PromptSpot = keyof PromptSpots

/** What a mod adds to one prompt: instruction lines, and fields the reply has to fill in. */
export interface PromptAddition<C> {
  lines?: (ctx: C) => readonly string[]
  /**
   * Schema properties: the top level for `dm` and `character`, each post for `slot-posts`, each
   * girl's entry for `slot-reach-outs`.
   */
  fields?: () => Record<string, unknown>
  /** Which of those fields the reply must fill in. */
  required?: () => readonly string[]
}

/** A post from the slot's opening, on its way to her feed. */
export interface PostFiling {
  charId: string
  /** The post as the game would file it; a mod may change or add to it. */
  post: SocialPost
  /** What the reply wrote for this post, including the fields mods asked for. */
  reply: Readonly<Record<string, unknown>>
  /** Set by a mod that files the post itself, later: the game then leaves it alone. */
  held: boolean
  /** Set by a mod for a post worth showing first, as the slot's teaser. */
  featured: boolean
}

/** A post's likes, for the posts the game rolls likes for outside the slot's opening. */
export interface LikesAsk {
  kind: 'ending' | 'stranger' | 'winter'
  /** Her id, or the stranger's handle. */
  author: string
  character?: Character
  playthroughId?: string | null
  /** How many of the cast are her friends. */
  friends: number
}

/**
 * A way on that a mod offers in place of the game's own, on a screen that otherwise has one.
 * `prepare` runs first, while nothing has been torn down: it does whatever may fail (reading a
 * save, say), reports its own failure and returns null, and the player stays where he was. On
 * success it returns `enter`, which the game calls once the running game, if any, is gone, and
 * which stages what the mod needs and names the screen to show.
 */
export interface WayOn {
  prepare: () => Promise<(() => ViewName) | null>
}

/** The ending's way on, offered beside "Return to the main menu", which stays. */
export interface EndingChoice extends WayOn {
  /** The button's words. */
  label: string
}

/** What the Mods screen hands a mod's own page ({@link ModHooks.modDetail}). */
export interface ModDetailProps {
  /** The mod picked in the list. */
  mod: ModDef
  /** The screen's own switch, so a page's switches are the screen's. */
  Switch: ComponentType<{
    id: string
    label: string
    on: boolean
    disabled?: boolean
    onChange: (on: boolean) => void
  }>
  /** Whether one of the picked mod's options is on. */
  optionOn: (optionId: string) => boolean
  /** Moves one, by the screen's own way of making a change: asked first where it costs something. */
  setOption: (optionId: string, on: boolean) => void
}

/** What the Mods screen hands a preview of one of a mod's option groups: the option picked. */
export interface OptionPreviewProps {
  optionId: string | null
}

/** What a mod offers for a save picked in Load Game, beside loading it. */
export interface SaveChoice extends WayOn {
  title: string
  /** The question. The game adds its own line about progress a running game would lose. */
  message: string
  /** The button that takes the mod's way, beside Load. */
  label: string
}

export interface RequestSpots {
  scene: PromptSpots['scene']
  dm: PromptSpots['dm'] & { newMessage: string }
  ledger: { state: PromptState; charKeys: readonly string[] }
  'slot-intro': { input: SlotIntroInput }
}

export interface SlotSettled {
  before: ReturnType<typeof useGameStore.getState>
  ledger: LedgerResponse | null
  closingCast: readonly Character[]
}

/** A read-only preview of the finished scene, before the crush roll and next opening. */
export type SlotMemoryProjection = Pick<SlotSettled, 'before' | 'closingCast'>

/** What a finished scene does to the reader's stats, and the lines that say so. */
export interface SceneStats {
  deltas: PlayerStats
  lines: StatusText[]
}

/** What the game resolved a scene's stats from: the ledger's verdict and the scene's facts. */
export interface SceneStatSettlement {
  /** What the hour exercised, as `exercisedStats` left it. */
  ledger: LedgerStats | undefined
  ctx: StatContext
}

export interface BunnyboardPage {
  id: string
  word: string
  Mark: ComponentType
  Page: ComponentType
}

/** One control on a scene's rail, as the game draws its own: icon only, a count on its corner. */
export interface RailSeatProps {
  label: string
  badge?: number
  /** Standing and answering, standing but dead, or off the rail altogether. */
  state: 'shown' | 'dim' | 'gone'
  onClick: () => void
  children: ReactNode
}

/** One tool in the landing's corner, as the game draws its own: icon only, its label on a hover. */
export interface LandingToolProps {
  label: string
  onClick: () => void
  children: ReactNode
}

/** One entry in the game menu, as the menu draws its own. */
export interface GameMenuItemProps {
  /** It stands dimmed and takes nothing. */
  dead?: boolean
  /** What a hover over it says while it is dead. */
  note?: string
  onClick: () => void
  children: ReactNode
}

/** What the game hands a mod's seat on a scene's rail. */
export interface SceneSeatProps {
  /** The rail's own seat, so a mod's control is drawn as the game's are. */
  Seat: ComponentType<RailSeatProps>
  /** The rail is up: false behind a curtain, with the chrome hidden, or before the rail is. */
  visible: boolean
  /** Opens this mod's {@link ScenePlay.Panel} over the scene. */
  open: () => void
}

/** What the game hands a mod's panel over a scene. */
export interface ScenePanelProps {
  /** The half of the day the stage is in, which every modal over it wears. */
  theme: ScreenTheme
  onClose: () => void
}

/** What the game hands a mod's panel opened with {@link openPanel}. */
export interface GameModalProps {
  /** The half of the day the stage is in, which every modal over it wears. */
  theme: ScreenTheme
  /** What `openPanel` was handed beside the id: whose panel it is, say. */
  arg: string | undefined
  /** A crossing between screens is over the view. */
  covered: boolean
  onClose: () => void
  /** Closes the panel into the game menu, for a panel the menu opened. */
  openGameMenu: () => void
}

/**
 * A mod's place on the scene screen. `Seat` is mounted on the rail for as long as a scene's
 * chrome is, and decides for itself when it has something to offer (`state: 'gone'` otherwise).
 * `Panel` is mounted while open, and while it is the scene behind it takes no key, click or turn,
 * exactly as behind the game's own panels.
 */
export interface ScenePlay {
  Seat: ComponentType<SceneSeatProps>
  Panel: ComponentType<ScenePanelProps>
}

/** A scene reply that has landed, as the model wrote it. */
export interface SceneReplied {
  /** The whole reply, including the fields mods asked for. */
  reply: Readonly<Record<string, unknown>>
  /** Who is still in the scene. */
  cast: readonly Character[]
  solo: boolean
  /** The reply ends the scene: its closing is next, and no turn is handed back. */
  ending: boolean
}

/**
 * A page of a mod's own beside the feed in the Updates tab, behind a title of its own beside the
 * feed's. `unread` is what its title and the Updates tile on the rail count; `Action` is drawn at
 * the end of the titles' row while the page is showing.
 */
export interface UpdatesTab {
  id: string
  word: string
  Page: ComponentType
  Action?: ComponentType
  unread?: (game: ReturnType<typeof useGameStore.getState>) => number
}

/** What the row drawing a post hands to whatever draws its comments or acts on them. */
export interface PostCommentsProps {
  comments: readonly PostComment[]
  /** Whose post it is; absent for the slot's random student. */
  charId?: string
  postId?: string
  /** Somebody he has no contact info for. */
  stranger?: boolean
}

/** What the game hands a mod's emoji tool beside a box being typed in. */
export interface EmojiToolProps {
  /** The box is shut, and the tool with it. */
  dead?: boolean
  /** Puts an emoji into the box, where its caret is. */
  onPick: (emoji: string) => void
}

/**
 * How a mod draws what somebody sent — a phone message, a post, a comment — in place of its bare
 * text. Only one draws it, the first mod that is on and has one ({@link sentText}).
 */
export interface SentTextSpot {
  /** The text drawn; `big` off where it stands on a one-line preview. */
  Text: ComponentType<{ text: string; big?: boolean }>
  /** Whether a phone message is drawn bare, with no bubble behind it. */
  bare?: (text: string) => boolean
}

/**
 * One mod's way of drawing the comments under a post. Only one draws them at a time: the first
 * mod that is on and has one, in the order `MODS` lists them ({@link postCommentsOwner}).
 */
export interface PostCommentsSpot {
  /** Under the post's text and picture. */
  View: ComponentType<PostCommentsProps>
  /** Beside the post's like, where it has something to put there. */
  Action?: ComponentType<PostCommentsProps>
  /**
   * A comment only this mod could have written. Asked whether or not the mod is on, so another
   * mod drawing comments leaves this one's out while it is off, and they come back with it.
   */
  claims?: (comment: PostComment) => boolean
}

/** Which post a picture belongs to; whatever draws it reads the post itself. */
export interface PostPictureProps {
  charId: string
  postId: string
}

export interface ModHooks {
  /** Activities the landing may offer for a stat, in place of its own suggestion. */
  statActivities?: (stat: StatKey) => readonly SlotActivityOffer[]
  /** Whether an activity offered is still there, asked at commit and on reload. */
  slotActivityAvailable?: (offer: SlotActivityOffer) => boolean
  bunnyboardPage?: BunnyboardPage
  /** A page beside the feed in the Updates tab; see {@link UpdatesTab}. */
  updatesTab?: UpdatesTab
  /** Draws the comments under a post; see {@link PostCommentsSpot}. */
  postComments?: PostCommentsSpot
  /** An emoji tool beside a box being typed in, in place of the phone's own row of emoji. */
  emojiTool?: ComponentType<EmojiToolProps>
  /** Draws what somebody sent; see {@link SentTextSpot}. */
  sentText?: SentTextSpot
  /** Draws a post's picture under its text, wherever a post is drawn; the first mod on decides. */
  postPicture?: ComponentType<PostPictureProps>

  /** Extend a completed request, preserving other mods' additions. */
  requests?: { [S in keyof RequestSpots]?: (request: StructuredRequest, ctx: RequestSpots[S]) => StructuredRequest }
  /** After bookkeeping settles, before the clock advances and the boundary save is written. */
  slotSettled?: (ctx: SlotSettled) => void
  /**
   * Lines in the slot's closing report, after what each girl took away from it, written as the
   * game writes its own (`memoryStatusLine`). `nextSlot` is the global slot about to begin.
   */
  slotStatusLines?: (ctx: { nextSlot: number }) => readonly SceneLine[]
  /**
   * Apply the same memory weights as settlement to a projection. Must return new values
   * without writing the store, paying rewards, consuming abilities or rolling randomness.
   */
  projectSlotMemories?: (ctx: SlotMemoryProjection, charInfo: Record<string, CharInfo>) => Record<string, CharInfo>
  /**
   * Change what the hour exercised, before the game resolves what that pays: the ledger's verdict
   * on which stats the scene worked, or undefined where it gave none. A scene whose exercise is
   * something other than what the ledger saw — a game played to train a stat, say — says so here,
   * and every mod settling afterwards sees it as the ledger. Runs for the projections before the
   * ending too, so it must return new values without writing the store or rolling randomness.
   */
  exercisedStats?: (ledger: LedgerStats | undefined, ctx: StatContext) => LedgerStats | undefined
  /**
   * Change what a finished scene does to the reader's stats, after the game has resolved what the
   * exercise pays. Runs for the projections before the ending as well as for the settlement
   * itself, so it must return new values without writing the store, paying rewards or rolling
   * randomness. What the hour exercised is `exercisedStats`'s to change, not this hook's.
   */
  settleSceneStats?: (resolved: SceneStats, settlement: SceneStatSettlement) => SceneStats
  /** The lowest a stat may fall to; the first mod that answers decides. */
  statFloor?: (key: StatKey) => number | undefined

  prompts?: { [S in PromptSpot]?: PromptAddition<PromptSpots[S]> }
  /** Added to a DM in the history a prompt quotes, after its text. */
  dmHistoryNote?: (message: ChatMessage) => string
  /** Fields of a generated character taken from what the reply wrote. */
  characterFromDraft?: (
    draft: Readonly<Record<string, unknown>>,
    ctx: { baseAppearance: readonly string[] }
  ) => Partial<Character>
  /** After her reply in a DM has landed. */
  afterDmReply?: (ctx: { charId: string; character: Character; reply: TextingResponse }) => void
  /** After a scene reply has landed and its lines are on the transcript. */
  afterSceneReply?: (ctx: SceneReplied) => void
  /** A seat on the scene's rail, and the panel it opens over the scene. */
  scenePlay?: ScenePlay
  /**
   * Panels over the game view, by id, which {@link openPanel} opens as one of the view's own: the
   * scene behind takes nothing while one is up. One panel per id, the first mod's that is on.
   */
  gameModals?: Record<string, ComponentType<GameModalProps>>
  /** Drawn on the scene's rail, after the Calendar and before the mods' scene seats (`scenePlay`). */
  railButton?: ComponentType<ScreenSlotProps['railButton']>
  /** Drawn among the landing's tools, after the log and before Settings. */
  landingTool?: ComponentType<ScreenSlotProps['landingTool']>
  /** Drawn in the game menu, after Mods and before Controls. */
  gameMenuEntry?: ComponentType<ScreenSlotProps['gameMenuEntry']>

  /**
   * After the texts of a girl reaching out just to talk have landed. `reply` is her entry from the
   * slot's opening, with whatever fields `prompts['slot-reach-outs']` added to it.
   */
  afterReachOut?: (ctx: {
    charId: string
    character: Character
    reply: Readonly<Record<string, unknown>>
  }) => void
  /** As the reader commits to something: an action sent, a hangout begun, or Relax. */
  playerActs?: () => void
  /** As a game is entered, new or loaded. */
  gameEntered?: () => void
  /** A post from the slot's opening, before it is filed. */
  fileFeedPost?: (
    filing: PostFiling,
    ctx: { nudge: (charId: string) => void }
  ) => void | Promise<void>
  /** A post's likes; the first mod that answers decides. */
  postLikes?: (ask: LikesAsk) => number | undefined
  /** Whether a post is on her feed yet; every mod has to agree. */
  postVisible?: (post: SocialPost) => boolean
  /** When a post came out after its slot began (ms since epoch); the first mod that answers. */
  postOutAt?: (post: SocialPost) => number | undefined
  /** A way on from the ending, beside the menu; the first mod that answers is offered. */
  endingChoice?: (ctx: {
    reason: GameOverReason
    playthroughId: string | null
  }) => EndingChoice | undefined
  /**
   * A page of its own on the Mods screen for the mod picked there, its own or one that builds on
   * it, drawn where that mod's options would be listed. The same component every time it is
   * asked for the same mod; undefined for a mod it has nothing to say about.
   */
  modDetail?: (mod: ModDef) => ComponentType<ModDetailProps> | undefined
  /**
   * A preview drawn under one of its option groups on the Mods screen, by the group's id, of
   * whichever option is picked. Asked whether or not the mod is on, so it shows before it is.
   */
  optionPreviews?: Record<string, ComponentType<OptionPreviewProps>>
  /** An offer for a save picked in Load Game, beside loading it; the first mod that answers. */
  saveChoice?: (ctx: {
    playthroughId: string
    save: ResolvedSave & { record: PlaythroughRecord }
  }) => SaveChoice | undefined
  /** A line on Save Game about what a save of the scene keeps of the mod's own; null for none. */
  saveNote?: (scene: Readonly<ModSceneFields>) => string | null
  /** Drawn in app settings, in the Game tab under the volume sliders. */
  settingsSection?: ComponentType<ScreenSlotProps['settingsSection']>
  /** Drawn in each portrait on the stage, under her sprite. */
  portraitOverlay?: ComponentType<ScreenSlotProps['portraitOverlay']>
  /** Mounted in the phone's veil for as long as the phone is open. */
  phoneOverlay?: ComponentType<ScreenSlotProps['phoneOverlay']>
  /** Below a person's message history, before the native composer. Not drawn for bot threads. */
  conversationFoot?: ComponentType<ScreenSlotProps['conversationFoot']>
  /** Drawn on the map, under the places and above its foot. */
  mapOverlay?: ComponentType<ScreenSlotProps['mapOverlay']>
  /** Drawn on the Photos page, under the grid of photos. */
  photosPageSection?: ComponentType<ScreenSlotProps['photosPageSection']>
  /** Drawn first among her images, in the character editor and in the character view. */
  editCharacterImages?: ComponentType<ScreenSlotProps['editCharacterImages']>
  /** A field of the mod's own in the character editor, saved with her; see {@link EditorField}. */
  editorField?: EditorField
  /** Mounted over the stage and under the scene's chrome, on every screen of the game view. */
  stageLayer?: ComponentType<ScreenSlotProps['stageLayer']>
  /** Mounted among the game view's panels, over the chrome, on every screen of the game view. */
  panelLayer?: ComponentType<ScreenSlotProps['panelLayer']>
  /** Drawn after a phone message's text bubble, or alone where the message has no text. */
  messageAttachment?: ComponentType<ScreenSlotProps['messageAttachment']>
  /** Drawn beside a post's like, in the feed on her contact page. */
  contactPostExtra?: ComponentType<ScreenSlotProps['contactPostExtra']>
  /** A reading of her of the mod's own on her contact page; see {@link ContactTab}. */
  contactTab?: ContactTab
}

/**
 * What the game hands a mod's component at each place on screen it draws one. Every mod that is
 * on and has a component there is drawn, in list order.
 */
export interface ScreenSlotProps {
  settingsSection: {
    /** The half of the day the settings wear, which a modal raised over them wears too. */
    theme: ScreenTheme
    /** A backup or a restore is running. */
    busy: boolean
  }
  portraitOverlay: { charId: string }
  phoneOverlay: Record<string, never>
  conversationFoot: {
    /** The open person's conversation key. The contribution remounts when the thread changes. */
    charId: string
  }
  mapOverlay: {
    /** The map was opened to go somewhere, not only to look. */
    canTravel: boolean
    /** Closes the map. */
    close: () => void
  }
  photosPageSection: { theme: ScreenTheme }
  editCharacterImages: {
    charId: string
    /** Her name as it stands, in the editor as it is being typed. */
    name: string
    theme: ScreenTheme
    /** Her height, as a share of full size, the way the stage draws her. */
    height: number
  }
  stageLayer: {
    /** A scene is on screen, rather than the landing or a game over. */
    sceneMode: boolean
    /** The orientation's cinematic hour. */
    cinematic: boolean
    /** A crossing between screens is over the view. */
    covered: boolean
    /** The reader has hidden the interface. */
    uiHidden: boolean
    /** The scene's action row is up. */
    rowShown: boolean
    /** A panel, a modal or a failure stands over the scene, and it takes no input. */
    blocked: boolean
    /** A quiz's answers stand in place of the action row. */
    quiz: boolean
    /** The row stands over a reply still being read: open to a hover, or locked. Null otherwise. */
    interjectRow: 'open' | 'locked' | null
    /** The scene is waiting on the reader's turn. */
    awaitingInput: boolean
  }
  panelLayer: {
    cinematic: boolean
    covered: boolean
    uiHidden: boolean
    blocked: boolean
    /** One of the game view's panels is open. */
    panelOpen: boolean
    /** Opens the game menu. */
    openGameMenu: () => void
  }
  messageAttachment: { message: ChatMessage }
  contactPostExtra: { charId: string; post: SocialPost }
  railButton: {
    /** The rail's own seat, so a mod's button is drawn as the game's are. */
    Seat: ComponentType<RailSeatProps>
    /** The rail is up: false behind a curtain, with the chrome hidden, or before Settings is. */
    visible: boolean
    /** The rail stands but takes nothing. */
    dead: boolean
  }
  landingTool: {
    /** The landing's own tool, so a mod's is drawn, and arrives, as the game's are. */
    Tool: ComponentType<LandingToolProps>
    /** Settings is revealed, and with it the mods' tools. */
    visible: boolean
  }
  gameMenuEntry: {
    /** The menu's own entry, so a mod's is drawn, and dealt in, as the game's are. */
    Item: ComponentType<GameMenuItemProps>
    /** Whether a save can be written now (`'open'`), only once the reply in flight lands, or not at all. */
    saveOffer: ManualSaveOffer
  }
}

export type ScreenSlot = keyof ScreenSlotProps

/** What the game hands a mod's tab on her contact page. */
export interface ContactTabProps {
  charId: string
  /** He has her number: her page is open, not a stranger's. */
  isContact: boolean
  theme: ScreenTheme
}

/**
 * A reading of her of a mod's own on her contact page: a tab named `label` beside Profile, and
 * `Panel` drawn in place of her profile cards while it is the one being read. `shown` says whether
 * the tab stands on her page at all; it is asked on every render, so it may read the store.
 */
export interface ContactTab {
  id: string
  label: string
  Panel: ComponentType<ContactTabProps>
  shown?: (ctx: { charId: string; isContact: boolean }) => boolean
}

interface Registered {
  modId: string
  hooks: ModHooks
}

const registered: Registered[] = []

/**
 * Whether a mod is on, and where `MODS` lists it; the mods store sets both at boot, and
 * `subscribe`, which calls back whenever a switch moves.
 */
let rules: {
  isOn: (modId: string) => boolean
  order: (modId: string) => number
  subscribe?: (onChange: () => void) => () => void
} = {
  isOn: () => true,
  order: () => 0
}

export function setHookRules(next: typeof rules): void {
  rules = next
}

/**
 * Calls back whenever a switch moves or a game is entered or left; a no-op until the mods store
 * has set the rules.
 */
export function subscribeHookRules(onChange: () => void): () => void {
  return rules.subscribe?.(onChange) ?? (() => {})
}

export { setDeclaredHooks, setLoadingMod } from './attribution'
export type { DeclaredHooks } from './attribution'

/**
 * A mod's hooks, registered once from its own files. An installed mod's registration is held to
 * its manifest: a hook the manifest does not declare, or a registration under another mod's id
 * while this one is being imported, is refused and nothing of it is kept.
 */
export function registerHooks(modId: string, hooks: ModHooks): void {
  const declaredHooks = declaredHooksNow()
  if (declaredHooks) {
    if (refusedAsForeign(modId, 'hooks')) return
    const declared = declaredHooks.declared(modId)
    if (declared) {
      const compat = checkCompat(declared, hookNamesOf(hooks))
      if (compat.status !== 'loads') {
        declaredHooks.onRefused(modId, compat.message)
        return
      }
    }
  }
  registered.push({ modId, hooks })
}

/** The hooks of the mods that are on, in the order `MODS` lists them. */
function active(): ModHooks[] {
  return activeEntries().map((entry) => entry.hooks)
}

function activeEntries(): Registered[] {
  return registered
    .filter((entry) => rules.isOn(entry.modId))
    .sort((a, b) => rules.order(a.modId) - rules.order(b.modId))
}

/** The emoji tool beside a box being typed in: the first mod's that is on, or none. */
export function emojiTool(): ComponentType<EmojiToolProps> | null {
  return active().find((hooks) => hooks.emojiTool)?.emojiTool ?? null
}

/** How sent text is drawn: the first mod's that is on, or none. */
export function sentText(): SentTextSpot | null {
  return active().find((hooks) => hooks.sentText)?.sentText ?? null
}

/** The mod drawing post comments right now: the first that is on and draws them, or none. */
export function postCommentsOwner(): { modId: string; spot: PostCommentsSpot } | null {
  const entry = activeEntries().find((one) => one.hooks.postComments)
  return entry?.hooks.postComments ? { modId: entry.modId, spot: entry.hooks.postComments } : null
}

/**
 * Whether `modId` is the one drawing post comments, and so the one that writes them: a mod that
 * is not leaves the slot's posts without asking for any.
 */
export function ownsPostComments(modId: string): boolean {
  return postCommentsOwner()?.modId === modId
}

/** A post's comments as `ownerId` draws them: every one no other mod claims, on or off. */
export function ownedComments(
  comments: readonly PostComment[],
  ownerId: string
): PostComment[] {
  const others = registered.filter(
    (entry) => entry.modId !== ownerId && entry.hooks.postComments?.claims
  )
  return comments.filter(
    (comment) => !others.some((entry) => entry.hooks.postComments?.claims?.(comment))
  )
}

/** What draws a post's picture: the first mod that is on and draws one, or none. */
export function postPicture(): ComponentType<PostPictureProps> | null {
  return active().find((hooks) => hooks.postPicture)?.postPicture ?? null
}

/** Every mod's lines for one prompt. */
export function promptLines<S extends PromptSpot>(spot: S, ctx: PromptSpots[S]): string[] {
  return active().flatMap((hooks) => [...(promptOf(hooks, spot)?.lines?.(ctx) ?? [])])
}

/** Every mod's schema fields for one prompt. */
export function promptFields(spot: PromptSpot): Record<string, unknown> {
  return Object.assign({}, ...active().map((hooks) => promptOf(hooks, spot)?.fields?.() ?? {}))
}

/** Every mod's required fields for one prompt. */
export function promptRequired(spot: PromptSpot): string[] {
  return active().flatMap((hooks) => [...(promptOf(hooks, spot)?.required?.() ?? [])])
}

function promptOf<S extends PromptSpot>(
  hooks: ModHooks,
  spot: S
): PromptAddition<PromptSpots[S]> | undefined {
  return hooks.prompts?.[spot] as PromptAddition<PromptSpots[S]> | undefined
}

export function dmHistoryNotes(message: ChatMessage): string {
  return active()
    .map((hooks) => hooks.dmHistoryNote?.(message) ?? '')
    .join('')
}

export function characterFromDraft(
  draft: Readonly<Record<string, unknown>>,
  ctx: { baseAppearance: readonly string[] }
): Partial<Character> {
  return Object.assign({}, ...active().map((hooks) => hooks.characterFromDraft?.(draft, ctx) ?? {}))
}

export function afterDmReply(ctx: {
  charId: string
  character: Character
  reply: TextingResponse
}): void {
  for (const hooks of active()) hooks.afterDmReply?.(ctx)
}

export function afterSceneReply(ctx: SceneReplied): void {
  // Called in the middle of a turn, with the autosave and the turn's release still to come: a
  // mod that throws here costs its own reading of the reply and nothing of the scene's.
  for (const hooks of active()) {
    try {
      hooks.afterSceneReply?.(ctx)
    } catch (error) {
      console.warn('[mods] afterSceneReply failed', error)
    }
  }
}

/** Every mod's place on the scene screen, each under its mod's id. */
export function scenePlays(): { modId: string; play: ScenePlay }[] {
  return registered
    .filter((entry) => rules.isOn(entry.modId) && entry.hooks.scenePlay)
    .sort((a, b) => rules.order(a.modId) - rules.order(b.modId))
    .map((entry) => ({ modId: entry.modId, play: entry.hooks.scenePlay as ScenePlay }))
}

/** The clashes over a panel id already warned about, so each is said once. */
const warnedModalClashes = new Set<string>()

/**
 * The panel {@link openPanel} opens under an id: the first mod's that is on and has one, or none.
 * Two mods that are on with a panel under the same id get a warning naming both.
 */
export function gameModal(id: string): ComponentType<GameModalProps> | undefined {
  const owners = activeEntries().filter((entry) => entry.hooks.gameModals?.[id])
  if (owners.length > 1) {
    const [winner, ...others] = owners.map((entry) => entry.modId)
    const clash = `${id}\n${winner}\n${others.join('\n')}`
    if (!warnedModalClashes.has(clash)) {
      warnedModalClashes.add(clash)
      console.warn(
        `[mods] ${winner} and ${others.join(', ')} both have a panel under "${id}"; ${winner}'s opens`,
      )
    }
  }
  return owners[0]?.hooks.gameModals?.[id]
}

/** How {@link openPanel} reaches the game view, while one is up. */
let panelOpener: ((id: string, arg: string | undefined) => void) | null = null

/** Binds {@link openPanel} to the game view as it mounts; the returned function unbinds it. */
export function setPanelOpener(open: (id: string, arg: string | undefined) => void): () => void {
  panelOpener = open
  return () => {
    if (panelOpener === open) panelOpener = null
  }
}

/**
 * Opens a mod's panel ({@link ModHooks.gameModals}) over the game view, in place of whatever panel
 * is open there. `arg` is handed to the panel. False where nothing opens: no game view is up, or
 * no mod that is on has a panel under `id`.
 */
export function openPanel(id: string, arg?: string): boolean {
  if (!panelOpener || !gameModal(id)) return false
  panelOpener(id, arg)
  return true
}

export function afterReachOut(ctx: {
  charId: string
  character: Character
  reply: Readonly<Record<string, unknown>>
}): void {
  for (const hooks of active()) hooks.afterReachOut?.(ctx)
}

export function playerActs(): void {
  for (const hooks of active()) hooks.playerActs?.()
}

export function gameEntered(): void {
  for (const hooks of active()) hooks.gameEntered?.()
}

/** Hands a post to every mod in turn, each seeing what the ones before it did. */
export async function fileFeedPost(
  filing: PostFiling,
  ctx: { nudge: (charId: string) => void }
): Promise<PostFiling> {
  for (const hooks of active()) {
    if (filing.held) break
    await hooks.fileFeedPost?.(filing, ctx)
  }
  return filing
}

/** A post's likes from the first mod that answers, or the game's own roll. */
export function postLikes(ask: LikesAsk, own: () => number): number {
  for (const hooks of active()) {
    const likes = hooks.postLikes?.(ask)
    if (likes !== undefined) return likes
  }
  return own()
}

export function postVisible(post: SocialPost): boolean {
  return active().every((hooks) => hooks.postVisible?.(post) ?? true)
}

/** When a post came out after its slot began, or 0 for one out from the start. */
export function postOutAt(post: SocialPost): number {
  for (const hooks of active()) {
    const at = hooks.postOutAt?.(post)
    if (at !== undefined) return at
  }
  return 0
}

/**
 * Prepares a way on for the screen that offered it. Null where the mod declined, and null too
 * where that screen is gone or its game left by the time the mod is ready (`stillHere` false):
 * a late answer opens nothing.
 */
export async function prepareWayOn(
  choice: WayOn,
  stillHere: () => boolean
): Promise<(() => ViewName) | null> {
  const enter = await choice.prepare()
  return enter && stillHere() ? enter : null
}

/** The ending's way on from the first mod that offers one, or none. */
export function endingChoice(ctx: Parameters<NonNullable<ModHooks['endingChoice']>>[0]): EndingChoice | undefined {
  for (const hooks of active()) {
    const choice = hooks.endingChoice?.(ctx)
    if (choice) return choice
  }
  return undefined
}

/** A mod's own page on the Mods screen, in place of the list of its options, from the first mod that has one. */
export function modDetail(mod: ModDef): ComponentType<ModDetailProps> | undefined {
  for (const hooks of active()) {
    const Detail = hooks.modDetail?.(mod)
    if (Detail) return Detail
  }
  return undefined
}

/** The preview a mod draws under one of its option groups, on or off; none where it has none. */
export function optionPreview(
  modId: string,
  groupId: string
): ComponentType<OptionPreviewProps> | undefined {
  return registered.find((entry) => entry.modId === modId && entry.hooks.optionPreviews?.[groupId])
    ?.hooks.optionPreviews?.[groupId]
}

/** The offer for a picked save from the first mod that makes one, or none. */
export function saveChoice(ctx: Parameters<NonNullable<ModHooks['saveChoice']>>[0]): SaveChoice | undefined {
  for (const hooks of active()) {
    const choice = hooks.saveChoice?.(ctx)
    if (choice) return choice
  }
  return undefined
}

/** Compose request additions in mod-list order, including regenerated DMs. */
export function modRequest<S extends keyof RequestSpots>(spot: S, ctx: RequestSpots[S], request: StructuredRequest): StructuredRequest {
  let next = request
  for (const hooks of active()) {
    const extend = hooks.requests?.[spot] as ((request: StructuredRequest, ctx: RequestSpots[S]) => StructuredRequest) | undefined
    if (extend) next = extend(next, ctx)
  }
  return next
}

export function slotSettled(ctx: SlotSettled): void {
  for (const hooks of active()) hooks.slotSettled?.(ctx)
}

/** Every mod's lines for the slot's closing report, after the girls' memories, in list order. */
export function slotStatusLines(ctx: { nextSlot: number }): SceneLine[] {
  return active().flatMap((hooks) => [...(hooks.slotStatusLines?.(ctx) ?? [])])
}

export function projectSlotMemories(ctx: SlotMemoryProjection, charInfo: Record<string, CharInfo>): Record<string, CharInfo> {
  let projected = charInfo
  for (const hooks of active()) projected = hooks.projectSlotMemories?.(ctx, projected) ?? projected
  return projected
}

/** What the hour exercised as every mod that is on leaves it, in list order; the ledger's own otherwise. */
export function exercisedStats(ledger: LedgerStats | undefined, ctx: StatContext): LedgerStats | undefined {
  let exercised = ledger
  for (const hooks of active()) {
    if (hooks.exercisedStats) exercised = hooks.exercisedStats(exercised, ctx)
  }
  return exercised
}

/** The scene's stats as every mod that is on leaves them, in list order; the game's own otherwise. */
export function settleSceneStats(resolved: SceneStats, settlement: SceneStatSettlement): SceneStats {
  let settled = resolved
  for (const hooks of active()) settled = hooks.settleSceneStats?.(settled, settlement) ?? settled
  return settled
}

/** The lowest a stat may fall to, from the first mod on that answers; undefined for the game's own floor. */
export function statFloor(key: StatKey): number | undefined {
  for (const hooks of active()) {
    const floor = hooks.statFloor?.(key)
    if (floor !== undefined) return floor
  }
  return undefined
}

/** Enabled pages follow native tabs; the first registration of an id wins. */
export function bunnyboardPages(): BunnyboardPage[] {
  const seen = new Set(['chats', 'friends', 'updates', 'profile', 'photos', 'lorebook'])
  return active().flatMap(hooks => {
    const page = hooks.bunnyboardPage
    if (!page || seen.has(page.id)) return []
    seen.add(page.id)
    return [page]
  })
}

/** The pages beside the feed in the Updates tab, one per id, in mod-list order. */
export function updatesTabs(): UpdatesTab[] {
  const seen = new Set(['feed'])
  return active().flatMap(hooks => {
    const tab = hooks.updatesTab
    if (!tab || seen.has(tab.id)) return []
    seen.add(tab.id)
    return [tab]
  })
}

/** The activities on offer for a stat: each from the mod that is on and owns it, and still available. */
export function statActivities(stat: StatKey): SlotActivityOffer[] {
  return activeEntries().flatMap(({ modId, hooks }) =>
    (hooks.statActivities?.(stat) ?? []).filter(offer => offer.owner === modId && offer.stat === stat && hooks.slotActivityAvailable?.(offer)))
}

/** Whether the mod that owns a training activity is on and still offers it. */
export function slotActivityAvailable(offer: SlotActivityOffer): boolean {
  return activeEntries().some(({ modId, hooks }) => modId === offer.owner && hooks.slotActivityAvailable?.(offer) === true)
}

/** The tabs beside Profile on her contact page: one per id, from the mods that are on, in list order. */
export function contactTabs(ctx: { charId: string; isContact: boolean }): { modId: string; tab: ContactTab }[] {
  const seen = new Set(['profile'])
  return activeEntries().flatMap(({ modId, hooks }) => {
    const tab = hooks.contactTab
    if (!tab || seen.has(tab.id) || tab.shown?.(ctx) === false) return []
    seen.add(tab.id)
    return [{ modId, tab }]
  })
}

/** The components drawn at one place on screen: each mod's that is on, in list order, under its id. */
export function screenSlot<S extends ScreenSlot>(
  slot: S
): { modId: string; Component: ComponentType<ScreenSlotProps[S]> }[] {
  return activeEntries().flatMap(({ modId, hooks }) => {
    const Component = hooks[slot] as ComponentType<ScreenSlotProps[S]> | undefined
    return Component ? [{ modId, Component }] : []
  })
}

/** What the game hands a mod's field in the character editor. */
export interface EditorFieldProps {
  /** The field's value as the form holds it, from {@link EditorField.read} until it is changed. */
  value: unknown
  onChange: (value: unknown) => void
  charId: string
  /** Her appearance tags as the form holds them, which a field about her looks may read. */
  baseAppearance: readonly string[]
}

/**
 * A field of a mod's own in the character editor, under Generation settings. `read` takes its
 * value off her as the editor opens, `Field` edits it with the rest of the form, and `write` is what
 * saving puts back on her: its own fields only, since the game's own are written over it; an `ex`
 * it returns adds its slices beside hers and the other mods'. Save
 * and the unsaved-changes check see it as they see the game's fields. A mod that is off draws no
 * field and writes nothing.
 */
export interface EditorField {
  read: (character: Character) => unknown
  write: (value: unknown) => Partial<Character>
  Field: ComponentType<EditorFieldProps>
}

/** The fields of the mods that are on in the character editor, in list order, under each mod's id. */
export function editorFields(): { modId: string; field: EditorField }[] {
  return activeEntries().flatMap(({ modId, hooks }) => (hooks.editorField ? [{ modId, field: hooks.editorField }] : []))
}

/**
 * What the mods' fields put on her as the editor saves: each active field's `write` of its own
 * value, a later one over an earlier, except `ex`, where every write's slices go in beside hers
 * and the other mods', since no field may replace the bag.
 */
export function editorWrites(character: Character, valueOf: (modId: string) => unknown): Partial<Character> {
  const writes = editorFields().map(({ modId, field }) => field.write(valueOf(modId)))
  const merged: Partial<Character> = Object.assign({}, ...writes)
  const carried = writes.filter((write) => write.ex)
  if (carried.length > 0) merged.ex = Object.assign({}, character.ex, ...carried.map((write) => write.ex))
  return merged
}

/** The lines Save Game shows about the scene being saved, one from each mod that has one. */
export function saveNotes(scene: Readonly<ModSceneFields>): string[] {
  return active().flatMap((hooks) => {
    const note = hooks.saveNote?.(scene)
    return note ? [note] : []
  })
}
