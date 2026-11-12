# After Hours review

Reviewed `b4ccf40c...24abab64d69a64fe0a2f8f2300652bb181e4c78c`, including core and kit.
The freshly fetched hooks tip was `b337c2d8f248b9535062235ad20570c14b1b2c88`;
merging it into the freshly reset mod branch reported already up to date.
No implementation files were changed. This is not a release sign-off: the complete
browser flow matrix could not be exercised, and the test suite is not green.

## Findings

### 1. Should fix — a bonus scene consumes Campus Talents' real morning reward

Locations: `src/renderer/stores/gameLoop.ts:3237`,
`src/renderer/modEntries/campus-talents.ts:85`, `src/shared/campusTalents.ts:123`.

The new bonus dispatch supplies `bonus: true`, but Campus Talents ignores it and
calls `settleTalentPoints` with the current morning's date and time. Even a scene
earning no bond points permanently marks that slot settled. The ordinary morning
scene then cannot earn its bond points. The night visit and morning-after scene
also compete for this same marker.

Reproduction: enable Campus Talents, finish a night visit without a new liked/loved
memory, then finish the normal morning with a new liked memory. In Chromium,
calling the actual pure settlement twice with an initialized talent state produced
`settled['0:5:0'] = true` after the empty bonus; the subsequent liked memory earned
0, versus 1 without that bonus settlement. The hook's unconditional call establishes
the integration path. This is a saved loss of a reward, not merely a display issue.

### 2. Should fix — held DM photos are visible early in the contact gallery

Locations: `src/renderer/stores/gameStore.ts:2921`,
`src/renderer/mods/gameReaders.ts:121`, `src/renderer/views/ContactGallery.tsx:190`.

The thread UI hides future messages, but `conversation`/`useConversation` expose
them unfiltered. GalleryPanel includes every completed DM photo without consulting
the opened chat clock. A player can see the photo before the held reply arrives.

Reproduction: while she has class, send a text whose held reply includes a completed
photo; open her Gallery before the next landing. A Chromium render of the actual
GalleryPanel with a future-stamped held message showed `GALLERY · 1` and, once the
tile mounted, an image URL ending in `/photos/review/char-1/held.webp`, while the
opened clock was still the preceding slot. The kit conversation reader also returned
the hidden reply text. Ordinary chat visibility filtering does not protect other
consumers of that reader. No real image generation was used.

### 3. Should fix — recovery skips an unfinished held turn followed by an error

Locations: `src/renderer/stores/textingLoop.ts:710`,
`src/renderer/stores/textingLoop.ts:2023`,
`src/renderer/stores/gameLoop.ts:3319`.

A failed held call leaves the player message marked `awaitingReply` and appends a
system error after it. Recovery only examines the very last message, so it skips
this conversation. Failed-turn retry state is in a module-local Map, not the save;
resetting/loading loses it. The saved player turn is left unanswered without a
restored Retry action.

Concrete saved state: an awaiting player message followed by the system error
`Failed to receive Sarah's message.`, with `heldReply` still present. Passing that
shape to the real recovery function in Chromium made zero stubbed model calls and
left `awaitingReply: true`. The failure branch constructs that shape. One path to
a boundary save is a held call failing after the player has already started a
scene: held calls survive scene entry, and the scene's boundary serializes the
conversation. The complete scene-to-disk-to-reload path was not browser-tested;
the recovery failure for the saved shape was reproduced.

### 4. Should fix — Busy prompt restrictions also apply to chats she started

Location: `src/renderer/mods/afterHours.tsx:228`.

The verdict filter correctly distinguishes who started the thread and standing
invitations. The DM prompt does not: whenever Busy is saved, it tells her not to
suggest meeting now, including in a thread she initiated or a reply to her existing
invitation. This conflicts with the player's guide's promise that those exchanges
work normally.

Reproduction/state: set Busy, receive her slot reach-out, then reply. The prompt
hook unconditionally includes `busyPrompt(character.firstName)`; neither thread
origin nor answering-invitation state is checked. The erroneous instruction is
verified from the construction path. How often a real model obeys it in these
exchanges is unverified.

### 5. Should fix — Bunnyfeeds still treats bonus settlements as a slot advance

Locations: `src/renderer/modEntries/bunnyfeeds.ts:204`,
`src/renderer/stores/bunnyfeedsMemory.ts:58`,
`src/renderer/stores/bunnyfeedsThreads.ts:353`.

