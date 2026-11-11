import { BrowserWindow } from 'electron';
import { BrowserWindowConstructorOptions } from 'electron';

/**
 * Every sound the app plays, and the one place each is levelled — file, group, loop, trim,
 * pitch and jitter. Retune a sound here and nowhere else.
 */
declare const AUDIO_GROUPS: readonly ['music', 'sfx', 'ambience', 'nsfw'];

declare type AudioGroup = (typeof AUDIO_GROUPS)[number];

/** A mod's own share of a backup. */
export declare interface BackupPart {
    /** Writes the mod's share into `context.scratch`, after the game has gathered its own. */
    export(context: BackupPartContext): Promise<BackupPartExport>;
    /**
     * Reads the mod's share out of an arriving backup before anything is written, and answers how
     * to restore it. A throw stops the whole restore with nothing written.
     * Called even when the backup has no entry for this mod, so legacy keys/folders can be read.
     * In that case json is undefined and files.dir still exists. With no data to restore, return
     * a no-op commit/discard pair.
     */
    prepare(json: unknown, files: {
        dir: string;
        list: readonly string[];
    }, legacy: BackupPartLegacy): Promise<BackupPartRestore>;
}

/** Adds the mod's share to every backup from now on; one per mod id. */
export declare function backupPart(modId: string, part: BackupPart): void;

/**
 * What a mod adds to the archives the game writes: its own share of a backup, and of a character
 * export. Registered from a mod's `main.js`, one of each per mod id, and run by the backup and
 * character transfer services in registration order.
 */
/** What a part's export is handed. */
export declare interface BackupPartContext {
    /** The part's own folder in the backup being written, created; what it writes there goes in the zip. */
    scratch: string;
    /** Every playthrough the backup carries. */
    playthroughIds: readonly string[];
}

/** What a part's export answers. */
export declare interface BackupPartExport {
    /** Carried in the backup's record beside the files. Plain JSON. */
    json?: unknown;
    /** The files it wrote, as paths under `scratch`, with `/` or the platform's separator; without it, every file it wrote is carried. */
    files?: readonly string[];
}

/** What a backup's arriving data holds that the game itself does not read. */
export declare interface BackupPartLegacy {
    /** The backup record's keys the game does not own, with their values as read. */
    record: Readonly<Record<string, unknown>>;
    /** The zip's top-level folders the game does not claim, as unpacked: absolute paths. */
    dirs: readonly string[];
    /** The backup file being read, by the path it was given: for a share an older build kept beside it. */
    archive: string;
}

/** A restore a part has prepared and not yet made. */
export declare interface BackupPartRestore {
    /** Makes the restore, once the game's own share of the backup has been written. */
    commit(): Promise<void>;
    /** Drops it, writing nothing. */
    discard(): Promise<void>;
}

/** A mod's own share of a character export. */
export declare interface CharacterTransferPart {
    /** The mod's data on the character, for the export's manifest; `dir` is the mod's own folder in the export. */
    export(charId: string, dir: string): Promise<unknown>;
    /**
     * Checks the mod's share of an arriving export before anything is adopted; a throw refuses the
     * import. `json` is undefined where the export carries none; `legacy` is the manifest's keys
     * the game does not own.
     */
    validate(json: unknown, dir: string, legacy: Readonly<Record<string, unknown>>): Promise<void>;
    /** Takes the mod's share in for the adopted character, answering how to take it back out. */
    adopt(charId: string, json: unknown, dir: string, legacy: Readonly<Record<string, unknown>>): Promise<() => Promise<void>>;
    /** Copies the mod's data on one character to her duplicate, answering how to take it back out. */
    duplicate(fromId: string, toId: string): Promise<() => Promise<void>>;
}

/** Adds the mod's share to every character export, import and duplicate from now on; one per mod id. */
export declare function characterTransferPart(modId: string, part: CharacterTransferPart): void;

/** The GPU vendor a portable build is compiled for, and the one a machine installs. */
declare type ComfyGpu = 'nvidia' | 'amd';

/** Facts available just before the game's managed ComfyUI process is spawned. */
export declare interface ComfyLaunchContext {
    /** The same managed installation root used as the child's working directory. */
    readonly root: string;
    readonly platform: NodeJS.Platform;
}

/** One source's picks, a slot absent where it draws with whatever the slot resolves to. */
declare type ComfyModelPicks = Partial<Record<ComfyModelRole, string>>;

