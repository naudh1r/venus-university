# Phase 2: feed and game-state hooks

Research and proposal only; no runtime changes. Prepared against `upstream/main`
`39ac61440bec7841e6cf8b276e3292c23130a4e5` (core
`b3ba4dbfaa63d918344ea879372fba65226e0dad`), fetched 2026-10-30.
Phase 1 reference: `origin`'s `notes/photo-main-hooks`, commit
`360a0118346340fd5112867b5000b83bf421b677`,
`docs/proposals/photo-main-hooks.md`. Proposed names below are **not existing exports**.

## Part 1 — Inventory

### Scope and method

Start with `test/kit/modFiles.ts`'s `bunnyfeeds` and `photo-feature` sets and their shared and
renderer `modEntries`, then intersect their rows in `test/kit/boundaryAllowlist.json` with the
feed and game-state groups in the request. Appendix A gives every matching import with its
actual source line, imported names, reads, writes, timing and disposition. Lines refer to the
pinned upstream commit, not this report branch's eventual head. A boundary row is a
**file/specifier pair**, not an individual symbol: a replacement which removes only one use
of `useGameStore` does not clear that row.

The appendix also explicitly accounts for desktop validators and type-only rows, and marks
Photo's three photo-tip delivery rows as deferred. This keeps Phase 1 and the separately
handled photo tips from silently turning into new Phase 2 requirements. Native
`photoStore.ts` and `PhotoFailedModal.tsx` are not Photo Feature's files in `MOD_FILES`; their
similarly named imports are not included. Bunnyfeeds' `prompts/bunnyfeedsPrompt.ts` is currently
outside its globs: its three importing rows are real move-out work, but are not feed/game-state
rows. Moving that owned prompt builder and its pure dependencies is a separate packaging task.

Read `CLAUDE.md`, `DESIGN_GUIDE.md` and the relevant `MODDING.md` sections; verified contracts
against `packages/modkit/src/renderer/{index,hooks,saveField,modState}.ts`, the bridge entries,
and native feed, texting, memory and save code. No proposed implementation is claimed tested.

### A. What already exists

| Need | Existing contract and practical limit |
|---|---|
| Add fields/lines to posts, DMs and scene requests | `registerHooks`: `prompts['slot-posts']`, `prompts['slot-poster']`, `prompts.dm`, `prompts['slot-reach-outs']`, `requests.scene`, `requests['slot-intro']`. These already cover both mods' prompt extensions; they do not grant general live-state access. |
| Process a landed reply or slot | `afterDmReply`, `afterReachOut`, `afterSceneReply`, `playerActs`, `gameEntered`, `slotSettled`, `slotStatusLines`. `slotSettled` is synchronous before clock advancement and the boundary save; starting an asynchronous thread request there does not make the boundary wait for it. |
| Change a post as it is filed | `fileFeedPost(filing, { nudge })` may change `filing.post`, set `held`/`featured`, and await preparation. The native caller checks its run after the hook. A mod's own write *inside* that awaited hook must also be fenced; the caller's later check cannot undo it. |
| File a new mid-slot post | `renderer:fileLatePost(post)` already uses native filing and the enabled mods' `fileFeedPost` hooks. It preserves the slot's teaser/fill. Photo's group post already uses it. Do not propose a duplicate `filePost` API. It currently returns `Promise<void>`, not a durable-save acknowledgement. |
| Select/draw post decorations | `postVisible`, `postOutAt`, `postPicture`, `postComments`, `PostPicture`, `PostCommentsView`, `PostCommentAction`, `ownsPostComments`. The first enabled comment owner wins by mod id; `claims` also protects another mod's saved comments. These are already in the kit. |
| Own saved data | `saveField` reads/uses/sets/writes one mod's save-level `ex`; `recordField` reads or returns a new record with its `ex`. `recordField.with` is pure: it **does not install that record** in the live game or autosave it. |
| Save mod slices safely | `writeModField` / `writeModFields`, or a field handle's `write`, serialize through the native save lane, require a safe point, check `expect`, and publish only after disk success. They cannot edit a native post, message, comment or memory. `safePoint`/`useSafePoint` report availability; `'waiting'` is a refusal, not automatic queuing until idle. |
| Own temporary state | One `modState(id, { initial, lifetime })` per mod; consolidate its multiple caches in that value. `game` resets on entry/leave, including reload/replay; `session` lasts for the window. Neither is a saved queue. |
| Switches and stale runs | `modIsOn`, `useModOn`, `useModOption`, `currentRun`, `runStale` already exist. `charKeyOf` is already shared. `lessNsfwText` already exists, with a conservative true-before-hydration default; old `lessNsfwTextNow` instead tests `=== true`. Migration must acknowledge that small default difference. |
| Carry | `registerPostCarry` moves Bunnyfeeds' post-local clocks; native comments move with their posts. `saveField.carry` handles a migrated save-level slice. `registerTermFiles` exists but native New Game+ stays in the same playthrough and does not call it. Phase 1's older carry description must not be read as a current native call site. |

### B. Transitive reads behind the imported wrappers

The appendix names direct fields; these nested calls explain the `CharInfo` and prompt objects
passed through rather than leaving “reads a character” unspecified:

- `bunnyfeedsThreads` passes `CharInfo` into its owned thread builder. Its calls to
  `dedupedMemoriesFor` read `memories`, `textMemory`, `jealousyMemories`, `giftMemories`
  (`date/type/desc`); `affectionFor` additionally reads memory `breakDays` and native
  Echo/talent multiplier metadata (`echoAffinity`, `echoBoosted`, stored talent multipliers),
  feed `liked/likedOn`,
  `breakPenalty.points/halved` and the character's traits. `relationshipLines` reads flags,
  `nameKnown`, `romanceScenes`, `upperHalves`, `moodCycleOffset`, and player Brain/Body/Heart
  stats. Profile/voice formatting reads character `firstName/lastName`, `personality`,
  `backstory`, `datingHistory/datingPreference/kinks/isVirgin`, `likes/dislikes`, `behavior`
  entries, `preferredStat` and traits.
  The same `Replier.info` reads flow through `bunnyfeedsReplies` when its repliers are used by
  that builder. These formatters write nothing. Returning a complete mutable `CharInfo` is
  unnecessary; expose the facts/derived affection and adapt the owned builder.
- `hasTexted` reads a conversation's `summary !== null` or any message whose `sender` is player
  or contact (`textingPrompt.ts:199`); thread text/summary content is not quoted by that test.
- `followingOf`/`reachOf` read only pid, character id and `traits` (Terminally Online); friends
  come from the pair map's `affinity` and active roster membership. `photoFriendHandle` reads
  pair friendship and the friend's `handle`, not her display-name knowledge.
- `reader()` calls `readerBlockOf` (`setting.ts:182`). That reads `playerFirstName`,
  `playerLastName`, `stats`, `bio`, `semesterIndex`, `calendar.season`, `gradesStanding`,
  `readerCold.since/incubation/mild/doseSlots` with current global slot, `transcript.aced`,
  and current academic return facts
  via `handedBackAcedCount(classRecords, classes, calendar, date, finalsScoresShown)`
  (record `midtermScore/finalScore`, class `slot`, calendar meeting/assessment dates).
  Love-life formatting iterates `chars` plus `alumni`, `characters[id].firstName`, and
  `charInfo[id].flags.isLover/harem`, `datingSince`, `brokeUpOn`, `leftFor`. The narrow hook
  should return the resulting READER block, not all those academic/cold/roster records.
- `sceneInProgress()` (`loop/stream.ts:119`) is exactly
  `currentSceneTranscript.length > 0 || sceneSummary !== null`; unlike `sceneActiveOf`, it
  does not include `busy`. Photo combines it with `awaitingInput` before its current save call.
- `noNsfwImagesOf` reads `settings?.noNsfwImages === true`; it returns false before settings
  arrive. `comfyAvailable` additionally reads settings' ComfyUI source/configured external
  endpoint/defer flag and setup `comfyReady`, plus the native web-build flag.

### C. Uses grouped by intent

“Existing” means use the named kit contract; “re-export” means the separate reader rounds,
not a designed hook in this proposal. “New” refers to Part 2.

| Intent | Mods and present work | Treatment |
|---|---|---|
| Show a known name, handle, profile face or reader identity | Bunnyfeeds thread/notifications; Photo history note and group captions. Read `firstName`, `lastName`, `charInfo.nameKnown`, `handle`, player first name/profile picture, portrait version. | New narrow identity/roster readers (§1); narrow `fullNameOf`, `UNKNOWN_NAME`, `profileUrl`, `useSpriteVersion` are reader-round candidates. `charKeyOf` already exists. Preserve the knowledge gate in UI; prompt identity and on-disk identity are different. |
| Read the clock and season, react in a mounted view | Both: comment arrival gates, headings, slot keys, gallery stamps. | New `gameClock`/`useGameClock` (§1). Pure date/slot helpers remain re-exports. Existing `slotSettled`/`gameEntered` cover their actual lifecycle work; neither mod subscribes globally to slot changes in these rows. A clock reader is not permission to start generation on each render. |
| Read posts/threads for UI, prompts, recovery and name reservation | Both: full stored feed arrays, comments, Photo metadata, conversations/messages, ids/senders/dates, thread progress. | New feed/message readers (§1). Keep stored and visible reads distinct: recovery must see held posts; prompt/UI reads apply visibility and comment arrival filtering. |
| Read relationship facts and roster membership | Both: friends, mutual contacts, cast pairs, reach; Bunnyfeeds also builds thread prompts and files memories. | New per-character social facts and friend-id readers (§1); pure NPC/relationship math belongs to reader rounds. No write to NPC affinity, relationship flags or character definitions was found in these rows. |
| Read the protagonist's prompt context | Bunnyfeeds reads stats, date, season and `reader()` for its own thread request. | New narrow reader prompt context (§1); a general scene-state/store export would be much broader. Existing scene-only `promptState.scene` captures mod data, not the native reader block for this separate request. |
| Check whether commenting is allowed | Bunnyfeeds uses `sceneActiveOf` and `epilogueOf`, and contact/stranger status. | New composed `canCommentOnPost`/`useCanCommentOnPost` (§1), checked again by the submit operation (§3). Re-exporting the predicates alone leaves the mod needing live native inputs. |
| Finish a visit when the phone closes; identify the open DM | Bunnyfeeds has two `open` transition subscribers; Photo reads `viewingCharId` for its message attachment. | New `phoneClosed` hook and attachment `charId` prop (§2). A pure re-export cannot supply the transition without handing out the phone store. Existing `phoneOverlay` is a mount spot, not a close notification. |
| Like a post | Bunnyfeeds calls the native toggle, changing `liked`/`likedOn`. | New intent operation (§3); no existing kit action. |
| Add player comments and generated answers | Bunnyfeeds appends to native `post.comments`, including ids, handles, slot, speaker, reply target, tags; stamps `threadedThrough`; banks held memories. Photo only creates initial comments in `fileFeedPost`. | Photo's initial comments: existing filing hook. Bunnyfeeds' later changes: new §3. Put its private markers under its own `ex`; do not export `patchPost(fn)`. |
| Mark notifications read | Bunnyfeeds sets `comment.read` and `bunnyboard.feedReadThrough`, including load-time settling. | Existing `saveField` for the watermark/read-id set, preferably no native read-flag writer (§3). This is an owned-data migration, not a new native notification system. |
| Apply what a feed exchange left a character remembering | Bunnyfeeds removes the previous feed memory and records the new dated one; also updates the copies touched by native `replaceMemory`. | New owned-source memory operation (§4). `slotSettled` supplies timing, not mutation authority; `recordField` alone cannot affect native affection/prompt memory. |
| Hold a newly filed post and reveal it after image completion/failure | Photo appends it itself, later replaces its Photo data and sets `outAt`; calls native first-contact nudge on reveal. | Extend existing filing custody plus record-slice writes (§3), rather than a second append path. `postVisible`/`postOutAt` remain authoritative. No generic BunnyBot writer is required for this nudge. |
| Attach/replace pending, failed or completed picture metadata | Photo changes only `photo` on existing messages/posts, not their text, sender or date. Reservation precedes the pending save; rerolls reuse a name. | `recordField` plus new scoped record-slice writes (§3); legacy `photo` migration remains Photo-owned. |
| Persist a settled asynchronous update | Photo calls `writeAutosave(loopState.decisionSave)` unless mid-stream without input. Bunnyfeeds currently has no immediate autosave for comments/notes/replies. | Integrate persistence into §3/§4. Do not expose `decisionSave`, `sceneInProgress` or a free-form autosave writer. Existing slice writes suffice when **all** affected data is the mod's save slice. |
| Draw a nonrepeating follower identity | Both use `drawMany` on core's shared feed handle and emoji bags, falling back to the same pools. | New `drawFeedIdentities(count)` (§5), returning only handles/emoji. It spends shared persistent grab bags, so it is not a plain pure-reader export. |
| Read content policy and local-art availability | Photo reads no-NSFW-images, renderer settings and setup status. | New boolean readers (§6); no settings/store export. Pure `comfyAvailable(settings,status)` alone cannot read the current configuration. |
| Ask the model for a thread answer and survive leave/retry | Bunnyfeeds uses the native loop group and `loopState.parkedWaiters`. | Existing `completeStructured`, `cancelCalls`, `currentRun`/`runStale`, `modState` cover mod-owned calls/state. Use a mod-owned AbortController/retry wait. No native loop-state hook (§7). |

