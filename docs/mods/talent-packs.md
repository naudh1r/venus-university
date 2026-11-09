# Extending Campus Talents

This is a source-level framework for the local prototype. Authors add a small TypeScript pack and rebuild the game. It is not a runtime mod loader: dropping arbitrary scripts beside the executable does not install them. No source is downloaded or executed from the internet.

## A pack without core edits

1. Copy [talent-pack.example.ts](../examples/talent-pack.example.ts) into `src/shared/talentPacks/guest.ts`.
2. Update its IDs, author, descriptions, costs and effects. Use your own prefix for every new ID, such as `your-mod.skill-name`. IDs are permanent save keys; changing one makes an existing purchased skill unavailable.
3. Run `npm run typecheck`, `npm test`, and `npm run build`.
4. Enable Campus Talents and open Skill trees. The additional tree, chains, rank indicators, prerequisites and purchase controls are generated from the pack automatically.

The example lives outside the discovery directory and does not ship as an enabled tree. Packs may add skills to an existing tree by referencing its ID and declaring `trees: []`. Only the tree's owner declares the tree itself. All trees share one Bond Point wallet, spending transaction and save field.

## Skill artwork

The renderer's [`TalentArtwork.tsx`](../../src/renderer/views/TalentArtwork.tsx) maps stable skill IDs to transparent PNG files under `src/renderer/assets/talents/`. Vite imports these local files into the packaged renderer; no image request goes to an external service. The built-in set has 43 illustrations at 256 × 256 pixels, shared across each skill's ranks. The component is decorative (`aria-hidden`, empty image alternative text); the adjacent name supplies the accessible label. A new skill without an artwork mapping uses the generic talent icon and remains usable.

To replace artwork, keep the mapped filename, use a transparent square PNG with padding, and rebuild. To add artwork for a new skill, add a PNG and an ID-to-filename entry in `skillFiles`. This mapping has no effect on saved IDs, prerequisites, prices or effects. Check both themes and the smallest supported game-stage size after changing artwork or labels.

## Data contract

[`talentTypes.ts`](../../src/shared/talentTypes.ts) defines `TalentPack`, `TalentTreeDef` and `TalentDef`. A pack exports one default object satisfying `TalentPack`.

- A tree has a stable `id`, display `name` and `description`.
- A skill has a stable `id`, a `tree` ID, a displayed `chain`, name and description.
- Optional `notes: ['Additional guidance.']` appears only in that skill's details. Keep notes specific to its effects, limits or relevant stacking rules; do not attach explanations of unrelated skills to an entire tree. Required mod names are displayed from that skill's `requires` list.
- `costs: [15, 30, 45]` means three ranks costing those amounts separately. Prices must be positive integers. Maximum ten ranks.
- `prerequisites: [{id: 'guest.first', rank: 2}]` requires that skill's second rank. Multiple prerequisites all apply. References may cross trees and packs, but referenced packs must be built together.
- `prerequisitesAny: [{id: 'guest.left', rank: 2}, {id: 'guest.right', rank: 3}]` requires at least one listed rank, in addition to every ordinary prerequisite. The list cannot be empty; every reference and rank is validated, including cycles through alternatives.
- `capstone: true` places one shared ability below the numerical chains, with bent connectors joining into it. Only one capstone is allowed per tree. For the shipped unlock rule, list each second-row skill at its maximum rank in `prerequisitesAny`; use the mastery pack as the example. The UI lists the alternatives and progress, and uses the same prerequisite check as the saved purchase. Existing owned ranks are not revoked; future purchases use the current rules.
- `shared: true` places a skill in the header instead of its home tree grid. It still needs a valid tree ID, prices and prerequisites. It cannot also be a capstone. Personal Growth demonstrates a shared ability across stat trees; its controls and save action are explicitly implemented, not generated from the flag.
- `requires: ['echo', 'breakthrough']` gates purchase and effect aggregation on these mod switches. Omit it for independent skills. Built-in dependencies are anytime mods.
- `effects` maps effect keys to one value per rank. Values are **the total at that rank**, not incremental bonuses. `[0.05, 0.10]` gives 10% at rank two, not 15%.