/**
 * The models a render is drawn with, as slots the player fills: which loader input each one is,
 * what the workflows name in it as shipped, and where a server keeps its files. Read by main,
 * which writes the picks into every graph, and by the renderer, which offers them.
 */
/** One model slot, named by the pin that fills it as shipped. */
declare type ComfyModelRole = PinnedModel['id'];

/** A mod-owned API-format graph and the inputs core fills for one image. */
export declare interface ComfyRenderRequest {
    workflow: Record<string, {
        class_type: string;
        inputs: Record<string, unknown>;
    }>;
    nodes: {
        saveImage: string;
        positivePrompt?: string;
        negativePrompt?: string;
        seed?: string;
        characterLora?: string;
    };
    prompts?: {
        positive: string;
        negative: string;
    };
    seed?: number;
    lora?: {
        name: string;
        weight: number;
    } | null;
    texts?: Record<string, string>;
}

/** Where the pictures are drawn: the app's own install, or a ComfyUI the player runs. */
declare type ComfySource = 'managed' | 'external';

/** A main-side mod request, using the configured provider without disclosing its settings. */
export declare function completeModStructured<T>(request: StructuredRequest, signal: AbortSignal, lowLatency?: boolean): Promise<T>;

/** Create a local auxiliary window with the host preload and a channel namespace bound at launch. */
export declare function createDesktopSurface(owner: string, options: Omit<BrowserWindowConstructorOptions, 'webPreferences'>): BrowserWindow;

/**
 * The tags every ComfyUI prompt and every new character's appearance open with: the build's own,
 * or the player's from Settings, read the same way by both processes.
 */
/** One group of default tags, as the ComfyUI tab lists them. */
declare type DefaultTagGroup = 'quality' | 'negative' | 'sprite' | 'spriteNegative' | 'cg' | 'subject';

/** The seven sprite expressions a character can be generated in. */
declare type Emotion = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'embarrassed' | 'aroused';

/**
 * What a custom endpoint may be sent as `service_tier`, in the order Settings lists them after
 * None. `default` and `standard` are one tier spelled two ways: OpenAI's and Google's.
 */
declare const ENDPOINT_SERVICE_TIERS: readonly ['auto', 'priority', 'default', 'standard', 'flex'];

declare type EndpointServiceTier = (typeof ENDPOINT_SERVICE_TIERS)[number];

declare type EnvironmentProvider = (context: Readonly<ComfyLaunchContext>) => Readonly<Record<string, string>> | null;

/**
 * Unpacks a `.zip` with bundled 7-Zip, but only once its whole listing has been accepted, and
 * answers with that listing.
 */
export declare function extractZip(archivePath: string, destDir: string, limits?: {
    maxEntries: number;
    maxTotalBytes: number;
}): Promise<ZipEntry[]>;

/** `tag` is what the mod's window-side `sceneCall` hook tagged the call with. */
export declare type FinalRequestHook = (request: StructuredRequest, ctx: {
    tag: unknown;
}) => FinalRequestPlan | null | Promise<FinalRequestPlan | null>;

/** What a mod's request hook leaves for the one call: the request to send and how its reply is read. */
export declare interface FinalRequestPlan {
    request: StructuredRequest;
    /** Sampler values for this call alone; a custom endpoint is the only one that takes them. */
    sampling?: Partial<Pick<Settings, SamplingKey>>;
    /** Reads the parsed reply; what it returns reaches the window as `modReply[<mod id>]`. */
    finish?: (reply: Record<string, unknown>) => unknown;
}

/** Whether a generated or bundled expression is available for a scene participant. */
export declare function hasExpressionArt(id: string, expression: Emotion): Promise<boolean>;

/** The type an image's first bytes say it is, or `null` for anything it cannot name. */
declare function imageTypeOf(bytes: Uint8Array): 'image/png' | 'image/jpeg' | 'image/webp' | null;

/** The main-side context of one mod call, owned by the loader. */
export declare interface InvokeContext {
    readonly id: string;
    readonly signal: AbortSignal;
    /** Electron webContents ID supplied by the host for the renderer that made this call. */
    readonly senderId: number;
}

/** One named function exported by a trusted main.js. */
export declare type InvokeHandler = (context: InvokeContext, ...args: unknown[]) => unknown;

