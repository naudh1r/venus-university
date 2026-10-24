# Mini-game framework changes for upstream review

Reviewed against Venus Extracurriculars `main` on 24 October 2026.

## Scope and comparison baseline

Upstream main resolves to [`baca60f`, Extracurriculars 0.3.1](https://github.com/venus-extracurriculars/build/commit/baca60fdd491d8d6cbb53a40f5e4dba13a3f9e20). The following are proposed changes in the fork, not features already merged upstream.

| Patch | Reviewed head | Difference from main | Purpose |
| --- | --- | --- | --- |
| [Invitation, context and scene state](https://github.com/naudh1r/venus-university/tree/fix/minigame-scene-state) | `d43553e` | 3 commits; 17 files, including docs/tests | Discuss games at a destination, keep ordinary prompts compact, and save invitations/setup/results with the scene |
| [Generic slot-activity hooks](https://github.com/naudh1r/venus-university/tree/fix/minigame-training-hooks) | `165f073` | 1 commit; 19 files, including docs/tests | Allow enabled mods to offer interactive Improve Stats activities |
| [Training integration](https://github.com/naudh1r/venus-university/tree/experiment/minigame-stat-slots) | `297cad7` | Integration reference, not a framework-only PR | Includes both patches plus the Mini-games training provider, settings and game metadata |

Both framework branches descend from this upstream baseline. The scene-state branch already contains the earlier destination and compact-invitation changes; it does **not** contain the separate training-hooks patch. The experiment integrates both. Do not use the combined Bunnyfeeds/Photo/Darts test branch as a framework PR source.

Darts rules, extra modes, artwork, board-rendering optimisation, Photo Feature, Bunnyfeeds and Emoji Extended are outside this report.

## 1. Destination-aware invitations and launch

**Problem:** resolving the venue after background playback makes the HUD list correct on arrival, but does not tell the model about the destination's playable games in the request that asks to travel there. The narrator can consequently invent a darts match rather than hand control to the actual game.

The existing location/input fixes already in main are retained. This patch extends the request and agreement flow:

- An action naming a game and one explicit, available venue can receive that destination's game context before travel.
- Destination matching uses registered IDs/names and the Pino-Cola alias, not generic lore triggers such as “race”. Ambiguous destinations are not guessed.
- The prompt asks for agreement first, then arrival with the correct background and setup. It forbids narrating throws, moves, scores or outcomes.
- The agreement stores its destination. Both automatic opening and the manual panel check the reached venue and current game availability before launching.
- Response validation uses the catalogue actually supplied to that request, rather than inferring an offer from unread reply backgrounds.
- Participant consent and existing HUD proposal handling remain required. An invitation alone never launches a game.

Example: at a cafe, “Want to play darts at Pino-Cola?” supplies Darts context for Pino-Cola. If she agrees, narration moves to the lounge and stops at setup; the real game opens after playback reaches the venue and the scene is ready for input.

Key files: `minigames/place.ts`, `offer.ts`, `MiniGameSeat.tsx`, `MiniGamePanel.tsx`, and `modEntries/mini-games.ts`.

## 2. Compact ordinary-turn context

| Situation | Added mini-game context |
| --- | --- |
| Ordinary conversation where suggestions are available | Local game IDs, short blurbs and suggestion rates; no full rules/options or launch agreement schema |
| Possible outing | At most two available game/venue pairs, rotated by slot; no outing suggestions in busy scenes or without NPCs |
| Player names a game | Detailed context for the named offered game(s), including supported rules/options and consent schema |
| Player answers an NPC invitation | Detailed context for that invitation, so “okay”, refusal and follow-up questions can be interpreted in context |
| No eligible local suggestions or outings | No discovery block |

The model reports an unanswered invitation through `minigameInvite: { game, location }`. The engine validates the exact pair against the request's choices, then retains it for the next response. A false or invented pair is ignored. The model still decides whether the actual words express consent.

The two-item limit applies to **remote outings**, not the entire local catalogue. Local catalogue size can still grow with enabled packs. Destination discovery from player text still relies on recognised game and venue names; this is not arbitrary semantic travel detection.

Earlier measurements of prompt text plus added schema showed character reductions of 77% at Pino-Cola, 71% at BTB Arcade and 79% at Cat Cafe. Those measurements preceded the outing shortlist and structured destination field. They are not current token counts or provider billing guarantees.

## 3. Scene saves and restart semantics

Main keeps an agreed game beside saves in localStorage. The patch moves invitation and match checkpoints into optional `SceneState.miniGame`, copied by scene capture, restore and queued saves.

Saved data includes invitation and its transcript marker, game ID, venue, participants, stakes, options, match ID, status, and a settled result when available.

| Save point | Load behaviour |
| --- | --- |
| After an NPC invitation | Restore that save's invitation; validate its transcript marker |
| After agreement / during play | Restart the match with the same participants and options |
| After the game reports its result | Continue aftermath; do not reopen the match |
| New scene or old save without the field | No carried-over mini-game checkpoint |

Scores, individual moves and RNG state are not saved. A restarted game can have a different deal or roll. The Save Game panel explicitly explains restart versus completed-result behaviour.

The host checkpoints a result when `play.finish` is called and persists before requesting aftermath. Session guards suppress duplicate result dispatch. Recovery waits for scene readiness and avoids running while another panel, request or error is active.

The old localStorage agreement/invitation entries are not migrated or read. Old saves remain loadable, but an invitation or agreement that only existed in those entries may need to be made again. Disabled games do not bypass availability checks.

Core-facing changes are limited to the optional shared type, game-store capture/restore, queued save handling and Save Game wording. The save contract is mini-game-specific; it is not yet a general mod-owned persistence hook.

## 4. AI calls and solo aftermath

Invitation detection, pair validation and destination matching make **no separate AI call**. They use the existing scene request and structured reply.

There is a deliberate behaviour change for completed, checkpointed solo games: main can display a result and carry its account into the next player turn; the patch immediately submits the result for AI aftermath. This can add an automatic narration request relative to that baseline. Reload after a result can also retry aftermath. Duplicate dispatch protection does not make network calls exactly-once across a crash/reload.

NPC round dialogue and its chattiness settings are unchanged by the framework patch. Game scoring remains engine-owned.

This patch does not generally allow solo free-roam scenes or remove normal scene/consent requirements. Supporting a saved solo match is distinct from introducing a new way to start a solo scene.

## 5. Separate experimental Improve Stats hooks

The training-hooks branch adds generic extension points without importing a game pack into core:

- `statActivities(stat)`: enabled providers offer an owned ID, label, location and stat.
- `slotActivityAvailable(offer)`: revalidate at commit and recovery.
- `SceneState.activity`: save the selected activity with pending/completed/abandoned status.
- `finishSlotActivity(owner, id, completed, result)`: settle only the matching pending activity and persist before closing narration.
- Pending interactive activities hold the opening at a decision point instead of immediately ending a solo scene.

The existing slot boundary applies the reward. For a completed committed activity, its selected stat replaces the ledger-selected training award: +2 without company, +1 with company, subject to existing higher-priority rules. No points are added directly by the game callback. Pending/abandoned activities have no training award. Ordinary hangouts retain existing ledger-based rewards.

The **Mini-games provider is separate** in the experiment. It adds the default-off “Offer mini-games when committing to a slot” setting, solo-compatible game metadata and natural activity phrases. Ordinary activities remain available. Normal encounter casting is retained: no NPC allows the selected solo game; with company, the player can ask to join or use the existing Play alone flow. A present spectator still counts as company for the reward.

The provider also restricts Swim Race to the stadium pool. This is a game catalogue/location change, not part of the generic hooks branch. Heart keeps ordinary activities because the current provider has no eligible solo Heart game.

## 6. Validation and review boundaries

Previously completed validation on the implementation snapshots:

- Scene-state framework: 233 tests across 12 files; Node, renderer and test typechecks passed.
- Integrated experiment: 256 tests across 17 files; the same typechecks passed.
- Browser harness using real Cat Pairs UI and mocked AI: reload after a move restarted the match; reload after completion requested aftermath without reopening the cards.
- Tests cover destination ambiguity, unavailable games, invitation round trips, stale invitations, solo/group setup, result recovery, duplicate callbacks, and training settlement/reward behaviour.

This review checked current upstream and the source differences; it did not rerun those suites or validate a released Electron build. Real-model invitation, consent, travel and aftermath wording still require in-game playtesting.

Suggested author decisions before upstreaming:

1. Review destination/context changes, scene persistence and training hooks as separate concerns. The scene-state branch currently bundles the first two.
2. Decide whether a mini-game-specific save field is acceptable or should use a generic core persistence hook.
3. Confirm the immediate solo-aftermath call and restart-on-load contract.
4. Review training rewards and provider policy independently from the generic hooks.
5. Exercise unavailable/removed packs, participant departure, failed saves, failed AI calls, rewind and reload near the result boundary. A completely removed game definition currently has no generic result-recovery fallback.
6. Test same-turn invitations: ordinary compact replies deliberately cannot launch a game without detailed agreement context. This keeps consent explicit but can require another player response.

No new PR or message to the author was sent as part of this report.