[`talentCatalog.ts`](../../src/shared/talentCatalog.ts) discovers the modules with Vite's eager glob, orders them by filename, and validates their combined catalog. Invalid costs, duplicate IDs, unknown unqualified effect names, absent prerequisites and dependency cycles fail before a purchase can write a save. This is a build/startup validation failure, not a silently ignored pack.

## Built-in effect adapters

Effects from all active, purchased skills add together. Consumers apply limits after combining them.

| Effect key | Value/unit | Consumer and limit |
|---|---|---|
| `wageRate` | Fraction of normal pay | Completed shifts; combined bonus capped at +100%. |
| `streakCash` | Currency | Every third consecutive shift; extra cash capped at $250. |
| `shopDiscount` | Fraction | Catalog purchases. |
| `thirdPurchaseDiscount` | Fraction | Every third catalog purchase. Combined shop discount capped at 25%. |
| `savingsAccess` | Positive value enables | Bank controls. |
| `savingsRate` | Fraction per week | Lowest held balance; combined rate capped at 5%. |
| `savingsCap` | Currency per week | Rate result limited by this sum, with an overall $250 cap. |
| `matchingBonus` | Fraction added to native 1.25 | New positive matching memories; total multiplier capped at 1.50. |
| `competingRelief` | Fraction added to native 0.75 | New positive competing memories; total capped at 1.00. |
| `neutralBonus` | Fraction added to native 1.00 | New positive neutral memories; total capped at 1.50. |
| `spiritRate` | Fraction | Positive spirit only; final meter capped at 100. |
| `matchingSpirit` | Spirit points | Extra only when positive spirit was earned with a matching Echo. |
| `echoDiscount` | Spirit points | Rounded to increments of five; Echo ability minimum price 15. |
| `heart.liked`, `heart.loved` | Affection fraction | New memories of the specified type. |
| `heart.group`, `heart.text`, `heart.gift` | Affection fraction | New positive memories from the applicable source; group requires two NPCs and that recipient in the closing scene cast. All Charm bonuses combined cap at +50%. |
| `heart.grace` | Penalty reduction fraction | New disliked scene/text/gift memories only; cap 20%. Hated and separate jealousy memories are excluded. |
| `brain.solo`, `body.solo`, `body.company` | Extra stat points | The specified stat must already be awarded; excludes classes, shifts and illness. At most two extra points per stat per slot. |
| `brain.class`, `body.pe`, `body.shift` | Extra stat points | Eligible attended class/PE/completed shift already earning the relevant stat. Same two-point cap, no illness bonus. |
| `heart.solo`, `heart.company`, `heart.class`, `heart.shift` | Extra Heart stat points | Applicable activity must already earn Heart; cap +2 for that source, no illness bonus. |
| `heart.show-up` | Extra Heart stat points | Accepted hangout or attended plan with a positive scene outcome; cap +2, once per day. No illness bonus. Consumed by `talentShowUp.ts` at scene settlement. |
| `heart.recovery` | Extra Heart stat points | Another +1 maximum on actual Heart activity gains while the pre-slot Heart stat is negative. Grades alone do not qualify. No illness bonus. |
| `brain.work` | Extra work units | A new project session banks 1 + this value, capped at 1.5. |
| `brain.night-work` | Positive value enables | Nighttime project sessions bank two units instead. |
| `brain.exam`, `brain.showcase` | Score percentage points | Cap +9 on future attended assessments with attempted work. Preserve the native 99% incomplete-work and 100% complete-work ceilings. |
| `body.resist` | Reduced catch fraction | Player only; cap 45% less contact infection chance and selection weight for a new strain. |
| `body.mild` | Added mild-case probability | Player only; cap +0.20, final probability at most 1. |

Keep displayed descriptions consistent with these limits. The framework does not rewrite prose when authors stack effects. A skill with `savingsRate` restarts the interest period when purchased, so a late upgrade cannot improve the rate for days already elapsed.

