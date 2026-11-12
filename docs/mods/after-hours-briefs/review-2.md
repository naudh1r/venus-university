# Review brief 2 — After Hours: click through every flow, and re-check the fixes

**Do not change any code in this round.** Read, run, and report. Read
`docs/mods/after-hours-briefs/README.md` first, then `review-report.md` (the first review) beside it.

## What changed since the first review
- Core: Brief F (`3c627007`), then three changes made in review: the conversation readers hand out the
  whole thread again, with `chatClock()` / `messageShown` / `shownMessages` for mods that show messages
  (`fd7877c0`); held replies show on the night screen (`b337c2d8`); `answeringInvite` on the texting prompt
  state (`349c54f9`). Kit 0.15.0.
- The mod: 0.5.1 (`7ae631f2`).

```
git fetch origin
git checkout -B mod/after-hours origin/mod/after-hours
```

## 1. Get the game running in the browser (the first review could not)
The shipped girls are zips in the repo; the browser build needs them packed. From the repo root:

```
cd assets/characters && for z in *.zip; do unzip -q -o "$z"; done && cd ../..
mkdir -p build/web-assets
node scripts/packCharacters.mjs          # about 90 s; packs 30 characters into build/web-assets
```

**Never commit** the unzipped folders under `assets/characters/` or anything under `build/`.

Then, as `testsave/harness/README.md` describes: start the mock writer (`node testsave/harness/mock.mjs`)
and a fresh vite on its own port (`npx vite -c vite.web.config.ts --port 5199 --strictPort`), point the
app's custom endpoint at the mock, and restore `testsave/backup.zip` (Settings → Restore from backup) in
a throwaway browser profile to get a semester with contacts. Use the harness's `driver.mjs` helpers where
they fit. The mock's replies are canned: where a flow needs a particular reply (an invitation, a visit
agreed for a room, `stayedOver`), stub that reply as the first review did.

## 2. Click through every flow, After Hours on, then off
For each: what you did, what you saw, pass or fail. A screenshot for each screen that is new to the game.
1. Evening scene → the night screen (his room at night, the night line, only **End the day**). Relax in
   the evening (its label **Relax (Skip to bedtime)**) → the night screen.
2. **End the day** → its confirmation → **Never mind** keeps the night; **Sleep** → the curtain → the
   normal morning landing with its narration.
3. At night, texting: the divider reads late night; her prompt says late, in her dorm room.
4. A visit to **her room**: agreed in a DM, **Begin hangout**, the visit scene. Ends asleep → the
   morning-after scene in her room (morning look, no stat or money change). Then:
   - she has class → straight to his morning, the narration telling how he got back;
   - she is free → **Stay with {Name}** (a morning scene with her) and **Head back to your room**.
5. A visit to **his room** → the morning-after scene → his morning.
6. A visit that ends badly → no morning-after scene; the morning's narration mentions it.
7. The night before graduation: a normal night, then the ceremony.
8. **Busy** (the status card beside Chats): her ask in a chat he started is dropped; her reach-out and
   her slot-change invitation work; his own ask arms a hangout.
9. **Texting while she is busy**: text a girl in class; no reply now; the next landing shows her reply,
   unread; send twice, one reply; text her in an evening class → the reply shows on the night screen.
10. **Reloads**: a manual save and load at the night screen, mid-visit, mid-morning-after, at the Stay /
    Head back screen, and with a held reply waiting. Each lands back where it was.
11. **Mod off** (and each option off in turn): the evening goes straight to the morning, no status card,
    her box shut while she is busy, Relax's own words. The game as the org's `main` plays it.

## 3. Re-check
- Each of the seven findings in `review-report.md`: fixed, or not, with how you checked.
- The three review changes above: the readers whole (Photo Feature still finds her held reply), the held
  reply on the night screen, `answeringInvite` reaching the Busy line's decision.
- The README's rules across the whole change (`git diff b4ccf40c...mod/after-hours`).

## Report
Write `docs/mods/after-hours-briefs/review-2-report.md`, with screenshots under
`docs/mods/after-hours-briefs/review-2/`, and commit only those (one signed commit on `mod/after-hours`,
pushed to `origin`). In it: each flow's result; findings, most severe first, each with severity, file and
line, and steps; checks run; what could not be covered. No fixes in this round.
