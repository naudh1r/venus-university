# Story Memory and SQLite source port

This optional source mod belongs on the `extracurriculars-core` framework. Its switch is
`story-memory`, scope `anytime`, default on, with no required mods. It is independent of
journals, Plot Twist, Breakthrough, City Life and Text Regeneration.

## What the player gets

Open **Menu → Story Memory…** during a playthrough. The page lists lasting facts and past
encounter recaps. Filter by character or search their text. Select a row to see its evidence,
correct it, or hide it from enhanced recall. **Show hidden recall** makes hidden rows available
to restore. **Add fact** creates a player-authored correction for this playthrough.

Each fact records its subject, category, timeline, whether it is an event or a claim, who said
the claim, who knows the information, and whether it is public. Clearing every knowledge box
makes it narrator-only. Being the subject does not automatically mean knowing the fact.

These edits affect future generated responses. They do not change relationship scores,
relationship flags, grades, inventory, past dialogue, or the original history summaries.
The game's existing character notes remain available on character profiles and are unchanged.

Turn the mod off in **Mods** to stop extraction, indexing and additional prompt recall. Saved
facts and corrections remain, so turning it on again restores access. Mod settings themselves
still follow the framework's existing storage/backup rules.

## Architecture summary

Story Memory keeps lasting facts and recall corrections in `GameSave.exStoryMemory`.
An enabled ledger extracts candidates backed by generated scene evidence; the slot boundary
validates and files them. Pure builders attach a local snapshot, and the platform bridge
selects bounded recall before stripping that snapshot from the cloud request. The desktop's
per-playthrough SQLite file is a replaceable index of the active save, never an authority
over it. The browser and unavailable native indexes use the same save-based selector. The
dedicated Game-menu editor commits through the serialized save lane before changing visible
state. Off retains data and stops extraction/recall; native character notes are unchanged.

## Ownership: the save is authoritative

`GameSave.exStoryMemory` is optional. A base save without it loads with an empty collection;
the save schema stays at version 12. Loading normalizes the optional data defensively. Saving
exports it alongside the other mutable game state, even while the mod is disabled.

The collection has the earlier mod's `version: 1` shape: `facts`, `edits`, `hidden`,
`encounterSubjects`, and `encounterEdits`. Compatible values can be read without the old
renderer patch wrappers. This is **not** a migration of an incompatible base-game save schema.

The desktop cache is generated lazily at:

```text
data/saves/<playthroughId>/story-memory.sqlite
```

No database is distributed. The code never opens a private user database while building or
testing this port. Test databases contain synthetic records in temporary directories.

The database is an index of the supplied save, not an archive that restores missing facts into
that save. Before retrieval, a SHA-256 fingerprint checks the complete selected record set and
playthrough ID. If it differs, one transaction replaces the index. Loading an earlier save,
editing a recap, hiding a fact, or branching from a past save therefore replaces the indexed
records rather than merging them with the old future. A failed transaction rolls back.

Every query uses the snapshot passed with that request. The service closes its connection
before returning. It never creates a missing playthrough directory. Deleting a playthrough
deletes its index with that directory; a backup restore swaps the saves directory and drops
old caches. The native backup exports explicit save records rather than arbitrary folder
contents, so facts travel in the JSON saves and the cache rebuilds after restore.

SQLite files are ordinary local files, not encrypted vaults. Do not publish runtime save
folders or database files. `.gitignore` excludes the cache, its journal and its sidecars.

## What is remembered automatically

The existing end-of-scene ledger request gains an `exStoryFacts` array only while the mod is
on. There is no extra LLM call. At most eight new lasting developments are requested: promises,
roles, secrets, explicit relationship developments, completed changes and other important
facts. Routine affection reactions remain the native game's responsibility.

The model must supply a short exact quote from generated scene dialogue/narration. At the
slot boundary, after native memory editing and before the clock advances, `acceptStoryFacts`
checks each candidate against the completed scene. Player action lines alone cannot establish
that an attempted action succeeded. Unknown subjects, outside-cast knowers, invalid categories,
unsupported claims and missing evidence are discarded.