[`talentPerks.ts`](../../src/shared/talentPerks.ts) consumes the namespaced Charm, Heart, Brain and Body effects. These packs demonstrate custom effect names using the same catalog and transaction machinery as Money and Echoes. `talentStatGains` wraps the one `resolveScene` calculation, so status previews, ending projections and the applied stat deltas agree. `talentAssessment` runs only when the academic ledger freezes a grade. Project sessions store `talentWorkUnits` once, and `workedOn` sums those units for both grade calculation and prompt progress. Memories store `talentHeartMultiplier` separately from Echo affinity; `affectionOf` applies both through their own enablement gates. These optional fields preserve native behavior on older saves.

Charm keeps the original `heart.warmth`/`heart.spark`/other affection rank IDs, `heart.anticipation`, effect keys and saved `talentHeartMultiplier` field. Only their catalog tree is now `charm`; never rename these durable IDs to move a UI category. New Heart stat skills use distinct IDs. `talentStatGains` receives the pre-slot Heart stat and separates grade confidence from activity movement.

Show Up keeps the historical `heart.pride` rank ID and 20/35 BP costs. Its effect is `heart.show-up`; Finding Your Feet still depends on rank I of that same saved ID. [`talentShowUp.ts`](../../src/shared/talentShowUp.ts) is the pure attendance/outcome calculator. The renderer adapter reads native `sceneTextLedgerSkip`, settled calendar attendance (`noShow`), and validated **scene** memories. `resolveScene` adds its award after other training effects; `crossSlotBoundary` stamps `exTalents.showUpDay = {term,date}` only when applying that award. Previews never consume the daily use. New effects must not infer completion from accepting an invitation or from a text memory.

Finding Your Feet retains `heart.feet` but now has `costs: [40]` and `heart.recovery: [1]`. Silver Lining's alternative prerequisite is rank 1. Save normalization collapses older rank 2 to rank 1 and reduces spent BP by 25 (the difference between the old 65 total and new 40), once. Older rank-1 purchases are retained without an additional charge. Do not reinterpret already-earned stat points or refund again on later loads.

## Affection projections

The renderer's `projectSlotMemories` hook is pure: it receives the pre-scene snapshot and projected character memories, and returns weighted copies before `fetchEndingOpening` rolls crushes or builds the next opening. It must not write a store, pay rewards, consume ability state or roll random outcomes. Disabled mods are omitted. Echo previews its native affinity with `settleEchoMemories`; Campus Talents shares [`settleTalentMemories`](../../src/shared/talentMemories.ts) between projection and final settlement. The projected Anticipation selection uses `settleTalentSceneAbilities` but discards its returned state; only `slotSettled` commits the ability change. Existing stamped memories and already-settled slots are not re-awarded. `talentAffectionProjection.test.ts` covers the actual ending roll, separate mod enablement, all affinity types, preview purity, Anticipation and duplicate settlement. No save migration is required, and already-banked outcomes are not rerolled on load.

## Bond Point scaling

[`talentBondPoints.ts`](../../src/shared/talentBondPoints.ts) defines the continuous reward rate: `average = (brain + body + heart) / 3`; piecewise linear interpolation through (average, multiplier) anchors (-100, 3), (-80, 2.8), (-60, 2.6), (-30, 1.5), (-15, 1.25), (0, 1), (100, 0.5), clamped outside that range. Use the actual average, not tier names, the lowest stat or only Heart. All intermediate values affect rewards. `settleTalentPoints` receives `before.stats` from the renderer's `slotSettled` snapshot, before the closing scene's stat changes. It deduplicates all newly positive scene/text/gift memories, multiplies their combined 1/2 base reward, adds saved `bpFraction`, credits only whole points and retains the remainder.

`exTalents.bpFraction` is optional and must be finite in `[0, 1)`. Legacy saves have zero partial BP; normalization must preserve old earned/spent/seed values and ranks. Keep the fraction through purchases, snapshots, native saves, disabling and semester carry. Do not round per character or memory, rescale an already-earned fraction when stats change, or apply this multiplier to the initial affection grant. The recent reward ledger records credited whole BP. The UI shows the whole wallet and uses the validated remainder to fill a circular progress wheel; it prints no decimal remainder or fractional reward breakdown. `talentBondPoints.test.ts` covers the full −100 to +100 range, mixed stats, fractional saving, deduplication and legacy wallets; `campusTalents.test.ts` covers the real settlement snapshot and native save/carry path.

