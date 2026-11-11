import { AnimationDefinition } from 'motion/react';
import type { ComponentType } from 'react';
import { JSX } from 'react';
import { MotionProps } from 'motion/react';
import { MouseEventHandler } from 'react';
import { ReactNode } from 'react';
import { StoreApi } from 'zustand';
import { TargetAndTransition } from 'motion/react';
import { Transition } from 'motion/react';
import { UseBoundStore } from 'zustand';
import { Variants } from 'motion/react';

/** What an intimate act was. */
declare type ActKind = 'kiss' | 'sex';

/** One class added at add/drop — the record that owes him an entrance. */
declare interface AddedClass {
    /** The room has met him once; it never meets him again. */
    announced: boolean;
    /** The `date` he added it, on {@link DroppedClass.date}'s terms. */
    date: number;
}

/** One class the reader added at add/drop and has yet to walk into. */
declare interface AddedNotice {
    code: string;
    name: string;
}

/**
 * Adds a memory of hers, where every prompt, her affection and the memory list read memories,
 * marked as the mod's: it carries the mod's slice, an empty one where it brings none. `replacing`
 * picks which of her memories the mod marked before go in its place; no other memory is asked.
 * `replacingUnmarked` picks, the same way, from memories with no slices, for migrating older saves. These include
 * the game's own memories, so it must match only what the mod wrote before its switch.
 * Refused with `MOD_WRITE_INVALID` for a memory that is not one, `MOD_WRITE_GONE` where she is
 * not in the game, and as a record write is.
 */
export declare function addMemory(modId: string, charId: string, memory: CharMemory, options?: RecordWriteOptions & {
    replacing?: (memory: Readonly<CharMemory>) => boolean;
    replacingUnmarked?: (memory: Readonly<CharMemory>) => boolean;
}): Result<null>;

/**
 * Adds `comments` under her post, after the ones already there, for the mod that draws the
 * feed's comments. Each is a comment's own fields and the mod's slice, under an id no comment of
 * the post has. Refused with `MOD_WRITE_NOT_OWNER` for any other mod, `MOD_WRITE_INVALID` for a
 * comment that is not one, `MOD_WRITE_GONE` where the post is not there, and as a record write is.
 */
export declare function addPostComments(modId: string, post: {
    charId: string;
    postId: string;
}, comments: readonly PostComment[], options?: RecordWriteOptions): Result<null>;

/** Error shape carried inside a failed {@link Result}. Never thrown across the IPC bridge. */
declare interface AppError {
    code: string;
    message: string;
    detail?: string;
}

/** The available backgrounds, split by the folder they were scanned from. */
declare interface BackgroundSets {
    interior: string[];
    exterior: string[];
}

/** A {@link SlotOpening} an ending banked: the three settles it rolled are always on it. */
declare type BankedOpening = SlotOpening & Required<Pick<SlotOpening, 'rumorPass' | 'crushes' | 'npcRelationships'>>;

/** The slot's texting-ledger reply, paid for mid-scene and held until the ending merges it. */
declare interface BankedTextLedger {
    /** The fingerprint the prefetch was keyed on: the slot plus every message id it read. */
    key: string;
    reply: LedgerResponse;
}

/** One entry of a playthrough's lorebook as the prompts read it. */
declare interface BookEntry extends LoreEntry {
    /** The shipped entry's `ref`, or the id of one of the player's. */
    handle: string;
    custom: boolean;
}

/** A text split as the box needs it: each part fits the box, cut between sentences. */
export declare function boxParts(text: string): string[];

declare interface BreakthroughMoment {
    id: string;
    date: number;
    time: TimeSlot;
    /** Actual generated dialogue, never the player's requested outcome. */
    outcome: string;
    transcriptStart?: number;
    transcriptCount?: number;
    /** Actual successful charge. Older outcomes omit this; their price cannot be inferred. */
    spent?: number;
    origin?: TermOrigin;
}

declare interface BreakthroughPending {
    id: string;
    charId: string;
    direction: string;
    date: number;
    time: TimeSlot;
    playthroughId: string;
    /** Optional local Echo integration; omitted for an ordinary Breakthrough. */
    echoAspect?: EchoBreakthroughAspect;
    /** Price actually charged for an Echo activation; absent in older, full-bar saves. */
    spent?: number;
    /** A purchased Borrowed Voice activation uses this present partner's aspect. */
    borrowedFrom?: string;
    talentTerm?: number;
}

declare interface BreakthroughState {
    meters: Record<string, number>;
    settled: Record<string, true>;
    pending: BreakthroughPending | null;
    moments: Record<string, BreakthroughMoment[]>;
}

/** A lover the reader left by starting to date somebody else, and the girl he left her for. */
declare interface BreakupOwed {
    charId: string;
    forCharId: string;
}

/** The build being played, its name and version, as the main menu and the log name it. */
export declare function buildLabel(): string;

export declare interface BunnyboardPage {
    id: string;
    word: string;
    Mark: ComponentType;
    Page: ComponentType;
}

/** The Bunnyboard app's persisted state. */
declare interface BunnyboardState {
    /** Conversations keyed by charId. */
    conversations: Record<string, Conversation>;
    /** charIds the player sent a friend request to, still pending. */
    requestsSent: string[];
    /** charIds who sent the player a friend request, still pending. */
    requestsReceived: string[];
    /** Unseen activity on the Friends tab — incoming requests, mostly. */
    contactsBadge: number;
    /**
     * The charIds the Friends tab offers as people the reader may know, at most three,
     * re-drawn at every slot boundary.
     */
    suggestions?: string[];
}

/**
 * One of BunnyBot's two routes to handing over BunnyMap: a first
 * contact, or a first standing haunt the reader stumbles onto.
 */
declare type BunnybotHandover = 'contact' | 'haunt';

/**
 * Says a mod's lines as BunnyBot once he has introduced himself. An exact message in his saved
 * thread matching `once` keeps them from being said again; include that line among `lines`.
 * Answers whether the lines were delivered. The caller owns its switch and when it asks.
 */
export declare function bunnybotSays(modId: string, lines: readonly string[], options?: {
    once?: string;
}): boolean;

/** The bunny waiting on the curtain: a hop it never lands out of. */
export declare const bunnyHop: Transition;

/**
 * The app's own mark, filled: a chat-bubble body — a pill rounded on the right and at the
 * top-left, squared at the bottom-left like the phone's own bubbles — with two capsule ears
 * standing off its top edge. Carries no size of its own; the caller's box decides.
 */
export declare function BunnyMark(): JSX.Element;

/**
 * One plan on the calendar — a hangout the reader agreed to in a scene or over the Bunnyboard,
 * placed in a future slot by the scheduling classifier.
 */
declare interface CalendarEvent {
    /** crypto.randomUUID(); the stable list key. */
    id: string;
    /** The slot the plan falls in. */
    date: number;
    time: TimeSlot;
    /** A few words — the calendar chip's label. */
    title: string;
    /** One sentence — the detail pane's line. */
    description: string;
    /** Who is going. charKeys that resolve to nobody are dropped. */
    charIds: string[];
    /** The slot the plan was made in — what dates the record. */
    madeOn: {
        date: number;
        time: TimeSlot;
    };
    /**
     * The player has opened the Calendar since this plan was filed; absent means new, which
     * is what the badge counts and the chip highlights.
     */
    seen?: boolean;
    /**
     * Whoever the reader stood up: the attendees not in the scene he spent the slot on instead.
     * Absent until the slot's scene starts.
     */
    noShow?: string[];
}

/**
 * Aborts the mod's calls still out under `group`; the mod's other groups, and the game's, run on.
 * An id no mod can have cancels nothing, so it never reaches another mod's group.
 */
export declare function cancelCalls(modId: string, group: string): Promise<void>;

/** True between ordinary playable scenes, while the reader can start an encounter. */
export declare function canInviteToScene(): boolean;

/** Whether a native scene is accepting an exchange already displayed outside its dialogue box. */
export declare function canRecordSceneTurn(modId?: string): boolean;

/** Local image generation as core gates it, including external ComfyUI and the browser build. */
export declare function canRenderLocalImages(): boolean;

/**
 * One of the three cards: a surface half-pill flat right that scrolls on its own, so no one
 * section can outgrow the page. It carries the real scrollbar (`base.css`), never a drawn one.
 */
export declare function Card({ label, className, children }: {
    label: string;
    className?: string;
    children: ReactNode;
}): JSX.Element;

/**
 * A CG the player put on the stage by hand from the Cast modal, drawn over every sprite until
 * he takes it off; the model is never told about it.
 */
declare interface CgLock {
    charId: string;
    position: Position;
}

/** The act loop a custom CG's main image plays. */
declare type CgSfx = 'sex' | 'foreplay' | 'oral' | 'handjob' | 'none';

/** One CG addressed on its own, as the gallery's per-image control asks for it. */
declare type CgTarget = `cg:${Position}`;

/** The breath a custom CG's main image plays. */
declare type CgVoice = 'fast' | 'slow' | 'none';

declare type ChallengeFloor = -15 | -30 | -60 | -80 | -100;

declare type ChallengeStatTier = -4 | -3 | -2 | -1;

/** On-disk character definition — `/data/characters/{charId}/character.json`. */
declare interface Character {
    schemaVersion: 3;
    /**
     * What mods keep with this character, keyed by the mod's id. Core never reads inside a slice and
     * writes each one back as read; every value is plain JSON.
     */
    ex?: Record<string, ModSlice>;
    /** crypto.randomUUID(); also the folder name under /data/characters. */
    charId: string;
    firstName: string;
    lastName: string;
    /** One woven prose profile: presentation, true self, desire, flaw, quirks. */
    personality: string;
    behavior: CharacterBehavior;
    /** One formative thing in her past and how it still moves her. */
    backstory: string;
    /** Her love life, in four fields. */
    datingHistory: string;
    datingPreference: string;
    kinks: string;
    isVirgin: boolean;
    /**
     * What she is drawn to and what puts her off — her tastes in food, drink, media and how she
     * spends her time, and the things that get under her skin.
     */
    likes: string[];
    dislikes: string[];
    /**
     * Which gift categories please her and which do not, weighed against an item's own
     * tags by `giftReactionOf` (`shared/shop.ts`).
     */
    giftPreferences: GiftPreferences;
    /**
     * The mechanic switches the character-generation call assigned her, from the closed set in
     * `shared/traits.ts`; the Edit modal can amend them from the same vocabulary.
     */
    traits: CharacterTrait[];
    /**
     * Which of the reader's three stats she is drawn to, weighed by the crush roll in
     * `shared/relationship.ts`.
     */
    preferredStat: StatKey;
    /**
     * How tall she stands on the stage, as a share of full size in [0.9, 1.05]
     * (`shared/spriteScale.ts`).
     */
    height: number;
    /**
     * Her speaking voice as a multiplier in [-1, 1] on the pitch range of every loop pitched
     * to her (`shared/audio.ts`). Absent is centre: the loop as recorded.
     */
    voicePitch?: number;
    /** Fixed seed used for every ComfyUI job for this character. */
    generationSeed: number;
    /**
     * Per optional set: does its next render use `generationSeed`, or a fresh one? A set with
     * no flag here follows the main seed, as a set nobody has rendered yet does.
     */
    seedFollowsMain: Partial<Record<SeededSet, boolean>>;
    /**
     * The seed each optional set last rendered under, read when filling the gaps in a
     * partially-rendered set so every sprite of it shares one seed.
     */
    setSeeds: Partial<Record<SeededSet, number>>;
    /** Booru-style appearance tags, steered by the Appendix A lists. */
    baseAppearance: string[];
    /** String that matches pose.json keys. */
    pose: string;
    /** Booru-style outfit tags, steered by the Appendix A lists. */
    outfit: string[];
    /** The PE and swimsuit wardrobes, as booru-style outfit tags. */
    peOutfit: string[];
    swimOutfit: string[];
    /** The wardrobes the player wrote himself; omitted entirely where he wrote none. */
    customOutfits?: Partial<Record<CustomOutfitSlot, CustomOutfit>>;
    /** The CG pairs the player wrote himself; omitted entirely where he wrote none. */
    customCgs?: Partial<Record<CustomCgSlot, CustomCg>>;
    /** String arrays of booru-style expression tags keyed by emotion. */
    expressionTags: Record<Emotion, string[]>;
    /**
     * Player-authored booru tags appended to the negative of every ComfyUI render for this
     * character — sprites, wardrobes and CGs alike.
     */
    negativeTags?: string[];
    /** Her own LoRA; omitted where she has none. */
    lora?: CharacterLora;
    /**
     * Every group each regenerate button last sent, whole, keyed by what it renders; the modal
     * reopens on it. Omitted where no button has sent any.
     */
    regenTags?: Partial<Record<RegenTarget, KeptEdit>>;
    /**
     * The LLM-written continuation of `ROOM_PROMPT_PREFIX` (shared/room.ts): her dorm room,
     * described for the cloud image model.
     */
    roomPrompt: string;
    /**
     * Where her portrait is cut from her neutral sprite, when the player has framed one himself;
     * absent, or stamped with a seed she no longer renders under, means the frame
     * `defaultProfileCrop` derives from her face.
     */
    profileCrop?: ProfileCrop;
    /**
     * The brief she was written from, present only while `pose` is empty: what a write that
     * failed or was interrupted is rerun from. The filled record drops it.
     */
    brief?: CharacterBrief;
    /**
     * Epoch ms of the last write of this file, stamped by main and never by the renderer;
     * absent on the shipped cast and on files written before the field, which read as oldest.
     */
    updatedAt?: number;
}

/** Her loaded definition, or undefined without a game or that character. @since 0.8.0 */
export declare const character: (id: string) => Readonly<Character> | undefined;

/** Native traits only. Use generatedCharacterTraits() for a request, not this constant. */
declare const CHARACTER_TRAITS: readonly ['Mood-swings', 'Disagreeable', 'Good-natured', 'Materialist', 'Terminally Online', 'Promiscuous', 'High Standards'];

/**
 * How a character behaves at each stage of a relationship: third-person prose naming her
 * and the stage, injected into prompts verbatim.
 */
declare interface CharacterBehavior {
    withStrangers: string;
    withFriends: string;
    withCrush: string;
    withLover: string;
    withEnemy: string;
}

/** What the New Character modal was told, kept on her record until her sheet lands. */
declare interface CharacterBrief {
    prompt: string;
    namesAreSuggestions: boolean;
    options: GenerateOptions;
    /** True when a reference picture sits beside the record as `reference`. */
    reference: boolean;
    /** Her LoRA and the tags that came with it; omitted where none was picked. */
    lora?: CharacterLoraBrief;
}

declare interface CharacterDynamic {
    growth?: GrowthTag;
    relationship?: {
        kind: string;
        reason: string;
    };
    traits: string[];
}

declare interface CharacterDynamics {
    version: 1;
    characters: Record<string, CharacterDynamic>;
}

/** Her current game state, detached from the game's record. @since 0.8.0 */
export declare const characterInfo: (id: string) => Readonly<CharInfo> | undefined;

/**
 * Her own LoRA, drawn through every ComfyUI render of her after the style LoRA: the file as
 * the server lists it, and the weight, absent at `DEFAULT_LORA_WEIGHT`.
 */
declare interface CharacterLora {
    name: string;
    weight?: number;
}

/** What the New Character modal said about her LoRA, kept in her brief until her sheet lands. */
declare interface CharacterLoraBrief extends CharacterLora {
    /** The LoRA's trigger word, put first in her appearance; empty where it has none. */
    trigger: string;
    appearance: string[];
    outfit: string[];
    /** Whether a group the player filled stands in for the LLM's rather than joining it. */
    replace: boolean;
}

/** Saved strings are open: a character must survive a missing trait provider. */
declare type CharacterTrait = NativeCharacterTrait | (string & {});

/** Relationship milestones tracked per character — never affection, which is derived. */
declare interface CharFlags {
    /** Has shared a scene with the reader. Set for the whole cast at scene end. */
    hasMet: boolean;
    /** Unspoken feelings. Rolled at the ending, cleared below 0 and by `became_lovers`. */
    hasCrush: boolean;
    /** The reader friendzoned her. */
    friendZoned: boolean;
    /** She friendzoned the reader. */
    friendZonedBy: boolean;
    isLover: boolean;
    /** How many times the two have broken up. */
    brokenUp: number;
    hasKissed: boolean;
    hadSex: boolean;
    /** Sleeping together without being lovers. Cleared on `isLover` or at `hostile`. */
    benefits: boolean;
    /** She agreed to share the reader with other girls and won't be jealous of them. */
    harem: boolean;
    /**
     * She shared her contact info with the reader — a number, an email, a Bunnyboard handle, any
     * of it.
     */
    gaveContactInfo: boolean;
    /** She has the reader blocked on Bunnyboard. */
    blocked: boolean;
    /**
     * The three contact-profile reveals: her traits at `friendly`, her backstory at
     * `trusted`, her love life blurb once they are lovers.
     */
    knowsTraits: boolean;
    knowsBackstory: boolean;
    knowsLoveLife: boolean;
}

/**
 * Everything the game knows about one character in play: the record's half and the save's,
 * joined by `loadSave` and split again by `toGameSave`.
 */
declare type CharInfo = CharState & CharProfile;

/** A character's standing part-time job. */
declare interface CharJob {
    /** The employer, by `JobDef.id` from `shared/jobs.ts`' catalog. */
    jobId: string;
    /** Her weekly {@link ShiftSlot}s, sorted. One or two; an empty job is not stored. */
    shifts: ShiftSlot[];
    /** The `date` the job starts existing. */
    startsOn?: number;
    /**
     * She has not told the reader about it yet — one prompt injection, consumed by the first
     * scene they share once the job exists.
     */
    newJobNotice?: boolean;
}

/** A single remembered event, rendered as `"<Name> <type> that <desc>"`. */
declare interface CharMemory {
    /** Echo v1 compatibility: a matching bond amplified this positive memory. */
    echoBoosted?: boolean;
    /** Echo: affinity at the time this positive memory was earned. */
    echoAffinity?: 'matching' | 'competing';
    /**
     * What mods keep with this memory, keyed by the mod's id. Core never reads inside a slice and
     * writes each one back as read; every value is plain JSON.
     */
    ex?: Record<string, ModSlice>;
    /** Game date (days elapsed) it happened. */
    date: number;
    type: MemoryType;
    desc: string;
    /**
     * The days of the breaks between semesters it was carried across, which its age does not
     * count; absent on a memory of the semester it was made in.
     */
    breakDays?: number;
}

/**
 * The half of a character's entry New Game settles and nothing afterwards rewrites — held in
 * the playthrough record rather than in every save.
 */
declare interface CharProfile extends CharSchedule {
    /**
     * Where she habitually is in the slots nothing is asked of her, and what for: a sparse map of
     * {@link ShiftSlot} to a {@link Haunt}.
     */
    hiddenSchedule?: Record<number, Haunt>;
    /**
     * Where she starts in the thirty-day mood cycle (`prompts/moods.ts`), rolled at New Game as
     * one draw from a shuffled permutation so no two of the roster share a day.
     */
    moodCycleOffset?: number;
    /**
     * Her social handle, the name her feed posts carry. Written by the profile call
     * at New Game and never changed.
     */
    handle?: string;
    /** What she does with spring break, one short phrase. */
    springBreakPlans?: string;
    /**
     * The season she arrived in, which decides when her year goes up; absent in the first
     * semester, where a freshman arrived in the spring and anybody older in a fall.
     */
    intake?: Season;
    /** What she is doing since she graduated, one short phrase; present exactly on a graduate. */
    pursuing?: string;
}

/** Everything one character gains in her `CharInfo` from the timetable scheduler. */
declare interface CharSchedule {
    year: number;
    dorm: DormId;
    major: string;
    schedule: Record<number, string>;
}

/** A secret she has not told the reader yet, and the tier she tells it at. */
declare interface CharSecret {
    /** One or two sentences in the third person, naming her. */
    text: string;
    tier: SecretTier;
    /** She has stood in {@link tier} since the secret was written; never taken back. */
    reached?: true;
}

/** The half a playthrough accumulates — what every save file carries about her. */
declare interface CharState {
    memories: CharMemory[];
    flags: CharFlags;
    /**
     * The reader has learned her name — set the first time a scene line says it out loud;
     * until then the dialogue box calls her `???`. Distinct from `flags.hasMet`.
     */
    nameKnown: boolean;
    /**
     * Her part-time job, if she holds one. On the save rather than the profile because
     * `newJobNotice` is spent at the boundary that announces it.
     */
    job?: CharJob;
    /**
     * The slots of the week the reader has run into her on the map, from her hidden schedule:
     * {@link ShiftSlot}s, ascending, recorded at the boundary of every scene she was cast in.
     */
    metSlots?: ShiftSlot[];
    /**
     * The reader spent the slot on something else rather than answering her Bunnyboard hangout
     * invitation.
     */
    ignoredInvitation?: boolean;
    /** Every gift she has been given, by `ItemDef.id`, oldest first. */
    gifts?: string[];
    /**
     * What she took away from texting the reader, from the ledger's `textMemories`. At
     * most one, and the newest wins.
     */
    textMemory?: CharMemory;
    /** What she suspects about the reader and another girl, one record per subject. */
    suspicions?: Suspicion[];
    /** The game date they last became lovers; kept after a breakup for the exes line. */
    datingSince?: number;
    /**
     * The game date dating last ended, present only from a breakup until they get back
     * together; what the exes line counts to.
     */
    brokeUpOn?: number;
    /**
     * The girl he started dating the day this relationship ended, when that is what ended it;
     * present from that breakup until they get back together.
     */
    leftFor?: string;
    /** What she found out for certain about the reader and somebody else; never expires. */
    jealousyMemories?: CharMemory[];
    /**
     * The presents she kept a warm memory of, oldest first — `loved` and `liked`
     * handovers only.
     */
    giftMemories?: CharMemory[];
    /**
     * The last thing the status lines told the player about her standards; absent
     * means nothing has been said.
     */
    crushHint?: CrushHint;
    /**
     * Scenes she has shared with the reader since her crush began or they became lovers; absent
     * once that has settled, or while she holds neither.
     */
    romanceScenes?: number;
    /**
     * The upper halves of her tiers she has been in, each `again` once she has since been out of
     * it, above or below; read off her affection at every boundary.
     */
    upperHalves?: Partial<Record<UpperHalf, 'first' | 'again'>>;
    /**
     * The affection a later semester's start took off her, one tier's worth; halved by the first
     * scene she is cast in that semester and gone after the second.
     */
    breakPenalty?: {
        points: number;
        halved?: true;
    };
    /**
     * Everything she has ever posted, oldest first: her winter-break posts, then the
     * per-slot roll's. Absent for a girl whose break was somewhere else — and on the save rather
     * than the profile, since a like rewrites a post.
     */
    feed?: SocialPost[];
    /**
     * The alternate wardrobes a scene has actually shown her in, first-seen order; absent
     * until one has been. It is what her contact page's outfit switcher offers, so it records
     * the sprite reference as *applied* — a set withheld by `noNsfwImages` was never seen.
     */
    seenOutfits?: OutfitSet[];
    /**
     * The player's own notes on her, written from her contact page and closing her entry in every
     * prompt that describes her in full; absent when there are none.
     */
    notes?: string;
    /**
     * The secrets she has yet to tell the reader, in the order they were written; absent before
     * any were written and once every one has been told.
     */
    secrets?: CharSecret[];
    /** The secrets she has told the reader, oldest first; absent until she has told one. */
    toldSecrets?: string[];
    /**
     * The last cold she caught this semester, kept once it is over until another replaces it;
     * absent before she has caught one.
     */
    cold?: ColdCase;
    /** Every strain she has caught this semester, by its id, ascending; absent before any. */
    coldsHad?: number[];
}

/** One Bunnyboard text message. */
declare interface ChatMessage {
    /** Optional response grouping retained by the Text Regeneration mod. */
    exReplyTo?: string;
    /**
     * What mods keep with this message, keyed by the mod's id. Core never reads inside a slice and
     * writes each one back as read; every value is plain JSON.
     */
    ex?: Record<string, ModSlice>;
    /** crypto.randomUUID(); the stable list key. */
    id: string;
    sender: ChatSender;
    text: string;
    /** Game date (days elapsed) it was sent. */
    date: number;
    time: TimeSlot;
    /**
     * A system line reporting a failed reply. Marked so the texting summary can
     * see whether the conversation currently ends on a delivery failure.
     */
    error?: boolean;
    /** Her asking him out: the message every ask-out cooldown is counted off. */
    invite?: true;
    /** The first text of hers reaching out just to talk: what every reach-out wait is counted off. */
    reachOut?: true;
    /** The everyday ask her invitation was rolled into: what the round of them is read off. */
    everydayAsk?: EverydayAsk;
    /** What her invitation was rolled into asking: what a hangout answering it is read off. */
    inviteKind?: InviteKind;
}

/** Who a Bunnyboard chat message is from. `system` lines are app-written. */
declare type ChatSender = 'player' | 'contact' | 'system';

/**
 * The rounded-square checkbox, label and all — the whole row is the hit target. The input itself
 * stays the control the browser focuses and the keyboard toggles; the box the player sees is
 * drawn beside it in CSS, since a native checkbox cannot take the accent fill the design asks for.
 */
export declare function CheckField({ id, label, meta, note, checked, onChange, disabled }: CheckFieldProps): JSX.Element;

export declare interface CheckFieldProps {
    id: string;
    label: string;
    /** What the box costs, said in mono beside the label — a render count. */
    meta?: string;
    /** What turning it on costs, in prose under the label rather than as an aside beside it. */
    note?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}

/**
 * The forward mark on a button that goes somewhere, with `back` the way it came and `down` the
 * list a pill opens under itself. A button never carries a typographic arrow: the half-pill
 * already points where it is going.
 */
export declare function ChevronIcon({ back, down }?: {
    back?: boolean;
    down?: boolean;
}): JSX.Element;

/** The range each class pool size is kept to, both ends included. */
declare const CLASS_CATALOG_RANGES: {
    readonly pe: {
        readonly min: 1;
        readonly max: 20;
    };
    readonly filler: {
        readonly min: 0;
        readonly max: 15;
    };
    readonly perMajor: {
        readonly min: 1;
        readonly max: 8;
    };
};

/** Pool sizes for the class call; an absent one is its shipped size. */
declare type ClassCatalogEdits = Partial<Record<ClassCatalogKey, number>>;

declare type ClassCatalogKey = keyof typeof CLASS_CATALOG_RANGES;

/** Which pool a class was generated for; drives the greedy scheduler. */
declare type ClassCategory = 'pe' | 'humanities' | 'arts' | 'major' | 'interest' | 'misc';

/** How hard a course is, rolled locally at generation time. */
declare type ClassDifficulty = 'easy' | 'medium' | 'hard';

/** One course, generated once per save. Keyed by `code` in {@link GameSave.classes}. */
declare type ClassEntry = PeClassEntry | CourseEntry;

/** What every class carries, PE included. */
declare interface ClassEntryBase {
    /** Registrar-style code, e.g. `"BIO 210"`. Unique across the save; the class ID. */
    code: string;
    name: string;
    /** One-sentence catalog blurb. */
    description: string;
    /** The major this class belongs to; set only for `category: 'major'`. */
    major?: string;
    slot: ClassSlot;
}

/**
 * The academic vocabulary: what kind of class a course is, who teaches it, how hard it
 * is, and every number and sentence that comes out of an exam or a project.
 */
/** What a non-PE course is. PE classes have no kind and sit out all of this. */
declare type ClassKind = 'lecture' | 'project';

/** One roster girl sitting in a class, as the prompts name her. */
declare interface Classmate {
    charId: string;
    firstName: string;
}

/**
 * Builds scene, continuation, and closing prompt requests.
 * Keeps cacheable prompt parts first and schema `lines` before `summary`.
 */
/** One past meeting of this course, as the recap prints it. */
declare interface ClassMeetingRecap {
    /** 1-based meeting index — "week 3 of this class", counting meetings actually held. */
    week: number;
    attended: boolean;
    summary?: string;
    /** The exam-worthy fact that meeting left behind — lecture classes only, absent on a skipped or syllabus week. */
    factoid?: string;
    /** The professor called that meeting off at the last second. */
    cancelled?: boolean;
}

/** One meeting of one class, as the reader lived it. */
declare interface ClassMeetingRecord {
    /** The `date` the meeting fell on. Unique within a {@link ClassRecord}. */
    date: number;
    /** The reader spent the slot in this class. */
    attended: boolean;
    /** What happened, from the ledger's `classSummary`. Absent for a class he skipped. */
    summary?: string;
    /** The one thing he learned, from the ledger's `classFactoid`. Lecture classes only, week 2 onward. */
    factoid?: string;
    /** The professor called it off at the last second: attended, and nothing was taught. */
    cancelled?: true;
}

/**
 * Everything one class accumulated over the semester. Keyed by class code in {@link
 * GameSave.classRecords}, and written only for classes the reader is enrolled in.
 */
declare interface ClassRecord {
    /** Every meeting, ascending by date. */
    meetings: ClassMeetingRecord[];
    midterm?: ExamRecord;
    final?: ExamRecord;
    midtermProject?: ProjectRecord;
    finalProject?: ProjectRecord;
    /** 0–100, whole percent. */
    midtermScore?: number;
    finalScore?: number;
    /** The Heart tier the reader presented a showcase at, frozen with the score it bought. */
    midtermHeartTier?: StatTier;
    finalHeartTier?: StatTier;
}

/**
 * Who sits in one class, each list sorted by first name: every roster girl enrolled, and those
 * the reader knows are there.
 */
declare interface ClassRoster {
    enrolled: readonly Classmate[];
    known: readonly Classmate[];
}

/**
 * Where a course stands at the meeting this scene is sitting in. Resolved by the loop
 * against the occasion calendar and `classRecords`; the prompt layer only formats it.
 */
declare interface ClassSceneContext {
    /** Which meeting of the course this is, 1-based. */
    index: number;
    /** Null for PE, which has no exams, no project and no week-by-week arc. */
    kind: ClassKind | null;
    /** Today's meeting is the course's midterm, or its final. */
    isMidterm: boolean;
    isFinals: boolean;
    /** Today is the first meeting after the midterm: results are handed back. */
    isHandback: boolean;
    /** Everything that happened in this course before today, oldest first. */
    recap: readonly ClassMeetingRecap[];
    /** Project classes only: how the current project stands. */
    project?: {
        progress: ProjectProgress;
        worked: number;
        needed: number;
        /** He has already spent a slot on it since the last meeting. */
        workedThisWeek: boolean;
    };
    /** The score being handed back today, when one is. */
    handbackScore?: number;
    /** The professor cancels today's meeting at the last second: nothing is taught. */
    cancelled?: boolean;
}

/**
 * A weekly class meeting slot: `weekday * 2 + time`, where weekday 0 = Monday.
 * 0 = M/Day through 9 = F/Night; see `shared/classes.ts`.
 */
declare type ClassSlot = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** The game date, half-day and season; undefined without a playthrough. @since 0.8.0 */
export declare const clock: () => Readonly<{
    date: number;
    time: TimeSlot;
    season: Season;
}> | undefined;

export declare function CloseIcon(): JSX.Element;

/**
 * One cold somebody caught: its strain, the slot it was passed on in, and what the dice and the
 * medicine made of it. Its stage at any slot is derived from these, never stored.
 */
declare interface ColdCase {
    /** The global slot the strain reached campus in: its id, and what immunity is kept against. */
    strain: number;
    /** The global slot it was passed on in; it incubates from the slot after. */
    since: number;
    /** How many slots it incubates, unseen. */
    incubation: number;
    /** A mild cold, which never reaches the worst of it. */
    mild?: true;
    /** The global slots a dose was taken in, ascending: each ends the stage it falls in. */
    doseSlots?: number[];
    /** Caught off the reader while he was sick, so she has a fair idea where it came from. */
    fromReader?: true;
    /** His boss has texted him about this one; the reader's own case only. */
    bossTold?: true;
}

/** What one finished slot passed on: every cold caught in it, assigned at its boundary. */
declare interface ColdPass {
    /** Each girl who caught one, by charId. */
    caught: Record<string, ColdCase>;
    /** The reader's, when he caught one. */
    reader?: ColdCase;
}

/** The slot-opening narration prompt. */
/** What a character has to be at in a slot — her class or her shift — named as a prompt says it. */
declare type Commitment = {
    kind: 'class';
    name: string;
} | {
    kind: 'shift';
    employer: string;
};

/**
 * Sends a mod's own structured request, as the game sends its own: the player's model, key and
 * settings, the schema enforced by the provider. The reply comes back parsed, not checked, so the
 * mod reads it as `T` at its own risk. Under a `group`, {@link cancelCalls} with the same group
 * aborts it, and it resolves `CANCELLED`. Never throws; a failure is the `Result`'s error.
 */
export declare function completeStructured<T>(modId: string, request: StructuredRequest, options?: {
    group?: string;
}): Promise<Result<T>>;

/**
 * Yes/no gate in front of a destructive action, e.g. deleting a character. Wears the A4
 * frame (`vu_styles/Dialog.css`), which it shares with the error modal.
 */
export declare function ConfirmModal({ id, theme, title, message, aside, confirmText, cancelText, busy, busyText, lockOut, enterConfirms, extraText, onExtra, extraDisabled, extraFirst, confirmDisabled, onConfirm, onCancel, onDismiss }: ConfirmModalProps): JSX.Element | null;

export declare interface ConfirmModalProps {
    id: string;
    /** Drawn by the screen that raised this — a portal inherits neither palette nor state rules. */
    theme: 'day' | 'night';
    title: string;
    /** The prose; a list of strings is one paragraph apiece. */
    message: ReactNode | readonly string[];
    /** Drawn under the message, inside the frame and above the foot — a checkbox the answer carries. */
    aside?: ReactNode;
    confirmText?: string;
    /** Label for the dismiss button. */
    cancelText?: string;
    /** Locks every button while the confirmed action is still running. */
    busy?: boolean;
    /** Replaces `confirmText` while `busy`. */
    busyText?: string;
    /** Makes an overlay click do nothing, so the only ways out are the buttons. */
    lockOut?: boolean;
    /** Lets Enter and Space give the confirm, for one the player is already answering by key. */
    enterConfirms?: boolean;
    /**
     * A third answer beside confirm and cancel. Both `extraText` and `onExtra`
     * are needed for the button to appear.
     */
    extraText?: string;
    onExtra?: () => void;
    /** Locks the third answer alone, where what it offers is not there to give. */
    extraDisabled?: boolean;
    /** Stands the third answer before the dismiss button rather than after it. */
    extraFirst?: boolean;
    /** Locks the confirm alone, while what it would do is not ready to be done. */
    confirmDisabled?: boolean;
    onConfirm: () => void;
    /**
     * Omitted for a modal with only one way out: the dismiss button is then
     * hidden and closing the modal runs `onConfirm`.
     */
    onCancel?: () => void;
    /**
     * What Escape and a click on the dimming run. Defaults to `onCancel`, then
     * `onConfirm` — pass it only when the quiet button's own action isn't the
     * right thing for those to do.
     */
    onDismiss?: () => void;
}

/**
 * A reading of her of a mod's own on her contact page: a tab named `label` beside Profile, and
 * `Panel` drawn in place of her profile cards while it is the one being read. `shown` says whether
 * the tab stands on her page at all; it is asked on every render, so it may read the store.
 */
export declare interface ContactTab {
    id: string;
    label: string;
    Panel: ComponentType<ContactTabProps>;
    shown?: (ctx: {
        charId: string;
        isContact: boolean;
    }) => boolean;
}

/** What the game hands a mod's tab on her contact page. */
export declare interface ContactTabProps {
    charId: string;
    /** He has her number: her page is open, not a stranger's. */
    isContact: boolean;
    theme: ScreenTheme;
}

