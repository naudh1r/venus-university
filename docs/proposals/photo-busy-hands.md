# Brief: Photo Feature 1.7.0 — her hands on what she is doing

On `mod/photo-1.7.0-vu0.6.0`, as one commit on top. Author `Naudh1r <102735014+naudh1r@users.noreply.github.com>`, no co-author lines. Photo files only (`photoPose.ts` and its tests), no allowlist rows, no guide edits. Push to `origin`.

## The case

Caption: "In her room, sitting cross-legged on an unmade bed with a dark acoustic guitar balanced against her hip, taken from the waist up."

Pose tags sent: `sitting, hands_on_lap, indian_style, (upper_body:1.3)`.

The sitting position's default `hands_on_lap` put her hands in her lap, so the guitar was drawn propped beside her.

The mechanism for this already exists: `BUSY_HAND_CUES` strike every placement tag when her hands are busy. But nothing in that caption counted as busy, and the cue list has no instruments or common activities.

## 1. More busy-hand cues

- Add activity verbs to `BUSY_HAND_CUES`: playing, strumming, practising/practicing, typing, writing, drawing, sketching, painting, texting, scrolling, cooking, stirring, brushing, applying, tying, fixing, adjusting, knitting, sewing, holding up, showing off, pointing.
- Add instrument nouns, which occupy her hands even with no verb ("with a guitar balanced against her hip"): guitar, ukulele, violin, cello, bass, keyboard, piano, flute, microphone, mic.
- Check each against the existing cue matching (whole words, plural tails) so that "playing with her hair" keeps its own row, and words like "bass" or "mic" don't fire inside other words.

## 2. Instruments get their action tags

Booru checkpoints draw an instrument in her hands from these tags, and rarely from the sentence alone. So, unlike the cup case the comment describes, add tags here:

| Caption | Tags added |
|---|---|
| guitar, ukulele, bass or violin, with playing/strumming/practising | `playing_guitar` (or `playing_ukulele`, `playing_bass`, `playing_violin`) and `holding_instrument` |
| one of those mentioned with no playing verb | `holding_instrument` and the instrument's own tag (`guitar`, `ukulele`, …) |
| piano or keyboard | `playing_piano` (or `keyboard_(instrument)`), with `sitting` where no position is given |
| microphone or mic | `holding_microphone` |

These sit beside the existing hand actions, and placements are struck as for any busy hands.

## 3. Mirror selfies are left alone

One hand is on the phone, and `withoutHeldObject` already removes what the other holds. Don't add instrument tags to a mirror selfie, and don't let an instrument cue strike its phone hand.

## Tests

- The caption above → no `hands_on_lap`, and includes `holding_instrument` and `guitar`.
- "…strumming her guitar on the bed" → `playing_guitar`, `holding_instrument`, no placement tag.
- "…sitting at her desk typing on her laptop" → no `hands_on_lap`.
- "…sitting on the bench, playing with her hair" → the hair row's own tags, unchanged.
- "A mirror selfie in her room with her guitar behind her" → no instrument tags.

## Changelog

Extend the 1.7.0 "More than selfies" bullet with a short clause rather than adding a new bullet. For example: "…and her hands on whatever she's doing, like a guitar."

## Checks

- `npm run typecheck` passes; the kit and photo tests pass, plus the new cases.
