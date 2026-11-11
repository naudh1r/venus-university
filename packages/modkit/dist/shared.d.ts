/** What an intimate act was. */
declare type ActKind = 'kiss' | 'sex';

/** One class added at add/drop — the record that owes him an entrance. */
declare interface AddedClass {
    /** The room has met him once; it never meets him again. */
    announced: boolean;
    /** The `date` he added it, on {@link DroppedClass.date}'s terms. */
    date: number;
}

/**
 * A character's affection off her `CharInfo`, texting memory and the likes he left on her
 * recent posts included, off only the newest {@link AFFECTION_WINDOW} of her stored memories,
 * less whatever break penalty she still holds.
 */
export declare function affectionFor(info: Pick<CharInfo, 'memories' | 'textMemory' | 'feed' | 'jealousyMemories' | 'giftMemories' | 'breakPenalty'> | undefined, today: number, character: Pick<Character, 'traits'> | undefined): number;

/** Error shape carried inside a failed {@link Result}. Never thrown across the IPC bridge. */
export declare interface AppError {
    code: string;
    message: string;
    detail?: string;
}

/** The one way an {@link AppError} is constructed; every service throws through this. */
export declare function appError(code: string, message: string, detail?: string): AppError;

/** Are these two friends? The one test the hangout passes are built on. */
export declare function areNpcFriends(map: NpcRelationshipMap | undefined, a: string, b: string): boolean;

/** Rejects a charId that could escape the folder, key space or `charimg://` host it names. */
export declare function assertSafeCharId(charId: string): void;

/** Rejects an id that could escape the folder or key it names; every path-bound id passes one. */
export declare function assertSafeId(id: string, pattern: RegExp, code: string, message: string): void;

/** Rejects a playthroughId that could escape the folder or key space it names. */
export declare function assertSafePlaythroughId(playthroughId: string): void;

/**
 * What a backup may hold before a byte of it is unpacked: it carries a whole cast, so the caps
 * a single character export is opened under would refuse one.
 */
export declare const BACKUP_ZIP_LIMITS: {
    maxEntries: number;
    maxTotalBytes: number;
};

/** A {@link SlotOpening} an ending banked: the three settles it rolled are always on it. */
declare type BankedOpening = SlotOpening & Required<Pick<SlotOpening, 'rumorPass' | 'crushes' | 'npcRelationships'>>;

/** The slot's texting-ledger reply, paid for mid-scene and held until the ending merges it. */
declare interface BankedTextLedger {
    /** The fingerprint the prefetch was keyed on: the slot plus every message id it read. */
    key: string;
    reply: LedgerResponse;
}

/** The edited text for a block where a non-blank string is stored for it, else the fallback. */
export declare function blockText<Id extends TextBlockId>(edits: TextEdits<TextBlockId> | undefined, id: Id, fallback: string): string;

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