/** One Bunnyboard conversation with a contact, keyed by her charId. */
declare interface Conversation {
    /** Summary before the last generated reply; retained while its mod is disabled. */
    exTextBase?: {
        replyTo: string;
        summary: string | null;
        regenerable?: boolean;
    };
    charId: string;
    /**
     * What mods keep with this conversation, keyed by the mod's id. Core never reads inside a slice and
     * writes each one back as read; every value is plain JSON.
     */
    ex?: Record<string, ModSlice>;
    messages: ChatMessage[];
    /** Messages the player has not opened the conversation to see. */
    unread: number;
    /** Rolling recap of the texting so far — prior summary + recent messages, merged. */
    summary: string | null;
    /**
     * Her unanswered ask-out; judged at the next slot boundary if still up. `occasionId` is the
     * occasion she asked him to, when she asked him to one, so a decline is filed against it.
     */
    pendingHangout?: {
        description: string;
        dismissed?: boolean;
        occasionId?: string;
    };
    /** Invitations of hers he has not accepted in a row; absent at none. */
    declined?: number;
    /** A lover he turned down by text, whose memory of it is still owed. */
    turnedDown?: true;
}

/** One thread as the loaded game holds it, including its messages. @since 0.8.0 */
export declare const conversation: (id: string) => Readonly<Conversation> | undefined;

/** Every other course, decorated at generation time. */
declare interface CourseEntry extends ClassEntryBase {
    category: Exclude<ClassCategory, 'pe'>;
    /** Lecture or project, classified by the model at generation time. */
    kind: ClassKind;
    /** How hard the class is, rolled locally at generation time. */
    difficulty: ClassDifficulty;
    /** Who teaches it, rolled locally. Said by `fullDescriptionOf`, never stored. */
    professor: Professor;
}

/** A scene from the Scene Creator, played outside any playthrough. */
declare interface CreatedScene {
    setup: SceneSetup;
    /** The saved scene a replay was loaded from, and its lines as they were read off disk. */
    replay?: {
        id: string;
        transcript: readonly SceneLine[];
    };
    /** Its last line has been turned: the screen is the save question's, then the creator's. */
    over?: true;
}

/** What a created scene projects onto the store; everything else stands at a blank game's. */
declare type CreatedSceneFields = Pick<GameStoreState, 'date' | 'time' | 'chars' | 'playerFirstName' | 'playerLastName' | 'stats' | 'bio' | 'charInfo' | 'npcRelationships' | 'weather' | 'inventory' | 'bunnyshopUnlocked'>;

/**
 * What the scene-end status lines have already said about one girl's crush standards: the stat
 * he was told to raise and the tier it stood at, or that he has cleared her bar.
 */
declare type CrushHint = {
    stat: StatKey;
    tier: StatTier;
} | {
    met: true;
};

/** The current run's identity, captured before a continuation's first `await`. */
export declare function currentRun(): object;

/** One player-authored CG pair: the booru tags both images render from, under the name he gave it. */
declare interface CustomCg {
    /** What the player called it; omitted where he left the field blank. */
    name?: string;
    /** Booru-style position tags, the group both images render from. */
    tags: string[];
    /** When the writer should use it, as a clause from "she" ("she is riding him"); omitted where blank. */
    instructions?: string;
    /** The breath its main image plays; omitted means `fast`. */
    voice?: CgVoice;
    /** The act loop its main image plays; omitted means `sex`. */
    sfx?: CgSfx;
    /** The position LoRA both images are drawn through after hers; omitted where it has none. */
    lora?: CharacterLora;
}

/**
 * A slot a player-authored CG pair occupies, each a main CG and its `_after`: `customcg` and
 * the slot's number, counted from one with no top.
 */
declare type CustomCgSlot = `customcg${number}`;

/** One player-authored wardrobe: the booru tags it renders from, under the name he gave it. */
declare interface CustomOutfit {
    /** What the player called it; omitted where he left the field blank. */
    name?: string;
    /** Booru-style outfit tags, as the stock wardrobes hold them. */
    tags: string[];
    /** When the writer should put her in it, completing "Use the <name> outfit when"; omitted where blank. */
    instructions?: string;
}

/**
 * A slot a player-authored wardrobe occupies, each with its own tags and name: `custom` and the
 * slot's number, counted from one with no top.
 */
declare type CustomOutfitSlot = `custom${number}`;

/** Replacement entries for the girls the pass changed, and the lovers it left. */
declare interface DatingPassOutcome {
    charInfo: Record<string, CharInfo>;
    /** The girls he left and who he left them for — the next opening writes their texts. */
    breakups: {
        charId: string;
        forCharId: string;
    }[];
}

/** A stack of buttons deals itself out, one after another. */
export declare const dealt: (startDelay: number, each?: number) => Variants;

/**
 * The text a block resets to under the current settings: the content setting picks
 * between a persona's variants, and the cast scene's persona resets to the player's own where
 * one is set.
 */
export declare function defaultBlockText(id: TextBlockId, settings: {
    lessNsfwText: boolean;
    scenePersona?: string;
}): string;

/** How a character feels about the reader right now — an affection tier. */
declare type Disposition = 'devoted' | 'trusted' | 'friendly' | 'neutral' | 'annoyed' | 'hostile';

/** Which state word the divider says. */
export declare type DividerWord = 'hover' | 'locked' | 'unavailable' | 'ending';

/** Every dorm id the profile call may assign, sorted for a stable schema enum. */
declare const DORM_IDS: readonly ['elysium', 'lowrise_1', 'lowrise_2', 'lowrise_3', 'lowrise_4', 'lowrise_5'];

declare type DormId = (typeof DORM_IDS)[number];

/** Spends feed faces independently, so keeping an old handle does not spend a new one. */
export declare function drawFeedEmoji(count: number): string[];

/** Spends feed handles from the game's persistent bag, using each entry's native key. */
export declare function drawFeedHandles(count: number): string[];

/** One dropped class — the record that makes the drop permanent. */
declare interface DroppedClass {
    /** The former classmates have been told once; they are never told again. */
    announced: boolean;
    /** The `date` he dropped it, which is what the notice waits on. */
    date: number;
}

/** One class the reader dropped and his former classmates have yet to hear about. */
declare interface DroppedNotice {
    code: string;
    name: string;
    /** When the class meets, spelled out — the hour she sat through without him. */
    day: string;
}

/**
 * Takes a mod's transient lines back off the scene: off the transcript, the log and the queue,
 * wherever they have got to. Every other mod's lines, and the scene's own, stay. A box showing
 * one of them lands at once on the last line kept.
 */
export declare function dropTransientLines(modId: string): void;

declare interface DungeonLine {
    who: 'reader' | 'reflection' | 'girl' | 'narrator';
    text: string;
}

/** Original symbolic aspects. Oppositions describe competing priorities, not good and evil. */
declare const ECHO_ASPECTS: readonly [{
    readonly id: 'horizonbound';
    readonly name: 'Horizonbound';
    readonly meaning: 'Curiosity, freedom, and undiscovered possibilities';
    readonly opposite: 'stoneward';
    readonly words: 'curious adventurous adventure explore travel freedom spontaneous wander discover independent';
    readonly color: '#e8b88b';
}, {
    readonly id: 'stoneward';
    readonly name: 'Stoneward';
    readonly meaning: 'Responsibility, structure, and steadfast protection';
    readonly opposite: 'horizonbound';
    readonly words: 'responsible structure disciplined discipline organized order dependable dutiful duty protect leader';
    readonly color: '#efa284';
}, {
    readonly id: 'sparkweaver';
    readonly name: 'Sparkweaver';
    readonly meaning: 'Inventiveness and making the impossible tangible';
    readonly opposite: 'lorekeeper';
    readonly words: 'invent creative innovative engineer science technology experiment ingenious curious design';
    readonly color: '#c89fff';
}, {
    readonly id: 'lorekeeper';
    readonly name: 'Lorekeeper';
    readonly meaning: 'Inherited wisdom and the value of proven paths';
    readonly opposite: 'sparkweaver';
    readonly words: 'tradition traditional history mentor teach knowledge scholar study heritage wisdom ritual';
    readonly color: '#d8bd85';
}, {
    readonly id: 'veilkeeper';
    readonly name: 'Veilkeeper';
    readonly meaning: 'Discretion, intuition, and a carefully guarded inner world';
    readonly opposite: 'daylark';
    readonly words: 'reserved private secret discreet intuitive mysterious guarded observant perceptive quiet subtle';
    readonly color: '#9da9ff';
}, {
    readonly id: 'daylark';
    readonly name: 'Daylark';
    readonly meaning: 'Openhearted joy and the courage to be seen';
    readonly opposite: 'veilkeeper';
    readonly words: 'happy cheerful outgoing playful sunny exuberant extrovert extroverted sociable bubbly expressive';
    readonly color: '#f4d67d';
}, {
    readonly id: 'hearthwarden';
    readonly name: 'Hearthwarden';
    readonly meaning: 'Nurturing others and creating a place of safety';
    readonly opposite: 'wildspark';
    readonly words: 'nurture nurturing caring caregiver warm compassionate supportive family gentle comfort kindness selfless';
    readonly color: '#ebb3c6';
}, {
    readonly id: 'wildspark';
    readonly name: 'Wildspark';
    readonly meaning: 'Personal desire and living without permission';
    readonly opposite: 'hearthwarden';
    readonly words: 'passionate desire daring sensual hedonist indulgent pleasure bold restless uninhibited selfish';
    readonly color: '#dd8daf';
}, {
    readonly id: 'heartthread';
    readonly name: 'Heartthread';
    readonly meaning: 'Devotion, intimacy, and choosing connection';
    readonly opposite: 'quietdrift';
    readonly words: 'romantic romance love affectionate devoted intimate relationship attachment loyal loving connection';
    readonly color: '#ff9caf';
}, {
    readonly id: 'quietdrift';
    readonly name: 'Quietdrift';
    readonly meaning: 'Solitude and the freedom to belong to yourself';
    readonly opposite: 'heartthread';
    readonly words: 'solitary solitude loner alone introvert introverted independent detached self-sufficient reclusive introspective';
    readonly color: '#bdc4df';
}, {
    readonly id: 'trailblazer';
    readonly name: 'Trailblazer';
    readonly meaning: 'Ambition expressed through decisive action';
    readonly opposite: 'dreamglass';
    readonly words: 'ambitious athlete athletic competitive compete driven ambitious achievement determined practical goal success';
    readonly color: '#a7cefa';
}, {
    readonly id: 'dreamglass';
    readonly name: 'Dreamglass';
    readonly meaning: 'Imagination and possibilities beyond the practical';
    readonly opposite: 'trailblazer';
    readonly words: 'imagination imaginative dreamy dream artist artistic fantasy whimsical idealistic poetic sensitive';
    readonly color: '#bcb0ee';
}, {
    readonly id: 'ironbloom';
    readonly name: 'Ironbloom';
    readonly meaning: 'Patient courage and strength that does not need to shout';
    readonly opposite: 'riftcaller';
    readonly words: 'brave courage courageous resilient perseverance patient endurance steady gentle stoic composed';
    readonly color: '#efc572';
}, {
    readonly id: 'riftcaller';
    readonly name: 'Riftcaller';
    readonly meaning: 'Challenging limits and confronting broken systems';
    readonly opposite: 'ironbloom';
    readonly words: 'rebellious rebel disrupt radical outspoken confront defiant protest challenge fierce confrontational';
    readonly color: '#eda593';
}, {
    readonly id: 'tidewalker';
    readonly name: 'Tidewalker';
    readonly meaning: 'Adaptability and finding a way through uncertainty';
    readonly opposite: 'oathkeeper';
    readonly words: 'adapt adaptable flexible change improvisation resourceful easygoing relaxed compromise opportunistic';
    readonly color: '#a6ddd3';
}, {
    readonly id: 'oathkeeper';
    readonly name: 'Oathkeeper';
    readonly meaning: 'Conviction and promises held despite their cost';
    readonly opposite: 'tidewalker';
    readonly words: 'fair honest justice principled principle integrity truth ethical promise conviction stubborn';
    readonly color: '#b6d8d1';
}, {
    readonly id: 'farwatcher';
    readonly name: 'Farwatcher';
    readonly meaning: 'Deliberation and seeing consequences before acting';
    readonly opposite: 'stormchaser';
    readonly words: 'thoughtful analytical cautious careful deliberate strategic plan perspective philosophical patient measured';
    readonly color: '#c5b6eb';
}, {
    readonly id: 'stormchaser';
    readonly name: 'Stormchaser';
    readonly meaning: 'Instinct, risk, and the thrill of the immediate';
    readonly opposite: 'farwatcher';
    readonly words: 'impulsive rash reckless risk thrill impatient impulsive daring impatient adrenaline thrill-seeking';
    readonly color: '#e8ce9a';
}, {
    readonly id: 'ashwing';
    readonly name: 'Ashwing';
    readonly meaning: 'Reinvention and the courage to leave an old life behind';
    readonly opposite: 'rootsong';
    readonly words: 'transform transformation reinvent reinvention rebirth rebuild renewal escape restart survivor starting-over';
    readonly color: '#c5abd7';
}, {
    readonly id: 'rootsong';
    readonly name: 'Rootsong';
    readonly meaning: 'Belonging and the bonds that connect a life to its home';
    readonly opposite: 'ashwing';
    readonly words: 'community home roots belonging hometown neighbor tradition family heritage friendship familiar';
    readonly color: '#a9d7ba';
}, {
    readonly id: 'dawnmender';
    readonly name: 'Dawnmender';
    readonly meaning: 'Healing, forgiveness, and faith in second chances';
    readonly opposite: 'thornheart';
    readonly words: 'hope hopeful optimistic forgive forgiveness heal healing reconcile forgiving acceptance redemption peace';
    readonly color: '#a5dbef';
}, {
    readonly id: 'thornheart';
    readonly name: 'Thornheart';
    readonly meaning: 'Self-protection shaped by wounds that still matter';
    readonly opposite: 'dawnmender';
    readonly words: 'resentful bitter grudge distrust mistrust betrayed betrayal suspicious wounded cynical defensive unforgiving';
    readonly color: '#d8a1bd';
}];

declare const ECHO_BREAKTHROUGH_ABILITIES: {
    readonly horizonbound: {
        readonly cost: 50;
        readonly balance: "Opens a new direction without directly changing feelings.";
        readonly name: 'Open Horizon';
        readonly summary: 'See an overlooked possibility and create an opening for a new shared experience.';
        readonly scope: 'Selected character';
        readonly action: 'I look beyond our usual pattern and invite a new possibility between us.';
        readonly instruction: 'Reveal one overlooked but plausible opportunity in the current situation: a fresh way to connect, approach a problem, or suggest a shared experience. Anchor it in the established location, conversation and available people or activities. Make the opening concrete and available for the reader to accept or decline. Do not invent a guaranteed future, teleport the scene, fabricate resources, or make either person accept an invitation automatically.';
    };
    readonly stoneward: {
        readonly cost: 25;
        readonly balance: "Practical reassurance rather than emotional persuasion.";
        readonly name: 'Steady Ground';
        readonly summary: 'Turn uncertainty into a clear, dependable next step you can take together.';
        readonly scope: 'Selected character';
        readonly action: 'I offer to shoulder one practical responsibility and help us find solid ground.';
        readonly instruction: 'Create one concrete source of stability in this exchange: a manageable plan, a clear division of responsibility, or a practical precaution the reader can actually offer. Let the selected character assess it and decide her own part. Show how clarity makes the immediate situation less uncertain. Do not assume authority over her, invent resources, remove real dangers, or guarantee that a future promise will be kept.';
    };
    readonly sparkweaver: {
        readonly cost: 25;
        readonly balance: "A useful idea helps the situation more than it sways the person.";
        readonly name: 'Bright Invention';
        readonly summary: 'Find a clever new use for what is already at hand.';
        readonly scope: 'Selected character';
        readonly action: 'I put an unexpected idea on the table and invite her to help me try it.';
        readonly instruction: 'Offer a specific, inventive workaround for something in the current scene, using established surroundings, objects or skills. Let the reader and selected character try or refine the idea together. The breakthrough is a workable experiment rather than sudden mastery. Do not conjure equipment, grant technical knowledge they lack, skip the work, or declare an untested invention successful.';
    };
    readonly lorekeeper: {
        readonly cost: 25;
        readonly balance: "Advice offers perspective while leaving the conversation largely intact.";
        readonly name: 'Thread of Wisdom';
        readonly summary: 'Bring a useful lesson or familiar practice to bear on the present problem.';
        readonly scope: 'Selected character';
        readonly action: 'I look for a lesson worth keeping and ask how we might use it here.';
        readonly instruction: 'Connect the current situation to one established lesson, familiar practice or ordinary piece of knowledge the reader or selected character plausibly has. Make the lesson useful through a concrete suggestion, demonstration or question in this exchange. If no past lesson is established, use common knowledge or let her offer one voluntarily. Do not fabricate shared memories, hidden expertise or a tradition that demands obedience.';
    };
    readonly veilkeeper: {
        readonly cost: 75;
        readonly balance: "Revealing insight can substantially reframe an exchange.";
        readonly name: 'Read Between the Lines';
        readonly summary: 'Notice a revealing detail and gain an unusual intuition about the present situation.';
        readonly scope: 'Selected character';
        readonly action: 'I slow down and pay attention to what her words and reactions leave unsaid.';
        readonly instruction: 'Give the reader one specific, useful observation: a hesitation, contradiction, glance, tone, or environmental detail that clarifies this situation. Connect it to established scene evidence. Distinguish an intuition from a confirmed fact, and allow a natural way to test it through conversation. Do not invent secrets, reveal unrelated private backstory, grant omniscience, or describe someone else\'s unspoken thoughts as something the reader knows.';
    };
    readonly daylark: {
        readonly cost: 50;
        readonly balance: "A shared mood lift can loosen a conversation without forcing candor.";
        readonly name: 'Shared Sunshine';
        readonly summary: 'Brighten the room with a moment of sincere appreciation or shared delight.';
        readonly scope: 'Everyone present';
        readonly action: 'I point out something worth enjoying and invite everyone into the moment.';
        readonly instruction: 'Create a specific chance for shared delight among people actually present: an honest compliment, a harmless amusing observation, or appreciation of something already happening. Let different personalities respond differently, including quietly or cautiously. The opening should make participation feel welcome, not obligatory. Do not mock someone to entertain the group, erase grief or conflict, or force everyone into a cheerful mood.';
    };
    readonly hearthwarden: {
        readonly cost: 25;
        readonly balance: "Gentle comfort lowers pressure without asking for a change of heart.";
        readonly name: 'Safe Harbor';
        readonly summary: 'Offer practical comfort and a little room to feel at ease.';
        readonly scope: 'Selected character';
        readonly action: 'I notice what might make this easier for her and offer a small, practical kindness.';
        readonly instruction: 'Find one immediate, credible way to make the selected character more comfortable: an offered seat, a gentler pace, help with a task, or a choice about what happens next, as the scene permits. Show attentive care without demanding closeness in return. She may accept, adapt or decline. Do not declare a dangerous place safe, assume touch is welcome, compel disclosure, or treat kindness as a debt.';
    };
    readonly wildspark: {
        readonly cost: 75;
        readonly balance: "Greater candor across everyone present can shift the whole conversation.";
        readonly name: 'Unbound Moment';
        readonly summary: 'Loosen social inhibitions so everyone present becomes more candid and spontaneous.';
        readonly scope: 'Everyone present';
        readonly action: 'I take a playful risk and invite everyone here to speak a little more freely.';
        readonly instruction: 'For this response, ease social self-consciousness among the reader and people actually present. Let them speak more candidly or act more spontaneously than usual in ways that fit each individual. Include a tangible shift in the conversation; avoid identical reactions. This is a brief opening, not a personality rewrite. Keep judgment, willingness and boundaries intact; nobody is compelled to disclose a secret, consent, or pursue intimacy. Absent people are unaffected.';
    };
    readonly heartthread: {
        readonly cost: 75;
        readonly balance: "Mutual vulnerability creates a strong opening for emotional connection.";
        readonly name: 'Shared Understanding';
        readonly summary: 'Create an opening for honest vulnerability and a deeper, mutual connection.';
        readonly scope: 'Selected character';
        readonly action: 'I share something honest and try to understand what this moment feels like for her.';
        readonly instruction: 'Create a concrete moment of mutual understanding between the reader and the selected character. Let one express a feeling, need or concern and the other recognize it accurately. Use what their shared history and current trust make plausible; vulnerability can be small. Do not manufacture a shared memory, force affection or disclosure, erase a disagreement, or instantly change relationship status. Leave room for their own choices after this exchange.';
    };
    readonly quietdrift: {
        readonly cost: 25;
        readonly balance: "Space and silence ease pressure rather than drive an outcome.";
        readonly name: 'Room to Breathe';
        readonly summary: 'Ease the pressure to perform, explain yourself, or fill every silence.';
        readonly scope: 'Selected character';
        readonly action: 'I ease off the pressure and leave us room for a quiet, unhurried moment.';
        readonly instruction: 'Create a useful pause in the social demands of this exchange. Let the reader or selected character take a breath, set their own pace, or share comfortable silence without it being treated as rejection. Offer a concrete choice to continue, change the subject or take space. Do not automatically end the scene, make her leave, remove established obligations, or portray distance as guaranteed intimacy.';
    };
    readonly trailblazer: {
        readonly cost: 50;
        readonly balance: "Turns discussion into a concrete next action.";
        readonly name: 'First Step';
        readonly summary: 'Turn a shared intention into one meaningful step forward.';
        readonly scope: 'Selected character';
        readonly action: 'I stop circling the idea and offer a concrete first step we can take now.';
        readonly instruction: 'Move an established goal from talk toward one attainable action in the current exchange. Make the first step specific, use abilities and resources already available, and leave the selected character free to participate or suggest a different step. Show actual limited progress if the action is taken. Do not complete an entire project instantly, guarantee victory, award stats, or substitute the reader\'s goal for hers.';
    };
    readonly dreamglass: {
        readonly cost: 50;
        readonly balance: "An imaginative question can draw out aspirations and change the subject.";
        readonly name: 'What If';
        readonly summary: 'Use a vivid possibility to discover what you both might want.';
        readonly scope: 'Selected character';
        readonly action: 'I offer a playful what-if and ask what she would make of it.';
        readonly instruction: 'Open an imaginative but clearly hypothetical possibility connected to the current conversation. Use a vivid image, a creative scenario or a small shared invention to invite the selected character to express a wish or perspective she chooses to share. Keep imagined details distinct from the real scene. Do not invent memories, turn a fantasy into a commitment, reveal private thoughts without dialogue, or make hypothetical events actually happen.';
    };
    readonly ironbloom: {
        readonly cost: 25;
        readonly balance: "Steadiness supports the reader without strongly steering the other person.";
        readonly name: 'Unshaken';
        readonly summary: 'Meet a difficult moment with quiet courage and patient resolve.';
        readonly scope: 'Selected character';
        readonly action: 'I take a breath, stay present, and make one honest effort without pushing her.';
        readonly instruction: 'Give the reader a grounded opening to remain composed through a real awkwardness, setback or difficult feeling in this scene. Show quiet courage through one patient action or candid admission, making it possible to continue constructively with the selected character. If no setback exists, use the courage needed for a sincere next step rather than inventing conflict. Do not erase pain, make persistence override a refusal, or guarantee that endurance wins affection.';
    };
    readonly riftcaller: {
        readonly cost: 75;
        readonly balance: "Challenging the premise can turn a stuck conversation in a new direction.";
        readonly name: 'Break the Pattern';
        readonly summary: 'Challenge an unhelpful assumption and open a different way to respond.';
        readonly scope: 'Selected character';
        readonly action: 'I question the pattern we have fallen into and suggest that we try something different.';
        readonly instruction: 'Identify an assumption, unfair expectation or repetitive conversational pattern supported by what is actually happening. Give the reader a specific way to question it and offer an alternative, making room for the selected character to agree, disagree or redefine the problem. If no unfairness is established, challenge a harmless routine rather than inventing oppression. Do not manufacture a villain, humiliate her, force rebellion, or demolish a relationship in a single exchange.';
    };
    readonly tidewalker: {
        readonly cost: 50;
        readonly balance: "A workable compromise can redirect disagreement.";
        readonly name: 'Find the Current';
        readonly summary: 'Adjust gracefully when the moment does not go according to plan.';
        readonly scope: 'Selected character';
        readonly action: 'I take the situation as it is and offer another way forward that could suit us both.';
        readonly instruction: 'Use a real constraint, changed circumstance or difference in preferences to reveal a specific workable adjustment. Let the reader offer a small compromise or redirect that respects what each person wants, with the selected character choosing her response. If the moment is already smooth, show attentiveness to a preference she has expressed. Do not erase the constraint, make either person abandon a core value, or declare a compromise mutually accepted before it is discussed.';
    };
    readonly oathkeeper: {
        readonly cost: 50;
        readonly balance: "A credible commitment can shift how an intention is received.";
        readonly name: 'Word of Honor';
        readonly summary: 'Make your intentions credible through a clear promise and an honest first action.';
        readonly scope: 'Selected character';
        readonly action: 'I say exactly what I can stand behind and begin by doing what I can right now.';
        readonly instruction: 'Create an opportunity for the reader to demonstrate integrity with a specific, limited commitment or an honest clarification of what they can offer. Where possible, include a first action that can be witnessed now. Let the selected character judge the evidence for herself. Do not bind her to an oath, guarantee future conduct, excuse a past betrayal, or turn one promise into fully earned trust.';
    };
    readonly farwatcher: {
        readonly cost: 50;
        readonly balance: "Clear trade-offs can change a decision without granting certainty.";
        readonly name: 'Ripple Sight';
        readonly summary: 'See the likely trade-offs of your next move before you choose it.';
        readonly scope: 'Selected character';
        readonly action: 'I pause to consider where our next choice could lead and talk through the trade-off.';
        readonly instruction: 'Clarify two plausible near-term consequences of a choice already facing the reader and selected character. Ground them in known circumstances and present them as possibilities, not predictions. Give the reader an informed opening to ask, decide or plan with her in this exchange. Do not reveal future events, undisclosed plans or unspoken motives as facts, and do not decide the outcome for either person.';
    };
    readonly stormchaser: {
        readonly cost: 50;
        readonly balance: "A timely invitation can turn hesitation into a meaningful choice.";
        readonly name: 'Seize the Moment';
        readonly summary: 'Catch a fleeting opening with a bold, spontaneous move.';
        readonly scope: 'Selected character';
        readonly action: 'I take a chance on the opening in front of us and invite her along.';
        readonly instruction: 'Spot one time-sensitive but plausible opportunity already supported by the scene, and let the reader act on it with a modest spontaneous risk: a timely invitation, a candid remark or a chance to join an activity. Make the opening lively and concrete while allowing the selected character to accept or refuse. Do not fabricate a crisis, force physical intimacy, endanger people, or guarantee a reward for recklessness.';
    };
    readonly ashwing: {
        readonly cost: 50;
        readonly balance: "A new action can challenge expectations without erasing the past.";
        readonly name: 'Turn the Page';
        readonly summary: 'Show that an old pattern does not have to define your next choice.';
        readonly scope: 'Selected character';
        readonly action: 'I acknowledge the old pattern and choose one thing I want to do differently now.';
        readonly instruction: 'Give the reader a concrete chance to depart from a previously established habit, role or expectation through a new action in this exchange. If no such pattern is established, let the reader name a new direction without inventing a past failure. The selected character can notice the effort while retaining reasonable doubts. Do not erase history, rewrite personality, force her to grant a clean slate, or declare a permanent transformation complete.';
    };
    readonly rootsong: {
        readonly cost: 25;
        readonly balance: "A familiar point of belonging offers a modest social opening.";
        readonly name: 'Common Ground';
        readonly summary: 'Find a small point of belonging in a place, interest or shared ritual.';
        readonly scope: 'Selected character';
        readonly action: 'I look for something familiar we can share and make room for her to belong here.';
        readonly instruction: 'Draw on an established place, interest, community tie or familiar practice to create a specific moment of belonging between the reader and selected character. If there is no known shared history, invite a new small ritual or compare experiences through conversation instead of assuming a connection. Do not invent mutual acquaintances, shared childhoods, family knowledge, or a claim that either person owes loyalty to a group.';
    };
    readonly dawnmender: {
        readonly cost: 75;
        readonly balance: "Repairing hurt can change the direction of a difficult relationship conversation.";
        readonly name: 'First Mend';
        readonly summary: 'Open a path toward repair through acknowledgment and a small act of care.';
        readonly scope: 'Selected character';
        readonly action: 'I acknowledge what went wrong and ask what a small, honest step toward repair might look like.';
        readonly instruction: 'Find one grounded opening to repair an established misunderstanding, disappointment or hurt between the reader and selected character. Emphasize listening, specific accountability and a feasible reparative action. If no harm is established, address a real minor uncertainty gently without inventing wrongdoing. Let repair begin without requiring immediate forgiveness. Do not heal trauma instantly, absolve responsibility, erase consequences or force reconciliation.';
    };
    readonly thornheart: {
        readonly cost: 50;
        readonly balance: "A clear boundary can redirect the terms of an exchange.";
        readonly name: 'Draw the Line';
        readonly summary: 'Protect your dignity with a clear boundary and a choice about what comes next.';
        readonly scope: 'Selected character';
        readonly action: 'I say what I am comfortable with, listen to her limits, and make my next choice clear.';
        readonly instruction: 'Create an opening for the reader to state a specific personal limit or condition relevant to this exchange, without apology for having it. Let the selected character state or retain her own limits, and make the next available choice concrete: continue differently, decline, pause or step away. If there is no violation, clarify a preference rather than inventing hostility. Do not read malice into ordinary disagreement, coerce compliance, retaliate, or treat a boundary as control over another person.';
    };
};

declare type EchoAspect = typeof ECHO_ASPECTS[number]['id'];

declare type EchoBreakthroughAspect = keyof typeof ECHO_BREAKTHROUGH_ABILITIES;

declare interface EchoCreature {
    type: string;
    description: string;
}

declare interface EchoIdentity {
    aspect: EchoAspect;
    motif: number;
    name: string;
    nameSource: 'generated' | 'custom';
    nameFormat: 'short' | 'legacy';
    reason: string;
    reasonExamples: EchoReasonExample[];
    reasonVersion?: 1 | 2;
    assignment: 'profile' | 'chosen' | 'legacy';
    creature?: EchoCreature;
    /** Per-owner display placement; absent keeps the original stage layout. */
    stage?: EchoStagePlacement;
    art?: string;
    source?: 'generated' | 'uploaded';
}

declare interface EchoReasonExample {
    source: 'Backstory' | 'Personality' | 'Bio';
    quote: string;
    connection: string;
    supportsType: boolean;
}

/** Offsets in the game's 1920 × 1080 stage coordinates, relative to its existing Echo position. */
declare interface EchoStagePlacement {
    x: number;
    y: number;
    scale: number;
    visible?: boolean;
    opacity?: number;
    floating?: boolean;
    floatSeconds?: number;
}

declare interface EchoState {
    version: 3;
    player: EchoIdentity | null;
    girls: Record<string, EchoIdentity>;
    playerChangeUsed: boolean;
    playerAutoArtAttempted: boolean;
    usedNames: string[];
    opacity: number;
    visible: boolean;
}

/** The milestones the edit offers, in the order the modal lists them. */
declare const EDIT_MILESTONES: readonly ["met", "contact", "lovers", "crush", "kissed", "sex", "broke_up", "friendzoned_by_reader", "friendzoned_reader", "agreed_to_harem", "blocked"];

declare type EditMilestone = (typeof EDIT_MILESTONES)[number];

declare type EditMilestones = Record<EditMilestone, boolean>;

/**
 * A field of a mod's own in the character editor, under Generation settings. `read` takes its
 * value off her as the editor opens, `Field` edits it with the rest of the form, and `write` is what
 * saving puts back on her: its own fields only, since the game's own are written over it; an `ex`
 * it returns adds its slices beside hers and the other mods'. Save
 * and the unsaved-changes check see it as they see the game's fields. A mod that is off draws no
 * field and writes nothing.
 */
export declare interface EditorField {
    read: (character: Character) => unknown;
    write: (value: unknown) => Partial<Character>;
    Field: ComponentType<EditorFieldProps>;
}

/** What the game hands a mod's field in the character editor. */
export declare interface EditorFieldProps {
    /** The field's value as the form holds it, from {@link EditorField.read} until it is changed. */
    value: unknown;
    onChange: (value: unknown) => void;
    charId: string;
    /** Her appearance tags as the form holds them, which a field about her looks may read. */
    baseAppearance: readonly string[];
}

/** The emoji tool beside a box, drawn by the first mod on that has one; nothing otherwise. */
export declare function EmojiTool(props: EmojiToolProps): JSX.Element | null;

/** What the game hands a mod's emoji tool beside a box being typed in. */
export declare interface EmojiToolProps {
    /** The box is shut, and the tool with it. */
    dead?: boolean;
    /** Puts an emoji into the box, where its caret is. */
    onPick: (emoji: string) => void;
}

/** The seven sprite expressions a character can be generated in. */
declare type Emotion = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'embarrassed' | 'aroused';

/** The ending's way on, offered beside "Return to the main menu", which stays. */
export declare interface EndingChoice extends WayOn {
    /** The button's words. */
    label: string;
}

/**
 * A character withdrawn from an event she cannot make, persisted inside
 * {@link SceneState.opening}.
 */
declare interface EventCancellation {
    charId: string;
    /** The slot the plan she is dropping out of falls in. */
    date: number;
    time: TimeSlot;
    /**
     * What took her, so the message names the real one: spring break, or on an opening an older
     * save banked, her class or her shift.
     */
    reason: 'class' | 'shift' | 'away';
    /** Set with `'shift'`: the job she is rostered for, so the line can name the employer. */
    jobId?: string;
}

/** The asks a slot opening may roll any girl's invitation into, each dealt once a round. */
declare const EVERYDAY_ASKS: readonly ['help', 'exercise', 'meal', 'shopping'];

/** One of {@link EVERYDAY_ASKS}. */
declare type EverydayAsk = (typeof EVERYDAY_ASKS)[number];

/** Which of a course's two assessments is in question. */
declare type ExamPeriod = 'midterm' | 'final';

/** A sat exam: how many questions were asked and how many he got right. */
declare interface ExamRecord {
    asked: number;
    correct: number;
}

/** One expression sprite of one wardrobe addressed on its own: the column's per-sprite control. */
declare type ExpressionTarget = `expression:${SpriteRef}`;

export declare interface ExternalSceneTurn {
    /** Positive monotonically increasing identity within this exchange. */
    id: number;
    participants: readonly string[];
    actions: readonly string[];
    lines: readonly {
        charId: string;
        emotion: Emotion;
        text: string;
    }[];
    deferSave?: boolean;
}

/**
 * The eye that opens a gallery, or hides the chrome over one. It takes its size from the caller
 * — a chip in the scene's rail carries it smaller than a landscape tile's circle does — and it
 * is hidden from the reader only where the seat around it already says the word.
 */
export declare function EyeIcon({ size, ariaHidden }: {
    size: number;
    ariaHidden?: boolean;
}): JSX.Element;

/** The eye struck through: a wardrobe kept off the stage. */
export declare function EyeOffIcon({ size }: {
    size: number;
}): JSX.Element;

/**
 * A layer that only arrives: the background wash, the footer, the chips. It goes out the way it
 * came in, on the shared leaving tween, for a layer that is one of a sequence.
 */
export declare const fadeIn: (delay: number, duration?: number) => Variants;

/**
 * Her posts in saved order, without filtering visibility or arrival dates. To show what the
 * player sees, keep the posts the kit's `postVisible` passes. @since 0.8.0
 */
export declare const feed: (id: string) => readonly Readonly<SocialPost>[];

/** Faces the campus posts under — an emoji stands in for a photo. */
export declare const FEED_EMOJI: readonly string[];

/** Grab bag id for {@link FEED_EMOJI}. */
export declare const FEED_EMOJI_BAG = "feed.emoji";

/** Grab bag id for {@link FEED_HANDLE_POOL}. */
export declare const FEED_HANDLE_BAG = "feed.handles";

/** The handle bag: the generated names, with every supporter's marbles spread among them. */
export declare const FEED_HANDLE_POOL: FeedHandle[];

/** How many rows the Updates tab mounts at a time. */
export declare const FEED_PAGE = 30;

/**
 * The feed items that belong to one slot and then are gone, stamped with the date and slot they
 * were rolled for.
 */