The common surface is the clock, identities/social facts, stored posts and messages, record-slice
write safety, and follower identity draws. Only Bunnyfeeds needs player thread submission,
phone-close handling and native memory commits. Only Photo needs message attachment writes,
held-post release and the local-art/content-policy readers. A “shared” hook does not mean both
mods must gain every write permission.

### D. Writes outside a mod's own data

| Writer | Native data affected now | Timing and risk |
|---|---|---|
| Bunnyfeeds `leavePlayerComment`, `fileReplies` | `charInfo[poster].feed[].comments` array; Bunnyfeeds adds `player`, `charId`, `replyTo`, `tags`, `read` fields to comments. | On send and on asynchronous reply; no explicit autosave. Generic base fields (`id`, `handle`, `emoji`, `text`, `at`) are real feed data even when extra thread fields are owned by Bunnyfeeds. A reply must not overwrite another reply round or reattach to a deleted post. |
| Bunnyfeeds thread/memory helpers | Post `threadedThrough`, `heldMemories`. | Stamp after a completed call; hold until the answer's visible slot, then remove due entries. These are owned extension data and can migrate to post `ex`. |
| Bunnyfeeds notification helpers | `bunnyboard.feedReadThrough`, post comment `read`. | On individual/all-read and `gameEntered`; owned extension data, suitable for save `ex` as watermark + read ids. Do not claim these are native game rules merely because they currently live on native records. |
| Bunnyfeeds memory filing | `charInfo[charId].memories` through `recordMemory`/`replaceMemory`. | At due-slot filing. This changes native relationship calculations. Existing replacement updates memory holders via `withMemoryReplaced` (`shared/relationship.ts:123`); a direct splice is not equivalent. Matching ownership by a prose suffix risks deleting an unrelated memory. |
| Bunnyfeeds like | Post `liked`, `likedOn` (set to current date, both removed on unlike). | User click; likes count itself is not changed by this toggle. |
| Photo held post | Appends a complete post to `charInfo[charId].feed`, setting Photo data; filing sets `likes`, optionally `comments`, `held`, `featured`. | Initial filing awaits reservation. Direct append occurs before the native caller's stale-run check; avoid preserving this ownership gap in a public API. |
| Photo attachment/recovery | Message/post `photo`: tier, scene, file, pending/failed, held/outAt, optional friend id. | Reservation, completion, timeout, reroll, reload recovery. Set-or-delete of this field preserves the rest of the record today. Most completion guards compare only playthrough id; loading an older save in the same playthrough can still race a late render. Initial DM reservation additionally checks `loads` and message presence/photo absence. |
| Both identity draws | Shared `grabBagStore.bags['feed.handles'/'feed.emoji']`, then `data/grabbags.json`. | Filing and thread replies. Global session history, intentionally independent of save/load/rewind. Do not reset it as part of loading a save. |
| Photo release nudge | Indirect `bunnybotFirstPostNudgeSent` and BunnyBot conversation/messages/unread via native nudge callback. | Only on revealing a held contact post, after intro and once. Keep this within native release logic. Photo-specific educational tips are deferred, not designed here. |

Neither mod writes the native clock, stats, settings, setup state, mod switches, roster,
character art definitions or NPC relationship map through these rows. The stores they import
would permit much more than their actual uses. Read-only TypeScript types alone would not make
live mutable store objects safe to hand over.

## Part 2 — Draft proposal for morrowkiln and the owners

The smallest useful design is six contract groups below, plus migration to the already shipped
LLM/lifecycle APIs. These are groups of small methods with distinct permissions, not one large
store-shaped interface. All renderer exports are from `@vx/modkit/renderer`, declared as
`renderer:<name>`; a hook registration names its plain hook key. DTOs/types belong in the same
entry (shared saved record types remain in `@vx/modkit/shared`). Names and error codes are
provisional. Prefer composition with existing `recordField`, `saveField`, and `modState`.

### 1. Read only the facts the caller needs

Provisional signatures:

```ts
gameClock(): Readonly<{ playthroughId: string | null; date: number; time: TimeSlot; season: Season }>
useGameClock(): ReturnType<typeof gameClock>
readerIdentity(): Readonly<{ firstName: string; profilePicture: string | null }>
useReaderIdentity(): ReturnType<typeof readerIdentity>
rosterIds(): readonly string[]
characterFor(charId: string): Readonly<Character> | undefined
useCharacterFor(charId: string): ReturnType<typeof characterFor>
characterSocial(charId: string): Readonly<CharacterSocial> | undefined
useCharacterSocial(charId: string): ReturnType<typeof characterSocial>
friendsOf(charId: string): readonly string[]
standingBetween(a: string, b: string): 'friend' | 'enemy' | 'barely'
feedPosts(charId?: string): readonly FeedPostRef[]
useFeedPosts(charId?: string): readonly FeedPostRef[]
conversationMessages(charId: string): readonly MessageRef[]
useConversationMessages(charId: string): readonly MessageRef[]
readerPromptContext(): Readonly<{ stats: PlayerStats; readerBlock: string }>
modOptionOn(modId: string, optionId: string): boolean
canCommentOnPost(ref: PostRef): boolean
useCanCommentOnPost(ref: PostRef): boolean
```

`PostRef = { charId, postId }`; `FeedPostRef = { charId, post: SocialPost, revision }`;
`MessageRef = { charId, message: ChatMessage, revision }`. `revision` is an opaque,
nonpersisted core token. `CharacterSocial` includes its memory-source revision for §4.
`CharacterSocial` is an explicit DTO: `nameKnown`, `handle`, native relationship flags,
memories (`memories`, `textMemory`, `jealousyMemories`, `giftMemories`), derived `affection`,
`romanceScenes`, `upperHalves`, `moodCycleOffset`, and `hasTexted`. Compute affection natively
from the current date/traits/liked-post/break-penalty facts described in Part 1B, rather than
handing out a hidden `CharInfo` spread or embedding another feed in this DTO. Feed lives in
`feedPosts`, not in that DTO. `characterFor` is the roster's character snapshot, whose full
appearance/wardrobe/traits are needed by Photo rendering and whose personality/behavior is
needed by Bunnyfeeds prompts; it exposes no editing, disk or store methods. `rosterIds`
mirrors the active `chars` iteration here, not an accidental union with alumni; `characterFor`
and per-id feed/message reads must still resolve saved alumni records where retained.

Implement `friendsOf` and `standingBetween` using the game's pair rules rather than returning
its whole NPC map. Photo's pure `groupPhotoPair` can receive pair facts constructed for the
few cast ids it actually considers. These reads must include relationship changes from the
same live snapshot as the roster facts when building a request. Build each request
synchronously before awaiting; capture clock, run and post revision with it. If separate
readers prove unable to provide that coherent synchronous view, add an internal snapshot
scope, not a public whole-store selector.

Return detached deep-readonly data (or deeply frozen stable projections), with stable snapshot
identity until relevant facts change. Reactive counterparts subscribe only to their inputs,
unsubscribe on unmount and notify on load/reset. For ids/standing/prompt context used only in
imperative code, no new React hook is required yet. `undefined`/empty arrays cover missing
records; no reader creates a character or conversation. `feedPosts` returns **stored** posts,
including held ones, explicitly so recovery/name-reservation work. UI/prompt code filters
with existing `postVisible` and `shownComments`; it must not accidentally render hidden/future
content. A getter is never a write capability.

`canCommentOnPost` composes post existence/visibility, contact/not-blocked, scene-active and
epilogue rules. The native scene-active rule reads `busy`, `currentSceneTranscript.length`
and `sceneSummary`, rather than treating `awaitingInput` as “free roam”. Recheck on submission.
Knowledge gates still govern names/faces shown by a mod; these APIs are not permission to
reveal an unmet girl's identity. The existing Bunnyfeeds `CommentFace` renders any comment's
`charId` without checking `nameKnown`, even though notification labels do gate it. That current
UI behavior is for the owner to reconcile, not a reason to broaden a core identity contract.

Existing prompt callbacks already receive a character/cast/date/input; consume those first.
For scene/DM recent-post blocks, compute from captured request-time facts rather than read
changing live state again during asynchronous formatting. `promptState.scene` can capture
Bunnyfeeds' scene contribution now; equivalent DM/intro capture is not currently available.
Do not silently invent it or claim it is required just to re-export a formatter.

**Rows enabled:** all live-read portions of the `gameStore` rows in Appendix A, plus
`BunnyfeedsThread → textingLoop` and `bunnyfeedsThreads → loop/promptState`'s `reader`.
The write portions remain until §§3–4; other imports in a compound row must also migrate.
This is designed access because exporting `useGameStore`, `useSettingsStore`, or native
predicates with missing live inputs would not narrow authority.

