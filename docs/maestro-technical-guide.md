# Maestro mods: technical handoff

Read [the feature index](maestro-mods.md) first. This guide maps the source modules,
save contracts and extension points. Release-specific compatibility results belong in the
pull request or release notes; they do not establish compatibility with future game updates.

Campus Talents, Starting Challenge and Godlike Standards are independent modules.
The [Godlike Standards guide](mods/godlike-standards.md) covers the opt-in gold trait,
attraction requirements, milestone checks and character portability.

`TalentArtwork.tsx` maps 43 stable skill IDs to transparent PNGs in
`src/renderer/assets/talents/`. `TalentPanel.tsx` uses them on cards, details and
Personal Growth; unknown extension skills fall back to the generic talent mark.
See [asset provenance](mods/talent-artwork.md).

## 1. Read the project in this order

1. [README](../README.md) for the build and [feature index](maestro-mods.md) for scope/defaults.
2. [MODDING](../MODDING.md) for the shared framework contract and branch workflow.
3. [DESIGN_GUIDE](../DESIGN_GUIDE.md) and [UI_STYLE_GUIDE](../UI_STYLE_GUIDE.md) for native
   save, request, layout and motion conventions. The implementation wins over stale prose.
4. The relevant `docs/mods/` guide below, followed by the shared pure functions and tests.
5. Renderer store actions, native save writers and IPC services before changing a UI button.

Do not begin by editing the compiled renderer asset or an installed ASAR. The current project
is TypeScript source with a reproducible build. Old 1.x installer scripts and archived handoffs
describe different base-game layouts; they are not patch recipes for this source tree.

## 2. Architecture and ownership

Electron's **main** process owns disk/network/process work. The **preload** bridge exposes
typed operations. React/Zustand **renderer** stores coordinate actions and views; prompt
builders compose bounded context. **shared** modules hold types, normalization and pure
calculations used by both desktop and browser. [saveRules.ts](../src/shared/saveRules.ts)
currently defines save schema 13, playthrough record schema 3 and enrollment schema 3.
The native validator has a version-12-to-13 step; optional mod fields do not create a separate
top-level save schema. This is not an unrestricted importer for older modified formats.

| Area | Entry points | Why they matter |
| --- | --- | --- |
| Mod definitions | [mods.ts](../src/shared/mods.ts), [shared entries](../src/shared/modEntries/) | Stable IDs, scopes, defaults, requirements and grouped options. Eager file discovery avoids a single hand-maintained registry list. |
| Runtime hooks | [renderer entries](../src/renderer/modEntries/), [hooks](../src/renderer/mods/hooks.ts) | Each enabled mod registers only the capabilities it needs. Preserve other authors' entries when integrating. |
| Enablement | [modsStore](../src/renderer/stores/modsStore.ts), [gameStore](../src/renderer/stores/gameStore.ts) | Menu preferences and immutable per-playthrough selections are different inputs. Shared arithmetic receives the running playthrough's effective switches. |
| Game cycle | [gameLoop](../src/renderer/stores/gameLoop.ts), [loop modules](../src/renderer/stores/loop/) | Generation, ledgers, status editing, boundary settlement and clock advance have distinct phases. |
| Durable writes | [loop/saves](../src/renderer/stores/loop/saves.ts) | Existing serialized write lane, resumable scene snapshots and ownership checks. |
| Semester carry | [modCarry](../src/shared/modCarry.ts), individual carry registrations | Each owner carries only its fields; native New Game+ owns the semester. Disabled mods retain their data where registered. |
| Platform edge | [IPC](../src/main/ipc.ts), [API types](../src/preload/api.d.ts), [web bridge](../src/web/bridge.ts) | Renderer code never accepts arbitrary filesystem paths or bypasses the typed boundary. Desktop/browser capabilities differ. |

`data/mods.json` stores mod preferences. Missing switches use defaults. A `playthrough` mod
uses the playthrough record's selection; changing the main-menu preference does not rewrite
that record. An `anytime` mod reads effective enablement at its action/request boundary.
Turning a feature off should stop its activity while preserving its optional state.

**Hooks are not universal transaction middleware.** Use an existing hook when it covers the
action. A numerical feature may still need a narrow consumer in the native grade, work, shop
or relationship calculation. Registering a menu button alone does not safely implement that
effect. Follow the exact ordering/combination rules in MODDING; do not assume every hook is
first-result-wins or that another mod's prompt output has become established story fact.

## 3. The common save-safe action pattern

For a user mutation such as editing a fact, buying a skill or spending spirit:

