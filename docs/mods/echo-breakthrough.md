# Echo Breakthrough abilities

Echo abilities integrate Echo with Breakthrough in the current 0.5.0-based community build.
See the [technical handoff](../maestro-technical-guide.md) for the source baseline.
[echo-validation.md](echo-validation.md) retains dated historical checks; it is not a guarantee
that every later runtime, provider or balance choice has been verified.

## Player behavior

Breakthrough works independently of Echo. With Echo disabled, its ordinary spirit bar, full-bar activation, requested action, one-turn narrative advantage, gold ready state and original notification remain available. The same fallback applies when the save has no player Echo, or Mods > Echo > Echo Breakthrough abilities is disabled. Echo does not become a dependency for using the original feature.

When both mods and the ability option are enabled, the scene's Breakthrough panel offers the player's aspect ability alongside **Normal Breakthrough**. The ability comes from the player's Echo, not the selected girl's. Echoes sidebar tab > Your Echo > Resonance explains the current ability. The manager shortcut is between Calendar and Settings in scenes, and beside Settings between scenes.

| Player aspect | Ability | Spirit | Influence | Effect for one exchange |
| --- | --- | --- | --- | --- |
| Horizonbound | Open Horizon | 50 | Medium | See an overlooked possibility and create an opening for a new shared experience. |
| Stoneward | Steady Ground | 25 | Light | Turn uncertainty into a clear, dependable next step you can take together. |
| Sparkweaver | Bright Invention | 25 | Light | Find a clever new use for what is already at hand. |
| Lorekeeper | Thread of Wisdom | 25 | Light | Bring a useful lesson or familiar practice to bear on the present problem. |
| Veilkeeper | Read Between the Lines | 75 | Strong | Notice a revealing detail and gain an unusual intuition about the present situation. |
| Daylark | Shared Sunshine | 50 | Medium | Brighten the room with a moment of sincere appreciation or shared delight. |
| Hearthwarden | Safe Harbor | 25 | Light | Offer practical comfort and a little room to feel at ease. |
| Wildspark | Unbound Moment | 75 | Strong | Loosen social inhibitions so everyone present becomes more candid and spontaneous. |
| Heartthread | Shared Understanding | 75 | Strong | Create an opening for honest vulnerability and a deeper, mutual connection. |
| Quietdrift | Room to Breathe | 25 | Light | Ease the pressure to perform, explain yourself, or fill every silence. |
| Trailblazer | First Step | 50 | Medium | Turn a shared intention into one meaningful step forward. |
| Dreamglass | What If | 50 | Medium | Use a vivid possibility to discover what you both might want. |
| Ironbloom | Unshaken | 25 | Light | Meet a difficult moment with quiet courage and patient resolve. |
| Riftcaller | Break the Pattern | 75 | Strong | Challenge an unhelpful assumption and open a different way to respond. |
| Tidewalker | Find the Current | 50 | Medium | Adjust gracefully when the moment does not go according to plan. |
| Oathkeeper | Word of Honor | 50 | Medium | Make your intentions credible through a clear promise and an honest first action. |
| Farwatcher | Ripple Sight | 50 | Medium | See the likely trade-offs of your next move before you choose it. |
| Stormchaser | Seize the Moment | 50 | Medium | Catch a fleeting opening with a bold, spontaneous move. |
| Ashwing | Turn the Page | 50 | Medium | Show that an old pattern does not have to define your next choice. |
| Rootsong | Common Ground | 25 | Light | Find a small point of belonging in a place, interest or shared ritual. |
| Dawnmender | First Mend | 75 | Strong | Open a path toward repair through acknowledgment and a small act of care. |
| Thornheart | Draw the Line | 50 | Medium | Protect your dignity with a clear boundary and a choice about what comes next. |

All 22 original aspects have an ability. The catalog uses an exhaustive typed Record: adding a new aspect without its ability fails typechecking. Existing saves gain the appropriate ability automatically, without changing their assigned aspect or spending the one-time change.

Normal Breakthrough still costs **100 spirit**. Echo abilities cost **25 (Light), 50 (Medium), or 75 (Strong)** based on how directly they can sway a conversation. Light abilities offer small openings, practical comfort or steadiness; Medium abilities give the exchange a clear new direction; Strong abilities can expose subtext, deepen a connection, repair conflict or loosen a whole group's inhibitions. These tiers are also included in the one-response prompt. Prices are initial balance choices, not measured guarantees of model effectiveness.

Only the selected character pays, including Wildspark and Daylark's group effects. An ability can be used once its price is reached; the remaining spirit stays in the bar. From 100, a 25-spirit ability permits four successful uses, a 50-spirit ability two, and a 75-spirit ability one with 25 left. Each needs its own open reply window. The bar still turns gold only at 100; lower-cost readiness reads ECHO READY. The selector, action button and Resonance description all show the price and influence tier. It does not refill bars, charge other characters, spend the player's one aspect change, or add automatic relationship points. Echo abilities activate directly with the catalog's preset action, without a custom text box. The activation handler enforces that preset even if a caller supplies other text. Normal Breakthrough keeps its text box and still requires the player's action text. Existing Echo matching/competing affinity remains a separate end-of-slot rule.

This is a narrative prompt effect, not a guaranteed outcome or a numerical power. The model receives it for one scene response only. The integration uses the existing scene request; it makes no additional AI call just to activate an ability. Replays, created scenes, absent targets and closed reply windows cannot activate it. It creates no new story lore or literal summoning mechanics.