### 2. Supply phone lifecycle and attachment identity at their existing spots

```ts
registerHooks(id, { phoneClosed: () => void }) // new hook key: phoneClosed
// Extend existing messageAttachment props:
{ charId: string; message: ChatMessage }
```

Run `phoneClosed` exactly once for an actual `open: true → false` transition, after native
phone state changes. No calls for closing a nested post popup or changing tabs. Notify enabled
mods in normal hook order; callbacks cannot change the native phone store. On leave/load, reset
mod UI/visit state via `modState`/existing `gameEntered`; do not initiate a new thread request
for the run being discarded. Document whether leave suppresses the close hook (recommended).
Bunnyfeeds' own post-popup close continues calling its own visit-flush function; the phone
hook only replaces the two direct phone-store subscriptions. Errors from one callback must
not prevent closing the phone or notifying another mod.

Pass the conversation's actual `charId` to `messageAttachment` from the native render site.
Do not infer identity from whichever conversation is open when a completion or click runs.
Photo then uses the prop through `MessagePhotoBubble`. Existing callers ignoring the new prop
continue to work. No new general phone-state reader is needed for these demonstrated uses.

**Rows cleared:** `modEntries/bunnyfeeds → bunnyboardStore`,
`components/BunnyfeedsThread → bunnyboardStore`, `components/PhotoBubble → bunnyboardStore`.
An existing overlay mount cannot observe a transition for a lazy/unmounted component, and a
re-export of the store gives unrelated UI mutation access.

### 3. Scoped post/message writes, integrated with persistence

Use one native transaction implementation underneath the following narrow operations. These
are not APIs for passing a store updater, arbitrary JSON paths or a replacement whole record.

```ts
togglePostLike(ref: PostRef, guard: RecordGuard): Promise<Result<null>>
submitPostComment(ref: PostRef,
  input: { text: string; replyTo?: string; tags?: readonly string[] },
  guard: RecordGuard): Promise<Result<{ commentId: string }>>
appendThreadReplies(ref: PostRef, replies: readonly PostComment[],
  ownPostData: unknown, guard: RecordGuard): Promise<Result<null>>
writePostData(ref: PostRef, ownData: unknown, guard: RecordGuard): Promise<Result<null>>
writeMessageData(ref: { charId: string; messageId: string },
  ownData: unknown, guard: RecordGuard): Promise<Result<null>>
releasePost(ref: PostRef, ownData: unknown, guard: RecordGuard): Promise<Result<null>>
```

`RecordGuard` contains the `currentRun()` token and an opaque record revision obtained with
the read, plus the caller's expected own slice where applicable. An explicit declared
`modId` may be required for attribution by the loader's API convention; it must be verified
against the attributed caller and not treated as authority supplied by the argument. All
operations are owner-bound and require an enabled caller; replies require the current comment
owner (`ownsPostComments`). Read tokens must be available from §1's DTOs, without adding
transient revisions to saves.

`writePostData`/`writeMessageData` install only the caller's `ex[id]` on an existing record.
Reject non-JSON values, invalid ids, oversized payloads and unregistered ownership. They use
the same versioning/legacy normalization rules as `recordField`, applying
`recordField.with` internally; accept the owned slice value, not a whole modified post.
`null` as owned data is distinct from removing a native record. Photo uses these for its
attachment state. A finite declared legacy list permits retiring only its old `photo` key
when migrating, never arbitrary native keys. Do not give Photo a method to rewrite message
text/sender/date or remove comments. Add an explicit record-target migration contract rather
than assume `saveField.normalize` recursively visits records (it does not).

`submitPostComment` creates the native id/slot/player identity, trims text, checks contact,
visibility and scene/epilogue state, validates reply target belongs to that same post and is
visible, and validates tagged contacts. Add optional `ex` to the native `PostComment` record contract (it currently has no declared
`ex`); store Bunnyfeeds-owned speaker/thread metadata in that slice. Retain legacy fields for
reading/claims during the transition, without teaching native code Bunnyfeeds reply caps. `appendThreadReplies`
validates structure, unique ids, in-thread reply targets and caller ownership, atomically
appends the accepted round and changes that caller's post data (`threadedThrough`, held
memories). The mod remains responsible for its crowd/cap/joiner rules and LLM sanitization;
core does not acquire Bunnyfeeds' conversation design. A stale round cannot stamp a newly
changed thread as answered. Expose a revision-checked batch form only for the existing
multi-post reply round if needed to commit its linked held-memory payload atomically; the
batch remains a list of these operations, not a general transaction callback.

For new held posts, **extend `fileFeedPost` rather than append from Photo**: store the prepared
Photo slice on `filing.post`, and return an explicit `deferVisibility`/held-custody indication
which tells the native caller to append the hidden post exactly once after its run check.
This deliberately changes today's `held` meaning (“mod files itself”) and needs a compatible
addition, not a reinterpretation that breaks other mods. Keep `featured` teaser behavior.
`releasePost` commits the new own slice and requests native contact-first-post notification;
core checks visibility before/after, stamps release ordering as agreed, and calls its private
nudge once only. It never accepts arbitrary bot text. Existing `postVisible`/`postOutAt`
continue reading the owned metadata; the core operation need not understand image tiers.
A failed render can release with `failed`, and a late successful render can update the same
attachment only when its revision/file generation still matches. Timed-out does not mean
cancelled. Compatibility must allow Photo to update its data while still visibly retaining a
post's original content and comments.

Current off-state visibility is worth preserving explicitly: `heldPosts.ts:16` treats a held
Photo post as readable text while Photo Feature is off; the stored `held` bit remains, so
turning it on hides that post again until drawing/release. Disabling generation alone is
different from disabling the whole mod. Do not “repair” a held bit away just because Photo
is disabled, and do not interpret passive text visibility as permission to render or notify.

For notification reads, use Bunnyfeeds' `saveField` for `{ readThrough, readCommentIds }` and
its handle's `write` at safe points. No new core `markRead` operation is justified. Migrate the
old bunnyboard watermark and per-comment flags with a scoped native-to-owned-data transition;
`saveField.legacy` only sees **top-level** keys, not `bunnyboard.feedReadThrough`. Reads may
recognize both representations until migration succeeds. Carry/trim ids and adjust the
watermark under the owner's chosen semester behavior, retaining the current clamp semantics.

#### Save-lane contract

Each asynchronous operation returns a `Result` that distinguishes missing/stale, off/foreign,
unsafe/waiting and disk failure. Serialize with native saves; validate run, revision, switch
and target at request and execution. No no-op should recreate a deleted message/post. At an
open safe point, prepare a detached draft, persist once and publish only the changed targets
once successful. A disk failure must leave the live records and owned progress markers
unchanged. Do not replace entire `bunnyboard`/`charInfo` snapshots after an await.

Image completion commonly occurs during streaming. Define a bounded pending-operation queue
for these metadata updates, keyed by run + target + attachment generation, drained at the
next native safe save point. Return an explicit deferred acknowledgement or keep the promise
pending until the commit; never report “saved” before it is durable. It must be included in
the next native decision/boundary snapshot **before** that save is serialized, not as a later
write of an old `decisionSave`. On leave/reload, reject/drop the old run's operations; recover
from the already-persisted pending filename on next entry. This queue belongs to core's save
coordination, not `modState` masquerading as a durable log. Before rendering, the reserved
filename/pending record must have committed, or the file may become orphaned without a
recovery pointer. In-flight UI can be mod-owned optimistic state until acknowledgement.

Synchronous `fileFeedPost` decoration and `slotSettled` changes already lie inside a native
boundary transaction; keep an internal staging path there without deadlocking by awaiting
another safe point. Public asynchronous writes must not offer a flag to bypass safety. This
is why a bare `requestAutosave()` re-export is insufficient: it cannot bind the record update,
owned marker and safe scene snapshot into the same durable change.

**Rows enabled/cleared together with §1:** Bunnyfeeds thread `gameStore` (like),
`bunnyfeedsThreads → gameStore` (comments/progress), `bunnyfeedsNotes → gameStore` (owned-state
migration), Photo `localPhotoStore → gameStore`, `photoPost → gameStore`,
`photoRecovery → gameStore`, `photoTurn → gameStore`, and the three
`localPhotoStore → loop/{saves,state,stream}` rows. Pure reads in these rows still need §1;
settings/setup portions still need §6. Initial Photo comments/likes already use `fileFeedPost`
and need no new write method.

### 4. Give native memory an owned source, not a prose-matching splice

```ts
setCharacterMemory(sourceKey: string, charId: string,
  memory: { date: number; type: MemoryType; desc: string } | null,
  guard: RecordGuard): Promise<Result<null>>
// Extend existing slotSettled context with a synchronous boundary-scoped form
// of the same operation, limited to that pending boundary draft.
```

Source identity is `(attributed modId, sourceKey, charId)`; no caller can replace another
source's memory. Bunnyfeeds uses one key (for example `feed`) per character, preserving its
“newest replaces last” policy. Store source identity as durable memory `ex` metadata, not a
regular expression over `desc`. Native memory remains in native memories and participates in
affection/prompt rules; the mod owns only the source tag and its selection of content. Bound
and validate types/date/text, reject absent characters and preserve native reader-voice and
replacement-copy rules. A `null` deletes only this source's memory, never a caller-supplied
arbitrary match. No flag/stat/affinity setter is needed.

At `slotSettled`, synchronously stage due memories **and consume their held entries** in the
same boundary draft; no promise may finish later and mutate the next slot. Away from a native
boundary, use the same save-lane/revision/Result guarantees as §3, with an atomic owned-state
update consuming the held entries. A per-memory application id makes replay/retry idempotent.
Do not delete the previous memory and fail before the new one is durable.

**Rows:** the write half of `bunnyfeedsMemory → gameStore`; combined with §1 and the existing
option API, that row can disappear. `recordField` only tags a record; `slotSettled` only chooses
when to act. Neither grants a safe native memory replacement today. Legacy memories selected
by the existing suffix need one narrowly scoped transition with owner-reviewed matching and
ambiguity preservation; never apply that broad regex on every future replacement.

### 5. Draw identities through the existing global bags

```ts
drawFeedIdentities(count: number): readonly { handle: string; emoji: string }[]
```

One synchronous renderer service; native owns its pools, supporter marble keys, `feed.handles`
and `feed.emoji` bag ids, hydration and coalesced persistence. Bound count to an agreed limit;
return independent values, no bag objects, reset/load/save methods or caller-chosen bag ids.
Preserve current batch distinctness and pool fallbacks; a thread follower replying again keeps
its existing handle/emoji instead of drawing again. No promise or network call is introduced
into synchronous post decoration. If native bag hydration failed, preserve native session-only
behavior and error reporting rather than replace unread disk data.

