import type { ComponentType } from 'react'
import type {
  Character,
  CharInfo,
  ChatMessage,
  SocialPost,
  TextingResponse
} from '@shared/types'
import type { TextingPromptState } from '../prompts/textingPrompt'

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
  /** Her reply in a DM thread. */
  dm: { character: Character; info: CharInfo | undefined; state: TextingPromptState }
  /** The status updates the slot's opening writes, one entry per post. */
  'slot-posts': Record<string, never>
  /** A character being generated. */
  character: Record<string, never>
}

export type PromptSpot = keyof PromptSpots

/** What a mod adds to one prompt: instruction lines, and fields the reply has to fill in. */
export interface PromptAddition<C> {
  lines?: (ctx: C) => readonly string[]
  /** Schema properties: the top level for `dm` and `character`, each post for `slot-posts`. */
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

/** A tab a mod adds to the Bunnyboard's rail, after the game's own. */
export interface BunnyboardTabDef {
  /** Unique within the mod; the rail keys it as `mod:<id>`. */
  id: string
  /** The word under the icon, as the game's own tabs are labelled. */
  word: string
  Mark: ComponentType
  /** What the tab shows when it is open. */
  Page: ComponentType
  /** Drawn on the tab's corner, like an unread count; renders nothing when there is nothing. */
  Badge?: ComponentType
}

/** A post as the feed's row draws it; a mod reads its own fields off it. */
export interface FeedPostRow {
  id?: string
  text: string
  date: number
  time: number
  likes: number
}

/** The places in the game's screens a mod can draw into, and what each is handed. */
export interface ScreenSlots {
  /** After a DM's text, in her thread or his. */
  'dm-message': { message: ChatMessage }
  /** Under a feed post's text, above its like button. */
  'feed-post': { charId?: string; post: FeedPostRow }
  /** Over the whole Bunnyboard, for something a mod opens on top of it. */
  'bunnyboard-overlay': object
}

export type ScreenSlot = keyof ScreenSlots

export interface ModHooks {
  /** Tabs added to the Bunnyboard's rail. */
  bunnyboardTabs?: readonly BunnyboardTabDef[]
  /** What a mod draws into the game's screens. */
  screens?: { [S in ScreenSlot]?: ComponentType<ScreenSlots[S]> }
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
  /** As the reader commits to something: an action sent, or a hangout begun. */
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
  return registered
    .filter((entry) => rules.isOn(entry.modId))
    .sort((a, b) => rules.order(a.modId) - rules.order(b.modId))
    .map((entry) => entry.hooks)
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

/** Every mod's tabs on the Bunnyboard's rail, in list order. */
export function bunnyboardTabs(): BunnyboardTabDef[] {
  return active().flatMap((hooks) => [...(hooks.bunnyboardTabs ?? [])])
}

/** What every mod draws into one slot, in list order. */
export function screenParts<S extends ScreenSlot>(slot: S): ComponentType<ScreenSlots[S]>[] {
  return active().flatMap((hooks) => {
    const part = hooks.screens?.[slot] as ComponentType<ScreenSlots[S]> | undefined
    return part ? [part] : []
  })
}