/** How many memories per character a cast scene's prompt carries, by cast size; absent is the default. */
declare interface MemoryBudgets {
    one?: number;
    two?: number;
    three?: number;
}

/**
 * The folder a mod keeps its own files in, created on the first call: `data/mod-data/<id>`, or
 * with a playthrough `data/saves/<playthroughId>/mod-data/<id>`; where the installed mod's
 * manifest declares a `dataPath`, the folder it names there instead. A playthrough's folder must
 * already be there: this never makes one.
 */
export declare function modDataPath(modId: string, playthroughId?: string): string;

/** Read current switches from disk; a mod that could not load this session is always off. */
export declare function modIsOn(modId: string): Promise<boolean>;

/** The option's rule against main's current switches, independently of the mod's on/off switch. */
export declare function modOptionOn(modId: string, optionId: string): boolean;

/**
 * Pinned install/verify manifest shared across processes: the authoritative pins for the two
 * ComfyUI runtime releases, one per GPU vendor, the commit archives its custom nodes are cut
 * from, the model weights, and the exact versions the nodes' Python dependencies are
 * constrained to.
 */
/** A model weight file downloaded into the ComfyUI tree. */
declare interface PinnedModel {
    /** Stable identifier used as a setup component id. */
    id: 'upscaler' | 'handDetector' | 'faceSegDetector' | 'checkpoint' | 'lora' | 'controlnet';
    label: string;
    /** ComfyUI models subfolder, possibly nested (e.g. `ultralytics/bbox`). */
    destDir: string;
    /** Our own filename, hardcoded in the runtime workflows and never free to change. */
    destFile: string;
    /** The upstream basename, which a hand-placed file arrives under. */
    sourceFile: string;
    /** Anonymous direct download; no account, no token, no query string. */
    url: string;
    /** Exact size in bytes; the startup verify check. */
    bytes: number;
    /** Full SHA256, verified after download and on demand. */
    sha256: string;
}

/** The four routable kinds, in the order the checklist prints them: the default set first. */
declare const PROMPT_KINDS: readonly ['solo', 'examQuiz', 'slotIntro', 'texting'];

declare type PromptKind = (typeof PROMPT_KINDS)[number];

/**
 * One part of a scene request as its builder emitted it, its text already carrying any edits and
 * found verbatim in the request's `system` or `user`. Parts a mod adds in main carry its own ids.
 */
declare interface PromptPart {
    id: string;
    role: 'system' | 'user';
    text: string;
}

/** Cloud LLM provider table shared with Settings; main adapters key off `api`. */
/** Request/response shape a provider speaks. One adapter exists per value. */
declare type ProviderApi = 'gemini' | 'openai';

/** Reads and parses one JSON file, unchecked. */
export declare function readJsonFile<T>(path: string, opts: ReadJsonOptions<T>): Promise<ReadJsonResult<T>>;

/** The ways reading and parsing one file can go other than to plan. */
export declare interface ReadJsonOptions<T> {
    /** Raised when the file is not valid JSON. */
    malformed: {
        code: string;
        message: string;
    };
    /** Raised when the file exists but cannot be read. */
    unreadable: {
        code: string;
        message: string;
    };
    /** ENOENT recovery: return a value (nothing was read, nothing is validated) or throw. */
    onMissing: () => T;
}

/** One file's parsed contents, or what `onMissing` answered where there was no file. */
export declare type ReadJsonResult<T> = {
    kind: 'read';
    parsed: unknown;
} | {
    kind: 'missing';
    value: T;
};

/** One inline image on a {@link StructuredRequest} — never written to disk. */
declare interface ReferenceImage {
    mimeType: string;
    /** Base64 payload only; the `data:<mime>;base64,` prefix is stripped by the caller. */
    data: string;
}

/** Trusted main-process setup only; the owner removes its registration when deactivated. */
export declare function registerComfyLaunchEnvironment(modId: string, provider: EnvironmentProvider): () => void;

/** Trusted main-process setup only; the owner removes its registration when deactivated. */
export declare function registerFinalRequest(modId: string, hook: FinalRequestHook): () => void;

/** Queues a mod's graph through core's renderer and returns its checked image bytes. */
export declare function renderComfyImage(modId: string, request: ComfyRenderRequest, { signal, onProgress }: {
    signal: AbortSignal;
    onProgress?: (step: string) => void;
}): Promise<Uint8Array>;