1. Validate the input, effective switches, dependencies and whether the game can save safely.
2. Capture ownership: playthrough ID, load generation/run token, relevant slot and state identity.
3. Enter the existing writer queue. Recheck eligibility when the operation actually runs.
4. Build from the native resumable save draft, preserving pending scene/checkpoint fields.
5. Write the proposed result. Publish the matching live state only after a successful write.
6. Ignore a late result for a different loaded game. A failed write must leave the old state intact.

Some paid scene actions charge synchronously before dispatch and reconcile/refund using a
pending token instead. Breakthrough's implementation documents that variant; do not replace
its token with a generic balance adjustment. Test failures, cancelled requests, a load while
waiting, interrupted endings and retries—not just the happy-path button.

Never use an older whole-state snapshot to overwrite newer unrelated conversations, money or
read receipts. When changing save projection, verify `gameStore`, native draft creation,
status/exit checkpoints, enrollment and semester carry together. In particular, an off switch
is not permission to erase saved optional fields.

## 4. Module-by-module implementation map

### Plot Twist

[Guide](mods/plot-twist.md), [rules](../src/shared/plotTwists.ts),
[prompt](../src/renderer/prompts/plotTwist.ts), [save field/editor state](../src/renderer/stores/plotTwist.ts),
[legacy carry adapter](../src/shared/plotTwistCarry.ts).

`save.ex['plot-twist'].data` is one direction per save, editable up to 10,000 JavaScript string characters.
The registered field reads old `exPlotTwist` saves; an explicit empty slice wins over legacy text.
Its `carry` preserves the direction when switched off. The editor uses public `useSafePoint`,
`saveField.write` and a game-lifetime `modState` token, including when two saves have identical text.
Applying/clearing is a queued autosave transaction. Scene builders append a bounded copy to
future cast/solo requests. It is guidance, not a mechanical event, and is not directly added
to text messages, classifiers or ledgers. Disabling it preserves the text; already captured
requests retain their original prompt. An intended twist must never be indexed as a fact
unless generated evidence later supports what happened.

### Story Memory and SQLite

[Guide](mods/story-memory.md), [shared rules](../src/shared/storyMemory.ts),
[SQLite index](../src/main/services/storyMemoryIndex.ts),
[native service](../src/main/services/storyMemoryService.ts),
[browser fallback](../src/web/storyMemory.ts), [carry](../src/shared/storyMemoryCarry.ts).

`exStoryMemory` is authoritative. It holds durable facts, manual corrections, hidden rows
and encounter metadata. The existing end-of-scene ledger requests at most eight developments;
local validation checks quoted generated evidence, subjects, claim/event distinctions and
who knows each fact. A player saying that an action succeeded is insufficient evidence.
Manual corrections survive automatic extraction; the collection caps at 3,000 facts rather
than silently dropping established ones.

`data/saves/<playthroughId>/story-memory.sqlite` is a disposable index. A fingerprint of the
request's active snapshot controls a transaction that replaces stale indexed rows. Loading an
older save therefore cannot recover facts from a later timeline. Queries close their connection;
missing, locked or unsupported SQLite falls back to the same deterministic in-memory selector.
The browser uses save snapshots, not native SQLite. JSON save backups carry facts; caches rebuild.

Standard recall has an 18,000-character total cap with at most 6,500 characters of fact rows.
Optional **Light memory**, off by default, uses a 6,000-character total, 3,600-character fact
allowance and at most two encounter excerpts. Its ledger reference is at most 2,500 characters
instead of Standard's 6,500. These are character budgets, not token guarantees or whole-request
limits. Extraction reuses a call but still adds tokens; future recall also adds tokens.

The platform wrapper selects recall and strips the complete local snapshot before cloud
transport. Native character notes remain a separate feature. SQLite neither enlarges a model's
context window nor guarantees perfect recall. Spectator dialogue and private Unheard Soul
dialogue are not witnessed player memories. Story Memory indexes durable facts/history, not
raw discarded texting bubbles; regenerated texts use the same enabled request hooks.

### Breakthrough and Echo abilities

[Breakthrough guide](mods/breakthrough.md), [rules](../src/shared/breakthrough.ts),
[action store](../src/renderer/stores/breakthrough.ts),
[Echo ability catalog](../src/shared/echoBreakthrough.ts), [ability guide](mods/echo-breakthrough.md).

`exBreakthrough` owns meters, settled-boundary bookkeeping, pending charges and actual outcome
excerpts. Newly settled liked memories earn 10 spirit, loved 20, with a positive per-character
slot cap of 20 before prototype modifiers. Hated reactions subtract 15; disliked reactions add
none. Meters cap at 100. Existing saves are not retroactively awarded historical spirit.

