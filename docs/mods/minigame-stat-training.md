# Experimental mini-game training slots

Training slots are built on the slot activity hooks described in `MODDING.md`. Existing mini-game rules are unchanged.

## Enable and play

Turn on Mini-games and the packs you want to play. In the Mini-games mod settings, enable **Offer mini-games when committing to a slot**. It ships **off**.

The landing's Improve Stats suggestions can now name a real game and place, for example “Improve Brain with a memory game at CuteTea.” Suggestions alternate with ordinary activities across slots; classes, jobs and plans retain their existing priority. The selection stays stable during a slot. Turning a pack or game off removes its training offers.

Commit that activity and read the opening. Normal encounters still happen. With no girl present, the selected game opens for solo play. With company, its panel offers Play alone or asking the eligible girls to join; agreement is still required. A girl merely being present does not make her a participant. The selected game is retained when she declines; play alone remains available from the HUD.

Only games that support solo play are landing candidates, so a missing encounter can never prevent the committed activity. Location restrictions and disabled City Life locations are respected. The activity metadata, rather than AI interpretation of its sentence, chooses the game, place and stat.

## Training catalogue

| Stat | Eligible solo games |
| --- | --- |
| Brain | Cat Pairs, Pool |
| Body | Darts, PARADISO, Foot Race, Swim Race, Rink Race, Hoop Shot, Bowling, Skee-Ball, Whack-a-Bun |
| Heart | No solo-compatible training game yet; ordinary Heart activities remain |

Blackjack and Poker declare Brain, Air Hockey declares Body, and Truth or Dare declares Heart, but they are excluded from landing offers because they require another player. High-Low, Claw Machine and Beer Pong are recreational and declare no training stat in this experiment.

Each training game supplies a natural activity phrase rather than inserting its menu title after “playing”. Swim Race is offered only at the Palaestra Stadium pool, including HUD and narrator offers; Selkie Beach remains available for ordinary narrative swimming.

## Completion, rewards and recovery

Win, loss, draw or a completed solo run all count as completion. Closing narration begins after the real result, without replaying the final move. Mini-games' `exercisedStats` hook makes the selected stat the one the scene exercised, before any award or other mod's bonus is worked out: +2 for a scene without company, +1 for a scene with company. Playing alone while a girl is present still counts as company. Existing sickness restrictions apply.

The award replaces the ledger's training award for that committed slot; it is not an extra award. Ordinary hangouts retain their existing ledger rewards. Games played outside a committed training activity have no new guaranteed reward.

Walk away or dismissing the training selection spends the slot without a completion reward. A technical failure keeps the activity pending and offers Retry training or End session. Reloading during play restarts the selected activity; individual games keep no mid-match saves. A settled result is saved before the closing call, and a reload resumes its aftermath. Reward is applied only at the normal slot boundary, not per callback or per match.

If a committed game's pack or location becomes unavailable, the activity closes without a completion reward rather than trapping the scene. Disabling only the suggestion setting does not cancel an already committed activity.

## AI calls

Generating landing suggestions and calculating rewards require no AI. The normal scene-opening call stages the activity; a result-aware aftermath call follows gameplay. Existing ledger and slot-closing work remains. Calls a game makes for companion dialogue are separate, as before. Experimental testing uses mocked AI responses; real-model narrative adherence needs in-game playtesting.

## Suggested playtest

- Setting off: ordinary landing suggestions and ordinary hangout games behave as before.
- Setting on: test a named Brain or Body activity with and without an encounter.
- With an encounter: choose Play alone; separately ask her to join and test both acceptance and refusal.
- Finish with a loss as well as a win; verify exactly one selected-stat reward at slot end.
- Walk away before and after the first move; verify no training reward.
- Save/reload during setup, during play and after completion; verify restart or closing as appropriate, without duplicate reward.
- Disable the selected pack after committing and verify that the slot can still close.