declare interface FeedExtras {
    date: number;
    time: TimeSlot;
    /**
     * One post by somebody the reader has no contact info for — how a stranger is discovered.
     */
    teaser: {
        charId: string;
        postId: string;
    } | null;
    /**
     * Posts by people he cannot contact, added while the feed is too thin to read — one apiece,
     * and absent while it has enough on it without them.
     */
    fill?: {
        charId: string;
        postId: string;
    }[];
    /**
     * A post by a student nobody on the roster is — a handle, an emoji for a face, and a
     * line off the authored tables.
     */
    randomPost: {
        handle: string;
        emoji: string;
        text: string;
        likes: number;
        liked?: boolean;
    } | null;
}

/** One entry of the handle bag: its set-aside key, the name shown, and whether it is a real person's. */
declare interface FeedHandle {
    key: string;
    handle: string;
    supporter: boolean;
}

/** Bunnyfeeds' old board-wide read marker, for migration; undefined when absent. @since 0.8.0 */
export declare const feedReadThrough: () => number | undefined;

/**
 * Files a post a mod wrote outside the slot's opening, mid-slot, the way the opening's own posts
 * are filed. It leaves the slot's teaser and fill as the opening drew them.
 */
export declare function fileLatePost(post: NonNullable<SlotIntroResponse['posts']>[number]): Promise<void>;

/** Settles the pending activity and sends its closing turn. No points move here. */
export declare function finishSlotActivity(owner: string, id: string, completed: boolean, result: string): Promise<boolean>;

/**
 * The player's changes to one fixed occasion, each field kept only while it differs from the
 * build: its words, the day a movable one starts on, its length and half its own, and whether a
 * movable one is taken off the semester, its other changes kept for when it is put back.
 */
declare interface FixedOccasionEdit {
    title?: string;
    description?: string;
    startDate?: number;
    removed?: true;
}

/** A semester's changes to its fixed occasions, by fixed id; an occasion with no entry is the build's. */
declare type FixedOccasionEdits = Record<string, FixedOccasionEdit>;

/** `"1/28"` — the date as a figure, for the day-change splash's mono row. */
export declare function formatNumericGameDate(date: number, season: Season): string;

/** Compact date for memory entries in prompt cast blocks. */
export declare function formatShortGameDate(date: number, season: Season): string;

/** One employer the reader has left: the raises he had taken, and how it ended. */
declare interface FormerJob {
    raises: number;
    /** He quit, was let go, or the semester ended under him. */
    left: 'quit' | 'fired' | 'term';
}

/** Apply the native timetable, resting, group and event rules to the current slot. */
export declare function freeForInvitation(id: string): boolean;

/** The playthrough being played, if any, and the reader's first name. */
export declare function gameFacts(): {
    playthroughId: string | null;
    readerName: string;
};

/** Playthrough scene summaries, keyed by day and time slot. */
declare type GameHistory = Record<number, Partial<Record<TimeSlot, string>>>;

/** One entry in the game menu, as the menu draws its own. */
export declare interface GameMenuItemProps {
    /** It stands dimmed and takes nothing. */
    dead?: boolean;
    /** What a hover over it says while it is dead. */
    note?: string;
    onClick: () => void;
    children: ReactNode;
}

/** What the game hands a mod's panel opened with {@link openPanel}. */
export declare interface GameModalProps {
    /** The half of the day the stage is in, which every modal over it wears. */
    theme: ScreenTheme;
    /** What `openPanel` was handed beside the id: whose panel it is, say. */
    arg: string | undefined;
    /** A crossing between screens is over the view. */
    covered: boolean;
    onClose: () => void;
    /** Closes the panel into the game menu, for a panel the menu opened. */
    openGameMenu: () => void;
}

/**
 * The game's ends: what stops a playthrough, the prose that says so, and the modal that follows.
 * Each is an entry in {@link GAME_OVER_SCENES}. Two are conditions `gameOverReasonOf` tests; the
 * epilogue's own losing end is a button press the loop tests for itself.
 */
/** Every way a playthrough can stop: the good one, and the one the epilogue loses to, included. */
declare type GameOverReason = 'debt' | 'expulsion' | 'gameComplete' | 'endingDebt';

/** A save's replays, keyed by day and half — the shape of its history. */
declare type GameReplays = Record<number, Partial<Record<TimeSlot, string>>>;

/** The on-disk save: core's fields, plus the optional ones mods declare on it from their own modules. */
declare interface GameSave extends NativeGameSave {
    /** Optional Story Memory facts and corrections, carried with this save. */
    exStoryMemory?: StoryMemory;
    /** Optional, character-specific spirit and committed outcomes. */
    exReckoning?: ReckoningState;
    exEcho?: EchoState;
    exBreakthrough?: BreakthroughState;
    /** Optional, noncanonical spectator conversations. */
    exNpcWatch?: MeanwhileStore;
    /** Character Dynamics: fixed setup choices retained by every save. */
    exCharacterDynamics?: CharacterDynamics;
}

/**
 * Live game state: persisted `GameSave` fields plus transient playback fields.
 * `gameLoop.ts` drives this store imperatively outside React.
 */
declare interface GameStoreState {
    exReckoning: ReckoningState;
    exStartingChallenge: StartingChallenge | undefined;
    exTalents: TalentState;
    exEcho: EchoState;
    exBreakthrough: BreakthroughState;
    breakthroughFlash: {
        id: string;
        playthroughId: string;
        name: string;
        echoAspect?: EchoBreakthroughAspect;
    } | null;
    /** The activity this scene was committed to on the landing, or null. */
    sceneActivity: SlotActivity | null;
    /** What mods keep with the scene being played, saved with it as `mods`. */
    sceneMods: ModSceneFields;
    /**
     * What the restored scene carried that core does not own, written back with it untouched;
     * another mod's data, or a field from a newer build. Empty for a scene cast here.
     */
    sceneRest: Record<string, unknown>;
    /**
     * What the loaded save carried that core does not own, written back untouched; another mod's
     * data, or a field from a newer build.
     */
    saveRest: Record<string, unknown>;
    /**
     * The loaded save's `ex` as read, whole: every mod's slice, a mod not registered this session
     * included. Written back under the values below.
     */
    modData: Record<string, ModSlice>;
    /** The value of each registered mod the loaded save held data for, by id, as its field read it. */
    modValues: Record<string, unknown>;
    /** The playthrough being played; every save this session writes goes into it. */
    playthroughId: string | null;
    /** The Scene Creator's scene being played, with no playthrough; null in a game. */
    createdScene: CreatedScene | null;
    /**
     * A replay from the calendar being read, with no playthrough to write to while the game it was
     * opened from is held in memory; `over` once its last line has turned. Null in a game.
     */
    replaying: {
        over?: true;
    } | null;
    /** Immutable mod choices read from the playthrough record, never duplicated into slot saves. */
    playthroughMods: readonly string[];
    date: number;
    time: TimeSlot;
    /** The save's semester, a key of the record's semesters; null in the first. */
    semesterId: string | null;
    /** Which semester of the playthrough the save is in, from 0. */
    semesterIndex: number;
    /** The on-campus roster of the save's semester. */
    chars: string[];
    /**
     * Every girl who has graduated by this semester, oldest first: loaded and textable, never
     * cast, scheduled or rolled for.
     */
    alumni: string[];
    /** Who graduates at this semester's ceremony, in roster order (`graduatesOf`). */
    graduating: string[];
    /** The reader's own name, chosen at New Game and fixed for the playthrough. */
    playerFirstName: string;
    playerLastName: string;
    /** The reader's three stats in points; the panel and the prompt derive tiers. Persisted. */
    stats: PlayerStats;
    /**
     * The reader's balance in dollars. Persisted, shown as a number, and
     * allowed to go negative — far enough and the playthrough ends.
     */
    money: number;
    /**
     * The reader's own words about himself, written at New Game and rewritten on his profile.
     * Persisted; blank where he wrote nothing.
     */
    bio: string;
    exCharacterDynamics?: CharacterDynamics;
    /**
     * Lifetime counts about the reader — money earned, kisses, nights, shifts worked, moved only
     * in boundary passes so a replay credits each of them once — and the output tokens the cloud
     * writer generated, moved on every cloud reply. Persisted.
     */
    tallies: ReaderTallies;
    charInfo: Record<string, CharInfo>;
    /** The save's class roster, keyed by class code. Generated once, never changed. */
    classes: Record<string, ClassEntry>;
    /**
     * The player's own timetable: `ClassSlot` → class code. Changeable through VenusBot up to
     * the add/drop deadline, fixed after it.
     */
    playerSchedule: Record<number, string>;
    /** The playthrough log — every finished scene's summary, by day and slot. Persisted. */
    exStoryMemory: StoryMemory;
    history: GameHistory;
    /** The replay of each finished scene this save can play, by day and slot. Persisted. */
    replays: GameReplays;
    /** The Bunnyboard app: conversations, friend requests and badges. Persisted. */
    bunnyboard: BunnyboardState;
    /** Plans the reader has made, oldest first. Persisted. */
    events: CalendarEvent[];
    /** The semester's season and the occasions it invented. Read off the record. */
    calendar: SemesterCalendar;
    /** The occasions he turned down an invitation to, or let one stand. Persisted. */
    occasionsDeclined: string[];
    /** The part-time job the reader holds, or null. One at a time. */
    job: JobState | null;
    /** Job ids he was fired from or quit; those employers do not post again this semester. */
    jobsClosed: string[];
    /** Every employer he has left, by job id. Persisted. */
    formerJobs: Record<string, FormerJob>;
    /** What the semesters before this one left on his record; null in the first. Persisted. */
    transcript: Transcript | null;
    /** The slots each all-hours employer is not offering this playthrough. */
    jobClosures: Record<string, ShiftSlot[]>;
    /** Every slot's sky, read off the record and never rewritten. */
    weather: Weather[];
    /** What the reader has bought and not yet given away. Persisted. */
    inventory: OwnedItem[];
    /** What each of his classes has accumulated, keyed by class code. Persisted. */
    classRecords: Record<string, ClassRecord>;
    /** His academic reputation once a whole round of assessments is in. Persisted. */
    gradesStanding: 'good' | 'bad' | null;
    /** Whether he has been caught at an expellable offense. Persisted; one-way. */
    expelled: boolean;
    /** One-shot guards on the two grade notifications. Persisted. */
    midtermStandingDone: boolean;
    finalsScoresShown: boolean;
    /** The global slot VenusBot's announcements are delivered through. Persisted. */
    venusThrough: number;
    /** The same, for BunnyBot's two clock-owed messages. Persisted. */
    bunnybotThrough: number;
    /** Whether the sidebar's two granted apps have been handed over. Persisted; one-way. */
    bunnymapUnlocked: boolean;
    bunnyshopUnlocked: boolean;
    /** One-shot guards on the five event-triggered bot messages. Persisted. */
    venusJobIntroSent: boolean;
    bunnybotTwoTimingTipSent: boolean;
    bunnybotSeenTipSent: boolean;
    bunnybotContactIntroSent: boolean;
    bunnybotFirstPostNudgeSent: boolean;
    /** BunnyBot's handovers owed from before its own intro. Persisted. */
    bunnybotDeferred: BunnybotHandover[];
    /** Classes the reader dropped, keyed by code. Persisted; re-enrollment is barred. */
    droppedClasses: Record<string, DroppedClass>;
    /** Classes the reader added at add/drop, keyed by code. Persisted. */
    addedClasses: Record<string, AddedClass>;
    /** What the roster thinks of each other, keyed by `pairKeyOf`. Persisted. */
    exVenusWhisper: VenusWhisper;
    npcRelationships: NpcRelationshipMap;
    exNpcWatch: MeanwhileStore;
    /** The first time each pair of them became friends, oldest first. Persisted. */
    npcFriendships: NpcFriendship[];
    /** Who is with whom this slot, stamped with the slot it describes. Persisted. */
    npcOverlay: NpcSlotOverlay | null;
    /** What this slot's opening said was going on somewhere. Persisted. */
    slotRumor: SlotRumor | null;
    /** Who shared the last finished slot's scene, stamped with it. Persisted. */
    lastSlotCast: {
        date: number;
        time: TimeSlot;
        charIds: string[];
    } | null;
    /** Who has already been out this weekend → that weekend's Saturday. Persisted. */
    weekendOutings: Record<string, number>;
    /** The same, per slot, for the one week the rule is per slot. Persisted. */
    outingSlots: Record<string, number>;
    /** Who leaves campus for spring break, null until it is settled. Persisted. */
    springBreakAway: string[] | null;
    /** The graduate back in town for this fall's Homecoming, null until then or with none. Persisted. */
    homecomingVisitor: string | null;
    /** The lovers a hand-set relationship left, waiting on the next opening's texts. Persisted. */
    breakupsOwed: BreakupOwed[];
    /** The feed items belonging to today alone, stamped with it. Persisted. */
    feedExtras: FeedExtras | null;
    /** The graduation narration has played. Persisted. */
    graduationSeen: boolean;
    /** Who the reader has already said goodbye to. Persisted. */
    farewellsDone: string[];
    /** The graduation picture belongs to this epilogue. Persisted. */
    endingArtWanted: boolean;
    /** Full character records for everyone in `chars`, keyed by charId. */
    characters: Record<string, Character>;
    /** Derived charKey → charId map for translating LLM boundary values. */
    charKeyToId: Record<string, string>;
    /** Currently cast charIds — fixed for the whole scene, not re-classified per turn. */
    cast: string[];
    /** The class code this scene is sitting in, or null when it is not a class scene. */
    sceneClass: string | null;
    /** The course this scene's work session is for, or null when it is not one. */
    sceneProject: string | null;
    /**
     * The job whose shift this scene is, by jobId, or null when it is not one. Scene-scoped
     * and persisted like {@link sceneClass}; puts the workplace's lorebook paragraph up.
     */
    sceneJob: string | null;
    /**
     * The stats the shift's rolled gain moves, empty when the scene is not a shift or the
     * employer has one gain to roll. Scene-scoped and persisted like {@link sceneJob}.
     */
    sceneJobStats: StatKey[];
    /** The charId this scene is a goodbye to, or null when it is not one. */
    sceneFarewell: string | null;
    /** The charId the slot's texting ledger skips, or null when it reads every thread. */
    sceneTextLedgerSkip: string | null;
    /**
     * The slot's texting-ledger reply once it has landed, keyed on the message set it read; null
     * while the call is out or when nobody texted.
     */
    sceneTextLedger: BankedTextLedger | null;
    /**
     * Who this scene stood up by never answering her invitation: the ledger skips their threads
     * too, and the ending says one line about each.
     */
    sceneIgnoredInvites: string[];
    /**
     * Whom he turned down by text before this scene, whose memories it filed at its start: the
     * ending says one line about each.
     */
    sceneTurnedDown: string[];
    /**
     * The employer whose premises this scene is on because a character is working there, or null
     * when it is not one.
     */
    sceneVisitJob: string | null;
    /**
     * Who this scene is *about* without their being in it — the classifier's mentioned-only
     * list, resolved to charIds.
     */
    sceneMentions: string[];
    /** Where the classifier said the scene is set; scans the lorebook. */
    sceneLocation: string | null;
    /** The scene is somewhere people can see them — the witness roll's input. */
    sceneInPublic: boolean;
    /** The secret the scene's one girl tells in it; null when she tells none. */
    sceneSecret: string | null;
    /** The curveball the scene opened on; null when it opened on none. */
    sceneEvent: SceneEvent | null;
    /** The present a girl brings him in this scene; null when nobody does. */
    sceneReceivedGift: ReceivedGift | null;
    /** When each scene event last fired this semester. Persisted. */
    sceneEventsFired: SceneEventsFired;
    /** The reader's last cold this semester, kept once it is over; null before any. Persisted. */
    readerCold: ColdCase | null;
    /** Every strain the reader has caught this semester. Persisted. */
    readerColdsHad: number[];
    /** The gifts given so far in this scene, oldest first. */
    sceneGifts: SceneGift[];
    /** The exam being sat this slot, or null when the slot is an ordinary scene. */
    sceneQuiz: QuizState | null;
    /** The scene as delivered: the reader's action lines and every reply line, in order. */
    currentSceneTranscript: SceneLine[];
    /**
     * The running summary the last reply came with — the top of {@link sceneSummaries} — or null;
     * promoted to `history` at slot boundary.
     */
    sceneSummary: string | null;
    /** The summaries in the order they landed, each with the transcript length it covers up to. */
    sceneSummaries: SceneSummaryMark[];
    /**
     * The scene has said its last word and is playing out its ending. Never captured: the loop
     * writes the ending onto a save itself.
     */
    sceneEnding: boolean;
    /**
     * The ending under way is one the player asked for from End scene, which nothing interrupts.
     * Transient, and lowered with {@link sceneEnding}.
     */
    sceneEndedByHand: boolean;
    /**
     * True from a scene resolving until its ending is written: the drain parks on it rather than
     * crossing an ending still being paid for. **Transient**, never captured.
     */
    endingInFlight: boolean;
    /** The scene-end status sequence has been raised. **Transient** like {@link statusModal}. */
    statusShown: boolean;
    /**
     * Bumped by every cut the view lands at once rather than types out: a line {@link rewindLine}
     * steps back to, a line {@link forwardLine} reads again, the shown line {@link editLogLine}
     * rewrites, or the line {@link dropReadPreview} leaves on screen. Transient.
     */
    lineRewound: number;
    /**
     * The lowest transcript index a rewrite during the scene's ending reached, or null. The summary
     * marks past it are kept while the ending runs and dropped only if the ending is dropped, so a
     * finished ending files the whole recap and an interjection carries the rewrite verbatim.
     * **Transient** like {@link lineRewound}: never captured, and lost with the edit on a reload,
     * which replays the banked ending's original words anyway.
     */
    endingEditAt: number | null;
    /**
     * How many beats past the shown line the reader has already read: the lines a rewind moved back
     * onto the head of {@link pendingLines}, the reader's own among them not counted, plus one for
     * the decision point when the rewind left one. Transient like {@link lineRewound}.
     */
    reread: number;
    /** True while the engine is awaiting a player action. */
    awaitingInput: boolean;
    /** The ending `beginSlot` opened this slot on, or null while the playthrough still runs. */
    activeGameOver: GameOverReason | null;
    /** The graduation picture, as an object URL, once it exists. */
    endingArt: string | null;
    /**
     * The object URL of the reader's own picture, or null where he has none. Never persisted:
     * `loop/profilePicture.ts` owns the URL behind it.
     */
    profilePicture: string | null;
    /**
     * What the last goodbye said, kept for the log on the menu after the stage that held it is
     * cleared; never written to disk.
     */
    farewellLog: SceneLine[];
    /**
     * That picture is still being made — what the ending's last line and the game-over
     * modal wait on.
     */
    endingArtPending: boolean;
    /**
     * The contacts' last posts are still being asked for — what Continue waits on, so the next
     * semester carries them.
     */
    endingPostsPending: boolean;
    /** True while a classifier or scene call is in flight. */
    busy: boolean;
    /** True while a scene call may still append lines; distinct from `busy`. */
    streaming: boolean;
    /** True while the dialogue box is parked waiting for the next streamed line. */
    waitingForLine: boolean;
    /** Failed wrap-up error; holds playback at scene end until the modal resolves. */
    closingError: AppError | null;
    /** Failed ledger error; holds playback at scene end like `closingError`. */
    ledgerError: AppError | null;
    /** Failed texting-ledger error; holds playback at scene end like `ledgerError`. */
    textLedgerError: AppError | null;
    /** Failed slot-opening error; the last of the ending calls. */
    introError: AppError | null;
    /** Failed player-turn error after rewind; drives retry or reword UI. */
    turnError: AppError | null;
    /**
     * Failed classifier error, held while the turn waits inside `classifyAction` for the player to
     * retry or leave. The turn is still in flight: nothing has been rewound.
     */
    classifierError: AppError | null;
    /** Text to seed the action input with — a rewind's hand-back of the player's own words. */
    inputDraft: string;
    /**
     * The scene-end screen on the stage, if any — the rank-up or one girl's milestones.
     * **Transient**: never captured and never on disk, since nothing is written between
     * the status messages and the boundary, so a reload replays the sequence that raised it.
     */
    statusModal: StatusModal | null;
    /**
     * The boundary's memory question while it stands, or null. **Transient** like
     * {@link statusModal} and never written to a save: the boundary is replayed from the ending's
     * save and asks again.
     */
    memoryEdit: readonly MemoryEditRow[] | null;
    /** Scene lines not yet reached by playback. Consumed one per advance. */
    pendingLines: SceneLine[];
    /** The line currently on screen, or null before the first advance. */
    currentLine: SceneLine | null;
    /** Current background base name, without the `_day`/`_night` suffix. */
    bg: string | null;
    /** charIds occupying the three portrait slots, left to right; null = empty. */
    slots: Array<string | null>;
    /**
     * Sticky per-character sprite reference, keyed by charId. A
     * {@link Position} sits here in place of an emotion while a CG is on screen.
     */
    emotions: Record<string, SpriteRef>;
    /**
     * Which cast members have the full stock set of CGs on disk, by charId. Read at scene start and
     * never persisted.
     */
    cgReady: Record<string, boolean>;
    /**
     * Which alternate wardrobes each cast member has fully rendered, by charId. Read and scoped
     * like {@link cgReady}; a partly rendered set does not appear here.
     */
    outfitReady: Record<string, OutfitSet[]>;
    /**
     * Which custom CG pairs each cast member has whole on disk, both images, by charId. Read and
     * scoped like {@link cgReady}; a charId absent here has not been read yet.
     */
    customCgReady: Record<string, CustomCgSlot[]>;
    /**
     * Which cast members have both room backgrounds on disk, by charId. Read and scoped like
     * {@link cgReady}; a character with only one of the two does not appear here.
     */
    roomReady: Record<string, boolean>;
    /** Sticky mirrored-sprite flag, keyed by charId; decided when she is shown. */
    flipped: Record<string, boolean>;
    /**
     * charIds who have sat out `DEPARTURE_TURNS` turns off-stage. They stay
     * in `cast` but drop out of every prompt the scene builds from here on.
     */
    departed: string[];
    /**
     * charIds off-stage right now, each mapped to how many drained turns they have sat out — an
     * absence that has not become a departure yet. She is still in the prompts.
     */
    offStage: Record<string, number>;
    /**
     * Every line the player has reached this scene, in order — the Chat Log Modal's source.
     * Appended by `advanceLine`.
     */
    sceneLog: SceneLine[];
    /**
     * The player's own hand on the stage, keyed by charId: true for somebody he has shown that
     * the scene has not, false for somebody he has hidden that it has.
     */
    stageOverride: Record<string, boolean>;
    /** The bg id the player picked by hand, or null to follow the scene. */
    bgOverride: string | null;
    /** Per-character wardrobe locks the player set by hand. */
    outfitLock: Record<string, OutfitLock>;
    /** The CG the player put over the whole stage by hand, or null; the model is never told. */
    cgLock: CgLock | null;
    /**
     * charIds already written happy since the player's last action — the once-a-turn latch the
     * sparkle is rolled behind. **Transient**: never captured, never persisted, never on disk.
     */
    brightened: string[];
    /**
     * Whether the reader has acted from inside this scene — what a girl's sparkle waits for.
     * **Transient** like {@link brightened}.
     */
    sceneActed: boolean;
    /**
     * The sparkle last raised off a girl, keyed by a running count so each raise is a fresh
     * object. **Transient** like {@link brightened}.
     */
    sparkle: {
        charId: string;
        key: number;
    } | null;
    /**
     * Bumped by every {@link loadSave} (`reset` included) — a session fact, so it survives the
     * reset that always precedes a load. Used as the Game View's key: it forces a remount under the
     * crossing's cover so React state tied to the old save doesn't outlive it.
     */
    loads: number;
    /**
     * Hydrates the store from a loaded `GameSave`, the playthrough record it is read against
     * and its resolved characters.
     */
    loadSave: (save: GameSave, record: PlaythroughRecord, characters: Record<string, Character>) => void;
    /**
     * Hydrates the store for a Scene Creator scene: a blank game holding only what the setup
     * projects, with no playthrough to write to.
     */
    loadCreatedScene: (scene: CreatedScene, fields: CreatedSceneFields, characters: Record<string, Character>) => void;
    /** Says the created scene's last line has been turned. */
    markCreatedSceneOver: () => void;
    /**
     * Hydrates the store for a replay from the calendar: a blank game holding only what reading
     * the scene again needs, with no playthrough to write to.
     */
    loadReplay: (fields: ReplayStayFields, characters: Record<string, Character>) => void;
    /** Says the replay's last line has been turned. */
    markReplayOver: () => void;
    /** Names the replay kept for one finished slot. */
    setReplay: (date: number, time: TimeSlot, id: string) => void;
    /** Forgets the replay kept for one finished slot, if any. */
    dropReplay: (date: number, time: TimeSlot) => void;
    /** Puts a created scene's picked background on the empty stage its opening call reads. */
    seedStageBg: (bg: string) => void;
    /** Clears all game state (e.g. on return to main menu). */
    reset: () => void;
    setAwaitingInput: (awaiting: boolean) => void;
    /** Raises the game over ending latch; called only by `beginSlot`. */
    setActiveGameOver: (reason: GameOverReason | null) => void;
    /** Publishes the graduation picture, or takes it away on the way out. */
    setEndingArt: (url: string | null) => void;
    setEndingArtPending: (pending: boolean) => void;
    setEndingPostsPending: (pending: boolean) => void;
    /** Hands the screen the reader's own picture as an object URL, or clears it. */
    setProfilePicture: (url: string | null) => void;
    /** Keeps the goodbye that just ended, for the log the menu reads it back from. */
    setFarewellLog: (lines: readonly SceneLine[]) => void;
    setBusy: (busy: boolean) => void;
    setStreaming: (streaming: boolean) => void;
    setWaitingForLine: (waiting: boolean) => void;
    setClosingError: (error: AppError | null) => void;
    setLedgerError: (error: AppError | null) => void;
    setTextLedgerError: (error: AppError | null) => void;
    /** Files the slot's landed texting-ledger reply, or clears it. */
    bankTextLedger: (bank: BankedTextLedger | null) => void;
    setIntroError: (error: AppError | null) => void;
    setTurnError: (error: AppError | null) => void;
    setClassifierError: (error: AppError | null) => void;
    setInputDraft: (draft: string) => void;
    /** Snapshots the current scene for both mid-scene saves and failed-turn rewind. */
    captureScene: () => SceneState | null;
    /** Restores a captured scene, playback queue included. */
    restoreScene: (scene: SceneState | null) => void;
    /** Raises or drops the scene-end screen; the loop owns which and when. */
    setStatusModal: (modal: StatusModal | null) => void;
    /** Raises or drops the boundary's memory question; the loop owns which rows and when. */
    setMemoryEdit: (rows: readonly MemoryEditRow[] | null) => void;
    /** Replaces the playback queue with a freshly received scene's lines. */
    setPendingLines: (lines: SceneLine[]) => void;
    /** Appends to the tail of the playback queue, as streamed lines arrive. */
    appendPendingLines: (lines: SceneLine[]) => void;
    /**
     * Unwinds a discarded preview of `count` lines: off the transcript with every summary that
     * covered one, off the queue's tail, and off the log with the stage folded back for those the
     * player already read. Unread earlier lines stay queued.
     */
    dropReadPreview: (count: number) => void;
    /**
     * Sets the scene's cast (charIds) and what kind of scene it is — called once per scene, at
     * the top of a slot.
     */
    setCast: (charIds: string[], scene?: SceneKind) => void;
    appendSceneLines: (lines: SceneLine[]) => void;
    /**
     * Files the player's submitted action as a `READER_SPEAKER` line, into the transcript and the
     * scene log — never into `pendingLines`. `continues` says whether this action was taken from
     * inside a scene already running, rather than the one that opens it.
     */
    logPlayerAction: (text: string, continues: boolean) => void;
    /** Clears the transcript *and* every summary; the two are one unit. */
    clearSceneTranscript: () => void;
    /** Files a reply's running summary, covering the transcript up to length `at`. */
    setSceneSummary: (summary: string, at: number) => void;
    /**
     * Cuts the lines the player has not reached out of the queue and the transcript alike — never
     * the scene's first action — with every summary that covered one of them, and hands back every
     * gift whose action the cut took.
     */
    truncateUnread: () => void;
    /**
     * Cuts the scene to what the player has read: every line a rewind stepped back over read again,
     * the unread lines cut as {@link truncateUnread} cuts them, and a last action no read line
     * answers cut from the transcript and the log, its gift handed back.
     */
    cutToRead: () => void;
    /**
     * Steps playback back to the previous line that says something, across the reader's own lines
     * as far as the scene's first reply — in a replay as far as its first line — putting the lines
     * after it back on the queue and the stage back as it stood there. Returns false, changing
     * nothing, when there is no such line.
     */
    rewindLine: () => boolean;
    /**
     * Reads the next line a rewind stepped back over again as a cut, passing over the reader's own
     * in front of it. False when none landed: nothing ahead was read before, changing nothing, or
     * the queue ended on his line.
     */
    forwardLine: () => boolean;
    /** Spends the beat the reread count held for the decision point, once it is reached. */
    clearReread: () => void;
    /**
     * Rewrites `sceneLog[at]`, a reply line, on the log, on its transcript line, and on screen when
     * shown. Every summary covering the line is dropped at once outside an ending; during one they
     * are held for {@link dropEndingEdits} and the lowest index reached is kept as
     * {@link endingEditAt}. Returns the transcript index rewritten, -1 when the transcript holds
     * none, or null, changing nothing, when the line is the reader's, before his first action, a
     * status line, or already says `text`.
     */
    editLogLine: (at: number, text: string) => number | null;
    /**
     * Drops the summary marks past {@link endingEditAt} that a rewrite during the ending held back,
     * and clears it. Nothing when no rewrite was made.
     */
    dropEndingEdits: () => void;
    /**
     * Leaving the ending also clears {@link endingEditAt}, keeping every mark it held back; `byHand`
     * marks an ending End scene began.
     */
    setSceneEnding: (ending: boolean, byHand?: boolean) => void;
    setEndingInFlight: (inFlight: boolean) => void;
    setStatusShown: (shown: boolean) => void;
    /** Files the running summary under the slot that just finished. */
    commitSceneToHistory: (date: number, time: TimeSlot) => void;
    /**
     * Pops the next pending line and applies its `bg`, `action` and `emotion`, passing over the
     * reader's own lines in front of it. Returns false when no line landed: the queue was already
     * empty, or its last line was the reader's.
     */
    advanceLine: () => boolean;
    /**
     * Charges every running absence one turn, settling into `departed` whoever has now sat out
     * `DEPARTURE_TURNS`. Called once per turn, at the decision point.
     */
    settleDepartures: () => void;
    /**
     * Shows or hides a cast member by hand. Writes {@link stageOverride}, never the scene's
     * own stage.
     */
    toggleStageChar: (charId: string) => void;
    /** Picks a background by hand, or null to hand the choice back to the scene. */
    setBgOverride: (bg: string | null) => void;
    /** Locks a character's rendered wardrobe, or null to unlock her. */
    setOutfitLock: (charId: string, lock: OutfitLock | null) => void;
    /**
     * Puts one CG over the whole stage by hand, or takes it off with null. One lock for the whole
     * scene, so a new one replaces any other.
     */
    setCgLock: (lock: CgLock | null) => void;
    /** Clears background, portraits and emotions — the between-scenes state. */
    clearStage: () => void;
    /** Advances to the next time slot, rolling `date` forward when night wraps to day. */
    advanceSlot: () => void;
    /** Adds a scene's resolved stat movement, flooring each stat at zero. */
    applyStatDeltas: (deltas: PlayerStats) => void;
    /** Replaces what the reader says about himself: New Game's answer, and every later rewrite. */
    setBio: (bio: string) => void;
    /** Counts a finished scene's kisses and nights into the lifetime tallies. */
    recordActs: (acts: readonly IntimateAct[]) => void;
    /** Adds one cloud reply's output tokens to the lifetime tallies. */
    recordTokens: (generated: number) => void;
    /** Deducts what a scene cost the reader. No floor: the balance may go negative. */
    spendMoney: (amount: number) => void;
    /** Buys one of an item: banks it in the inventory and deducts the price, with no floor. */
    buyItem: (itemId: string, price: number) => void;
    /**
     * Hands an item to a character: spends it out of the inventory and files the {@link SceneGift},
     * stamping `repeat` from `charInfo` and earlier gifts this scene, and `at` where its action
     * will land on the transcript.
     */
    giftItem: (charId: string, pick: ItemPick) => GiftReaction;
    /** Undoes the newest gift, putting the item back: its turn was abandoned. */
    ungiftItem: () => void;
    /** Puts the present a girl brought this scene in his inventory, once. */
    receiveSceneGift: () => void;
    /** Files the scene's curveball as fired today — run once at the boundary. */
    commitSceneEvent: () => void;
    /** Folds this scene's gifts into `charInfo` — run once at the boundary. */
    recordGifts: () => void;
    /** Files the colds a finished slot passed on — run once at the boundary, and idempotent. */
    applyColdPass: (pass: ColdPass) => void;
    /**
     * The reader takes a dose of medicine off `pick`'s line, which ends his cold's stage from the
     * next slot. False, changing nothing, while he has no symptoms or has already had one this slot.
     */
    takeMedicine: (pick: ItemPick) => boolean;
    /** Marks his boss as having texted him about this cold. */
    markReaderBossTold: () => void;
    /** Empties the scene's gift list at a scene boundary or a slot opening. */
    clearSceneGifts: () => void;
    recordMemory: (charId: string, entry: CharMemory) => void;
    /**
     * Rewrites every copy of one memory she holds to `next`, or forgets it where `next` is null;
     * a memory she does not hold changes nothing.
     */
    replaceMemory: (charId: string, match: CharMemory, next: CharMemory | null) => void;
    /** Keeps the player's notes on her, trimmed; blank ones are dropped rather than stored. */
    setCharNotes: (charId: string, text: string) => void;
    /**
     * Applies the milestone boxes that differ between `opened` and `picked` to her entry as the
     * game's own transitions; a girl with no entry is left alone.
     */
    editMilestones: (charId: string, opened: EditMilestones, picked: EditMilestones) => void;
    /** Files what this slot's texting left her with, **replacing** the last slot's. */
    setTextMemory: (charId: string, entry: CharMemory) => void;
    /** Remembers what the scene-end status lines just told him about her standards. */
    setCrushHint: (charId: string, hint: CrushHint | undefined) => void;
    /**
     * Replaces everything she suspects about the reader and the other girls. An empty list leaves
     * her no key at all, and a list she already holds keeps her entry's identity.
     */
    setSuspicions: (charId: string, records: readonly Suspicion[]) => void;
    /**
     * Replaces the permanent memories those suspicions turned into; a list she already holds
     * keeps her entry's identity, for the same reason.
     */
    setJealousyMemories: (charId: string, entries: readonly CharMemory[]) => void;
    /** Applies the ledger's milestones for one character. */
    applyRelationshipEvents: (charId: string, events: readonly RelationshipEvent[]) => void;
    /** Writes the dating pass's replacement entries over the girls it touched. */
    applyDatingSettle: (outcome: DatingPassOutcome) => void;
    /** Marks the cast as having met the reader — run once the scene is over. */
    markMet: (charIds: readonly string[]) => void;
    /** Files the slot of the week the cast were just run into on, for the map and standing haunts. */
    markSeenAt: (charIds: readonly string[], slot: ShiftSlot) => string[];
    /** Re-derives the affection-driven flags for the cast at scene start. */
    refreshDerivedFlags: (charIds: readonly string[]) => void;
    /** Files a crush the ending rolled for her. Latches — a second call is a no-op. */
    setCrush: (charId: string) => void;
    /**
     * Steps every girl's new-crush and new-relationship scene count over the boundary, off the
     * entries she crossed it with and who was cast.
     */
    stepRomanceScenes: (before: Readonly<Record<string, CharInfo>>, charIds: readonly string[]) => void;
    /** Steps the break penalty of every girl in `charIds`, the cast, over the boundary. */
    stepBreakPenalties: (charIds: readonly string[]) => void;
    /** Records which upper halves of her tiers each girl is in, off her affection today. */
    observeUpperHalves: () => void;
    /** Files the secret the scene's one girl told in it as told. */
    tellSceneSecret: () => void;
    /** Marks every untold secret whose tier each girl stands in today as reached. */
    observeSecretTiers: () => void;
    /**
     * Appends one Bunnyboard message, creating the conversation on first use.
     * `unreadDelta` is 1 for a message that should light the badge, 0 otherwise.
     */
    appendChatMessage: (charId: string, message: ChatMessage, unreadDelta: number) => void;
    /** Takes one message out of a conversation by id; the unread count is left alone. */
    removeChatMessage: (charId: string, messageId: string) => void;
    /** The player opened the conversation — its unread count clears. */
    markConversationRead: (charId: string) => void;
    /** Banks a texting turn's merged recap on the conversation. */
    setConversationSummary: (charId: string, summary: string) => void;
    /** Raises, dismisses or clears her unanswered ask-out on the conversation. */
    setPendingHangout: (charId: string, hangout: Conversation['pendingHangout'] | null) => void;
    /**
     * Marks the newest text in her thread as the invitation it is, which is what the ask-out
     * cooldowns are counted off. A no-op unless that text is hers and unmarked.
     */
    markInvitation: (charId: string) => void;
    /** One more invitation of hers he did not take up. */
    bumpDeclined: (charId: string) => void;
    /** He came, so the streak and the memory it owed are gone. */
    resetDeclined: (charId: string) => void;
    /** A lover turned down by text, still owed her memory of it. */
    setTurnedDown: (charId: string) => void;
    /** Spends the turned-down mark once its memory has been filed. */
    clearTurnedDown: (charId: string) => void;
    /** Files the player's outgoing friend request. */
    markRequestSent: (charId: string) => void;
    /** Files her incoming friend request and lights the Friends badge. */
    receiveRequest: (charId: string) => void;
    /** Drops a pending request (either direction) once it resolves. */
    resolveRequest: (charId: string) => void;
    /** The player opened the Friends tab — its badge clears. */
    clearContactsBadge: () => void;
    /** She is on the reader's Bunnyboard now, whichever way it happened. */
    setGaveContactInfo: (charId: string) => void;
    /**
     * The reader knows her name — the route other than a scene line saying it: accepting a
     * request he sent to somebody whose feed account published it.
     */
    setNameKnown: (charId: string) => void;
    /**
     * Raises or clears her block on the reader. Only ever called with `true`: clearing is a
     * milestone and travels through `applyRelationshipEvents`.
     */
    setBlocked: (charId: string, value: boolean) => void;
    /** Sets or clears the ignored-invitation mark for one character. */
    setIgnoredInvitation: (charId: string, value: boolean) => void;
    /**
     * Retires the one-shot "she recently got a job" injection once a scene has carried it.
     * Idempotent.
     */
    clearNewJobNotice: (charId: string) => void;
    /** Files the plans a finished slot produced. Append-only. */
    addEvents: (events: readonly CalendarEvent[]) => void;
    /** The player opened the Calendar — every plan on it stops being new. */
    markEventsSeen: () => void;
    /** Records who the reader stood up by not spending the slot on this plan. */
    markEventNoShow: (eventId: string, charIds: readonly string[]) => void;
    /** Moves one plan to another slot — the one field of an event the player edits. */
    rescheduleEvent: (eventId: string, date: number, time: TimeSlot) => void;
    /**
     * The reader was hired. `settledThrough` is the slot he accepted in. An employer he worked
     * for before takes him back on the raises he left with and a clean record.
     */
    takeJob: (jobId: string, shifts: readonly ShiftSlot[], settledThrough: number) => boolean;
    /** Credits one worked shift and pays for it. Returns whether the streak just bought a raise. */
    recordShiftWorked: (slotId: number, pay: number) => boolean;
    /** Records a missed shift: one strike, and the raise streak back to zero. */
    recordStrike: (slotId: number) => void;
    /** The one setter for the rest of `JobState` — shifts, the excuse, the sweep's mark. */
    updateJob: (patch: Partial<JobState>) => void;
    /**
     * Fired or quit: drops the job, files it among his former jobs and closes that employer for
     * the semester — for good where he was fired.
     */
    endJob: (left: 'quit' | 'fired') => void;
    /** Files one meeting of one class. Write-once per date: a replayed boundary is inert. */
    recordClassMeeting: (code: string, meeting: ClassMeetingRecord) => void;
    /** Files a sat exam's tally. Write-once per period, on the same reasoning. */
    recordExam: (code: string, exam: ExamPeriod, record: ExamRecord) => void;
    /**
     * Credits one slot spent working on a project, and what the reader did with it.
     * **Deduped by the slot**: both halves of a day count, a replayed boundary does not.
     */
    recordProjectWork: (code: string, exam: ExamPeriod, date: number, time: TimeSlot, summary?: string) => void;
    /** Freezes an assessment's score, 0–100. Write-once. */
    setClassScore: (code: string, exam: ExamPeriod, score: number, heartTier?: StatTier) => void;
    /** Sets the reader's standing, and the one-shot guards on the two notifications. */
    setGradesStanding: (standing: 'good' | 'bad' | null) => void;
    /** Latches the expulsion ending's input. One-way — takes no argument. */
    setExpelled: () => void;
    setMidtermStandingDone: () => void;
    setFinalsScoresShown: () => void;
    /** Replaces the player's timetable during add/drop. */
    setPlayerSchedule: (schedule: Record<number, string>) => void;
    /**
     * Records classes as dropped, permanently. Idempotent: a code already recorded keeps
     * its `announced` flag.
     */
    recordDroppedClasses: (codes: readonly string[]) => void;
    /** Spends the one-shot cast-block line about a dropped class. Idempotent. */
    markDropAnnounced: (code: string) => void;
    /** Records classes as added at add/drop. Idempotent, on `recordDroppedClasses`' terms. */
    recordAddedClasses: (codes: readonly string[]) => void;
    /** Spends the one-shot CLASS-block line introducing him to an added class. Idempotent. */
    markAddAnnounced: (code: string) => void;
    /** Advances VenusBot's delivery watermark. Monotonic, like `settledThrough`. */
    advanceVenusThrough: (slot: number) => void;
    /** The same for BunnyBot's. */
    advanceBunnybotThrough: (slot: number) => void;
    /** Hands over one of the two granted sidebar apps. One-way and idempotent. */
    unlockBunnymap: () => void;
    unlockBunnyshop: () => void;
    /** Spends one of the five one-shot bot messages. One-way and idempotent. */
    markVenusJobIntroSent: () => void;
    markBunnybotContactIntroSent: () => void;
    markBunnybotFirstPostNudgeSent: () => void;
    markBunnybotTwoTimingTipSent: () => void;
    markBunnybotSeenTipSent: () => void;
    /**
     * Holds a BunnyMap handover that fired before BunnyBot introduced itself, and releases the
     * queue once it has. Queueing is a set union.
     */
    queueBunnybotDeferred: (handover: BunnybotHandover) => void;
    clearBunnybotDeferred: () => void;
    /** Replaces the whole pair map. Written whole: the settle pass folds every pair at once. */
    setNpcRelationships: (relationships: NpcRelationshipMap) => void;
    /** Files who is with whom this slot, or clears it. */
    setNpcOverlay: (overlay: NpcSlotOverlay | null) => void;
    /** Appends pairs that have just become friends for the first time. Never rewrites one. */
    recordNpcFriendships: (pairs: readonly NpcFriendship[]) => void;
    /** Files what this slot's opening said about somewhere, or clears it. */
    setSlotRumor: (rumor: SlotRumor | null) => void;
    /** Files an occasion he was asked to and did not go to. Appends once; a repeat is a no-op. */
    markOccasionDeclined: (occasionId: string) => void;
    /**
     * Snapshots the finishing slot's scene cast for the ask-out roll. Must run before
     * the clock or the cast moves — just ahead of `advanceSlot`.
     */
    recordLastSlotCast: () => void;
    /**
     * Marks everyone in `charIds` as having been out on the weekend `saturday` belongs to.
     * Idempotent.
     */
    recordWeekendOutings: (charIds: readonly string[], saturday: number) => void;
    /** The same for the break week's per-slot record. Idempotent. */
    recordOutingSlots: (charIds: readonly string[], slotId: number) => void;
    /** Files who leaves campus for spring break. One-way. */
    setSpringBreakAway: (charIds: readonly string[]) => void;
    /** Files the graduate back in town for Homecoming, or that nobody is. */
    setHomecomingVisitor: (charId: string | null) => void;
    /** Owes the next slot's opening the breakup texts of these lovers. */
    addBreakupsOwed: (breakups: readonly BreakupOwed[]) => void;
    /** Forgets every owed breakup, once an opening has been banked with their texts. */
    clearBreakupsOwed: () => void;
    /** Marks the graduation narration played, so a resumed epilogue skips it. */
    markGraduationSeen: () => void;
    /** Spends one goodbye off the epilogue's menu. Idempotent. */
    recordFarewell: (charId: string) => void;
    /** Claims the graduation picture for this epilogue. Idempotent. */
    markEndingArtWanted: () => void;
    /**
     * Takes `charIds` off every plan falling in `[fromDate, toDate)`, dropping a plan nobody is
     * left on.
     */
    withdrawFromEvents: (charIds: readonly string[], fromDate: number, toDate: number) => void;
    /** Appends one status update to a character's own feed, oldest first. */
    appendFeedPost: (charId: string, post: SocialPost) => void;
    /** Toggles the player's like on one of her posts. Inert for a post that is not there. */
    toggleFeedLike: (charId: string, postId: string) => void;
    /** Toggles the player's like on the day's random-student post. */
    toggleRandomPostLike: () => void;
    /** Files the day's transient feed items, stamped with the day they belong to. */
    setFeedExtras: (extras: FeedExtras | null) => void;
    /** Files the people the Friends tab offers this slot. */
    setSuggestions: (charIds: readonly string[]) => void;
    /** Opens an exam, or clears one at the boundary. */
    setSceneQuiz: (quiz: QuizState | null) => void;
    /** Banks one answer: advances the index and counts it if it was right. */
    answerQuiz: (correct: boolean) => void;
    /** Projects the persistable subset of state into a `GameSave`-shaped object. */
    toGameSave: (snapshot?: GameStoreState) => Omit<GameSave, 'playthroughId' | 'saveId' | 'saveDate'>;
}