Ordinary Breakthrough spends 100 on a present target in an eligible reply window. The prompt
gives one response a favorable opening while retaining personality, boundaries and established
facts. With Echo enabled, the player's aspect supplies a preset ability costing 25, 50 or 75.
Only the selected character pays. The token records the actual price; failure/cancellation
refunds that price once, capped at 100. Local Campus Talents discounts also use actual-paid
accounting. Do not infer an old transaction's price from the player's current aspect or ranks.

Continuity stores actual accepted generated lines, not the desired action as an accomplished
fact. Rewind handling distinguishes rereading from submitting a different branch that removes
the paid reply. Keep charging, output acceptance, outcome reconciliation and refund tests together.
Neither normal Breakthrough nor spirit requires SQLite or Story Memory.

### Echo and Character Dynamics

[Echo guide](mods/echo.md), [Echo state](../src/shared/echo.ts),
[aspects](../src/shared/echoAspects.ts), [setup](../src/shared/echoSetup.ts),
[Dynamics guide](mods/character-dynamics.md).

Echo assigns one of 22 aspects and keeps optional `exEcho` state. Matching aspects improve new
positive memories by 25%; competing aspects reduce them by 25%. Affinity is stamped when a
memory settles so later aspect/rank changes cannot rewrite old awards. Character setup, reader
change limits, editable naming/staging and generated artwork have separate ownership rules.
New 0.5.0 semester students enter setup; carried identities are preserved.

Character Dynamics uses `exCharacterDynamics` for starting tendencies/background reasons and
earned growth. Its selection is per-playthrough; it does not directly grant romance flags,
contact information or relationship points. Profile Backstory and bounded prompt hooks expose
the applicable information without rewriting the original character file or native notes.
Returnees retain setup choices during native New Game+; new students can be configured.

Echo is not a dependency of ordinary Character Dynamics. Breaking Through the Silence can
produce earned growth even with Dynamics disabled; the applicable hooks avoid applying it twice.

### Breaking Through the Silence and artwork

[Player/technical guide](mods/reckoning.md), [state](../src/shared/reckoning.ts),
[dungeons](../src/shared/reckoningDungeons.ts), [store](../src/renderer/stores/reckoning.ts),
[reflection service](../src/main/services/reflectionLocalImage.ts),
[decoder](../src/main/services/echoArtImage.ts), [storage](../src/main/services/reflectionStorage.ts).

Stable mod ID `reckoning`; user-facing name Breaking Through the Silence. It needs Breakthrough,
38 weighted native affection and 100 spirit for an eligible link. The link saves the charge and
connection, gives a short real-world head-pain beat, then offers a nighttime **Follow her voice**
entry. It does not move the real girl's scheduled location. The private world follows her aspect.

Talk permits three player replies; a fourth ends that attempt locally. An optional aspect hint
is once per connection. Starting the three questions closes preparation choices. Three successful
answers grant one persistent growth tag; a rejected answer ends the attempt, while provider or
save failures preserve progress for retry. Snapshot/private context remains separate from public
history. Native New Game+ resets transient links but carries earned growth through Dynamics.

Unheard Soul artwork can use the configured image API or desktop Local ComfyUI, including the
configured external server. This editor's local option never silently falls back to a paid API.
It uses an SDXL-oriented reference workflow, not the Echo creature's optional Megaten workflow.
PNG, JPEG and WebP input is decoded through Sharp and normalized for storage. Background removal
runs locally after its first-use runtime/model download; prior finished artwork survives failure.
Character transfer uses a validated optional `exReflection` extension; whole-game backups include
`exReflections`. Browser support differs: the new portable Unheard Soul editor is desktop-only.

Use the asset notices when distributing the bundled dungeon music/art. Replacing a creature's
art, a girl's ordinary sprite and her Unheard Soul portrait are three different operations.

### The Hare & Quill

[Guide](mods/venus-whisper.md), [publication rules](../src/shared/venusWhisper.ts),
[identity](../src/shared/whisperIdentity.ts),
[observations](../src/renderer/stores/whisperObservations.ts),
[delivery](../src/renderer/stores/whisperDelivery.ts), [carry](../src/shared/whisperCarry.ts).

Stable ID `venus-whisper`, state `exVenusWhisper`, UI The Hare & Quill and byline Lady Harewood.
One issue is due each in-game Wednesday. Enabling late catches up only the latest issue, not
an unlimited backlog. Automatic delivery waits for a safe save checkpoint; retry/backoff,
deletion markers and saved batches prevent duplicate paid publication.

The first eligible settled slot selects and saves one author. Sightings reuse the real timetable
and settled NPC encounters: class/work/whereabouts, absences and overlays matter. Dorm membership
alone is not evidence of overhearing. Private player scenes are excluded. Writing gets bounded
public material plus redacted flavor for a small clue; public comments are never told the author.