Quotes establish a source, not mathematical proof that a model's interpretation is correct.
Players can correct interpretations in the editor. Claims remain claims; a promise is the
fact it was made, not proof it will be fulfilled. Timelines are ordinary metadata and never
enable a separate storyline or introduce time travel automatically.

A stable slot/content ID deduplicates extraction. Replaying a boundary replaces that batch's
automatic facts, preserving player corrections. A later fact may supersede an older fact only
when subject, category, timeline and event/claim type match. Automatic extraction cannot
supersede manual facts or player-edited facts.

The completed ledger is already banked with the native pending ending. The accepted facts
land on the boundary save. Interrupting an uncommitted ending does not add its candidates to
durable memory. If a line is edited before acceptance and the quote no longer matches, the
candidate does not enter the collection.

Existing saves immediately benefit from their retained history. Old scenes are not sent to
an LLM for retroactive extraction, and lost detail cannot be reconstructed from a short recap.
Players can add missing facts manually. There is a 3,000-fact storage cap; new extraction stops
at capacity rather than silently dropping established facts. The editor also refuses an
additional manual fact at capacity; existing facts remain editable.

## Retrieval and prompt cost

### Optional Light memory

In **Mods → Story Memory → Options**, **Light memory** is off by default. Standard mode
keeps the existing selection and formatting. Turning Light memory on changes future requests;
an already prepared/in-flight request may finish with its previous context. The preference
is stored in `mods.json` as `story-memory:light-memory`, not in the save's fact collection.

Light recall has a 6,000-character total budget, including instructions, with a 3,600-character
fact allowance and at most two encounter excerpts. Facts prioritize relevant player corrections,
present characters, matching topics, and key reader facts. An unrelated fact no longer qualifies
solely because the reader knows it. Recaps favor topic matches with one per present character
first. Selected sentences are verbatim and marked as partial narrator references; long manual
recap corrections are kept whole if they fit, or omitted. No cloud summarization is added.

The compact fact reference retains who knows a fact, claim/event distinctions, the claimant,
public/private status, dates, original semester, timeline and correction status. Evidence and
internal IDs remain in the save; they are omitted from scene recall. Exact duplicate reference
rows can be omitted without merging different knowledge scopes. Shorter context can miss older
or less relevant detail: switch Light memory off when fuller recall is desired.

Light ledger extraction keeps the same schema, evidence validation and eight-development limit.
It sends up to 2,500 characters of prior facts ranked against the scene and its cast, instead of
up to 6,500 characters from the first 80 saved facts. The full fact collection and encounter
history remain available for editing, searching, future recall and semester carryover.

Desktop and browser services read the current switch before preparing recall. Native SQLite
and the fallback share selection/formatting. Disabling Story Memory still disables extra recall
and extraction regardless of this option. Echo is not required; this change can be ported into
the shared source as an independent Story Memory update.

Tests: `test/storyMemoryLight.test.ts` covers bounded context, relevance, claims, knowledge,
corrections, prior semesters, duplicate scopes, ledger selection and SQLite parity;
`test/storyMemoryService.test.ts` covers live options, persistence at the platform boundary,
fallback and disabled behavior. These checks do not establish live-model narrative quality.

`storySnapshot` builds records from the active save's history and fact collection. Character
IDs are the stable on-disk IDs, never display names or filenames derived from user text. Cast
membership recorded at completed boundaries is used for relevance. Older recaps fall back to
full names or unambiguous first names, which establishes relevance, **not** witnessed knowledge.

The selector ranks manual facts first, then keyword relevance and recency. It also takes two
recent encounters per involved character, round-robin, and up to three older keyword matches.
The final formatter enforces a total maximum of **18,000 characters**, including its instructions,
with at most 6,500 characters of fact rows. Long encounters are clipped to 5,000 characters for
this reference. These are character budgets, not guaranteed token counts. Unrelated character
encounters and future-dated rows are excluded. Facts about the reader can serve as narrator
context; the explicit knowledge metadata prevents treating them as automatically shared facts.

