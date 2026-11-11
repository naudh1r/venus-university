# After Hours

## 0.1.0

By **Naudh1r**.

A Busy status for Bunnyboard, so girls don't ask you out in chats you start.

## Playing

- **After Hours** and its **Busy status** option are on by default in Mods.
- Open Bunnyboard's **Chats** tab. The status chip beside **Chats** shows **Online** or
  **Busy**. Click it to switch.
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

## Where the code is

| File | What it does |
| --- | --- |
| `src/shared/modEntries/after-hours.ts` | Registers the mod and its option |
| `src/shared/afterHours.ts` | Defines the saved status and the invitation rule |
| `src/renderer/modEntries/after-hours.ts` | Loads the renderer hooks |
| `src/renderer/mods/afterHours.tsx` | Keeps the save field, draws the chip and registers the hooks |
| `src/shared/afterHoursText.ts` | Holds the labels, catalogue copy and DM prompt line |
| `src/renderer/vu_styles/AfterHours.css` | Dresses the chip and its hover hint |
| `test/afterHours.test.ts` | Checks invitation decisions and saved-data normalization |