/** The Bunnyboard app's persisted state. */
export declare interface BunnyboardState {
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
 * Called by a semester extension once the new playthrough is written, before it is entered.
 * Each carrier is awaited in turn; one that fails costs only its own files and stops no other.
 */
export declare function carryModFiles(context: TermFilesContext): Promise<void>;

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

/** On-disk character definition — `/data/characters/{charId}/character.json`. */
export declare interface Character {
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

/** The LoRA a character is drawn through and its weight, or null where she has none. */
export declare function characterLoraOf(character: Pick<Character, 'lora'>): DrawnLora | null;

/** Saved strings are open: a character must survive a missing trait provider. */
export declare type CharacterTrait = NativeCharacterTrait | (string & {});

/** A trait's stored value and presentation. Gameplay effects use their own hooks. */
export declare interface CharacterTraitDefinition {
    /** Exact, permanent string stored in character.json; also its displayed label. */
    value: string;
    description: string;
    /** Available in the editor when installed; defaults to true, independent of its switch. */
    editor?: boolean;
    /** May be assigned by generation while the owning mod is on; defaults to false. */
    generated?: boolean;
    /** data-tone token; a mod supplies its matching CSS, not core. */
    tone?: string;
    /** Explanation under the selected trait in the editor, and the chip's title. */
    hint?: string;
}

/** Relationship milestones tracked per character — never affection, which is derived. */
export declare interface CharFlags {
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
export declare type CharInfo = CharState & CharProfile;

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

/**
 * Builds the lowercase prompt/Scene JSON key for a character; never a file path.
 * Collapses internal whitespace so multi-word names remain echoable by the LLM.
 */
export declare function charKeyOf(firstName: string, lastName: string): string;

/** A single remembered event, rendered as `"<Name> <type> that <desc>"`. */
export declare interface CharMemory {
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
export declare interface ChatMessage {
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

/** The range each class pool size is kept to, both ends included. */
export declare const CLASS_CATALOG_RANGES: {
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
export declare type ClassCatalogEdits = Partial<Record<ClassCatalogKey, number>>;

export declare type ClassCatalogKey = keyof typeof CLASS_CATALOG_RANGES;

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
 * A weekly class meeting slot: `weekday * 2 + time`, where weekday 0 = Monday.
 * 0 = M/Day through 9 = F/Night; see `shared/classes.ts`.
 */
declare type ClassSlot = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

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

/** One Bunnyboard conversation with a contact, keyed by her charId. */
export declare interface Conversation {
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

/**
 * The twelve texts every boss can send — `welcomeBack` in place of `intro` when he takes back
 * a job he once held, and `coldNotice` once a cold, as it first keeps him off work. He never
 * writes anything else.
 */
declare type CoreJobMessageKind = 'intro' | 'raise' | 'missed' | 'missed2' | 'fired' | 'quit' | 'shiftApproved' | 'shiftChange' | 'sick1' | 'sick2' | 'welcomeBack' | 'coldNotice';

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
export declare type CustomOutfitSlot = `custom${number}`;

/** The custom wardrobe slots among some keys, each once and in slot-number order. */
export declare function customOutfitSlotsIn(keys: Iterable<string>): CustomOutfitSlot[];

/** {@link dedupedMemories} over {@link memoriesFor} — the folded list every reader reads. */
export declare function dedupedMemoriesFor(info: Pick<CharInfo, 'memories' | 'textMemory' | 'jealousyMemories' | 'giftMemories'> | undefined): readonly CharMemory[];

/** The class call's shipped pool sizes. */
export declare const DEFAULT_CLASS_CATALOG: {
    readonly pe: 10;
    readonly filler: 5;
    readonly perMajor: 4;
};

/**
 * All stats at zero, `Unremarkable` — the loader's fallback, Quickstart's start, and where New
 * Game's selector opens.
 */
export declare const DEFAULT_PLAYER_STATS: PlayerStats;

export declare const DEPRECATED_HOOKS: readonly DeprecatedHook[];

/** A hook announced as going: still asked for one Venus Dev update cycle. */
export declare interface DeprecatedHook {
    readonly name: string;
    /** The hook that replaces it. */
    readonly replacedBy: string;
    /** The build's release it goes in (`BUILD.version`), not the game's. */
    readonly goesIn: string;
}

/** Available as window.modSurface only in a host-created auxiliary window. */
export declare interface DesktopSurfaceBridge {
    invoke<T>(method: string, ...args: unknown[]): Promise<T>;
    on<T extends unknown[]>(method: string, listener: (...values: T) => void): () => void;
}

/** How a character feels about the reader right now — an affection tier. */
declare type Disposition = 'devoted' | 'trusted' | 'friendly' | 'neutral' | 'annoyed' | 'hostile';

/** The disposition tier an affection score falls in. */
export declare function dispositionOf(affection: number): Disposition;

/** Every dorm id the profile call may assign, sorted for a stable schema enum. */
export declare const DORM_IDS: readonly ['elysium', 'lowrise_1', 'lowrise_2', 'lowrise_3', 'lowrise_4', 'lowrise_5'];

declare type DormId = (typeof DORM_IDS)[number];

/** What a dorm id is called everywhere it is printed. */
export declare function dormLabel(dorm: DormId): string;

/** A LoRA as a render draws it: the file as the server lists it, and the weight. */
declare interface DrawnLora {
    name: string;
    weight: number;
}

/** One dropped class — the record that makes the drop permanent. */
declare interface DroppedClass {
    /** The former classmates have been told once; they are never told again. */
    announced: boolean;
    /** The `date` he dropped it, which is what the notice waits on. */
    date: number;
}

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

/** The seven sprite expressions a character can be generated in. */
declare type Emotion = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'embarrassed' | 'aroused';

/** Every milestone unset — a character the reader has not met. */
export declare function emptyFlags(): CharFlags;

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

/** `livvietierra9` — her name flattened to letters plus a digit. */
export declare function fallbackHandleOf(firstName: string, lastName: string, rand?: () => number): string;

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

declare type FileCarrier = (context: TermFilesContext) => Promise<void>;

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

/** One employer the reader has left: the raises he had taken, and how it ended. */
declare interface FormerJob {
    raises: number;
    /** He quit, was let go, or the semester ended under him. */
    left: 'quit' | 'fired' | 'term';
}

/**
 * A character's display name, as prompts, saves and the UI all spell it; trimmed so a blank
 * half leaves no trailing space.
 */
export declare function fullNameOf(char: {
    firstName: string;
    lastName: string;
}): string;

/** Playthrough scene summaries, keyed by day and time slot. */
declare type GameHistory = Record<number, Partial<Record<TimeSlot, string>>>;

/**
 * The game's ends: what stops a playthrough, the prose that says so, and the modal that follows.
 * Each is an entry in {@link GAME_OVER_SCENES}. Two are conditions `gameOverReasonOf` tests; the
 * epilogue's own losing end is a button press the loop tests for itself.
 */
/** Every way a playthrough can stop: the good one, and the one the epilogue loses to, included. */
export declare type GameOverReason = 'debt' | 'expulsion' | 'gameComplete' | 'endingDebt';

/** A save's replays, keyed by day and half — the shape of its history. */
declare type GameReplays = Record<number, Partial<Record<TimeSlot, string>>>;

/** The on-disk save: core's fields, plus the optional ones mods declare on it from their own modules. */
export declare interface GameSave extends NativeGameSave {
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

/** Which optional image sets the New Character modal asked for. */
declare interface GenerateOptions {
    pe?: boolean;
    swim?: boolean;
    nude?: boolean;
    cgs?: boolean;
    room?: boolean;
}

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
export declare const GLOBAL_TEXT_IDS: readonly ['persona.solo', 'persona.texting', 'persona.narration', 'persona.designer', 'newgame.classes.system', 'newgame.classes.additions', 'newgame.classes.instructions', 'newgame.profiles.system', 'newgame.profiles.additions', 'newgame.profiles.instructions', 'newgame.profiles.housing', 'newgame.profiles.freeTime', 'newgame.profiles.handle', 'newgame.profiles.springBreak', 'newgame.profiles.next.newcomers', 'newgame.profiles.next.housing', 'newgame.profiles.next.graduates', 'newgame.occasions.system', 'newgame.occasions.additions', 'newgame.occasions.instructions', 'newgame.occasions.fillers', 'newgame.occasions.gala', 'newgame.occasions.dance', 'newgame.occasions.careerFair', 'newgame.occasions.concert', 'newgame.secrets.system', 'newgame.secrets.additions', 'newgame.secrets.instructions', 'newgame.secrets.tiers'];

/** A global slot id, `date * 2 + time` — the same packing `schedulePrompt.ts` uses. */
export declare function globalSlotOf(date: number, time: TimeSlot): number;

export declare type GlobalTextId = (typeof GLOBAL_TEXT_IDS)[number];

declare interface GrowthTag {
    id: string;
    name: string;
    description: string;
    reframes: string[];
}

/**
 * Cheap deterministic hashing. Presentation only: it seeds choices that must look arbitrary
 * but stay the same for the same id across sessions.
 */
/** djb2 over a string, as an unsigned 32-bit number. */
export declare function hashString(value: string): number;

/** Does this character carry the trait? The one place a trait is tested. */
export declare function hasTrait(character: Pick<Character, 'traits'> | undefined, trait: CharacterTrait): boolean;

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
export declare type HookKind = 'add' | 'merge' | 'pipeline' | 'first' | 'any' | 'event' | 'owner' | 'slot' | 'registry';

export declare type HookName = (typeof HOOKS)[number]['name'];

export declare interface HookRow {
    /** The name a manifest uses: a key of `ModHooks`, or `prompts.<spot>` and `requests.<spot>`. */
    readonly name: string;
    readonly side: HookSide;
    readonly kind: HookKind;
    /** The host functions that ask it, in `@vx/modkit/host/<side>`. */
    readonly dispatch: readonly string[];
    /** Asked of a mod whether or not it is on. */
    readonly askedWhenOff?: true;
    /** The kit version it arrived in. */
    readonly since: string;
}

export declare const HOOKS: readonly [{
    readonly name: 'promptState.scene';
    readonly side: 'renderer';
    readonly kind: 'merge';
    readonly dispatch: readonly ["promptStateParts"];
    readonly since: '0.6.0';
}, {
    readonly name: "prompts.scene";
    readonly side: 'renderer';
    readonly kind: 'add';
    readonly dispatch: readonly ['promptLines', 'promptFields', 'promptRequired'];
    readonly since: '0.1.0';
}, {
    readonly name: "prompts.dm";
    readonly side: 'renderer';
    readonly kind: 'add';
    readonly dispatch: readonly ['promptLines', 'promptFields', 'promptRequired'];
    readonly since: '0.1.0';
}, {
    readonly name: "prompts.slot-posts";
    readonly side: 'renderer';
    readonly kind: 'add';
    readonly dispatch: readonly ['promptLines', 'promptFields', 'promptRequired'];
    readonly since: '0.1.0';
}, {
    readonly name: "prompts.slot-poster";
    readonly side: 'renderer';
    readonly kind: 'add';
    readonly dispatch: readonly ['promptLines', 'promptFields', 'promptRequired'];
    readonly since: '0.1.0';
}, {
    readonly name: "prompts.slot-reach-outs";
    readonly side: 'renderer';
    readonly kind: 'add';
    readonly dispatch: readonly ['promptLines', 'promptFields', 'promptRequired'];
    readonly since: '0.1.0';
}, {
    readonly name: "prompts.text-ledger";
    readonly side: 'renderer';
    readonly kind: 'add';
    readonly dispatch: readonly ['promptLines', 'promptFields', 'promptRequired'];
    readonly since: '0.1.0';
}, {
    readonly name: "prompts.character";
    readonly side: 'renderer';
    readonly kind: 'add';
    readonly dispatch: readonly ['promptLines', 'promptFields', 'promptRequired'];
    readonly since: '0.1.0';
}, {
    readonly name: "requests.scene";
    readonly side: 'renderer';
    readonly kind: 'pipeline';
    readonly dispatch: readonly ['modRequest'];
    readonly since: '0.1.0';
}, {
    readonly name: "requests.dm";
    readonly side: 'renderer';
    readonly kind: 'pipeline';
    readonly dispatch: readonly ['modRequest'];
    readonly since: '0.1.0';
}, {
    readonly name: "requests.ledger";
    readonly side: 'renderer';
    readonly kind: 'pipeline';
    readonly dispatch: readonly ['modRequest'];
    readonly since: '0.1.0';
}, {
    readonly name: "requests.slot-intro";
    readonly side: 'renderer';
    readonly kind: 'pipeline';
    readonly dispatch: readonly ['modRequest'];
    readonly since: '0.1.0';
}, {
    readonly name: 'dmHistoryNote';
    readonly side: 'renderer';
    readonly kind: 'add';
    readonly dispatch: readonly ["dmHistoryNotes"];
    readonly since: '0.1.0';
}, {
    readonly name: 'promptText';
    readonly side: 'renderer';
    readonly kind: 'owner';
    readonly dispatch: readonly ["promptTextEdits", "classCatalogEdits"];
    readonly since: '0.7.0';
}, {
    readonly name: 'sceneCall';
    readonly side: 'renderer';
    readonly kind: 'merge';
    readonly dispatch: readonly ["sceneCallTags"];
    readonly since: '0.7.0';
}, {
    readonly name: 'characterFromDraft';
    readonly side: 'renderer';
    readonly kind: 'merge';
    readonly dispatch: readonly ["characterFromDraft"];
    readonly since: '0.1.0';
}, {
    readonly name: 'dmReplyLead';
    readonly side: 'renderer';
    readonly kind: 'event';
    readonly dispatch: readonly ["dmReplyLead"];
    readonly since: '0.8.0';
}, {
    readonly name: 'afterDmReply';
    readonly side: 'renderer';
    readonly kind: 'event';
    readonly dispatch: readonly ["afterDmReply"];
    readonly since: '0.1.0';
}, {
    readonly name: 'afterSceneReply';
    readonly side: 'renderer';
    readonly kind: 'event';
    readonly dispatch: readonly ["afterSceneReply"];
    readonly since: '0.1.0';
}, {
    readonly name: 'sceneReplyLanded';
    readonly side: 'renderer';
    readonly kind: 'event';
    readonly dispatch: readonly ["sceneReplyLanded"];
    readonly since: '0.7.0';
}, {
    readonly name: 'hangoutVerdict';
    readonly side: 'renderer';
    readonly kind: 'pipeline';
    readonly dispatch: readonly ["hangoutVerdict"];
    readonly since: '0.8.0';
}, {
    readonly name: 'sceneCut';
    readonly side: 'renderer';
    readonly kind: 'event';
    readonly dispatch: readonly ["sceneCut"];
    readonly since: '0.7.0';
}, {
    readonly name: 'switchedOn';
    readonly side: 'renderer';
    readonly kind: 'event';
    readonly dispatch: readonly ["startSwitchedOn"];
    readonly since: '0.7.0';
}, {
    readonly name: 'afterReachOut';
    readonly side: 'renderer';
    readonly kind: 'event';
    readonly dispatch: readonly ["afterReachOut"];
    readonly since: '0.1.0';
}, {
    readonly name: 'playerActs';
    readonly side: 'renderer';
    readonly kind: 'event';
    readonly dispatch: readonly ["playerActs"];
    readonly since: '0.1.0';
}, {
    readonly name: 'gameEntered';
    readonly side: 'renderer';
    readonly kind: 'event';
    readonly dispatch: readonly ["gameEntered"];
    readonly since: '0.1.0';
}, {
    readonly name: 'keepSceneLedgerEntry';
    readonly side: 'renderer';
    readonly kind: 'any';
    readonly dispatch: readonly ["filterSceneLedger"];
    readonly since: '0.8.0';
}, {
    readonly name: 'slotSettled';
    readonly side: 'renderer';
    readonly kind: 'event';
    readonly dispatch: readonly ["slotSettled"];
    readonly since: '0.1.0';
}, {
    readonly name: 'slotStatusLines';
    readonly side: 'renderer';
    readonly kind: 'add';
    readonly dispatch: readonly ["slotStatusLines"];
    readonly since: '0.1.0';
}, {
    readonly name: 'projectSlotMemories';
    readonly side: 'renderer';
    readonly kind: 'pipeline';
    readonly dispatch: readonly ["projectSlotMemories"];
    readonly since: '0.1.0';
}, {
    readonly name: 'exercisedStats';
    readonly side: 'renderer';
    readonly kind: 'pipeline';
    readonly dispatch: readonly ["exercisedStats"];
    readonly since: '0.1.0';
}, {
    readonly name: 'settleSceneStats';
    readonly side: 'renderer';
    readonly kind: 'pipeline';
    readonly dispatch: readonly ["settleSceneStats"];
    readonly since: '0.1.0';
}, {
    readonly name: 'statFloor';
    readonly side: 'renderer';
    readonly kind: 'first';
    readonly dispatch: readonly ["statFloor"];
    readonly since: '0.1.0';
}, {
    readonly name: 'statActivities';
    readonly side: 'renderer';
    readonly kind: 'add';
    readonly dispatch: readonly ["statActivities"];
    readonly since: '0.1.0';
}, {
    readonly name: 'slotActivityAvailable';
    readonly side: 'renderer';
    readonly kind: 'any';
    readonly dispatch: readonly ["slotActivityAvailable", "statActivities"];
    readonly since: '0.1.0';
}, {
    readonly name: 'saveNote';
    readonly side: 'renderer';
    readonly kind: 'add';
    readonly dispatch: readonly ["saveNotes"];
    readonly since: '0.1.0';
}, {
    readonly name: 'fileFeedPost';
    readonly side: 'renderer';
    readonly kind: 'pipeline';
    readonly dispatch: readonly ["fileFeedPost"];
    readonly since: '0.1.0';
}, {
    readonly name: 'postLikes';
    readonly side: 'renderer';
    readonly kind: 'first';
    readonly dispatch: readonly ["postLikes"];
    readonly since: '0.1.0';
}, {
    readonly name: 'postVisible';
    readonly side: 'renderer';
    readonly kind: 'any';
    readonly dispatch: readonly ["postVisible"];
    readonly since: '0.1.0';
}, {
    readonly name: 'postOutAt';
    readonly side: 'renderer';
    readonly kind: 'first';
    readonly dispatch: readonly ["postOutAt"];
    readonly since: '0.1.0';
}, {
    readonly name: 'postComments';
    readonly side: 'renderer';
    readonly kind: 'owner';
    readonly dispatch: readonly ["postCommentsOwner", "ownedComments"];
    readonly askedWhenOff: true;
    readonly since: '0.1.0';
}, {
    readonly name: 'postPicture';
    readonly side: 'renderer';
    readonly kind: 'owner';
    readonly dispatch: readonly ["postPicture"];
    readonly since: '0.1.0';
}, {
    readonly name: 'emojiTool';
    readonly side: 'renderer';
    readonly kind: 'owner';
    readonly dispatch: readonly ["emojiTool"];
    readonly since: '0.1.0';
}, {
    readonly name: 'sentText';
    readonly side: 'renderer';
    readonly kind: 'owner';
    readonly dispatch: readonly ["sentText"];
    readonly since: '0.1.0';
}, {
    readonly name: 'endingChoice';
    readonly side: 'renderer';
    readonly kind: 'first';
    readonly dispatch: readonly ["endingChoice", "prepareWayOn"];
    readonly since: '0.1.0';
}, {
    readonly name: 'saveChoice';
    readonly side: 'renderer';
    readonly kind: 'first';
    readonly dispatch: readonly ["saveChoice", "prepareWayOn"];
    readonly since: '0.1.0';
}, {
    readonly name: 'modDetail';
    readonly side: 'renderer';
    readonly kind: 'first';
    readonly dispatch: readonly ["modDetail"];
    readonly since: '0.1.0';
}, {
    readonly name: 'optionPreviews';
    readonly side: 'renderer';
    readonly kind: 'add';
    readonly dispatch: readonly ["optionPreview"];
    readonly askedWhenOff: true;
    readonly since: '0.1.0';
}, {
    readonly name: 'bunnyboardPage';
    readonly side: 'renderer';
    readonly kind: 'add';
    readonly dispatch: readonly ["bunnyboardPages"];
    readonly since: '0.1.0';
}, {
    readonly name: 'updatesTab';
    readonly side: 'renderer';
    readonly kind: 'add';
    readonly dispatch: readonly ["updatesTabs"];
    readonly since: '0.1.0';
}, {
    readonly name: 'scenePlay';
    readonly side: 'renderer';
    readonly kind: 'add';
    readonly dispatch: readonly ["scenePlays"];
    readonly since: '0.1.0';
}, {
    readonly name: 'gameModals';
    readonly side: 'renderer';
    readonly kind: 'add';
    readonly dispatch: readonly ["gameModal", "setPanelOpener"];
    readonly since: '0.2.0';
}, {
    readonly name: 'contactTab';
    readonly side: 'renderer';
    readonly kind: 'add';
    readonly dispatch: readonly ["contactTabs"];
    readonly since: '0.1.0';
}, {
    readonly name: 'editorField';
    readonly side: 'renderer';
    readonly kind: 'add';
    readonly dispatch: readonly ["editorFields"];
    readonly since: '0.1.0';
}, {
    readonly name: "settingsSection";
    readonly side: 'renderer';
    readonly kind: 'slot';
    readonly dispatch: readonly ['screenSlot'];
    readonly since: '0.1.0';
}, {
    readonly name: "portraitOverlay";
    readonly side: 'renderer';
    readonly kind: 'slot';
    readonly dispatch: readonly ['screenSlot'];
    readonly since: '0.1.0';
}, {
    readonly name: "phoneOverlay";
    readonly side: 'renderer';
    readonly kind: 'slot';
    readonly dispatch: readonly ['screenSlot'];
    readonly since: '0.1.0';
}, {
    readonly name: 'chatsHeader';
    readonly side: 'renderer';
    readonly kind: 'slot';
    readonly dispatch: readonly ["screenSlot"];
    readonly since: '0.8.0';
}, {
    readonly name: 'conversationFoot';
    readonly side: 'renderer';
    readonly kind: 'slot';
    readonly dispatch: readonly ["screenSlot"];
    readonly since: '0.3.0';
}, {
    readonly name: "mapOverlay";
    readonly side: 'renderer';
    readonly kind: 'slot';
    readonly dispatch: readonly ['screenSlot'];
    readonly since: '0.1.0';
}, {
    readonly name: "photosPageSection";
    readonly side: 'renderer';
    readonly kind: 'slot';
    readonly dispatch: readonly ['screenSlot'];
    readonly since: '0.1.0';
}, {
    readonly name: "editCharacterImages";
    readonly side: 'renderer';
    readonly kind: 'slot';
    readonly dispatch: readonly ['screenSlot'];
    readonly since: '0.1.0';
}, {
    readonly name: "stageLayer";
    readonly side: 'renderer';
    readonly kind: 'slot';
    readonly dispatch: readonly ['screenSlot'];
    readonly since: '0.1.0';
}, {
    readonly name: "panelLayer";
    readonly side: 'renderer';
    readonly kind: 'slot';
    readonly dispatch: readonly ['screenSlot'];
    readonly since: '0.1.0';
}, {
    readonly name: "messageAttachment";
    readonly side: 'renderer';
    readonly kind: 'slot';
    readonly dispatch: readonly ['screenSlot'];
    readonly since: '0.1.0';
}, {
    readonly name: "contactPostExtra";
    readonly side: 'renderer';
    readonly kind: 'slot';
    readonly dispatch: readonly ['screenSlot'];
    readonly since: '0.1.0';
}, {
    readonly name: "railButton";
    readonly side: 'renderer';
    readonly kind: 'slot';
    readonly dispatch: readonly ['screenSlot'];
    readonly since: '0.2.0';
}, {
    readonly name: "landingTool";
    readonly side: 'renderer';
    readonly kind: 'slot';
    readonly dispatch: readonly ['screenSlot'];
    readonly since: '0.2.0';
}, {
    readonly name: "gameMenuEntry";
    readonly side: 'renderer';
    readonly kind: 'slot';
    readonly dispatch: readonly ['screenSlot'];
    readonly since: '0.2.0';
}, {
    readonly name: "advancedSettingsEntry";
    readonly side: 'renderer';
    readonly kind: 'slot';
    readonly dispatch: readonly ['screenSlot'];
    readonly since: '0.7.0';
}, {
    readonly name: 'invoke';
    readonly side: 'main';
    readonly kind: 'registry';
    readonly dispatch: readonly ["collectInvokes"];
    readonly since: '0.6.0';
    readonly askedWhenOff: true;
}, {
    readonly name: 'protocols';
    readonly side: 'main';
    readonly kind: 'registry';
    readonly dispatch: readonly ["collectRoutes"];
    readonly since: '0.3.0';
}];

/**
 * The dispatcher table: every hook core asks, as data with no imports, so the main process can
 * read it at boot without loading the renderer. A hook cannot exist without a row here: the
 * renderer's `hookTie.ts` fails the typecheck when `ModHooks` and this list disagree, and the
 * contract test checks that each row's dispatchers are asked somewhere in core. A mod's manifest
 * names the rows and the kit APIs it uses, and the compatibility check (`compat.ts`) reads them
 * against this table at install and at start.
 */
/** Which process asks the hook. */
export declare type HookSide = 'shared' | 'renderer' | 'main';

/** A mod's part in her sprite and CG drafts, registered with {@link registerImagePromptDraft}. */
export declare interface ImagePromptDraft {
    /** The draft's appearance and negatives with the mod's tags in them; asked only while it is on. */
    draft: (parts: ImagePromptParts, ctx: {
        character: Character;
        kind: ImagePromptKind;
    }) => ImagePromptParts;
    /**
     * What a regenerate reopens on, from what its button last sent (`kept`) and the draft it would
     * open with otherwise, so a remembered edit carries the mod's tags as they are now. Asked
     * whether or not the mod is on (`on`), so one that is off can take its own tags back out.
     */
    regen?: (kept: PromptEdit, draft: PromptEdit, on: boolean) => PromptEdit;
}

/**
 * What mods add to a sprite's or a CG's prompt draft, in either process: the editor's regenerate
 * draft in the renderer and every render in main are built by the same `imagePrompt` functions,
 * so a mod registers its shared draft after the catalog loads in each process.
 */
/** Which picture a draft is for: a dressed sprite, a nude one, or her CGs. */
export declare type ImagePromptKind = 'sprite' | 'nude' | 'cg';

/** The two groups a mod may change. Her own negatives are added after every mod's. */
export declare interface ImagePromptParts {
    /** Her appearance tags, from her own `baseAppearance` and each mod before this one. */
    appearance: string[];
    /** The draft's negative tags, the game's own and each mod's before this one. */
    negative: string[];
}

/** The type an image's first bytes say it is, or `null` for anything it cannot name. */
export declare function imageTypeOf(bytes: Uint8Array): 'image/png' | 'image/jpeg' | 'image/webp' | null;

/** What an invitation out of nowhere may be rolled into asking; appended, never reordered. */
declare const INVITE_KINDS: readonly ['herRoom', 'study', 'hisRoom', 'outing', 'everyday'];

/** One of {@link INVITE_KINDS}. */
declare type InviteKind = (typeof INVITE_KINDS)[number];

/** One opening on the jobs board. */
export declare interface JobDef {
    /** Stable id; what `JobState.jobId`, `jobsClosed` and the boss thread key off. */
    id: string;
    title: string;
    /** A place that exists in `renderer/prompts/lorebook.ts`, spelled as that file spells it. */
    employer: string;
    /**
     * The workplace's lorebook key, copied from `renderer/prompts/lorebook.ts`: one more spelling
     * a place the classifier names is matched against.
     */
    workplaceKey: string;
    /**
     * The same building as a location id (`shared/locations.ts`): what puts a shift on the
     * occupancy grid and names the place in the classifier's `LOCATION IDS` block.
     */
    locationId: string;
    boss: {
        name: string;
        title: string;
        emoji: string;
    };
    /** Dollars per shift, before raises. A shift is a whole timeslot, taken as four hours. */
    pay: number;
    /**
     * The shift slots this employer ever offers — its opening hours. Read through
     * `offeredShifts`, never directly; an all-week employer also rolls {@link rollJobClosures}.
     */
    hours: readonly ShiftSlot[];
    /** The minimum tier per stat. An absent key is no requirement. */
    requires: Partial<Record<StatKey, StatTier>>;
    /** Additional qualifications for player hiring, separate from access to the venue. */
    requiresSkills?: readonly JobSkillRequirement[];
    /**
     * What a shift can pay: one entry is rolled when the shift is cast, and every stat it names
     * moves a point.
     */
    gains: readonly ShiftGain[];
    /**
     * An employer that keeps the university's calendar: a day an occasion closes campus
     * cancels its shifts outright, and it owes a `holiday`, a `summer` and a `winter` text.
     */
    closesWithUniversity?: true;
    /** One clause naming what he actually does, appended to a job action. */
    duty: string;
    /** The card's one-line "now hiring" pitch. */
    blurb: string;
    /** The detail pane's job-ad prose. */
    description: string;
    /** Every text this boss can send. */
    messages: Record<CoreJobMessageKind, string> & {
        holiday?: string;
        summer?: string;
        winter?: string;
    };
}

/** An optional player qualification. NPC professions do not use player talent ranks. */
declare interface JobSkillRequirement {
    id: string;
    label: string;
    rank: number;
}

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

/**
 * Every runtime export of the three mod-facing entry points, as `<side>:<name>`, so a manifest's
 * one `hooks` list can name a kit API beside a hook without the two colliding. Types are not
 * listed: a type that goes breaks a build, not a running mod. The contract test holds this list to
 * the entry points' actual exports, both ways.
 */
export declare const KIT_APIS: readonly ['renderer:character', 'renderer:useCharacter', 'renderer:subscribeCharacter', 'renderer:characterInfo', 'renderer:useCharacterInfo', 'renderer:subscribeCharacterInfo', 'renderer:rosterIds', 'renderer:subscribeRosterIds', 'renderer:useRosterIds', 'renderer:conversation', 'renderer:useConversation', 'renderer:subscribeConversation', 'renderer:feed', 'renderer:useFeed', 'renderer:subscribeFeed', 'renderer:npcRelationships', 'renderer:useNpcRelationships', 'renderer:subscribeNpcRelationships', 'renderer:clock', 'renderer:useClock', 'renderer:subscribeClock', 'renderer:playerStats', 'renderer:usePlayerStats', 'renderer:subscribePlayerStats', 'renderer:playerProfilePicture', 'renderer:usePlayerProfilePicture', 'renderer:subscribePlayerProfilePicture', 'renderer:feedReadThrough', 'renderer:useFeedReadThrough', 'renderer:subscribeFeedReadThrough', 'renderer:sceneActive', 'renderer:useSceneActive', 'renderer:subscribeSceneActive', 'renderer:readerPromptText', 'renderer:useReaderPromptText', 'renderer:subscribeReaderPromptText', 'renderer:useProfileImageUrl', 'renderer:profileImageUrl', 'renderer:subscribeProfileImageUrl', 'renderer:scene', 'renderer:useScene', 'renderer:subscribeScene', 'renderer:holdTurn', 'renderer:setSceneSuggestionsPaused', 'renderer:sceneSuggestionsPaused', 'renderer:useSceneSuggestionsPaused', 'renderer:subscribeSceneSuggestionsPaused', 'shared:SAFE_CHAR_ID', 'shared:assertSafeCharId', 'shared:SAFE_NUMERIC_ID', 'shared:assertSafePlaythroughId', 'shared:appError', 'shared:imageTypeOf', 'shared:characterLoraOf', 'shared:DORM_IDS', 'shared:dormLabel', 'shared:LOCATIONS', 'shared:NARRATIVE_LOCATIONS', 'shared:customOutfitSlotsIn', 'shared:outfitTagsFor', 'shared:affectionFor', 'shared:dispositionOf', 'shared:dedupedMemoriesFor', 'shared:emptyFlags', 'shared:relationshipTagOf', 'shared:areNpcFriends', 'shared:npcFriendsOf', 'shared:npcPairOf', 'shared:zoneOf', 'shared:hashString', 'shared:seededRand', 'shared:fullNameOf', 'shared:slotFromId', 'shared:shownComments', 'shared:fallbackHandleOf', 'shared:rollPostLikes', 'renderer:invoke', 'shared:BACKUP_ZIP_LIMITS', 'shared:readerize', 'shared:DEFAULT_PLAYER_STATS', 'renderer:CloseIcon', 'renderer:HeartIcon', 'renderer:BunnyMark', 'renderer:EyeIcon', 'renderer:EyeOffIcon', 'renderer:formatNumericGameDate', 'renderer:formatShortGameDate', 'renderer:slotHalf', 'renderer:SETTING', 'renderer:hasTexted', 'renderer:isFeedContact', 'renderer:FEED_PAGE', 'renderer:newestFirst', 'renderer:FEED_EMOJI', 'renderer:FEED_EMOJI_BAG', 'renderer:FEED_HANDLE_BAG', 'renderer:FEED_HANDLE_POOL', 'main:extractZip', 'main:sniffImageFile', 'main:modOptionOn', 'main:modIsOn', 'main:completeModStructured', 'main:createDesktopSurface', 'main:hasExpressionArt', 'main:renderComfyImage', 'shared:carryModFiles', 'shared:charKeyOf', 'shared:DEPRECATED_HOOKS', 'shared:globalSlotOf', 'shared:hasTrait', 'shared:HOOKS', 'shared:KIT_APIS', 'shared:KIT_VERSION', 'shared:MAX_TIER', 'shared:memoryStatusLine', 'shared:messageOf', 'shared:modById', 'shared:modOn', 'shared:optionKey', 'shared:optionOn', 'shared:pointsForTier', 'shared:READER_SPEAKER', 'shared:registerCharacterTrait', 'shared:registerImagePromptDraft', 'shared:registerPostCarry', 'shared:registerRomanceRequirement', 'shared:registerTermCarry', 'shared:registerTermFiles', 'shared:REMOVED_HOOKS', 'shared:sharedModOn', 'shared:assertSafeId', 'shared:blockText', 'shared:CLASS_CATALOG_RANGES', 'shared:DEFAULT_CLASS_CATALOG', 'shared:GLOBAL_TEXT_IDS', 'shared:PROMPT_PARTS', 'shared:SCENE_TEXT_IDS', 'shared:validateRecord', 'renderer:addMemory', 'renderer:addPostComments', 'renderer:boxParts', 'renderer:buildLabel', 'renderer:bunnybotSays', 'renderer:bunnyHop', 'renderer:cancelCalls', 'renderer:Card', 'renderer:CheckField', 'renderer:ChevronIcon', 'renderer:ConfirmModal', 'renderer:defaultBlockText', 'renderer:gameFacts', 'renderer:isNewGameBlock', 'renderer:PlusIcon', 'renderer:PROMPT_BLOCKS', 'renderer:showError', 'renderer:TextEditModal', 'renderer:useGameFacts', 'renderer:useScenePersona', 'renderer:completeStructured', 'renderer:currentRun', 'renderer:dealt', 'renderer:dropTransientLines', 'renderer:EmojiTool', 'renderer:fadeIn', 'renderer:fileLatePost', 'renderer:finishSlotActivity', 'renderer:gestures', 'renderer:isGraduationSlot', 'renderer:isOrientationSlot', 'renderer:lessNsfwText', 'renderer:lift', 'renderer:Lightbox', 'renderer:memoryLines', 'renderer:profileLines', 'renderer:relationshipLines', 'renderer:spaced', 'renderer:Locked', 'renderer:modIsOn', 'renderer:noNsfwImages', 'renderer:subscribeNoNsfwImages', 'renderer:useNoNsfwImages', 'renderer:imageApiConfigured', 'renderer:spriteUrl', 'renderer:profileUrl', 'renderer:useSpriteVersion', 'renderer:subscribeImageApiConfigured', 'renderer:useImageApiConfigured', 'renderer:localImageSource', 'renderer:subscribeLocalImageSource', 'renderer:useLocalImageSource', 'renderer:canRenderLocalImages', 'renderer:subscribeCanRenderLocalImages', 'renderer:phoneOpen', 'renderer:viewingThread', 'renderer:subscribePhoneView', 'renderer:useViewingThread', 'renderer:drawFeedHandles', 'renderer:drawFeedEmoji', 'renderer:modOptionOn', 'renderer:modsOnLine', 'renderer:modState', 'renderer:noteIn', 'renderer:objectSchema', 'renderer:openPanel', 'renderer:ownsPostComments', 'renderer:panelUnderTab', 'renderer:PostCommentAction', 'renderer:PostCommentsView', 'renderer:PostPicture', 'renderer:postVisible', 'renderer:press', 'renderer:promptFields', 'renderer:promptLines', 'renderer:promptRequired', 'renderer:quietLift', 'renderer:quietPress', 'renderer:reachTurn', 'renderer:readerSaysInScene', 'renderer:recordField', 'renderer:registerHooks', 'renderer:retrySilently', 'renderer:rowLift', 'renderer:rowPress', 'renderer:runStale', 'renderer:safePoint', 'renderer:saveChanges', 'renderer:saveField', 'renderer:canInviteToScene', 'renderer:canRecordSceneTurn', 'renderer:freeForInvitation', 'renderer:hasDesktopSurfaces', 'renderer:openSceneExchange', 'renderer:sceneExchangeContext', 'renderer:startInvitedScene', 'renderer:subscribeInvitations', 'renderer:subscribeSceneTurns', 'renderer:sayInScene', 'renderer:sceneField', 'renderer:SceneDivider', 'renderer:SelectField', 'renderer:SentText', 'renderer:slideInQuick', 'renderer:submitAction', 'renderer:takeTurnFromReply', 'renderer:TextField', 'renderer:TitleTab', 'renderer:toggleFeedLike', 'renderer:toggleLift', 'renderer:TurnField', 'renderer:typingDot', 'renderer:useBareMessage', 'renderer:useDismissLayer', 'renderer:useEmojiTool', 'renderer:useLessNsfwText', 'renderer:useModalShell', 'renderer:useModOn', 'renderer:useModOption', 'renderer:useSafePoint', 'renderer:useSceneInput', 'renderer:useSfxGain', 'renderer:veilIn', 'renderer:writeModField', 'renderer:writeModFields', 'main:backupPart', 'main:characterTransferPart', 'main:modDataPath', 'main:registerComfyLaunchEnvironment', 'main:registerFinalRequest', 'main:readJsonFile', 'main:requiredBackupPart', 'main:writeAtomicBytes', 'main:writeAtomicJson'];

/**
 * The kit's version, as `package.json` beside it says (the contract test holds the two together).
 * Semantic and informational: compatibility is checked per hook, not against this number.
 */
export declare const KIT_VERSION = "0.8.0";

export declare type KitApiName = (typeof KIT_APIS)[number];

/**
 * The bookkeeping reply for a finished slot: what the characters remember,
 * which milestones were passed, what the hour did for the reader, and what he agreed to later.
 */
export declare interface LedgerResponse {
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
export declare type LedgerStats = Partial<Record<StatKey, boolean>>;

/** One place a character can be scheduled at, or found working at. */
export declare interface LocationDef {
    /** A `LoreEntry.id`, which is what ties the place to its paragraph. */
    id: string;
    /** What the place is called in the one sentence that says where she is. */
    label: string;
    /**
     * The single line both the profile call and the classifier read it by, and what the map's Go
     * says about the place on a hover.
     */
    blurb: string;
    /** The one glyph the map ever draws this place with. */
    icon: string;
    /** The place is on university grounds, which is the pane of the map it sits in. */
    onCampus?: true;
    /** Emptied on a day an occasion closes campus, like `JobDef.closesWithUniversity`. */
    closesWithUniversity?: true;
    /**
     * The place is open-air, so under rain nobody keeps a haunt there, goes on an outing to it,
     * runs into anybody there or invites the reader to it. Read through `isRainedOut`.
     */
    outdoors?: true;
    /**
     * The shift-week slots the place is open (`weekday * 2 + time`, Monday 0, nights odd); absent,
     * it is open every half of every day. Read through {@link isLocationOpen}.
     */
    hours?: readonly ShiftSlot[];
}

/** Every location a character can be placed at, in id order. */
export declare const LOCATIONS: readonly LocationDef[];

/** The ceiling of that selector, and of the scale itself. */
export declare const MAX_TIER: StatTier;

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

/**
 * {@link memorySentence} as the status box draws it: the verb she remembers him by in the
 * colour of which way it went.
 */
export declare function memoryStatusLine(name: string, entry: Pick<CharMemory, 'type' | 'desc'>): SceneLine;

/** Kind of memory recorded against a character at scene end. */
export declare type MemoryType = 'liked' | 'disliked' | 'loved' | 'hated';

/** The message off any thrown value — an `Error`'s own, else its string form. */
export declare function messageOf(err: unknown): string;

export declare function modById(id: string, mods?: readonly ModDef[]): ModDef | undefined;

/** Each mod augments this interface with only its own optional save fields. */
export declare interface ModCarryFields {
}

export declare interface ModDef {
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

/** Optional enrollment data declared by mods in their own modules. */
export declare interface ModEnrollmentFields {
}

/**
 * **The one question a mod asks before it acts.**
 *
 * An `anytime` mod is on where its switch and its requirements are. A `playthrough` mod asked
 * about a playthrough answers from that playthrough's own record, which named the mods it
 * started with; asked with no record, it answers what a new playthrough would get. A record
 * written before this list existed names none, so no `playthrough` mod is on for it.
 */
export declare function modOn(switches: ModSwitches, id: string, record?: Pick<PlaythroughRecord, 'mods'> | null, mods?: readonly ModDef[]): boolean;

/** One yes-or-no setting of a mod's own. */
export declare interface ModOption {
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
export declare interface ModOptionGroup {
    id: string;
    label: string;
    hint: string;
}

/**
 * What the switches add to an on-disk playthrough. The record extends this named shape so
 * declaration bundlers retain these fields for standalone kit consumers; an ambient module
 * augmentation works inside the game but is lost from the rolled-up declarations.
 */
export declare interface ModPlaythroughFields {
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
export declare interface ModSceneFields {
}

/**
 * When a mod's switch takes effect.
 *
 * - `anytime`: read where the mod acts, so it can be turned on or off whenever the player likes.
 * - `playthrough`: fixed when a playthrough starts, for a mod whose saves depend on it. The
 *   switch is what a new playthrough gets; one already started keeps what it started with.
 */
export declare type ModScope = 'anytime' | 'playthrough';

/**
 * One mod's data on a record, under the mod's id in the record's `ex`: what the mod wrote, and
 * the version of the mod that wrote it, so a later version can read an older shape.
 */
export declare interface ModSlice {
    /** The version of the mod that wrote `data`. */
    v: string;
    /** What the mod wrote, plain JSON; core never reads inside it. */
    data: unknown;
}

/**
 * What the player has set, as `data/mods.json` holds it. A mod or an option that is not in
 * either map is at its default, so a mod added by an update needs nothing written for it.
 */
export declare interface ModSwitches {
    /** By mod id. */
    on: Record<string, boolean>;
    /** By {@link optionKey}. */
    options: Record<string, boolean>;
}

/** The places with a def that no week is ever dealt. */
export declare const NARRATIVE_LOCATIONS: readonly LocationDef[];

declare type NativeCharacterTrait = (typeof CHARACTER_TRAITS)[number];

/** On-disk save file — `/data/saves/{playthroughId}/{saveId}.json`. */
export declare interface NativeGameSave {
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

/** Everyone `charId` counts as a friend, in roster order. */
export declare function npcFriendsOf(map: NpcRelationshipMap | undefined, charId: string, roster: readonly string[]): string[];

/** A set of characters spending one slot in one place. */
declare interface NpcGroup {
    /** A location id, or `'room'` when they are in the host's room. */
    location: string;
    /** Whose haunt or room this is; absent for a night out, which is nobody's. */
    host?: string;
    /** charIds, one to three of them, the host included when there is one. */
    members: string[];
}

/** The pair's standing, or `undefined` for two strangers. */
export declare function npcPairOf(map: NpcRelationshipMap | undefined, a: string, b: string): NpcRelationship | undefined;

/** One pair's standing. */
declare interface NpcRelationship {
    /** {@link MIN_AFFINITY} to {@link MAX_AFFINITY}, inclusive. */
    affinity: number;
    encounter?: NpcEncounter;
}

/** Keyed by {@link pairKeyOf} — one entry per unordered pair, never two. */
export declare type NpcRelationshipMap = Record<string, NpcRelationship>;

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
 * How the roster feels about *each other* — the pair map, its zones, and every roll
 * that moves one.
 */
/** The band an affinity falls in. Strangers are the absence of an entry, not a band. */
declare type NpcZone = 'friends' | 'neutral' | 'enemies';

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

/** The key one mod's option is stored under. */
export declare function optionKey(modId: string, optionId: string): string;

/** Where one of a mod's options stands. An option nobody declared is off. */
export declare function optionOn(switches: ModSwitches, modId: string, optionId: string, mods?: readonly ModDef[]): boolean;

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

/**
 * The booru tags one outfit set renders from. A custom slot's are read defensively, since a
 * hand-edited record reaches the prompt builder unvalidated.
 */
export declare function outfitTagsFor(character: Character, set: OutfitSet): readonly string[];

/** One line of the reader's inventory: an item and how many of it he holds. */
declare interface OwnedItem {
    /** An `ItemDef.id` (`shared/shop.ts`), which owns the name, price and prose. */
    itemId: string;
    /** Always at least 1 — an entry that reaches zero is removed instead. */
    count: number;
    /** A present a girl gave him: who, and the day. Never on a line with a bought item. */
    from?: ReceivedFrom;
}

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

/** Accumulated points per stat. Never a tier — see {@link tierOf}. */
export declare interface PlayerStats {
    brain: number;
    body: number;
    heart: number;
}

/**
 * On-disk playthrough record — `/data/saves/{playthroughId}/playthrough.json`: everything
 * New Game settled and no save afterwards rewrites, its top level the first semester's; written
 * once beside the saves that read it, again with each semester Continue adds, and when the
 * player renames the playthrough. The folder names the playthrough, so no id is carried here.
 */
export declare interface PlaythroughRecord extends ModPlaythroughFields {
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

/** The fewest points that buy `tier` — what New Game seeds a chosen tier with. */
export declare function pointsForTier(tier: StatTier): number;

/** Which way a status line went for the reader, for the sound its arrival makes. */
declare type Polarity = 'positive' | 'negative';

/**
 * Every CG a character can have rendered: the stock positions, and the two images of each
 * custom slot. One travels as a {@link SpriteRef} in place of an emotion, and showing one
 * swaps the stage for her CG.
 */
declare type Position = StockPosition | CustomCgSlot | `${CustomCgSlot}_after`;

/**
 * A mod's own fields on a feed post that hold a time, moved back with the post when New Game+
 * carries her feed onto the next semester's clock: the game moves the post's date, and each mod
 * the fields it added. `days` is how far the dates move back; a global slot moves twice that.
 * Like the fields above, independent of switches, so a mod off when the semester turns finds its
 * fields on the right clock when it is turned back on.
 */
declare type PostCarrier = (post: SocialPost, days: number) => SocialPost;

/**
 * The replies under a post on the feed. The game draws none of its own: a mod writes them and
 * draws them (`postComments` in the hooks), and the game keeps their shape, when each one turns
 * up, and moves them with the post when New Game+ carries her feed on. A mod keeps its own fields
 * on a comment in its slice.
 */
/** One reply under a post. */
export declare interface PostComment {
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

/** A project's build log: every slot he worked on it, ascending. */
declare interface ProjectRecord {
    sessions: ProjectSession[];
}

/** One slot spent building a project — and what the reader did with it. */
export declare interface ProjectSession {
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

/** The four routable kinds, in the order the checklist prints them: the default set first. */
declare const PROMPT_KINDS: readonly ['solo', 'examQuiz', 'slotIntro', 'texting'];

/** The parts a scene builder emits, in the order it builds them. */
export declare const PROMPT_PARTS: readonly ['persona', 'jsonRules', 'setting', 'reader', 'cast', 'now', 'class', 'lorebook', 'modLines', 'storySoFar', 'sceneSoFar', 'yourTurn'];

/**
 * One render's tag groups as the player may rewrite them for that render alone. Each member is
 * the scope one regenerate opens in; a builder reads only its own kind and falls back to the
 * character for every other.
 */
export declare type PromptEdit = {
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

declare type PromptKind = (typeof PROMPT_KINDS)[number];

/**
 * One part of a scene request as its builder emitted it, its text already carrying any edits and
 * found verbatim in the request's `system` or `user`. Parts a mod adds in main carry its own ids.
 */
export declare interface PromptPart {
    id: string;
    role: 'system' | 'user';
    text: string;
}

export declare type PromptPartId = (typeof PROMPT_PARTS)[number];

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

/** The `SceneLine.speaker` of the player's own submitted action. */
export declare const READER_SPEAKER = "reader";

/** A memory in the reader's voice: "you" becomes "the reader", the verb after it agreeing. */
export declare function readerize(text: string): string;

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

/** One inline image on a {@link StructuredRequest} — never written to disk. */
declare interface ReferenceImage {
    mimeType: string;
    /** Base64 payload only; the `data:<mime>;base64,` prefix is stripped by the caller. */
    data: string;
}

/** Every render the tag modal opens on: all but the room, whose prompt is prose. */
declare type RegenTarget = Exclude<RenderTarget, 'room'>;

/** Register at boot, before requests/screens. Duplicate values fail loudly, never first-wins. */
export declare function registerCharacterTrait(modId: string, definition: CharacterTraitDefinition): () => void;

/** A mod's additions to sprite and CG drafts. Registering again replaces its own. */
export declare function registerImagePromptDraft(modId: string, draft: ImagePromptDraft): void;

export declare function registerPostCarry(modId: string, carrier: PostCarrier): void;

/** Optional, additive requirements. With no active mod the native rules are untouched. */
export declare function registerRomanceRequirement(modId: string, requirement: Requirement): void;

/** Retention is independent of switches: disabling a feature must not erase its archive. */
export declare function registerTermCarry<K extends keyof ModCarryFields>(field: K, adapter: (save: GameSave, context: TermCarryContext) => ModCarryFields[K]): void;

/**
 * A mod's files kept per playthrough outside the save (pictures, say), copied into the new
 * playthrough's folder by the mod itself. Like the fields, independent of switches: a feature
 * off when the semester turns keeps its files for when it is turned back on.
 */
export declare function registerTermFiles(modId: string, carrier: FileCarrier): void;

/** A relationship milestone the ledger call may report for one scene. */
declare type RelationshipEvent = 'kissed' | 'sex' | 'became_lovers' | 'broke_up' | 'friendzoned_by_reader' | 'friendzoned_reader' | 'gave_contact_info' | 'unblocked' | 'agreed_to_harem';

/** The tag the contact profile shows; `isLover` answers ahead of the tier. */
export declare function relationshipTagOf(flags: CharFlags, affection: number): string;

export declare const REMOVED_HOOKS: readonly RemovedHook[];

/** A hook that is gone: what the compatibility check names in "needs an update". */
export declare interface RemovedHook {
    readonly name: string;
    /** The build's release that dropped it (`BUILD.version`), not the game's. */
    readonly removedIn: string;
    readonly replacedBy?: string;
}

/** Everything a render bucket can be asked for: a whole set, one CG, or one sprite. */
declare type RenderTarget = SetTarget | CgTarget | ExpressionTarget;

declare type Requirement = (character: RomanceCharacter) => Partial<PlayerStats> | null;

/** Discriminated result envelope returned by every IPC handler. */
export declare type Result<T> = {
    ok: true;
    data: T;
} | {
    ok: false;
    error: AppError;
};

/**
 * What a post is liked by: everyone she is close to, plus a few strangers. Rolled once
 * when the post is written, never recomputed.
 */
export declare function rollPostLikes(friendsCount: number, rand?: () => number): number;

declare type RomanceCharacter = Pick<Character, 'traits' | 'preferredStat'> | undefined;

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

/** The one pattern for a safe charId. */
export declare const SAFE_CHAR_ID: RegExp;

/** Ids that are a bare decimal number: playthrough ids and slot save ids. */
export declare const SAFE_NUMERIC_ID: RegExp;

/** Every scene event, grouped by the scene it fits; appended, never reordered. */
declare const SCENE_EVENT_IDS: readonly ['herAsleep', 'herShowering', 'herMasturbating', 'herBug', 'herRomance', 'herLockedOut', 'hisDrinks', 'hisLate', 'hisUpset', 'mealFire', 'mealMissingIngredient', 'mealInjury', 'mealDisaster', 'strayCat', 'strayDog', 'lostChild', 'heartAttack', 'lostWallet', 'hitOn', 'noUmbrella', 'drenched', 'noHomework', 'noMaterials', 'asleepInClass', 'badGrade', 'lateToClass', 'classCancelled', 'peInjury', 'peWardrobe', 'periodAccident', 'hungover', 'injury', 'wardrobe', 'powerOut', 'brokenAc', 'wifiOut', 'lostPhone', 'hiccups'];

/** The cast scene's persona and its instruction blocks. */
export declare const SCENE_TEXT_IDS: readonly ['persona.scene', 'scene.opening', 'scene.continue', 'scene.continue.first-line', 'scene.continue.going', 'scene.continue.ending', 'scene.closing', 'scene.solo'];

/** The curveball a scene opened on, and the girl it happens to where it names one. */
declare interface SceneEvent {
    id: SceneEventId;
    charId?: string;
}

declare type SceneEventId = (typeof SCENE_EVENT_IDS)[number];

/** When each scene event last fired this semester, by event id: its cooldown's record. */
declare type SceneEventsFired = Record<string, number>;

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

/** A single line of a scene, as emitted by the cloud LLM. */
export declare interface SceneLine {
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

/** The scene calls a builder makes. */
export declare type SceneSpot = 'opening' | 'continue' | 'closing' | 'solo';

/** Which scene call a builder made and who is in it. */
export declare interface SceneSpotTag {
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

/** A running summary a scene reply came with, and the transcript length it covers up to. */
declare interface SceneSummaryMark {
    at: number;
    summary: string;
}

export declare type SceneTextId = (typeof SCENE_TEXT_IDS)[number];

/**
 * Which half of the year a semester is. A character's intake is the season she arrived in:
 * the January intake advances a year at the end of each fall, the August intake at the end of
 * each spring.
 */
export declare type Season = 'spring' | 'fall';

/** A disposition tier a secret is told at. */
declare type SecretTier = 'friendly' | 'trusted' | 'devoted';

/**
 * A stream of floats in [0, 1) off one seed (mulberry32). djb2 alone isn't enough: it moves by
 * one character's code, so ids like `a_1`/`a_2` differ only in their last digit and would sort
 * by it every time. The mixing here is what makes neighbouring seeds look arbitrary.
 */
export declare function seededRand(seed: string): () => number;

/**
 * The optional image sets that carry a seed-provenance flag: every wardrobe, the stock CG
 * set, which renders with the nude wardrobe and rerolls with it, and each custom CG pair.
 */
declare type SeededSet = OutfitSet | 'cg' | CustomCgSlot;

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

/**
 * One set of a character's images, as the Edit modal's controls address them: the default
 * wardrobe, one of the alternates, the stock CGs, the room backgrounds, or one custom CG pair.
 */
declare type SetTarget = 'default' | OutfitSet | 'cgs' | 'room' | CustomCgSlot;

/** Whether a mod is on, by its side's lookup. Before a side binds one, every mod reads as off. */
export declare function sharedModOn(modId: string): boolean;

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

/** The comments that have arrived by now: each carries the slot it turns up in. */
export declare function shownComments(comments: readonly PostComment[] | undefined, date: number, time: TimeSlot): PostComment[];

/** Saved with the scene. The game pays nothing for it; a mod that rewards one does so as the scene settles. */
export declare interface SlotActivity extends SlotActivityOffer {
    status: 'pending' | 'completed' | 'abandoned';
    result?: string;
    /** Set once the reply to its closing turn has landed: from then on the scene runs as any other. */
    closed?: true;
}

/** A mod-owned activity chosen on the landing, before the scene is cast. */
export declare interface SlotActivityOffer {
    owner: string;
    id: string;
    label: string;
    location: string;
    stat: StatKey;
}

/** Unpacks a global slot id. The inverse of {@link globalSlotOf}. */
export declare function slotFromId(id: number): {
    date: number;
    time: TimeSlot;
};

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

/** One status update on the social feed; its likes are rolled once and stored. */
export declare interface SocialPost {
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

/**
 * Everything a `sprite:`/`cg:` action and the stage's sticky map may hold: a bare emotion, an
 * emotion suffixed with an outfit set, or a position, which shows a CG.
 */
declare type SpriteRef = Emotion | Position | `${Emotion}_${OutfitSet}`;

/** What the app knows about the slot that the ledger does not. */
export declare interface StatContext {
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
export declare type StatKey = 'brain' | 'body' | 'heart';

/** Tier 0 is the floor, tier 5 the ceiling. */
export declare type StatTier = 0 | 1 | 2 | 3 | 4 | 5;

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
export declare interface StatusText {
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
export declare interface StructuredRequest {
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
 * One girl's suspicion that the reader is seeing another: the other girl, and the global slot
 * of the last sign she got; a second sign within the window makes her tell.
 */
declare interface Suspicion {
    subject: string;
    slot: number;
}

export declare interface TermCarryContext {
    /** Zero-based outgoing semester. */
    term: number;
    /** Days subtracted from native memories by the semester implementation. */
    back: number;
    characters: Record<string, Character>;
}

/** The playthroughs a semester is carried between, by id. */
export declare interface TermFilesContext {
    /** The finished playthrough. */
    from: string;
    /** The new one, written but not yet entered. */
    to: string;
}

/** Original semester/day for a saved event whose working date is now before day zero. */
declare interface TermOrigin {
    term: number;
    day: number;
}

export declare type TextBlockId = SceneTextId | GlobalTextId;

/** Edits to text blocks, by id; an absent id sends the shipped text. */
export declare type TextEdits<Id extends string = TextBlockId> = Partial<Record<Id, string>>;

/** The edits the builders are handed: the cast scene's own, and every other call's. */
export declare interface TextEditSet {
    scene?: TextEdits<SceneTextId>;
    global?: TextEdits<GlobalTextId>;
}

/**
 * The structured reply to one texting turn. `messages` streams first, so the texts
 * land in the conversation as they are written; whether any was a hangout is the hangout
 * classifier's question.
 */
export declare interface TextingResponse {
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
export declare type TimeSlot = 0 | 1;

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

/** A disposition tier whose upper half reads differently from its lower one. */
declare type UpperHalf = 'neutral' | 'friendly' | 'trusted';

/**
 * Checks one parsed record and hands it back typed; `where` is the path or key it came from,
 * which every refusal carries as its detail.
 */
export declare function validateRecord<T extends object>(parsed: unknown, where: string, opts: ValidateRecordOptions<T>): T;

/**
 * The record check every persisted-state file passes once it has been parsed: this build's
 * `schemaVersion`, and every required field present. Nothing is defaulted.
 */
/** Per-caller naming for the ways a record can be refused. */
export declare interface ValidateRecordOptions<T extends object> {
    /** How the record is named in the messages — `'character.json'`, `'That save'`. */
    label: string;
    /** Raised when it is not an object, or is missing a required field. */
    malformed: {
        code: string;
        message: string;
    };
    /** Raised when `schemaVersion` is not {@link expects}. */
    schemaVersion: {
        code: string;
    };
    /** The one version this build reads and writes. */
    expects: number;
    /** Every field the record must carry; the first one absent is refused by name. */
    required: Partial<Record<keyof T, true>>;
    /**
     * Brings a record from the version before {@link expects} up to it before the check; anything
     * else comes back untouched, for the check to refuse.
     */
    upgrade?: (record: object) => object;
    /** A check of the record's inner shape past its required fields, run last; it throws to refuse. */
    check?(record: T, where: string): void;
}

declare type Weather = (typeof WEATHER_KINDS)[number];

/** What a slot's sky can be; appended, never reordered. */
declare const WEATHER_KINDS: readonly ['clear', 'rain', 'storm'];

/** Which band an affinity sits in. */
export declare function zoneOf(affinity: number): NpcZone;

export { }
