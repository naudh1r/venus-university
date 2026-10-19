import type { ComponentType } from 'react'
import type { StructuredRequest, LedgerResponse } from '@shared/types'
import type { PromptState } from '../prompts/scenePrompt'
import type { SlotIntroInput } from '../prompts/slotIntroPrompt'
import type { useGameStore } from '../stores/gameStore'
import type {
  Character,
  CharInfo,
  ChatMessage,
  SocialPost,
  TextingResponse
} from '@shared/types'
import type { GameOverReason } from '@shared/gameOver'
import type { PostComment } from '@shared/postComments'
import type { PlaythroughRecord } from '@shared/types'
import type { TextingPromptState } from '../prompts/textingPrompt'
import type { ResolvedSave } from '../stores/saveStore'
import type { ViewName } from '../stores/uiStore'

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
  /** The girl the slot's opening has texting the reader just to talk, one call per girl. */
  'slot-reach-outs': { character: Character; info: CharInfo; date: number }
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

export interface BunnyboardPage {
  id: string
  word: string
  Mark: ComponentType
  Page: ComponentType
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
  bunnyboardPage?: BunnyboardPage
  /** Draws the comments under a post; see {@link PostCommentsSpot}. */
  postComments?: PostCommentsSpot
  /** Draws a post's picture under its text, wherever a post is drawn; the first mod on decides. */
  postPicture?: ComponentType<PostPictureProps>

  /** Extend a completed request, preserving other mods' additions. */
  requests?: { [S in keyof RequestSpots]?: (request: StructuredRequest, ctx: RequestSpots[S]) => StructuredRequest }
  /** After bookkeeping settles, before the clock advances and the boundary save is written. */
  slotSettled?: (ctx: SlotSettled) => void

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
  /** A way on from the ending, beside the menu; the first mod that answers is offered. */
  endingChoice?: (ctx: {
    reason: GameOverReason
    playthroughId: string | null
  }) => EndingChoice | undefined
  /** An offer for a save picked in Load Game, beside loading it; the first mod that answers. */
  saveChoice?: (ctx: {
    playthroughId: string
    save: ResolvedSave & { record: PlaythroughRecord }
  }) => SaveChoice | undefined
}

interface Registered {
  modId: string
  hooks: ModHooks
}

const registered: Registered[] = []

/** Whether a mod is on, and where `MODS` lists it; the mods store sets both at boot. */
let rules: { isOn: (modId: string) => boolean; order: (modId: string) => number } = {
  isOn: () => true,
  order: () => 0
}

export function setHookRules(next: typeof rules): void {
  rules = next
}

/** A mod's hooks, registered once from its own files. */
export function registerHooks(modId: string, hooks: ModHooks): void {
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

/** Enabled pages follow native tabs; the first registration of an id wins. */
export function bunnyboardPages(): BunnyboardPage[] {
  const seen = new Set(['chats', 'friends', 'updates', 'profile', 'photos'])
  return active().flatMap(hooks => {
    const page = hooks.bunnyboardPage
    if (!page || seen.has(page.id)) return []
    seen.add(page.id)
    return [page]
  })
}
