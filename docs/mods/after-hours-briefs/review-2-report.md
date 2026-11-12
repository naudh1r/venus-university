# After Hours — review 2

Reviewed `b4ccf40c...911a9cd22fdd45ee7481abb9067b9521fde3cd4c`, including
hooks `349c54f974b84412a8a2ee60919ef3cb2f8e71a0`, kit 0.15.0 and mod 0.5.1.
Both branches were fetched and reset first; merging the freshly fetched hooks
into the mod reported already up to date. No implementation files were changed.

The browser now runs. The principal new failure is manual saving on interludes:
the night and morning choice screens offer Save Game but cannot write it. Most
flow transitions passed with canned replies. The gallery finding remains open.

## Findings

### 1. Blocker — manual saves silently do nothing on interlude landings

Locations: `src/renderer/stores/loop/saves.ts:507`,
`src/renderer/stores/loop/saves.ts:527`, `src/renderer/stores/gameStore.ts:2080`.

`captureScene()` deliberately returns null during an interlude, but
`manualSaveDraft()` rejects every non-graduation save without a scene. Consequently
`manualSaveOffer()` says `open` while `writeManualSave()` returns false before
calling storage. The save panel remains on its empty slot and shows no error.

Reproduction through the UI:

1. Relax in the evening and read through to End the day.
2. Escape → Save Game → click an empty slot.
3. The slot stays empty. Reading it through the bridge returns `SAVE_NOT_FOUND`.

This was reproduced by clicking `save-slot-101`; both before and after the click
it was empty. Direct calls through the same save writer also returned false for
night slot 101 and morning-choice slot 104. The Stay / Head back screen has the
same null-scene shape and fails identically. Thus the two requested manual
save/load tests cannot pass; neither manual save exists to load.

This can lose unsaved night texts or choices if the player expects the displayed
save operation to have succeeded. Mid-visit and mid-morning-after saves do work.
See [Save Game offered](review-2/25-night-save-offered.jpg) and
[empty slot after clicking](review-2/26-night-save-did-not-write.jpg).

### 2. Should fix — the contact gallery still includes a held photo before delivery

Locations: `src/renderer/views/ContactGallery.tsx:185`,
`src/renderer/views/ContactGallery.tsx:190`.

The conversation readers correctly return the whole thread again. GalleryPanel
still maps every message into its photo list without using `chatClock()` and
`shownMessages`/`messageShown`. Brief F's initial reader filtering therefore does
not fix this consumer after the reader change in `fd7877c0`.

Reproduction: enable Photo Feature, text a contact during class, and give the held
reply a completed photo attachment. Before leaving the morning, open her contact
page → Gallery. The thread hides the attachment, but the gallery says `GALLERY · 1`.
The fixture's opened chat clock was `57:0`; the attachment was stamped `57:1`.
`shownMessages` omitted it, while Photo's actual `photoNamesInSave()` correctly
returned its reserved filename. The gallery's list did not omit it.

The attachment used a fixture filename, without generated photo bytes. Thus the
browser check proves early listing/counting and the source path that includes
the photo, rather than claiming a real generated image was displayed.
See [hidden thread attachment](review-2/27-held-photo-thread-hidden.jpg) versus
[gallery counting it early](review-2/28-held-photo-gallery-visible.jpg).

### 3. Minor — displayed dates disagree across the night visit and morning choices

Locations: `src/renderer/views/GameView.tsx:1178`,
`src/renderer/views/GameView.tsx:2244`, `src/renderer/views/GameView.tsx:2317`.

A Tuesday March 17 night visit displays Wednesday March 18 with a NIGHT stamp:
SceneChrome receives the underlying morning's `date`, although the scene prompt
and background represent the preceding night. After waking on Wednesday March 18,
the Stay / Head back landing instead displays Tuesday March 17 · Morning:
`shownDate` always takes `interlude.now.from.date`, even when `look.time` selects
the opening morning.

Reproduction: evening March 17 → visit her room → wake together → read through to
the choices. The game clock remains `58:0` throughout the bonus scenes and choices;
the screen dates disagree with the represented hour. This is a display problem,
not evidence that the underlying save clock advanced incorrectly.
See [night visit stamp](review-2/08-her-room-night-visit.png) and
[morning choice stamp](review-2/10-stay-or-head-back.jpg).