A private confession requires the actual author, native trusted/devoted affection, an eligible
one-to-one scene and a genuine question/admission. The ordinary ledger returns quotations and
local validation checks attribution/order. The permanent discovery is saved at the boundary,
not just because a player typed a guess. It never leaks into public comments or changes the
byline. Identity, witnessed evidence, archives and private discovery use semester-aware carry.
Model interpretation still requires playtesting; quotation checks cannot prove every implication.

### Meanwhile, texting, City Life and soundtracks

- [Meanwhile](mods/meanwhile-conversations.md): `exNpcWatch` caches a validated 6–12-line
  dramatization of a native two-person encounter. Clicking an unwritten encounter makes the
  request; replay costs no call. No player participation, clock advance or relationship award.
  Both names must be known; ungenerated encounters last seven game days and up to 50 saved
  conversations replay. Art resolves actual activity/location, including optional City Life.
- [Text Regeneration](mods/text-regeneration.md): optional `exReplyTo`/`exTextBase` metadata
  identifies the latest eligible whole reply. Generate from its pre-reply summary, validate,
  check plans and save before replacing. Earlier slots, blocked threads and an immediate
  hangout/block replacement are excluded. This is separate from Venus Phone's editing controls.
- [City Life](mods/city-life.md): catalog IDs `ex_bowling`, `ex_roller`, `ex_cat_cafe`, `ex_dance_instructor` feed native
  jobs, schedules, map presence and lore. Locations and jobs are separate per-playthrough
  switches; jobs requires locations. Empty venues have no special Go button. Pay is $125,
  $150 and $140 per shift respectively before native raises/prototype perks; see the guide for
  hiring tiers. Existing roster assignments are not rebuilt by toggling menu settings.
- [Custom soundtracks](mods/custom-soundtracks.md): installation-wide local library, not per-save
  story state. Thirteen supported cues include three Unheard Soul phases. Imports use bounded
  validation, content-addressed copies and native volume groups. Preview temporarily silences
  the underlying mix and restores it. The source files selected by the player are never deleted
  by library cleanup. This feature makes no AI calls.

## 5. Campus Talents: extend the framework, not the save by hand

[Player values](mods/campus-talents.md), [authoring contract](mods/talent-packs.md),
[example pack](examples/talent-pack.example.ts), [types](../src/shared/talentTypes.ts),
[catalog](../src/shared/talentCatalog.ts), [rules](../src/shared/campusTalents.ts),
[numeric consumers](../src/shared/talentPerks.ts), [UI](../src/renderer/views/TalentPanel.tsx).

Campus Talents discovers TypeScript packs in `src/shared/talentPacks/`. Each pack supplies
stable IDs, trees, chains, rank costs, prerequisites, dependencies and per-rank effects. The panel
generates its tabs/cards from this combined catalog. The example is outside discovery and does
not install a new tree. This is a source extension system requiring a rebuild, not a loader for
scripts copied next to the executable.

All six trees share `exTalents`: earned/spent BP, seed marker, ranks, bounded settlement ledger,
purchase count, shift/savings bookkeeping and interest period. The initial award is the floored
sum of positive current affection. Later newly settled liked/loved memories pay a base 1/2 BP,
scaled by average Brain/Body/Heart: 300% at −100, 280% at −80, 260% at −60,
150% at −30, 125% at −15, 100% at zero and 50% at +100, with smooth
changes between every value and bounded endpoints. Spending
does not reduce relationships. Charm/Echo multipliers do not amplify currency; duplicate slots
do not repay. Rewinding restores the loaded timeline's wallet.

Base rewards live in `TALENT_BP_REWARDS`, used by settlement. Existing earned/spent BP, fractions, seed grants, ranks and cooldowns are preserved. Full native stat gains and native semester decay are unchanged; only new BP rewards use the curve. Costs and limits are documented in the player guide.

`TalentPanel.tsx` reads the validated `bpFraction` through `readBondFraction` and draws a clockwise SVG ring beside the whole `talentBalance`. The ring has a labelled progressbar role for assistive technology; no decimal remainder, percentage tooltip or fractional reward amounts are printed in the panel. No save fields or settlement logic change. The ring remains unchanged by spending and reflects the loaded save on reopening.

The BP rate uses piecewise linear interpolation through (average, multiplier) anchors (-100, 3), (-80, 2.8), (-60, 2.6), (-30, 1.5), (-15, 1.25), (0, 1), (100, 0.5), clamped outside that range, implemented in
[`talentBondPoints.ts`](../src/shared/talentBondPoints.ts). The renderer passes the closing
snapshot's `before.stats` to `settleTalentPoints`, so this scene's stat gains do not change
its own reward. After deduplication, scaled rewards add to optional `exTalents.bpFraction`;
whole points enter `earned`, and the remainder persists through purchases, saves, toggles
and semester carry. The current initial affection grant and existing wallet are unchanged.
Tests cover every integer from −100 through +100, mixed/fractional stats, endpoint caps,
fraction conservation, duplicate slots, the pre-gain snapshot and native save/load.

