# After Hours — plan

Mod id `after-hours` · name **After Hours** · author Naudh1r · scope `anytime`
Built in the fork `naudh1r/venus-university` on the org's `main` (`venus-extracurriculars/build`): the core
hooks on `hooks/after-hours`, the mod on `mod/after-hours` above it (section 2). Nothing goes to the org. Hooks-only:
**zero** new lines in `test/kit/boundaryAllowlist.json`. **Base every brief on `venus-extracurriculars/build` `main` at b4ccf40c (kit 0.7.0) or newer**, not on the
fork's `main`, which lags. Fetch it first and re-check each line reference below against it. All line
references are to b4ccf40c.

---

## 1. What the player gets

### Busy status (option `busy-status`, default on)
- A status chip on the left header of the DM screen, above the chat list: **Online** / **Busy**. Always
  visible while the phone's Chats are open. Click to switch. It stays until the player switches it back, and a new semester starts
  Online again.
- **Busy** drops her "meet up right now" invite in a DM **only** when the reader sent the first text of
  that thread this slot, and he is not answering an invitation she has standing.
- Unchanged while Busy: invitations and reach-outs at slot changes, the Yes/No/Reschedule footer, his own
  asks (she knows he is Busy and may say so), plans for later (filed by the texting ledger). No cost.

### The night (option `night`, default on)
1. **Night (his room).** After every evening's boundary, before the morning opens, whether the evening
   was a scene or Relax. The night screen is the normal landing (date, money, stats, his room at night,
   the phone) with one authored line and **no activity rows**: the only row is **End the day**, which asks
   to confirm first (section 6). No map Go. Whether the text box stays is still open. The phone is open:
   DMs and Bunnyfeeds comments. The girls know it is late and everyone is in their dorms. No limit, no cost.
2. **Night visit (v2).** At night, any contact may invite him over, or he may ask her, to **her room or
   his**. Agreed → **Begin night visit** → a full normal scene in that room, with its own ledger,
   memories, rumors and colds. It ends when they fall asleep. At most one visit a night: once it ends,
   however it ends, the night is over.
   - **If it ends badly** (a fight, she throws him out, he storms off, she leaves, a curveball): no
     aftermath and no night screen again. The morning opens as normal in his room, and its narration
     tells what happened last night.
3. **Aftermath (v2).** Morning, in the room they slept in. Waking-up lines from the morning's opening call
   (no extra call). Phone open. Rows:
   - in her room: **Stay with {Name}** (only if she is free this slot) · **Head back to your room**
     (the only row when she has class, a shift, is sick or away)
   - in his room: she leaves for her day, one row: **Start the day**
4. **Head back** → one authored transition line → the **normal morning landing in his room**.
   **Stay with {Name}** → a normal morning scene with her in her room, which spends the morning; the
   morning narration is skipped, its texts, invitations and posts still arrive on the phone.

End the day, Head back and Start the day all lead into the same morning write the base game makes today.

---

## 2. Versions

| Version | Contents | Waits on core hooks |
| --- | --- | --- |
| **0.1.0** | Busy status | H4, H6 |
| **0.2.0** | The night (no visits: every "right now" verdict at night is dropped) | H1, H3 |
| **0.3.0** | Night visit, aftermath, Stay, Head back | H1 (scene rows, place), H2 |

Pre-release numbers: each is built and tested in the fork; 1.0.0 is for when the owner decides the mod
is ready. 0.1.0 needs the two smallest hooks.

### Branches (all in `naudh1r/venus-university`; nothing goes to the org until the owner decides)
- `hooks/after-hours`: the new core hooks, on the org's `main`, in core's own files and the kit's style,
  so they could be offered to core as they are.