**Rows cleared:** `bunnyfeedsReplies`, `bunnyfeedsThreads` and `photoComments` each have both a
`feedRandoms` and `grabBagStore` row: six rows. `fallbackHandleOf`/`rollPostLikes` are separate
stateless exports (they roll randomness but do not access a store). A general `drawMany`
store export would let mods spend/reset unrelated global bags. Re-exporting the pools alone does not supply the persistent draw. The pure pools can be
listed in reader rounds if independently useful, but these uses need only this result service.

### 6. Ask policy and readiness, not settings

```ts
noNsfwImages(): boolean
useNoNsfwImages(): boolean
canRenderLocalImages(): boolean
```

Read the same native policy as `noNsfwImagesOf` (including before settings load).
`canRenderLocalImages` composes `comfyAvailable` from the current settings and setup status:
false on web, false before settings, true for configured external ComfyUI without asserting
that it is reachable, otherwise verified managed install and not deferred. No setup install
control, URL, model, path, credentials or settings update API is exposed. Only imperative
availability is used in the scoped files; defer a reactive availability hook until a caller
actually needs it. Photo combines these facts with its own switches/options, as it does now.

**Rows cleared:** `localPhotoStore → settingsStore`, `localPhotoStore → setupStore`,
`photoPost → settingsStore`, `photoSwitchHooks → settingsStore`. `lessNsfwText` is already
available for Bunnyfeeds and is not this image policy. Re-exporting a pure readiness function
still requires the private live inputs, so it does not solve the boundary.

### 7. Calls, cancellation and temporary state: reuse the kit

Do not add a renderer hook exposing `LOOP_LLM_GROUP`, `parkedWaiters` or `decisionSave`.
Bunnyfeeds should use `completeStructured`/`cancelCalls` under its own operation group,
`currentRun`/`runStale` before and after awaits, and mod-owned retry sleeps cancellable by its
AbortController. The existing generic completion path already returns the result envelope;
move its `completeFeedThreads` transport to that path, retaining its own schema and sanitation.
The specific `window.api.llm` call is not an import-boundary row, so clearing the imports alone
would not complete move-out. No new LLM API is proposed here.

Put `out`, `askAgain`, visit flags and open post state in Bunnyfeeds' single game-lifetime
`modState`. Put Photo's per-run asked/settled slot, held-work orchestration and lightbox state
in its own state. A reset must mint fresh mutable sets/maps rather than mutate the reusable
`initial` object. Session-level render bookkeeping may intentionally survive a load to avoid
duplicate disk work, but can never authorize writing into the newly loaded run. Do not
reconstruct the game's internal retry-waiter list in mod state.

**Rows:** `bunnyfeedsThreads → loop/state`: `currentRun`/`runStale` already in kit, remaining
loop internals removed by migration. Its `loop/promptState` row uses existing `lessNsfwText`
and §1's reader context. `bunnyfeedsMemory → modsStore`: replace
`optionOn(useModsStore.getState().switches, ...)` with existing reactive `useModOption` in UI
or the shared `modOn`/`optionOn` rules with a narrow imperative option reader if no option
snapshot is otherwise available. A component hook cannot be called inside `feedStatusLines`;
add `modOptionOn(modId, optionId): boolean` to renderer as the **imperative counterpart** to
`useModOption` (new small reader in the §1 PR). It reads main-menu switches/options with the
same `optionOn` defaults as native `useModOption`; it does not imply that the mod is enabled.
Call `modIsOn` separately where the hook dispatcher has not already gated execution.
It returns no switches object. This is separate from Phase 1's main-side option reader.

### 8. Save integrity and compatibility checklist

| Boundary | Required behavior of the proposed contracts |
|---|---|
| Save/load | Preserve unknown native and `ex` fields and other mods' slices. Persist attachments/progress/held consumption atomically, publish after success, and recover only from committed pending pointers. Record `ex` migration is per target and versioned; top-level `saveField.legacy` is not recursive. Report/refuse malformed slices without destroying the saved original. |
| Same-playthrough reload | Guard with a run/load generation and record revision, not only `playthroughId`. A pending render may complete on disk, but cannot write into a save loaded since it started. A deleted target stays deleted. |
| Rewind/interjection | A displayed-line rewind is not itself permission to overwrite a scene snapshot. Deferred metadata commits use the native decision point selected when core drains the queue; a cut drops obsolete target revisions/leases. A restored decision point must invalidate old write revisions even if the record id/file repeats. Native slot replay/Scene Creator writes are refused. |
| Retry/duplicates | Reply round ids, memory application ids and attachment generations prevent double appends, duplicate memories, repeated nudges or stale failed-state overwrites. A timeout can be followed by success for the same generation; an older render cannot overwrite a newer reroll. A whole rejected round leaves owed work available for retry. |
| Switch off | Stop prompts, new comments, memory application and new renders; retain stored posts/comments/pictures, owned slices and files. Recheck switches on queued work. Whether already-running Photo completion may perform maintenance while off must be decided explicitly; default ordinary mod writes to refused, then recovery can settle committed pending data when enabled again. Do not clear held work on disable. |
| Comment ownership | `ownsPostComments` controls new comment generation/appends, not deletion. Preserve foreign/claimed comments and the losing owner's saved data. Photo must not regenerate a second initial crowd while Bunnyfeeds owns comments. |
| Carry | Migrate Bunnyfeeds' `threadedThrough` and held-memory slots by twice the day offset through `registerPostCarry`, including off-state migration. Native comment `at` still shifts. If thread metadata moves into `ex`, update the adapter to read it there; do not assume core knows those clocks. Carry Photo files as Phase 1 describes where a separate-playthrough extension needs it; native semester continuation retains the same file root. |
| Global bags | Draw history remains global and non-rewound. A failed/rejected save transaction may have spent a handle already, as current code does; no promise of transactional rollback of `grabbags.json` is made. If exact retry identity matters, bank the rolled identities in the request work rather than redraw. |
| Web | Clock/readers, feed/comments/memory operations and bag draws have the same contracts on web through native persistence. Local-image availability is false; no ComfyUI relay. Existing shared comments/body behavior may still run. |

### 9. Suggested order of work

Every core PR is additive and includes manifest capabilities, kit bridge/host wiring, API
reports, docs and focused save-integrity coverage. Rows clear only in the owner's subsequent
migration; do not delete allowlist entries merely because a hook was added. Keep each group
independently reviewable; the persistence group is deliberately split.