## Source integration and save safety

- `src/shared/echoBreakthrough.ts`: pure typed catalog, option ID and validation. All 22 original aspect IDs; no provider or renderer dependency.
- `src/renderer/prompts/echoBreakthroughPrompt.ts`: composes the one-response instruction from the catalog, selected character and player action. Uses the native response schema unchanged. The Echo instruction replaces, rather than stacks with, the ordinary favorable-outcome instruction.
- `src/shared/breakthrough.ts`: optional validated `BreakthroughPending.echoAspect` and `spent` (25/50/75/100). Ordinary pending records remain unchanged. Failed requests, cancelled dispatches, disabled abilities and interrupted-save recovery add only the recorded charge back to the remaining meter, capped at 100. A token can refund once; retries charge the recorded price again. Older pending records without a valid recorded price retain their original 100-spirit refund/retry behavior. Unknown imported aspect metadata is discarded. No schema bump.
- `src/renderer/stores/breakthrough.ts`: availability, activation, retry and prompt dispatch adapters. Existing synchronous charge, token ownership, failure refund and outcome archive are retained. An ability disabled or changed before prompt dispatch is refunded; retry does not silently substitute another ability.
- `src/renderer/stores/gameStore.ts`: optional aspect in the transient notification, which is not a new permanent character attribute.
- `src/renderer/views/BreakthroughPanel.tsx` and its CSS: optional selector/description, default action and ability notification. Ordinary notification remains unchanged.
- `src/renderer/views/EchoPanel.tsx`: Resonance explanation for the player only.
- `src/shared/modEntries/echo.ts`: default-on ability option, within the existing Echo entry. It requires Breakthrough to be enabled.
- `test/echoBreakthrough.test.ts`: all 22 prompts, exhaustive catalog coverage and unique names, current-player selection, spending, retry/refund, load recovery, invalid metadata, feature switches, missing Echo data and ordinary fallback.

Successful activations archive only actual generated scene lines through the existing Breakthrough continuity path. The ability's instructions and desired outcome never become remembered facts on their own. This update does not rewrite character profiles, saves, artwork, aspect choices, locks or spirit values. Installing a new archive changes code only.

New completed uses retain their exact charged price in the outcome record. If the player rewinds before a use and submits a different reply, removing the whole paid response, that character receives the recorded 25/50/75 spirit back once (100 for Normal Breakthrough), capped at 100. Merely rereading, editing a line or keeping part of the paid response does not refund it. Save/load and earlier decision-point saves preserve this accounting. Older completed outcomes did not store the price and are not retroactively refunded; their price is never guessed from the player's current aspect. See [Breakthrough](breakthrough.md) for the rewind rules.

## Integration boundaries

Keep the discovered Echo entry, modCarry registration and native Breakthrough refund/turn ownership rules together. The player's carried identity supplies the ability; no separate ability carry record is needed. Inside The Unspoken, regular scene abilities and Normal Breakthrough are unavailable. The four-choice menu instead offers one aspect-specific hint per link; it does not spend another ability charge. See [Breaking Through the Silence](reckoning.md).

## Pricing rationale

- **Horizonbound — 50:** Opens a new direction without directly changing feelings.
- **Stoneward — 25:** Practical reassurance rather than emotional persuasion.
- **Sparkweaver — 25:** A useful idea helps the situation more than it sways the person.
- **Lorekeeper — 25:** Advice offers perspective while leaving the conversation largely intact.
- **Veilkeeper — 75:** Revealing insight can substantially reframe an exchange.
- **Daylark — 50:** A shared mood lift can loosen a conversation without forcing candor.
- **Hearthwarden — 25:** Gentle comfort lowers pressure without asking for a change of heart.
- **Wildspark — 75:** Greater candor across everyone present can shift the whole conversation.
- **Heartthread — 75:** Mutual vulnerability creates a strong opening for emotional connection.
- **Quietdrift — 25:** Space and silence ease pressure rather than drive an outcome.
- **Trailblazer — 50:** Turns discussion into a concrete next action.
- **Dreamglass — 50:** An imaginative question can draw out aspirations and change the subject.
- **Ironbloom — 25:** Steadiness supports the reader without strongly steering the other person.
- **Riftcaller — 75:** Challenging the premise can turn a stuck conversation in a new direction.
- **Tidewalker — 50:** A workable compromise can redirect disagreement.
- **Oathkeeper — 50:** A credible commitment can shift how an intention is received.
- **Farwatcher — 50:** Clear trade-offs can change a decision without granting certainty.
- **Stormchaser — 50:** A timely invitation can turn hesitation into a meaningful choice.
- **Ashwing — 50:** A new action can challenge expectations without erasing the past.
- **Rootsong — 25:** A familiar point of belonging offers a modest social opening.
- **Dawnmender — 75:** Repairing hurt can change the direction of a difficult relationship conversation.
- **Thornheart — 50:** A clear boundary can redirect the terms of an exchange.

## Verification

The exhaustive typed catalog and tests cover all 22 costs, fixed-action enforcement, partial-bar readiness, repeated affordable activations, exact refunds, recovery, legacy full-bar records and Echo-off fallback. See [current validation](echo-validation.md) for the combined branch checks. Prices are provisional balance decisions; automated tests do not measure model effectiveness.