- `mod/after-hours`: the mod, on top of `hooks/after-hours`. Hooks-only: zero new boundary entries.
- When the org's `main` moves: update `hooks/after-hours` first, then the mod on top.
- Order: hook group A (H4, H6) → 0.1.0 → group B (H1, H3) → 0.2.0 → group C (H2, H1's scene rows) → 0.3.0.
- Once the whole mod is done: package it as an installable mod too (`vxmod.json` listing every hook and
  kit API it uses, one bundled `renderer.js` with React, `motion` and the kit external), as its own brief.

---

## 3. Core hooks (built on `hooks/after-hours`)

Each says what, when, signature, and why the mod cannot do without it.

### H1 — `slotInterlude` (renderer, `first`)
**What:** before a slot opens, one mod may hold it and show an interlude: its own background, lines and
rows, with the phone open, then let the slot open normally or start a scene.

```ts
slotInterlude?: (ctx: {
  from: { date: number; time: TimeSlot }     // the slot that just ended
  to: { date: number; time: TimeSlot }       // the slot about to open (the clock already reads this)
  semesterIndex: number
  openingFields: Readonly<Record<string, unknown>>  // fields mods added to the banked opening reply
}) => Interlude | null

interface Interlude {
  look: { time: TimeSlot; background: string }   // e.g. his room at night; her room by day
  lines: string[]                                // authored or from openingFields; played as narration
  rows: Array<
    | { label: string; open: true }                                  // let the slot open as normal
    | { label: string; open: 'quiet' }                               // open it, opening's lines skipped
    | { label: string; scene: { cast: string[]; place: string; private: true; text: string } }
  >                                                                  // a normal scene of `to`, cast and placed
  clock?: 'late-night'                           // see H3
  onHangout?: (verdict: HangoutVerdict, ctx: HangoutCtx) => { place: string } | null  // see H2
}
```
- **When:** in `beginSlot` (`gameLoop.ts:368`), after the game-over branch and **before** the graduation
  branch (the night before graduation is a normal night), and after the orientation branch.
  Core claims or fetches the opening first (so `openingFields` is there), then holds. Spring break,
  Homecoming, friend requests, shifts, grades, bot messages, feed rolls, the overlay, the opening's lines
  and its deliveries all happen **after** a row is picked. Asked again on every entry of a slot save, so a
  reload lands back on the interlude.
- **While held:** the landing draws `look`, plays `lines`, offers only `rows` (no text box, no map Go, no
  Relax), and the phone works as on any landing. A manual save is allowed and loads back into the interlude.
- **Also:** kit reader `interludeNow(): { owner; from; to } | null`.
- **Why:** a mod cannot hold the slot opening, replace the landing's rows or draw the stage.

### H2 — Bonus scene (renderer)
**What:** a full scene that does not move the clock, started from an interlude.
- During an interlude, an agreed DM hangout asks the interlude's `onHangout` instead of arming a
  normal hangout. `null` drops it. `{ place }` arms **Begin {Name}** as today, and Begin starts a
  **bonus scene**: cast from the verdict, at `place`, private.
- A bonus scene plays and ends like any scene: ledger, texting ledger, closing, status lines, memory
  question, rumor/crush/cold passes. Its boundary applies everything but **does not call `advanceSlot`**.
  It **re-fetches the next opening**, because the banked one predates the night. Then it writes the
  boundary save and enters `beginSlot` again, where the interlude hook is asked anew (the mod answers the
  aftermath, or nothing after a visit that ended badly, so the morning opens as normal).
- A reload in the middle of a bonus scene resumes that scene, as for any scene.
- `slotSettled`, `slotStatusLines` and `projectSlotMemories` get `bonus: true` in their context, so mods
  that count once per slot (Venus Whisper, Bunnyfeeds, Meanwhile) can tell it apart.
- No replay is kept for it.
- **Why:** the ending and the boundary are core's. A mod cannot run a ledger, file memories or skip the
  clock.

### H3 — The late-night clock for texting (renderer)
**What:** while an interlude with `clock: 'late-night'` holds:
- the DM prompt's NOW block (`prompts/textingPrompt.ts:502-508`) says it is late on the `from` night,
  drops "classes are starting soon", and replaces her whereabouts line with her being in her dorm room
  (a graduate: at home)
- the composer's busy gate (`charBusyNow`, `views/BunnyboardModal.tsx:1003`) stays open
- the hangout classifier is told it is late night

Messages are still stamped with `to`, so the morning's texting ledger files them.
- **Why:** `prompts.dm` can only add lines, so the contradictory "morning" lines would stay. The busy
  gate is core's.

### H4 — `hangoutVerdict` (renderer, `pipeline`)
```ts
hangoutVerdict?: (
  verdict: { initiatedBy: 'player' | 'contact'; description: string } | null,
  ctx: { charId: string; startedBy: 'reader' | 'her'; answeringInvite: boolean }
) => typeof verdict
```
- **When:** after the classifier answers and before `handleHangout` (`stores/textingLoop.ts:724`), and on
  Text Regeneration's re-run (`:841`). Not asked during an interlude that has `onHangout`.
- `startedBy`: who sent the first text of this slot's thread. A reach-out or an invitation counts as her.
- `answeringInvite`: the exchange answers an invitation still standing.
- **Why:** the classifier and arming are inside core, and `afterDmReply` runs before the classifier.

### H5 — no longer needed
Kit 0.7.0 has `freeForInvitation(id)` and `startInvitedScene(modId, id, action, initialize, eligible)`.
`freeForInvitation` reads the current slot, which during the aftermath is already the morning, so it
answers "is she free this morning". The 0.3.0 brief checks whether `startInvitedScene` can place the scene
in her room; if it cannot, **Stay with {Name}** uses H1's `scene` row instead.

### H6 — `chatsHeader` (renderer, `slot`)
Draws a component in the DM screen's left header, above the chat list. Props: `theme`.
- **Why:** no screen slot exists there.

---

## 4. Mod files

| File | What |
| --- | --- |
| `src/shared/modEntries/after-hours.ts` | The entry: id, name, version, two options |
| `src/renderer/modEntries/after-hours.ts` | `registerHooks('after-hours', …)` |
| `src/shared/afterHours.ts` | Pure rules: `nightOwed`, `busyDrops`, the save shape, `normalize`, `carry` |
| `src/renderer/mods/afterHours.tsx` | The field, the hooks, the status chip, the interlude specs |
| `src/shared/afterHoursText.ts` | Every authored line and label (shared: the entry reads its labels) |
| `src/renderer/vu_styles/AfterHours.css` | The chip's look |
| `docs/mods/after-hours.md` | The mod's guide |
| `test/kit/modFiles.ts` | One entry: `'after-hours': { globs: ['src/shared/afterHours*.ts', 'src/renderer/mods/afterHours*', 'src/renderer/vu_styles/AfterHours.css'] }` |
| `test/afterHours.test.ts` | The tests (section 7) |

Every import is `@vx/modkit/*`, React or the mod's own files.

### Kit APIs used
`registerHooks`, `saveField`, `useModOption`/`optionOn`, `modIsOn`, `prompts.dm`, `prompts['text-ledger']`,
`requests.ledger` (v2: did they spend the night, and where), `requests['slot-intro']` (v2: the aftermath
lines field, or the line saying the visit ended badly), `slotSettled` (records an evening night act),
`currentRun`/`runStale`, `lessNsfwText`, `freeForInvitation`, `startInvitedScene`, plus H1–H4 and H6.

### Save data (`saveField('after-hours')`)
```ts
{ busy: boolean
  nightDone?: number      // global slot of the morning whose night was ended
  eveningNight?: number   // global slot of an evening whose ledger reported a night together
  visit?: { charId: string; place: 'hers' | 'his'; morning: number; stayed?: boolean } }  // v2
```
- `carry`: returns undefined, so the next semester starts empty: Online, nothing owed.
- `set()` before a row is released, so the write the morning already makes carries it.

---

## 5. Rules

- **`nightOwed(to, from, data, flags)`** (pure): true when `to.time === 0`, `from` is the evening before
  it, `data.nightDone !== globalSlot(to)`, `data.eveningNight !== globalSlot(from)`, `to` is not the
  semester's first slot or the tutorial slot, and the `night` option is on. The night before graduation
  morning is a normal night, visits included.
- **Graduation morning after a visit:** the aftermath offers only **Head back to your room** (there is no
  normal morning to stay through); its transition line leads into the ceremony as the game plays it today.
- **Evening that already ended in a night together:** no night interlude (he is not in his room).
  `eveningNight` is set at `slotSettled` from the ledger's acts.
- **`busyDrops(verdict, ctx, busy)`** (pure): `busy && verdict?.initiatedBy === 'contact' &&
  ctx.startedBy === 'reader' && !ctx.answeringInvite`.
- **Night `onHangout` (v2):** keeps a verdict when her reply's mod field `nightVisit` (added through
  `prompts.dm`) is `'hers'` or `'his'`. 0.2.0 has no `onHangout`, so every verdict at night is dropped.