/** Which optional image sets the New Character modal asked for. */
declare interface GenerateOptions {
    pe?: boolean;
    swim?: boolean;
    nude?: boolean;
    cgs?: boolean;
    room?: boolean;
}

/**
 * The gestures a control wears. Motion's hover and press listen on pointer events, which the
 * browser delivers to a *disabled* button too — only click is withheld — so a dead control is
 * handed {@link idle} rather than the lift, and never relies on the DOM to refuse.
 */
export declare function gestures(dead: boolean, hover: TargetAndTransition, tap: TargetAndTransition): {
    whileHover: TargetAndTransition;
    whileTap: TargetAndTransition;
    whileFocus: TargetAndTransition;
    'data-lift'?: '';
};

/** The closed vocabulary a gift is tagged with and a character states her taste in. */
declare const GIFT_CATEGORIES: readonly ['romantic', 'cute', 'luxury', 'glamour', 'cozy', 'practical', 'nerdy', 'artsy', 'treats', 'edgy', 'vintage', 'novelty'];

declare type GiftCategory = (typeof GIFT_CATEGORIES)[number];

/** What a character makes of gifts, per category. Both lists may be empty. */
declare interface GiftPreferences {
    liked: GiftCategory[];
    disliked: GiftCategory[];
}

/** The app's verdict on one handover, decided at gift time and never re-judged. */
declare type GiftReaction = 'loved' | 'liked' | 'neutral' | 'unimpressed';

/** Every other call's rewritable text: the personas, then the New Game calls' prose. */
declare const GLOBAL_TEXT_IDS: readonly ['persona.solo', 'persona.texting', 'persona.narration', 'persona.designer', 'newgame.classes.system', 'newgame.classes.additions', 'newgame.classes.instructions', 'newgame.profiles.system', 'newgame.profiles.additions', 'newgame.profiles.instructions', 'newgame.profiles.housing', 'newgame.profiles.freeTime', 'newgame.profiles.handle', 'newgame.profiles.springBreak', 'newgame.profiles.next.newcomers', 'newgame.profiles.next.housing', 'newgame.profiles.next.graduates', 'newgame.occasions.system', 'newgame.occasions.additions', 'newgame.occasions.instructions', 'newgame.occasions.fillers', 'newgame.occasions.gala', 'newgame.occasions.dance', 'newgame.occasions.careerFair', 'newgame.occasions.concert', 'newgame.secrets.system', 'newgame.secrets.additions', 'newgame.secrets.instructions', 'newgame.secrets.tiers'];

declare type GlobalTextId = (typeof GLOBAL_TEXT_IDS)[number];

declare interface GrowthTag {
    id: string;
    name: string;
    description: string;
    reframes: string[];
}

/** What a girl asking him out of nowhere asks him to, when the app rolled her anything. */
declare type HangoutInvite = {
    kind: 'herRoom';
} | {
    kind: 'hisRoom';
}
/** An exam in a lecture class the two of them take, and the slot it is sat in. */
| {
    kind: 'study';
    className: string;
    exam: ExamPeriod;
    date: number;
    time: TimeSlot;
}
/** A location id off the map. */
| {
    kind: 'outing';
    location: string;
} | {
    kind: 'everyday';
    ask: EverydayAsk;
};

/** What the classifier decided, once the two flags are collapsed. */
export declare interface HangoutVerdict {
    /** Who did the proposing — the arm-now path, or the Yes/No path. */
    initiatedBy: 'player' | 'contact';
    /** The plan in one sentence; the scene's opening action. */
    description: string;
}

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
/** The thread and invitation behind a texting classifier's verdict. */
export declare interface HangoutVerdictCtx {
    charId: string;
    /** Who sent the first text of this slot's thread: the reader, or her (a reach-out, an invitation, a reply). */
    startedBy: 'reader' | 'her';
    /** The exchange answers an invitation of hers still standing. */
    answeringInvite: boolean;
}

/** Whether the host supports the restricted auxiliary-window bridge. */
export declare function hasDesktopSurfaces(): boolean;

/**
 * Whether the reader and she have actually texted — a summary, or a player/contact message.
 * A thread holding only the app's own friend-request/block system lines doesn't count.
 */
export declare function hasTexted(conversation: Conversation | undefined): boolean;

/** One slot of a character's week: where she is and why she is there. */
declare interface Haunt {
    /** A location id (`shared/locations.ts`) or `'room'`. */
    location: string;
    kind: HauntKind;
    /** Activity only: what she does there, as the profile call wrote it — "sketching at the Whitman Greenhouse". */
    doing?: string;
}

/** What a standing haunt is for: the menu it was dealt from. */
declare type HauntKind = 'fun' | 'study' | 'activity' | 'meal' | 'grocery' | 'room';

/**
 * The heart takes a weight because it is drawn at two sizes: a stat badge's 26px, and most of
 * the stage behind a milestone, where the mark's own 2.5 is a band rather than a line.
 */
export declare function HeartIcon({ className, strokeWidth }?: MarkProps): JSX.Element;

/**
 * Holds the reader's turn while a mod settles something of its own, as the game holds it while a
 * turn is taken: the scene reads as busy, and no turn, hangout or autosave starts. Taken only at
 * the reader's own turn, in the playthrough or a created scene. The release it returns gives the
 * turn back, once; after the scene is left it does nothing. Refused with `MOD_WRITE_OFF`, `MOD_WRITE_NO_GAME` or, away from his turn,
 * `MOD_WRITE_WAIT`. @since 0.8.0
 */
export declare function holdTurn(modId: string): Result<() => void>;

/** Whether the selected image API has credentials configured, not a connectivity check. */
export declare function imageApiConfigured(): boolean;

/**
 * One kiss or one night the ledger reported: who was in it (two or more is a group act) and
 * whether anybody not taking part could have seen it.
 */
declare interface IntimateAct {
    kind: ActKind;
    inPublic: boolean;
    charIds: string[];
}

/** A contact this slot rolled in to text the reader an invitation. */
declare interface IntroAsker {
    character: Character;
    info: CharInfo;
    /** How the reply names her back — resolved through `charKeyToId`. */
    charKey: string;
    /** Whether a Bunnyboard thread with her already holds anything (`hasTexted`). */
    texted: boolean;
    /**
     * The plan she is texting about, when a plan is why she is texting at all.
     * Absent for a contact the slot's roll picked out of nowhere.
     */
    plan?: CalendarEvent;
    /**
     * The class or the shift she has in the slot, beside a {@link plan} she is meeting him before
     * or after. Absent when she is free.
     */
    commitment?: Commitment;
    /**
     * The occasion she is asking him to, on a slot one is on and he is free to go. Absent
     * for a girl asking about anything else.
     */
    occasion?: Occasion;
    /**
     * What the app rolled her invitation into, for a girl asking about neither a plan nor an
     * occasion. Absent when the roll landed nothing and she asks what she likes.
     */
    invite?: HangoutInvite;
    /**
     * Where she is texting from, who is with her, and what she is there for when the place is
     * her own haunt. Absent for a slot nothing places her in, which is most of them.
     */
    whereabouts?: {
        location: string;
        companions: NpcCompanions;
        haunt?: Haunt;
    };
}

/** A lover the reader left this slot for somebody else, who is texting him to end it. */
declare interface IntroBreakup {
    character: Character;
    info: CharInfo;
    /** How the reply names her back — resolved through `charKeyToId`. */
    charKey: string;
    /** Whether a Bunnyboard thread with her already holds anything (`hasTexted`). */
    texted: boolean;
    /** The first name of the girl he started dating instead. */
    forFirstName: string;
}

/** A contact leaving campus for spring break, texting the reader that she is going. */
declare interface IntroLeaver {
    character: Character;
    info: CharInfo;
    /** How the reply names her back — resolved through `charKeyToId`. */
    charKey: string;
    /** Whether a Bunnyboard thread with her already holds anything (`hasTexted`). */
    texted: boolean;
}

/**
 * A character posting a status update this slot. A girl doing both is in this list and
 * the askers'; `LOREBOOK` describes her once.
 */
declare interface IntroPoster {
    character: Character;
    info: CharInfo;
    /** How the reply names her back — resolved through `charKeyToId`. */
    charKey: string;
    /** Whether a Bunnyboard thread with her already holds anything (`hasTexted`). */
    texted: boolean;
    /** Where she is, who with, and what she is there for, when the slot places her anywhere. */
    whereabouts?: {
        location: string;
        companions: NpcCompanions;
        haunt?: Haunt;
    };
}

/** A contact this slot rolled in to text the reader just to talk, about one rolled topic. */
declare interface IntroReachOut {
    character: Character;
    info: CharInfo;
    /** How the reply names her back — resolved through `charKeyToId`. */
    charKey: string;
    /** Whether a Bunnyboard thread with her already holds anything (`hasTexted`). */
    texted: boolean;
    /** What she is texting him about. */
    topic: ReachOutTopic;
    /** Her TEXTING HISTORY lines: what the two of them last texted about, and when. */
    thread: readonly string[];
    /** Where she is, who with, and what she is there for, when the slot places her anywhere. */
    whereabouts?: {
        location: string;
        companions: NpcCompanions;
        haunt?: Haunt;
    };
}

/** A graduate back in town for Homecoming, texting the reader that she is here. */
declare interface IntroVisitor {
    character: Character;
    info: CharInfo;
    /** How the reply names her back — resolved through `charKeyToId`. */
    charKey: string;
    /** Whether a Bunnyboard thread with her already holds anything (`hasTexted`). */
    texted: boolean;
}

/** What an invitation out of nowhere may be rolled into asking; appended, never reordered. */
declare const INVITE_KINDS: readonly ['herRoom', 'study', 'hisRoom', 'outing', 'everyday'];

/** One of {@link INVITE_KINDS}. */
declare type InviteKind = (typeof INVITE_KINDS)[number];

/** A mod's own main handler, over the fixed invoke channel; failures always answer as a Result. */
export declare function invoke<T>(modId: string, name: string, args: unknown[], options?: {
    signal?: AbortSignal;
}): Promise<Result<T>>;

/** Whose feed the tab lists outright: he has her number and she has not blocked him. */
export declare function isFeedContact(info: CharInfo | undefined): boolean;

/**
 * The end of the semester: the last fortnight's dates, and every sentence said about a
 * term running out.
 */
/** Graduation morning — the slot the game ends in. */
export declare function isGraduationSlot(date: number, time: TimeSlot): boolean;

/** Whether a block belongs to a New Game call, and so to the New Game page rather than Other prompts. */
export declare function isNewGameBlock(block: PromptBlock): boolean;

/**
 * The authored opening of a playthrough: the arrival scroll and the
 * orientation scene that follows it, then the four lines that welcome him home that night.
 */
/**
 * The playthrough's first slot — the arrival scroll and freshman orientation. A later
 * semester's first slot is an ordinary one.
 */
export declare function isOrientationSlot(date: number, time: TimeSlot, semesterIndex: number): boolean;

/** One inventory line as picked: the item, and who gave it to him and when for a present. */
declare type ItemPick = Omit<OwnedItem, 'count'>;

/**
 * The reader's standing employment — only what a playthrough accumulated; the catalog
 * entry behind `jobId` (`shared/jobs.ts`) owns pay, requirements and every word the boss says.
 */
declare interface JobState {
    /** A `JOB_CATALOG` id. */
    jobId: string;
    /** The shifts he is rostered for, ascending. */
    shifts: ShiftSlot[];
    /** A requested roster, swapped into `shifts` on the next Sunday Day. */
    pendingShifts?: ShiftSlot[];
    /**
     * The boss has acknowledged the request pending above — set at the slot boundary after it
     * was made, cleared by the Sunday swap.
     */
    shiftChangeApproved?: boolean;
    shiftsWorked: number;
    /** Total dollars this job has paid him. */
    earned: number;
    /** Raises taken, capped at `MAX_RAISES`; each is 20% of the job's base pay. */
    raises: number;
    /** Clean shifts since the last raise or strike. */
    streak: number;
    /** Missed shifts; he is let go at `MAX_STRIKES`. */
    strikes: number;
    /** The one sick-call the boss believes has been spent. */
    sickUsed: boolean;
    /** The global slot id (`date * 2 + time`) a sick-call excused, if any. */
    excusedSlot?: number;
    /** The global slot id a "I'm sick." was last sent in, believed or not. */
    sickTextedSlot?: number;
    /** The `startDate` of the closure the boss has already texted about. */
    holidayNoticeDate?: number;
    /** The last global slot id the sweep has already judged. */
    settledThrough: number;
    /** Global slot ids credited as worked. */
    workedSlots: number[];
}

/** What one button kept: the edit it sent, and the default part of its two shared groups. */
declare type KeptEdit = PromptEdit & {
    sentDefaults?: SentDefaults;
};

/** One tool in the landing's corner, as the game draws its own: icon only, its label on a hover. */
export declare interface LandingToolProps {
    label: string;
    onClick: () => void;
    children: ReactNode;
}

/**
 * The bookkeeping reply for a finished slot: what the characters remember,
 * which milestones were passed, what the hour did for the reader, and what he agreed to later.
 */
declare interface LedgerResponse {
    /** Untrusted optional extraction, validated against scene evidence at the boundary. */
    exStoryFacts?: unknown;
    /** Both cast-scoped arrays are absent for a solo scene, whose schema omits them. */
    memories?: Array<{
        charKey: string;
        type: MemoryType;
        desc: string;
    }>;
    events?: Array<{
        charKey: string;
        event: RelationshipEvent;
    }>;
    /**
     * Every kiss and every night the hour held, one row per kind per set of girls; absent for a
     * solo scene, whose schema omits it.
     */
    acts?: Array<{
        kind: ActKind;
        inPublic: boolean;
        chars: string[];
    }>;
    /**
     * What this slot's texting left each girl with — one per character, at most. The texting
     * ledger's field, scoped to whoever actually texted this slot.
     */
    textMemories?: Array<{
        charKey: string;
        type: MemoryType;
        desc: string;
    }>;
    /**
     * The plans the slot settled on — the scene's from the scene ledger, the texts'
     * from the texting ledger, deduped by the merge.
     */
    plans?: Array<{
        slot: number;
        title: string;
        description: string;
        chars: string[];
    }>;
    /**
     * Which stats the scene exercised — what each is worth, and how many of them count, is the
     * app's to decide.
     */
    stats?: LedgerStats;
    /**
     * Dollars the reader personally spent in this scene; the schema floors it at 0 and
     * nothing caps it.
     */
    spent?: number;
    /**
     * Whether the reader was **caught** at an expellable offense in this scene — the
     * input to the expulsion ending.
     */
    expelled?: boolean;
    /** What happened in the class the reader sat through, one or two sentences. */
    classSummary?: string;
    /**
     * The one thing he learned there that had not come up before — a lecture class only. A status
     * message the player reads, and the pool that class's exam questions are drawn from.
     */
    classFactoid?: string;
    /**
     * The scene's recap, asked only of a scene ended by hand whose running summary falls short of
     * it. Filed as the scene's summary and never banked.
     */
    summary?: string;
}

/** Which stats the scene exercised, as the ledger reported them. */
declare type LedgerStats = Partial<Record<StatKey, boolean>>;

/**
 * The player has Less NSFW text on: the game's own writing is toned down, and a mod's should be.
 * True until the settings have been read, so nothing explicit is written before they are known.
 */
export declare function lessNsfwText(): boolean;

/** Hover on a paper control: it lifts off the table and its shadow swings out from under it. */
export declare const lift: TargetAndTransition;

/**
 * One picture at the size it was drawn, over the page. Anywhere outside it closes it.
 *
 * Shared rather than owned by a screen: her gallery opens one, and so does a photograph on the
 * feed, and a second copy of this would be a second way for the same picture to look different.
 */
export declare function Lightbox({ src, onClose }: {
    src: string;
    onClose: () => void;
}): JSX.Element;

/** A post's likes, for the posts the game rolls likes for outside the slot's opening. */
export declare interface LikesAsk {
    kind: 'ending' | 'stranger' | 'winter';
    /** Her id, or the stranger's handle. */
    author: string;
    character?: Character;
    playthroughId?: string | null;
    /** How many of the cast are her friends. */
    friends: number;
}

/** Selected local rendering source, or null until settings load; no address or secrets. */
export declare function localImageSource(): 'managed' | 'external' | null;

/** Something she has not told him yet, drawn as the gap it is with its own condition named. */
export declare function Locked({ children }: {
    children: ReactNode;
}): JSX.Element;

/** One lorebook entry: what triggers it, and what gets injected when it does. */
declare interface LoreEntry {
    /**
     * Trigger words, matched case-insensitively on word boundaries with an optional plural
     * suffix on the last word; irregular plurals are carried as extra keys.
     */
    keys: readonly string[];
    /**
     * A stable handle for a caller holding a *place* rather than a turn's words —
     * `shared/locations.ts`, `JobDef.locationId`, and the classifier's answer.
     */
    id?: string;
    /** Injected verbatim; it already names its own subject, so it needs no label. */
    text: string;
    /**
     * The background the writer is pointed at for it, printed after it in a scene call: free text
     * on a shipped entry, one background's name on one of the player's.
     */
    bg?: string;
}

/** What the slot's opening put about somewhere, ready to ride that place's entry. */
declare interface LoreRumor {
    placeId: string;
    sentence: string;
}

/** Whether a manual save can be taken now, has to wait for the loop to settle, or never can. */
export declare type ManualSaveOffer = 'open' | 'waiting' | 'none';

/** A mark a caller may recolour and reweight; every other one takes {@link APP_MARK} whole. */
declare interface MarkProps {
    className?: string;
    strokeWidth?: number;
}

declare interface MeanwhileLine {
    speaker: string;
    text: string;
}

declare interface MeanwhileScene {
    id: string;
    date: number;
    participants: [string, string];
    title: string;
    where: string;
    positive: boolean;
    ref: string;
    kind: NpcEncounter['kind'];
    lines: MeanwhileLine[];
    origin?: TermOrigin;
    participantNames?: Record<string, string>;
}

/** Optional dramatizations, not witnessed events or authoritative story memories. */
declare interface MeanwhileStore {
    version: 1;
    scenes: MeanwhileScene[];
}

/** How many memories per character a cast scene's prompt carries, by cast size; absent is the default. */
declare interface MemoryBudgets {
    one?: number;
    two?: number;
    three?: number;
}

/** The boundary's memory question as data — its rows off the ledger, and what the answers change. */
/** One row of the question: who, and the memory the ledger filed that the row stands for. */
declare interface MemoryEditRow {
    charId: string;
    applied: CharMemory | null;
}

/**
 * A character's remembered events under their own heading; no memories, no heading. The
 * texting memory is told apart by identity, which the merge and the fold both keep.
 */
export declare function memoryLines(character: Character, memories: readonly CharMemory[], textMemory: CharMemory | undefined, season: Season): string[];

/** Kind of memory recorded against a character at scene end. */
declare type MemoryType = 'liked' | 'disliked' | 'loved' | 'hated';

/** What a modal needs to mount itself: the portal host, and the dimming's handlers. */
export declare interface ModalShell {
    /** `null` until the host is resolved, which is one render — portal nothing before that. */
    host: HTMLElement | null;
    overlayProps: {
        onMouseDown: MouseEventHandler<HTMLElement>;
        onClick: MouseEventHandler<HTMLElement>;
        /** The whole veil, while it is leaving: no clicks, no focus, no keys. */
        inert: boolean;
    };
    /**
     * Spread on the motion element that carries the primary button, where a modal hands the shell
     * a `primary`: its landing arms Enter and Space, and the controls inside it are the modal's own.
     */
    primaryProps: {
        ref: (node: HTMLElement | null) => void;
        onAnimationComplete: (definition: AnimationDefinition) => void;
    };
    /** Whether nothing stands over this modal, for a key of its own it answers only on top. */
    topmost: () => boolean;
}

/**
 * A mod's own data in a save, kept under the mod's id in the save's `ex`, and on the records
 * inside it. Core never reads inside a slice: it writes each one back as read, and only the mod
 * that registered the field turns it into a value. Every value is plain JSON.
 */
/** A record that can carry mods' slices: the save, a character, a memory, a message, a post. */
export declare interface ModDataRecord {
    /** The mods' slices on the record, by mod id. */
    ex?: Record<string, ModSlice>;
}

declare interface ModDef {
    /** Stable, lower case with dashes: it is written to disk, so it never changes once shipped. */
    id: string;
    name: string;
    author: string;
    version: string;
    scope: ModScope;
    /** Whether the mod is on for a player who has never touched its switch. */
    defaultOn: boolean;
    /** What the mod does, in a sentence or two. */
    blurb: string;
    /** What switching it off leaves alone, where a player might fear otherwise. */
    offNote?: string;
    /** Hook and kit API declarations, as in vxmod.json; needed by a built-in main entry. */
    hooks?: readonly string[];
    /** Mods this one cannot act without, by id. */
    requires?: readonly string[];
    options?: readonly ModOption[];
    /** The groups its options name, by id. */
    optionGroups?: readonly ModOptionGroup[];
    /**
     * A library: no switch and no row on the Mods screen. It is on while a mod that is on requires
     * it, and its exports are what the mods that require it import.
     */
    library?: boolean;
}

/** What the Mods screen hands a mod's own page ({@link ModHooks.modDetail}). */
export declare interface ModDetailProps {
    /** The mod picked in the list. */
    mod: ModDef;
    /** The screen's own switch, so a page's switches are the screen's. */
    Switch: ComponentType<{
        id: string;
        label: string;
        on: boolean;
        disabled?: boolean;
        onChange: (on: boolean) => void;
    }>;
    /** Whether one of the picked mod's options is on. */
    optionOn: (optionId: string) => boolean;
    /** Moves one, by the screen's own way of making a change: asked first where it costs something. */
    setOption: (optionId: string, on: boolean) => void;
}

