# Strict Schema

A standalone, optional mod for writers that need explicit scene staging and JSON instructions.
Enable **Strict Schema** in the Mods screen. It defaults off and can be switched during an
existing playthrough; the next request uses the new setting. Requests already built, including
retries, retain their original rules.

The mod uses the existing scene, DM, and slot-intro request hooks. It adds no IPC channels,
settings fields, save fields, or edits to base-game files. It has no dependency on Photo Feature.

## Behavior

- Cast-scene lines require `speaker`, `bg`, `actions`, and `text`. Solo lines do not acquire an
  `actions` field when the base schema offers no actions.
- `bg` accepts the existing backgrounds, character rooms, and `unchanged`. The base sanitizer
  discards `unchanged`, retaining the current background; it currently logs an unknown-background
  warning for that sentinel. Real background IDs still pass through normal validation.
- Scene instructions explicitly require entrances, exits, expression changes, and a top-level
  ending signal on continuations. Opening and closing schemas keep their original contracts.
- DM instructions encourage short, grounded text bubbles. Feed instructions keep posts separate
  from the slot's other output.

The schema transformation copies the assembled request and changes only scene-line requirements
and the background enum. Existing fields, required fields, speaker/action vocabularies, and
request metadata are retained. Photo, memory, relationship, and narrative additions continue
through the existing hook chain.

## Scope

This first version ports prompt/schema guidance only. It does not port the weak-model branch's
response repairs, classifier quote validation or reasoning caps, invitation cooldown logic, or
DM timetable filtering. Those need additional integration points. Provider-native strict JSON
mode is unchanged: this mod strengthens the supplied schema and instructions, rather than
enabling an API's `strict: true` switch.

## Branches

The standalone branch is based on `venus-extracurriculars/build`'s `core`. Its own files can be
merged into the combined `main` build without replacing another mod's prompt builders.
