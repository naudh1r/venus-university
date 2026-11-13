# After Hours

## 0.6.3

By **Naudh1r**.

A Busy status for Bunnyboard, and a night in your room after the evening to text before you sleep.

## Playing

### Busy status

- **After Hours** and its **Busy status** option are on by default in Mods.
- Open Bunnyboard's **Chats** tab. Beside **Chats** stands your own card: your picture (or
  your initial), your name, and a dot with **Online** or **Busy**. Click it to switch.
- While Busy, a chat you start this slot won't turn into a meet-up right now, whether she
  asks or you do, even if you are answering an earlier invitation of hers. Her text may agree,
  but it opens no Yes/No footer and arms no hangout. Switch to **Online** to meet up now.
- Chats she starts this slot — her reach-outs and slot-change invitations — work as before,
  including the Yes/No footer.
- She is not told you are Busy, so she doesn't make a topic of it. Plans for another time
  still work normally.
- Chats you start while Busy answer faster: there is no hangout check.
- The status lasts until you switch it, and is kept with your save. A new semester
  starts **Online**.
- Switching the mod or its option off hides the chip and lets girls ask you out again.
  Your saved status stays, ready for when you switch it back on.
- Changing status costs nothing and makes no extra model call.

### Texting while she's busy

- **Text her when she's busy** is on by default. Her DM box stays open during class or work,
  and reads that she will reply when she is available.
- Send her a message now; her reply arrives in the next half of the day, as she would send it
  once she is out. She can mention class or work without having to make a topic of it.
- Send again before it arrives and one replacement reply catches up on both messages.
- A late reply never starts an immediate hangout. Plans for another time still work normally.
- With Photo Feature on, she may include a photo under its own rules. It arrives with her reply.
- Text her during an evening class and the reply arrives on the night screen, after class.
- Switch the option off to close her DM box during class and work as usual.

### The night

- **The night** option is on by default. After the evening, the curtain announces **Night**
  on the same day, and you return to your room before the morning opens.
- On the evening landing, **Relax (Skip to bedtime)** spends the evening relaxing and opens
  the night. **Skip to tomorrow**, just below it, relaxes the same way and opens the morning
  directly.
- The night landing's header reads **Night**, with the quiet room line and one card row:
  **Go to sleep**. There is no text box,
  activity choice or map travel. The phone stays available for texts and Bunnyboard comments.
- Each contact is in her own room; her chat names her dorm. Nobody goes anywhere tonight,
  and a DM cannot begin a hangout. Plans for another time still work normally.
- **Go to sleep** ends the night the way Relax ends a slot: the night's texts are counted and
  their results shown, then the new-day curtain and the morning's narration, texts, posts and
  landing. The narration is written after the night, so it can follow up on what was said, and a
  plan made at night for the morning is on its landing. There is no confirmation.
- A reply held until a night you skip arrives on the morning landing instead.
- A save taken at night loads back into the night. The night's texts are marked **late night**
  and counted once, when you go to sleep, never again with the morning's.
- The night before graduation comes too; **Go to sleep** opens the ceremony.
- Turn **The night** off to keep the evening's own Relax, with no extra row or new night.
  A night already on screen stays until you sleep.

### Staying over

- An evening scene in her room or yours can end with you spending the night together, if
  both of you want it. It is an option, never a goal.
- The evening ends normally, with its one ledger and memory question. There is no extra
  scene and no night landing afterward.
- The new-day curtain opens on the morning where you woke together. Its narration tells
  how you part and get back into your own morning, in whatever way fits what happened.
  The game's summary and rumour follow, then the normal landing.

## Where the code is

| File | What it does |
| --- | --- |
| `src/shared/modEntries/after-hours.ts` | Registers the mod and its option |
| `src/shared/afterHours.ts` | Defines the saved status, completed-night marker and pure invitation/stay-over rules |
| `src/renderer/modEntries/after-hours.ts` | Loads the renderer hooks |
| `src/renderer/mods/afterHours.tsx` | Keeps the save field, draws the chip and registers the night, invitation, prompt and Relax hooks |
| `src/shared/afterHoursText.ts` | Holds the labels, catalogue copy and prompt lines |
| `src/renderer/vu_styles/AfterHours.css` | Dresses the chip and its hover hint |
| `test/afterHours.test.ts` | Checks invitation and stay-over decisions, nights owed and saved-data normalization |