export declare interface ModHooks {
    /** Return false to omit this scene row before projection and settlement. */
    keepSceneLedgerEntry?: (entry: Readonly<SceneLedgerEntry>) => boolean;
    /**
     * Captured synchronously when core builds a prompt's state, before asynchronous request work.
     * Return a structured-cloneable value (or undefined to omit it). Core copies the value into
     * `state.ex[modId]`; formatters read that copy, not live mod state. Never write game state here.
     * Scene includes solo, continuation and closing requests built from the scene snapshot.
     */
    promptState?: {
        scene?: () => unknown;
    };
    /** Activities the landing may offer for a stat, in place of its own suggestion. */
    statActivities?: (stat: StatKey) => readonly SlotActivityOffer[];
    /** Whether an activity offered is still there, asked at commit and on reload. */
    slotActivityAvailable?: (offer: SlotActivityOffer) => boolean;
    bunnyboardPage?: BunnyboardPage;
    /** A page beside the feed in the Updates tab; see {@link UpdatesTab}. */
    updatesTab?: UpdatesTab;
    /** Draws the comments under a post; see {@link PostCommentsSpot}. */
    postComments?: PostCommentsSpot;
    /** An emoji tool beside a box being typed in, in place of the phone's own row of emoji. */
    emojiTool?: ComponentType<EmojiToolProps>;
    /** Draws what somebody sent; see {@link SentTextSpot}. */
    sentText?: SentTextSpot;
    /** Draws a post's picture under its text, wherever a post is drawn; the first mod on decides. */
    postPicture?: ComponentType<PostPictureProps>;
    /** Extend a completed request, preserving other mods' additions. */
    requests?: {
        [S in keyof RequestSpots]?: (request: StructuredRequest, ctx: RequestSpots[S]) => StructuredRequest;
    };
    /** After bookkeeping settles, before the clock advances and the boundary save is written. */
    slotSettled?: (ctx: SlotSettled) => void;
    /**
     * Lines in the slot's closing report, after what each girl took away from it, written as the
     * game writes its own (`memoryStatusLine`). `nextSlot` is the global slot about to begin.
     */
    slotStatusLines?: (ctx: {
        nextSlot: number;
    }) => readonly SceneLine[];
    /**
     * Apply the same memory weights as settlement to a projection. Must return new values
     * without writing the store, paying rewards, consuming abilities or rolling randomness.
     */
    projectSlotMemories?: (ctx: SlotMemoryProjection, charInfo: Record<string, CharInfo>) => Record<string, CharInfo>;
    /**
     * Change what the hour exercised, before the game resolves what that pays: the ledger's verdict
     * on which stats the scene worked, or undefined where it gave none. A scene whose exercise is
     * something other than what the ledger saw — a game played to train a stat, say — says so here,
     * and every mod settling afterwards sees it as the ledger. Runs for the projections before the
     * ending too, so it must return new values without writing the store or rolling randomness.
     */
    exercisedStats?: (ledger: LedgerStats | undefined, ctx: StatContext) => LedgerStats | undefined;
    /**
     * Change what a finished scene does to the reader's stats, after the game has resolved what the
     * exercise pays. Runs for the projections before the ending as well as for the settlement
     * itself, so it must return new values without writing the store, paying rewards or rolling
     * randomness. What the hour exercised is `exercisedStats`'s to change, not this hook's.
     */
    settleSceneStats?: (resolved: SceneStats, settlement: SceneStatSettlement) => SceneStats;
    /** The lowest a stat may fall to; the first mod that answers decides. */
    statFloor?: (key: StatKey) => number | undefined;
    prompts?: {
        [S in PromptSpot]?: PromptAddition<PromptSpots[S]>;
    };
    /** Added to a DM in the history a prompt quotes, after its text. */
    dmHistoryNote?: (message: ChatMessage) => string;
    /** Fields of a generated character taken from what the reply wrote. */
    characterFromDraft?: (draft: Readonly<Record<string, unknown>>, ctx: {
        baseAppearance: readonly string[];
    }) => Partial<Character>;
    /**
     * Top-level DM fields streamed before her messages. A lead's work ends at afterDmReply or
     * this signal, whichever comes first. The signal aborts if the reply does not land; a landed
     * reply does not abort it.
     */
    dmReplyLead?: (ctx: {
        charId: string;
        character: Character;
        lead: Readonly<Record<string, unknown>>;
        signal: AbortSignal;
    }) => void;
    /** Change or drop the texting classifier's verdict before it arms a hangout or raises an invitation. */
    hangoutVerdict?: (verdict: HangoutVerdict | null, ctx: HangoutVerdictCtx) => HangoutVerdict | null;
    /** After her reply in a DM has landed. */
    afterDmReply?: (ctx: {
        charId: string;
        character: Character;
        reply: TextingResponse;
    }) => void;
    /** After a scene reply has landed and its lines are on the transcript. */
    afterSceneReply?: (ctx: SceneReplied) => void;
    /** A seat on the scene's rail, and the panel it opens over the scene. */
    scenePlay?: ScenePlay;
    /**
     * Panels over the game view, by id, which {@link openPanel} opens as one of the view's own: the
     * scene behind takes nothing while one is up. One panel per id, the first mod's that is on.
     */
    gameModals?: Record<string, ComponentType<GameModalProps>>;
    /** Drawn on the scene's rail, after the Calendar and before the mods' scene seats (`scenePlay`). */
    railButton?: ComponentType<ScreenSlotProps['railButton']>;
    /** Drawn among the landing's tools, after the log and before Settings. */
    landingTool?: ComponentType<ScreenSlotProps['landingTool']>;
    /** Drawn in the game menu, after Mods and before Controls. */
    gameMenuEntry?: ComponentType<ScreenSlotProps['gameMenuEntry']>;
    /**
     * After the texts of a girl reaching out just to talk have landed. `reply` is her entry from the
     * slot's opening, with whatever fields `prompts['slot-reach-outs']` added to it.
     */
    afterReachOut?: (ctx: {
        charId: string;
        character: Character;
        reply: Readonly<Record<string, unknown>>;
    }) => void;
    /** As the reader commits to something: an action sent, a hangout begun, or Relax. */
    playerActs?: () => void;
    /** As a game is entered, new or loaded. */
    gameEntered?: () => void;
    /** A post from the slot's opening, before it is filed. */
    fileFeedPost?: (filing: PostFiling, ctx: {
        nudge: (charId: string) => void;
    }) => void | Promise<void>;
    /** A post's likes; the first mod that answers decides. */
    postLikes?: (ask: LikesAsk) => number | undefined;
    /** Whether a post is on her feed yet; every mod has to agree. */
    postVisible?: (post: SocialPost) => boolean;
    /** When a post came out after its slot began (ms since epoch); the first mod that answers. */
    postOutAt?: (post: SocialPost) => number | undefined;
    /** A way on from the ending, beside the menu; the first mod that answers is offered. */
    endingChoice?: (ctx: {
        reason: GameOverReason;
        playthroughId: string | null;
    }) => EndingChoice | undefined;
    /**
     * A page of its own on the Mods screen for the mod picked there, its own or one that builds on
     * it, drawn where that mod's options would be listed. The same component every time it is
     * asked for the same mod; undefined for a mod it has nothing to say about.
     */
    modDetail?: (mod: ModDef) => ComponentType<ModDetailProps> | undefined;
    /**
     * A preview drawn under one of its option groups on the Mods screen, by the group's id, of
     * whichever option is picked. Asked whether or not the mod is on, so it shows before it is.
     */
    optionPreviews?: Record<string, ComponentType<OptionPreviewProps>>;
    /** An offer for a save picked in Load Game, beside loading it; the first mod that answers. */
    saveChoice?: (ctx: {
        playthroughId: string;
        save: ResolvedSave & {
            record: PlaythroughRecord;
        };
    }) => SaveChoice | undefined;
    /** A line on Save Game about what a save of the scene keeps of the mod's own; null for none. */
    saveNote?: (scene: Readonly<ModSceneFields>) => string | null;
    /** Drawn in app settings, in the Game tab under the volume sliders. */
    settingsSection?: ComponentType<ScreenSlotProps['settingsSection']>;
    /** Drawn in each portrait on the stage, under her sprite. */
    portraitOverlay?: ComponentType<ScreenSlotProps['portraitOverlay']>;
    /** Mounted in the phone's veil for as long as the phone is open. */
    phoneOverlay?: ComponentType<ScreenSlotProps['phoneOverlay']>;
    /** Below a person's message history, before the native composer. Not drawn for bot threads. */
    conversationFoot?: ComponentType<ScreenSlotProps['conversationFoot']>;
    /** Drawn beside the Chats title while the conversation list is showing. */
    chatsHeader?: ComponentType<ScreenSlotProps['chatsHeader']>;
    /** Drawn on the map, under the places and above its foot. */
    mapOverlay?: ComponentType<ScreenSlotProps['mapOverlay']>;
    /** Drawn on the Photos page, under the grid of photos. */
    photosPageSection?: ComponentType<ScreenSlotProps['photosPageSection']>;
    /** Drawn first among her images, in the character editor and in the character view. */
    editCharacterImages?: ComponentType<ScreenSlotProps['editCharacterImages']>;
    /** A field of the mod's own in the character editor, saved with her; see {@link EditorField}. */
    editorField?: EditorField;
    /** Mounted over the stage and under the scene's chrome, on every screen of the game view. */
    stageLayer?: ComponentType<ScreenSlotProps['stageLayer']>;
    /** Mounted among the game view's panels, over the chrome, on every screen of the game view. */
    panelLayer?: ComponentType<ScreenSlotProps['panelLayer']>;
    /** Drawn after a phone message's text bubble, or alone where the message has no text. */
    messageAttachment?: ComponentType<ScreenSlotProps['messageAttachment']>;
    /** Drawn beside a post's like, in the feed on her contact page. */
    contactPostExtra?: ComponentType<ScreenSlotProps['contactPostExtra']>;
    /** A reading of her of the mod's own on her contact page; see {@link ContactTab}. */
    contactTab?: ContactTab;
    /** Drawn on the Advanced tab of app settings, after Upload custom BG and Edit system prompt. */
    advancedSettingsEntry?: ComponentType<ScreenSlotProps['advancedSettingsEntry']>;
    /** The game's prompt text as the mod rewrites it; see {@link PromptTextSpot}. */
    promptText?: PromptTextSpot;
    /**
     * A scene call about to go out: what the mod returns is copied onto the request for its
     * main-process request hook, and never sent. Undefined tags nothing.
     */
    sceneCall?: (ctx: SceneCall) => unknown;
    /** Every scene call's reply once its lines are on the transcript, the closing's included. */
    sceneReplyLanded?: (ctx: SceneReplyLanded) => void;
    /** The scene's transcript was cut back to `length` lines, by an interjection or a rewind. */
    sceneCut?: (ctx: {
        length: number;
    }) => void;
    /**
     * The mod has come on: at boot, before the first screen and waited for, or later, as its switch
     * or the game's record turns it on. Told once each time, never while it stays on.
     */
    switchedOn?: (ctx: {
        atBoot: boolean;
    }) => void | Promise<void>;
}

/** Whether a mod is on, for code outside a component; see `modOn` for what a record changes. */
export declare function modIsOn(id: string, record?: Pick<PlaythroughRecord, 'mods'> | null): boolean;

/** One yes-or-no setting of a mod's own. */
declare interface ModOption {
    id: string;
    label: string;
    /** What the other position does, in a line. */
    hint: string;
    default: boolean;
    /**
     * Options of one mod that share a group are one choice: one of them is on at a time. Turning
     * one on turns the others off, and the one that is on stays on until another is picked. The
     * Mods screen shows them together, under the group's own label and hint.
     */
    group?: string;
}

/** What a group of options is, shown once above them. */
declare interface ModOptionGroup {
    id: string;
    label: string;
    hint: string;
}

/** Where a mod's option stands outside a component, using its declared default when unset. */
export declare function modOptionOn(modId: string, optionId: string): boolean;

/**
 * What the switches add to an on-disk playthrough. The record extends this named shape so
 * declaration bundlers retain these fields for standalone kit consumers; an ambient module
 * augmentation works inside the game but is lost from the rolled-up declarations.
 */
declare interface ModPlaythroughFields {
    /**
     * The `playthrough` mods this playthrough started with, by id. Absent where none were on,
     * and on every record written before the list existed.
     */
    mods?: string[];
    /**
     * The version of every mod on when this playthrough started, `playthrough` and `anytime`
     * alike, by id; empty where none were on. Absent only on a record written before mods
     * recorded their versions.
     */
    modVersions?: Record<string, string>;
}

/** Optional scene data declared by mods in their own modules, saved and restored with the scene. */
declare interface ModSceneFields {
}

/**
 * When a mod's switch takes effect.
 *
 * - `anytime`: read where the mod acts, so it can be turned on or off whenever the player likes.
 * - `playthrough`: fixed when a playthrough starts, for a mod whose saves depend on it. The
 *   switch is what a new playthrough gets; one already started keeps what it started with.
 */
declare type ModScope = 'anytime' | 'playthrough';

/**
 * One mod's data on a record, under the mod's id in the record's `ex`: what the mod wrote, and
 * the version of the mod that wrote it, so a later version can read an older shape.
 */
declare interface ModSlice {
    /** The version of the mod that wrote `data`. */
    v: string;
    /** What the mod wrote, plain JSON; core never reads inside it. */
    data: unknown;
}

/** The mods that are on, each with its version, as the game's log lists them: for a bug report. */
export declare function modsOnLine(): string;

/**
 * A mod's unsaved state, registered once from its own files. During an installed mod's import, a
 * state under another id is refused, as is a second state under one id (which throws for an
 * in-repo mod, whose bug it is); a refused state holds `initial` and changes nothing.
 */
export declare function modState<T>(modId: string, spec: ModStateSpec<T>): ModStateHandle<T>;

/** A mod's unsaved state, from {@link modState}. */
export declare interface ModStateHandle<T> {
    /** The value now. */
    get(): T;
    /** Replaces the value, telling every subscriber. */
    set(next: T): void;
    /** The value, for a component: it renders again when the value changes. */
    use(): T;
    /** Calls back with the value each time it changes; returns the unsubscribe. */
    subscribe(onChange: (value: T) => void): () => void;
}

/**
 * A mod's own state in the window that is never saved: not in a save, not in a backup. `game`
 * state goes back to its `initial` whenever a game is entered or left; `session` state lasts
 * until the window closes.
 */
/** How a mod's unsaved state starts, and how long it lasts. */
export declare interface ModStateSpec<T> {
    /** The value it starts at, and goes back to. */
    initial: T;
    /** `game`: back to `initial` as a game is entered or left. `session`: kept until the window closes. */
    lifetime: 'game' | 'session';
}

declare type NativeCharacterTrait = (typeof CHARACTER_TRAITS)[number];

/** On-disk save file — `/data/saves/{playthroughId}/{saveId}.json`. */
declare interface NativeGameSave {
    schemaVersion: 13;
    /**
     * The playthrough this save belongs to. Derived from the containing folder
     * name on read, so the copy written into the file is never authoritative.
     */
    playthroughId: string;
    /**
     * The id of the semester the save is in, a key of {@link PlaythroughRecord.semesters};
     * absent in the playthrough's first semester.
     */
    semester?: string;
    /**
     * `Date.now().toString()` for a slot-save, incremented on filename collision
     * until free; the literal `autosave` for the in-progress-scene save; `manual01` on
     * for the player's own saves, one per manual slot.
     */
    saveId: string;
    /** Epoch ms, last modified. */
    saveDate: number;
    /**
     * The reader's three stats, in accumulated points; tiers are derived by `tierOf()` and
     * never stored.
     */
    stats: PlayerStats;
    /** The reader's balance in dollars. */
    money: number;
    /**
     * The reader's own words about himself, written at New Game and rewritten on his profile;
     * absent in saves from before it.
     */
    bio?: string;
    /** What the playthrough has counted up about him; absent in saves from before them. */
    tallies?: ReaderTallies;
    /** Days elapsed in the save's semester; day 0 is its first Monday, January 19 or August 17. */
    date: number;
    time: TimeSlot;
    /** The moving half of every character's entry; the settled half is the record's. */
    charInfo: Record<string, CharState>;
    /**
     * The player's own timetable: sparse `ClassSlot` → class code, chosen on the Class Select View
     * and revisable through VenusBot up to the add/drop deadline.
     */
    playerSchedule: Record<number, string>;
    /** The playthrough log — the summary each finished scene left behind, by day and slot. */
    history: GameHistory;
    /**
     * The calendar's replays this save can play, by day and half; absent in saves from before
     * them.
     */
    replays?: GameReplays;
    /** The Bunnyboard app: conversations, friend requests and badges. */
    bunnyboard: BunnyboardState;
    /** Plans the reader has made, oldest first. */
    events: CalendarEvent[];
    /** The part-time job the reader holds, or null. One at a time. */
    job: JobState | null;
    /**
     * Job ids the reader was fired from or quit; an employer here does not return to the board
     * this semester, and one that fired him never does.
     */
    jobsClosed: string[];
    /**
     * Every employer the reader has worked for and left, by job id; absent before he has left one
     * in a save that knew to keep it.
     */
    formerJobs?: Record<string, FormerJob>;
    /** What the semesters before this one left on his record; absent in the first semester. */
    transcript?: Transcript;
    /**
     * What the reader has bought or been given and not yet given away: one entry per distinct item
     * bought, and one per present a girl gave him.
     */
    inventory: OwnedItem[];
    /** When each scene event last fired this semester; absent before any has. */
    sceneEventsFired?: SceneEventsFired;
    /** The reader's last cold this semester, as a girl's `cold` is kept; absent before any. */
    readerCold?: ColdCase;
    /** Every strain the reader has caught this semester, by its id, ascending; absent before any. */
    readerColdsHad?: number[];
    /**
     * What each of the reader's classes has accumulated — meetings, exams, projects and scores —
     * keyed by class code.
     */
    classRecords: Record<string, ClassRecord>;
    /**
     * The reader's academic reputation once a whole round of assessments is in — `good`
     * when every score beat 90, `bad` when every one fell under 50, null otherwise.
     */
    gradesStanding: 'good' | 'bad' | null;
    /**
     * The reader has been caught at something the university expels people for,
     * banked at the boundary of the scene the ledger reported it in.
     */
    expelled: boolean;
    /**
     * The one-shot guard on the Saturday standing check after midterms, and on the Monday finals
     * notification.
     */
    midtermStandingDone: boolean;
    finalsScoresShown: boolean;
    /**
     * The last global slot id (`date * 2 + time`) VenusBot's announcements have been delivered
     * through.
     */
    venusThrough: number;
    /** The same watermark for BunnyBot's two clock-owed messages; defaults to `-1`. */
    bunnybotThrough: number;
    /** Whether the sidebar's BunnyMap and BunnyShop icons have been handed over. */
    bunnymapUnlocked: boolean;
    bunnyshopUnlocked: boolean;
    /**
     * One-shot guards on BunnyBot's and VenusBot's event-triggered messages, fired by a state
     * rather than a date — Venus's job pitch, first contact, the Updates-tab nudge, the two-timing
     * tip, and (optional; absent before it existed) the first-seen-with-a-girl warning.
     */
    venusJobIntroSent: boolean;
    bunnybotContactIntroSent: boolean;
    bunnybotFirstPostNudgeSent: boolean;
    bunnybotTwoTimingTipSent: boolean;
    bunnybotSeenTipSent?: boolean;
    /**
     * BunnyBot's event-triggered handovers that fired before it had introduced itself, in the
     * order they fired, waiting for the first boundary past `FRIENDS_INTRO_SLOT`.
     */
    bunnybotDeferred: BunnybotHandover[];
    /** Every class the reader dropped during add/drop, keyed by class code. */
    droppedClasses: Record<string, DroppedClass>;
    /** Every class the reader added during add/drop, keyed by class code. */
    addedClasses: Record<string, AddedClass>;
    /**
     * What the roster thinks of *each other*, keyed by `pairKeyOf` — one entry per
     * unordered pair, and the absence of one is the fifth state: strangers.
     */
    npcRelationships: NpcRelationshipMap;
    /**
     * The first time each pair of them became friends, oldest first — a permanent record,
     * so a pair that falls out and back in is never announced twice. Absent in a save written
     * before the feed said so.
     */
    npcFriendships?: NpcFriendship[];
    /**
     * The occasions he turned down an invitation to, or let one stand — nobody asks him to one
     * of these twice. Absent in a save written before occasions were asked about.
     */
    occasionsDeclined?: string[];
    /**
     * Who is with whom this slot, stamped with the slot it describes; rolled at the
     * boundary and carried on {@link SlotOpening} so a reload opens the same evening.
     */
    npcOverlay: NpcSlotOverlay | null;
    /**
     * What this slot's opening said was going on somewhere, stamped with that slot: the
     * scene the reader spends it in injects the sentence into that place's lorebook entry, once.
     * Absent in a save written before openings said so.
     */
    slotRumor?: SlotRumor | null;
    /**
     * Who shared a scene with the reader in the last slot that finished, stamped
     * with the slot it describes so a stale snapshot is inert.
     */
    lastSlotCast: {
        date: number;
        time: TimeSlot;
        charIds: string[];
    } | null;
    /**
     * Who has already been out this weekend, keyed by charId and valued with that weekend's
     * Saturday date.
     */
    weekendOutings: Record<string, number>;
    /**
     * The same record for spring break, where the rule is per slot rather than per weekend:
     * keyed by charId and valued with `globalSlotOf`.
     */
    outingSlots: Record<string, number>;
    /** Who leaves campus for spring break, as charIds. */
    springBreakAway: string[] | null;
    /**
     * The graduate back in town for this fall's Homecoming, as a charId, settled on Homecoming
     * morning; absent before then and when nobody qualified.
     */
    homecomingVisitor?: string;
    /**
     * The lovers a relationship set by hand on a contact page left, and who for, waiting for the
     * next slot's opening to write their breakup texts; absent while none wait.
     */
    breakupsOwed?: BreakupOwed[];
    /**
     * The feed items that belong to today alone — the stranger's post the day surfaced and
     * the random student's — stamped with the date they were rolled for.
     */
    feedExtras: FeedExtras | null;
    /** The graduation-morning narration has played. */
    graduationSeen: boolean;
    /** Who the reader has already said goodbye to, as charIds — each a button spent off the epilogue's menu. */
    farewellsDone: string[];
    /** The graduation picture is this epilogue's to make. */
    endingArtWanted: boolean;
    /** The scene in progress, or null between scenes; written at every reply and decision point. */
    scene: SceneState | null;
    /**
     * A JPEG of the stage as the save was taken, base64 without the `data:` prefix; absent on
     * boundary and epilogue saves.
     */
    thumbnail?: string;
    /**
     * What mods keep with this save, keyed by the mod's id. Core never reads inside a slice and
     * writes each one back as read; every value is plain JSON.
     */
    ex?: Record<string, ModSlice>;
}

/** A post's place in the feed's newest-first order — the one comparison every list uses. */
export declare function newestFirst(a: {
    date: number;
    time: TimeSlot;
}, b: {
    date: number;
    time: TimeSlot;
}): number;

/** The game's No NSFW images rule, false until settings have been read. */
export declare function noNsfwImages(): boolean;

/**
 * A label that appears over a control while the pointer is on it and leaves with it — the one
 * hover-revealed label in the app, raised by the wrapper around a dead control. A fade with a
 * short rise, so it reads as said rather than as a control arriving.
 */
export declare const noteIn: Variants;

/** What one cast member is called in a companion clause. */
declare interface NpcCompanions {
    knownNames: readonly string[];
    unknown: number;
}

/** What one pair did together, and how it went — at most one, newest overwriting. */
declare interface NpcEncounter {
    /** The game date it happened, which is what ages it out of the cast block. */
    date: number;
    kind: 'class' | 'hangout' | 'dorm';
    /**
     * A class code for `class`; a location id or `'room'` for `hangout`; a dorm spot id
     * for `dorm`.
     */
    ref: string;
    /** It went well. False is an argument, which is what the prose reads off. */
    positive: boolean;
    /** For `ref === 'room'`: whose room it was, so the line can name her. */
    roomOf?: string;
}

/**
 * One pair's **first** crossing into {@link zoneOf}'s friends band, stamped with the slot
 * it happened in — a permanent record on the save, which is what makes the feed say it once.
 */
declare interface NpcFriendship {
    /** The pair, in {@link pairKeyOf}'s own order: `a < b`. */
    a: string;
    b: string;
    date: number;
    time: TimeSlot;
}

/** A set of characters spending one slot in one place. */
declare interface NpcGroup {
    /** A location id, or `'room'` when they are in the host's room. */
    location: string;
    /** Whose haunt or room this is; absent for a night out, which is nobody's. */
    host?: string;
    /** charIds, one to three of them, the host included when there is one. */
    members: string[];
}

/** One pair's standing. */
declare interface NpcRelationship {
    /** {@link MIN_AFFINITY} to {@link MAX_AFFINITY}, inclusive. */
    affinity: number;
    encounter?: NpcEncounter;
}

/** Keyed by {@link pairKeyOf} — one entry per unordered pair, never two. */
declare type NpcRelationshipMap = Record<string, NpcRelationship>;

/** The loaded game's NPC pair records. @since 0.8.0 */
export declare const npcRelationships: () => Readonly<NpcRelationshipMap> | undefined;

/** Who is with whom this slot, stamped with the slot it was rolled for. */
declare interface NpcSlotOverlay {
    /** The slot this describes. */
    date: number;
    time: TimeSlot;
    groups: NpcGroup[];
    /**
     * Who spent this slot out — the weekend-fatigue debit. Not everyone in `groups`: being
     * pulled along costs nothing.
     */
    wentOut: string[];
}

/**
 * The structured-output envelope every builder's top-level schema is: a named closed object
 * whose declared property order is the order the model answers in.
 */
export declare function objectSchema(name: string, required: readonly string[], properties: Record<string, unknown>): StructuredRequest['schema'];

/**
 * One occasion on the calendar — a holiday, an academic milestone or a campus event.
 */
declare interface Occasion {
    /** A stable slug for a static occasion; `crypto.randomUUID()` for a generated one. */
    id: string;
    /** A few words — the calendar chip's label. */
    title: string;
    /** A sentence or two — the detail pane's line, and the text the prompts are given. */
    description: string;
    /** First `date` index it covers, inclusive. */
    startDate: number;
    /** Last `date` index it covers, inclusive; equal to `startDate` for a single day. */
    endDate: number;
    /** Which half of the day it occupies, or null for the whole of it. */
    time: TimeSlot | null;
    /**
     * No class meets on any day it covers. Only the fixed academic occasions set this; a
     * generated one never can.
     */
    cancelsClasses: boolean;
    kind: 'holiday' | 'academic' | 'campus';
}

/**
 * Opens a mod's panel ({@link ModHooks.gameModals}) over the game view, in place of whatever panel
 * is open there. `arg` is handed to the panel. False where nothing opens: no game view is up, or
 * no mod that is on has a panel under `id`.
 */
export declare function openPanel(id: string, arg?: string): boolean;

/** Bind display, retries and autosaving to one native decision point, including Creator. */
export declare function openSceneExchange(modId: string): SceneExchange | null;

/** What the Mods screen hands a preview of one of a mod's option groups: the option picked. */
export declare interface OptionPreviewProps {
    optionId: string | null;
}

/**
 * A player-side wardrobe lock: the default wardrobe or one alternate set. It remaps what
 * the stage *renders* and nothing else; the model is never told about it.
 */
declare type OutfitLock = 'default' | OutfitSet;

/**
 * Every alternate wardrobe a character can have sprites rendered in. A set rides in
 * a `sprite:` action suffixed onto an {@link Emotion} — `happy_pe` — and picks the folder.
 */
declare type OutfitSet = StockOutfitSet | CustomOutfitSlot;

/** One line of the reader's inventory: an item and how many of it he holds. */
declare interface OwnedItem {
    /** An `ItemDef.id` (`shared/shop.ts`), which owns the name, price and prose. */
    itemId: string;
    /** Always at least 1 — an entry that reaches zero is removed instead. */
    count: number;
    /** A present a girl gave him: who, and the day. Never on a line with a bought item. */
    from?: ReceivedFrom;
}

/**
 * Whether `modId` is the one drawing post comments, and so the one that writes them: a mod that
 * is not leaves the slot's posts without asking for any.
 */
export declare function ownsPostComments(modId: string): boolean;

export declare const panelUnderTab: Variants;

declare interface PastEncounter {
    id: string;
    date: number;
    time: TimeSlot;
    text: string;
    subjects: string[];
    origin: TermOrigin;
}

/** A PE class: no kind, no exams and no project — a coach runs it instead. */
declare interface PeClassEntry extends ClassEntryBase {
    category: 'pe';
    /** Who runs it, rolled like a professor. Said by `fullDescriptionOf`, never stored. */
    instructor: Professor;
}

/** Whether the phone is open, independently of its selected tab or page. */
export declare function phoneOpen(): boolean;

/** The player's profile picture, or null without a game or picture. @since 0.8.0 */
export declare const playerProfilePicture: () => string | null;

/** Accumulated points per stat. Never a tier — see {@link tierOf}. */
declare interface PlayerStats {
    brain: number;
    body: number;
    heart: number;
}

/** The player's current stats, not default character-generation values. @since 0.8.0 */
export declare const playerStats: () => Readonly<PlayerStats> | undefined;

/**
 * On-disk playthrough record — `/data/saves/{playthroughId}/playthrough.json`: everything
 * New Game settled and no save afterwards rewrites, its top level the first semester's; written
 * once beside the saves that read it, again with each semester Continue adds, and when the
 * player renames the playthrough. The folder names the playthrough, so no id is carried here.
 */
declare interface PlaythroughRecord extends ModPlaythroughFields {
    schemaVersion: 3;
    /** charIds of the first semester's roster, in roster order. */
    chars: string[];
    /**
     * The reader's own name, chosen at New Game and fixed for the playthrough; it reaches the
     * model through the `READER` block.
     */
    playerFirstName: string;
    playerLastName: string;
    /**
     * The class roster, keyed by class `code`. Generated once at New Game; only classes with at
     * least one student are kept.
     */
    classes: Record<string, ClassEntry>;
    /** The occasions this playthrough invented, oldest first — the generated half only. */
    occasions: Occasion[];
    /** The first semester's changes to its fixed occasions; absent where it made none. */
    fixedEdits?: FixedOccasionEdits;
    /** The random picks the first semester's New Game left masked, by charId; absent where none. */
    masked?: string[];
    /**
     * The shift slots each all-hours employer is not offering this playthrough, keyed by job id
     * — two apiece, rolled at New Game.
     */
    jobClosures: Record<string, ShiftSlot[]>;
    /** Every slot's sky, indexed `date * 2 + time`, rolled once at New Game. */
    weather: Weather[];
    /** The settled half of every character's entry, keyed by charId. */
    profiles: Record<string, CharProfile>;
    /**
     * The player's own name for the playthrough, given from Load Game. Absent, the playthrough
     * goes by its place in creation order.
     */
    name?: string;
    /**
     * Every semester after the first, keyed by an id minted like a save id; two continued from
     * the same ending sit side by side. Absent until the first Continue.
     */
    semesters?: Record<string, SemesterRecord>;
}

/** The plus that adds one more of whatever it sits on, sized by the caller like the eye. */
export declare function PlusIcon({ size }: {
    size: number;
}): JSX.Element;

/** Which way a status line went for the reader, for the sound its arrival makes. */
declare type Polarity = 'positive' | 'negative';

/**
 * Every CG a character can have rendered: the stock positions, and the two images of each
 * custom slot. One travels as a {@link SpriteRef} in place of an emotion, and showing one
 * swaps the stage for her CG.
 */
declare type Position = StockPosition | CustomCgSlot | `${CustomCgSlot}_after`;

/**
 * The replies under a post on the feed. The game draws none of its own: a mod writes them and
 * draws them (`postComments` in the hooks), and the game keeps their shape, when each one turns
 * up, and moves them with the post when New Game+ carries her feed on. A mod keeps its own fields
 * on a comment in its slice.
 */
/** One reply under a post. */
declare interface PostComment {
    /**
     * What mods keep with this comment, keyed by the mod's id. Core never reads inside a slice and
     * writes each one back as read; every value is plain JSON.
     */
    ex?: Record<string, ModSlice>;
    /** crypto.randomUUID(); the list key. */
    id: string;
    handle: string;
    emoji: string;
    text: string;
    /**
     * The global slot it appears in. A comment can be written ahead of its slot and kept back until
     * the slot arrives, so a post picks up replies over the day rather than arriving finished.
     */
    at: number;
}

/** What the mod drawing the comments puts beside the post's like; nothing otherwise. */
export declare function PostCommentAction(props: PostCommentsProps): JSX.Element | null;

/** What the row drawing a post hands to whatever draws its comments or acts on them. */
export declare interface PostCommentsProps {
    comments: readonly PostComment[];
    /** Whose post it is; absent for the slot's random student. */
    charId?: string;
    postId?: string;
    /** Somebody he has no contact info for. */
    stranger?: boolean;
}

/**
 * One mod's way of drawing the comments under a post. Only one draws them at a time: the first
 * mod that is on and has one, in the order `MODS` lists them ({@link postCommentsOwner}).
 */
export declare interface PostCommentsSpot {
    /** Under the post's text and picture. */
    View: ComponentType<PostCommentsProps>;
    /** Beside the post's like, where it has something to put there. */
    Action?: ComponentType<PostCommentsProps>;
    /**
     * A comment only this mod could have written. Asked whether or not the mod is on, so another
     * mod drawing comments leaves this one's out while it is off, and they come back with it.
     */
    claims?: (comment: PostComment) => boolean;
}

/** The comments under a post, drawn by the mod drawing them; nothing while none is on. */
export declare function PostCommentsView(props: PostCommentsProps): JSX.Element | null;

/** A post from the slot's opening, on its way to her feed. */
export declare interface PostFiling {
    charId: string;
    /** The post as the game would file it; a mod may change or add to it. */
    post: SocialPost;
    /** What the reply wrote for this post, including the fields mods asked for. */
    reply: Readonly<Record<string, unknown>>;
    /** Set by a mod that files the post itself, later: the game then leaves it alone. */
    held: boolean;
    /** Set by a mod for a post worth showing first, as the slot's teaser. */
    featured: boolean;
}

/**
 * The places on a post a mod draws into: its picture, the comments under it, and a control beside
 * its like. The game draws none of them itself. Each reads the switches, so a mod turned on or
 * off redraws the posts it draws on.
 */
/** A post's picture, drawn by the first mod on that draws one; nothing otherwise. */
export declare function PostPicture(props: PostPictureProps): JSX.Element | null;

/** Which post a picture belongs to; whatever draws it reads the post itself. */
export declare interface PostPictureProps {
    charId: string;
    postId: string;
}

export declare function postVisible(post: SocialPost): boolean;

/** Press: the control slides down its own offset until it sits flat on its shadow. */
export declare const press: TargetAndTransition;

/** Who teaches a course, or runs a PE class — rolled locally off the app's own surname table. */
declare interface Professor {
    lastName: string;
    gender: 'man' | 'woman';
    age: 'older' | 'younger';
    temperament: ProfessorTemperament;
}

/** How a professor comes across. Rolled per class; injected as prose, never as a field. */
declare type ProfessorTemperament = 'strict' | 'easygoing' | 'old-fashioned' | 'passionate' | 'sarcastic' | 'absent-minded' | 'gruff' | 'warm' | 'theatrical' | 'dry' | 'eccentric' | 'funny';

/**
 * Where her portrait is cut out of her neutral sprite: a rectangle in that sprite's own
 * pixels, at the archway's ratio. `seed` is the `generationSeed` it was framed under, which is
 * what retires it when she is regenerated into a different girl.
 */