### 4. Minor — the new chat-clock export is not inserted alphabetically

Location: `packages/modkit/src/renderer/index.ts:228`.

The added `chatClock` appears after `clock` in the same export list. The standing
rule requires new kit export names in alphabetical position, which puts
`chatClock` before `clock`. This is source-verified, with no runtime consequence.
The older list contains other grouping/order issues; those are not new findings
against this change.

## Browser setup and method

- Unzipped the shipped character archives, created `build/web-assets`, then ran
  `node scripts/packCharacters.mjs`. It packed 30 characters and 1,219 images,
  producing 93.9 MB of packs in 347.8 seconds on this machine.
- Started the supplied mock on `127.0.0.1:8783` and a fresh Vite on port 5199 with
  `--strictPort`. The mock was restarted after unpacking so its roster reads
  succeeded. No source file was edited or hot-reloaded during the checks.
- Launched installed Chromium with a throwaway profile, 1920×1080 and reduced
  motion. Used the first-run UI to configure the custom mock endpoint and restored
  `testsave/backup.zip` through Settings → Restore from backup. All seven supplied
  manual saves appeared. Reconfigured the writer after the restore reset settings.
- Used the supplied driver helpers where applicable, with the repository path
  adapted in a scratch copy outside the repository. Readiness waits were adjusted
  to allow the initial compile, page transitions and delayed control animations.
- Used the restored semester, principally manual04 and contact Celest. Scenario
  setup cloned a supplied save through the real game-entry path, clearing its
  scene and choosing the needed clock. Her fixture timetable was either free or
  explicitly in class. Morning fixtures marked the preceding night completed.
  These setup changes were confined to the throwaway browser, not repository saves.
- Played scenes, Relax, confirmation, DM Send, Begin, Stay and Head back with DOM
  controls and stage-advance clicks. Saved through the real manual writer and
  loaded through `switchGame`, the app's real loader, into IndexedDB-backed saves.
- Stubbed bridge completions for controlled scene endings, room agreements,
  `stayedOver`, invitations and held replies. Captured the actual requests to check
  prompt context. The slot-invitation check supplied a banked invitation before
  Sleep and let `beginSlot` deliver it; it did not depend on the invitation dice.
- Canned prose is test data. Some generic scene lines refer to an evening even
  when reused for a morning; those lines are not findings against the game's prompt.
  Room art, clock, transitions, saved state, payments and prompt instructions were
  checked separately. Real generated photo bytes were not used.

## Flow results

Pass below means the controlled transition/state check passed, not a certification
of real-model writing. Screenshot links show the actual app, not isolated components.