For `costs: [15, 30, 45]`, rank one costs 15, rank two another 30 and rank three another 45.
Effect arrays are different: `[0.05, 0.10]` means a total 10% effect at rank two. The catalog
rejects duplicate IDs, invalid prices/effects, missing prerequisites and cycles. Preserve IDs
and released pricing. `spent` is durable independently of the current catalog; a missing pack
keeps its old ranks but supplies no effect. There is no automatic refund/respec.

Built-in consumers implement wages/discounts/savings/affinity/spirit. The Charm, Heart, Brain
and Body packs demonstrate namespaced effect adapters. A custom `author.effect` key stores and
aggregates a value; another mod must actually consume it with effective enablement, a numerical
cap and safe timing. Adding a label or effect key does not magically alter game mechanics.

The critical integration points are deliberately different:

- Charm stamps `talentHeartMultiplier` on newly settled qualifying memories. The total bonus
  caps at 50%, with Anticipation adding 25% to one positive scene memory; grace only softens disliked penalties, not hated/jealousy. Echo applies separately.
- Training wraps the native eligible stat result; it cannot invent a stat award, stack every
  activity category or bypass illness. Additional points are capped per stat/slot.
- Project sessions store `talentWorkUnits` once. A session advances one ordinary slot; later
  grade calculations sum durable credited units. Upgrades do not revalue old sessions.
- Assessment perks apply once when a future attended grade is frozen, require attempted work
  and preserve native ceilings. Recorded grades survive later disabling.
- Cold perks alter the player's catch probability/strain weight or a newly caught cold's mild
  chance; they do not cure an existing infection or change NPC transmission rules.
- Savings interest uses the lowest balance held for a full active seven-day period, with caps.
  Upgrade/rewind/semester/gaps reset the period; there is no offline catch-up interest.

`writeTalentChange` in the shared renderer save lane handles purchases, bank transfers, BP-to-stat trades and ability preparations.
The UI must never mutate ranks, spending or cash independently. With the mod off, earned
work/stats/grades remain; saved dynamic memory bonuses pause as described in the player guide.
Withdraw savings first if that cash must remain spendable while the UI is disabled.

Charm retains all original affection skill IDs, effect keys and memory fields. Only the visible tree assignment changes, so spent BP, ranks, saved multipliers and Anticipation remain stable. The new Heart pack covers solo/company/class/shift training, successful invitations and below-zero recovery. `talentStatGains` separates `gradeOutcome.heart` from the native delta before choosing a training source; a grade alone cannot trigger practice or recovery. The caller passes `game.stats.heart` before applying gains. All new stat bonuses pause during illness.

**Show Up:** [`talentShowUp.ts`](../src/shared/talentShowUp.ts) awards +1/+2 Heart for a positive completed meeting, retaining the historical `heart.pride` ID, prices and prerequisite chain. The [renderer adapter](../src/renderer/stores/loop/talentShowUp.ts) reads the persisted native `sceneTextLedgerSkip` for accepted hangouts/reminders, or matching calendar plans whose `noShow` array proves attendance was settled. Invitees must be in the scene cast and not marked absent. It uses only `ledgerMemories`-validated scene memories: at least one liked/loved invitee and no disliked/hated invitees. Texts and bystanders cannot qualify the meeting. No new AI call or pending-invitation save field is needed.

`gameLoop.resolveScene` adds Show Up after training so the new reward cannot itself activate Social Ease or Finding Your Feet. It is pure for opening projections and status previews. At `crossSlotBoundary`, the same calculation supplies the applied delta, and a positive award stamps `exTalents.showUpDay` with the closing term and date before the first asynchronous boundary operation. `normalizeTalents` validates and preserves that stamp. Day and night share one use; the next date or semester has another. Replays, created scenes, class/project/shift scenes, illness and disabled talents do not award it. Like other native stat gains, this uses the generated ledger before optional memory edits. [`talentShowUp.test.ts`](../test/talentShowUp.test.ts) checks attendance, negative/mixed outcomes, daily persistence, legacy purchases and the actual preview-to-boundary path, including challenge floors.

