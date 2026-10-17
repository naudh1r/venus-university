# Location-bound mini-games disappear after a narrated move

## Environment

Observed in the Venus Darts fork of Venus University, using the mini-games framework
imported from `morrowkiln/venus-extracurriculars-minigames` at
`c039c90f7c86295a7364a9e2f648283e564c0f61`. The baseline before this fix is
`c15c9dfe073dc369e96b68151a62b5e5e322e314` on `feature/darts-multiplayer`.
This report describes that integration; it does not assert that newer upstream versions
still have the same issue.

## Reproduction

1. Enable the framework, a location-bound pack such as Pool, and optionally Darts.
2. Start a scene with an NPC in a dorm or another location.
3. During the same scene, ask the NPC to come to Pino-Cola Lounge.
4. Let narration move through the journey and reach a line with `bg: "pinocola_lounge"`.
5. Open the mini-games HUD or ask to play Pool/Darts on the next player turn.

Expected: the HUD offers the enabled games available at Pino-Cola, and the narrator's
standing offer can include those games under the usual suggestion and agreement rules.

Actual before the fix: Pool and Darts can be absent, while location-independent card
games remain. The scene is visually at Pino-Cola, but availability still uses the original
`sceneLocation` or a blank value.

An equivalent case occurs when the opening action names an activity without a place.
The classifier correctly returns an empty `sceneLocation` under its existing contract.
The narrator may then choose Pino-Cola and emit its background, but the classifier's
blank value remains the availability input.

## Cause

The classifier runs at scene opening. `sceneLocation` is carried from that verdict;
continuations can move the scene through `bg` without re-running classification or
updating this value. The framework reads `sceneLocation` for HUD offers, narrator offers,
agreement validation and the location handed to games. The background is a separate state.
Normalizing spelling does not resolve a blank or stale location.

The prompt's projected stage may include unread queued lines. Using that stage directly
would also expose destination games before the player has actually reached the venue.

## Fix in this fork

- Add one pure mini-game resolver: before any scene background is reached, normalize the
  classifier location; afterwards, use the last background in the reached playback log.
- Map known scene art keys to canonical venues, e.g. `pinocola_lounge` to
  `pino_cola_lounge`, `arcade` to `btb_arcade`, and `bar` to `stalestein_bar`.
- Unknown backgrounds, roads and unrecognized private rooms clear stale venue availability.
  Do not fall back to a previous venue after a background transition.
- Use the same resolver for the HUD, narrator offer/suggestion rates, agreement validation
  and `GamePlay.location`.
- Ignore unread queued lines and cosmetic `bgOverride` selections.

No extra model call, classifier change, natural-language location guessing or automatic
venue selection is added. The base game's `sceneLocation`, casting, NPC-agreement rules,
scene closing and stat bookkeeping are unchanged. Narrator-launched games still need NPC
agreement; the existing HUD can offer solo play where a game's rules permit it.

The resolver cannot offer games for a future destination before it has been reached.
After a narrated move, the next request/HUD refresh sees the new venue. Custom art keys
need an explicit mapping (or a canonical location ID) to identify their venue safely.

## Validation

82 focused tests and all three TypeScript checks pass in this fork.
Automated checks cover blank/stale locations, dorm-to-lounge movement, leaving a venue,
another venue's suggestion rates, private/unknown art, room-game availability and normal
classifier fallback.
Browser regression checks exercise the real HUD and scene request/reply hooks, with
queued/unread destination lines and cosmetic overrides kept separate from reached lines.
Model responses are mocked; no paid live model calls are needed for this fix.
The existing two-NPC Darts browser sequence also passes, including its paced landings,
expressions, score guide, SFX mute, single result handoff and cleanup.
