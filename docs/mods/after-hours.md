# After Hours

By **naudh1r**.

A Busy status for Bunnyboard, and a night in your room after the evening to text before you sleep.

## Playing

### Busy status

- **After Hours** and its **Busy status** option are on by default in Mods.
- Open Bunnyboard's **Chats** tab. Beside **Chats** stands your own card: your picture (or
  your initial), your name, and a dot with **Online** or **Busy**. Click it to switch.
- While Busy, a chat you start this slot won't turn into a meet-up right now, whether they
  ask or you do, even if you are answering an earlier invitation of theirs. Their text may agree,
  but it opens no Yes/No footer and arms no hangout. Switch to **Online** to meet up now.
- Chats they start this slot — their reach-outs and slot-change invitations — work as before,
  including the Yes/No footer.
- They are not told you are Busy, so they don't make a topic of it. Plans for another time
  still work normally.
- Chats you start while Busy answer faster: there is no hangout check.
- The status lasts until you switch it, and is kept with your save. A new semester
  starts **Online**.
- Switching the mod or its option off hides the chip and lets people ask you out again.
  Your saved status stays, ready for when you switch it back on.
- Changing status costs nothing and makes no extra model call.

### Meeting up from Chats

- When someone agrees to meet up now after you ask, you get **Yes** and **No**. **Yes** opens
  **Begin hangout**. **No** brings the text box back without sending anything.
- If you leave your own offer unanswered, or say **No** and leave it there, the contact remembers
  that you changed your mind. Text again that slot and the conversation speaks for itself. If the
  contact ends up in your scene that slot, there is no extra memory.
- If you have class, an assessment or a shift, **Yes** in Chats warns you about what you would miss.
  **Cancel** leaves the offer open. **Meet anyway** accepts it. Plans started from the landing
  still go straight ahead.
- After a meet-up arranged in Chats, the thread notes who you met and where. A plan started from
  the landing by answering its reminder gets the same note.

### Texting while they're busy

- **Text people when they're busy** is on by default. Their DM box stays open during class or work,
  and reads that they will reply when they are available.
- Send them a message now; their reply arrives in the next half of the day, as they would send it
  once they are out. They can mention class or work without having to make a topic of it.
- Send again before it arrives and one replacement reply catches up on both messages.
- A grey tick means your text was sent. It turns into two blue ticks when the reply appears.
- A late reply never starts an immediate hangout. Plans for another time still work normally.
- With Photo Feature on, they may include a photo under its own rules. It arrives with their reply.
- Text someone during an evening class and the reply arrives on the night screen, after class.
- If their next class is one you take too, they answer after that class instead, once, knowing
  whether you were there. All your texts until then wait for that one reply.
- Someone whose reply arrives at a landing sends nothing else there: no reach-out and no
  invitation from them at the same time.
- Switch the option off to close their DM box during class and work as usual.

### The night

- **The night** option is on by default. After the evening, the curtain announces **Night**
  on the same day, and you return to your room before the morning opens.
- On the evening landing, **Relax (Skip to bedtime)** spends the evening relaxing (its line
  ends with the evening gone, not with bedtime) and opens the night. **Skip to tomorrow**, just below it, relaxes the same way and opens the morning
  directly.
- The night landing's header reads **Night**, with a quiet line about your room, picked for that
  night from a handful, and one card row:
  **Go to sleep**. There is no text box,
  activity choice or map travel. The phone stays available for texts and Bunnyboard comments.
- Each contact is in their own room; their chat names their dorm. Nobody goes anywhere tonight,
  and a DM cannot begin a hangout. Plans for another time still work normally.
- **Go to sleep** plays a line of you falling asleep, picked for that night from a handful, as
  Relax plays its own, then ends the night the way Relax ends a slot: the night's texts are counted and
  their results shown, then the new-day curtain and the morning's narration, texts, posts and
  landing. The narration is written after the night, so it can follow up on what was said, and a
  plan made at night for the morning is on its landing. There is no confirmation.
- A reply held until a night you skip arrives on the morning landing instead.
- A save taken at night loads back into the night. The night's texts are marked **late night**
  and counted once, when you go to sleep, never again with the morning's.
- The evening before graduation has no night, and nobody stays over. Its **Relax** is the game's
  own, and the ceremony comes next.
- Turn **The night** off to keep the evening's own Relax, with no extra row or new night.
  A night already on screen stays until you sleep.

### Staying over

- An evening scene in their room or yours can end with you spending the night together, if
  both of you want it. It is an option, never a goal.
- The evening ends normally, with its one ledger and memory question. There is no extra
  scene and no night landing afterward.
- The new-day curtain opens on the morning where you woke together, staged there: their room (or
  yours) with them on stage, a short line of waking up, three or four lines of them talking to you as
  their own lines with their expression, then the line where you part, where the stage turns to your room without them. The
  usual morning lines follow, then the normal landing. The night itself is not summed up again.
- Their parting words are part of the morning's narration, not a scene: nothing more is counted for
  them, and the landing after is the ordinary one.

## 0.7.4

- Your texts show a sent tick, then two blue ticks when the reply appears.

## 0.7.3

- When someone agrees to meet up after you ask, you get a choice before the hangout opens.
- The phone warns you before a meet-up would cost you a class, assessment or shift.
- The thread keeps a short note of when you met, so later messages can place the meeting.

## 0.7.2

- The evening before graduation has no night: the ceremony follows it, as in the game itself.

## 0.7.1

- The night landing opens on one of a handful of lines, picked for that night.

## 0.7.0

- Boys work the same as girls: texting while they're busy, staying over and the morning goodbye.
- The night and the morning after follow the pronouns you chose for yourself.

## 0.6.7

- Going to sleep plays one of a handful of lines, picked for that night.
- The morning after a night together, she says three or four lines before you part.

## 0.6.6

- A Busy status for Bunnyboard, and a night in your room after the evening to text before you sleep.

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