**Finding Your Feet:** one 40 BP rank grants +1 Heart recovery below zero. The saved ID stays `heart.feet`; `normalizeTalents` collapses older rank-II purchases to rank I and refunds 25 BP by reducing `spent`, without altering `earned` or past Heart gains. The normalized rank prevents repeat refunds. Rank-I owners retain their earlier purchase without being charged extra. Silver Lining now accepts `heart.feet` rank 1. The purchase, migration, capstone and actual gain cases are covered in `talentHeartCharm.test.ts`.

**Stat awards:** Native activity rewards, training bonuses and Show Up settle at their full amounts through gameLoop.resolveScene and crossSlotBoundary. There is no positive-stat slowdown or sharing divisor. Only BP uses the average-stat scaling curve. [Settlement regressions](../test/talentStatSettlement.test.ts) cover native +2 solo gains, full +1/+2 bonuses, multi-stat scenes, zero crossings, disabled skills, previews and save totals. talentShowUp.test.ts verifies the full +2 invitation reward. [talentGrowth.ts](../src/shared/talentGrowth.ts) now only parses inert legacy fractions; old saves keep their current totals and records without a speculative retroactive adjustment. Native decay, grading, skill definitions, costs and BP rules are unchanged by this correction. Starting Challenge supports per-stat −30/−60/−80/−100; BP scaling and Personal Growth accept intermediate negative values too.

### Activated abilities