The new bonus flag reaches `slotSettled`, but Bunnyfeeds ignores it. It files held
memories through `globalSlotOf(date, time) + 1` and requests replies with `showAt:
'next'`, even though this boundary does not advance the clock.

Concrete state: during the night held at morning slot 10, a feed reply/memory is
banked for slot 11. Finish a night visit. The bonus hook calls
`fileDueFeedMemories(11)` while the game remains at slot 10, so the memory can affect
her standing before its visible reply. Replies generated by this hook are likewise
stamped 11 instead of the still-opening morning. This is established by the actual
dispatch, due-memory comparison and reply stamping code; an end-to-end feed/model
round was not run. The plan already lists a Bunnyfeeds night-stamping follow-up;
it remains an outstanding compatibility issue in this whole-change review.

### 6. Minor — morning-after save thumbnails use the night render

Location: `src/renderer/stores/loop/thumbnail.ts:198`.

Every bonus thumbnail chooses the preceding slot's half, without reading
`scene.bonusAt`. A manual save during the morning-after scene therefore composes a
night thumbnail although the scene and its restored stage use morning timing.
State: `scene.bonus === true`, `scene.bonusAt === 'morning'`, `game.time === 0`.
The thumbnail expression evaluates to night. This is source-verified; an exported
thumbnail with actual character art was not inspected.

### 7. Should fix, unverified reachability — New Game+ retains held-reply clock metadata

Location: `src/renderer/stores/semesterCarry.ts:168`.

`carriedConversation` shifts message dates but spreads `heldReply` unchanged and
retains message-level `awaitingReply`. A Chromium call to the actual `carryOf`
shifted a message from date 5 to -205 while leaving `heldReply.until` at date 5.
Thus a carried pending delivery can name the previous semester's clock. A finished
held turn with no awaiting player tail is not repaired by `resumeHeldReplies`.

This is a verified transform discrepancy, but reaching the relevant completed-held
state through the graduation/Continue UI was not demonstrated. Normal pending
player-tail recovery recalculates its due clock, and normal graduation delivery
may clear a completed hold before Continue. Treat the practical loss/delay scenario
as unverified, rather than assuming every New Game+ loses a reply. The failed-turn
shape in finding 3 also survives this carry unchanged apart from message dates.

## Checks run

### Repository and static checks

- Read the standing-rules README first once its branch was fetched, plus CLAUDE.md,
  DESIGN_GUIDE.md, UI_STYLE_GUIDE.md, MODDING.md, the player guide and the plan.
- Fetched both branch refs explicitly because this checkout's origin fetch refspec
  initially fetched only main; reset both local branches to the fresh remote refs.
- Reviewed the full changed-file inventory and the save, opening, texting, interlude,
  scene payment and related compatibility paths against the requested baseline.
- `git diff --check b4ccf40c...HEAD`: passed.
- No allowlist diff; zero tracked files under `packages/modkit/dist/`; no changed
  DESIGN_GUIDE.md, UI_STYLE_GUIDE.md, README.md or TESTING_PLAN.md; no `src/main`
  diff. The new mod files use kit/React/Motion/own-file imports; shared mod files
  do not import renderer code. No player-facing Busy label is passed as a model
  status. The saved field has normalization and no carry handler.
- The bonus boundary guards clock advancement and replay creation; `heldOpening`
  is written at the boundary and restored on entry, and bonus opening rewrites reuse
  the held picks. These are source checks, not a complete save round-trip matrix.
- Morning-after stat/money suppression is present, including the final suppression
  after stat hooks. Existing pure tests passed in the full run.

### Commands and results

Dependencies were initially absent. Installed root and kit dependencies using
`npm ci`; lockfiles were unchanged. Initial missing-tool attempts were rerun.

- `npm run typecheck`: passed, all three TypeScript projects.
- `cd packages/modkit && npm run report:check`: passed, API report up to date.
  No kit source was changed, so no API report was regenerated for this review.
- `npm test`: **failed**, 13 files failed, 411 passed, 3 skipped;
  97 tests failed, 4,905 passed, 4 skipped (5,006 total).
- Archive-related failing files: `backup.test.ts`, `backupImportPreflight.test.ts`,
  `backupPart.test.ts`, `characterTransfer.test.ts`, `characterTransferPart.test.ts`,
  `localPhotoBackup.test.ts`, `qa4-archive-preserve-existing.test.ts`,
  `qa5-import-echo-preflight.test.ts`, `qa5-import-preflight.test.ts`,
  `soundtrackStorage.test.ts`. These also failed on the baseline run.