/**
 * A backup part whose export must succeed. If it throws or returns invalid data, no backup is
 * written and any existing target archive stays intact. Import has the same two-phase contract
 * as backupPart. Declare main:requiredBackupPart so older cores cannot silently omit this data.
 */
export declare function requiredBackupPart(modId: string, part: BackupPart): void;

/** One sampling value a custom endpoint's chat-completions body can carry. */
declare type SamplingKey = 'temperature' | 'repetitionPenalty' | 'topP' | 'topK';

/** The scene calls a builder makes. */
declare type SceneSpot = 'opening' | 'continue' | 'closing' | 'solo';

/** Which scene call a builder made and who is in it. */
declare interface SceneSpotTag {
    spot: SceneSpot;
    /** The cast's given names in order; empty for a solo scene. */
    cast: string[];
}

/** Which inference queue serves a request, in the order Settings lists them, the default first. */
declare const SERVICE_TIERS: readonly ['priority', 'standard', 'flex'];

declare type ServiceTier = (typeof SERVICE_TIERS)[number];

/** On-disk settings — `/data/settings.json`. */
declare interface Settings {
    schemaVersion: 1;
    /** Which writer the scenes come from: Gemini by default, or a chat-completions endpoint. */
    apiProvider: ProviderApi;
    /**
     * Gemini's model id, defaulting to its `defaultModel` (see `providers.ts`). Gemini's alone:
     * a custom endpoint's is {@link endpointModel}.
     */
    apiModel: string;
    /**
     * The Gemini key: it writes and draws the cloud pictures under `gemini`. Empty is no key at
     * all, which is what the pictures are skipped without there.
     */
    apiKey: string;
    /** How hard the model reasons; resolved against the model at call time. Gemini's alone. */
    thinkingLevel: ThinkingLevel;
    /**
     * The custom endpoint's API root, up to and including the version segment and without
     * `/chat/completions`. Read only under `openai`.
     */
    endpointUrl?: string;
    /** The model id a custom endpoint runs on, as typed; blank is none. Read only under `openai`. */
    endpointModel?: string;
    /**
     * A custom endpoint's second model for the kinds in {@link secondaryModelFor}. Absent or blank
     * means every call runs on {@link endpointModel}. Read only under `openai`.
     */
    endpointSecondaryModel?: string;
    /**
     * How hard a custom endpoint's model reasons, sent as `reasoning_effort`. Absent reads as
     * minimal. Read only under `openai`.
     */
    reasoningEffort?: ThinkingLevel;
    /**
     * The queue a custom endpoint is asked to serve on, sent as `service_tier`. Absent is not sent.
     * Read only under `openai`.
     */
    endpointServiceTier?: EndpointServiceTier;
    /**
     * The reply cap a custom endpoint is sent as `max_tokens`. Absent sends the pinned ceiling,
     * which a small-context server refuses. Read only under `openai`.
     */
    maxOutputTokens?: number;
    /**
     * The custom endpoint's own key, sent to it and nowhere else; absent where the endpoint
     * needs none. It is kept only for the origin it was typed for.
     */
    endpointApiKey?: string;
    /**
     * The root a custom provider's pictures are asked at: Google's own speaks Gemini's native call,
     * anywhere else OpenRouter's Images API. Absent is Google's. Read only under `openai`.
     */
    imageEndpointUrl?: string;
    /**
     * The model a custom provider's pictures are drawn on, as typed; absent or blank is the room
     * model Gemini's own provider draws with. Read only under `openai`.
     */
    imageModel?: string;
    /**
     * The key a custom provider's pictures are drawn with; absent draws them on {@link apiKey} at
     * Google's own host where that is set, else on {@link endpointApiKey}. It is kept only for the
     * origin it was typed for.
     */
    imageApiKey?: string;
    /**
     * Gemini's second model for the calls named in {@link secondaryModelFor} — a model id from
     * Gemini's table. Absent or empty means every call runs on {@link apiModel}. Gemini's alone.
     */
    secondaryModel?: string;
    /**
     * Which kinds the active provider's second model writes. **Absent means the default set**
     * (`DEFAULT_SECONDARY_KINDS`), so a player who picks a model and touches nothing else gets
     * what the checkboxes show; an empty list means none.
     */
    secondaryModelFor?: PromptKind[];
    /**
     * Which inference queue serves Gemini's text calls, picked in Settings and resolved at call
     * time. Optional on disk, absent meaning `priority`. Gemini's alone: a custom endpoint's is
     * {@link endpointServiceTier}.
     */
    serviceTier?: ServiceTier;
    /**
     * Stream scene and texting replies for a live preview; off sends the same calls to the
     * whole-reply endpoint instead. **Not a player setting** — hand-edited beside `forceTime`,
     * absent meaning on.
     */
    streamResponses?: boolean;
    /** The player skipped the optional ComfyUI install; boot stops verifying it. */
    comfyDeferred: boolean;
    /**
     * Which ComfyUI portable build is installed and verified. **Not a player setting** —
     * hand-edited like {@link streamResponses}, absent meaning the GPUs Electron reports decide.
     */
    comfyGpu?: ComfyGpu;
    /**
     * Which ComfyUI draws: the app's own install, or the player's own at {@link comfyUrl}. Optional
     * on disk, absent meaning the app's own.
     */
    comfySource?: ComfySource;
    /** Where the player's own ComfyUI answers. Absent is `DEFAULT_COMFY_URL`. */
    comfyUrl?: string;
    /** The models the app's own ComfyUI draws with, a slot absent where it draws the shipped one. */
    comfyModels?: ComfyModelPicks;
    /** The models the player's own ComfyUI draws with, kept apart from the app's own install's. */
    comfyExternalModels?: ComfyModelPicks;
    /** The weight the app's own ComfyUI draws its LoRA at. Absent is `DEFAULT_LORA_WEIGHT`. */
    comfyLoraWeight?: number;
    /** The weight the player's own ComfyUI draws its LoRA at, kept apart like its picks. */
    comfyExternalLoraWeight?: number;
    /**
     * The default tags either ComfyUI's prompts open with, a group absent where it is the build's
     * own; absent altogether where every group is.
     */
    comfyTags?: Partial<Record<DefaultTagGroup, string[]>>;
    /**
     * Whether a newer build the launch check finds is offered before the first screen; the main
     * menu's notice offers it either way. Optional on disk, absent meaning it is.
     */
    checkUpdates?: boolean;
    /**
     * Whether the window opens fullscreen. A change to it switches the window at once; F11
     * toggles the window without writing it. Optional on disk, absent meaning it does.
     */
    fullscreen?: boolean;
    /**
     * Whether interjecting during a scene's ending warns first. Optional on disk, absent meaning
     * it does.
     */
    warnEndingInterrupt?: boolean;
    /**
     * Whether rewriting a chat-log line during a scene's ending warns first. Optional on disk,
     * absent meaning it does.
     */
    warnEndingEdit?: boolean;
    /**
     * Whether the reader's cropped picture stands beside the box on a scene's narrated lines.
     * Optional on disk, absent meaning it does not.
     */
    showProfilePictureInScenes?: boolean;
    /**
     * Whether saving a crop asks about {@link showProfilePictureInScenes} while it is off. Its box
     * turns it off, and nothing in the app turns it back on: only a hand edit does. Optional on
     * disk, absent meaning it asks.
     */
    askProfilePictureInScenes?: boolean;
    /**
     * Whether a fresh New Game opens on the New Game setup welcome. Its box turns it off, and
     * nothing in the app turns it back on: only a hand edit does. Optional on disk, absent meaning
     * it does.
     */
    newGameWelcome?: boolean;
    /**
     * The version the update check pretends this build is. **Not a player setting** — hand-edited
     * like {@link streamResponses}, for exercising an update against a build already on itch.io.
     */
    updateAsVersion?: string;
    /**
     * An https URL answering `{ latest, url }` in place of itch.io, for exercising an update
     * against a build served locally. **Not a player setting** — hand-edited like {@link streamResponses}.
     */
    updateFeed?: string;
    /**
     * Withhold the explicit images: the nude wardrobe and the CGs are covered wherever shown, and
     * a scene that calls for either changes her expression instead.
     */
    noNsfwImages: boolean;
    /**
     * Tone down what RITA is *told* to write: the sex direction leaves both personas and the CG
     * rules leave the schema entirely.
     */
    lessNsfwText: boolean;
    /**
     * Whether the player has been asked the content questions above. It is the first run's last
     * step, so it doubles as the mark that the run finished.
     */
    sfwAsked: boolean;
    /** Shipped characters the player has taken off the roster. */
    removedDefaults: string[];
    /**
     * Dev-only, hand-edited into the file: pin every render to the character's
     * `generationSeed` and write no seed state at all. Absent means off.
     */
    freezeSeeds?: boolean;
    /**
     * Dev-only, hand-edited into the file: pins the theme a screen opens in, so
     * either one can be looked at whatever the hour. Absent means the clock decides.
     */
    forceTime?: 'day' | 'night';
    /**
     * The four group volumes, 0-100 each, as the sliders left them. Absent, or any group
     * absent, reads as the default (`volumesOf` in `shared/audio.ts`).
     */
    volumes?: Record<AudioGroup, number>;
    /**
     * The browser build's opt-in to keeping the API key in its storage between visits, which
     * every other game on the same host can read; absent is the session-only default. The
     * desktop encrypts its key either way and ignores this.
     */
    rememberKey?: boolean;
    /** Sent as `temperature` to a custom endpoint. Absent is not sent. Read only under `openai`. */
    temperature?: number;
    /**
     * Sent as `repetition_penalty` to a custom endpoint. Absent is not sent. Read only
     * under `openai`.
     */
    repetitionPenalty?: number;
    /** Sent as `top_p` to a custom endpoint. Absent is not sent. Read only under `openai`. */
    topP?: number;
    /** Sent as `top_k` to a custom endpoint. Absent is not sent. Read only under `openai`. */
    topK?: number;
    /** How many memories per character a cast scene's prompt carries, by cast size. */
    memoryBudgets?: MemoryBudgets;
    /** How many of her told secrets every prompt carrying her memories carries; absent is the default. */
    secretBudget?: number;
    /**
     * The persona cast scene calls are written under in place of the shipped one, sent verbatim
     * whatever `lessNsfwText` says. Absent is the shipped persona.
     */
    scenePersona?: string;
    /**
     * Folders a mod author loads a mod from as it is built, each holding an unzipped release.
     * **Written by main** from the Mods screen's "For mod authors" fold, not by a settings patch,
     * and read before the window opens. Absent is none.
     */
    devModFolders?: string[];
    /**
     * Whether an installed mod from a source the org has not reviewed may run its main-process
     * code. Hand-edited until the Mods screen offers it; absent is off, and such a mod is then
     * not permitted to run.
     */
    allowUnreviewedMain?: boolean;
    /**
     * Which installed mods the start notice has already named, by id, each with the version it was
     * named at: the notice shows once per version of a mod that is not running, and the Mods
     * screen's row carries the word after that. **Written by main**, like `devModFolders`.
     */
    modNoticesSeen?: Record<string, string>;
    /**
     * The playthroughs already told that they were started before mods recorded their versions, by
     * id: that line is said once per playthrough. **Written by main**, like `modNoticesSeen`.
     */
    modUnversionedSeen?: string[];
}

