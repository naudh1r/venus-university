# Darts

Darts is a PC mini-game in **[Nd] Arcade & Bar Games** by naudh1r. Play solo against
the house, team up with one or two girls, or compete in a 301 Rival Match. The board
fills the game screen while keeping the current Venus scene behind it. Dialogue and
character expressions use the scene's own text box and sprites.

This guide describes the Darts integration on Venus University **0.5.0** with the
Extracurriculars mini-games framework, including the updated NPC precision balance.

## Where to play

Enable **Mini-games**, **[Nd] Arcade & Bar Games**, and its **Darts** game switch in Mods.
Darts is available at:

- BTB Arcade
- Stalestein Bar
- Pino-Cola Lounge

Start or continue a scene with an NPC at one of these venues. Open the existing
mini-games HUD button to choose Darts, participants and options, or agree to a game
through scene dialogue. A narrator-launched game needs agreement from both the player
and at least one NPC. A suggestion alone does not start the match.

To play solo, choose **Play alone** in the HUD while an NPC is present in the scene.
That NPC remains a bystander and does not throw. Darts does not create a separate,
ongoing scene without NPCs; the base game's normal scene-ending rules still apply.

When narration moves to a new venue during a scene, the games on offer follow the
location the player has actually reached. An unread destination or a cosmetic
background override does not unlock games early.

## Mouse-only controls

The match can be played entirely with the mouse.

| Action | Mouse control |
| --- | --- |
| Place your aim | Move the mouse over the dartboard. |
| Lock your aim | Hold the left mouse button on the board. The ellipse appears and its dot starts moving. |
| Throw | Release the left mouse button when the dot is where you want the dart to land. |
| Hand over to the NPCs | Click **Change turn** when it becomes available. |
| Start your next visit | Click **My turn** when it becomes available. |
| Check scoring | Click **Score guide**, then **Back to the board** to close it. |
| Toggle Darts sound | Click **Sound on / Sound off**. |
| Leave an unfinished match | Use the framework's **Walk away** button. |

Holding locks the ellipse at the chosen aim; moving the mouse afterwards does not drag
it around. Release timing selects the landing point at the moving dot. Player throws
do not receive a separate NPC-style accuracy roll. The ellipse and dot appear only
while holding; aim indicators are hidden during NPC turns. Losing focus cancels a held
aim, and automatic NPC throws wait while the game window is away.

Each visit has up to three darts. The score panel starts with three dart icons and
replaces each one with its hit label and points after landing. Earlier darts in the
same visit become silhouettes; holding to aim also turns existing landed darts into
silhouettes. The board clears when the next participant's visit starts.

## Scoring

| Region | Points |
| --- | --- |
| Single | The sector number |
| Double: narrow outer ring | Twice the sector number |
| Triple: narrow middle ring | Three times the sector number |
| Outer bull | 25 |
| Inner bull | 50 |
| Outside the scoring board | 0 |

Both modes use **straight-out**: reach exactly zero on any scoring region to check out.
A double is not required. Going below zero is a **bust**: all points from that visit
are cancelled, its opening balance is restored, and the visit ends immediately.

## Game modes

### Beat the House

Count down from **301, 501 or 701**; the default is **501**. With NPC teammates,
everyone subtracts from the same team balance.

| Participants | Turn order | Visits available |
| --- | --- | --- |
| Solo | Player | Five player visits, up to 15 darts |
| Player + one girl | Player → girl → player → girl → player | Three player visits and two NPC visits |
| Player + two girls | Player → first girl → second girl → repeat, ending with the player | Three player visits and two visits per NPC |

Reaching zero wins immediately. If the last visit ends with points remaining, the house
wins. During solo play, **My turn** starts each new visit. Solo always uses Beat the
House, even if Rival Match was previously selected in preferences.

### 301 Rival Match

Play against **one or two girls**. Every participant starts with a separate **301**
balance and gets up to three visits, alternating player, first girl and second girl
where present. The first checkout wins immediately. If nobody checks out, the lowest
remaining balance wins; equal lowest balances draw. The house starting-score option
does not change Rival Match's 301 starting balance.

## NPC skill

The first time each NPC plays Darts in a playthrough, the framework asks the model to
judge overall skill **1–5**, a short playing style, and three personality-based biases
**−2 to +2**. That single judgment uses personality, traits, likes and backstory.

The engine converts that judgment into three independent stats from **0–100**:

| Stat | Effect on throws |
| --- | --- |
| Accuracy | Higher values make the landing group tighter around the chosen target. |
| Consistency | Higher values reduce variation in spread between throws. |
| Composure | Higher values reduce extra spread near checkout or in late visits. |

These stats are not portions of a shared 100-point total. A small, repeatable variation
comes from NPC identity. Skill and biases are cached per **playthrough + NPC + game**
in the application's local storage; the final stats are derived when a match starts.
Later matches reuse the judgment. Starting a new playthrough allows a new judgment.
Clearing application storage or transferring only a save does not carry this cache.
There is currently no automatic skill growth or in-game skill inspector.

High-skill NPCs now group their throws more tightly, including under pressure, while
still being able to miss. The engine chooses targets from the remaining score, plans
possible checkouts and varies high-score targets. It then rolls seeded drift from the
three stats. The model does not decide points or landing coordinates.