## Stat awards and legacy save data

In gameLoop.resolveScene, native resolveStatDeltas runs first, followed by talentStatGains and the eligible Show Up reward. The full result is previewed and applied at crossSlotBoundary. Do not apply the BP multiplier to these deltas or divide multi-stat activity rewards. Skill descriptions refer to actual additional stat points.

[talentGrowth.ts](../../src/shared/talentGrowth.ts) only validates the optional legacy exTalents.growth field from older local test saves. Its three fractions remain inert: normalization and carry preserve them, but settlement never reads or updates them. No historical stat awards are guessed or reconstructed. Fractional BP is a separate, active field. [Settlement regressions](../../test/talentStatSettlement.test.ts) exercise real previews, boundary commits and saved totals at negative, zero and positive stats with ranks 0/I/II and multiple trained stats; talentShowUp.test.ts covers full invitation rewards.

## Custom effects without editing the framework

Use a namespaced effect key, for example `guest.focus-bonus`, with a finite nonnegative value for each rank. The type accepts dotted keys and the catalog validates their shape. The framework stores the purchase and aggregates the effect, but **your own mod implements what it does**.

In your existing hook or consumer, import `talentEffect` and `talentsEnabled` from `@shared/campusTalents`. Read the current game state and use:

```ts
const bonus = talentsEnabled()
  ? talentEffect(game.exTalents, 'guest.focus-bonus')
  : 0
```

Also respect your own mod's enablement, replay/scene-creator gates, safe timing and transaction rules. Put `requires: ['your-mod-id']` on a skill whose effect needs that mod. Apply your own numerical cap. A value alone does not change the game: an unconsumed custom effect does nothing. Never put arbitrary prompt instructions or executable code into a save.

Use a framework hook where the host already offers one. When a new host action needs a hook, add that narrowly and test the underlying save calculation. This prototype does not expose hooks for every possible future skill. Its built-in wage, shop and Echo adapters currently have small integrations in the existing game files.

## Save and transaction rules

[`campusTalents.ts`](../../src/shared/campusTalents.ts) owns the pure calculations and `TalentState`. `exTalents` records lifetime earned/spent BP, the one-time seed, rank IDs, a bounded semester/day/slot settlement ledger, purchase count, savings and the current interest period. No database or AI memory is involved.

`spent` is persisted independently of current catalog prices. Removing a pack or changing its prices must not refund its purchases. Unknown skill IDs retain their ranks, allowing a missing pack to return later. Effects require a current catalog entry, so unavailable packs do nothing. Keep old rank slots and stable prices whenever possible; migrating a released catalog requires deliberate save migration, not renaming IDs.

[`writeTalentChange`](../../src/renderer/stores/loop/saves.ts) validates purchases, transfers and ability preparations, uses the native save queue, and applies state only after the write succeeds. The transaction tracks playthrough, load generation, time slot, money, prior talent state, character information, class records and transcript. UI code must call this writer instead of mutating ranks or cash directly.

[`campus-talents.ts`](../../src/renderer/modEntries/campus-talents.ts) seeds older saves and settles new BP through the native game/slot hooks. The [shared mod entry](../../src/shared/modEntries/campus-talents.ts) retains the extension during semester carry, including while disabled. New semesters do not reseed it.

[`TalentPanel.tsx`](../../src/renderer/views/TalentPanel.tsx) generates native icon palette tabs and compact recessed skill cards from the combined catalog, with the selected description and controls in a side panel. The six built-in tabs use VU-style icons; custom tree IDs use the generic talent mark. Capstones keep the paper treatment and ordinary cards use row gestures. Ability pickers reuse `SelectField`. The bank is the Money tree's built-in extra panel. A custom interactive panel needs an additional UI extension; numeric skills require none.

## Validation before sharing a pack