/** What an image file's first bytes say it is, or `null` for one that cannot be read. */
export declare function sniffImageFile(path: string): Promise<ReturnType<typeof imageTypeOf>>;

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

/** Original semester/day for a saved event whose working date is now before day zero. */
declare interface TermOrigin {
    term: number;
    day: number;
}

/** How hard the model reasons before answering, cheapest first. */
declare const THINKING_LEVELS: readonly ['minimal', 'low', 'medium', 'high'];

declare type ThinkingLevel = (typeof THINKING_LEVELS)[number];

/** Two time slots per game day: 0 = day, 1 = night. */
declare type TimeSlot = 0 | 1;

/** `writeAtomicJson`'s twin for raw bytes: a picture, kept whole or not written at all. */
export declare function writeAtomicBytes(path: string, data: Uint8Array, opts: {
    code: string;
    message: string;
}): Promise<void>;

/** Writes JSON through a temp file in the same folder, then renames over the target. */
export declare function writeAtomicJson(path: string, data: unknown, opts: {
    code: string;
    message: string;
}): Promise<void>;

/**
 * What every archive the app opens has to be before a byte of it is unpacked, and what an
 * unpacked archive's entries have to be before they are kept.
 */
/** One row of an archive's listing. */
declare interface ZipEntry {
    /** Archive-relative path as 7-Zip prints it. */
    path: string;
    /** Uncompressed size in bytes; 0 for a directory row. */
    size: number;
    /** 7-Zip's attributes column, empty when it prints none for the row. */
    attributes: string;
}

export { }
