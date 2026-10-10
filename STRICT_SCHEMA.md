# Strict Schema

A standalone, optional mod for writers that need explicit scene staging and JSON instructions.
Enable **Strict Schema** in the Mods screen. It defaults off and can be switched during an
existing playthrough; the next request uses the new setting. Requests already built, including
retries, retain their original rules.

The mod uses scene, DM, ledger, slot-intro, and hangout-classifier request hooks, plus generic
scene and invitation result hooks. It adds no IPC channels or settings fields. An optional
`declinedAt` timestamp in each saved conversation anchors explicit refusal cooldowns; older saves
remain readable without it.
It has no dependency on Photo Feature.

## Behavior

- Cast-scene lines require `speaker`, `bg`, `actions`, and `text`. Solo lines do not acquire an
  `actions` field when the base schema offers no actions.
- `bg` accepts the existing backgrounds, character rooms, and `unchanged`. The base sanitizer
  discards `unchanged`, retaining the current background; it currently logs an unknown-background
  warning for that sentinel. Real background IDs still pass through normal validation.
- Scene instructions explicitly require entrances, exits, and expression changes. Continuation
  replies require a top-level `end_scene` boolean. Opening and closing schemas keep their
  original contracts.
- If validated show/hide actions leave the stage empty after a character departs, the mod
  supplies a missing or false ending decision. It does not infer departures from prose, end
  empty solo scenes, or end a scene where someone remains present at the end of the departure line.
  Enabled result handlers and the starting stage are captured before streaming begins.
- Streaming and final output stop after the line where the final character departs. A continuation
  of an already empty cast scene is ended without adding new events. If lines are omitted, the
  model's recap is discarded; the closing call summarizes only the delivered transcript.
- The scene writer is told to keep new DMs in the phone flow, and not to invent messages or
  accept future plans for the reader. Established texting history remains available as context.
  These content instructions guide the model; the departure boundary is enforced in code.
- Ordinary DMs aim for 1–3 bubbles, around 10–25 words each and at most 60 words total. Longer
  explanations are allowed when requested or needed. These are generation instructions, not
  post-delivery truncation. Photo and other mod fields remain intact. Feed instructions keep
  posts separate from the slot's other output.
- The hangout classifier distinguishes accepted, declined, deferred, new offers, and unrelated
  exchanges. Accepted plans need the entire latest player message and one complete latest reply
  bubble as exact evidence. New offers need a latest reply bubble. Invalid or missing evidence
  never arms a scene. Obvious short refusals and deferrals override contradictory classifier output.
- Clicking No writes a refusal into the thread, clears the invitation, and starts the existing
  increasing decline cooldown (4 slots initially, doubling up to 28). Text refusals and deferrals
  also start it. DM guidance discourages repeated asking; game rules block renewed DM invitations
  and unsolicited slot invitations during the cooldown. Already agreed calendar reminders remain.
  The model may still misread nuanced intent or write an unwanted invitation in its text; the
  game does not erase delivered messages.
- A new player-initiated agreement can bypass the invitation cooldown and clears the decline
  state when the hangout is armed. Unrelated messages do not reset it, and old refusals cannot
  override a new agreement. With the mod disabled, button and classifier behavior remain native.
- The scene ledger uses the player's original thinking/reasoning setting instead of forcing high.
  The base provider resolver reads the current settings at call time and handles supported levels;
  the mod stores no separate thinking setting. With the mod off, the base ledger's high floor remains.
- Scene-ledger memory descriptions contain only the past-tense event clause completing
  "Name liked/disliked/hated that ...". Instructions prohibit duplicated names and "remembers that"
  introductions, keep descriptions concise, and require the reaction type to be supported by the
  transcript. These instructions guide new output; existing saved memories are not rewritten.

The schema transformation copies the assembled request and changes only scene-line requirements
and the background enum, plus the continuation's ending requirement. Existing fields, required
fields, speaker/action vocabularies, and request metadata are retained, except for the ledger's
minimum thinking override. Photo, memory,
relationship, and narrative additions continue
through the existing hook chain.

## Scope

This version ports prompt/schema guidance and a scene-departure boundary. It does not port the
weak-model branch's other response repairs, scene-action classifier quote validation or reasoning caps,
or DM timetable filtering. The hangout classifier uses the player's thinking setting and validates
current-exchange evidence through its own hooks. Provider-native strict JSON
mode is unchanged: this mod strengthens the supplied schema and instructions, rather than
enabling an API's `strict: true` switch.

## Branches

The standalone branch is based on `venus-extracurriculars/build`'s `core`. Its own files can be
merged into the combined `main` build without replacing another mod's prompt builders.