| PR | Contract and dependency | Rows it enables (source names refer to Appendix A) |
|---|---|---|
| Separate reader rounds (#206 / `hooks/mod-readers-2`) | Pure readers/formatters/types only; coordinate exact exports before duplicating them. | `FEED_PAGE`, `isFeedContact`, `newestFirst`, `shownComments`, `fallbackHandleOf`, `rollPostLikes`, `fullNameOf`, portrait helpers/unknown label, validators; already-exported `charKeyOf` and available shared types need import migration only. No store re-export. |
| `hooks/game-clock-readers` | §1 clock/reader identity/prompt context + imperative `modOptionOn`; use existing run guards. | Read portions of most `gameStore` rows, `bunnyfeedsMemory → modsStore`, and `bunnyfeedsThreads → loop/promptState` after remaining readers land. |
| `hooks/social-record-readers` | §1 per-id character/social/feed/message/friend facts, revisions and comment eligibility. | Remaining read portions of all scoped `gameStore` rows; `BunnyfeedsThread → textingLoop`. Keep the snapshot/revision contract in this review. |
| `hooks/phone-close-context` | §2 close lifecycle and attachment `charId`. | Three `bunnyboardStore` rows, listed in §2. Independent of record writes. |
| `hooks/feed-identities` | §5 one native draw service. | Six `feedRandoms`/`grabBagStore` rows. Independent of save writer. |
| `hooks/local-image-readers` | §6 policy and availability booleans. | Four settings/setup rows. Independent of feed writes. |
| `hooks/record-slice-writes` | §3 post/message owned-slice commits, native save-lane deferral, revisions and legacy retirement. Requires social-record reader tokens. | Photo's attachment writes and `localPhotoStore → loop/{saves,state,stream}`; combined with readers clears `localPhotoStore`, `photoTurn`, `photoRecovery` game-store rows. This review should focus on stale completion, save failure and streaming. |
| `hooks/held-post-release` | §3 additive native custody in filing, release/nudge and like operation; builds on record writes. | `photoPost → gameStore`, `BunnyfeedsThread → gameStore`'s like action. Include the other reads before removing either row. |
| `hooks/feed-thread-writes` | §3 checked submission/append-round with atomic owned progress. | `bunnyfeedsThreads → gameStore`; owned notification migration clears `bunnyfeedsNotes → gameStore`. Respect current comment owner. |
| `hooks/sourced-memories` | §4 source identity + boundary-scoped commit/held consumption. | Write half of `bunnyfeedsMemory → gameStore`; readers complete the row. Keep legacy matching transition in a separate owner migration. |
| Owner migration using existing APIs | §7, `recordField`/`saveField`/`modState`, package owned prompts, move direct transport. | `bunnyfeedsThreads → loop/state` and remaining data/import portions above. Photo tips and desktop Phase 1 work stay separate. |

Suggested implementation validation, not tests added by this report: fail an autosave before
publish; load the same save during reservation/render/retry; delete/revise the target during a
reply; let a timed-out image finish; switch off at enqueue and execution; interject while
metadata is deferred; replay a boundary twice; preserve foreign slices and comments; carry
post-local clocks with both mods off; try web save failures. These defend data integrity rather
than asserting generated wording, labels or asset inventories.

### 10. Questions for morrowkiln (core and kit only)

1. Is the proposed split of per-id readers acceptable, or is a read transaction/snapshot scope
   already planned? Which existing reader-round exports should this proposal treat as settled?
2. May the kit provide revision-checked record `ex` commits and a narrowly declared legacy-key
   retirement path? How should a nested legacy key such as `bunnyboard.feedReadThrough` be
   made available without allowing arbitrary native writes?
3. Should asynchronous metadata commits wait for the next native safe point or acknowledge a
   deferred operation explicitly? Which boundary owns draining them before a decision/slot save?
   This must be a core promise, not a Photo-specific guess at `decisionSave`.
4. Is an additive native “append now, hidden” filing outcome preferable to the current mod-owned
   `held` custody? Can native release own the first-contact nudge and release ordering while
   visibility/out-time remain mod-defined?
5. Can source-owned memory commits be staged synchronously through `slotSettled`, including
   atomically consuming the mod's held state, without broadening the existing hook to a store?
6. What is core's rule for a load or decision restore invalidating record revisions, and for
   `phoneClosed` during leaving/replay? Can one game's late work ever be accepted into another
   load generation? The recommendation here is no.
7. Does the kit want a single native feed-identity draw service, retaining the shared supporter
   pool, rather than public access to global bags? What maximum batch size should its contract use?
8. Should metadata-maintenance writes while disabled be a separate declared capability, or must
   every such completion wait for re-enable/recovery? Existing off-state persistence guarantees
   do not themselves authorize running new mod work while off.

### For the owners

These are behavior choices, not questions for core to decide:

- Bunnyfeeds: preserve the current one-feed-memory-per-girl policy and prose suffix display,
  or change it; decide which ambiguous legacy suffix matches to adopt. Choose when player
  comments, generated rounds and notification reads should become durable, and how to handle a
  stale round (discard/retry). Decide read-watermark carry and whether unmet girls' faces should
  be shown in comments; the current knowledge rule and current `CommentFace` differ.
- Photo: choose whether a disabled in-flight render should finish as a file, whether a pending
  frame is settled while off or only on re-enable, and how a late success interacts with reroll.
  Keep held-post visibility and educational photo tips separate. Preserve PNG/WebP and pending
  filename recovery during the Phase 1 file migration.
- Both: choose the on-disk `ex` migration version and backwards-compatibility window, keep only
  owned metadata private, and retain published native comments/memories when switched off.
  Sharing native hook mechanics does not require sharing crowd limits, image policy, prompts
  or UI decisions.

## Research validation

- Checked all 69 appendix row identities against the pinned allowlist, each import line against
  its source, and every imported-name list against the declaration. Appendix B separates whole
  row removal from partial replacement and records the deferred scopes.
- `npm run typecheck`: passed (node, web and test projects).
- `npm test`: 4,248 passed, four skipped, one failed; 351 test files passed, three skipped,
  one failed. The remaining failure is
  `test/mainServices.test.ts:182`, `getComfyOutputFilePath > refuses every name that lands
  anywhere else, and refuses it permanently`: expected `COMFY_OUTPUT_PATH_INVALID`, received
  no exception. On this Linux host the native `path.resolve` check treats the test's Windows
  absolute filename as a relative name. `src/main/paths.ts` and this test are unchanged by this
  report. No code fix was made.
- The first test attempt lacked Electron's binary and executable permission on the installed
  7-Zip dependency. Finished dependency setup and reran the full suite; the counts above are
  from that rerun, not the failed setup attempt. Only ignored dependencies were affected.
- `git diff --cached --check`: passed. The sole tracked change is this report. No runtime
  verification was necessary for a research-only document; proposed hook behavior remains a
  contract to agree and implement in later `hooks/*` PRs.


## Appendix A — Every matching allowlist row

`Rnn` identifies a row in this report only. Each heading is the exact allowlist pair; the
source line is the import declaration’s first line. Consumer anchors in the notes show when
the names are used. All paths are repository-relative. “New §n” refers to Part 2.

### R01 — `src/main/localPhotoBackup.ts -> @shared/characterRules`

Source: `src/main/localPhotoBackup.ts:5`. Imports: `{ SAFE_CHAR_ID }`.

Desktop Phase 1, included for accounting only. `SAFE_CHAR_ID` validates character path components; `SAFE_NUMERIC_ID` validates playthrough components before archive/protocol file access. No window game-state read/write. Plain shared validator re-export in separate rounds; no feed/game-state hook. See Phase 1 for guarded file access.

### R02 — `src/main/localPhotoBackup.ts -> @shared/saveRules`

Source: `src/main/localPhotoBackup.ts:7`. Imports: `{ SAFE_NUMERIC_ID }`.

Desktop Phase 1, included for accounting only. `SAFE_CHAR_ID` validates character path components; `SAFE_NUMERIC_ID` validates playthrough components before archive/protocol file access. No window game-state read/write. Plain shared validator re-export in separate rounds; no feed/game-state hook. See Phase 1 for guarded file access.

### R03 — `src/main/photoIpc.ts -> @shared/types`

Source: `src/main/photoIpc.ts:3`. Imports: `type { Character }`.

Type-only import: type { Character }. Erased at runtime; no fields read/written or timing. Import available types (`Character`, `ChatMessage`, `Result`) from kit/shared; missing aliases (`MemoryType`, `CharFlags`, `CustomOutfitSlot`) belong to the type re-export round. No designed runtime hook. Desktop/preload instances remain Phase 1 scope.

### R04 — `src/main/photoProtocol.ts -> @shared/characterRules`

Source: `src/main/photoProtocol.ts:4`. Imports: `{ SAFE_CHAR_ID }`.

Desktop Phase 1, included for accounting only. `SAFE_CHAR_ID` validates character path components; `SAFE_NUMERIC_ID` validates playthrough components before archive/protocol file access. No window game-state read/write. Plain shared validator re-export in separate rounds; no feed/game-state hook. See Phase 1 for guarded file access.

### R05 — `src/main/photoProtocol.ts -> @shared/saveRules`

Source: `src/main/photoProtocol.ts:6`. Imports: `{ SAFE_NUMERIC_ID }`.

Desktop Phase 1, included for accounting only. `SAFE_CHAR_ID` validates character path components; `SAFE_NUMERIC_ID` validates playthrough components before archive/protocol file access. No window game-state read/write. Plain shared validator re-export in separate rounds; no feed/game-state hook. See Phase 1 for guarded file access.

### R06 — `src/main/services/localPhotoService.ts -> @shared/characterRules`

Source: `src/main/services/localPhotoService.ts:4`. Imports: `{ SAFE_CHAR_ID }`.

Desktop Phase 1, included for accounting only. `SAFE_CHAR_ID` validates character path components; `SAFE_NUMERIC_ID` validates playthrough components before archive/protocol file access. No window game-state read/write. Plain shared validator re-export in separate rounds; no feed/game-state hook. See Phase 1 for guarded file access.

### R07 — `src/main/services/localPhotoService.ts -> @shared/types`

Source: `src/main/services/localPhotoService.ts:21`. Imports: `type { Character }`.

Type-only import: type { Character }. Erased at runtime; no fields read/written or timing. Import available types (`Character`, `ChatMessage`, `Result`) from kit/shared; missing aliases (`MemoryType`, `CharFlags`, `CustomOutfitSlot`) belong to the type re-export round. No designed runtime hook. Desktop/preload instances remain Phase 1 scope.

### R08 — `src/preload/photoApi.ts -> @shared/types`

Source: `src/preload/photoApi.ts:2`. Imports: `type { Character }`.

Type-only import: type { Character }. Erased at runtime; no fields read/written or timing. Import available types (`Character`, `ChatMessage`, `Result`) from kit/shared; missing aliases (`MemoryType`, `CharFlags`, `CustomOutfitSlot`) belong to the type re-export round. No designed runtime hook. Desktop/preload instances remain Phase 1 scope.

### R09 — `src/renderer/components/BunnyfeedsNotifications.tsx -> ../stores/feedView`

Source: `src/renderer/components/BunnyfeedsNotifications.tsx:6`. Imports: `{ FEED_PAGE }`.

`FEED_PAGE` is the pagination size (30), read on render for mounted rows and Load more (:55, :63). No feed/store access or writes. Plain renderer re-export in reader rounds, or keep a mod-owned page-size choice if owner prefers.

### R10 — `src/renderer/components/BunnyfeedsNotifications.tsx -> ../stores/gameStore`

Source: `src/renderer/components/BunnyfeedsNotifications.tsx:7`. Imports: `{ useGameStore }`.

Render subscriptions at :47–59, :113 and :142–154 read `charInfo[*].feed` (post id/comments, filtered by `postVisible` through `feedNotesOf`), `date`, `time`, `bunnyboard.feedReadThrough`, `calendar.season`; per-row `charInfo[comment.charId/posterId].nameKnown`, `characters[id].firstName/lastName`, poster `handle`. `unreadFeedNotesOf` reads reply `at/read/replyTo/player/charId` against the watermark. No native writes here; clicks delegate to the owned notification helpers. New §1 readers; §3 owned-state migration removes the watermark dependency.

### R11 — `src/renderer/components/BunnyfeedsNotifications.tsx -> @shared/types`

Source: `src/renderer/components/BunnyfeedsNotifications.tsx:4`. Imports: `{ fullNameOf, type Season }`.

`fullNameOf(character)` reads `firstName/lastName` for rendered notification/thread author labels and tag matches. No store access or writes; plain shared re-export in separate rounds. Mixed `Season` in Notifications is type-only; export that alias or derive it from existing public types.

### R12 — `src/renderer/components/BunnyfeedsThread.tsx -> ../stores/bunnyboardStore`

Source: `src/renderer/components/BunnyfeedsThread.tsx:21`. Imports: `{ useBunnyboardStore }`.

Module-level `subscribe((state,before) => …)` compares only `before.open`/`state.open` for true→false. Thread component :38 closes its own `usePostView`; entry :149 consumes own visit flag and dynamically starts `armFeedThreads("next")`. No phone-store write; subscriptions have no retained unsubscribe here. New `phoneClosed` (§2), game-lifetime `modState` for own UI/visit data.

### R13 — `src/renderer/components/BunnyfeedsThread.tsx -> ../stores/characterStore`

Source: `src/renderer/components/BunnyfeedsThread.tsx:9`. Imports: `{ profileUrl, useSpriteVersion }`.

`useSpriteVersion(charId)` subscribes to `spriteVersion[charId]` for portrait cache invalidation; `profileUrl(charId, version)` builds the URL at :507–511. No character-store write, no sprite generation. Plain narrow re-exports in reader rounds; do not re-export `useCharacterStore`.

### R14 — `src/renderer/components/BunnyfeedsThread.tsx -> ../stores/feedView`

Source: `src/renderer/components/BunnyfeedsThread.tsx:8`. Imports: `{ isFeedContact }`.

`isFeedContact(info)` reads only `info.flags.gaveContactInfo` and `blocked`. Thread uses it on render for popup stranger state and taggable contacts (:158, :586); Replies uses it when choosing a mutual friend (:109). Pure predicate; plain renderer re-export in reader rounds, plus §1 to obtain native inputs.

### R15 — `src/renderer/components/BunnyfeedsThread.tsx -> ../stores/gameStore`

Source: `src/renderer/components/BunnyfeedsThread.tsx:10`. Imports: `{ useGameStore }`.

Render selectors at :67–76, :150–185, :472–491, :576–592 read `date/time`, `calendar.season`, post by id and its `text/date/time/comments/likes/liked`, poster character `firstName/lastName`, `charInfo.handle`, reader `playerFirstName/profilePicture`, active `chars`, `characters`, `charInfo.flags.gaveContactInfo/blocked` for tag choices. Passed scene predicates additionally read `busy/currentSceneTranscript/sceneSummary` and graduation `date/time`. Click at :252 calls `toggleFeedLike`, setting/removing native post `liked/likedOn` (does not alter `likes`). Comment sends delegate to `leavePlayerComment`. New §1 reads/eligibility and §3 like write; no global game-store subscription.

### R16 — `src/renderer/components/BunnyfeedsThread.tsx -> ../stores/textingLoop`

Source: `src/renderer/components/BunnyfeedsThread.tsx:12`. Imports: `{ epilogueOf, sceneActiveOf }`.

`epilogueOf` reads `date/time` and the graduation predicate; `sceneActiveOf` reads `busy`, `currentSceneTranscript.length`, `sceneSummary !== null`. Passed as React store selectors at :74–76 and :185 to gate comment UI and blocked-state explanation. No calls to send a text, and no native writes. New composed comment eligibility (§1), not a texting-loop export.

### R17 — `src/renderer/components/BunnyfeedsThread.tsx -> @shared/postComments`

Source: `src/renderer/components/BunnyfeedsThread.tsx:5`. Imports: `{ shownComments }`.

`shownComments(comments,date,time)` filters by comment `at <= globalSlotOf(date,time)`, preserves input order and does not mutate. Thread uses it during render (:69), Bunnyfeeds entry while building recent-post prompt lines (:113), Photo comments during render (:131). Plain shared re-export in reader rounds; §1 supplies live clock inputs.

### R18 — `src/renderer/components/BunnyfeedsThread.tsx -> @shared/types`

Source: `src/renderer/components/BunnyfeedsThread.tsx:7`. Imports: `{ fullNameOf }`.

`fullNameOf(character)` reads `firstName/lastName` for rendered notification/thread author labels and tag matches. No store access or writes; plain shared re-export in separate rounds. Mixed `Season` in Notifications is type-only; export that alias or derive it from existing public types.

### R19 — `src/renderer/components/PhotoBubble.tsx -> ../stores/bunnyboardStore`

Source: `src/renderer/components/PhotoBubble.tsx:8`. Imports: `{ useBunnyboardStore }`.

React selector at :313 reads only `viewingCharId` to identify the conversation whose photo bubble is drawn; no writes. Extend existing `messageAttachment` props with `charId` (§2), rather than export the phone store.

### R20 — `src/renderer/components/PhotoBubble.tsx -> ../stores/gameStore`

Source: `src/renderer/components/PhotoBubble.tsx:9`. Imports: `{ useGameStore }`.

Render selectors at :100 read only `playthroughId` to build the image URL and decide missing-state display. No game writes here; reroll buttons call Photo helpers, whose actual writes are inventoried separately. New §1 clock reader.

### R21 — `src/renderer/components/PhotoBubble.tsx -> @shared/types`

Source: `src/renderer/components/PhotoBubble.tsx:1`. Imports: `type { ChatMessage }`.

Type-only import: type { ChatMessage }. Erased at runtime; no fields read/written or timing. Import available types (`Character`, `ChatMessage`, `Result`) from kit/shared; missing aliases (`MemoryType`, `CharFlags`, `CustomOutfitSlot`) belong to the type re-export round. No designed runtime hook. Desktop/preload instances remain Phase 1 scope.

### R22 — `src/renderer/components/PhotoPostSpots.tsx -> ../stores/gameStore`

Source: `src/renderer/components/PhotoPostSpots.tsx:7`. Imports: `{ useGameStore }`.

Render selectors at :20–26 read `charInfo[charId].feed[].photo` by post id, `npcRelationships` friendship between poster and `photo.with`, and that friend’s `charInfo.handle` via `photoFriendHandle`; :128–129 read `date/time` to gate comments. Friend display only for a finished/nonfailed photo and current friendship. No writes. New §1 post/clock/friend/social readers.

### R23 — `src/renderer/components/PhotoPostSpots.tsx -> @shared/postComments`

Source: `src/renderer/components/PhotoPostSpots.tsx:4`. Imports: `{ shownComments }`.

`shownComments(comments,date,time)` filters by comment `at <= globalSlotOf(date,time)`, preserves input order and does not mutate. Thread uses it during render (:69), Bunnyfeeds entry while building recent-post prompt lines (:113), Photo comments during render (:131). Plain shared re-export in reader rounds; §1 supplies live clock inputs.

### R24 — `src/renderer/modEntries/bunnyfeeds.ts -> ../stores/bunnyboardStore`

Source: `src/renderer/modEntries/bunnyfeeds.ts:27`. Imports: `{ useBunnyboardStore }`.

Module-level `subscribe((state,before) => …)` compares only `before.open`/`state.open` for true→false. Thread component :38 closes its own `usePostView`; entry :149 consumes own visit flag and dynamically starts `armFeedThreads("next")`. No phone-store write; subscriptions have no retained unsubscribe here. New `phoneClosed` (§2), game-lifetime `modState` for own UI/visit data.

### R25 — `src/renderer/modEntries/bunnyfeeds.ts -> ../stores/gameStore`

Source: `src/renderer/modEntries/bunnyfeeds.ts:31`. Imports: `{ useGameStore }`.

Renderer entry: `recentPostLines` :102–133 reads `charInfo[cast id].feed`, `date/time/calendar.season`; filters visible posts, newest two, then visible comments’ `charId/player/id/replyTo/text` to quote only answered player comments. Slot-intro request at :169 reads `npcRelationships`, then friend/crowd helpers read their separately listed facts. `slotSettled` :221–224 reads `date/time` for due next-slot memories and starts asynchronous thread work without awaiting it. No direct store write in this entry. Existing prompt/slot hooks supply timing; new §1 provides missing facts, §4 authorizes downstream memory writes.

### R26 — `src/renderer/modEntries/bunnyfeeds.ts -> @shared/postComments`

Source: `src/renderer/modEntries/bunnyfeeds.ts:4`. Imports: `{ shownComments }`.

`shownComments(comments,date,time)` filters by comment `at <= globalSlotOf(date,time)`, preserves input order and does not mutate. Thread uses it during render (:69), Bunnyfeeds entry while building recent-post prompt lines (:113), Photo comments during render (:131). Plain shared re-export in reader rounds; §1 supplies live clock inputs.

### R27 — `src/renderer/modEntries/bunnyfeeds.ts -> @shared/types`

Source: `src/renderer/modEntries/bunnyfeeds.ts:5`. Imports: `{ charKeyOf }`.

`charKeyOf(firstName,lastName)` derives prompt key from names. Used in entry slot-intro request, Replies replier construction and Threads prompt speaker/char identity; no writes. Already exported by kit/shared: change import, no new hook/re-export. Mixed `MemoryType` in Threads is type-only and belongs to the type export round if needed.

### R28 — `src/renderer/modEntries/photo-feature.ts -> ../stores/gameStore`

Source: `src/renderer/modEntries/photo-feature.ts:33`. Imports: `{ useGameStore }`.

Renderer entry at :114 reads `characters[charId].firstName` for `dmHistoryNote`; :171 reads fallback `playthroughId` for likes reach when not supplied by `LikesAsk`. No store writes here: initial post edits are through existing `fileFeedPost`, late group posts through existing `fileLatePost`. New §1 readers (prefer supplied hook context first).

### R29 — `src/renderer/stores/bunnyfeedsMemory.ts -> ./gameStore`

Source: `src/renderer/stores/bunnyfeedsMemory.ts:5`. Imports: `{ UNKNOWN_NAME, useGameStore }`.

`UNKNOWN_NAME` is the fallback label when the character is absent or `nameKnown` is false (:98). Imperative `getState` reads characters’ `firstName`, `chars`, `charInfo.feed[].heldMemories`, native `memories`, `nameKnown`, `charKeyToId`, `date` and comment `player` flags for ledger exclusion (:18–116). `holdFeedMemories` appends post `heldMemories` (:40); `fileDueFeedMemories` removes due held entries (:60), then dates them today and calls `replaceMemory(old,null)` / `recordMemory(new)` (:29–30). Run on reply and synchronously at `slotSettled`; `feedStatusLines` only projects closing lines. Existing slot hook, new §1 reads, §3 owned post data and §4 native memory commit; pure unknown label is a re-export candidate.

### R30 — `src/renderer/stores/bunnyfeedsMemory.ts -> ./modsStore`

Source: `src/renderer/stores/bunnyfeedsMemory.ts:6`. Imports: `{ useModsStore }`.

`useModsStore.getState().switches` is read only at :94; `optionOn(..., "bunnyfeeds", "announce")` gates closing status lines. No subscription or switch write. New narrow imperative `modOptionOn` (§1/§7), matching existing `useModOption` without calling a React hook imperatively.

### R31 — `src/renderer/stores/bunnyfeedsNotes.ts -> ./gameStore`

Source: `src/renderer/stores/bunnyfeedsNotes.ts:5`. Imports: `{ useGameStore }`.

`GameState` type is extracted from the store (:7); actual reads in `feedNotesOf`/`unreadFeedNotesOf` use only `charInfo.feed`, `date/time`, `bunnyboard.feedReadThrough`, post/comments and visibility. :24 sets only matching comment `read: true` on click; :40 writes `feedReadThrough = current global slot` for mark-all; :51 clamps/initializes that watermark on entry. No clock changes. New §1 reads; migrate watermark/read-id set to existing `saveField` (§3), with a scoped legacy bridge; no new native mark-read hook.

### R32 — `src/renderer/stores/bunnyfeedsReplies.ts -> ../prompts/feedRandoms`

Source: `src/renderer/stores/bunnyfeedsReplies.ts:19`. Imports: `{ FEED_EMOJI, FEED_EMOJI_BAG, FEED_HANDLE_BAG, FEED_HANDLE_POOL }`.

`FEED_HANDLE_BAG` and `FEED_EMOJI_BAG` name the native global bags; `FEED_HANDLE_POOL` supplies weighted entries (`key/handle`) and handle fallback, `FEED_EMOJI` supplies faces and fallback. Used during initial comment filing (Replies/PhotoComments) and asynchronous follower reply filing (Threads); no direct pool writes. New `drawFeedIdentities` (§5) removes all four imports for these uses; exporting constants alone leaves shared persistent bag access unresolved.

### R33 — `src/renderer/stores/bunnyfeedsReplies.ts -> ./feedView`

Source: `src/renderer/stores/bunnyfeedsReplies.ts:25`. Imports: `{ isFeedContact }`.

`isFeedContact(info)` reads only `info.flags.gaveContactInfo` and `blocked`. Thread uses it on render for popup stranger state and taggable contacts (:158, :586); Replies uses it when choosing a mutual friend (:109). Pure predicate; plain renderer re-export in reader rounds, plus §1 to obtain native inputs.

### R34 — `src/renderer/stores/bunnyfeedsReplies.ts -> ./gameStore`

Source: `src/renderer/stores/bunnyfeedsReplies.ts:26`. Imports: `{ useGameStore }`.

Imperative request planning/initial post filing reads `playthroughId`, `characters[id]` (traits/identity for following), active `chars`, `npcRelationships` affinity/friend lists, `charInfo[id]` (passed as `Replier.info` to owned prompt code), `charInfo.handle/flags.gaveContactInfo/blocked`, `charKeyToId`, `date/time` (:39–198). `writtenComments` resolves `from`, drops unknown/nonfriend roster commenters; `rollFeedComments` sets new detached comment `id/charId/handle/emoji/text/at`, three per arrival slot. No game-store write; only its own planned-crowd cache and shared bag draws. New §1 readers; initial comment installation already uses `fileFeedPost`.

### R35 — `src/renderer/stores/bunnyfeedsReplies.ts -> ./grabBagStore`

Source: `src/renderer/stores/bunnyfeedsReplies.ts:27`. Imports: `{ useGrabBagStore }`.

`useGrabBagStore.getState().drawMany` is the only action used. Draws handles with `one.key` and emoji as strings; it updates the two global bags’ set-aside keys and schedules disk writes after hydration. Threads draws one handle/emoji for a new follower and reuses old identity for a returning follower. No direct `bags` read, `load`, `reset`, `flush` or `setState`. New narrow `drawFeedIdentities` (§5).

### R36 — `src/renderer/stores/bunnyfeedsReplies.ts -> @shared/feed`

Source: `src/renderer/stores/bunnyfeedsReplies.ts:1`. Imports: `{ fallbackHandleOf }`.

`fallbackHandleOf(firstName,lastName)` used while dressing a roster-girl comment when `charInfo.handle` is absent (:196). Stateless, with a random suffix (no store write). Plain shared re-export in reader rounds.

### R37 — `src/renderer/stores/bunnyfeedsReplies.ts -> @shared/types`

Source: `src/renderer/stores/bunnyfeedsReplies.ts:18`. Imports: `{ charKeyOf }`.

`charKeyOf(firstName,lastName)` derives prompt key from names. Used in entry slot-intro request, Replies replier construction and Threads prompt speaker/char identity; no writes. Already exported by kit/shared: change import, no new hook/re-export. Mixed `MemoryType` in Threads is type-only and belongs to the type export round if needed.

### R38 — `src/renderer/stores/bunnyfeedsThreads.ts -> ../prompts/feedRandoms`

Source: `src/renderer/stores/bunnyfeedsThreads.ts:22`. Imports: `{ FEED_EMOJI, FEED_EMOJI_BAG, FEED_HANDLE_BAG, FEED_HANDLE_POOL }`.

`FEED_HANDLE_BAG` and `FEED_EMOJI_BAG` name the native global bags; `FEED_HANDLE_POOL` supplies weighted entries (`key/handle`) and handle fallback, `FEED_EMOJI` supplies faces and fallback. Used during initial comment filing (Replies/PhotoComments) and asynchronous follower reply filing (Threads); no direct pool writes. New `drawFeedIdentities` (§5) removes all four imports for these uses; exporting constants alone leaves shared persistent bag access unresolved.

### R39 — `src/renderer/stores/bunnyfeedsThreads.ts -> ./gameStore`

Source: `src/renderer/stores/bunnyfeedsThreads.ts:33`. Imports: `{ useGameStore }`.

Before request (:73–299) reads active `chars`, `charInfo.feed` and `comments/threadedThrough`, `characters` identity/traits/profile/behavior, `charInfo` relationship facts for the owned prompt, `npcRelationships`, `bunnyboard.conversations` through `hasTexted`, `stats`, `playthroughId/date/time/calendar.season`, `charKeyToId`. Reply filing (:334–464) rereads key/id/handle mappings; sanitizes target, speaker/joiner, cap, type/text; appends comments, stamps each owed post `threadedThrough = now`, banks due memories via helpers. Player send (:506–518) stamps trimmed comment `player/id/handle/emoji/text/replyTo/tags/at`. `patchPost` :524–530 replaces only matching `charInfo[id].feed[]`, preserving the rest; `pictureOf` :545 reads optional `post.photo.scene/with` and friend `firstName`. Triggered by phone/post close and settled slot, not a slot subscription; no immediate autosave. New §1 reads, §3 thread/post operations and §4 downstream memory commits; temporary coordination uses existing `modState`.

### R40 — `src/renderer/stores/bunnyfeedsThreads.ts -> ./grabBagStore`

Source: `src/renderer/stores/bunnyfeedsThreads.ts:34`. Imports: `{ useGrabBagStore }`.

`useGrabBagStore.getState().drawMany` is the only action used. Draws handles with `one.key` and emoji as strings; it updates the two global bags’ set-aside keys and schedules disk writes after hydration. Threads draws one handle/emoji for a new follower and reuses old identity for a returning follower. No direct `bags` read, `load`, `reset`, `flush` or `setState`. New narrow `drawFeedIdentities` (§5).

### R41 — `src/renderer/stores/bunnyfeedsThreads.ts -> ./loop/promptState`

Source: `src/renderer/stores/bunnyfeedsThreads.ts:35`. Imports: `{ lessNsfwTextNow, reader }`.

`lessNsfwTextNow()` reads current settings boolean for its own thread prompt (:292); existing kit `lessNsfwText` covers intent but defaults true until loaded rather than old false. `reader()` at :298 builds the native playthrough READER block, using reader identity/stats/bio and rule context internally, without writing. Existing text-policy reader + new `readerPromptContext` (§1); no scene-wide prompt-state export.

### R42 — `src/renderer/stores/bunnyfeedsThreads.ts -> ./loop/state`

Source: `src/renderer/stores/bunnyfeedsThreads.ts:36`. Imports: `{ currentRun, loopState, runStale, LOOP_LLM_GROUP }`.

`currentRun()`/`runStale(run)` fence request, retry and result around awaits (:139–150, :301–321); already kit exports. `LOOP_LLM_GROUP` passes the core loop cancellation namespace to `completeFeedThreads` (:140). `loopState.parkedWaiters.push(cancel)` (:144) writes native retry wake-up callbacks, woken on loop reset. Replace group/waiter mutation with existing `completeStructured`/`cancelCalls` and mod-owned cancellable retry (§7); do not expose native loopState.

### R43 — `src/renderer/stores/bunnyfeedsThreads.ts -> @shared/types`

Source: `src/renderer/stores/bunnyfeedsThreads.ts:16`. Imports: `{ charKeyOf, type MemoryType }`.

`charKeyOf(firstName,lastName)` derives prompt key from names. Used in entry slot-intro request, Replies replier construction and Threads prompt speaker/char identity; no writes. Already exported by kit/shared: change import, no new hook/re-export. Mixed `MemoryType` in Threads is type-only and belongs to the type export round if needed.

### R44 — `src/renderer/stores/localPhotoStore.ts -> ./gameStore`

Source: `src/renderer/stores/localPhotoStore.ts:3`. Imports: `{ useGameStore }`.

At :49 edits only `bunnyboard.conversations[charId].messages[messageId].photo` (set or delete), retaining the message; at :81 edits only matching `charInfo[charId].feed[postId].photo`. Missing target is a no-op. :73 reads all that character’s thread/feed `photo.file` names for reservation. :110 reads `awaitingInput` with scene-progress status before autosaving. Called on pending/completion/failure/reroll/recovery; no own slot subscription. New §1 readers and §3 record-slice/persistence contract.

### R45 — `src/renderer/stores/localPhotoStore.ts -> ./loop/saves`

Source: `src/renderer/stores/localPhotoStore.ts:4`. Imports: `{ writeAutosave }`.

`writeAutosave(loopState.decisionSave)` at :111 is fire-and-forget after attachment changes. Native write lane captures current save data but substitutes the last decision scene. No save load or direct file write here. New §3 combines record change and durable save; `writeModField` only covers owned save slices and cannot atomically install these native records.

### R46 — `src/renderer/stores/localPhotoStore.ts -> ./loop/state`

Source: `src/renderer/stores/localPhotoStore.ts:5`. Imports: `{ loopState }`.

Reads only `loopState.decisionSave` at :111 when requesting autosave; no loopState writes. This is a native scene snapshot, not mod-owned data. Remove through §3 persistence; no public scene-snapshot getter.

### R47 — `src/renderer/stores/localPhotoStore.ts -> ./loop/stream`

Source: `src/renderer/stores/localPhotoStore.ts:6`. Imports: `{ sceneInProgress }`.

Calls only `sceneInProgress()` at :110; native implementation reads `currentSceneTranscript.length` and `sceneSummary !== null`. If true and live `awaitingInput` is false, returns without autosaving. No stream mutation. §3 core-owned deferred persistence removes this knowledge from Photo.

### R48 — `src/renderer/stores/localPhotoStore.ts -> ./settingsStore`

Source: `src/renderer/stores/localPhotoStore.ts:7`. Imports: `{ noNsfwImagesOf, useSettingsStore }`.

`noNsfwImagesOf` reads only `settings?.noNsfwImages === true` (false before hydration). `useSettingsStore.getState().settings` is also passed to `comfyAvailable` (:25); internally that rule reads the ComfyUI source/external URL, `comfyDeferred`, plus setup `comfyReady`; no settings writes. New §6 boolean reader(s).

### R49 — `src/renderer/stores/localPhotoStore.ts -> ./setupStore`

Source: `src/renderer/stores/localPhotoStore.ts:8`. Imports: `{ comfyAvailable, useSetupStore }`.

`useSetupStore.getState().status` is passed to `comfyAvailable` at :25. Rule checks native web-build flag, settings ComfyUI source/defer flag, and `status?.comfyReady`; an external configured source need not be reachable. No refresh/install calls, no writes or status subscription. New `canRenderLocalImages` (§6).

### R50 — `src/renderer/stores/photoComments.ts -> ../prompts/feedRandoms`

Source: `src/renderer/stores/photoComments.ts:8`. Imports: `{ FEED_EMOJI, FEED_EMOJI_BAG, FEED_HANDLE_BAG, FEED_HANDLE_POOL }`.

`FEED_HANDLE_BAG` and `FEED_EMOJI_BAG` name the native global bags; `FEED_HANDLE_POOL` supplies weighted entries (`key/handle`) and handle fallback, `FEED_EMOJI` supplies faces and fallback. Used during initial comment filing (Replies/PhotoComments) and asynchronous follower reply filing (Threads); no direct pool writes. New `drawFeedIdentities` (§5) removes all four imports for these uses; exporting constants alone leaves shared persistent bag access unresolved.

### R51 — `src/renderer/stores/photoComments.ts -> ./gameStore`

Source: `src/renderer/stores/photoComments.ts:14`. Imports: `{ useGameStore }`.

At initial comment/like roll (:38–86) reads `playthroughId`, `characters[charId]` (reach seed/traits), active `chars`, `npcRelationships` for friend count, `date/time` for comment `at`. Produces detached `PostComment[]` and a like count, not direct feed writes. Existing `fileFeedPost`/`postLikes` install them. New §1 reader facts; bag mutation separately listed.

### R52 — `src/renderer/stores/photoComments.ts -> ./grabBagStore`

Source: `src/renderer/stores/photoComments.ts:15`. Imports: `{ useGrabBagStore }`.

`useGrabBagStore.getState().drawMany` is the only action used. Draws handles with `one.key` and emoji as strings; it updates the two global bags’ set-aside keys and schedules disk writes after hydration. Threads draws one handle/emoji for a new follower and reuses old identity for a returning follower. No direct `bags` read, `load`, `reset`, `flush` or `setState`. New narrow `drawFeedIdentities` (§5).

### R53 — `src/renderer/stores/photoComments.ts -> @shared/feed`

Source: `src/renderer/stores/photoComments.ts:1`. Imports: `{ rollPostLikes }`.

`rollPostLikes(friendCount)` used only for Photo-off fallback in `postLikes` and `strangerLikes` (:68, :80); rolls a number, mutates no game data. Plain shared re-export in reader rounds. Installation of likes already goes through existing hooks.

### R54 — `src/renderer/stores/photoGroup.ts -> ./gameStore`

Source: `src/renderer/stores/photoGroup.ts:15`. Imports: `{ useGameStore }`.

Request/reply hooks read `playthroughId/date/time` for slot key (:40), every `charInfo.feed` post `date/time/photo.with` for deduplication (:46), cast pair `npcRelationships` (:90), characters by poster/friend id (:94), reverse `charKeyToId` (:147); slot-poster hook reads active `chars`, pair friendships and character existence (:169–183). Own `asked`, `settledSlot`, `feedFriends` maps/sets keep per-slot choices. No direct game-store write: accepted group post goes through existing `fileLatePost` (:150). New §1 readers, existing lifecycle + `modState` for per-run caches. Group selection must still reject enemies, not require friendship for every cast pair.

### R55 — `src/renderer/stores/photoPost.ts -> ./gameStore`

Source: `src/renderer/stores/photoPost.ts:4`. Imports: `{ useGameStore }`.

Reservation/preparation reads `characters[id]`, `playthroughId`, optional friend existence (:50–98). `holdPostPhoto` :131 directly calls native `appendFeedPost` with held Photo data. Render, timeout, reroll and reveal read matching post `photo`, author/friend `characters`, contact `flags.gaveContactInfo/blocked`, live `playthroughId` (:165–309). `startHeldPostPhoto` scans `charInfo.feed[].photo.held`, sorts post date/time and queues work on `playerActs`; not a slot subscription. Settling/reroll writes via `setFeedPostPhoto`, release adds `outAt = Date.now()` then calls retained native nudge callback and `savePhotoState`. New §1, §3 custody/release/record writes; preserve timeout followed by late success and queue deduplication.

### R56 — `src/renderer/stores/photoPost.ts -> ./settingsStore`

Source: `src/renderer/stores/photoPost.ts:11`. Imports: `{ noNsfwImagesOf, useSettingsStore }`.

`noNsfwImagesOf` reads only `settings?.noNsfwImages === true` (false before hydration). Imperative `getState()` feeds `allowedPostTier` during post preparation (:39); no subscription/writes. New §6 boolean reader(s).

### R57 — `src/renderer/stores/photoRecovery.ts -> ./gameStore`

Source: `src/renderer/stores/photoRecovery.ts:1`. Imports: `{ useGameStore }`.

On `gameEntered` (:14–74) snapshots `playthroughId`, all `charInfo.feed` and `bunnyboard.conversations[].messages`, reads `photo.pending/file/tier/scene/with` and target ids. Awaits disk `landed` then compares only current playthrough id, replacing Photo data through helpers with success or `failed`, dropping pending; saves once if anything settled. Does not sweep merely held posts here. New §1 + §3 with run/revision guard instead of pid-only guard.

### R58 — `src/renderer/stores/photoSwitchHooks.ts -> ./settingsStore`

Source: `src/renderer/stores/photoSwitchHooks.ts:10`. Imports: `{ noNsfwImagesOf, useSettingsStore }`.

`noNsfwImagesOf` reads only `settings?.noNsfwImages === true` (false before hydration). `useSettingsStore(noNsfwImagesOf)` is a render subscription (:27), recomputing explicit blocking with Photo switches; no settings writes. New §6 boolean reader(s).

### R59 — `src/renderer/stores/photoTipDelivery.ts -> ../prompts/bunnybot`

Source: `src/renderer/stores/photoTipDelivery.ts:1`. Imports: `{ BUNNYBOT_CHAT_ID, FRIENDS_INTRO_SLOT }`.

Deferred: `BUNNYBOT_CHAT_ID` selects bot conversation for duplicate-text checking; `FRIENDS_INTRO_SLOT` gates the tip after intro. Read on picture delivery/first visible feed photo, no direct write. Photo tips handled elsewhere; not a new Phase 2 requirement.

### R60 — `src/renderer/stores/photoTipDelivery.ts -> ./gameStore`

Source: `src/renderer/stores/photoTipDelivery.ts:8`. Imports: `{ useGameStore }`.

Deferred photo-tip work. Reads `bunnybotThrough`, bot conversation `messages[].text` for intro/dedup, `characters[charId].firstName`; calls tip delivery on first DM picture or mounted visible feed picture. No direct setState, but delivery appends native bot messages/unread. Keep out of Phase 2 hook set.

### R61 — `src/renderer/stores/photoTipDelivery.ts -> ./textingLoop`

Source: `src/renderer/stores/photoTipDelivery.ts:9`. Imports: `{ deliverBunnybotNow }`.

Deferred: `deliverBunnybotNow(texts)` called for authored Photo tips (:26, :37). Native function may prepend its “also” line and append messages/unread via native delivery. This is not pure re-export work. Photo tips handled elsewhere; retain the row until that design/migration.

### R62 — `src/renderer/stores/photoTurn.ts -> ./gameStore`

Source: `src/renderer/stores/photoTurn.ts:5`. Imports: `{ useGameStore }`.

After DM/reach-out (:23–73) reads `charInfo[charId].flags` and affection inputs, current `date`, character traits, messages (`id/sender`) to find latest contact message, `playthroughId`; after reservation checks current `loads`, target message and `photo` absence. Draw/reroll (:90–169) rereads message Photo data and author/friend character, pid. Helpers write pending/completed/failed Photo data and save; completion guards only pid and presence of some photo, so a same-playthrough load/replacement can race. New §1 facts + §3 owned record updates/persistence. Relationship rules remain Photo-owned/pure.

### R63 — `src/renderer/stores/photoWebp.ts -> @shared/types`

Source: `src/renderer/stores/photoWebp.ts:2`. Imports: `type { Result }`.

Type-only import: type { Result }. Erased at runtime; no fields read/written or timing. Import available types (`Character`, `ChatMessage`, `Result`) from kit/shared; missing aliases (`MemoryType`, `CharFlags`, `CustomOutfitSlot`) belong to the type re-export round. No designed runtime hook. Desktop/preload instances remain Phase 1 scope.

### R64 — `src/renderer/views/ContactGallery.tsx -> ../stores/feedRolls`

Source: `src/renderer/views/ContactGallery.tsx:8`. Imports: `{ newestFirst }`.

`newestFirst(a,b)` compares only `date/time`; used on render at :182 to merge DM/feed shots in stable newest-first order. No random roll or writes. Plain renderer re-export in reader rounds.

### R65 — `src/renderer/views/ContactGallery.tsx -> ../stores/gameStore`

Source: `src/renderer/views/ContactGallery.tsx:10`. Imports: `{ useGameStore }`.

Render at :144–183 reads `playthroughId`, `bunnyboard.conversations[charId].messages` (`id/date/time/photo`), `charInfo[charId].feed` (`id/date/time/photo`), filters held/unfinished/failed photos, sorts and deduplicates by file. :254 reads pid for post-photo URL. `isContact` comes from existing contact-tab props; no native writes or subscriptions outside React. New §1 stored-record/clock readers; pure comparator separately listed.

### R66 — `src/shared/bunnyfeeds.ts -> ./types`

Source: `src/shared/bunnyfeeds.ts:3`. Imports: `type { MemoryType }`.

Type-only import: type { MemoryType }. Erased at runtime; no fields read/written or timing. Import available types (`Character`, `ChatMessage`, `Result`) from kit/shared; missing aliases (`MemoryType`, `CharFlags`, `CustomOutfitSlot`) belong to the type re-export round. No designed runtime hook. Desktop/preload instances remain Phase 1 scope.

### R67 — `src/shared/photoGate.ts -> ./types`

Source: `src/shared/photoGate.ts:4`. Imports: `type { CharFlags }`.

Type-only import: type { CharFlags }. Erased at runtime; no fields read/written or timing. Import available types (`Character`, `ChatMessage`, `Result`) from kit/shared; missing aliases (`MemoryType`, `CharFlags`, `CustomOutfitSlot`) belong to the type re-export round. No designed runtime hook. Desktop/preload instances remain Phase 1 scope.

### R68 — `src/shared/photoTypes.ts -> ./types`

Source: `src/shared/photoTypes.ts:1`. Imports: `type { Result }`.

Type-only import: type { Result }. Erased at runtime; no fields read/written or timing. Import available types (`Character`, `ChatMessage`, `Result`) from kit/shared; missing aliases (`MemoryType`, `CharFlags`, `CustomOutfitSlot`) belong to the type re-export round. No designed runtime hook. Desktop/preload instances remain Phase 1 scope.

### R69 — `src/shared/photoWardrobe.ts -> ./types`

Source: `src/shared/photoWardrobe.ts:3`. Imports: `type { CustomOutfitSlot }`.

Type-only import: type { CustomOutfitSlot }. Erased at runtime; no fields read/written or timing. Import available types (`Character`, `ChatMessage`, `Result`) from kit/shared; missing aliases (`MemoryType`, `CharFlags`, `CustomOutfitSlot`) belong to the type re-export round. No designed runtime hook. Desktop/preload instances remain Phase 1 scope.

## Appendix B — Row removal dependencies

These refer to Appendix A, and distinguish an enabled *portion* from a removable complete
row. The reader PRs may ship before the writer PRs, but the mixed row stays until both migrate.

| Contract / migration | Bunnyfeeds rows | Photo Feature rows |
|---|---|---|
| §1 clock/identity/social/feed/message readers only | R10, R25, R34 | R20, R22, R28, R51, R54, R65 |
| §1 composed comment eligibility | R16; also the eligibility part of R15 | — |
| §1 readers + §3 like | R15 | — |
| §1 readers + existing owned `saveField` + agreed nested legacy transition | R31 | — |
| §1 readers + §3 post/thread round + §4 sourced memory | R29, R39 (R39 calls the memory helpers; its own direct writes are §3) | — |
| §1 readers + §3 post/message owned-record writes and persistence | — | R44, R57, R62 |
| §1 readers + §3 native held filing/release and record data writes | — | R55 |
| §1 imperative `modOptionOn` | R30 | — |
| §1 reader context + existing `lessNsfwText` | R41 | — |
| §2 `phoneClosed` / attachment `charId` | R12, R24 | R19 |
| §3 persistence replaces all three loop imports together | — | R45, R46, R47 |
| §5 native identity draws | R32, R35, R38, R40 | R50, R52 |
| §6 policy/readiness booleans | — | R48, R49, R56, R58 |
| Existing run guards and owned call/retry/state migration (§7) | R42 | — |
| Plain reader-round re-exports (no designed hook) | R09, R11, R13, R14, R17, R18, R26, R33, R36 | R23, R53, R64 |
| Existing kit `charKeyOf` import migration | R27, R37; R43 also needs the `MemoryType` alias | — |
| Type-only import migration / type export round | R66; mixed types in R11/R43 | R21, R63, R67, R68, R69 |
| Deferred photo-tip design | — | R59, R60, R61 |
| Desktop/preload Phase 1, validators/type imports only in this inventory | — | R01–R08 |

A row can also depend on pure exports used by its caller; for example new native readers do
not remove a separate `shownComments` import. This matrix covers only the feed/game-state
inventory, not every boundary violation needed to ship either mod outside the repository.