Scene, solo, text and slot-opening builders attach a local `storyMemory` snapshot to their
`StructuredRequest`. At the platform boundary the service selects recall, prepends the bounded
reference, and strips the snapshot field before calling the cloud transport. The original
request and immediate action remain after the reference. Existing `logFrom` offsets are shifted
to preserve their meaning. The complete index is never handed to an LLM adapter.

The ledger's existing-fact reference is also capped at 6,500 characters (up to 80 rows), plus
its extraction instructions and schema. The fact extraction reuses an existing call but adds input/schema and output tokens. Selected
recall increases later request sizes. SQLite is a local lookup/storage optimization; it does
not enlarge the provider's model window or make extra context free. Native context and other
mods' context have their own budgets, so 18,000 is the cap for **this mod**, not the whole request.

No embeddings, network database, telemetry endpoint or background summarization service is
added. Generation still uses the player's configured provider. Relevant fictional memories
are sent through those normal requests; “local SQLite” does not mean “offline generation.”

## Desktop and browser behavior

The desktop lazily imports Node's built-in `node:sqlite`. It enables no extension loading and
uses parameter-bound SQL. Queries never accept SQL or a filesystem path from the renderer.
The IPC boundary validates IDs, timestamps, field types, duplicate IDs, lengths and payload
size. The cache is capped at 10,000 records / a 20 MiB serialized-record budget, prioritizing
facts and newer encounters for unusually large histories; incoming IPC has a 24 MiB limit.

If SQLite is unavailable, locked, corrupt, or has an unsupported schema, recall uses the same
deterministic selector over this request's save snapshot. The editor shows the fallback. It
does not overwrite an unrecognized/corrupt cache to repair it automatically. A malformed
optional snapshot is skipped without costing the normal generation request. Logs do not
include raw SQLite errors, paths, or indexed text added by this service.

The web build uses the same save-based selector, while its saves continue to live in the game's
IndexedDB storage. It reports **Save snapshot**, not SQLite. It does not pretend a native
SQLite database is running in the browser.

## Editor write safety

`writeStoryMemory` joins the native serialized save-write lane. Editing waits for narration,
text replies, retries and ending bookkeeping to settle. The page blocks changes during a
scene ending even when a native manual save could be offered there.

An edit captures playthrough ID, load counter and previous collection identity, then writes a
resumable autosave containing the proposed collection. The visible collection changes only
after the write succeeds and the captured identity still matches. A failed write keeps both
the original collection and original history. Leaving/loading waits for queued native writes;
a late callback cannot inject its collection into a newly loaded game. Cancel/Escape while
editing discards the form; Back from the browsing page returns to the Game menu.

## Integrating the other source ports

Each source PR was independently based on the clean framework. Merge shared imports, mod
registrations, optional save fields, menu entries and test expectations rather than choosing
one side wholesale. This PR does not bundle or require the other features.

- **Playthrough Renaming:** the cache belongs to `playthroughId`, not its display label, so
  renaming does not change identity or move a database.
- **Custom Soundtracks:** separate settings and storage; no dependency or hook.
- **City Life:** ordinary native scene history from those venues is recalled like other scenes.
  There is no hard-coded venue list in the memory system.
- **Plot Twist:** retain its optional save state and dedicated prompt block. An unused intended
  twist is not an established fact. Do not index requested twists as completed events. Actual
  generated events can become evidence-backed facts through the ledger.
- **Breakthrough:** keep its meters, activation, refunds, outcome reconciliation and dedicated
  continuity block. This index does not ingest `exBreakthrough.moments` or repeat the success
  bonus. A completed outcome may be condensed into an ordinary ledger fact just as any scene
  may. The dedicated excerpt and condensed fact can overlap semantically; their independent
  prompt caps are additive. If a later integration indexes raw Breakthrough outcomes, use its
  stable IDs, reconcile edits/rewinds, and replace its direct continuity injection to avoid
  sending the same excerpt twice.
- **Meanwhile:** its dramatized NPC-only conversations are deliberately not indexed as things
  the reader witnessed or as verified memories for the participants. Keep that optional cache
  separate. A generated watch scene must never run this scene-ledger extraction path.
