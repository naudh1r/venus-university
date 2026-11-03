# Photo Feature and Bunnyfeeds: mod-data gap check

Research against `upstream/main` **fd428363** (Photo 1.7.1, #254 merged), with
`upstream/core` **de051018**, assuming [#257](https://github.com/venus-extracurriculars/build/pull/257)
(`hooks/readers-round-3`, **706a9628**) and
[#258](https://github.com/venus-extracurriculars/build/pull/258)
(`hooks/builtin-main-entries`, **c4d62c54**) land. The inventory style follows
`docs/proposals/photo-main-hooks.md` on `notes/photo-main-hooks`.

**The `ex` storage model exists and works. Neither mod needs a new mod-data bag.** The remaining
problems are obtaining records, publishing updates to records owned by the game, updating native
comments/memories/likes, and preserving these mods' particular autosave timing. `recordField` is
a pure transformer, not a live record setter. `sceneField.save` is a useful scene checkpoint
operation, not a general record write or an all-context replacement for these autosaves.

This is an investigation, not an implementation proposal ready to merge. Only this report is
committed. Ten uncommitted probes ran in a detached, sparse worktree; their reproducible source
is below. No mod switches, API changes, source changes, PRs or external comments were made.

## Reading the tables

Source locations are at the main snapshot above. Paths in the mod tables are relative to
`src/renderer/`; a location names the operation, not merely its import. **R** and **W** separate
reads and writes. Where an immutable updater reconstructs `charInfo` or `bunnyboard`, that is a
container update preserving other keys, not permission to replace all of that container.

Existing capabilities are named literally. **G1–G6** refer to the missing pieces described below;
the suggested names and signatures there are shapes for review, not existing or agreed APIs.
A row is clear only when *all* its uses can move, not when one getter can move or its import can
be relocated into another mod helper.

## Part 1 — Photo Feature

After #257 and #258's switches, the relevant inventory is **11 game-store rows and three loop
rows**, plus the separate EchoPanel row. #257 covers settings, setup, selected phone thread,
feed identity draws and Lightbox; Photo's id stays local. #258 supplies the main invoke/route
mechanism and permits deleting the two preload import rows. Neither changes record persistence.

| Allowlist row | Every read / write using it | Where it lives | Existing coverage or gap |
|---|---|---|---|
| `components/PhotoBubble.tsx → ../stores/gameStore` | **R** `:83–85`: reactive playthrough id, sender's `Character`, and optional friend's `Character` for image URLs, info and redraw. **W** none. | Live playthrough identity; loaded character definitions. The attachment itself is passed into the component. | `useGameFacts().playthroughId` covers the id. **G1** character lookup/subscription remains. #257's `useViewingThread` covers the separate phone-store row, not characters. |
| `components/PhotoPostSpots.tsx → ../stores/gameStore` | **R** `:19–26`: find post by charId/postId and read its photo; read playthrough id; compute friend's handle from `npcRelationships` and `charInfo`. `:111–112`: date/time to filter shown comments. **W** none. | `charInfo[id].feed`, character state/handles and NPC relationships; clock. | Existing `useGameFacts`, `shownComments` and Photo's pure handle helper cover calculations, not access to their inputs. **G1** post/character-state/relationship/clock readers. |
| `modEntries/photo-feature.ts → ../stores/gameStore` | **R** `:115`: resolve friend's first name for a DM history note; `:181`: playthrough-id fallback for likes. **W** none through this import. `:151–174` modifies `filing.post`, then delegates held insertion to `photoPost`. | Loaded character definitions and live identity; post being created is a host-provided mutable filing. | `gameFacts` covers the fallback. `dmHistoryNote(message)` supplies no character lookup (`packages/modkit/src/renderer/hooks.ts:423`). **G1** remains for the name. Existing `recordField.with(filing.post, value)` can already decorate a not-yet-filed post. |
| `stores/localPhotoStore.ts → ./gameStore` | **R** `:49–58`, `:81–90`: locate message/post by stable id, leave deleted records untouched, retain other keys. `:73–76`: enumerate all her message/feed photo filenames, pending included. `:115`: awaiting-input gate. **W** `:48–65`: replace/remove a message's `photo`; `:80–92`: replace/remove a post's `photo`. | `bunnyboard.conversations[id].messages[*].photo`; `charInfo[id].feed[*].photo`; transient `awaitingInput`. | `recordField('photo-feature', { empty: null, legacy: ['photo'], normalize })` covers data shape/migration, **not publishing the returned record**. **G1** reads, **G2** scoped record update, **G4** save policy. |
| `stores/photoComments.ts → ./gameStore` | **R** `:30–31`, `:57–64`, `:73–75`: playthrough id and poster `Character` for reach; `npcRelationships` and `chars` for friend count. `:42`: date/time for comment arrival stamps. **W** none to game state; grab-bag draws are separately covered by #257. | Native identity/clock/roster/relationships. Returned likes and comments are attached by the filing hook. | `gameFacts`, shared relationship functions and #257's draws cover parts. **G1** supplies the remaining inputs. No save writer is needed for these pure return values. |
| `stores/photoGroup.ts → ./gameStore` | **R** `:39–47`: pid/date/time and all feeds to detect an existing duo this slot. `:89–95`: NPC relationships and both character definitions. `:146–147`: reverse charKey lookup for filing. `:168–181`: pid, existing pair's character, roster ids/definitions and NPC relationships for a once-per-slot friend roll. **W** none through this import; `asked`, `settledSlot` and `feedFriends` are module state. `:149` calls existing `fileLatePost`. | Native clock/roster/feeds/relationships. Rolls and request bookkeeping are transient. | `gameFacts` and `fileLatePost` exist; `charKeyOf(firstName,lastName)` can replace reverse-map lookup once the character is supplied. `modState` can own transient rolls. **G1** still needed; neither a save nor a scene field is necessary for those rolls. |
| `stores/photoPost.ts → ./gameStore` | **R** `:52–59`: pid and character for reservation; `:100`: friend; `:160`: current post photo; `:173–174`: contact/block flags before nudge; `:190–205`: pid/characters/photo plus pid fence after await; `:275–284`: all feeds and dates to queue held posts; `:300–311`: current photo/pid for reroll; `:321–340`: pid, characters, load counter, photo and filename set for redraw. **W** `:126–135`: append an already-formed held post. Later photo mutations delegate to `localPhotoStore` (`:171`, `:304`, `:333`). | Native feed insertion plus Photo-owned attachment metadata. | Existing `PostFiling`/`fileLatePost` cover ordinary creation; the held-insertion/nudge exception is explained under **G3**. **G1**, **G2**, **G4** cover asynchronous completion and persistence. Use existing `currentRun/runStale` for asynchronous lifetime fences rather than export `loads`. |
| `stores/photoRecovery.ts → ./gameStore` | **R** `:14–21`: pid and every feed; `:29`: pid after disk await; `:45–55`: every conversation/message and pid after await. **W** no direct set here; `:30`, `:56` delegate pending→landed/failed updates to `localPhotoStore`; `:74` requests a save if any changed. | Saved pending attachment records, on both message and post. | **G1** enumeration and **G2** publication remain. Existing main invoke after #258 covers disk queries. Same-pid older-save loads should use `currentRun`/a game-lifetime token, not pid alone. |
| `stores/photoTipDelivery.ts → ./gameStore` | **R** `:20`: character's first name for feed-photo tip. **W** none through this import. | Loaded character definition. `bunnybotSays(..., { once })` already owns tip delivery and its saved one-shot mark. | Do not add another message writer or save field for the tip. Existing `bunnybotSays` covers the write. **G1** name lookup, or pass a name from a caller that has a real host-supplied character. |
| `stores/photoTurn.ts → ./gameStore` | **R** `:22–35`: charInfo flags, date, character traits and affection gate. `:58–59`, `:76–79`, `:109–123`: pid/load lifetime and references while early render is unattached. `:176–208`, `:243–251`: conversation messages, last contact message, current attachment and load/pid checks after reservation. `:275–276`: targeted attachment. `:293–311`: pid, character/friend, load/file fences during render. `:372–392`: same inputs for redraw. **W** no direct set here; `:215`, `:255`, `:318`, `:356`, `:385` delegate attachment writes; `:222`, `:261`, `:319`, `:386` request persistence. | Native conversation/message and character-state inputs; Photo-owned attachment data; transient early-render state. | The DM hooks supply character/reply/lead and an abort signal for the lead, **not the target message or conversation** (`hooks.ts:434–441`). `gameFacts`, `currentRun/runStale`, `modState` cover partial identity/lifetime needs. **G1**, **G2**, **G4** remain. |
| `views/ContactGallery.tsx → ../stores/gameStore` | **R** `:91–92`: character/friend; `:183–185`: pid, entire conversation and feed for merged gallery; `:296`: pid for link URL. **W** none. | Native message/post chronology with Photo's attachments; character definitions. | `useGameFacts` covers ids; `recordField.read` can read the attachment from records once supplied. **G1** records and character subscriptions remain. EchoPanel is separate and excluded here. |
| `stores/localPhotoStore.ts → ./loop/saves` | **R/call** `:116`: await `writeAutosave(decisionSave)` (or fire-and-forget via `:109`). **W effect** writes the whole current non-scene save plus the held scene checkpoint. | Autosave, not a mod slice alone. | **G4**: neither field API is a drop-in across scene, free-roam and texting states. |
| `stores/localPhotoStore.ts → ./loop/state` | **R** `:116`: `decisionSave` only. **W** none. | Transient last decision-point scene used as save input. | **G4** must select the checkpoint internally; do not expose `loopState`. |
| `stores/localPhotoStore.ts → ./loop/stream` | **R/call** `:115`: `sceneInProgress()`; with `awaitingInput`, skip while a scene line/stream is playing. **W** none. | Transient playback state. | **G4** policy; `safePoint() === 'open'` is not the same predicate (probe 3). |

### Photo: data placement and older saves

`photo` is declared by Photo's augmentation (`src/shared/photoTypes.ts:78–86`), not by core's
base message/post contract. Prefer the Photo slice on the existing records:
`message.ex['photo-feature'] = { v, data: photo }` and the same on `SocialPost`. One record-field
handle can be reused if both record kinds use the same `ChatPhoto | null` payload. Keep all fields
(`tier`, `scene`, `file`, `with`, `pending`, `failed`, `held`, `outAt`) together. There is no reason
to introduce a second global bag just to store them. Photo's character body is already read from
its own character `ex` slice (`src/shared/characterBody.ts:25–32`); slices on different record
kinds do not overwrite each other.

Use `legacy: ['photo']` and a normalizer that prefers stored data and otherwise validates the
legacy `photo`. Test `stored !== undefined`, not truthiness/nullish fallback, so an explicitly
cleared `null` slice outranks stale legacy data (probe 10). `read(record)` reads an old record **without migrating it in place**. The move
occurs when `with(record,next)` returns a replacement, and only persists once that replacement
is published and saved. This is not the registered top-level `saveField` load migration: nested
record-field handles do not automatically walk and replace every message/post. Probe 1 saves
and reloads the migrated record through core and preserves another mod's slice. An inactive or
absent mod's opaque data remains serialized. An older Photo version is not promised to read a
save rewritten to the new namespace: keep old saves readable by the new version; do not silently
promise reverse migration.

Photo owns its own UI, history note and visibility adapters, so they can all read the handle.
Bunnyfeeds' `pictureOf` (`stores/bunnyfeedsThreads.ts:561–569`) also reads the current public
`photo.scene/with` shape. A switch must update that plain-data reader to accept legacy data and
a documented, version-checked Photo slice, or agree a caption adapter. Do not delete the legacy
field and silently stop Bunnyfeeds noticing pictures. This is a cross-mod read contract, not a
reason to let Bunnyfeeds write Photo's data, nor a new storage primitive.

An alternative is a single existing `saveField('photo-feature')` map keyed by character and
message/post ids. Its `set/read/use/write` work today, but that is a deliberate data-model change:
legacy migration must traverse nested records, deleted records need pruning, and consumers must
resolve ids through the map. It avoids a per-record setter for Photo's *metadata*, not the missing
native readers or the save-timing question. It is not proof that `recordField.with` publishes a
record, and is not counted as the unchanged per-record migration below.

### Photo: saving, timing and redraw cleanup

`savePhotoStateAwaitable` (`localPhotoStore.ts:114–116`) skips a scene with `awaitingInput === false`;
otherwise it queues `writeAutosave(loopState.decisionSave)`. This includes **outside a scene while
texting is unsettled**, which the manual-save safe point refuses. A pending filename is saved as
soon as it is attached; completion, failure, timeout and recovery also request a write. A mod
migration must preserve the pending name before a crash, not just the final image.

`saveField.set` is fine for immediate own-data changes that the loop's next normal save will
carry; it does not write now. `write`/`writeModField(s)` write the mod's **top-level slice** at a
manual-safe point, not a nested message's slice. They refuse during streaming/texting, and do
not arrange a deferred retry. During a quiet displayed line they can be open, but use the manual
resumable on-line scene rather than Photo's last-decision checkpoint. These are different save
policies, not a missing `ex` implementation. Such a root write can also co-flush already-published
non-scene changes from its base draft; it still supplies no nested-record setter.

`sceneField.save(next)` can preserve the last decision point and co-flush current non-scene
changes, even while streaming (probe 4): `saveSceneField` calls `writeAutosave`, whose draft is
`{ ...game.toGameSave(), scene }`. Only *scene mods* are selectively patched into the held scene;
that does **not** mean the save file excludes other live non-scene changes. But it cannot publish
a record, refuses without an active scene or while ending, and its own data resets with the
scene. A dummy scene field used only to trigger this side effect would not cover the map/phone
case. The existing API should not be described as incapable of saving mid-scene; its actual
coverage and its limits are narrower than a universal flush.

Redraw wrappers (`photoTurn.ts:384–386`, `photoPost.ts:332–334`) first publish the new filename,
then await the existing save attempt. `photoRedraw.ts:139–143` subsequently asks main to retire the
old file with `replacement: newFile`. **The await is not a disk-success receipt**: `writeAutosave`
reports a failed save through the UI and resolves; a mid-line skip also returns immediately.
The decisive safeguard is Photo 1.7.1's native cleanup (`src/main/services/localPhotoService.ts:565–566`):
it requires a saved checkpoint naming the replacement and no checkpoint or replay naming the
old file. It watches later save changes, and an unreadable checkpoint prevents deletion.
`src/main/photoFiles.ts:135–156` recursively scans objects, including `ex`, for valid `file`
properties, so the proposed record-field placement retains that protection. Keep it and the
filename shape. Do not delete on a successful render, an in-memory set or a resolved save queue
alone. Older slot saves/replays may correctly retain the old file indefinitely.

The existing load/file checks must survive refactoring. `expect` on a save value alone does not
fence a same-save reload with equal data. Use existing `currentRun/runStale`, or a game-lifetime
`modState` token, and host-side pid/load checks for queued writes. A scene rewind has its own
checkpoint semantics: Photo's messages/posts are non-scene state and must not disappear merely
because a scene field reset or transcript was cut. Do not move persistent attachments into
`sceneField` to obtain its `save` method.

## Part 2 — Bunnyfeeds

After #257's switch there are **seven game-store rows, four loop rows, characterStore and
textingLoop: 13 rows**. Settings/phone navigation, identity draws, raw mod-option lookup, prompt
helpers, shared slot conversion and bare-message rendering are covered by existing APIs/#257.

| Allowlist row | Every read / write using it | Where it lives | Existing coverage or gap |
|---|---|---|---|
| `components/BunnyfeedsNotifications.tsx → ../stores/gameStore` | **R** `:45–53`: all character-state feeds, date/time, global feed read-through and season; `:107`: unread count from that same projection; `:128–138`: names only when known, otherwise handles, for author and poster. **W** none here; mark-read buttons call `bunnyfeedsNotes`. | Native feed records and clock; Bunnyfeeds' read marker. | Shared `feedNotes`, `shownComments`, formatting and contact predicates are calculations only. **G1** supplies live inputs; own global marker can already be a `saveField`/conversation record slice. |
| `components/BunnyfeedsThread.tsx → ../stores/gameStore` | **R** `:77–86`: clock, epilogue/scene selectors; `:160–168`: active post/character state and comments; `:190–195`: poster definition/handle, post, season and scene state; `:482`: reader first name; `:501`: player profile picture; `:586–605`: chars, characters and charInfo to build taggable contacts. **W** `:262`: `toggleFeedLike(charId,postId)`; submission delegates to thread writer. | Native feeds, likes, roster, clock and player profile; scene UI state. | `useGameFacts().readerName` covers first name. Existing post-comment props supply some previews, not the live full post/tag list. **G1**, **G3**, **G5** remain. |
| `modEntries/bunnyfeeds.ts → ../stores/gameStore` | **R** `:87–110`: feed posts/comments, clock and calendar season for recent-post prompt lines; `:154`: NPC relationships for opening repliers; `:195`: clock before filing due memories for next slot. **W** none through this import. `:201–213` changes host-provided `filing.post.comments`. | Native feed/clock/relationship snapshot; the post being created. | Existing `fileFeedPost` already permits the initial comment list on `filing.post`, with no separate writer. Existing prompt hooks/characters and shared utilities do not expose all these live inputs. **G1** for later reads. |
| `stores/bunnyfeedsMemory.ts → ./gameStore` | **R** `:18–19`: poster first name; `:27–30`: previous native memory matching old feed suffix; `:41–45`: target post/held memories; `:54–74`: roster feeds and due held memories, current date; `:80–84`: same due query; `:95–100`: character/nameKnown for announcements; `:110–114`: charKey mapping, feeds and player comments for texting-ledger note. Also imports `UNKNOWN_NAME` (`:5`). **W** `:29–30`: remove matching old native memory then record the new dated/tagged one; `:40–49`: append held memories on a post; `:60–69`: remove those now due, preserving the rest. | Held memories are mod metadata on a post; *published* memories are native `charInfo[id].memories`. | **G1**, **G2** for held metadata, **G3** for publishing/replacing native memories. `recordField` can mark ownership on a memory once supplied, but cannot append it to native memory storage. A mod-owned unknown-name fallback does not need a whole-store export. |
| `stores/bunnyfeedsNotes.ts → ./gameStore` | **R** `:9–18`: feeds/clock and global mark to compute notes/unread; `:24–32`: post and comment ids/read flag; `:40`, `:51–54`: clock and previous global marker. **W** `:23–34`: set one comment's `read`; `:39–41`: set `bunnyboard.feedReadThrough`; `:50–55`: initialize missing marker or clamp a future marker to now after semester carry. | Per-comment mod metadata and one global Bunnyfeeds marker. | `recordField('bunnyfeeds')` on each comment and an existing `saveField('bunnyfeeds')` containing `readThrough` cover representation. The record updater still needs **G2**; list/clock access needs **G1**. Root field `set` can replace the global-marker set; it is not itself a native record writer. |
| `stores/bunnyfeedsReplies.ts → ./gameStore` | **R** `:41–46`: pid and poster for crowd planning; `:82–89`: character, key, info and supplied relationships for replier; `:95`: roster ids; `:109–113`: roster/relationships and contact status for joining friend; `:124–133`: charKey lookup and NPC friendship validation; `:161–172`, `:186–197`: pid, definitions, handles and clock for stamped comments. **W** none to game state; planned crowd map is transient and grab-bag writes are separately covered by #257. | Native roster/state/relationships/clock. Returned comments are initially filed through existing host filing. | `gameFacts`, `charKeyOf`, contact/friend predicates and #257 draws cover partial operations. **G1** remains for the actual records and current clock. |
| `stores/bunnyfeedsThreads.ts → ./gameStore` | **R** `:81–87`: roster feeds/comments/thread progress; `:96`, `:135–142`: relationships and speaker definitions; `:185–306`: clock, characters/info, relationships, pid, stats, conversations (`hasTexted`), follower reach and season for prompt; `:354–487`: key map, current handles/info/characters for reply/memory validation and filing; `:526–536`: clock for player's comment; `:545–547`: locate existing post; `:565`: Photo friend's first name for picture description. **W** `:544–548`: immutable targeted post patch; via it `:454–457` append replies and set `threadedThrough`, `:553–554` append player/other comments. `:491–492` delegates held/native memory publication. **G3** owns the native comment list; **G2** owns thread/held metadata. | Native `SocialPost.comments` plus Bunnyfeeds post metadata, native clock/roster/relationships/stats. | **G1**, **G2**, **G3**. `recordField` alone cannot replace a post in `charInfo`; `saveField` cannot update native comments or make them visible to native carry/render contracts. |
| `stores/bunnyfeedsThreads.ts → ./loop/saves` | **R/call** `:315`, `:335–337`: after filing a round, fire-and-forget `writeAutosave(decisionSave)` unless scene is playing. **W effect** persist reply list, progress and held memories. | Whole autosave with the last decision scene. | **G4**, same limits as Photo. A successful reply arriving while some other text call is pending is not necessarily a manual-safe point. |
| `stores/bunnyfeedsThreads.ts → ./loop/state` | **R/call** `:148`: `LOOP_LLM_GROUP`; `:149`, `:154`, `:309–320`: `currentRun/runStale`; `:337`: decisionSave. **W** `:152`: push retry cancellation callback into `parkedWaiters`. | Transient request lifetime/cancellation, plus checkpoint input. | `currentRun/runStale` are already kit exports. Own calls can use existing `completeStructured('bunnyfeeds', request, { group: 'threads' })` and `cancelCalls`; own parked retry callbacks can live in game-lifetime `modState` (probe 7). **But this import also reads `decisionSave` at :337, so the row remains until G4 replaces saveThreads.** No new general run-token or LLM-group API is needed. |
| `stores/bunnyfeedsThreads.ts → ./loop/stream` | **R/call** `:336`: sceneInProgress, paired with awaitingInput. **W** none. | Transient playback state. | **G4** rather than exposing stream internals. |
| `stores/bunnyfeedsThreads.ts → ./loop/promptState` | **R/call** `:300`: lessNsfwTextNow; `:306`: `reader()` returning native READER prompt text. **W** none. | Settings rule and a derived player/relationship/academic prompt view. | Existing `lessNsfwText()` covers the loaded-settings flag (it defaults true before load, whereas the internal helper defaults false; these calls occur after settings load). It does **not** cover `reader()`; **G6** is a narrow derived-text reader/re-export. |
| `components/BunnyfeedsThread.tsx → ../stores/characterStore` | **R/call** `:517`, `:521`: useSpriteVersion(charId) and profileUrl(charId,version) for a roster face. **W** none. | Image-cache version and native profile image URL, not saved mod data. | **G5**: expose those narrow native values, or one reactive profile-image source helper. `Character` data/`recordField` alone cannot provide cache invalidation. |
| `components/BunnyfeedsThread.tsx → ../stores/textingLoop` | **R/selector** `:84–86`, `:195`: epilogueOf and sceneActiveOf. The former is isGraduationSlot(date,time); the latter reads busy, currentSceneTranscript length and sceneSummary (`stores/textingLoop.ts:189–203`). **W** none. | Native clock and transient scene ownership of the screen. | Existing `isGraduationSlot` covers the pure epilogue calculation once **G1** supplies the clock. **G5** needs the scene-active getter/hook; `safePoint` has a different meaning. |

### Bunnyfeeds: data placement and older saves

Keep **`SocialPost.comments` as the native comment list**. Core explicitly owns this contract
(`src/shared/types.ts:946–947`; `src/shared/postComments.ts:1–45`), passes it into post-comment
hooks, filters by arrival slot and carries it across semesters. Moving the entire list into
Bunnyfeeds' private slice would stop those consumers seeing it without a separate core contract
change. Initial `filing.post.comments = ...` is already supported. Later replies/player comments
need a writer for that native list, not another `ex` bag.

Use a post-level `recordField('bunnyfeeds')` for `{ threadedThrough, heldMemories }`, with both old
keys as `legacy` and a normalizer preferring the stored slice. Use a comment-level handle for
Bunnyfeeds' extra comment fields (`player`, `charId`, `read`, `replyTo`, `tags`), preserving native
id/handle/emoji/text/at. Core's base `PostComment` does not declare `ex`; a structural
`PostComment & ModDataRecord` (or a mod-owned type augmentation) can carry it, and probe 9
confirms the existing serializer/load preserves that slice. Each record has **one** slice per mod; bundle the post's two values rather
than let separate handles overwrite that same slot. Registration of these pure handles alone
will not migrate or publish the existing posts/comments. Read old records first, publish a
replacement through a targeted writer, then save it. Keep the native comment date shifting;
update Bunnyfeeds' own carry adapter for its migrated progress and held-memory `at` values
(`src/shared/bunnyfeeds.ts:126–135`).

The global `feedReadThrough` can be part of a root `saveField('bunnyfeeds')` (alongside any other
root Bunnyfeeds data). Because its old location is nested in `bunnyboard`, root `legacy` cannot
claim a path such as `bunnyboard.feedReadThrough`: it names top-level keys, not paths. Claiming
the entire native `bunnyboard` as a mod-owned legacy key is the wrong ownership contract, not
a supported scoped migration of one nested marker. Seed the own value from a narrow
read of the old marker, retain that fallback until seeded, and leave the obsolete native key
alone or remove it through an explicitly scoped host migration. Alternatively use a
conversation/board record-field updater if that host record is made addressable. Preserve the
current missing/future-marker rule at load and semester carry, not only on first install.

Held memories belong to Bunnyfeeds; the resulting `CharMemory` belongs in **native memories**
so other prompts, affection calculations and the memory UI see it. A private save field with
identical text is not publication to those consumers. Preserve replacement of the previous
feed-origin memory and the delayed `at` gate. A new writer should identify mod-origin memory
explicitly; old suffix matches can be admitted by a reviewed legacy path, not as permission to
replace every other mod's memories.

### Bunnyfeeds: saving, reads and timing

`saveThreads` (`bunnyfeedsThreads.ts:335–337`) has the same scene/awaiting-input policy as Photo,
although it is fire-and-forget rather than awaited. It persists the native comments and held
memories that were just filed. `sceneField.save` can co-flush those existing mutations inside a
scene but cannot create them, and cannot handle phone visits outside a scene. `saveField.write`
is for a root slice, can refuse while another text call is unsettled, and uses manual on-line
save semantics at a quiet playing line. Neither is an unconditional replacement.

Do not delay *live* comment insertion until every scene/model call is safe to save. The round is
currently filed when its response lands; arrival stamps determine when it is shown. A postponed
write must not postpone the visible reply, overwrite a new post under an old async response,
re-ask an already answered thread after reload, or file a memory before the reply becomes visible.
Likewise marking a note read or setting own transient work is not a forbidden unsafe-point
operation: safe-point restrictions govern disk `write`, not every in-memory `set`.

Own retry/cancellation bookkeeping can move today: use the public run token and mod-owned call
group, and wake/cancel owned sleeps when a game-lifetime state resets. That does **not** clear the
whole loop/state row: `saveThreads` still reads `decisionSave` through that import. This is an
important difference between removing three imported names and clearing an allowlist row.

## Part 3 — Exact missing pieces for morrowkiln

**G1 — Read-only game records and clock.** Missing accessors/subscriptions are: `character(id):
Character | undefined`, `characterInfo(id): Readonly<CharInfo> | undefined`, `rosterIds(): readonly
string[]` (with alumni explicitly selectable), `conversation(id): Readonly<Conversation> |
undefined`, `feed(id): readonly SocialPost[]`, `npcRelationships(): Readonly<NpcRelationshipMap>`,
`clock(): { date: number; time: TimeSlot; season: Season }`, `playerStats(): Readonly<PlayerStats>`,
`playerProfilePicture(): string | null`, and the old feed-read marker during migration. Provide
component hooks or a narrow subscribe per domain, with stable immutable snapshots, not the game
store or its actions. Char keys can be derived with existing `charKeyOf`; ids/names already come
from `gameFacts/useGameFacts`. Supplied hook records should be used where present. None of the
field handles queries native characters, conversations, feeds, relationships or the clock.

**G2 — Publish a mod's slice on an existing live record.** The smallest record-field extension
is a bound `set(ref, next, { expect?, run? })` operation that finds the record and applies the
handle's own-id `with`, retaining all native keys and all other mods' slices. Address at least
`{ kind: 'message', charId, messageId }`, `{ kind: 'post', charId, postId }`, and
`{ kind: 'comment', charId, postId, commentId }`. Return a result distinguishing missing/stale
records; never resurrect a deleted record. Capture/recheck playthrough and load epoch, allow an
async caller to pass its existing run token, and keep `expect` scoped to the target/own slice.
This is a live update, not necessarily a disk write; the separate save policy follows G4.
Honor the active mod/session for user changes while retaining pure legacy reads when off.
`recordField.with` already does representation/migration, but has neither a target locator nor a
store binding. Top-level `writeModField(s)` writes root `ex`, not these nested slices.

**G3 — Native feed/memory actions, not arbitrary record replacement.** Bunnyfeeds needs a
host-owned `appendPostComments(modId, { charId, postId }, comments, { run?, expect? })` and the
native like toggle, plus `replaceFeedMemory(modId, charId, previousOwnedRef | null, next,
{ run? })` that publishes to native memories. Preserve concurrent comments/photo slices and
reject stale/deleted targets; use existing `ownsPostComments` to respect the active comment owner.
Batch reply append, progress and held-memory changes when a round is filed. A review may choose a domain transaction combining native comment append with G2's
own-id slice changes. Photo's special held insertion currently appends itself because setting
`filing.held` suppresses core append **and its early nudge** (`loop/feed.ts:113–119`). The minimal
fix may instead let ordinary filing append the decorated post while honoring `postVisible`
before nudging; Photo can already use the retained `ctx.nudge` when the picture comes out.
Otherwise give that filing a narrow `storeHeld(post)` capability. Do not export a general
`setState`, arbitrary post updater or native save roots. Existing `fileFeedPost`/`fileLatePost`
already cover initial ordinary posts/comments and should be reused.

**G4 — Persist settled mod record changes against the loop's checkpoint.** A scoped
`saveRecordChanges(modId, { run?, deferWhileScenePlaying: true }):
Promise<Result<{ written: boolean }>>` should retain the mods' current policy: preserve the last
decision-point scene, write immediately outside a scene or at the reader's input point (even
when unrelated texting is unsettled), and defer mid-line/stream changes to core's next write.
It must share core's queue, fence loads, and distinguish deferred/skipped/failed from a successful
written checkpoint. If the core chooses to return a completion receipt for deferred writes,
state that explicitly; an in-memory set is not a receipt. Photo can keep its current main-side
retirement guard in either design. No mod gets to supply a scene checkpoint or mutate it.
`saveField.write` has stricter safe-point conditions and different scene selection;
`sceneField.save` has a useful active-scene subcase but no no-scene path. A design based on
per-record `write` handles can combine G2 and G4; they are separate responsibilities here to
show precisely what already exists.

**G5 — Existing native UI readers, narrowly exposed.** Bunnyfeeds needs the current
`profileUrl(charId, version, staged?)` and `useSpriteVersion(charId)` values (or
`useProfileImageUrl(charId): string` encapsulating both), and `sceneActive()/useSceneActive():
boolean` using core's exact scene-ownership predicate. The scene reader plus G1's clock and
existing `isGraduationSlot` replaces the textingLoop selectors. These are image-cache/UI reads,
not a reason to expose characterStore or textingLoop, and not something `safePoint` answers.

**G6 — Native reader prompt text.** Expose a narrow `readerPromptText(): string` delegating to
`loop/promptState.reader()` (or its native pure builder with a host-supplied view). It derives
player profile, stats, cold, semester/academic reputation and relationship standing, not just
`gameFacts().readerName`. See `prompts/setting.ts:140–159,182–198`. The #257 prompt-helper
re-exports cover the *girls'* relationship/profile/memory lines, not this reader block.
`lessNsfwText` already covers the other imported helper after settings load.

These are proposed interface shapes to discuss, not six required separate PRs. In particular,
G1/G5/G6 are readers or re-exports; G2/G3 are scoped publishing operations; G4 is an existing
checkpoint policy exposed safely. They do not imply that #160/#166's mod-data support is absent.

## Part 4 — Row counts

The current main boundary scanner reports **Photo 27, Bunnyfeeds 22**. These counts below are
projections after the assumed switches, not a claim that source migrations were performed in
this report branch. A cleared row requires every use in the row to move. The data-model
alternative of centralizing all metadata in root maps is not counted as a per-record switch.

| Stage | Photo | Bunnyfeeds | Explanation |
|---|---:|---:|---|
| Main fd428363 before the assumed switches | 27 | 22 | Actual scanner inventory. |
| After #257's switches | 17 | 13 | Ten Photo rows and nine Bunnyfeeds rows clear. |
| After #257 and #258's Photo main switch | 15 | 13 | Photo's two preload rows go with that file; these PRs alone do not switch the mods. |
| Of the investigated state/save rows, clear with existing APIs alone | **0 / 14** | **0 / 13** | Several operations are covered, but every row still has at least one missing reader, publisher or save-policy use. In particular Bunnyfeeds loop/state still reads decisionSave. |
| Of the investigated rows, clear with G1–G6 and the described switches | **14 / 14** | **13 / 13** | Reuse existing fields/hooks/cancellation where applicable; migrate the remaining uses. |
| Total rows left after those gaps are filled | **1** | **0** | Photo's EchoPanel row remains a separate cross-mod gallery-slot design. |

Existing APIs thus cover **substantial operations**, without completely clearing one of the
specified remaining rows by themselves. This is a claim about these exact imports, not a claim
that every one of their imported values needs a new API.

## Part 5 — Probes and how to rerun

Ran on main fd428363 with real kit handles, real game-store serialization/load and the native
save queue; only the bridge's autosave transport is replaced by a temporary JSON-file writer.
Tests use host-only store mutation to arrange a state or publish a returned record. That setup
is deliberately **not** presented as an API available to a migrated mod. No ComfyUI or LLM calls
were made.

| Probe | Result |
|---|---|
| 1. Read legacy photo, transform with recordField, save before/after publishing replacement, reload | Pure transformation leaves live message unchanged. After explicit host publication and queued save, the Photo-shaped slice survives JSON and core load; legacy photo is removed and another mod's ex survives. |
| 2. Root saveField.write while scene is busy/streaming | MOD_WRITE_WAIT; no autosave call. |
| 3. Quiet current line still playing, awaitingInput false | safePoint is open; saveField.write succeeds and saves a two-line resumable on-line scene, while decisionSave still has one line. This differs from both mods' skip gate. |
| 4. sceneField.save during streaming after host applies a photo and reply | Succeeds; saved scene retains its one-line decision checkpoint and own scene key; current photo ex and native post comments are also serialized. |
| 5. sceneField.save with no scene | MOD_WRITE_NO_SCENE; no write. |
| 6. saveField.set during streaming | No immediate write; own root data is present in the next native autosave. |
| 7. Mod-owned parked retry cancellation | Game-lifetime modState reset notifies an owned cancellation callback; existing runStale rejects the old run. No loopState export needed for these parts. |
| 8. saveField.write outside a scene at an open point | Own root slice persists successfully; saved scene is null. |
| 9. Post and comment record slices | Both survive JSON/native load; comments remain in the native list. |
| 10. A cleared photo slice plus stale legacy photo | Explicit stored null wins; the old attachment is not resurrected. |

To reproduce, use a disposable checkout at fd428363 with dependencies installed. Copy the
following block to `test/modDataGapProbe.test.ts` and run
`npx vitest run test/modDataGapProbe.test.ts`; individual cases can be selected with `-t` and
an identifying phrase from the table/test names. Remove the file afterwards. The detached probe
worktree was removed after the run; neither it nor a probe source file was committed. These are
focused investigation checks, not a full-suite or manual-render verification claim.

```ts
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { installMods } from '@shared/mods'
import type { GameSave, SaveDraft } from '@shared/types'
import { character, charInfo, playthroughRecord, restoreApi, sceneLines, stubApi } from './fixtures'

stubApi({ jobs: { onProgress: () => () => {} } })
const kit = await import('@vx/modkit/renderer')
const { useGameStore: game } = await import('../src/renderer/stores/gameStore')
const { useBunnyboardStore: phone } = await import('../src/renderer/stores/bunnyboardStore')
const { writeAutosave, writesSettled } = await import('../src/renderer/stores/loop/saves')
const { loopState, resetLoopState } = await import('../src/renderer/stores/loop/state')
installMods([{ id: 'gap-probe', name: 'Probe', author: 'test', version: '1.0.0',
  scope: 'anytime', defaultOn: true, blurb: '' }])
const photo = kit.recordField<any>('gap-probe', {
  empty: null, legacy: ['photo'], normalize: (stored, legacy) => stored !== undefined ? stored : legacy.photo ?? null
})
const own = kit.saveField('gap-probe', { empty: { n: 0 } })
const scene = kit.sceneField('gap-probe', { empty: 0 })
const lifetime = kit.modState<{ cancel: () => void } | null>('gap-probe', { initial: null, lifetime: 'game' })
const old = { tier: 'everyday', scene: 'At the cafe', file: 'sarah_chat_001.png' }
const next = { ...old, file: 'sarah_chat_002.png' }
let root = ''
let autosave: ReturnType<typeof vi.fn>
const saved = async (): Promise<GameSave> => JSON.parse(await readFile(join(root, 'auto.json'), 'utf8'))
const message = () => game.getState().bunnyboard.conversations.girl.messages[0]
function putMessage(value: any) {
  const board = game.getState().bunnyboard
  game.setState({ bunnyboard: { ...board, conversations: { girl: { messages: [value] } as never } } })
}
function active(streaming = false) {
  const lines = sceneLines('Checkpoint.')
  game.setState({ currentSceneTranscript: lines, sceneLog: lines, awaitingInput: true })
  loopState.decisionSave = game.getState().captureScene()
  game.setState({ currentSceneTranscript: [...lines, ...sceneLines('New reply.')],
    currentLine: sceneLines('A line still playing.')[0], awaitingInput: false,
    busy: streaming, streaming })
}
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'mod-gap-'))
  game.getState().reset(); phone.getState().reset(); resetLoopState()
  game.setState({ playthroughId: '1', chars: ['girl'], characters: { girl: character({ charId: 'girl' }) },
    charInfo: { girl: charInfo() } })
  putMessage({ id: 'm', sender: 'contact', text: 'Hi', date: 0, time: 0, photo: old,
    ex: { other: { v: '1', data: { kept: true } } } })
  autosave = vi.fn(async (pid: string, draft: SaveDraft) => {
    const value = { ...draft, playthroughId: pid, saveId: 'auto', saveDate: '2026-11-04' }
    await writeFile(join(root, 'auto.json'), JSON.stringify(value))
    return { ok: true, data: value }
  })
  stubApi({ saves: { autosave } as never })
})
afterEach(async () => { await writesSettled(); restoreApi(); await rm(root, { recursive: true, force: true }) })

it('recordField transforms a copy; only a host record update plus a save makes it survive reload', async () => {
  const updated = photo.with(message(), next)
  expect(photo.read(message())).toEqual(old)
  expect(updated.photo).toBeUndefined()
  expect(updated.ex?.other.data).toEqual({ kept: true })
  await writeAutosave(null)
  expect((await saved()).bunnyboard.conversations.girl.messages[0].photo).toEqual(old)
  putMessage(updated) // Host-only setup: recordField itself has no live record setter.
  await writeAutosave(null)
  game.getState().loadSave(await saved(), playthroughRecord({ chars: ['girl'] }), { girl: character({ charId: 'girl' }) })
  expect(photo.read(message())).toEqual(next)
  expect(message().photo).toBeUndefined()
})
it('safe-point writes refuse a streaming scene', async () => {
  active(true)
  expect(kit.safePoint()).toBe('waiting')
  expect(await own.write({ n: 1 })).toMatchObject({ ok: false, error: { code: 'MOD_WRITE_WAIT' } })
  expect(autosave).not.toHaveBeenCalled()
})
it('a quiet playing line can be a safe point although Photo and Bunnyfeeds skip saving there', async () => {
  active()
  expect(game.getState().awaitingInput).toBe(false)
  expect(kit.safePoint()).toBe('open')
  expect(await own.write({ n: 2 })).toMatchObject({ ok: true })
  expect((await saved()).scene?.resumeOnLine).toBe(true)
  expect((await saved()).scene?.transcript).toHaveLength(2)
  expect(loopState.decisionSave?.transcript).toHaveLength(1)
})
it('sceneField.save keeps the checkpoint yet flushes already-applied record changes during streaming', async () => {
  active(true)
  putMessage(photo.with(message(), next)) // Host-only setup, not supplied by sceneField.
  const before = game.getState().charInfo.girl
  game.setState({ charInfo: { girl: { ...before, feed: [{ id: 'p', text: 'Post', date: 0, time: 0,
    likes: 0, comments: [{ id: 'c', handle: 'h', emoji: '', text: 'reply', at: 0 }] }] } } })
  expect(await scene.save(7)).toMatchObject({ ok: true })
  const value = await saved()
  expect(value.scene?.transcript).toHaveLength(1)
  expect(value.scene?.mods?.['gap-probe']).toBe(7)
  expect(photo.read(value.bunnyboard.conversations.girl.messages[0])).toEqual(next)
  expect(value.charInfo.girl.feed?.[0].comments?.[0].text).toBe('reply')
})
it('sceneField.save cannot replace the no-scene autosave path', async () => {
  expect(await scene.save(8)).toMatchObject({ ok: false, error: { code: 'MOD_WRITE_NO_SCENE' } })
  expect(autosave).not.toHaveBeenCalled()
})
it('saveField.set changes live data during streaming and goes out with the next host save', async () => {
  active(true)
  own.set({ n: 3 })
  expect(autosave).not.toHaveBeenCalled()
  await writeAutosave(loopState.decisionSave)
  expect((await saved()).ex?.['gap-probe'].data).toEqual({ n: 3 })
})

it('mod-owned cancellation can wake parked retries on a game boundary without loopState', () => {
  const cancel = vi.fn()
  lifetime.set({ cancel })
  const stop = lifetime.subscribe(value => { if (value === null) cancel() })
  const run = kit.currentRun()
  game.getState().reset()
  resetLoopState()
  expect(cancel).toHaveBeenCalledOnce()
  expect(kit.runStale(run)).toBe(true)
  stop()
})
it('saveField.write already persists its own root slice outside a scene', async () => {
  expect(kit.safePoint()).toBe('open')
  expect(await own.write({ n: 9 })).toMatchObject({ ok: true })
  expect((await saved()).ex?.['gap-probe'].data).toEqual({ n: 9 })
  expect((await saved()).scene).toBeNull()
})
it('post and comment slices survive native serialization and reload without moving native comments', async () => {
  const comment = photo.with({ id: 'c', handle: 'h', emoji: '', text: 'reply', at: 0, ex: {} }, { read: true })
  const post = photo.with({ id: 'p', text: 'Post', date: 0, time: 0, likes: 0, comments: [comment], ex: {} },
    { threadedThrough: 4, heldMemories: [] })
  game.setState({ charInfo: { girl: { ...charInfo(), feed: [post] } } })
  await writeAutosave(null)
  game.getState().loadSave(await saved(), playthroughRecord({ chars: ['girl'] }), { girl: character({ charId: 'girl' }) })
  const restored = game.getState().charInfo.girl.feed![0]
  expect(photo.read(restored)).toEqual({ threadedThrough: 4, heldMemories: [] })
  expect(photo.read(restored.comments![0] as any)).toEqual({ read: true })
  expect(restored.comments![0].text).toBe('reply')
})

it('an explicitly cleared slice wins over a stale legacy photo', () => {
  expect(photo.read({ photo: old, ex: { 'gap-probe': { v: '1.0.0', data: null } } } as any)).toBeNull()
})
```