Six additional skills live in [mastery.ts](../src/shared/talentPacks/mastery.ts): Silver Lining (70 BP), Eureka (60 BP), Leave Them Wanting More (70 BP), Dancer (15/20/25 BP), Eye for Value (60 BP), and Borrowed Voice (80 BP). Each is a centered capstone under its tree. `prerequisitesAny` requires a maximum-rank second-row skill from any branch; `talentPrerequisitesMet` is shared by the purchase transaction and the UI. Catalog compilation validates alternative references and cycles. Existing owned ranks remain active, while new purchases and upgrades use the new gate. Prerequisites and complete player rules are in [Campus Talents](mods/campus-talents.md#unlockable-abilities).

[Ability state](../src/shared/talentAbilityState.ts) normalizes cooldowns and pending actions. [Pure rules](../src/shared/talentAbilities.ts) determine project eligibility at completion, next-meeting bonuses, gift evidence, dancing context and borrowed-use rewind reconciliation. [Renderer action validation](../src/renderer/stores/talentActions.ts) checks live projects and safe goodbye windows within the queued save transaction. [Ability controls](../src/renderer/views/TalentAbilityControls.tsx) connect these operations to the selected skill. [Gift guidance](../src/renderer/views/TalentGiftSuggestions.tsx) appears inside BunnyShop, using discounted prices without changing purchasing logic.

Eureka updates work records and weekly usage together. A chosen goodbye is saved before dispatch, must remain the last reader action, and grants Anticipation only after the eligible positive scene ends. The next meeting consumes Anticipation; one positive scene memory receives a saved 25% base-affection bonus. Borrowed Voice records source ID and semester on the native pending Breakthrough; its successful outcome token owns the weekly use. Refund projection is shared by autosave, scene restoration and unread-line truncation. These paths preserve native retry and spirit accounting.

Silver Lining saves its chosen target and exact action before dispatch. The prompt hook offers one plausible social recovery only for that current action and target. The successful-reply hook records one calendar-week use after generated lines follow the reader action; generation errors keep the use for retry. Cancellation and unrelated replies cannot charge it, and preparation does not survive slot settlement or semester carry. Outcomes remain narrative, not manufactured affection. [talentHeartCharm.test.ts](../test/talentHeartCharm.test.ts) covers ownership preservation, stat-source separation, weekly use and prompt isolation.

Scene abilities reuse the configured scene provider; there is no new AI client or background generation. Dancer and goodbye outcomes remain subject to normal narrative generation. Eureka and gift suggestions are deterministic. The [ability tests](../test/talentAbilities.test.ts) protect save behavior and calculations, while an offline Electron smoke run verifies actual purchase/reload and the scaled two-theme UI. No provider-generated story quality is implied by those checks.

`talentGoodbyeOpen` accepts either `awaitingInput` or the native `replyRowOfferOf(...) === 'open'` after generation and all pending lines finish. The native last-line reply row is usable before `awaitingInput` becomes true; requiring that flag alone incorrectly disabled Silver Lining and Leave Them Wanting More. Both still reject unread or streaming replies, scene endings, classroom actions and other unsafe states. No transcript is truncated in this newly accepted last-line case. Regression tests exercise the last-line preparation, preserved transcript offset and successful-reply cooldown. `TalentAbilityControls` explains disabled scene actions. `TalentPanel` limits the savings controls to the `reserve` and `interest` skill details.

The ending's `projectSlotMemories` hook applies earned affection weights to copied character memories before the crush roll and next-opening prompt. [talentMemories.ts](../src/shared/talentMemories.ts) supplies the same stamping logic to the Campus Talents preview and final settlement; Echo previews its native affinity separately. Anticipation is selected without committing its returned state, so previews cannot pay BP or consume weekly/scene abilities. The actual boundary remains the only reward/ability commit. [talentAffectionProjection.test.ts](../test/talentAffectionProjection.test.ts) reproduces the 8-versus-14.56 example through the real ending and checks mod switches, preservation of old memories, duplicate settlement and preview purity. Already-banked outcomes in existing saves are preserved. This fixes evaluation timing without changing skill effects or prices.

### Personal Growth

[Definition](../src/shared/talentPacks/personal-growth.ts), [pure prices and rules](../src/shared/talentTrading.ts), [controls](../src/renderer/views/TalentTrainingControls.tsx), [regressions](../test/talentTrading.test.ts). The pack registers one shared header skill with nine alternative maximum-rank stat prerequisites. It preserves the six tree layouts and their seven cards each.

Optional `exTalents.training` contains a semester-tagged recovery target/remaining map and a semester/week-tagged total/new-purchase counter. Normalization validates bounds and preserves other wallet/rank/fraction fields. The mod carry adapter calls `trainingAfterBreak` using the ending save's stats and next semester number. It reads native `breakDecayedStats` without changing decay; each break replaces the allowance, capped to restoration of 100. Negative-start recovery is not a break loss. Old saves receive no invented historical allowance.

The slot settlement hook reconciles both opening and ending stats against the recorded remainder, so ordinary recovery consumes the allowance and subsequent penalties cannot replenish it. `quoteTraining` is pure; `buyTraining` recomputes it inside the save transaction, charges BP, adjusts only the chosen stat and records weekly use. Trades add actual points, cap at 100 and preserve unrelated stats and legacy data. A partial final point is prorated, rounded up and counts once. Prices: 10 recovery; 25 new below 60; 40 new from 60. Six weekly purchases total, no more than two new; unused purchases never bank.

The existing save queue validates effective mod enablement, safe gameplay, assessments, live stats and load identity before writing one autosave draft containing stats and talents. Only the matching successful acknowledgement updates live state and the status baseline. Failures, duplicate clicks and stale acknowledgements cannot spend live BP independently of stats. Unit/integration coverage includes prices from −100 to 100, native carry, old/malformed saves, discounted recovery, practice/penalties, both weekly limits, save/reload and failed/stale writes. No external provider is used.

## 6. Starting Challenge is separate from talents

[Guide](mods/starting-challenge.md), [rules](../src/shared/startingChallenge.ts),
[entry](../src/shared/modEntries/starting-challenge.ts), [stat rules](../src/shared/playerStats.ts).

This independent, default-off **per-playthrough** mod is enabled in **Main Menu → Mods →
Starting Challenge**. New Game and Quickstart use the native minus/plus rows, independently
for Brain, Body and Heart. Starting/display tiers −4 through −1 mean Peaked in the Womb
(−100), Life’s Punchline (−80), Rock Bottom (−60), and Struggling (−30). Enabled setup rows
show rank titles without numbers, including native positive choices; untouched rows start at
Unremarkable (zero). When off,
native labels and limits remain. Native mechanical tiers 0–5 remain
unchanged, so job and attraction requirements keep their meaning.

`challengeForStartingStats` snapshots each selected floor into the enrollment and save as
`exStartingChallenge: { version: 2, floors: { brain, body, heart } }`. Each floor is −15, −30,
−60, −80 or −100, and is fixed at setup. Ordinary losses clamp to that stat’s floor. Reload and semester
carry retain progress and floors rather than deriving them again from recovered stats. Old
`uphill-battle` / `rock-bottom` strings remain readable with their original shared floor.
`displayedTierOf`, `tierName`, `nextTierPoints` and prompt descriptions recognize recovery
through all four lower tiers without changing mechanical `tierOf`. Existing normal saves
are not stat-edited by enabling the mod.

Native negative-stat academic consequences still apply. This is a starting challenge, not an
automatic compensation mode for exams/projects. The player guide gives concrete score examples.
The floor whitelist, recovery milestones, mixed saves and native assessment boundaries are tested
in `test/startingChallenge.test.ts`. Older builds cannot read the newly allowed −80/−100 floor
values; keep those new playthroughs on this build or a newer compatible version.

## 7. Native lorebooks and semester boundaries

The native editable lorebook is a per-playthrough world description, separate from Story
Memory's evidence and recall. [Lorebook composition](../src/renderer/prompts/lorebook.ts)
keeps stable City Life entry references so player edits survive normalization. Disabled City
Life venues are excluded from matches, direct place lookup and rumor pools without deleting
those edits. The Dance Studio follows the same rule as the other City Life venues.

Use the current book from [prompt state](../src/renderer/stores/loop/promptState.ts) when
building a request. [Texting](../src/renderer/stores/textingLoop.ts) supplies it for both
ordinary and regenerated messages alongside the existing Story Memory context. Native
Check grades also uses [class progress](../src/renderer/prompts/classProgress.ts), which
counts the completed work units paid by Campus Talents project perks.

The browser database uses version 10 to add native lorebooks after VE's version 9 Echo and
soundtrack stores. [Database upgrades](../src/web/db/open.ts) and
[backup restoration](../src/web/backup.ts) preserve all three; tests cover an existing version
9 database and preflight rejection before a restore mutates stored data.

Use the game's semester identity rather than a day number as a unique historical key. A spring
and fall day can share a number. Check roster versus graduates, calendar lookups, old encounter
course categories, author identity, repeat settlement and new-student setup. Native New Game+
is the current continuation mechanism; a separate Continuing Semesters implementation is not
a prerequisite of these modules.

Each registration owns its carry behavior. Examples: retain the Plot Twist, Story Memory facts
and edits, columnist identity/archive and talent purchases; reset an unfinished Unheard Soul
link; preserve earned Dynamics growth and returning Echo assignments. Read each adapter rather
than blindly copying every `ex*` field. Carrying static IDs does not authorize moving an event
onto the new semester's day zero or treating an old spectator scene as newly witnessed.

Artwork compatibility crosses three boundaries: reference decoding, provider/workflow selection
and optional asset export/import. A PNG filename is not proof of PNG bytes. WebP and JPEG must
use the same validated decoder as uploads. Local ComfyUI may be managed or external in VE;
request routes and supported workflows differ from cloud image generation. Venus Phone has its
own restrictions, documented separately.

## 8. Build, verify and hand off

Use the pinned repository baseline and its lockfile. The shared README requires Node 22;
matching the release's Node/Electron environment matters for native `node:sqlite` and Sharp.
Obtain required game assets through the original project instructions; a text source bundle
does not contain official character/music packs or a complete Electron runtime.

```text
npm ci
npm run typecheck
npm test
npm run build
npm run build:web
```

Check the feature's real save computation, off behavior, dependencies, replay/scene-creator
gates, failed persistence, cancellation and load ownership. Then exercise its UI in both
themes, a small 16:9 viewport and 4:3, with keyboard/scrolling and native hover/reduced-motion
behavior. A passing unit suite is not proof of good live-model prose, network providers or
GPU compatibility. Documentation-only checks and previous runtime results should be labeled
separately in the delivery's validation record.

Before distribution, include source/license notices and a file/hash manifest. Exclude runtime
`data`, personal characters, saves, databases/sidecars, API settings, logs, voice references and
model downloads. `.gitignore` prevents some future additions but does not scrub already tracked
files or Git history. Prefer an explicit source allowlist over zipping a working game folder.

For future updates, bring the official version into the shared core through its owner, merge
that core into each owned `mod/<name>` branch, and resolve cross-mod integration on the appropriate
integration branch. Preserve other owners' changes; do not wholesale choose one side of shared
store/hook/save conflicts. Use the organization repository as the PR base. Prepare release-specific testing and review notes with the PR.

## 9. Boundaries and open work

- Numeric skill balance and severe starting deficits need normal playtesting across a semester.
- AI-written clues, confessions, growth and abilities have validated structure, not guaranteed
  narrative outcomes. Test the configured provider without asserting success from mocked tests.
- Unknown old patched saves may need a separate migration assessment; keep originals.
- The novice quick-audio tab exercise is not a registered module in this build. Do not list an
  unfinished experiment as a shipped feature merely because it appeared in earlier discussion.
- Venus Phone text sync and experimental calls are a separate app and data lifecycle. It is not a game mod switch.

For detailed contracts, use the linked individual guides and their test maps. Record the
exact source commit and validation results when handing off a build.

## Dance Studio hiring integration

City Life locations/jobs and Campus Talents provide the studio and
Dancer III career unlock. Read [City Life](mods/city-life.md#dance-studio-and-dancer-iii)
for ownership, toggle, existing-save and hiring behavior. Good is native tier 3,
35 points: do not confuse it with tier 2 (Decent). The catalog/lore/map and background
IDs all use `dance_studio`; the job ID is `ex_dance_instructor`. The skill keeps
its original `body.dancer` ID and costs. The independent optional job qualification
field is `requiresSkills`; no whole-mod dependency on Campus Talents was added to
City Life. Test both UI qualification and direct `takeJob` rejection when updating.
