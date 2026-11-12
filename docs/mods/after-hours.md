# After Hours

## 0.5.2

By **Naudh1r**.

A Busy status for Bunnyboard, and a night in your room after the evening to text before you sleep.

## Playing

### Busy status

- **After Hours** and its **Busy status** option are on by default in Mods.
- Open Bunnyboard's **Chats** tab. Beside **Chats** stands your own card: your picture (or
  your initial), your name, and a dot with **Online** or **Busy**. Click it to switch.
- While Busy, a girl won't ask you to meet up right now in a chat you started this slot.
  If the model still writes an invitation, it opens no Yes/No footer and arms no hangout.
- Her invitations and reach-outs at slot changes still work normally, including the
  Yes/No footer. Answering an invitation she already had standing is unchanged.
- You can still ask her to meet up yourself. She is not told you are Busy, only to leave
  the asking to you, so she doesn't make a topic of it. Plans for another time work as before.
- The status lasts until you switch it, and is kept with your save. A new semester
  starts **Online**.
- Switching the mod or its option off hides the chip and lets girls ask you out again.
  Your saved status stays, ready for when you switch it back on.
- Changing status costs nothing and makes no extra model call.

### Texting while she's busy

- **Text her when she's busy** is on by default. Her DM box stays open during class or work.
- Send her a message now; her reply arrives in the next half of the day, as she would send it
  once she is out. She can mention class or work without having to make a topic of it.
- Send again before it arrives and one replacement reply catches up on both messages.
- A late reply never starts an immediate hangout. Plans for another time still work normally.
- With Photo Feature on, she may include a photo under its own rules. It arrives with her reply.
- Text her during an evening class and the reply arrives on the night screen, after class.
- Switch the option off to close her DM box during class and work as usual.

### The night

- **The night** option is on by default. After every evening, whether you played a scene
  or chose Relax, you return to your room before the morning opens. The curtain between them
  announces the night, not the morning.
- The landing stays at night, with one line and one row: **End the day (Skip to tomorrow)**.
  There are no other activity rows, text box or map travel.
- The phone stays available for texts and Bunnyfeeds comments. Stay up as long as you like;
  there is no limit or cost.
- The girls know it is late and everyone is in their own dorm room. You can agree to visit
  each other's rooms. Plans for another time still work normally.
- **End the day** asks **End the day?** Choose **Sleep** to open the morning with its
  usual narration, texts and posts, or **Never mind** to stay up.
- Evening Relax reads **Relax (Skip to bedtime)** while the option is on.
- A save taken during the night loads back into it. The night's texts are marked **late night**
  on the phone and are kept with the morning's texts.
- The night before graduation comes too; ending it opens the ceremony.
- Turn **The night** off to skip new nights and keep Relax's usual words. A night already
  on screen stays until you end the day.

### Night visits

Other mods that record each slot (Story Memory, Campus Talents and the like) do not see the night visit or the morning-after scene as a slot of their own.

- At night, either of you can ask to meet in her room or yours. Once you agree, press
  **Begin hangout** to start the visit, or end the day without going.
- There is one visit per night. It ends when you fall asleep together, or earlier if it goes badly.
- After sleeping together, the morning opens on a scene in the room where you woke up. She
  brings up her plans for the morning, and it ends when one of you has to go or you settle
  into the morning together. The phone is closed as in any scene. This scene leaves memories
  but pays no stats or money.
- Afterward, if you are in her room and she is free, the phone opens with two rows:
  **Stay with {Name}** for a normal morning scene, or **Head back to your room**.
  Staying spends the morning with her and skips its opening narration; its texts,
  invitations and posts still arrive.
- If she is not free, or you slept in your room, the usual morning opens directly after the scene.
- Heading back or being sent back uses the morning's own narration to tell how you part and
  get into the day, in whatever way fits what happened. There is no fixed transition line.
- Graduation morning goes from the scene straight to the ceremony, with no rows.
- A visit that ends badly goes straight to the usual morning, whose narration follows what happened.
- Busy still drops her new asks in chats you started; your own asks can begin a visit.
- Saves resume a visit or morning-after scene in progress, or return you to the choices afterward.

## Where the code is

| File | What it does |
| --- | --- |
| `src/shared/modEntries/after-hours.ts` | Registers the mod and its option |
| `src/shared/afterHours.ts` | Defines the saved status, visits, completed-night marker and pure invitation/morning rules |
| `src/renderer/modEntries/after-hours.ts` | Loads the renderer hooks |
| `src/renderer/mods/afterHours.tsx` | Keeps the save field, draws the chip and registers the night, invitation, prompt and Relax hooks |
| `src/shared/afterHoursText.ts` | Holds the labels, confirmation, catalogue copy and DM prompt lines |
| `src/renderer/vu_styles/AfterHours.css` | Dresses the chip and its hover hint |
| `test/afterHours.test.ts` | Checks invitation and morning decisions, nights owed and saved-data normalization |