- **Text Regeneration:** normal and regenerated replies use the same `buildTextingPrompt`
  builder and its enabled DM request hooks. The Story Memory adapter uses a supplied
  `storyMemory` snapshot or reads `currentStorySnapshot()` when it is absent. The regeneration
  call needs no separate memory-specific field. This port indexes history and durable facts,
  not raw text bubbles or the rejected thread summary; Text Regeneration owns the replacement
  conversation. Both requests pass through the platform's story preparation wrapper.

## Code map

| File | Responsibility |
| --- | --- |
| `src/shared/storyMemory.ts` | Optional-save normalization, snapshots, IDs, acceptance, selection, budgets and privileged-boundary validation |
| `src/main/services/storyMemoryIndex.ts` | Real SQLite schema, fingerprint replacement transaction and candidate queries |
| `src/main/services/storyMemoryService.ts` | Per-playthrough file ownership, native import, switch check, fallback, request preparation |
| `src/web/storyMemory.ts` | Browser recall and switch check without native SQLite |
| `src/renderer/prompts/storyMemoryPrompt.ts` | Optional extraction schema/instructions added to the existing ledger |
| `src/renderer/stores/storyMemory.ts` | Current save snapshot and read-only editor status bridge call |
| `src/renderer/stores/loop/saves.ts` | Atomic editor write lane and stale-result guards |
| `src/renderer/stores/gameLoop.ts` | Opening snapshot and slot-boundary acceptance |
| `src/renderer/stores/loop/promptState.ts` | Pure builders' optional current snapshot |
| `src/renderer/stores/textingLoop.ts` | Snapshot passed to normal texting |
| `src/renderer/prompts/scenePrompt.ts`, `textingPrompt.ts`, `slotIntroPrompt.ts` | Scope recall to each request's cast/query |
| `src/renderer/views/StoryMemoryModal.tsx` and `vu_styles/StoryMemory.css` | Dedicated themed editor, sources, hide/restore and native button motion |
| `src/shared/types.ts`, `saveRules.ts`, `renderer/stores/gameStore.ts` | Optional state load/save, request and ledger types |
| `src/main/ipc.ts`, `preload/api.d.ts`, `preload/index.ts`, `web/bridge.ts` | Typed inspection API and provider-boundary preparation |
| `src/shared/modEntries/story-memory.ts`, `GameMenuModal.tsx`, `GameView.tsx` | Independent switch, carry registration and dedicated menu entry |
| `src/renderer/modEntries/story-memory.ts` | Automatically discovered request and settled-slot hooks |
| `test/storyMemory.test.ts`, `test/storyMemoryService.test.ts` | Save integrity, real SQLite behavior, isolation, fallback, failure and switch tests |

## Verification and limits

Run `npm run typecheck`, `npm test`, `npm run build` and `npm run build:web`. SQLite tests use
the real Node module and synthetic temporary databases. They cover transaction rollback,
snapshot replacement, playthrough isolation, ranking parity, SQL-bound input, malformed data,
disabled behavior, fallback, fact evidence and durable editor writes.

UI checks use synthetic characters and a stubbed save service, with no real provider call or
user save. Check the editor in day/night at 16:9 and 4:3, add/edit/hide/restore, failed writes,
the fixed footer, and the menu entry's motion. A desktop build is not a live-model or full
packaged-Electron playthrough test. The local dependency set lacks the Electron executable,
so native-runtime smoke testing remains a maintainer check; Node's real SQLite service tests
and both platform builds do pass. The fallback covers an unavailable native SQLite module.

This source PR is reviewed independently. The other source PRs are not silently merged into
it, and a combined runtime still needs the merge steps above and a full integration test.

## Registration on core 0.3.1

- `src/shared/modEntries/story-memory.ts` supplies its existing mod definition and carry registration.
- `src/renderer/modEntries/story-memory.ts` loads the hooks automatically at boot.

The stable IDs, defaults, dependencies, save fields and gameplay behavior are unchanged. Native character notes, scene-creator saves and calendar replays retain their 0.3.1 behavior. Merge framework updates from `core` into this mod branch; resolve conflicts with `main` on a separate `integrate/story-memory` branch.