If the skill call fails, the current attempt uses level 3 with neutral biases; the
framework can try the judgment again next time.

## Dialogue and turn pacing

After the player's visit ends, the engine plans the upcoming NPC throws before asking
the model for dialogue and expressions. With two girls, both consecutive NPC visits
are included in **one batch call**, rather than a call for every dart or girl.

The model sees the player's last visit and the planned NPC results. It writes reactions
for those exact moments: character banter, encouragement, teasing, rivalry or nerves,
with scores mentioned when natural. It must not reveal later results early or change
the engine's results. Invalid or unavailable responses use fallback dialogue.

| Dialogue setting | Automatic companion dialogue |
| --- | --- |
| Quiet | No companion reaction calls or unsolicited speech |
| Some | An intro and up to one selected impact reaction per NPC visit |
| Lots | An intro, reactions after each non-final hit, and a closing if the match continues |

For Some and Lots, the first intro is shown before **Change turn** unlocks. After the
player clicks it, the NPC pauses briefly, throws, and the score and LED effects respond
at impact. Her bound reaction and expression appear about **350 ms after landing**.
Each reaction finishes before the next throw; another brief pause separates the girls.
**My turn** becomes available only after the whole NPC block and its dialogue finish.
Native reader-paced settings and text overflow sequencing remain in effect.

A full, non-Quiet team match normally needs up to **two companion batch calls**;
an early checkout can reduce that. First-time skill judgments, optional player chat
and the narrator's result response are separate calls. Solo has no NPC skill or
companion reaction calls. Quiet still permits first-time NPC skill judgment and the
framework's normal result narration.

The normal scene's "What do you do?" input is hidden during a match, including solo.
Its unsent draft is kept and returns when the mini-game closes.

Optional table chat opens on hover and stays open while typing. Sending puts it away.
New dialogue closes a hover-only peek without interrupting a focused draft. The text
box adjusts for multiline input. Required answers in other mini-games, such as Truth
or Dare, stay visible.

## Presentation and results

Throw and impact animations, dartboard LED patterns, animated score changes, hit sounds
and win/loss feedback accompany the match. The score guide overlays the board with a
blurred backdrop. Local sound mute respects the game's global SFX volume. The game's
Reduce Motion setting shortens animation and timing.

When a match with NPC participants ends, the framework hands its actual outcome and
throw account to the narrator. Narration starts **after** the settled result rather
than staging the final throw again. Solo results are added to the scene and supplied
with the next player turn, following normal framework behavior. Walking away reports
an unfinished match. Darts adds no fixed stat reward; ordinary scene bookkeeping
handles any relationship or player-stat consequences.

An active match is temporary and does not resume after reloading. Finish it before
closing if you want a completed result. Updating the precision balance does not require
resetting cached NPC skill; start a new match to use the updated throw plans.

The Arcade & Bar Games pack defaults on and requires the Mini-games framework. Turning the framework off disables Darts; with the framework on, Darts is available unless its pack is explicitly switched off. Existing saved mod preferences are respected.

## Rendering and startup

Darts reuses fixed-size board texture layers and dart images between games. Canvas
redraws stop while the board is unchanged or covered by its score guide, and resume
for mouse aim, throws, impact effects and resizing. The frame callback still checks
for visual changes; pointer timing and animation speed are unchanged.

NPC skill loading belongs to the Mini-games framework. A first game with an NPC
can still wait for that AI judgment before the board appears; this rendering
optimization does not change the framework or its skill cache.

## Artwork, audio and licensing

Dart artwork was contributed by **naudh1r**. The images are AI-generated or adapted
from AI-generated artwork and models. For the multi-angle views, an AI-generated dart
image was used as a reference to generate a 3D model in **[Meshy](https://www.meshy.ai/)**.
Screenshots were captured from the required angles and edited into game sprites.

| Asset | Source and permission |
| --- | --- |
| `src/assets/darts/dart-hud-side.png` | Separately AI-generated 2D artwork contributed by naudh1r for inclusion and redistribution with Venus Extracurriculars. |
| `src/assets/darts/darts-eye-level.png` | Multi-angle sprite artwork prepared by naudh1r using AI artwork and Meshy model views; provided under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). |
| `src/assets/darts/darts-meshy-views.png` | Screenshots of a Meshy-generated dart model, captured and adapted by naudh1r; provided under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). |

**Attribution for the model-derived sprites:** Dart model created by naudh1r using
Meshy — CC BY 4.0. Screenshots captured and edited into game sprites by naudh1r.
Adaptations include cropping, background removal, sprite-sheet layout and colour
variations where applicable. Retain this attribution and the licence link when
redistributing or adapting the CC BY 4.0 assets.

These contributed images are **not Venus Dev assets**. Their
[directory-specific asset notice](../../src/assets/darts/LICENSE.md) identifies the
separate permissions that apply to these three files, rather than the repository-wide
Venus Dev attribution. The game's AGPL code licence does not replace these permissions.
Meshy's output licence does not grant rights to unrelated third-party material.
See [Meshy's ownership guidance](https://help.meshy.ai/en/articles/10137554-what-is-the-ownership-of-the-generated-models)
and [terms of service](https://www.meshy.ai/terms-of-use).

All Darts sound effects are synthesized at runtime by the game's audio code;
there are no bundled third-party Darts sound recordings.
