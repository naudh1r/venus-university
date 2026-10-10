# Strict Schema

A standalone, optional mod for writers that need explicit scene staging and JSON instructions.
Enable **Strict Schema** in the Mods screen. It defaults off and can be switched during an
existing playthrough; the next request uses the new setting. Requests already built, including
retries, retain their original rules.

The mod uses scene, DM, scene/texting ledger, quiz, slot-intro, and hangout-classifier request hooks, plus generic
scene and invitation result hooks. It adds no IPC channels or settings fields. An optional
`declinedAt` timestamp in each saved conversation anchors explicit refusal cooldowns; older saves
remain readable without it.
It has no dependency on Photo Feature.

Each call receives one concise set of mod instructions for its role. Shared dialogue guidance is
defined once and reused by scene and DM requests. Other mods' additions stay intact.
With **Strict Schema and Photo Feature both enabled**, DMs replace the base writing persona and
turn/output instructions with concise Strict Schema instructions. Character details, memories,
game state, summaries, recent messages, photo history, and other mods' additions remain available.
Photo Feature retains its original permission, tier, picture-brief, and caption rules and required
fields; Strict Schema adds explicit photo-field formatting. Turning either mod off restores the
normal base DM instructions. Scene narration continues using its existing prompt path.

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
- Slot-opening feed schemas constrain post keys to the selected posters and the array length
  to their count, requiring `posts` when anyone was selected. Instructions ask for one per key;
  equal counts and allowed keys do not themselves enforce one occurrence of each key.
  With Photo Feature enabled, comment arrays are capped at five (or an existing tighter limit).
  Concise photo-field guidance and an illustrative post clarify that `image` is only a visual
  description; the engine supplies character appearance and renders the picture. Original photo
  permissions, instructions, and extension fields remain intact. These constraints guide the
  provider and model; custom endpoints still receive `strict: false`.
- Scene and DM dialogue follows the reader's current subject, avoiding paraphrased repetition of
  old grievances, apologies, questions, or reassurance. Memories may shape her tone without
  becoming recurring talking points. Active discussions can continue; topic changes are not
  forced. DMs do not reannounce unchanged whereabouts already given. These are model instructions,
  not a filter that deletes delivered dialogue.
- The hangout classifier distinguishes accepted, declined, deferred, new offers, and unrelated
  exchanges. Accepted plans need the entire latest player message and one complete latest reply
  bubble as exact evidence. New offers need a latest reply bubble. Invalid or missing evidence
  never arms a scene. Obvious short refusals and deferrals override contradictory classifier output.
- The texting loop starts hangout classification as soon as the complete DM reply arrives,
  overlapping the remaining bubble typing animation. A streamed first bubble alone is insufficient:
  later bubbles may accept or refuse. Result hooks, hangout state changes, and classifier failure
  dialogs wait until the final bubble lands. Abandoned turns discard their verdict, and retries
  reuse the same request. This scheduling improvement also applies with Strict Schema disabled;
  the mod's evidence rules and the player's thinking setting are unchanged.
- Clicking No writes a refusal into the thread, clears the invitation, and starts the existing
  increasing decline cooldown (4 slots initially, doubling up to 28). Text refusals and deferrals
  also start it. DM guidance discourages repeated asking; game rules block renewed DM invitations
  and unsolicited slot invitations during the cooldown. Already agreed calendar reminders remain.
  The model may still misread nuanced intent or write an unwanted invitation in its text; the
  game does not erase delivered messages.
- A new player-initiated agreement can bypass the invitation cooldown and clears the decline
  state when the hangout is armed. Unrelated messages do not reset it, and old refusals cannot
  override a new agreement. With the mod disabled, button and classifier behavior remain native.
- Both scene and texting ledgers use the player's original thinking/reasoning setting instead of forcing high.
  The base provider resolver reads the current settings at call time and handles supported levels;
  the mod stores no separate thinking setting. With the mod off, the base ledger's high floor remains.
- Scene-ledger memory descriptions contain only the past-tense event clause completing
  "Name liked/disliked/hated that ...". Instructions prohibit duplicated names and "remembers that"
  introductions, keep descriptions concise, and require the reaction type to be supported by the
  transcript. These instructions guide new output; existing saved memories are not rewritten.
- Both ledgers are instructed to log only agreed in-person activities at an established physical
  location and a specific future day/night slot. Texts, calls, video calls, online chats, and photo
  promises are excluded. Titles describe the reader's action, distinguishing hosting guests in
  his room from visiting another person's room; descriptions preserve who travels, who hosts,
  all attendees, destination, and time. The planner must not invent a location or agreement.
  Scene instructions preserve those roles and keep a reader already at home there to receive
  guests. Classes and shifts may precede or follow an agreed meeting, matching the existing
  commitment notes. These are generation rules, not semantic validation or rewriting of saved
  plans; malformed existing titles remain unchanged.
- Exam requests require exactly one question per selected lecture fact, nonempty question/option
  strings, and the existing A–D answer-key enum. Guidance asks for distinct options, exactly one
  fact-supported answer, and no unsupported claims. A captured result hook rejects the entire
  paper if its count is wrong, a field is blank or has the wrong type, the answer key is invalid,
  answer options repeat after case/whitespace normalization, or questions repeat. Failure opens
  the existing retry flow before quiz state or grades are saved; no guessed answer or shortened
  paper is substituted. The game still shuffles options and calculates grades normally.
  Factual correctness and semantically overlapping answers remain the model's responsibility;
  these checks validate structure and obvious duplicates, not subject-matter truth. Existing saved
  quizzes are unchanged, and disabling the mod restores native question normalization.

Schema transformations copy the assembled request to strengthen scene staging, feed poster/count
constraints, photo comment limits, and quiz count/nonempty-field requirements. Existing fields, required
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