declare interface ProfileCrop {
    seed: number;
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Her profile image URL with native cache invalidation; undefined without her game. @since 0.8.0 */
export declare const profileImageUrl: (id: string) => string | undefined;

/** Everything written about who a character *is*, shared by the cast block and the phone. */
export declare function profileLines(character: Character, flags: CharFlags, castSize?: number): string[];

/** URL for the square face crop, on the same terms as {@link spriteUrl}. */
export declare function profileUrl(charId: string, version?: number, staged?: boolean): string;

/** How far along a project is, in the words the player and the prompt both read. */
declare type ProjectProgress = 'not started' | 'barely started' | 'halfway through' | 'almost done' | 'done';

/** A project's build log: every slot he worked on it, ascending. */
declare interface ProjectRecord {
    sessions: ProjectSession[];
}

/**
 * Where the project stands for a scene spent *building* it rather than sitting in the class
 * — resolved by the loop, formatted into the work session's lorebook paragraph.
 */
declare interface ProjectSceneContext {
    progress: ProjectProgress;
    /** The most recent slot spent on it, absent until one has been. */
    lastSession?: ProjectSession;
}

/** One slot spent building a project — and what the reader did with it. */
declare interface ProjectSession {
    /**
     * What mods keep with this session, keyed by the mod's id. Core never reads inside a slice and
     * writes each one back as read; every value is plain JSON.
     */
    ex?: Record<string, ModSlice>;
    date: number;
    time: TimeSlot;
    /** The scene's own summary; absent when the closing call never produced one. */
    summary?: string;
}

/** Every editable block, in the order a mod lists them. */
export declare const PROMPT_BLOCKS: readonly PromptBlock[];

/** The four routable kinds, in the order the checklist prints them: the default set first. */
declare const PROMPT_KINDS: readonly ['solo', 'examQuiz', 'slotIntro', 'texting'];

/** What a mod adds to one prompt: instruction lines, and fields the reply has to fill in. */
export declare interface PromptAddition<C> {
    lines?: (ctx: C) => readonly string[];
    /** For `dm` only, place these fields ahead of the reply's own. */
    lead?: boolean;
    /**
     * Schema properties: the top level for `dm` and `character`, each post for `slot-posts`, each
     * girl's entry for `slot-reach-outs`.
     */
    fields?: () => Record<string, unknown>;
    /** Which of those fields the reply must fill in. */
    required?: () => readonly string[];
}

/** One editable block as a mod lists it; `text` is the shipped default for the unrestricted setting. */
export declare interface PromptBlock {
    id: TextBlockId;
    owner: 'scene' | 'global';
    group: 'persona' | 'scene' | 'newgame.classes' | 'newgame.profiles' | 'newgame.occasions' | 'newgame.secrets';
    label: string;
    hint: string;
    text: string;
}

/**
 * One render's tag groups as the player may rewrite them for that render alone. Each member is
 * the scope one regenerate opens in; a builder reads only its own kind and falls back to the
 * character for every other.
 */
declare type PromptEdit = {
    kind: 'sprite';
    /** The wardrobe the sprite is of; null is the default one, her main outfit. */
    set: OutfitSet | null;
    base: string[];
    appearance: string[];
    outfit: string[];
    pose: string[];
    negative: string[];
} | {
    kind: 'expression';
    expression: string[];
} | {
    kind: 'cgs';
    base: string[];
    appearance: string[];
    negative: string[];
} | {
    kind: 'cg';
    base: string[];
    appearance: string[];
    position: string[];
    expression: string[];
    negative: string[];
};

/** Every mod's schema fields for one prompt. */
export declare function promptFields(spot: PromptSpot, part?: 'lead' | 'trailing'): Record<string, unknown>;

declare type PromptKind = (typeof PROMPT_KINDS)[number];

/** Every mod's lines for one prompt. */
export declare function promptLines<S extends PromptSpot>(spot: S, ctx: PromptSpots[S]): string[];

/**
 * One part of a scene request as its builder emitted it, its text already carrying any edits and
 * found verbatim in the request's `system` or `user`. Parts a mod adds in main carry its own ids.
 */
declare interface PromptPart {
    id: string;
    role: 'system' | 'user';
    text: string;
}

/** Every mod's required fields for one prompt. */
export declare function promptRequired(spot: PromptSpot, part?: 'lead' | 'trailing'): string[];

export declare type PromptSpot = keyof PromptSpots;

/** What each prompt hands the mods adding to it. */
export declare interface PromptSpots {
    scene: {
        cast: readonly Character[];
        state: PromptState;
        query: string;
    };
    /** Her reply in a DM thread. */
    dm: {
        character: Character;
        info: CharInfo | undefined;
        state: TextingPromptState;
    };
    /** The status updates the slot's opening writes, one entry per post. */
    'slot-posts': Record<string, never>;
    /**
     * One girl posting this slot, under her name in the slot's opening: lines only. The opening
     * can be written while the slot before it is still playing, so `date` and `time` name the slot
     * it is for.
     */
    'slot-poster': {
        character: Character;
        info: CharInfo;
        date: number;
        time: TimeSlot;
    };
    /** The girl the slot's opening has texting the reader just to talk, one call per girl. */
    'slot-reach-outs': {
        character: Character;
        info: CharInfo;
        date: number;
    };
    /**
     * The texting bookkeeping after a slot of texts, below its messages: lines only. `charKeys` are
     * the girls he texted, as the call keys them.
     */
    'text-ledger': {
        charKeys: readonly string[];
    };
    /** A character being generated. */
    character: Record<string, never>;
}

/** Everything the builders read out of `gameStore`. */
export declare interface PromptState {
    exReckoning?: ReckoningState;
    storyMemory?: StorySnapshot;
    breakthrough?: BreakthroughState;
    exCharacterDynamics?: CharacterDynamics;
    /** The cloud-LLM cache key: the playthrough id, never the save's. */
    playthroughId: string;
    date: number;
    time: TimeSlot;
    /** Mod-owned snapshots captured for this request, keyed by mod id. Not saved or prompt text. */
    ex?: Readonly<Record<string, unknown>>;
    /** Available background base names, sorted, suffixes already stripped, by category. */
    backgrounds: BackgroundSets;
    /** The playthrough's lorebook: the shipped entries as the player has them, then his own. */
    lorebook: readonly BookEntry[];
    /** Per-character save state, keyed by charId. */
    charInfo: Record<string, CharInfo>;
    /** What the roster thinks of each other, keyed by `pairKeyOf`. */
    npcRelationships: NpcRelationshipMap;
    /** Every save character who is *not* in this scene's cast — the lorebook's people. */
    roster: readonly Character[];
    /**
     * The characters this scene is *about* without their being in it — bought a present for,
     * thought about, asked after.
     */
    mentions?: readonly Character[];
    /**
     * Where the classifier said the scene is set, or null when the action did not say.
     * Scanned into the lorebook beside the turn's own text.
     */
    sceneLocation?: string | null;
    /**
     * The secret the scene's one girl is telling the reader in it, or null when she tells none:
     * a fact to establish on the turn that opens the scene, and one she has told on every later
     * turn of it.
     */
    sceneSecret?: string | null;
    /**
     * The curveball the scene opened on, read **only on the turn that opens it**: a continuation
     * is built from the same state and passes it nowhere.
     */
    sceneEvent?: SceneEvent;
    /** The present a girl brings him in this scene, read on the opening turn alone as well. */
    receivedGift?: ReceivedGift;
    /**
     * What this slot's opening said was going on somewhere, where the slot drew one: the
     * sentence rides that place's own lorebook entry, and **only on the turn that opens a scene**
     * — a continuation is built from the same state and passes it nowhere.
     */
    slotRumor?: LoreRumor;
    /** The save's class roster, keyed by class code. */
    classes: Record<string, ClassEntry>;
    /** The reader's own timetable, sparse slot → class code. */
    playerSchedule: Record<number, string>;
    /** Who sits in each class of the catalog, by class code. */
    classRosters: Readonly<Record<string, ClassRoster>>;
    /**
     * Classes the reader dropped that his former classmates have not been told about yet
     * — resolved by the loop and spent at the boundary of the scene that carries them.
     */
    droppedNotices?: readonly DroppedNotice[];
    /**
     * Who leaves campus for spring break, or null before the pick has run; the plan
     * itself rides on her own `CharInfo`.
     */
    springBreakAway?: readonly string[] | null;
    /**
     * Set only for a goodbye in the graduation epilogue: who it is with, and whether one of them
     * is graduating out of the other's reach or she is merely going home for the break.
     */
    farewell?: {
        firstName: string;
        forAWhile: boolean;
    };
    /** Who graduates at this semester's ceremony, by charId. */
    graduating?: readonly string[];
    /**
     * Classes he added at add/drop and has not yet walked into — every unspent add;
     * `classCode` decides which applies.
     */
    addedNotices?: readonly AddedNotice[];
    /** The part-time job the reader holds, or null — the other half of his week. */
    playerJob: JobState | null;
    /** The reader's accumulated stats, used for relationship requirement guidance. */
    stats?: PlayerStats;
    /**
     * The semester's season and the occasions the save invented; the fixed half of the
     * calendar is merged in by `occasionsAt`.
     */
    calendar: SemesterCalendar;
    /**
     * The whole semester's sky, one reading per slot — the NOW line walks back through it for how
     * long the weather has held. Absent means nothing is said about it.
     */
    weather?: readonly Weather[];
    /**
     * The background the scene is standing on, base name, no suffix — null between scenes.
     */
    bg: string | null;
    /**
     * The class this scene is sitting in, by class code, or null when it is not a class scene.
     */
    classCode: string | null;
    /**
     * The first names of the classmates the reader knows who are in bed with a cold instead of in
     * the class this scene is sitting in; absent when there are none.
     */
    outSick?: string[];
    /**
     * Everything the `CLASS` block needs about where this course stands, or absent when
     * the scene is not a class scene.
     */
    classMeeting?: ClassSceneContext;
    /**
     * The course this scene's work session is for, by class code, or null when the scene is not
     * one.
     */
    projectClass: string | null;
    /**
     * What the reader has already sat through in {@link projectClass}, oldest first, or absent
     * when the scene is not a work session.
     */
    projectRecap?: readonly ClassMeetingRecap[];
    /**
     * How far the project itself has got and what the last slot on it produced, or absent when
     * the scene is not a work session.
     */
    projectScene?: ProjectSceneContext;
    /**
     * The job whose shift this scene is, by jobId, or null when it is not one.
     * Scoped and persisted like {@link projectClass}.
     */
    jobId: string | null;
    /**
     * The employer whose premises this scene is on because a *character* is working there, or
     * null when it is not one.
     */
    visitJobId: string | null;
    /**
     * One finished paragraph per gift given this scene, built by `giftLoreNote`
     * (`shared/shop.ts`) from `gameStore.sceneGifts`.
     */
    giftNotes: readonly string[];
    /**
     * Sticky per-character sprite reference, keyed by charId — where the scene as written leaves
     * each of them, a CG among the values.
     */
    emotions: Record<string, SpriteRef>;
    /**
     * The charIds standing on the stage as written, in slot order — whose company decides whether
     * a CG can be offered at all.
     */
    onStage: readonly string[];
    /**
     * Which cast members have the full stock set of CGs on disk, by charId — read once at scene
     * start.
     */
    cgReady: Record<string, boolean>;
    /**
     * Which custom CG pairs each cast member has whole on disk, by charId — read once at scene
     * start; a pair counts only when both of its images exist. A pair listed here is offered only
     * where it has instructions.
     */
    customCgReady: Record<string, CustomCgSlot[]>;
    /**
     * Which alternate wardrobes each cast member has fully rendered, by charId — read once at
     * scene start; a set counts only when all seven of its sprites exist. A custom slot listed
     * here is offered only where it has instructions.
     */
    outfitReady: Record<string, OutfitSet[]>;
    /** Which cast members have both room backgrounds on disk, by charId. */
    roomReady: Record<string, boolean>;
    /**
     * Each character's composed TEXTING HISTORY lines, by charId — the rolling Bunnyboard recap
     * plus its app-known footnotes, header included.
     */
    textingSummaries?: Record<string, string[]>;
    /**
     * Each character's plans with the reader in the slots after this one, one sentence apiece,
     * by charId — read for the cast and the lorebook's people alike.
     */
    upcomingPlans?: Record<string, string[]>;
    /**
     * The charIds a Bunnyboard thread already exists with (`hasTexted`). Not derivable from
     * {@link textingSummaries}, which can exist over an empty thread.
     */
    textedWith?: readonly string[];
    /**
     * The cast members the reader met in an earlier semester and has not shared a scene with
     * since the break, by charId.
     */
    backFromBreak?: readonly string[];
    /** The graduate back in town for Homecoming, as a charId; absent on every other slot. */
    homecomingVisitor?: string;
    /** The cast when every one of them is off-stage and the scene is still running; absent otherwise. */
    hiddenCast?: readonly Character[];
    /** The player's `lessNsfwText` setting. */
    lessNsfwText: boolean;
    /** The player's own cast-scene persona; absent is the shipped one. */
    scenePersona?: string;
    /** The edits a mod hands the text blocks: the scene ones and the global ones; absent when none is supplied. */
    textEdits?: TextEditSet;
    /** The subject tags the settings name; absent is the shipped ones alone. */
    subjectTags?: readonly string[];
    /** How many memories per character the cast block carries, by cast size. */
    memoryBudgets: Required<MemoryBudgets>;
    /** How many of her told secrets each entry carries; absent is the default. */
    secretBudget?: number;
    /** The playthrough log, read for the lorebook's dated recaps. */
    history: GameHistory;
    /**
     * Set only for a scene from the Scene Creator, played outside any playthrough: no mood line,
     * and no line holding romance back on the reader's stats.
     */
    createdScene?: true;
    /** Hand-set affection by charId, read in place of what her memories earn. */
    affection?: Record<string, number>;
    /** The wardrobe each girl opens a created scene in; only its opening call carries it. */
    openingOutfits?: Record<string, OutfitLock>;
}

/**
 * The game's rewritable prompt text as a mod rewrites it. Only one mod rewrites it at a time: the
 * first that is on and has one ({@link promptTextEdits}).
 */
export declare interface PromptTextSpot {
    /** The edits every builder reads its text blocks through; undefined sends the shipped text. */
    edits?: () => TextEditSet | undefined;
    /** The class call's pool sizes; undefined, or an absent size, is the shipped one. */
    classCatalog?: () => ClassCatalogEdits | undefined;
}

/**
 * Quiet controls carry no paper layer, so there is no shadow to swing: they tint one step
 * toward attention instead, and press with the scale alone.
 */
export declare const quietLift: TargetAndTransition;

export declare const quietPress: TargetAndTransition;

/** One multiple-choice exam question. */
declare interface QuizQuestion {
    question: string;
    a: string;
    b: string;
    c: string;
    d: string;
    correct: 'A' | 'B' | 'C' | 'D';
}

/** An exam being sat right now. */
declare interface QuizState {
    /** The class code being examined. */
    code: string;
    exam: ExamPeriod;
    questions: QuizQuestion[];
    /** How many questions have been answered. */
    index: number;
    /** How many of those were right. */
    correct: number;
}

/** One control on a scene's rail, as the game draws its own: icon only, a count on its corner. */
export declare interface RailSeatProps {
    label: string;
    badge?: number;
    /** Standing and answering, standing but dead, or off the rail altogether. */
    state: 'shown' | 'dim' | 'gone';
    onClick: () => void;
    children: ReactNode;
}

/**
 * What a girl reaching out just to talk texts the reader about: the first four rolled by the app,
 * and `sick` for a girl in the worst of a cold, whatever the roll.
 */
declare const REACH_OUT_TOPICS: readonly ['wellbeing', 'goodNews', 'badNews', 'question', 'sick'];

/** One of {@link REACH_OUT_TOPICS}. */
declare type ReachOutTopic = (typeof REACH_OUT_TOPICS)[number];

/**
 * Brings the scene to the reader's turn. At his turn already, nothing to do; over a reply, an
 * interjection's own steps (see `takeTurnFromReply`). A scene left standing on a mod's last line,
 * with nothing behind it and not counted as a turn to take, as at a class scene's opening, has
 * its turn opened. False, with nothing changed, where the scene takes no lines (its ending among
 * them) or is busy.
 */
export declare function reachTurn(): boolean;

/** The native READER prompt block, or undefined without a playthrough. @since 0.8.0 */
export declare const readerPromptText: () => string | undefined;

/**
 * The reader's words onto the scene as his own, with nobody asked to answer: on the transcript
 * and the log, as an action he took inside the scene. False where the words are empty or no
 * scene takes lines.
 */
export declare function readerSaysInScene(text: string): boolean;

/**
 * What one playthrough counts up about the reader: the money he has earned, the kisses and
 * nights behind him, the shifts he has worked, and the output tokens the cloud writer has
 * generated for it. Points on a save, never a tier.
 */
/**
 * Lifetime counts the save keeps about the reader. The first four move only in a boundary pass;
 * the tokens count moves on every cloud text reply, thinking included — retries and failed
 * replies too — and never on a picture.
 */
declare interface ReaderTallies {
    moneyEarned: number;
    kisses: number;
    sex: number;
    shiftsWorked: number;
    tokensGenerated: number;
}

/** Who gave the reader a present, and on which day of the semester he holds it in. */
declare interface ReceivedFrom {
    charId: string;
    date: number;
}

/** The present a girl brings to a scene, and whether it is in his inventory yet. */
declare interface ReceivedGift {
    itemId: string;
    /** The girl giving it. */
    charId: string;
    /** Put in his inventory once the scene's opening reply landed. */
    delivered?: true;
}

declare interface ReckoningAftermath {
    id: string;
    charId: string;
    date: number;
    time: number;
    origin?: string;
}

declare interface ReckoningAnswer {
    reply: string;
    reframe: string;
}

declare interface ReckoningContext {
    name: string;
    reader: string;
    evidence: ReckoningEvidence[];
}

declare interface ReckoningDungeon {
    id: string;
    charId: string;
    aspect: EchoAspect;
    unlockedByReckoning: true;
    phase: 'unlocked' | 'inside' | 'farewell';
    context: ReckoningContext;
    replies: number;
    farewellReplies: number;
    lines: DungeonLine[];
    outcome?: 'victory' | 'failed' | 'expelled' | 'left';
    thoughts?: ReckoningThought[];
    voice?: {
        turns: number;
        index: number;
        date: number;
        time: number;
        serial: number;
        beat: string;
    };
    needsSpirit?: boolean;
    /** A single perspective for this link, retained across leaving/reloading. */
    insight?: {
        aspect: EchoAspect;
        text: string;
    };
    /** Most recent private spoken clues first; cleared on leaving, never story memory. */
    whispers?: string[];
}

declare interface ReckoningEvidence {
    id: string;
    kind: 'profile' | 'memory' | 'scene';
    text: string;
}

/** A private event between transcript lines. No dialogue or profile text is duplicated. */
declare interface ReckoningRewind {
    id: string;
    charId: string;
    date: number;
    time: number;
    at: number;
    prefix: string;
}

declare interface ReckoningSession {
    id: string;
    charId: string;
    context: ReckoningContext;
    thoughts: ReckoningThought[];
    answers: ReckoningAnswer[];
    challenge: string;
    feedback: string;
    attempts: number;
    echoName?: string;
}

declare interface ReckoningState {
    version: 1;
    active: ReckoningSession | null;
    aftermath?: ReckoningAftermath;
    afterQueue?: ReckoningAftermath[];
    rewinds?: ReckoningRewind[];
    dungeon?: ReckoningDungeon;
}

declare interface ReckoningThought {
    belief: string;
    challenge: string;
    evidence: string[];
}

/**
 * A mod's data on one kind of record inside the save (a character, a memory, a message, a post,
 * a comment), read and written by the mod itself wherever it has the record in hand, and set on a
 * live text, post or comment by its `set` and `update`. During an installed mod's import, a field
 * under another id is refused: it reads `empty`, `with` changes nothing, and a write is refused.
 */
export declare function recordField<T>(modId: string, spec: RecordFieldSpec<T>): RecordFieldHandle<T>;

/** A mod's reader and writer for one kind of record, from {@link recordField}. */
export declare interface RecordFieldHandle<T> {
    /** The mod's value on `record`, or `empty`. Pure. */
    read(record: ModDataRecord): T;
    /** A new record holding `next` as the mod's slice, without the legacy keys. Pure. */
    with<R extends ModDataRecord>(record: R, next: T): R;
    /**
     * `next` as the mod's slice on the live record `ref` names, as `with` makes it: the record's
     * own fields and every other mod's slice stay as they are. In memory; it goes out with the next
     * save of any kind, or now with `saveChanges`. A refusal changes nothing and comes back as the
     * result's error, never as a throw: `MOD_WRITE_OFF`, `MOD_WRITE_NO_GAME`, `MOD_WRITE_STALE`,
     * `MOD_WRITE_GONE` (no such record, as when it was deleted), or `MOD_WRITE_FOREIGN`.
     */
    set(ref: RecordRef, next: T, options?: RecordWriteOptions): Result<null>;
    /**
     * `set`, with the value worked out from the record's current one: `change` is handed it as
     * `read` makes it, and undefined leaves the record as it is.
     */
    update(ref: RecordRef, change: (current: T) => T | undefined, options?: RecordWriteOptions): Result<null>;
}

/** What a mod keeps on one kind of record: its value's empty state, and how it is read. */
export declare interface RecordFieldSpec<T> {
    /** The value while the record holds nothing for the mod. */
    empty: T;
    /** The mod's own old keys on the record, read into `normalize` and removed by `with`. */
    legacy?: readonly string[];
    /** As {@link SaveFieldSpec.normalize}, for one record. */
    normalize?: (stored: unknown, legacy: Readonly<Record<string, unknown>>, from: string | null) => T;
}

/** A live record in the game being played: one of her texts, one of her posts, or a comment under one. */
export declare type RecordRef = {
    kind: 'message';
    charId: string;
    messageId: string;
} | {
    kind: 'post';
    charId: string;
    postId: string;
} | {
    kind: 'comment';
    charId: string;
    postId: string;
    commentId: string;
};

/** How a write to a live record is fenced. */
export declare interface RecordWriteOptions {
    /**
     * The game the change was worked out in, from `currentRun()` when the work began: refused as
     * `MOD_WRITE_STALE` once that game has been left, as by a load or a return to the title.
     */
    run?: object;
}

/** One inline image on a {@link StructuredRequest} — never written to disk. */
declare interface ReferenceImage {
    mimeType: string;
    /** Base64 payload only; the `data:<mime>;base64,` prefix is stripped by the caller. */
    data: string;
}

/** Every render the tag modal opens on: all but the room, whose prompt is prose. */
declare type RegenTarget = Exclude<RenderTarget, 'room'>;

/**
 * A mod's hooks, registered once from its own files. An installed mod's registration is held to
 * its manifest: a hook the manifest does not declare, or a registration under another mod's id
 * while this one is being imported, is refused and nothing of it is kept.
 */
export declare function registerHooks(modId: string, hooks: ModHooks): void;

/** A relationship milestone the ledger call may report for one scene. */
declare type RelationshipEvent = 'kissed' | 'sex' | 'became_lovers' | 'broke_up' | 'friendzoned_by_reader' | 'friendzoned_reader' | 'gave_contact_info' | 'unblocked' | 'agreed_to_harem';

/**
 * Third-person prose, ready to inject verbatim under the personality. `mood`, when given,
 * lets a Promiscuous girl's attraction line give way to a DTF one on her lustful days, unless she
 * is in the worst of a cold (`sick`);
 * `attractionGate` false drops the line saying his stats are under her bar.
 */
export declare function relationshipLines(character: Character, flags: CharFlags, nameKnown: boolean, affection: number, progress: RelationshipProgress | undefined, stats?: PlayerStats, medium?: RelationshipMedium, mood?: {
    date: number;
    offset: number;
    sick?: boolean;
}, attractionGate?: boolean): string[];

/** Renders a character's relationship with the reader for the cast block. */
/**
 * Which first this would be: where the lines are being read, and whether a
 * Bunnyboard thread with her already holds anything.
 */
export declare interface RelationshipMedium {
    /** She is reading and writing texts rather than standing in the room. */
    texting: boolean;
    /** They have exchanged texts before this turn. */
    texted: boolean;
}

/** How far along she is: a new crush's or relationship's scene count, and her halves. */
export declare type RelationshipProgress = Pick<CharInfo, 'romanceScenes' | 'upperHalves'>;

/** Everything a render bucket can be asked for: a whole set, one CG, or one sprite. */
declare type RenderTarget = SetTarget | CgTarget | ExpressionTarget;

/**
 * What a replay from the calendar projects onto the store, out of the game it was opened from;
 * everything else stands at a blank game's.
 */
declare type ReplayStayFields = Pick<GameStoreState, 'date' | 'time' | 'chars' | 'playerFirstName' | 'playerLastName' | 'charInfo' | 'charKeyToId' | 'weather' | 'calendar' | 'semesterIndex'>;

export declare interface RequestSpots {
    scene: PromptSpots['scene'];
    dm: PromptSpots['dm'] & {
        newMessage: string;
    };
    ledger: {
        state: PromptState;
        charKeys: readonly string[];
    };
    'slot-intro': {
        input: SlotIntroInput;
    };
}

/** One save as a list of saves shows it: the file's summary, its roster and its load gate. */
export declare interface ResolvedSave {
    saveId: string;
    /** Epoch ms — the save's own date, or the file's when it could not be read. */
    savedAt: number;
    /** What the list draws of the save, or null when the file was refused on read. */
    summary: SaveSummary | null;
    /** The playthrough's record, or null when that was what was refused. */
    record: PlaythroughRecord | null;
    /**
     * Resolved characters of the save's semester, its roster in order and then its graduates.
     * Missing ones are absent.
     */
    characters: Character[];
    /** Why this save cannot be loaded, or null when it can. */
    unloadable: string | null;
}

/** Discriminated result envelope returned by every IPC handler. */
declare type Result<T> = {
    ok: true;
    data: T;
} | {
    ok: false;
    error: AppError;
};

/**
 * One silent-retry decision: true means back off and re-send, false means fall through to the
 * player.
 */
export declare function retrySilently(call: string, error: AppError, spent: number, options?: SilentRetryOptions): Promise<boolean>;

/** Active roster ids, with alumni appended once when requested. @since 0.8.0 */
export declare function rosterIds(options?: {
    alumni?: boolean;
}): readonly string[];

/**
 * A control that already spans its column — a disclosure row, a full-width pill — has nowhere
 * to grow into, and a neighbour a few pixels away. It tints where {@link quietLift} would also
 * swell, and presses by a fraction rather than by a tenth.
 */
export declare const rowLift: TargetAndTransition;

export declare const rowPress: TargetAndTransition;

/**
 * What the pass changed. **Only girls it touched appear** in `suspicions` — an untouched
 * `CharInfo` keeps its object identity for the save's dirty check.
 */
declare interface RumorPassOutcome {
    /** Replacement lists, already pruned of everything that expired. */
    suspicions: Record<string, Suspicion[]>;
    /** The permanent memories the hour cost him, in the order they were earned. */
    memories: {
        charId: string;
        memory: CharMemory;
    }[];
    /** Who watched him with whom, which is what the player is told and what BunnyBot reads. */
    sightings: {
        witness: string;
        subjects: string[];
    }[];
}

/** Whether the run a continuation started in has since been left. */
export declare function runStale(run: object): boolean;

/** Whether a save, and so a {@link writeModFields}, can be taken now (`open`), has to wait, or never can. */
export declare function safePoint(): ManualSaveOffer;

/**
 * Writes what a mod changed in the game (its slices, its records, the comments and memories it
 * added) to disk now, rather than with the loop's next save: over the autosave, behind every write
 * already queued, at the last decision point of a scene in progress or with no scene outside one.
 * While a scene is not at a decision point (a line playing, a reply streaming, its ending being
 * written) nothing is written now, and the answer is `deferred`: the loop's own next save carries
 * the change, since every save is taken from the live game. `written` once the save is on disk.
 * Refused, writing nothing, with `MOD_WRITE_OFF`, `MOD_WRITE_NO_GAME` (none, or one that is over),
 * `MOD_WRITE_STALE` (`run` left, or the game left before the write's turn), or the disk's own
 * error. Never throws.
 */
export declare function saveChanges(modId: string, options?: {
    run?: object;
}): Promise<Result<'written' | 'deferred'>>;

/** What a mod offers for a save picked in Load Game, beside loading it. */
export declare interface SaveChoice extends WayOn {
    title: string;
    /** The question. The game adds its own line about progress a running game would lose. */
    message: string;
    /** The button that takes the mod's way, beside Load. */
    label: string;
}

/**
 * A mod's data in the save, registered once from its own files. Read on every load for as long
 * as the mod is registered, on or off, so a mod switched off finds its data where it left it.
 * During an installed mod's import, a field under another id is refused, as is a second field
 * under one id (which throws for an in-repo mod, whose bug it is); a refused field reads `empty`.
 */
export declare function saveField<T>(modId: string, spec: SaveFieldSpec<T>): SaveFieldHandle<T>;

/** A mod's live value in the game being played, from {@link saveField}. */
export declare interface SaveFieldHandle<T> {
    /** The live value, or `empty`. */
    read(): T;
    /** The live value, for a component: it renders again when the value changes. */
    use(): T;
    /** Replaces the value in memory; it goes out with the next save of any kind. */
    set(next: T): void;
    /** Writes `next` to disk at a safe point, and takes it into the game once it is there: {@link writeModField}. */
    write(next: T, options?: {
        expect?: T;
    }): Promise<Result<null>>;
}

/** What a mod keeps in the save: its value's empty state, how it is read, and what the next semester gets. */
export declare interface SaveFieldSpec<T> {
    /** The value while the save holds nothing for the mod. */
    empty: T;
    /**
     * The mod's own old top-level save keys, read once into `normalize` and then removed. Without
     * a `normalize` to read them they are left in the save as they are.
     */
    legacy?: readonly string[];
    /**
     * The mod's value from what the save holds: `stored` is its slice's data as read (undefined
     * where none), `legacy` the old keys as read, `from` the mod version that wrote the slice, or
     * null for a legacy or pre-kit one. Pure; a throw leaves the save's data as it was and the mod
     * at `empty` for this game. Without it, the value is the stored data, or `empty`.
     */
    normalize?: (stored: unknown, legacy: Readonly<Record<string, unknown>>, from: string | null) => T;
    /** What the next semester starts with, given this one's value; undefined, or no `carry`, starts it empty. */
    carry?: (value: T, context: TermCarryContext) => T | undefined;
}

/** What the load grid shows of one save, read off it without shipping the save itself. */
declare interface SaveSummary {
    /** In-game position of the save. */
    date: number;
    time: TimeSlot;
    /** The save's {@link GameSave.graduationSeen}. */
    graduationSeen: boolean;
    /** A scene was in progress when it was written. */
    midScene: boolean;
    /** The scene's background base name, the player's own pick winning; null between scenes. */
    bg: string | null;
    /** The save's {@link GameSave.thumbnail}, where it carries one. */
    thumbnail?: string;
    /** The save's {@link GameSave.semester}, where it is past the first. */
    semester?: string;
}

/**
 * Puts a mod's words on the scene: onto the transcript and the box at once, the box turning to
 * the first part, the reader's turn closed until it is read. False, with nothing said, where the
 * mod is off, the words are empty, no scene takes lines, or `charId` is not in the scene.
 */
export declare function sayInScene(modId: string, text: string, options?: SceneLineOptions): boolean;

/**
 * The scene on screen: the playthrough's, a created scene's or a replay's; null on the menu. The
 * same object comes back until something in it changes. @since 0.8.0
 */
export declare function scene(): SceneView | null;

/** Every scene event, grouped by the scene it fits; appended, never reordered. */
declare const SCENE_EVENT_IDS: readonly ['herAsleep', 'herShowering', 'herMasturbating', 'herBug', 'herRomance', 'herLockedOut', 'hisDrinks', 'hisLate', 'hisUpset', 'mealFire', 'mealMissingIngredient', 'mealInjury', 'mealDisaster', 'strayCat', 'strayDog', 'lostChild', 'heartAttack', 'lostWallet', 'hitOn', 'noUmbrella', 'drenched', 'noHomework', 'noMaterials', 'asleepInClass', 'badGrade', 'lateToClass', 'classCancelled', 'peInjury', 'peWardrobe', 'periodAccident', 'hungover', 'injury', 'wardrobe', 'powerOut', 'brokenAc', 'wifiOut', 'lostPhone', 'hiccups'];

/** The milestones the setup offers, in the order the modal lists them. */
declare const SCENE_MILESTONES: readonly ['met', 'lovers', 'crush', 'kissed', 'sex', 'broke_up', 'friendzoned_by_reader', 'friendzoned_reader', 'agreed_to_harem'];

/** How two girls in the scene stand with each other; strangers have never met. */
declare const SCENE_RELATIONS: readonly ['friends', 'acquaintances', 'strangers', 'enemies'];

/** The cast scene's persona and its instruction blocks. */
declare const SCENE_TEXT_IDS: readonly ['persona.scene', 'scene.opening', 'scene.continue', 'scene.continue.first-line', 'scene.continue.going', 'scene.continue.ending', 'scene.closing', 'scene.solo'];

/** Core's exact scene-ownership predicate, false without a loaded playthrough. @since 0.8.0 */
export declare const sceneActive: () => boolean;

/** A scene call about to go out, after the reader's edit of a failed prompt is laid over it. */
export declare interface SceneCall {
    /** The request as it will be sent, `parts` and `sceneSpot` included. */
    request: Readonly<StructuredRequest>;
    spot: SceneSpotTag;
    playthroughId: string | null;
    /** The reader's first name. */
    readerName: string;
}

/** One girl in the scene and everything set about her. */
declare interface SceneCastEntry {
    charId: string;
    /** The wardrobe she starts the scene in. */
    outfit: OutfitLock;
    disposition: Disposition;
    milestones: SceneMilestones;
    /** Closes her CAST entry as a contact page's notes do; empty is none. */
    notes: string;
}

export declare function SceneDivider({ state, word, className }: SceneDividerProps): JSX.Element;

/**
 * What stands in the well's place while a reply is being read: a rule either side of a state word
 * saying how to bring the well out, that the class, her present or her secret will not be
 * interrupted yet, or that the scene has resolved and is heading into or playing its closing. It
 * is the row's one hover target while the well is away (`Scene.css`), and the well's box it sits
 * in hears the move that swaps the two as the strip's events bubble up to it.
 */
export declare interface SceneDividerProps {
    state: 'shown' | 'dim' | 'hidden';
    word: DividerWord;
    /** A class of the screen's own beside the divider's, for one drawn outside the scene's row. */
    className?: string;
}

/** The curveball a scene opened on, and the girl it happens to where it names one. */
declare interface SceneEvent {
    id: SceneEventId;
    charId?: string;
}

declare type SceneEventId = (typeof SCENE_EVENT_IDS)[number];

/** When each scene event last fired this semester, by event id: its cooldown's record. */
declare type SceneEventsFired = Record<string, number>;

export declare interface SceneExchange {
    /** Whether this handle still belongs to the loaded enabled scene. */
    current(): boolean;
    /** Append a validated turn once. Synchronous reentry is refused. */
    append(turn: ExternalSceneTurn): boolean;
    /** Request persistence of the last retained story decision. */
    flush(): void;
    /** Stop accepting turns and flush any retained decision. */
    close(): void;
}

export declare interface SceneExchangeContext {
    people: Array<{
        id: string;
        profile: Pick<Character, 'charId' | 'firstName' | 'lastName' | 'personality' | 'behavior' | 'backstory' | 'likes' | 'dislikes'>;
        relationship: Pick<CharInfo, 'memories' | 'flags' | 'nameKnown' | 'notes'> & {
            disposition?: Disposition;
        };
    }>;
    onScreen: (string | null)[];
    reader: string;
    scene: {
        kind: 'creator' | 'story';
        location: string | null;
        summary: string | null;
        readerBio: string;
        premise?: string;
        relationships?: NpcRelationshipMap;
    };
}

/** Detached scene-local participant data, also available in Creator without a story save. */
export declare function sceneExchangeContext(): SceneExchangeContext;

/**
 * A mod's data for the current scene, registered once from its own files. During an installed
 * mod's import, a field under another id is refused, as is a second field under one id, or a
 * legacy key that could be a mod's id or that another field claimed (each of which throws for an
 * in-repo mod, whose bug it is); a refused field reads `empty` and writes nothing.
 */
export declare function sceneField<T>(modId: string, spec: SceneFieldSpec<T>): SceneFieldHandle<T>;

/** A mod's value for the scene being played, from {@link sceneField}. */
export declare interface SceneFieldHandle<T> {
    /** The value now, or `empty`. */
    read(): T;
    /** The value now, for a component: it renders again when the value changes. */
    use(): T;
    /** Replaces this mod's value, and no other mod's; it goes out with the next save of the scene. */
    set(next: T): void;
    /**
     * `set`, then the value written into the save a reload lands on: the reader's last turn in this
     * scene, or the scene as it stands before its first. Other mods' values there stay as they were.
     * A refusal changes nothing and comes back as the result's error, never as a throw:
     * `MOD_WRITE_OFF`, `MOD_WRITE_NO_GAME` (no playthrough, as in a replay or a created scene),
     * `MOD_WRITE_NO_SCENE` (no scene, or its ending being written), `MOD_WRITE_STALE` (the game was
     * left before the write's turn), or the disk's own error.
     */
    save(next: T): Promise<Result<null>>;
}

/**
 * A mod's own plain-JSON data for the scene being played. It is saved with the scene and restored
 * with it, and is gone once the next scene is cast. Core never reads inside a mod's value.
 */
/** What a mod keeps with the scene: the value while it holds nothing. */
export declare interface SceneFieldSpec<T> {
    empty: T;
    /**
     * The key the mod kept its scene data under before it had a field, read where the mod's own is
     * absent; the next `set` or `save` moves the value to the mod's id. It must not be a valid mod
     * id, so it can never be another mod's, and only one field may claim it.
     */
    legacy?: string;
    /**
     * Makes a stored value the mod's own, as a load brings it back from a save an older version of
     * the mod may have written. Handed a copy; pure. A throw reads as `empty`, with a warning naming
     * the mod, and leaves the stored value as it was until the next `set`. A value the mod set itself
     * is read back as set.
     */
    normalize?: (stored: unknown) => T;
}

/** One gift handed over during a scene. */
declare interface SceneGift {
    charId: string;
    /** An `ItemDef.id` (`shared/shop.ts`). */
    itemId: string;
    /** She has been given this exact item before. */
    repeat: boolean;
    /** How it landed (`shared/shop.ts`), stamped when the gift is handed over. */
    reaction: GiftReaction;
    /**
     * The transcript index of the action that handed it over; absent on a gift stamped before the
     * field existed.
     */
    at?: number;
    /** The line it came off, when it was a present a girl gave him. */
    from?: ReceivedFrom;
    /** It went back to the girl who gave it to him. */
    returned?: true;
    /** Cold medicine she took for the cold she had when it was given, filed as a dose. */
    dose?: true;
}

/** The input a panel puts in place of the scene's own action row. */
export declare interface SceneInputLayout {
    /** Its field is out, as the scene's well is on the reader's turn; false while it is put away. */
    open: boolean;
    /** How tall it stands, in pixels: the dialogue box stands clear of it, as of the scene's row. */
    height: number;
}

/**
 * What kind of scene is being cast, as `setCast` takes it: the scene-scoped facts the opening
 * classifier verdict decides.
 */
declare interface SceneKind {
    /** The activity the landing committed the scene to. */
    activity?: SlotActivity;
    /** What mods keep with the scene. */
    mods?: ModSceneFields;
    /** The class the scene sits in — a `goto_class:` verdict, or an exam. */
    classCode?: string | null;
    /** The course a work session is for — a `project:` verdict. */
    projectClass?: string | null;
    /** The job a shift belongs to — a `job` verdict. */
    jobId?: string | null;
    /** The charId an epilogue goodbye is with — never a verdict at all. */
    farewell?: string | null;
    /** The charId whose thread the slot's texting ledger must not read. */
    textLedgerSkip?: string | null;
    /**
     * The charIds whose invitation this scene left unanswered: their threads the texting ledger
     * must not read either, and one line each at the ending.
     */
    ignoredInvites?: readonly string[];
    /** The charIds he turned down by text, whose memory this scene filed. */
    turnedDownInvites?: readonly string[];
    /**
     * The employer whose premises the scene is on because a *character* is working there.
     * Never set beside {@link jobId}.
     */
    visitJobId?: string | null;
    /** The stats the shift's rolled gain moves, when the employer has more than one to roll. */
    jobStats?: readonly StatKey[];
    /** Roster charIds the action named without bringing along. */
    mentions?: readonly string[];
    /** Where the classifier set the scene, in its own words. */
    location?: string | null;
    /**
     * The scene is somewhere people could see them — the witness roll's input.
     * Absent means public.
     */
    inPublic?: boolean;
    /** The secret the scene's one girl tells in it, decided as she is cast. */
    secret?: string | null;
    /** The curveball the scene opens on, rolled as it is cast. */
    event?: SceneEvent | null;
    /** The present a girl brings him in it, rolled as it is cast. */
    receivedGift?: ReceivedGift | null;
}

/** One extracted row from the current scene ledger. */
export declare type SceneLedgerEntry = {
    kind: 'memory';
    value: NonNullable<LedgerResponse['memories']>[number];
} | {
    kind: 'event';
    value: NonNullable<LedgerResponse['events']>[number];
} | {
    kind: 'act';
    value: NonNullable<LedgerResponse['acts']>[number];
};

/** A single line of a scene, as emitted by the cloud LLM. */
declare interface SceneLine {
    /** Bg base name WITHOUT _day/_night suffix; required on the first line only. */
    bg?: string;
    /** charKey, `""` for narrator, or `READER_SPEAKER` for the player's own action. */
    speaker: string;
    /**
     * Stage instructions applied in order as the line is reached: `show:{charKey}`,
     * `hide:{charKey}`, `sprite:{charKey},{spriteRef}` and `cg:{position}`.
     */
    actions?: string[];
    text: string;
    /**
     * What the scene-end sequence draws over this line — never written by the model, only set
     * afterwards, either alongside the run it colours (`markedLine`) or by reading a finished line
     * for its stat words and balance (`markStatusLine`).
     */
    status?: StatusNote;
}

/**
 * What a mod says into the scene from outside its replies, and the turn it takes to say it: the
 * lines go where the scene's own go, on the transcript every later request quotes and on the box
 * the reader reads, split as the scene's own are.
 */
/** Who says a mod's line, and whether it stays. */
export declare interface SceneLineOptions {
    /** A girl in the scene, whose line it is; narration without one. */
    charId?: string;
    /** Her face as she says it, in the outfit she has on. */
    expression?: Emotion;
    /** For the moment only: {@link dropTransientLines} takes it back, and no save keeps it. */
    transient?: boolean;
}

declare type SceneMilestone = (typeof SCENE_MILESTONES)[number];

declare type SceneMilestones = Record<SceneMilestone, boolean>;

/** What the game hands a mod's panel over a scene. */
export declare interface ScenePanelProps {
    /** The half of the day the stage is in, which every modal over it wears. */
    theme: ScreenTheme;
    onClose: () => void;
}

/**
 * A mod's place on the scene screen. `Seat` is mounted on the rail for as long as a scene's
 * chrome is, and decides for itself when it has something to offer (`state: 'gone'` otherwise).
 * `Panel` is mounted while open, and while it is the scene behind it takes no key, click or turn,
 * exactly as behind the game's own panels.
 */
export declare interface ScenePlay {
    /** Opt in to showing this seat and panel in Scene Creator. Defaults to story scenes only. */
    creator?: boolean;
    Seat: ComponentType<SceneSeatProps>;
    Panel: ComponentType<ScenePanelProps>;
}

/** Who the reader is in a created scene. */
declare interface SceneReader {
    firstName: string;
    lastName: string;
    tiers: Record<StatKey, StartingStatTier>;
    bio: string;
}

declare type SceneRelation = (typeof SCENE_RELATIONS)[number];

/** A scene reply that has landed, as the model wrote it. */
export declare interface SceneReplied {
    /** The whole reply, including the fields mods asked for. */
    reply: Readonly<Record<string, unknown>>;
    /** Who is still in the scene. */
    cast: readonly Character[];
    solo: boolean;
    /** The reply ends the scene: its closing is next, and no turn is handed back. */
    ending: boolean;
}

/** A scene call's reply that has landed, its lines on the transcript. */
export declare interface SceneReplyLanded {
    /** The reply as the model wrote it. */
    reply: Readonly<Record<string, unknown>>;
    /** What main-process request hooks handed back with the reply, by mod id. */
    modReply: Readonly<Record<string, unknown>>;
    spot: SceneSpotTag;
    /** The transcript length the reply's lines start at. */
    at: number;
}

/** What the game hands a mod's seat on a scene's rail. */
export declare interface SceneSeatProps {
    /** The rail's own seat, so a mod's control is drawn as the game's are. */
    Seat: ComponentType<RailSeatProps>;
    /** The rail is up: false behind a curtain, with the chrome hidden, or before the rail is. */
    visible: boolean;
    /** Opens this mod's {@link ScenePlay.Panel} over the scene. */
    open: () => void;
}

/** Everything a created scene is played from, and what a saved one is rebuilt from. */
declare interface SceneSetup {
    reader: SceneReader;
    cast: SceneCastEntry[];
    /** Keyed by `pairKeyOf`; a pair with no entry stands at {@link DEFAULT_RELATION}. */
    pairs: Record<string, SceneRelation>;
    date: number;
    time: TimeSlot;
    weather: Weather;
    /** The background it opens on; absent is the writer's pick. */
    bg?: string;
    /** The reader's opening action. */
    prompt: string;
}

/** The scene calls a builder makes. */
declare type SceneSpot = 'opening' | 'continue' | 'closing' | 'solo';

/** Which scene call a builder made and who is in it. */
declare interface SceneSpotTag {
    spot: SceneSpot;
    /** The cast's given names in order; empty for a solo scene. */
    cast: string[];
}

/** Mid-scene save/rewind snapshot — of a drained scene or a queued reply. */
declare interface SceneState {
    /** Optional interactive training chosen before this scene was cast. */
    activity?: SlotActivity;
    /** What mods keep with this scene, under fields they declare on `ModSceneFields`. */
    mods?: ModSceneFields;
    /** Cast charIds, fixed for the whole scene. */
    cast: string[];
    /** The scene as delivered: the reader's action lines and every reply line, in order. */
    transcript: SceneLine[];
    /**
     * The running summary the last reply came with, or null; it covers the transcript up to its
     * mark's `at`.
     */
    summary: string | null;
    /**
     * The summaries in the order they landed, each with the transcript length it covers up to;
     * the last is {@link summary}. Absent when none has landed.
     */
    summaries?: SceneSummaryMark[];
    /** Background base name, without the `_day`/`_night` suffix. */
    bg: string | null;
    /** charIds occupying the three portrait slots, left to right; null = empty. */
    slots: Array<string | null>;
    /** Sticky per-character sprite reference, keyed by charId. */
    emotions: Record<string, SpriteRef>;
    /** Sticky mirrored-sprite flag, keyed by charId; decided when she is shown. */
    flipped: Record<string, boolean>;
    /** charIds who have sat out long enough to count as gone — out of the scene's prompts. */
    departed: string[];
    /**
     * charIds off-stage right now, mapped to the drained turns each has sat out; `hide:` opens an
     * entry, `show:` deletes it, and one reaching `DEPARTURE_TURNS` becomes {@link departed}.
     */
    offStage: Record<string, number>;
    /**
     * The player's own hand on the stage, keyed by charId: true where he has shown somebody the
     * scene did not, false where he has hidden somebody it did.
     */
    stageOverride?: Record<string, boolean>;
    /** The bg id he picked by hand, on the same terms as {@link stageOverride}. */
    bgOverride?: string;
    /** Per-character wardrobe locks, on the same terms again. */
    outfitLock?: Record<string, OutfitLock>;
    /** The CG he put on the stage by hand, on the same terms again. */
    cgLock?: CgLock;
    /**
     * Every line the player has read this scene, untrimmed — what the Chat Log Modal shows.
     * Never folded away, unlike `transcript`.
     */
    sceneLog: SceneLine[];
    /**
     * The class the scene is sitting in, by class code, or absent when it is not a class
     * scene.
     */
    classCode?: string;
    /** The course this scene's work session is for, or absent when it is not one. */
    projectClass?: string;
    /**
     * The job whose shift this scene is, or absent when it is not one; it injects the
     * workplace's lorebook paragraph.
     */
    jobId?: string;
    /** The stats the shift's rolled gain moves, or absent when the job has one gain to roll. */
    jobStats?: StatKey[];
    /** The charId this scene is a goodbye to, or absent when it is not one. */
    farewell?: string;
    /**
     * The one charId the slot's texting ledger must not read, or absent when it reads every
     * thread.
     */
    textLedgerSkip?: string;
    /**
     * The slot's texting-ledger reply once it has landed, so a reload claims it rather than
     * sending the call again; absent while the call is out or when nobody texted.
     */
    textLedger?: BankedTextLedger;
    /**
     * The charIds whose hangout invitation this scene left unanswered — threads the slot's
     * texting ledger must not read either — or absent when it answered every one.
     */
    ignoredInvites?: string[];
    /**
     * The charIds he turned down by text before this scene, said once each at its ending, or
     * absent when he turned nobody down.
     */
    turnedDownInvites?: string[];
    /**
     * The employer whose premises this scene is set on because a *character* is working there,
     * or absent when it is not one.
     */
    visitJobId?: string;
    /**
     * Roster charIds the action named without their being in the scene — bought for, thought
     * about, asked after — or absent when it named nobody absent.
     */
    mentions?: string[];
    /**
     * Where the classifier said this scene is set, in its own words, or absent when the action
     * did not say.
     */
    location?: string;
    /**
     * The scene is somewhere other people are around — what the witness roll at the
     * boundary tests.
     */
    inPublic?: boolean;
    /** The gifts handed over in this scene, in order, or absent when none were. */
    gifts?: SceneGift[];
    /**
     * The secret the scene's one girl tells the reader in it, or absent when she tells none; the
     * boundary files it as told.
     */
    secret?: string;
    /** The curveball the scene opened on, or absent when it opened on none. */
    event?: SceneEvent;
    /** The present a girl brings him in this scene, or absent when nobody does. */
    receivedGift?: ReceivedGift;
    /** The exam being sat, or absent when the slot is an ordinary scene. */
    quiz?: QuizState;
    /** The line last shown, so resuming doesn't land on an empty dialogue box. */
    currentLine: SceneLine | null;
    /**
     * Lines received but not yet played, oldest first. Empty means the capture was taken drained,
     * at a decision point; a populated queue resumes at its first line, unless
     * {@link resumeOnLine} holds it on the line already shown.
     */
    pendingLines: SceneLine[];
    /**
     * The capture was taken with {@link currentLine} on screen and the input closed: a load shows
     * that line as it stands and does not advance, and the next click is the same advance live
     * play would have taken. Absent on every other capture.
     */
    resumeOnLine?: true;
    /** The scene was already resolved when this was written: the slot ends when the queue drains. */
    endPending?: boolean;
    /** The resolved bookkeeping reply held alongside {@link endPending}. */
    ledger?: LedgerResponse;
    /**
     * The **next** slot's opening, already paid for and held alongside {@link endPending}, so the
     * boundary replays it rather than calling again.
     */
    opening?: BankedOpening;
}

/** What a finished scene does to the reader's stats, and the lines that say so. */
export declare interface SceneStats {
    deltas: PlayerStats;
    lines: StatusText[];
}

/** What the game resolved a scene's stats from: the ledger's verdict and the scene's facts. */
export declare interface SceneStatSettlement {
    /** What the hour exercised, as `exercisedStats` left it. */
    ledger: LedgerStats | undefined;
    ctx: StatContext;
}

/** Whether any enabled mod currently pauses optional scene suggestions. @since 0.8.0 */
export declare function sceneSuggestionsPaused(): boolean;

/** A running summary a scene reply came with, and the transcript length it covers up to. */
declare interface SceneSummaryMark {
    at: number;
    summary: string;
}

declare type SceneTextId = (typeof SCENE_TEXT_IDS)[number];

/** The scene on screen. Every value is read-only, and arrays and objects in it are frozen. */
export declare interface SceneView {
    /** A scene owns the screen: the game's own test for "not free roam". */
    readonly active: boolean;
    /** Everyone cast in the scene, by id. */
    readonly cast: readonly string[];
    /** The cast less whoever has left the scene, in cast order. */
    readonly present: readonly string[];
    /** Who stands in each portrait place, left to right, by id; null where nobody does. */
    readonly stage: readonly (string | null)[];
    /** The scene's lines so far, including lines still to be read. */
    readonly lines: readonly SceneViewLine[];
    /** The line on the box now, or null. */
    readonly line: SceneViewLine | null;
    /** Where the scene is, as the game noted it: a place id, or plain words; null where unset. */
    readonly location: string | null;
    /** The background playback has reached, by its base name; null before any. */
    readonly background: string | null;
    /** The class this slot is, or null. */
    readonly classCode: string | null;
    /** The job this slot is worked at, or null. */
    readonly jobId: string | null;
    /** The class whose project this slot is spent on, or null. */
    readonly projectClass: string | null;
    /** The slot activity running in the scene, a mod's or the game's own, or null. */
    readonly activity: Readonly<SlotActivity> | null;
    /** A scene the player made himself. */
    readonly created: boolean;
    /** A scene read again from the calendar. */
    readonly replay: boolean;
    /** An exam is being sat in the scene. */
    readonly quiz: boolean;
    /**
     * The orientation's or the graduation's slot, which the game writes end to end; else null, and
     * always null in a created scene or a replay.
     */
    readonly scripted: ScriptedSlot | null;
    /** A turn is being taken, or something holds the turn. */
    readonly busy: boolean;
    /** The reader's own turn, with nothing left to read. */
    readonly atTurn: boolean;
    /** Over a reply, the reader may cut in now, as the scene's interjection row lets him. */
    readonly canInterject: boolean;
    /** The last turn failed and waits on the reader. */
    readonly failed: boolean;
    /** The scene is ending. */
    readonly ending: boolean;
    /** The scene has resolved into its closing status sequence. */
    readonly resolved: boolean;
    /** The playthrough is over. */
    readonly over: boolean;
}

/**
 * The scene on screen as mods read it: a read-only view the kit defines, mapped from the game's
 * store. It holds what mods read and grows by request; it is never the store's own shape.
 */
/** One line of the scene as a mod reads it. */
export declare interface SceneViewLine {
    /** `READER_SPEAKER` for the reader's own action, a girl's id for her line, `''` for narration. */
    readonly speaker: string;
    /** What is said, as the scene holds it. */
    readonly text: string;
}

export declare type ScreenSlot = keyof ScreenSlotProps;

/**
 * What the game hands a mod's component at each place on screen it draws one. Every mod that is
 * on and has a component there is drawn, in list order.
 */
export declare interface ScreenSlotProps {
    settingsSection: {
        /** The half of the day the settings wear, which a modal raised over them wears too. */
        theme: ScreenTheme;
        /** A backup or a restore is running. */
        busy: boolean;
    };
    portraitOverlay: {
        charId: string;
    };
    phoneOverlay: Record<string, never>;
    chatsHeader: {
        theme: 'day' | 'night';
    };
    conversationFoot: {
        /** The open person's conversation key. The contribution remounts when the thread changes. */
        charId: string;
    };
    mapOverlay: {
        /** The map was opened to go somewhere, not only to look. */
        canTravel: boolean;
        /** Closes the map. */
        close: () => void;
    };
    photosPageSection: {
        theme: ScreenTheme;
    };
    editCharacterImages: {
        charId: string;
        /** Her name as it stands, in the editor as it is being typed. */
        name: string;
        theme: ScreenTheme;
        /** Her height, as a share of full size, the way the stage draws her. */
        height: number;
    };
    stageLayer: {
        /** A scene is on screen, rather than the landing or a game over. */
        sceneMode: boolean;
        /** The orientation's cinematic hour. */
        cinematic: boolean;
        /** A crossing between screens is over the view. */
        covered: boolean;
        /** The reader has hidden the interface. */
        uiHidden: boolean;
        /** The scene's action row is up. */
        rowShown: boolean;
        /** A panel, a modal or a failure stands over the scene, and it takes no input. */
        blocked: boolean;
        /** A quiz's answers stand in place of the action row. */
        quiz: boolean;
        /** The row stands over a reply still being read: open to a hover, or locked. Null otherwise. */
        interjectRow: 'open' | 'locked' | null;
        /** The scene is waiting on the reader's turn. */
        awaitingInput: boolean;
    };
    panelLayer: {
        cinematic: boolean;
        covered: boolean;
        uiHidden: boolean;
        blocked: boolean;
        /** One of the game view's panels is open. */
        panelOpen: boolean;
        /** Opens the game menu. */
        openGameMenu: () => void;
    };
    messageAttachment: {
        message: ChatMessage;
    };
    contactPostExtra: {
        charId: string;
        post: SocialPost;
    };
    railButton: {
        /** The rail's own seat, so a mod's button is drawn as the game's are. */
        Seat: ComponentType<RailSeatProps>;
        /** The rail is up: false behind a curtain, with the chrome hidden, or before Settings is. */
        visible: boolean;
        /** The rail stands but takes nothing. */
        dead: boolean;
    };
    landingTool: {
        /** The landing's own tool, so a mod's is drawn, and arrives, as the game's are. */
        Tool: ComponentType<LandingToolProps>;
        /** Settings is revealed, and with it the mods' tools. */
        visible: boolean;
    };
    gameMenuEntry: {
        /** The menu's own entry, so a mod's is drawn, and dealt in, as the game's are. */
        Item: ComponentType<GameMenuItemProps>;
        /** Whether a save can be written now (`'open'`), only once the reply in flight lands, or not at all. */
        saveOffer: ManualSaveOffer;
    };
    advancedSettingsEntry: {
        /** The half of the day the settings wear, which a modal raised over them wears too. */
        theme: ScreenTheme;
        /** A backup or a restore is running. */
        busy: boolean;
    };
}

/** The two halves the app is drawn in — a screen's `data-theme`, and the crossing's. */
export declare type ScreenTheme = 'day' | 'night';

/** A slot whose screen the game writes end to end. */
export declare type ScriptedSlot = 'orientation' | 'graduation';

/**
 * Which half of the year a semester is. A character's intake is the season she arrived in:
 * the January intake advances a year at the end of each fall, the August intake at the end of
 * each spring.
 */
declare type Season = 'spring' | 'fall';

/** A disposition tier a secret is told at. */
declare type SecretTier = 'friendly' | 'trusted' | 'devoted';

/**
 * The optional image sets that carry a seed-provenance flag: every wardrobe, the stock CG
 * set, which renders with the nude wardrobe and rerolls with it, and each custom CG pair.
 */
declare type SeededSet = OutfitSet | 'cg' | CustomCgSlot;

/**
 * A labelled closed picker in the final design — {@link TextField}'s sibling, and the
 * shape `TagSelect`'s own dropdown wears.
 */
export declare function SelectField({ id, label, value, onChange, options, hint, disabled }: SelectFieldProps): JSX.Element;

export declare interface SelectFieldOption {
    value: string;
    label: string;
    /** Offered and not pickable, where something else on the form rules it out. */
    disabled?: boolean;
}

export declare interface SelectFieldProps {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: readonly SelectFieldOption[];
    /** The body-text line under the label saying what the choice means; it may carry a link. */
    hint?: ReactNode;
    /** Held where something else on the form decides it, the field dimmed as a dead one is. */
    disabled?: boolean;
}

/**
 * One semester's fixed calendar, the changes it made to it and the occasions it invented — every
 * occasion read takes one.
 */
declare interface SemesterCalendar {
    readonly season: Season;
    readonly generated: readonly Occasion[];
    readonly fixedEdits: Readonly<FixedOccasionEdits>;
}

/**
 * What a finished semester leaves for the calendar to read back, in its own day numbers: its
 * history, its replays, the reader's timetable and his plans.
 */
declare interface SemesterLog {
    history: GameHistory;
    replays?: GameReplays;
    playerSchedule: Record<number, string>;
    events: CalendarEvent[];
}

/**
 * One semester after the first, as the Continue that began it settled it: the record's own
 * fields for that semester, and the semester it continued from as its ending left it.
 */
declare interface SemesterRecord {
    /** Which semester of the playthrough this is, from 1: one more than its parent's. */
    index: number;
    /** The semester it continued from; absent when that was the first. */
    parent?: string;
    /** The on-campus roster, in roster order. */
    chars: string[];
    /** Every girl who has graduated by this semester, oldest first. */
    alumni: string[];
    classes: Record<string, ClassEntry>;
    occasions: Occasion[];
    /** Its changes to its fixed occasions; absent where it made none. */
    fixedEdits?: FixedOccasionEdits;
    /** The random picks its New Game+ left masked, by charId; absent where none. */
    masked?: string[];
    jobClosures: Record<string, ShiftSlot[]>;
    weather: Weather[];
    /** The roster's and the graduates' settled halves, keyed by charId. */
    profiles: Record<string, CharProfile>;
    /** The senior picked to graduate early at this fall's ceremony; absent in a spring or with none. */
    fallGraduate?: string;
    /**
     * What the break cost, for the first morning's line: the stats that fell a tier and the girls
     * handed a break penalty, in roster order; absent when it cost nothing.
     */
    breakDecay?: {
        stats: StatKey[];
        girls: string[];
    };
    /** The semester it continued from, as the ending that continued it left it. */
    before: SemesterLog;
}

/** The default part of an edit's Base and Negative groups, as one kept edit was sent with. */
declare interface SentDefaults {
    base: string[];
    negative: string[];
}

/** What somebody sent, as the mod drawing sent text draws it; the bare text otherwise. */
export declare function SentText({ text, big }: {
    text: string;
    big?: boolean;
}): JSX.Element;

/**
 * How a mod draws what somebody sent — a phone message, a post, a comment — in place of its bare
 * text. Only one draws it, the first mod that is on and has one ({@link sentText}).
 */
export declare interface SentTextSpot {
    /** The text drawn; `big` off where it stands on a one-line preview. */
    Text: ComponentType<{
        text: string;
        big?: boolean;
    }>;
    /** Whether a phone message is drawn bare, with no bubble behind it. */
    bare?: (text: string) => boolean;
}

/** Pause optional scene suggestions for this mod until it releases its pause or the game is left or loaded.
 * A pause is ignored while its mod is off. Release it on stop, failure and switch-off. @since 0.8.0
 */
export declare function setSceneSuggestionsPaused(modId: string, active: boolean): void;

/**
 * One set of a character's images, as the Edit modal's controls address them: the default
 * wardrobe, one of the alternates, the stock CGs, the room backgrounds, or one custom CG pair.
 */
declare type SetTarget = 'default' | OutfitSet | 'cgs' | 'room' | CustomCgSlot;

/**
 * Dev-authored setting text injected into every scene prompt. This is the always-on half
 * of the world: the two entries every scene needs whatever it is about. A playthrough's own
 * lorebook may rewrite it.
 */
export declare const SETTING = "VENUS UNIVERSITY (VU)\nMotto: Concordia et Prosperitas | Founded 2014 by Frederic Thorne | 6k Student Population.\n\nVenus University is a private megacampus built to maximize social connection. It admits students by a controversial lottery draw and funds a robust financial aid program off a seemingly bottomless endowment. The campus blends classical and ultra-modern architecture and walls itself off from the noisy city with lush gardens. Towering statues of Roman gods mark it: Venus in the quad, Jupiter at the North Entrance, Pluto at the South. Roads are paved with colored stone for navigation and purpose-built to be long and winding. The two major roads are the Gold Road, which links Jupiter and Pluto, and the Rose Road, which passes Venus and links the academic and residential areas. \"Meet me where Gold crosses Rose\" was cemented in national lingo by a romance film shot here called \"Love Between Gods\".\n\nCampus: Venus Quad (Concord Fountain), Agora (food court, study pods), Pino-Cola Lounge (games, study desks), Kendall Library, Whitman Greenhouse, Thorne Auditorium (concert hall, practice rooms, recording studios), Palaestra Stadium (gym, pool, turf, track).\nHousing: Elysium Village (upperclassmen townhouses), Lowrises 1 to 5 (anyone). All rooms are single-occupancy with shared facilities: no roommates.\nStudent government: VSA, split into CAPC (decor, plants) and SEB (events, mixers).\nSocial App: Bunnyboard.\n\nVERIDAN, USA\nRiver City (the Silk River) | Always Spring | 300k Population | Transit: The Loop electric tram.\n\nNineteenth-century textile money built Veridan, but its mills died in the 1970s and it coasted downhill until Thorne planted VU here in 2014, triggering an investment boom that delighted some longtime residents and enraged others. Sheltered by the river valley, it sits in a near-perpetual spring that meteorologists still can't explain properly.\n\nDistricts: Stanchion Street ($), Downtown ($$), Promenade ($$$).\nStanchion: BTB Arcade, Stalestein Bar (and stage), Hotel DREAMS (love hotel), Freights Books & Records, Pastel Palace (sweets), CuteTea, Eastern Buffet.\nDowntown: Green Hill Park, Lotterdale Market, Reserve Bank Cafe, Bobby's Diner, SpringMart, Fast Eats, Pier 44 Amusement Park.\nPromenade: Riverside Mall, Aquarium at Riverside, Future Cinema, Selkie Beach, Club Apogee, Lumiere Fusion (fine dining), Veridan Museum of Art.";

/** One thing a worked shift can pay: the stats it moves a point each, and the sentence that says so. */
declare interface ShiftGain {
    stats: readonly StatKey[];
    text: string;
}

/**
 * A weekly *shift* slot: `shiftWeekday * 2 + time`, weekday 0 = Monday. 0 = M/Day through 13 =
 * Su/Night; see `shared/jobs.ts`.
 */
declare type ShiftSlot = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

/** Raises the game's error modal over whatever is showing, as the game does for its own failures. */
export declare function showError(error: AppError): void;

/** What a caller can change about one silent-retry decision. */
export declare interface SilentRetryOptions {
    /** Narrows the codes worth a resend below the retryable tier, for a call billed on some of them. */
    retryable?: (code: string) => boolean;
    /** Asked before each resend: true abandons the retry and falls through to the modal. */
    skip?: () => boolean;
    /** Handed a canceller for the sleep in progress. */
    onSleep?: (cancel: () => void) => void;
}

/**
 * The same row, dealt into a panel that arrives *with* it rather than resizing under it, unlike
 * {@link slideIn} — a picker's rows must be ready while the player is still reaching for one.
 */
export declare const slideInQuick: Variants;

/** Saved with the scene. The game pays nothing for it; a mod that rewards one does so as the scene settles. */
declare interface SlotActivity extends SlotActivityOffer {
    status: 'pending' | 'completed' | 'abandoned';
    result?: string;
    /** Set once the reply to its closing turn has landed: from then on the scene runs as any other. */
    closed?: true;
}

/** A mod-owned activity chosen on the landing, before the scene is cast. */
declare interface SlotActivityOffer {
    owner: string;
    id: string;
    label: string;
    location: string;
    stat: StatKey;
}

/** `'day'` or `'night'`: the half a slot is, as the bg suffix, the theme and the prompts say it. */
export declare function slotHalf(time: TimeSlot): 'day' | 'night';

/** Everything the builder reads; assembled by the loop, which owns the store. */
export declare interface SlotIntroInput {
    storyMemory?: StorySnapshot;
    exCharacterDynamics?: CharacterDynamics;
    /** The cloud-LLM cache key — the playthrough, exactly as the scene calls use it. */
    playthroughId: string;
    /** Today, for weighting the askers' memories. */
    date: number;
    /** The reader's accumulated stats, used for relationship requirement guidance. */
    stats?: PlayerStats;
    /** Which half of the day is opening: a day slot is the one he wakes into. */
    time: TimeSlot;
    /** The player's `lessNsfwText` setting; picks which persona heads this call's prefix. */
    lessNsfwText: boolean;
    /** The edits a mod hands the global text blocks; absent when none is supplied. */
    globalTextEdits?: TextEdits<GlobalTextId>;
    /** How many of her told secrets each girl's entry carries; absent is the default. */
    secretBudget?: number;
    /** The app-written first line the narration continues from. */
    opening: string;
    /**
     * The last three slots' summaries, newest last, each stamped with the slot it
     * covers. May be empty in a fresh game.
     */
    recent: readonly string[];
    /**
     * Contacts texting an invitation this slot; empty whenever the player is
     * booked — a class or a shift.
     */
    askers: readonly IntroAsker[];
    /** The lovers the finished slot left for somebody else, each ending it over text now. */
    breakups: readonly IntroBreakup[];
    /** The girls the spring break pick just sent away, each texting him she is going. */
    leavers: readonly IntroLeaver[];
    /** The graduate Homecoming morning brings back, texting him she is in town. */
    visitors: readonly IntroVisitor[];
    /** The one contact, if any, texting him just to talk this slot. */
    reachOuts: readonly IntroReachOut[];
    /**
     * Characters posting a status update this slot — the 10% roll's passers, anyone also
     * under {@link askers} included.
     */
    posters: readonly IntroPoster[];
    /**
     * What is going on in the world in **this slot alone**, fixed calendar already merged
     * in by the loop.
     */
    occasions: readonly Occasion[];
    /** The semester's season, which the exam lookahead names its dates by. */
    season: Season;
    /**
     * Which semester a later one's first morning opens, for the line saying he is back on campus;
     * absent on every other slot.
     */
    backOnCampus?: number;
    /** The lorebook lines for what this slot leads up to, built by the loop beside `occasions`. */
    occasionLeadUps?: readonly string[];
    /**
     * The whole semester's sky, one reading per slot — the `WEATHER` block walks back through it
     * for how long the weather has held. Absent means the block is not written at all.
     */
    weather?: readonly Weather[];
    /**
     * Pre-formatted lorebook paragraphs for girls none of the blocks name — the closest
     * friends `ambientLoreCharacters` picks out.
     */
    backgroundLore?: readonly string[];
    /** Who leaves campus for spring break, or null before the pick has run. */
    springBreakAway?: readonly string[] | null;
    /** The graduate back in town for Homecoming, as a charId; absent on every other slot. */
    homecomingVisitor?: string;
    /**
     * The place `SOMEWHERE TO GO` invents a rumor about. **Drawn by the loop rather than
     * here**, which is what lets the reply's own sentence about it be banked and carried into the
     * scene the reader spends the slot in; absent means the block is not written at all.
     */
    rumorPlace?: LoreEntry;
}

/**
 * The slot-opening narration. Narration only: it carries no
 * speaker, emotion, action or bg, so nothing in it can touch the stage.
 */
declare interface SlotIntroResponse {
    lines: Array<{
        text: string;
    }>;
    /**
     * One text-message invitation per character the slot rolled in: `char` is her
     * charKey, `text` the message and `description` the plan a yes starts the scene from.
     */
    hangouts?: Array<{
        char: string;
        text: string;
        description: string;
    }>;
    /**
     * The messages each girl the reader left for somebody else sends to end it: `char` is her
     * charKey, `texts` the run of messages in the order she sends them.
     */
    breakups?: Array<{
        char: string;
        texts: string[];
    }>;
    /**
     * One status update per character the slot's posting roll picked. `char` is her
     * charKey; `text` is the post.
     */
    posts?: Array<{
        char: string;
        text: string;
    }>;
    /**
     * The messages each girl leaving campus for spring break sends to tell the reader she is going:
     * `char` is her charKey, `texts` the run of messages in the order she sends them.
     */
    springBreakTexts?: Array<{
        char: string;
        texts: string[];
    }>;
    /**
     * The messages the girl the slot rolled to reach out sends, just to talk: `char` is her charKey,
     * `texts` the run of messages in the order she sends them.
     */
    reachOuts?: Array<{
        char: string;
        texts: string[];
        [field: string]: unknown;
    }>;
    /**
     * The messages the graduate back for Homecoming sends to tell the reader she is in town:
     * `char` is her charKey, `texts` the run of messages in the order she sends them.
     */
    homecomingTexts?: Array<{
        char: string;
        texts: string[];
    }>;
}

/** A read-only preview of the finished scene, before the crush roll and next opening. */
export declare type SlotMemoryProjection = Pick<SlotSettled, 'before' | 'closingCast'>;

/** Everything the slot opening needs, produced once at the previous scene's end. */
declare interface SlotOpening {
    /** The narration, as playback lines — the action prompt included. */
    lines: SceneLine[];
    /** The invitations the opening rolled, delivered to the phone at step 1. */
    hangouts: SlotIntroResponse['hangouts'];
    /** The texts the girls the reader left wrote, delivered to the phone at step 1. */
    breakups?: SlotIntroResponse['breakups'];
    /**
     * The occasion this opening's askers asked him to, stamped onto their invitations at step 1.
     * Absent for a slot that had none, or that he was not free to go to one on.
     */
    askOccasionId?: string;
    /**
     * The everyday ask each asker's invitation was rolled into, by charKey, stamped onto her
     * invitation at step 1. Absent for an opening that rolled none.
     */
    everydayAsks?: Record<string, EverydayAsk>;
    /**
     * What each asker's invitation was rolled into asking, by charKey, stamped onto her invitation
     * at step 1. Absent for an opening that rolled none.
     */
    inviteKinds?: Record<string, InviteKind>;
    /** The plans the merged ledger found, normalized and attendance-filtered. */
    events: CalendarEvent[];
    /** Who that filtering took off an event, announced by text at step 1. */
    cancellations: EventCancellation[];
    /** Who is spending the coming slot with whom, rolled alongside the narration. */
    npcOverlay?: NpcSlotOverlay;
    /**
     * The place this opening's `SOMEWHERE TO GO` block invented a rumor about, and the sentence
     * it invented. Absent for a slot that drew none, or whose rumor named no place.
     */
    slotRumor?: {
        placeId: string;
        sentence: string;
    };
    /** The status updates the opening's posters wrote, filed to their own feeds at step 1. */
    posts?: SlotIntroResponse['posts'];
    /** The texts the girls leaving for spring break wrote to say so, delivered at step 1. */
    springBreakTexts?: SlotIntroResponse['springBreakTexts'];
    /** The texts of the one girl the opening rolled to reach out just to talk, delivered at step 1. */
    reachOuts?: SlotIntroResponse['reachOuts'];
    /** The texts the graduate back for Homecoming wrote to say she is in town, delivered at step 1. */
    homecomingTexts?: SlotIntroResponse['homecomingTexts'];
    /**
     * Who leaves campus for spring break, picked by the ending whose next slot is the first on or
     * after the notice and assigned by the boundary. Absent on every other opening.
     */
    springBreakAway?: string[];
    /**
     * The graduate back in town for Homecoming, picked by the ending whose next slot is Homecoming
     * morning and assigned by the boundary. Absent on every other opening, and on that one when
     * nobody qualifies.
     */
    homecomingVisitor?: string;
    /**
     * What campus saw of the scene that ended into this slot — rolled at the ending off
     * the ledger it just paid for, so the narration above can say what is being said.
     */
    rumorPass?: RumorPassOutcome;
    /**
     * The roster's affinities after that same scene, settled at the ending because the
     * evening the narration describes is dealt off them.
     */
    npcRelationships?: NpcRelationshipMap;
    /**
     * Whoever fell for the reader in that same scene — rolled at the ending after the witness
     * pass, so the narration above describes her as she now feels.
     */
    crushes?: string[];
    /**
     * The colds that same slot passed on, and a strain that reached campus in it. Absent on an
     * opening banked before colds existed, which passes on none.
     */
    coldPass?: ColdPass;
}

/**
 * The place a slot opening invented a rumor about, and the sentence it invented.
 * Stamped with the slot it was drawn for, so a stale one is simply ignored (`npcOverlay`'s rule).
 */
declare interface SlotRumor {
    date: number;
    time: TimeSlot;
    /** The `LOREBOOK` entry's own id, which is a location id. */
    placeId: string;
    /** The narration's own words about the place, injected into that entry once. */
    sentence: string;
}

export declare interface SlotSettled {
    before: ReturnType<typeof useGameStore.getState>;
    ledger: LedgerResponse | null;
    closingCast: readonly Character[];
}

/** One status update on the social feed; its likes are rolled once and stored. */
declare interface SocialPost {
    /**
     * What mods keep with this post, keyed by the mod's id. Core never reads inside a slice and
     * writes each one back as read; every value is plain JSON.
     */
    ex?: Record<string, ModSlice>;
    /** crypto.randomUUID(); the stable list key and what a like is addressed to. */
    id: string;
    text: string;
    /** The game date it was posted; negative for a winter-break post, which falls before day 0. */
    date: number;
    time: TimeSlot;
    /** Everyone she is close to, plus a few strangers (`rollPostLikes`, `shared/feed.ts`). */
    likes: number;
    /**
     * The player liked it. Absent means he has not, and the count on screen is `likes` alone.
     */
    liked?: boolean;
    /** The game date the like was made — absent exactly when `liked` is. */
    likedOn?: number;
    /** What was said under it, written and drawn by a mod; the game draws none of its own. */
    comments?: PostComment[];
}

/** A block plus the blank line that separates it from the next, or nothing when the block is empty. */
export declare function spaced(lines: readonly string[]): string[];

/**
 * Everything a `sprite:`/`cg:` action and the stage's sticky map may hold: a bare emotion, an
 * emotion suffixed with an outfit set, or a position, which shows a CG.
 */
declare type SpriteRef = Emotion | Position | `${Emotion}_${OutfitSet}`;

/** URL for a character image, with a cache-buster for regenerations. */
export declare function spriteUrl(charId: string, value: SpriteRef, version?: number, staged?: boolean): string;

declare const STARTING_CHALLENGES: {
    readonly 'uphill-battle': {
        readonly name: 'Uphill Battle';
        readonly points: -30;
    };
    readonly 'rock-bottom': {
        readonly name: 'Rock Bottom';
        readonly points: -60;
    };
};

declare type StartingChallenge = keyof typeof STARTING_CHALLENGES | {
    version: 2;
    floors: Record<StatKey, ChallengeFloor>;
};

/** Extra start/display tiers do not renumber native job and attraction requirements. */
declare type StartingStatTier = ChallengeStatTier | StatTier;

/** Open an ordinary native scene with one invited participant. Initialize the mod's field
 * through its own handle after staging and before the first prompt. */
export declare function startInvitedScene(modId: string, id: string, action: string, initialize: () => void, eligible?: () => boolean): Promise<void>;

/** What the app knows about the slot that the ledger does not. */
declare interface StatContext {
    /**
     * The scene had no other characters in it: every exercised stat counts, and each pays twice.
     */
    solo: boolean;
    /** The scene *was* the reader's class, whose stat the timetable decides. */
    classScene: boolean;
    /**
     * The player was enrolled in a class this slot, and whether the scene was in it.
     */
    classOutcome: {
        stat: StatKey;
        attended: boolean;
        showcase?: boolean;
    } | null;
    /**
     * The scene was a worked shift, carrying the gain rolled when it was cast. When set it
     * **replaces** everything else here and the ledger's award: the gain's own points are the
     * only stat movement.
     */
    jobOutcome: {
        gain: ShiftGain;
    } | null;
    /** A midterm result that reached the reader this slot, in class or off his phone. */
    gradeOutcome?: {
        heart: number;
        lines: StatusText[];
    } | null;
    /** The reader's cold kept him from getting anything out of the hour; a grade still lands. */
    sick?: boolean;
}

/** The three stats, in display order. */
declare type StatKey = 'brain' | 'body' | 'heart';

/** Tier 0 is the floor, tier 5 the ceiling. */
declare type StatTier = 0 | 1 | 2 | 3 | 4 | 5;

/** The two beats that own the screen — `gameStore.statusModal`'s value. */
declare type StatusModal = {
    kind: 'rankUp';
    /** The stats that crossed; the two readings below say which tiers. */
    ups: StatKey[];
    /** The reader either side of the scene: the chart walks from one to the other. */
    before: PlayerStats;
    after: PlayerStats;
} | {
    kind: 'milestone';
    charId: string;
    name: string;
    lines: string[];
    negative: boolean;
    /** The face she is drawn with, read off the same flag diff as the sentences. */
    emotion: Emotion;
};

/** What a status line carries beyond its words. */
declare interface StatusNote {
    marks: TextMark[];
    /** The balance either side of this line, for the card that counts between them. */
    money?: {
        from: number;
        to: number;
    };
    /** Which way this line went, for the sting its arrival fires; absent rings nothing. */
    polarity?: Polarity;
}

/** One status sentence and which way it went, for the sting its arrival fires. */
declare interface StatusText {
    text: string;
    polarity?: Polarity;
}

/** The three alternate wardrobes every character renders from her own record's tags. */
declare type StockOutfitSet = 'pe' | 'swim' | 'nude';

/** The eight stock positions every character can have a CG rendered in. */
declare type StockPosition = 'nude_foreplay' | 'nude_foreplay_after' | 'sex' | 'sex_after' | 'handjob' | 'handjob_after' | 'fellatio' | 'fellatio_after';

declare const STORY_CATEGORIES: readonly ['memory_restoration', 'role', 'promise', 'secret', 'relationship', 'other'];

declare type StoryCategory = (typeof STORY_CATEGORIES)[number];

declare interface StoryFact {
    id: string;
    subject: string;
    category: StoryCategory;
    text: string;
    timeline: StoryTimeline;
    certainty: 'event' | 'claim';
    claimant: string | null;
    knownBy: string[];
    public: boolean;
    date: number;
    time: TimeSlot;
    evidence: string;
    source: string;
    supersedes: string[];
    manual: boolean;
    batch?: string;
    origin?: TermOrigin;
}

declare interface StoryMemory {
    version: 1;
    facts: StoryFact[];
    edits: Record<string, StoryFact>;
    hidden: string[];
    encounterSubjects: Record<string, string[]>;
    encounterEdits: Record<string, {
        text?: string;
        hidden?: boolean;
    }>;
    /** Recaps from completed semesters, separate from the active semester's history. */
    pastEncounters?: PastEncounter[];
    names?: Record<string, string>;
}

declare type StoryMemoryMode = 'standard' | 'light';

declare interface StoryRecallRequest extends StorySnapshot {
    cast: string[];
    query: string;
    /** Current-semester recaps already present verbatim, with their date, in native context. */
    coveredEncounters?: string[];
    /** A slot request writes several independent voices; private recall belongs only to its DM author. */
    slotAuthors?: {
        dm: string[];
        posts: string[];
    };
    /** Request-only preference; never stored in the playthrough's memory collection. */
    mode?: StoryMemoryMode;
}

declare interface StoryRecord extends Omit<StoryFact, 'category' | 'manual'> {
    kind: 'fact' | 'encounter';
    subjects: string[];
    category?: StoryCategory;
    manual?: boolean;
}

declare interface StorySnapshot {
    playthroughId: string;
    records: StoryRecord[];
    names: Record<string, string>;
    date: number;
    time: TimeSlot;
}

declare type StoryTimeline = 'current' | 'alternate' | 'unspecified';

/**
 * A structured-output request: prompts plus the schema the reply must match — what every
 * structured cloud call carries from the renderer's prompt builders to the adapters.
 */
declare interface StructuredRequest {
    /** Local-only recall snapshot; stripped before the provider request. */
    storyMemory?: StoryRecallRequest;
    system: string;
    user: string;
    /** JSON Schema the reply is constrained to. */
    schema: {
        name: string;
        schema: Record<string, unknown>;
    };
    /** Advisory prompt-cache affinity key for providers that expose one. */
    cacheKey?: string;
    /**
     * Which call this is, for the one setting that routes by it: the secondary model.
     * Absent on every call that is never routed, which is most of them.
     */
    kind?: PromptKind;
    /**
     * The least effort this call runs at — a stored level below it is raised to it; absent on
     * every call that takes the setting as it is.
     */
    minThinking?: ThinkingLevel;
    /** Images attached to the user turn, base64 without the `data:` prefix. */
    images?: ReferenceImage[];
    /**
     * Where the console log's copy of `user` starts: the offset past a preamble that never varies
     * for this `cacheKey` — rules and vocabularies a reader of the log has seen on every call
     * before. Absent logs the whole message.
     */
    logFrom?: number;
    /** Local-only: the parts a scene builder emitted, each found verbatim in `system` or `user`. */
    parts?: PromptPart[];
    /** Local-only: which scene call a builder made and who is in it. */
    sceneSpot?: SceneSpotTag;
    /** Local-only: each mod's tag for its main-process request hook, by mod id. */
    modTags?: Record<string, unknown>;
}

/**
 * Handles one player submission: classify/cast, stream scene, and snapshot first.
 * Continuations reuse the slot cast; streamed lines remain preview until resolved.
 */
export declare function submitAction(action: string, gift?: boolean, preset?: Verdict, 
/** The plan whose landing button this is; its attendees are cast whatever the words name. */
planId?: string, 
/** What a failed attempt at this turn rolled, so its retry opens on the same. */
sceneEvents?: TurnSnapshot['sceneEvents'], 
/** Whose reminder a failed attempt at this plan answered, so its retry skips her thread too. */
answeredReminder?: string, activity?: SlotActivityOffer): Promise<void>;

/** Watches settings and setup, notifying only when local rendering availability changes. */
export declare function subscribeCanRenderLocalImages(onChange: () => void): () => void;

/** Watches only that character's definition and its availability. @since 0.8.0 */
export declare const subscribeCharacter: (id: string, onChange: () => void) => () => void;

/** Watches only her state record and its availability. @since 0.8.0 */
export declare const subscribeCharacterInfo: (id: string, onChange: () => void) => () => void;

/** Watches only date, time, season and availability. @since 0.8.0 */
export declare const subscribeClock: (onChange: () => void) => () => void;

/** Watches only this thread, not other conversations or phone navigation. @since 0.8.0 */
export declare const subscribeConversation: (id: string, onChange: () => void) => () => void;

/** Watches only her post list and its availability. @since 0.8.0 */
export declare const subscribeFeed: (id: string, onChange: () => void) => () => void;

/** Watches only the legacy marker and its availability. @since 0.8.0 */
export declare const subscribeFeedReadThrough: (onChange: () => void) => () => void;

/** Fires only when the image API's configured/not-configured answer changes. */
export declare function subscribeImageApiConfigured(onChange: () => void): () => void;

/** Re-evaluate invitation availability, including changes within the same slot. */
export declare function subscribeInvitations(listener: () => void): () => void;

/** Fires only when the selected source changes, independently of setup readiness. */
export declare function subscribeLocalImageSource(onChange: () => void): () => void;

/** Calls back only when the image rule changes; the returned function stops listening. */
export declare function subscribeNoNsfwImages(onChange: () => void): () => void;

/** Watches only the relationship map and its availability. @since 0.8.0 */
export declare const subscribeNpcRelationships: (onChange: () => void) => () => void;

/** Watches only phone-open and selected-thread changes, without exposing its actions or store. */
export declare function subscribePhoneView(onChange: () => void): () => void;

/** Watches only the player's picture. @since 0.8.0 */
export declare const subscribePlayerProfilePicture: (onChange: () => void) => () => void;

/** Watches only the stats and their availability. @since 0.8.0 */
export declare const subscribePlayerStats: (onChange: () => void) => () => void;

/** Watches only her profile image URL, including a new sprite version. @since 0.8.0 */
export declare const subscribeProfileImageUrl: (id: string, onChange: () => void) => () => void;

/** Watches only changes in the native block's output. @since 0.8.0 */
export declare const subscribeReaderPromptText: (onChange: () => void) => () => void;

/** Watches the requested roster, including changes when a game is loaded or left. @since 0.8.0 */
export declare function subscribeRosterIds(onChange: () => void, options?: {
    alumni?: boolean;
}): () => void;

/**
 * Calls back when the scene changes; with `select`, only when what it selects changes, compared
 * with `Object.is`. Returns the unsubscribe function. @since 0.8.0
 */
export declare function subscribeScene<T>(onChange: () => void, select?: (view: SceneView | null) => T): () => void;

/** Watches changes to scene ownership, not changes to every scene field. @since 0.8.0 */
export declare const subscribeSceneActive: (onChange: () => void) => () => void;

/** Call the listener when the combined pause changes, including on load, exit or switch changes. @since 0.8.0 */
export declare function subscribeSceneSuggestionsPaused(listener: () => void): () => void;

export declare function subscribeSceneTurns(listener: () => void): () => void;

/**
 * One girl's suspicion that the reader is seeing another: the other girl, and the global slot
 * of the last sign she got; a second sign within the window makes her tell.
 */
declare interface Suspicion {
    subject: string;
    slot: number;
}

/**
 * Brings the scene to a decision point a turn can go out from, sending nothing: the unread lines
 * cut, the live scene call and any ending dropped and the cut written as a decision point; over a
 * reply's last line, that line taken as turned; at a decision point already, nothing to do. False
 * when none of these applies.
 */
export declare function takeTurnFromReply(): boolean;

/** Bounded save data for purchased abilities; handlers live in compiled source packs. */
declare interface TalentAbilityState {
    uses: Record<string, {
        term: number;
        week: number;
        token?: string;
    }>;
    eureka?: {
        term: number;
        code: string;
        exam: 'midterm' | 'final';
    };
    farewell?: {
        term: number;
        date: number;
        time: 0 | 1;
        charId: string;
        action: string;
        at: number;
        ended?: boolean;
    };
    silverLining?: {
        term: number;
        date: number;
        time: 0 | 1;
        charId: string;
        action: string;
        at: number;
    };
    anticipation: Record<string, {
        term: number;
        date: number;
        time: 0 | 1;
    }>;
}

/** Read-only compatibility with early test saves. These fractions do not affect new gains. */
declare type TalentGrowth = PlayerStats;

declare interface TalentState {
    initialized: boolean;
    earned: number;
    seed: number;
    spent: number;
    ranks: Record<string, number>;
    settled: Record<string, true>;
    purchases: number;
    reserve: number;
    reserveFloor: number;
    savingsTerm: number;
    savingsSeen: number;
    savingsDay: number;
    interestEarned: number;
    recent: Array<{
        slot: string;
        points: number;
        characters: number;
    }>;
    abilities: TalentAbilityState;
    /** Last day Show Up paid out; retained across saves and mod toggles. */
    showUpDay?: {
        term: number;
        date: number;
    };
    /** Inert legacy test-build data; retained on load, never used to scale new gains. */
    growth?: TalentGrowth;
    /** Unfinished BP from scaled rewards; never spent until it makes a whole point. */
    bpFraction?: number;
    training?: TalentTraining;
}

declare interface TalentTraining {
    recovery?: {
        term: number;
        targets: PlayerStats;
        remaining: PlayerStats;
    };
    week?: {
        term: number;
        week: number;
        total: number;
        newPoints: number;
    };
}

declare interface TermCarryContext {
    /** Zero-based outgoing semester. */
    term: number;
    /** Days subtracted from native memories by the semester implementation. */
    back: number;
    characters: Record<string, Character>;
}

/** Original semester/day for a saved event whose working date is now before day zero. */
declare interface TermOrigin {
    term: number;
    day: number;
}

declare type TextBlockId = SceneTextId | GlobalTextId;

/**
 * One long text opened for hand-editing in a well, behind Save, with the shipped text a click
 * away and a discard confirm in front of leaving it unsaved.
 */
export declare function TextEditModal({ theme, id, idPrefix, title, label, discardMessage, stored, shipped, allowEmpty, save, onClose }: TextEditModalProps): JSX.Element | null;

export declare interface TextEditModalProps {
    /** Drawn by the screen that raised this — a portal inherits neither palette nor state rules. */
    theme: ScreenTheme;
    /** The panel's own id; its controls are named under `idPrefix`. */
    id: string;
    idPrefix: string;
    title: string;
    label: string;
    /** What the discard confirm says has not been kept. */
    discardMessage: string;
    /** What is kept now. */
    stored: string;
    /** What Reset to default puts back in the well. */
    shipped: string;
    /** Lets an empty well be saved, for a text whose shipped text is empty. */
    allowEmpty?: boolean;
    /** Keeps the well's text, its trailing whitespace taken off; true where it was kept. */
    save: (value: string) => boolean | Promise<boolean>;
    onClose: () => void;
}

/** Edits to text blocks, by id; an absent id sends the shipped text. */
declare type TextEdits<Id extends string = TextBlockId> = Partial<Record<Id, string>>;

/** The edits the builders are handed: the cast scene's own, and every other call's. */
declare interface TextEditSet {
    scene?: TextEdits<SceneTextId>;
    global?: TextEdits<GlobalTextId>;
}

/**
 * A labelled text field: pill single-line, rounded box multiline. The layout is `base.css`'s,
 * shared by every form.
 */
export declare function TextField({ id, label, value, onChange, placeholder, hint, maxLength, onBlur, multiline, rows, autoGrow, autoFocus, disabled }: TextFieldProps): JSX.Element;

export declare interface TextFieldProps {
    id: string;
    /** The mono label over the box; it is also what the field is called to a screen reader. */
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    /** The one line of body text under the label saying what shape the field wants. */
    hint?: string;
    /** Caps how much the field takes, single-line or multiline; a name is 32. */
    maxLength?: number;
    /** Fires when the field is left, single-line or multiline, for whatever its value is checked against. */
    onBlur?: () => void;
    multiline?: boolean;
    rows?: number;
    /** Grow the box to fit its text. */
    autoGrow?: boolean;
    /** Takes focus when the field mounts — a form modal's first field. */
    autoFocus?: boolean;
    /** Dims the whole field and disables its input, the way a dead checkbox row does. */
    disabled?: boolean;
}

/** The prompt-facing slice of state a texting turn needs. */
export declare interface TextingPromptState {
    /** The edits a mod hands the global text blocks; absent when none is supplied. */
    globalTextEdits?: TextEdits<GlobalTextId>;
    storyMemory?: StorySnapshot;
    /** Supplied only while the standalone Breakthrough mod is enabled. */
    breakthrough?: BreakthroughState;
    /** Recent stored messages to include: 20 by default, at most 160; not a token budget. */
    historyLimit?: number;
    exCharacterDynamics?: CharacterDynamics;
    date: number;
    time: TimeSlot;
    /** The reader's accumulated stats, used for relationship requirement guidance. */
    stats?: PlayerStats;
    /**
     * Every roster character except the one being texted — the lorebook's people,
     * excluded at the source so no entry can restate the `CHARACTER` block.
     */
    roster: readonly Character[];
    /** The playthrough's lorebook: the shipped entries as the player has them, then his own. */
    lorebook: readonly BookEntry[];
    /** Per-character save state, keyed by charId — read for the roster's entries. */
    charInfo: Record<string, CharInfo>;
    /**
     * What the roster thinks of each other: read for the friend her `CHARACTER` block
     * names and for the standing every lorebook character entry closes with.
     */
    npcRelationships: NpcRelationshipMap;
    /** The save's class roster, keyed by class code — names the schedules. */
    classes: Record<string, ClassEntry>;
    /** The reader's own timetable, sparse slot → class code. */
    playerSchedule: Record<number, string>;
    /** Who sits in each class of the catalog, by class code. */
    classRosters: Readonly<Record<string, ClassRoster>>;
    /** The part-time job the reader holds, or null — the rest of his week. */
    playerJob: JobState | null;
    /** The semester's season and the occasions the save invented; the fixed calendar is merged in on read. */
    calendar: SemesterCalendar;
    /**
     * The whole semester's sky, one reading per slot — the NOW line walks back through it for how
     * long the weather has held. Absent means nothing is said about it.
     */
    weather?: readonly Weather[];
    /**
     * Where the girl being texted is standing right now: a location id, `'room'`, or null
     * for a slot her hidden schedule says nothing about.
     */
    charLocation?: string | null;
    /**
     * Who is with her there — read only where {@link charLocation} is set,
     * and named only where the reader has heard the name.
     */
    charCompanions?: NpcCompanions;
    /** Her standing haunt when {@link charLocation} is it — what she is doing there. */
    charHaunt?: Haunt | null;
    /**
     * Who leaves campus for spring break, or null before the pick has run. A thread stays
     * open through an absence, so this is what says she is texting from somewhere else.
     */
    springBreakAway?: readonly string[] | null;
    /** The graduate back in town for Homecoming, as a charId; absent on every other slot. */
    homecomingVisitor?: string;
    /**
     * Each character's plans with the reader from this slot on, one sentence apiece, by charId —
     * hers and the lorebook's people's.
     */
    upcomingPlans?: Record<string, string[]>;
    /** How many of her memories the thread carries: the one-character budget, the thread being the two of them. */
    memoryBudget: number;
    /** How many of her told secrets the thread carries; absent is the default. */
    secretBudget?: number;
    /** The playthrough log, read for the lorebook's dated recaps. */
    history: GameHistory;
}

/**
 * The structured reply to one texting turn. `messages` streams first, so the texts
 * land in the conversation as they are written; whether any was a hangout is the hangout
 * classifier's question.
 */
declare interface TextingResponse {
    /** The character's reply — one long text or several short ones. */
    messages: string[];
    /** Prior summary + the recent messages, rolled into one recap. */
    summary?: string;
    /** She wants the reader gone, and blocks him as this reply lands. */
    blocked?: boolean;
}

/** One run of a status line drawn in a colour of its own. */
declare interface TextMark {
    /** Half-open character range into the line's own `text`. */
    start: number;
    end: number;
    tone: StatKey | 'gain' | 'loss';
}

/** How hard the model reasons before answering, cheapest first. */
declare const THINKING_LEVELS: readonly ['minimal', 'low', 'medium', 'high'];

declare type ThinkingLevel = (typeof THINKING_LEVELS)[number];

/** Two time slots per game day: 0 = day, 1 = night. */
declare type TimeSlot = 0 | 1;

/**
 * A modal's title on its `.vu-tab`: arrives small on the corner it lives on, growing as the panel
 * rises under it, and never travels — crossing the stage would pull the eye off the panel it
 * names. The one thing it measures is itself, tweening its own width across a text swap.
 */
export declare function TitleTab({ children }: TitleTabProps): JSX.Element;

export declare interface TitleTabProps {
    /** What the tab says. Changing it swaps the text in place rather than arriving again. */
    children: string;
}

/** The reader's like on her post, put on or taken off as his heart on it does; nothing for a post that is not there. */
export declare function toggleFeedLike(charId: string, postId: string): void;

/**
 * A control whose fill is a state — a tool in force, a zoom held. Hover lifts by scale alone:
 * motion restores a tinted fill to its *first*-hover value, not to what a state class set since.
 */
export declare const toggleLift: TargetAndTransition;

/** The reader's academic record from the semesters before this one, summed. */
declare interface Transcript {
    /** One grade point per course he finished, oldest semester first. */
    gradePoints: number[];
    /** Exams he aced, handed back. */
    aced: number;
    /** Class meetings he attended, of {@link held}. */
    attended: number;
    held: number;
}

/**
 * The well the player answers in, and the Go beside it. **The same control on both screens** —
 * what changes is where the row it sits in is anchored, which is the screen's own class.
 */
export declare function TurnField(props: TurnFieldProps): JSX.Element;

export declare interface TurnFieldProps {
    action: string;
    onAction: (value: string) => void;
    onSubmit: () => void;
    /** The player's turn is out: Go reports the wait in the chevron's place. */
    sending: boolean;
    /** A CG is behind the row: the well steps back with the box above it. */
    cg?: boolean;
    submitDead: boolean;
    inputDead: boolean;
    /**
     * The well takes the focus while this is true and the input is live — **the row's own `inert`
     * condition**, since a field under `inert` cannot take it and would leave the caret nowhere.
     */
    focus: boolean;
    placeholder: string;
    /**
     * Whether the well takes more than one line. **The scene's does and the landing's does not** —
     * an action is a composed sentence, the landing's is a quick pick beside answers already
     * written. Shape only; `maxLength` is the same on both.
     */
    multiline?: boolean;
    /**
     * What a screen's own arrival gives the well and the answer beside it, where it gives them
     * anything. **Two layers rather than one**, because a clip that's safe over the well would cut
     * Go's paper shadow off. The scene hands in neither — its row arrives whole, on one fade.
     */
    wellMotion?: MotionProps;
    goMotion?: MotionProps;
    /**
     * The well and Go are on show. False puts both away and out of the pointer's reach, for
     * whatever the screen stands in the well's place; absent is true.
     */
    revealed?: boolean;
    /** What the screen stands in the well's place, drawn inside the well's own box. */
    overlay?: ReactNode;
    /**
     * The pointer moved over the well's box or Go's seat, or left both. A move rather than an
     * entry, so a well put away under a resting pointer comes back only when the mouse moves.
     */
    onHover?: (over: boolean) => void;
    /** The well took the caret, or gave it up. */
    onFocus?: () => void;
    onBlur?: () => void;
}

/**
 * Everything the slot loop holds between calls, in one object, so {@link resetLoopState} is
 * exhaustive by construction.
 */
/**
 * Everything a failed turn is rewound to, taken before the turn runs; also the
 * base the reply's autosave is composed onto.
 */
declare interface TurnSnapshot {
    /** Private post-Reckoning scene continuation; never a spoken reader action. */
    reckoning?: string;
    /** The paid intent, retained for a retry after its failed attempt refunded it. */
    breakthrough?: BreakthroughPending;
    scene: SceneState | null;
    action: string;
    /** The agreed hangout this turn is, so a retry replays it as one. */
    charId?: string;
    /** In-memory native invitation retry; never serialized into a save. */
    retryInvitation?: (action: string) => void;
    /** This turn handed over a gift; abandoning it hands the item back. */
    gift?: boolean;
    /** This turn is the authored orientation scene, so a retry re-enters it. */
    intro?: boolean;
    /** The epilogue goodbye this turn is, and who it is with. */
    farewell?: string;
    /** The training activity the landing button committed this turn to. */
    activity?: SlotActivityOffer;
    /** The settled verdict this turn runs on, so a retry re-classifies nothing. */
    preset?: Verdict;
    /** The plan whose landing button this turn is, so a retry casts its attendees again. */
    planId?: string;
    /** The attendee whose reminder this plan's button answered, so a retry skips her thread too. */
    answeredReminder?: string;
    /** This turn is a Scene Creator scene's opening, so a retry sends it again. */
    created?: boolean;
    /** The curveball and present this turn's scene rolled, so a retry opens on the same. */
    sceneEvents?: {
        event: SceneEvent | null;
        gift: ReceivedGift | null;
    };
}

/**
 * The `···` bubble, which means a reply is queued and never that a call is running: three dots
 * on one clock, each a beat behind the one above. A table rather than a factory, so their
 * identity survives re-renders; an opacity, so the dots keep moving under reduced motion.
 */
export declare const typingDot: readonly TargetAndTransition[];

/**
 * A page of a mod's own beside the feed in the Updates tab, behind a title of its own beside the
 * feed's. `unread` is what its title and the Updates tile on the rail count; `Action` is drawn at
 * the end of the titles' row while the page is showing.
 */
export declare interface UpdatesTab {
    id: string;
    word: string;
    Page: ComponentType;
    Action?: ComponentType;
    unread?: (game: ReturnType<typeof useGameStore.getState>) => number;
}

/** A disposition tier whose upper half reads differently from its lower one. */
declare type UpperHalf = 'neutral' | 'friendly' | 'trusted';

/** Whether a phone message is drawn with no bubble behind it, as the mod drawing it says. */
export declare function useBareMessage(text: string): boolean;

/** Her definition in a component. @since 0.8.0 */
export declare const useCharacter: (id: string) => Readonly<Character> | undefined;

/** Her game state in a component. @since 0.8.0 */
export declare const useCharacterInfo: (id: string) => Readonly<CharInfo> | undefined;

/** The clock in a component. @since 0.8.0 */
export declare const useClock: () => Readonly<{
    date: number;
    time: TimeSlot;
    season: Season;
}> | undefined;

/** One thread in a component. @since 0.8.0 */
export declare const useConversation: (id: string) => Readonly<Conversation> | undefined;

/**
 * A layer inside a modal — a menu, a box being typed in — that takes Escape and a right-click
 * ahead of the shell under it, since a later listener on the same target and phase cannot
 * otherwise win against the shell's capture listener. A right-click's press moves no focus while
 * the layer stands, so a box it guards is not blurred away before the right-click reaches it.
 */
export declare function useDismissLayer(onDismiss: () => void, active: boolean): void;

/**
 * The places in a box being typed in and in what was sent that a mod may draw: an emoji tool,
 * and the sent text itself. Each reads the switches, so a mod turned on or off redraws them.
 */
/** Whether a mod draws an emoji tool, so a caller can stand its own in place of none. */
export declare function useEmojiTool(): boolean;

/** Her feed in a component. @since 0.8.0 */
export declare const useFeed: (id: string) => readonly Readonly<SocialPost>[];

/** The legacy marker in a component. @since 0.8.0 */
export declare const useFeedReadThrough: () => number | undefined;

/** {@link gameFacts} for a component: it renders again when either changes. */
export declare function useGameFacts(): {
    playthroughId: string | null;
    readerName: string;
};

declare const useGameStore: UseBoundStore<StoreApi<GameStoreState>>;

export declare function useImageApiConfigured(): boolean;

/** {@link lessNsfwText} for a component, which renders again when the player changes it. */
export declare function useLessNsfwText(): boolean;

export declare function useLocalImageSource(): 'managed' | 'external' | null;

/**
 * The portal host, the outside-click rule, Escape and a right-click, and the sounds a panel
 * arrives and leaves on; styling stays in `vu_styles`. `sound` is the pair it plays — `'phone'`
 * for the Bunnyboard, and `'none'` for a screen whose own sting is the sound of its arrival.
 * `primary` is what Enter and Space answer with, for a modal that takes them.
 */
export declare function useModalShell(onClose: () => void, sound?: 'panel' | 'phone' | 'none', primary?: () => void): ModalShell;

/** Whether a mod is on, for a component: it renders again when the switch moves. */
export declare function useModOn(id: string, record?: Pick<PlaythroughRecord, 'mods'> | null): boolean;

/** Where one of a mod's options stands, for a component. */
export declare function useModOption(modId: string, optionId: string): boolean;

/** The image rule for a component, following changes to the player's settings. */
export declare function useNoNsfwImages(): boolean;

/** The NPC pair records in a component. @since 0.8.0 */
export declare const useNpcRelationships: () => Readonly<NpcRelationshipMap> | undefined;

/** The player's profile picture in a component. @since 0.8.0 */
export declare const usePlayerProfilePicture: () => string | null;

/** The player's current stats in a component. @since 0.8.0 */
export declare const usePlayerStats: () => Readonly<PlayerStats> | undefined;

/** Her profile image in a component. @since 0.8.0 */
export declare const useProfileImageUrl: (id: string) => string | undefined;

/** The native READER block in a component. @since 0.8.0 */
export declare const useReaderPromptText: () => string | undefined;

/** The requested roster in a component. @since 0.8.0 */
export declare function useRosterIds(options?: {
    alumni?: boolean;
}): readonly string[];

/** {@link safePoint}, for a component: it renders again when the answer moves. */
export declare function useSafePoint(): ManualSaveOffer;

/**
 * What `select` picks from the scene, in a component: it renders again when that changes,
 * compared with `Object.is`. `select` runs once per change of the view. @since 0.8.0
 */
export declare function useScene<T>(select: (view: SceneView | null) => T): T;

/** Whether a scene owns the screen, for a component. @since 0.8.0 */
export declare const useSceneActive: () => boolean;

/**
 * Takes the scene's input for the component that calls it, for as long as `layout` is not null:
 * the scene's action row is put away and dead, and the dialogue box stands clear of the caller's
 * own input instead. Null, or unmounting, gives the input back. One holder at a time: a claim
 * while another component holds it is refused, with a warning.
 */
export declare function useSceneInput(layout: SceneInputLayout | null): void;

/** The cast-scene persona the player has stored, or undefined until settings are read or when none is stored. */
export declare function useScenePersona(): string | undefined;

/** Reactive optional-suggestion pause; activity and mod/game changes update it. @since 0.8.0 */
export declare function useSceneSuggestionsPaused(): boolean;

/** The gain a mod's own sound effects play at: the player's effects volume, as the game's mix applies it. */
export declare function useSfxGain(): number;

/** The cache-busting version of a character's sprites, 0 until one is rendered or for nobody. */
export declare function useSpriteVersion(charId: string | null | undefined): number;

/** The selected DM thread for a component, following the phone's navigation. */
export declare function useViewingThread(): string | null;

/**
 * A modal arrives as two layers: the veil fades the
 * screen down, and the panel fades in over it and rises the last 12px. Neither carries a delay —
 * a modal is the answer to something the player just clicked.
 */
export declare const veilIn: Variants;

declare interface VenusWhisper {
    version: 1;
    author?: WhisperAuthor;
    /** Ordinary known readers can remain in the discussion as alumni, just like the columnist. */
    people: WhisperPerson[];
    issues: WhisperIssue[];
    /** Deleting an issue cannot cause a second issue on that day. */
    dismissed: string[];
    observations?: WhisperObservation[];
    /** A private confession to the reader, not a public byline. */
    discovery?: {
        author: string;
        term: number;
        day: number;
        time: TimeSlot;
    };
}

/** The classifier's answer — who the action names and what kind of action it is. */
declare interface Verdict {
    /** Who the action names *and* puts in the scene — the casting list. */
    mentioned: string[];
    /**
     * Who it names without bringing along. They cast nobody: the loop files them
     * as the scene's mentions, and the lorebook describes each as absent.
     */
    mentionedOnly: string[];
    actionType: string;
    inPublic: boolean;
    /** Where the action set the scene, in the model's words; matched locally. */
    sceneLocation: string;
}

/** The charId of the phone's selected DM thread, or null on its list. */
export declare function viewingThread(): string | null;

/** Top-level screens the app can be showing. */
export declare type ViewName = 'boot' | 'setup'
/** The key stage alone, from the menu's top slot when no key is set. */
| 'apiKey'
/** The first run: every stage not already settled, then the content question. */
| 'firstRun' | 'mainMenu' | 'manageCharacters'
/** One scene set up by hand and played outside any playthrough. */
| 'sceneCreator' | 'newGame'
/** The canned start, rendered by `NewGameView` for `classSelect`'s reason. */
| 'quickstart'
/** The class selector, rendered by `NewGameView` so the roster survives it. */
| 'classSelect'
/** A playthrough's next semester's roster, rendered by `NewGameView` off the ending's Continue. */
| 'nextSemester' | 'game';

/**
 * A way on that a mod offers in place of the game's own, on a screen that otherwise has one.
 * `prepare` runs first, while nothing has been torn down: it does whatever may fail (reading a
 * save, say), reports its own failure and returns null, and the player stays where he was. On
 * success it returns `enter`, which the game calls once the running game, if any, is gone, and
 * which stages what the mod needs and names the screen to show.
 */
export declare interface WayOn {
    prepare: () => Promise<(() => ViewName) | null>;
}

declare type Weather = (typeof WEATHER_KINDS)[number];

/** What a slot's sky can be; appended, never reordered. */
declare const WEATHER_KINDS: readonly ['clear', 'rain', 'storm'];

declare interface WhisperAuthor extends WhisperPerson {
    known: boolean;
    interests?: string[];
}

declare interface WhisperComment {
    id: string;
    person: Omit<WhisperPerson, 'voice'>;
    player: boolean;
    text: string;
    replyTo?: string;
    mentions: string[];
}

declare interface WhisperIssue {
    id: string;
    term: number;
    day: number;
    title: string;
    body: string;
    subjects: string[];
    comments: WhisperComment[];
    /** Reader comments which have already received their generated batch. */
    answered: string[];
    /** Weekly editions stay open until the next Wednesday; older daily issues keep their dates. */
    weekly?: true;
    /** Absent on older issues, which are treated as already read. */
    read?: boolean;
}

/** Saved when a slot settles, never reconstructed from today's timetable. */
declare interface WhisperObservation {
    id: string;
    author: string;
    term: number;
    day: number;
    time: TimeSlot;
    subjects: string[];
    where: string;
    positive: boolean;
    perspective: 'classmate' | 'on shift' | 'nearby' | 'participant';
}

/** A public profile snapshot survives a change of roster without carrying private history. */
declare interface WhisperPerson {
    id: string;
    name: string;
    handle: string;
    voice: string;
}

/** {@link writeModFields} for the mod's own data alone; `expect` is the value it edited from. */
export declare function writeModField<T>(modId: string, next: T, options?: {
    expect?: T;
}): Promise<Result<null>>;

/**
 * Writes `next` as the mod's own save data, and as the data of mods its `requires` lists, in one
 * save: at a point a save can be taken at, behind every save already on its way, and into the
 * live game only once it is on disk. `expect` is, per id, the value the edit was made from; the
 * write is refused once that is no longer the live value. A refusal writes nothing and changes
 * nothing, and comes back as the result's error, never as a throw: `MOD_WRITE_WAIT` (not a safe
 * point), `MOD_WRITE_STALE`, `MOD_WRITE_OFF`, `MOD_WRITE_FOREIGN`, `MOD_WRITE_NO_GAME`, or the
 * disk's own error.
 */
export declare function writeModFields(modId: string, next: Readonly<Record<string, unknown>>, options?: {
    expect?: Readonly<Record<string, unknown>>;
}): Promise<Result<null>>;

export { }