| Brief flow | Actions and observed result | Result / screenshots |
| --- | --- | --- |
| 1. Evening scene → night | Typed a solo evening action; read its scene, closing and status to the boundary. The night held the upcoming morning in his night room, played the authored night line and offered only End the day. No action box remained. | **Pass** — [night](review-2/02-night.jpg) |
| 1. Evening Relax → night | The evening row read Relax (Skip to bedtime). Clicked it and read through to the same held night. | **Pass** — [evening label](review-2/01-evening-relax-label.jpg) |
| 2. End the day | Clicked the row, then Never mind: remained at the night with unchanged clock and marker. Reopened confirmation and clicked Sleep: curtain, morning narration, ordinary morning landing. | **Pass** — [confirmation](review-2/03-end-day-confirmation.jpg), [curtain](review-2/04-sleep-curtain.png), [morning](review-2/05-normal-morning.jpg) |
| 3. Night texting | Opened Chats and sent a text. The visible divider read LATE NIGHT. Captured DM request said it was late on the preceding night and put her in her dorm room; no morning-class instruction was present in NOW. | **Pass** — [night thread](review-2/06-late-night-texting.png) |
| 4. Her room: agreement and Begin | Sent an ask, returned `nightVisit: herRoom` with a player-initiated verdict. Before Begin there was no cast and no bonus scene. Clicked Begin: private bonus scene in her night room. | **Pass**, with finding 3's date stamp — [agreement](review-2/07-her-room-agreement.png), [visit](review-2/08-her-room-night-visit.png) |
| 4. Her room: wake and payment | Returned `stayedOver: true`, finished the visit and entered a morning bonus scene in her day room. The clock remained `58:0`. Finished that scene with a ledger requesting three stat gains and $7 spending: stats stayed 50/50/50 and money stayed $1,846. | **Pass** — [morning-after scene](review-2/09-her-room-morning-after.png) |
| 4. She has class | Repeated her-room visit with a fixture morning class. The actual scene request named Public Relations Campaign Design and her need to leave. After the morning scene there were no Stay/Head back rows; his morning opening narrated the return. | **Pass** |
| 4. She is free: Head back | Free morning produced exactly Stay with Celest and Head back to your room. Clicked Head back; the ordinary opening request asked for the parting/return, and the canned response played on his landing. | **Pass**, with finding 3's date stamp — [choices](review-2/10-stay-or-head-back.jpg), [return](review-2/11-head-back-morning.png) |
| 4. She is free: Stay | Repeated the visit/morning and clicked Stay. A normal scene with her began at `58:0`, without replaying the opening narration. Its boundary advanced to `58:1`; unlike the bonus morning, it paid ordinary scene costs/rewards. | **Pass** — [normal morning scene](review-2/12-stay-morning-scene.png) |
| 5. His room | Agreed `hisRoom`, clicked Begin, finished asleep, then played a morning scene in his day room. Afterward his ordinary morning opened directly, with no choice screen. | **Pass** — [agreement](review-2/12-his-room-agreement.png), [visit](review-2/13-his-room-night-visit.png), [morning-after](review-2/14-his-room-morning-after.png) |
| 6. Bad visit | Returned `stayedOver: false` and read through the visit boundary. Went directly to his ordinary morning, with no morning-after scene; the opening prompt provided the visit context and the canned narration mentioned its bad end. | **Pass** — [morning after bad visit](review-2/15-bad-visit-morning.png) |
| 7. Graduation | Loaded the supplied pre-graduation evening, clicked Relax, reached a normal night, then clicked End the day → Sleep. The real authored May 22 ceremony opened. | **Pass** — [last night](review-2/16-graduation-night.png), [ceremony](review-2/17-graduation-ceremony.png) |
| 8. Busy: her new ask in his thread | Toggled the status card to Busy, started the thread and returned her immediate ask. The text appeared, but no Yes/No footer or armed hangout followed. The request contained the background restriction. | **Pass** — [dropped ask](review-2/18-busy-drops-her-ask.jpg) |
| 8. Busy: her reach-out | Seeded her first text in the slot, replied while Busy and returned an ask. The native Yes/No footer appeared; the request omitted the restriction. | **Pass** — [reach-out invitation](review-2/19-busy-keeps-reachout-invite.jpg) |
| 8. Busy: his ask | While Busy, asked her to meet and returned acceptance with a player-initiated verdict. Begin hangout appeared. | **Pass** — [player ask](review-2/20-busy-player-ask-begins.jpg) |
| 8. Busy: standing / slot invitation | In a reader-started thread, put her standing invitation away with No, then texted an answer: the request omitted the Busy restriction. Separately banked an invitation, set Busy during the night, clicked Sleep and observed the next opening's native Yes footer. | **Pass** — [slot invitation](review-2/21-busy-slot-change-invitation.jpg) |
| 9. Class, then replacement | Texted during a fixture class. The player bubble appeared immediately; the reply was future-stamped, hidden and unread count remained 0. Sent again: both player messages remained, but the first held reply was removed and replaced by one reply covering both. | **Pass** — [held text](review-2/22-class-text-held.jpg) |
| 9. Next landing | Closed the phone and clicked Relax. At the next landing the hold was gone, one reply remained and her unread count was 1 before reopening the phone. | **Pass** — [delivered reply](review-2/23-held-reply-delivered.jpg) |
| 9. Evening class → night | Texted during an evening class, closed the phone and relaxed. At the night landing, before Sleep, the reply was visible, its hold was cleared and unread was 1. | **Pass** — [night delivery](review-2/24-evening-reply-on-night.jpg) |
| 10. Night manual save/load | Actual Save Game offered; clicking its empty slot did not write. Direct writer also returned false. | **Fail: finding 1** |
| 10. Mid-visit manual save/load | Wrote manual102 and loaded it. Restored the same queued night scene, cast, visit marker and `bonus: true`, `bonusAt: night`, `bonusPays: true`. Continued it successfully. | **Pass** |
| 10. Mid-morning-after manual save/load | Wrote manual103 and loaded it. Restored the same queued morning scene, `bonusAt: morning`, `bonusPays: false`, then completed it without a second payment. | **Pass** |
| 10. Stay / Head back manual save/load | Writer returned false for manual104; no save existed. Replayed a visit to test the alternative Stay route instead of pretending this reload succeeded. | **Fail: finding 1** |
| 10. Held reply manual save/load | Saved manual105 while a delayed held completion was in flight. Loaded it; recovery requested the turn again and banked the completed replacement for the due slot. Also saved and loaded an awaiting-player-plus-system-error fixture as manual106: recovery removed the error and cleared the waiting marker. | **Pass** |
| 11. Mod off | Evening scene and evening Relax both went straight to ordinary morning. Status card absent; class composer shut; Relax used Skip to tomorrow. Her ordinary immediate ask still produced Yes/No, with no Busy prompt restriction. | **Pass** — [off phone](review-2/off-mod-off.jpg), [morning](review-2/off-mod-off-morning.jpg), [ordinary invitation](review-2/29-mod-off-ordinary-invitation.jpg) |
| 11. Night option off | Base Relax words and direct morning; status card and ordinary texting retained. Turning the option off during an already-held night left that hold standing until Sleep, as documented. | **Pass** — [phone](review-2/off-night-off.jpg), [morning](review-2/off-night-off-morning.jpg) |
| 11. Busy status option off | Card absent; night still followed the evening. | **Pass** — [status off](review-2/off-status-off.jpg) |
| 11. Busy-texts option off | Her class composer was disabled with its class explanation; the night remained enabled. | **Pass** — [busy texts off](review-2/off-busy-texts-off.jpg) |
| 11. All options off | No card, class composer shut, base Relax words and direct morning with no night hold. | **Pass** — [all off](review-2/off-all-options-off.jpg) |