- **Other failures:** `kit/contract.test.ts` initially failed to import because
  Electron's download failed. Installed the binary with
  `NODE_USE_ENV_PROXY=1 node node_modules/electron/install.js`, then reran that
  file: **97/97 passed**, including the kit boundary checks.
- **Other failures:** `mainServices.test.ts`, `getComfyOutputFilePath > refuses every
  name that lands anywhere else, and refuses it permanently`, expected
  `COMFY_OUTPUT_PATH_INVALID` but received no thrown error. The same case failed
  in a targeted baseline run (13 passed, 1 failed). No unrelated path fix made.
- **Other failures:** `pool.test.ts`, `pots more the better she is, and never takes
  long to choose`, exceeded its 50 ms limit (53.64 ms). Targeted rerun failed both
  that case and `fouls by the wrong ball or none less the better she is, and hardly
  ever at her best`, again on the 50 ms limit (53.34 and 71.10 ms).
- Baseline comparison: detached worktree at `b4ccf40c`, sharing the installed
  dependencies, `npm test -- --maxWorkers=4`: 15 files failed, 405 passed, 3 skipped;
  100 tests failed, 4,972 passed, 4 skipped. Besides the ten archive files above,
  baseline failures included `mainServices.test.ts`, `pool.test.ts`,
  `photoBrowserInvoke.test.ts`, `webEchoBackup.test.ts`, and `whackABun.test.ts`.
  The concurrent runs used different worker counts; timings and totals are not a
  controlled performance comparison. No test failure unique to the reviewed code
  was established after the contract rerun; the required suite still did not pass.

### Chromium with stubbed replies

Started `npm run dev:web -- --host 0.0.0.0` and launched installed Chromium through
Playwright. The actual browser app stopped before the menu with
`PACKS_MISSING`, detail `packs/index.json`. Attempted the repository's
`node scripts/packCharacters.mjs`; it failed writing
`build/web-assets/characters.json` (ENOENT). The checkout carries character ZIPs,
whereas this packaging path expects the expanded source cast. No source fix made.

Continued with an isolated page importing the real renderer/kit modules from Vite,
using fixtures and stubbed bridge/model replies; the scratch harness stayed outside
the repository. This is targeted browser execution, not full UI acceptance testing.

- Night hook on returns a late-night hold; mod off returns no hold; all three options
  off return no hold.
- Pure visit decisions: successful visit requests morning scene; completed morning
  in her room while free offers buttons; busy/his-room/graduation cases open without
  buttons; completed-night marker suppresses the night; unfinished visit adds no
  second night. These do not establish the full scene playback.
- Actual busy-class lookup and `sendMessage` with stubbed completion: player message
  immediate, reply future-stamped, unread unchanged before delivery.
- Second `sendMessage` replaces the old held reply, retains both player messages,
  and includes both in the replacement prompt.
- Stubbed block is absent before delivery and takes effect when `openChatSlot`
  releases the due reply. A held reply remains held before its due clock and is
  released at that clock's landing.
- Reproduced recovery skip, Campus Talents reward suppression, kit reader exposure
  and actual contact Gallery rendering described in the findings.
- Executed the actual New Game+ carry on a held-reply fixture; practical graduation
  reachability remains unverified as described above.

## Not covered

- The requested full click-through matrix with After Hours on and then off:
  evening scenes and Relax into night, confirmation cancel/Sleep, graduation night,
  Begin-required visits to both rooms, bad endings, complete morning-after playback,
  Stay/Head back/sent back, and persistent saves loaded at each point. Missing
  generated packs blocked the normal app boot; targeted module checks do not
  substitute for these flows.
- Real model replies, real photo rendering, art/theme inspection across the complete
  flows, and successful disk/IndexedDB save/reload cycles for every bonus boundary.
- Full combinations with Bunnyfeeds, Photo Feature, Text Regeneration, Incoming
  Texts, Venus Whisper, Campus Talents and Mini-games. Their relevant dispatch/read
  paths were inspected; findings above identify demonstrated/source-established
  problems, not a certification of every other combination.
- A naturally reached New Game+ with an outstanding held reply or held night.
- Comparison against a newer org main than the specified baseline. Nothing was
  pushed to the org repository and no pull request was opened.