- **Busy at night:** her new asks are dropped the same way. His asks still arm a visit.
- **Aftermath:** `visit` set when Begin night visit is pressed. At the visit's `slotSettled`
  (`bonus: true`) the mod reads its ledger field `stayedOver` into `visit.stayed` and sets `nightDone`.
  The next interlude shows the aftermath only when `visit.stayed`; cleared when a row is picked.
- **A visit that ended badly:** `visit.stayed` false. No interlude; the morning opening's request gets one
  line through `requests['slot-intro']`: the reader's visit to {Name}'s room (or hers to his) last night
  ended badly and he spent the night in his own room; open on him waking up there after it.

---

## 6. User-facing text (drafts; final wording in each brief)

Measured against the game's own: Relax's row reads "Relax (Skip to tomorrow)"; its line, "You stay in
and take it easy, doing nothing in particular. Before you know it, it's time for bed."

- **End the day row:** `End the day (Skip to tomorrow)`. Matches Relax's row.
- **Night line** (pick one):
  1. "You're back in your room for the night. The dorm goes quiet around you."
  2. "You head back to your room for the night. The hall outside is quiet now."
  3. "It's late, and you're back in your room for the night."
  → **2** reads closest to the relax line: second person, plain, one beat.
- **Head back** (B: a small pool, one drawn each time):
  - he chose: "You say goodbye to {Name} and head back to your room to shower and change." /
    "You slip out of {Name}'s room and go back to your own to get cleaned up before the day starts."
  - she has class or work: "{Name} has to get to class, so you head back to your room to shower and
    change." / "{Name} has to get to work, so you head back to your room to shower and change."