## Re-check of the first review's seven findings

| First finding | Status | Evidence / limits |
| --- | --- | --- |
| 1. Bonus consumes Campus Talents' morning reward | **Fixed by dispatch separation** | `gameLoop.ts:3239` calls `bonusSettled` for a bonus and `slotSettled` otherwise. The runtime dispatchers invoke only their respective registrations. Campus Talents still registers only `slotSettled`, so it no longer consumes the morning's once-per-slot marker at a bonus boundary. The played visit and morning-after boundaries reached the distinct normal Stay scene without advancing the clock first. No new talent progression policy was inferred for bonus scenes. |
| 2. Held photo gallery exposure | **Not fixed** | Whole readers are intentional; GalleryPanel still needs consumer filtering. With Photo Feature explicitly enabled, reproduced early `GALLERY · 1`; see finding 2. |
| 3. Awaiting player turn behind a saved error | **Fixed** | `waitingText` searches backward for the awaiting player, and recovery removes following system errors. The actual manual106 save/load generated a replacement, removed the fixture error and cleared `awaitingReply`. |
| 4. Busy prompt suppresses chats she started | **Fixed** | Captured real DM requests: reader-started thread included the restriction, her-started thread omitted it, and an answer to her dismissed-but-standing invitation omitted it. This exercises `answeringInvite` from sendText into `busyPromptApplies`, not merely the pure helper. |
| 5. Bunnyfeeds treats bonus as slot advance | **Fixed for the reported dispatch problem** | Bunnyfeeds registers only `slotSettled`, so real bonus boundaries no longer call its next-slot filing/request hook. The night stamping helper also reads the held interlude. This round did not run a complete generated Bunnyfeeds comment exchange. |
| 6. Morning bonus thumbnail uses night | **Fixed in the selector; partial visual verification** | `loop/thumbnail.ts:198` now reads `bonusAt === morning`. Actual manual103 kept morning timing and resumed the day room. No pixel comparison of the serialized thumbnail was performed, so the thumbnail-art portion is source-verified rather than visually certified. |
| 7. New Game+ held clock metadata | **Fixed transform** | Executed the real `carryOf` on the held thread: player date 57 and reply/held-until date 57 moved together to -153, retaining time 0/1 respectively. The semester-carry tests passed. Did not play a naturally pending reply through the entire graduation → New Game+ setup. |

