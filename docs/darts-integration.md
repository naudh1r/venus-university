# Venus Darts integration

This branch starts from `venus-extracurriculars/build` main at
`1fe5998d462fbfaaa359b6a7144b2d9cf611cc74` (release 0.2.0). It incorporates morrowkiln's
mini-games framework and four packs from `c039c90f7c86295a7364a9e2f648283e564c0f61`, then
adds the `naudh1r-darts` pack. The newer main's Echoes rail seat and 0.2.0 build version
are preserved. The existing successful-turn test fixture now includes the raw reply
required by the framework's after-reply hook.

## Play

Run `npm ci`, then `npm run dev` for Electron or `npm run dev:web` for the browser build.
Enable **Mini-games** and **Venus Darts** in Mods. Start a scene with one girl at BTB Arcade,
Stalestein Bar or Pino Cola Lounge. Use the existing mini-games HUD button and ask her to
play Darts, or agree to play through ordinary scene dialogue. She is your teammate.

Move the pointer or arrow keys to aim. Hold left click or Space to lock the ellipse;
release to throw exactly where the moving dot is. Shift makes keyboard adjustment finer.
The ellipse is drawn only while holding. No reticle or ellipse appears on partner turns.

Choose a shared countdown of 301, 501 or 701. Five visits alternate player / partner /
player / partner / player, with up to three darts each. Reaching exactly zero on any
region wins for both. Overshooting cancels that entire visit, restores its opening
balance and immediately hands over. Any balance after visit five loses for both.

## Native framework behavior

The game uses the full `screen` surface, with darts-specific styling that removes its
paper frame. The scene background remains visible, the board is large, score is on the
right and native dialogue stays below it. Other mini-games keep their own surfaces.

The framework owns scene availability, invitations, options, NPC skill, the native
text box and sprite, pacing, walking away and reporting the result to the narrator.
No separate darts HUD launcher, portrait, floating speech card or provider-key field
is added. The pack uses the Venus model and credential settings through `play.round`.

Skill is judged and cached by the framework, 1–5 per NPC/game/playthrough. Darts derives
three independent traits from that skill and stable character identity: accuracy,
consistency and composure. These values are not a split of 100. They stay fixed for the
same character and cached skill; each throw advances the engine's seeded randomness.

A sitting follows the framework's transient-match behavior: an agreement can survive
reload before the table opens, but an active match does not resume after reloading.
Walking away supplies an unfinished account to the scene. Standalone saves are separate.

## AI timing

After the player's visit, the engine fixes the whole NPC visit in memory before asking
for dialogue. It supplies actual player points, current and remaining scores, and every
planned NPC hit with its remainingBefore/remainingAfter, bust and outcome. The model
returns only lines and native expression ids keyed to throw ids; it cannot change hits.
A bust or checkout can shorten a visit to fewer than three darts.

Those score facts establish the moment; they are not a script for an announcer. The
request asks the model to continue the NPC's personality, relationship, recent dialogue
and scene mood through varied teammate banter. It may tease, encourage, flirt, joke,
show nerves or talk light strategy. Scores and hit labels are mentioned only when they
sound natural because the board already shows them.

- Quiet: no unsolicited reaction calls or speech.
- Some: one batch per NPC visit; intro plus one noteworthy impact reaction.
- Lots: one batch per NPC visit; intro, each non-final impact and a non-final closing.

The intro finishes before **Change turn** unlocks. An NPC dart flies, score and LEDs
respond at impact, then 350 ms passes before its bound reaction and expression. Each
line finishes before the next automatic throw. Overflow and reader-paced mode use the
native framework. **My turn** unlocks after the visit's closing. The final match reaction
belongs to the narrator after `play.finish`; it is not requested or spoken a second time.

Invalid, overlong or unavailable model output uses engine-aware fallback lines. Late
responses from a closed table are ignored. Unmount clears canvas frames, observers,
audio and timers. Automatic throws pause while the window is away.

## Small framework extensions

`GamePlay.speak(charId, text, expression?)` accepts an optional native `TableExpression`.
It appears with the queued line as a normal sprite action, preserving the current outfit,
normal playback and rewind. Older two-argument callers keep their behavior. Darts uses
only the seven native expressions, not focused/confident sprite ids from the standalone.

The renderer kit exposes `useEffectsGain()`, following the saved Venus SFX slider's squared
gain. The local mute switch multiplies that gain, so it cannot bypass global SFX mute.
`MiniGamePanel` exposes the current game id as a data attribute for scoped pack styling.

## Verification

- All TypeScript checks and production web build pass.
- The pure engine matches 8,050 standalone ledger states across both rulesets, all modes,
  all demo partners and 20 seeds; six additional tests cover scoring and cached NPC visits.
- Full suite: 3,077 pass, one skipped, one fails. The identical Windows-path rejection test
  also fails on the untouched latest-main baseline under Linux; those source/test files
  are unchanged by this feature.
- Browser checks use a fixture NPC and mocked replies: full-stage bounds at 1080p, 720p,
  1440p and 4:3, native HUD/agreement, score guide, global SFX mute, intro gating, cached
  NPC hits, outfit-preserving expressions, five-visit result handoff once and clean unmount.
- No paid live model calls were made.
