# Brief: Photo Feature 1.7.0 — her hands on what she is doing (activities, instruments)

On `mod/photo-1.7.0-vu0.6.0`, as one commit on top. Author `Naudh1r <102735014+naudh1r@users.noreply.github.com>`, no co-author lines. Photo files only (`photoPose.ts` and its tests), no allowlist rows, no guide edits. Push to `origin`.

## The case

Caption: "In her room, sitting cross-legged on an unmade bed with a dark acoustic guitar balanced against her hip, taken from the waist up."

Pose tags sent: `sitting, hands_on_lap, indian_style, (upper_body:1.3)`.

The sitting position's default `hands_on_lap` put her hands in her lap, so the guitar was drawn propped beside her.

The mechanism for this already exists: `BUSY_HAND_CUES` strike every placement tag when her hands are busy. But nothing in that caption counted as busy, and the cue list has no instruments or common activities.

## 1. More busy-hand cues

- Add activity verbs to `BUSY_HAND_CUES`: playing, strumming, practising/practicing, typing, writing, drawing, sketching, painting, texting, scrolling, cooking, stirring, brushing, applying, tying, fixing, adjusting, knitting, sewing, holding up, showing off, pointing.
- Add instrument and activity-object nouns, which occupy her hands even with no verb ("with a guitar balanced against her hip"): guitar, ukulele, violin, cello, bass, keyboard, piano, flute, microphone, mic.
- Check each against the existing cue matching (whole words, plural tails) so that "playing with her hair" keeps its own row, and words like "bass" or "mic" don't fire inside other words.

## 2. Activities get their action tags

Booru checkpoints draw an activity from its action tag far more reliably than from the sentence. The existing comment warns that an *object* tag beside a sentence's object adds a second one (two cups), so add **action** tags, plus an object tag only where the action has none of its own.

| Caption says | Tags added |
|---|---|
| playing / strumming / practising + guitar, ukulele, bass, violin | `playing_guitar` (or `playing_ukulele`, `playing_bass`, `playing_violin`) and `holding_instrument` |
| one of those instruments, no verb | `holding_instrument` and the instrument's own tag (`guitar`, …) |
| piano / keyboard | `playing_piano` (or `keyboard_(instrument)`), with `sitting` where no position is given |
| microphone / mic, singing | `holding_microphone`, plus `singing` if it's said |
| reading | `reading`, plus `holding_book` only when "book" is named |
| typing / on her laptop | `typing`, `laptop` |
| writing / studying / doing homework | `writing`, `holding_pen` |
| drawing / sketching | `drawing`, `holding_pencil` |
| painting (a picture) | `painting_(action)`, `holding_paintbrush` |
| playing games / gaming / a controller | `playing_games`, `holding_controller`; a handheld console gets `handheld_game_console` |
| eating | `eating` (the food stays in the sentence; no object tag) |
| drinking / sipping | `drinking` (no cup tag, per the existing comment) |
| cooking / stirring | `cooking` |
| knitting | `knitting` |
| brushing her hair | `brushing_hair` |
| applying makeup / lipstick | `applying_makeup` |
| hugging / cuddling a plush, pillow | `hugging_object` |
| waving | `waving` |
| pointing | `pointing` |

- Use one matching row, the most specific first: a guitar row before generic "playing".
- Rows already in `photoPose` keep their own tags; only add what is missing.
- Texting or scrolling on her phone stays out of this table. A phone outside a selfie fights the phone negatives, so it only strikes placements, as in section 1.

## 3. Mirror selfies are left alone

One hand is on the phone, and `withoutHeldObject` already removes what the other holds. Don't add activity or instrument tags to a mirror selfie (except a free-hand gesture that already exists, like waving or pointing), and don't let these cues strike its phone hand.

## Tests

- The caption above → no `hands_on_lap`, and includes `holding_instrument` and `guitar`.
- "…strumming her guitar on the bed" → `playing_guitar`, `holding_instrument`, no placement tag.
- "…sitting at her desk typing on her laptop" → `typing`, `laptop`, no `hands_on_lap`.
- "…curled up on the sofa reading a book" → `reading`, `holding_book`, no placement tag.
- "…eating ramen at a counter" → `eating`, with no food tag added.
- "…sitting on the bench, playing with her hair" → the hair row's own tags, unchanged.
- "A mirror selfie in her room with her guitar behind her" → no instrument tags.

## Changelog

Extend the 1.7.0 "More than selfies" bullet with a short clause rather than adding a new bullet. For example: "…and her hands on whatever she's doing — a guitar, a book, a game."

## Checks

- `npm run typecheck` passes; the kit and photo tests pass, plus the new cases.