The three intervening review changes were also checked explicitly: readers remain
whole and Photo's reserved-name lookup finds the held attachment; the shared
visibility helpers omit it for the opened clock; an evening reply reaches the
night screen; and `answeringInvite` exempts the correct Busy prompt exchange.

## Commands and standing-rule audit

- Read the standing README first, then the first report, CLAUDE.md, DESIGN_GUIDE.md,
  MODDING.md, UI_STYLE_GUIDE.md and the harness instructions.
- `npm run typecheck`: **passed** (node, web and tests).
- `cd packages/modkit && npm run report:check`: **passed**, reports up to date.
  No kit source changed in this round, so no report regeneration was needed.
- `npm test`: **failed**, 14 files failed, 410 passed, 3 skipped; 100 tests failed,
  5,004 passed, 4 skipped, 5,108 total. This was run while character packing was
  active; timing failures are not treated as proof of an After Hours regression.
- The ten archive-writing failures were `backup.test.ts`,
  `backupImportPreflight.test.ts`, `backupPart.test.ts`, `characterTransfer.test.ts`,
  `characterTransferPart.test.ts`, `localPhotoBackup.test.ts`,
  `qa4-archive-preserve-existing.test.ts`, `qa5-import-echo-preflight.test.ts`,
  `qa5-import-preflight.test.ts` and `soundtrackStorage.test.ts`.
- Other failures: `mainServices.test.ts`'s Comfy output-path rejection expected an
  exception but received none; `photoBrowserInvoke.test.ts` exceeded 5 seconds;
  `poker.test.ts`'s “makes only moves the table allows…” exceeded 5 seconds;
  `pool.test.ts`'s “fouls by the wrong ball…” and “pots more the better she is…”
  exceeded their 50 ms decision limits. The path and pool failures were already
  seen on the specified baseline in review 1. No unrelated fixes were made.
- Targeted rerun of Photo browser invoke and poker after packing: poker **52/52
  passed**, Photo browser invoke still timed out at 5 seconds (1 failed, 52 passed
  across those two files). The required full suite remains non-green.
- The full run passed the kit contract and the After Hours, chat visibility,
  texting-thread and semester-carry pure-rule tests. No new wording/look tests added.
- `git diff --check b4ccf40c...HEAD`: **passed**. Reviewed the whole change's file
  inventory and the relevant core/kit/mod paths, not only the patch since review 1.
- Zero allowlist additions; zero tracked modkit dist files. Shared mod files import
  no renderer files; the mod's imports stay within kit, React, Motion and own files.
  No protected-guide/README/testing-plan changes and no `src/main` changes in the
  full change. No mod identifiers were added to hooks' core/kit code. Existing
  ordinary-fiction uses of “after hours” in unrelated prompt pools are not mod names.
- The save field retains normalization and has no carry handler. Prompt text uses
  fictional circumstances, not the player's Busy label. The new host dispatcher
  export is ordered; the renderer `chatClock` insertion is the exception in finding 4.
- Generated character folders and build output were used locally only. The commit
  for this round contains only this report and its screenshots. No PR opened.

## Not covered

- Real model replies, network/provider behavior, image generation or real photo
  pixels. The held photo check used a completed attachment record with a fixture
  filename; the gallery's early listing is demonstrated independently of image I/O.
- Every combination of the other mods' own flows. Core dispatch isolation, the
  Photo reader/gallery path and the visible Incoming Texts/Text Regeneration
  controls were checked; complete generated Bunnyfeeds, Whisper and Mini-games
  sessions were not played in this round.
- The full graduation-to-New Game+ setup with a naturally outstanding held reply.
  Its carry transform was executed, but that end-to-end reachability check remains.
- Thumbnail pixel comparison, all character staging/CG variants, alternative
  viewport sizes, and real-model handling of free-form room agreements.
- Successful manual reloads of the night and morning choice screens: blocked by
  the reproduced save failure, not omitted as passes.