- **His room, she leaves:** "{Name} heads off to start her day."
- **Rows:** `Stay with {Name}` · `Head back to your room` · `Start the day`
- **End the day confirmation** (`ConfirmModal` from the kit; worded like the game's "Quit your job?"):
  title "End the day?", message "You'll go to sleep and wake up tomorrow morning.", confirm "Sleep",
  cancel "Never mind"
- **Status chip:** `Online` / `Busy`, hover hint: "Busy: girls won't ask you to meet up in chats you start."
- **Prompt lines** (`prompts.dm`):
  - Busy: "The reader has set his Bunnyboard status to Busy: he would rather stay in his room for now.
    {Name} can see it, so she does not ask him to meet up right now. Making plans for another time is
    fine. If he asks to meet up right now anyway, she can react to that the way she would, such as
    pointing out that he said he was busy."
  - Night: "It is late at night, and students are expected to be in their own dorms. Both are in their
    rooms. Neither of them can go anywhere else tonight except one of their two rooms."
    (0.2.0: "…and neither of them can go anywhere tonight.")

---

## 7. Tests (one file, `test/afterHours.test.ts`)

- `nightOwed`: owed after an evening; not owed when already ended, after a night together, on the
  semester's first morning, on graduation morning, or with the option off.
- `busyDrops`: drops only her new ask in a chat he started; keeps his asks, an answer to a standing
  invitation, and chats she started.
- The save field: `normalize` keeps the shape of an older slice; `carry` starts the next semester empty.

Nothing for prompt wording, labels or the chip. Everything else is checked by hand (section 9).

---

## 8. Codex briefs (written in full once each hook set lands, against its real signatures)

1. **0.1.0 Busy:** the entry, the field, the chip on `chatsHeader`, `hangoutVerdict` with `busyDrops`,
   the Busy prompt line, the tests for `busyDrops` and the field, the docs page, the `modFiles.ts` entry.
2. **0.2.0 Night:** `slotInterlude` with the night spec and `clock: 'late-night'`, `nightOwed`, the
   `slotSettled` night-act record, the night prompt line and a texting-ledger line ("these texts were
   sent late at night from the dorms"), the tests for `nightOwed`, docs.
3. **0.3.0 Visit:** the `nightVisit` DM field, `onHangout`, the aftermath field on `requests['slot-intro']`,
   the aftermath interlude and its rows, the Head back pool, docs.

Each brief ends with: `npm run typecheck`, `npm test`, zero new allowlist lines, one commit as
`Naudh1r <102735014+naudh1r@users.noreply.github.com>` with no co-author lines.

---

## 9. Checks by hand

- A night after an evening scene, after Relax, after a night together (no night), before graduation (none).
- Reload a slot save mid-night: back in the night. A manual save mid-night: back in the night with its texts.
- Text at night: no "morning classes", girls with a morning class reply; texts filed by the morning's ledger.
- Busy: her ask in a chat he started is dropped; her reach-out turning into an ask still shows the footer.
- With Bunnyfeeds, Photo Feature, Venus Whisper and Mini-games on, and alone.
- v2: a visit to her room and to his; Stay when she is free; forced Head back when she has class; reload
  during the visit and during the aftermath; the morning after Stay skips its narration but delivers texts.

---

## 10. Follow-ups outside this mod

- **Bunnyfeeds (the owner's mod; a compatibility patch later, separate from this mod):** answers to a
  comment made at night are stamped "for the next slot", so they would show in the evening. The patch has
  Bunnyfeeds read `interludeNow()` and stamp them for `to`. After Hours itself does not touch Bunnyfeeds.
- **Night posts (settled):** no round of their own. Posts arrive with whatever slot is current, as
  they do today: the morning's posts come with the morning's opening, after the night or the aftermath
  ends. No hook is needed for them.
