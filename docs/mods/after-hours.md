# After Hours

## 0.3.0

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

### The night

- **The night** option is on by default. After every evening, whether you played a scene
  or chose Relax, you return to your room before the morning opens.
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

- At night, either of you can ask to meet in her room or yours. Once you agree, press
  **Begin hangout** to start the visit, or end the day without going.
- There is one visit per night. It ends when you fall asleep together, or earlier if it goes badly.
- After sleeping in her room, wake up there with the phone available. Choose **Stay with {Name}**
  when she is free for a normal morning scene, or **Head back to your room** to open the usual morning.
  Staying skips the morning's narration; its texts, invitations and posts still arrive.
- When she has class, work or another reason she cannot stay, only **Head back to your room** appears.
- After sleeping in your room, **Start the day** lets her leave and opens the usual morning.
- Graduation morning offers only **Head back to your room**, then the ceremony.
- A visit that ends badly goes straight to the usual morning, whose narration follows what happened.
- Busy still drops her new asks in chats you started; your own asks can begin a visit.
- Saves resume a visit in progress or return you to the aftermath after sleeping together.

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