The [framework tests](../../test/campusTalents.test.ts) cover currency settlement, dependencies, invalid catalogs, missing-pack retention, money conservation, interest timing, pay quotes, Echo refunds and atomic save failures. The [numerical perk tests](../../test/talentPerks.test.ts) cover new-memory awards, source gates, preserved BP, training eligibility, challenge recovery, project idempotency, frozen grades and player-only cold modifiers. Add tests for your effect's actual save calculation and its disabled/replay behavior. Confirm an old save loads, a purchase survives reload, and the new tree fits the game's scaled stage in both themes.

Test on copied saves. Share source and a clean build, never a player's `data` folder or settings. This branch and its documentation are a local prototype; no PR or published release is implied.


## Adding an activated ability

The [mastery pack](../../src/shared/talentPacks/mastery.ts) is the worked example. Register a stable namespaced unlock effect such as `guest.ability.unlock`, then consume it through `abilityRank` in [talentAbilities.ts](../../src/shared/talentAbilities.ts). Unlocks use the same catalog prerequisites, rank pricing and dependency gates as numerical effects. These are compiled TypeScript extensions, not code loaded from a save.

[Ability state](../../src/shared/talentAbilityState.ts) is nested under `exTalents.abilities`. Its bounded `uses` dictionary accepts namespaced skill IDs and records semester, calendar week and an optional idempotency token. Unknown valid usage IDs survive normalization. A new ability with its own preparation payload must add an explicit validated field and decide its semester-carry policy. Never serialize executable handlers or free-form model instructions there.

[Action validation](../../src/renderer/stores/talentActions.ts) runs inside `writeTalentChange` before the atomic autosave. The controls in [TalentAbilityControls.tsx](../../src/renderer/views/TalentAbilityControls.tsx) only dispatch validated choices or native scene actions. To add a new interactive ability, extend the discriminated `TalentChange` union and control adapter; a catalog entry alone cannot invent new behavior.

Eureka consumes its prepared project in the same `recordProjectWork` update that banks three work units. The farewell uses native scene-reply and slot-settlement hooks; it verifies the exact final reader action, positive memories and the intended character. Dancer adds narrowly relevant context through the scene prompt hook. Eye for Value receives the known character's gift preferences and traits plus gift history, catalog items and budget. It ranks native `giftReactionOf` results, using original catalog value for Materialist taste and discounted purchase prices for affordability. It excludes repeats (including current-scene handovers) and medicine, selects loved before liked, and breaks ties by price then stable item ID. Borrowed Voice extends the existing Breakthrough pending record, refunds the recorded spirit price on failure, and consumes a weekly use only with a completed outcome. Its stable outcome token ties transcript rewind refunds to that exact use.

Silver Lining saves a bounded `silverLining` preparation containing slot, target, exact reader action and transcript offset. The prompt hook requires both that action in the current query and the matching latest reader action after the saved offset. `afterSceneReply` consumes its weekly use only after successful generated lines follow that action. Failed calls retain preparation for native retry; unrelated replies clear it without charging. Semester carry and slot settlement clear unfinished preparation. This uses existing hooks and makes no extra provider call. Tests are in [talentHeartCharm.test.ts](../../test/talentHeartCharm.test.ts).

The [ability tests](../../test/talentAbilities.test.ts) cover migration, semester carry, safe preparation, failed saves, duplicate project completion, replay/mod gates, next-meeting settlement, native gift ranking and discounted budgets, borrowed aspect identity, generation failure and rewind refunds. Keep calculations and state transitions independent of UI so another author can exercise them without a live AI provider.

## BP-to-stat trades

[Personal Growth](../../src/shared/talentPacks/personal-growth.ts) uses [talentTrading.ts](../../src/shared/talentTrading.ts) for quotes and pure purchases. The optional validated `exTalents.training` field owns recovery and weekly counters. Recovery derives only from native break losses, tracked by the shared carry adapter and reduced by slot settlement. Use `writeTalentChange({train: stat})` for the atomic BP/stat save; never mutate stats from a UI handler. Limits and prices are rechecked inside that transaction. Full player rules are in [Campus Talents](campus-talents.md#personal-growth); failure and carry cases are in [talentTrading.test.ts](../../test/talentTrading.test.ts).
