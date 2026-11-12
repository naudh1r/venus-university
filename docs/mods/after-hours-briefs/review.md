# Review brief — After Hours, the whole change

**Do not change any code in this round.** Read, run, and report. Read
`docs/mods/after-hours-briefs/README.md` first; its rules are what the change must keep.

## What to review
Everything `mod/after-hours` adds to the org's `main`, core hooks included:

```
git fetch origin
git checkout -B mod/after-hours origin/mod/after-hours
git diff b4ccf40c...mod/after-hours        # b4ccf40c: the org's main the work started from
```

Two parts, reviewed as one:
- **Core and kit** (`packages/modkit/**`, `src/renderer/**` outside the mod's files, `src/shared/**` outside
  `afterHours*`, `MODDING.md`, tests): the hooks `hangoutVerdict`, `chatsHeader`, `slotInterlude`, the
  late-night clock, `relaxLabel`, the bonus scene, `Interlude.look/onHangout/scene`, `charCommitmentAt`,
  `textWhileBusy` and held replies. Kit 0.7.0 → 0.13.0.
- **The mod** (`src/shared/afterHours*.ts`, `src/shared/modEntries/after-hours.ts`,
  `src/renderer/modEntries/after-hours.ts`, `src/renderer/mods/afterHours.tsx`,
  `src/renderer/vu_styles/AfterHours.css`, `docs/mods/after-hours.md`, `test/afterHours.test.ts`).

What the mod is meant to do: `docs/mods/after-hours.md` (the player's guide) and
`docs/mods/after-hours-plan.md`. Where the plan and the guide disagree, the guide is the later decision.

## What to look for, most important first
1. **Save integrity.** Anything that can silently corrupt or lose a save: the bonus scene's boundary (no
   clock move, re-fetched opening keeping its picks, `heldOpening` on boundary saves), reloads at every
   point (mid-night, mid-visit, mid-morning-after, mid-held-reply), `awaitingReply` and resumed held
   replies, the mod's `saveField` (`normalize`, no `carry`), New Game+ across a held night or reply.
2. **The base game with the mod off.** With After Hours off, or every option off, the game must behave as
   the org's `main` does. Flag any core change that alters play without a mod asking for it (one is known
   and intended: boundary saves keep the banked opening).
3. **Correctness of each flow:** the night after every evening and Relax; End the day; the night before
   graduation; visits (one a night, Begin required, her room or his); a visit ending badly; the
   morning-after scene (morning clock, no stats or money, her commitment); Stay / Head back / sent back;
   Busy (only her new asks in chats he started); texting while she is busy (held, replaced, deferred
   block, photo held, night delivery).
4. **Other mods.** Bunnyfeeds, Photo Feature, Text Regeneration, Incoming Texts, Venus Whisper, Campus
   Talents, Mini-games: does any of them break, double-count on `bonus` settles, or see hidden messages?
5. **The README's rules:** hooks-only (zero new lines in `test/kit/boundaryAllowlist.json`), no
   `packages/modkit/dist/`, shared never importing renderer, kit lists in order, nothing outside scope,
   no player-facing labels handed to the model, comments that say what the code does.
6. **Docs:** `MODDING.md` and `docs/mods/after-hours.md` say what the code does, and nothing it doesn't.

## Run
- `npm run typecheck`, `npm test` (11 files that write zips with 7-Zip may fail as on the org's `main`;
  name any other failure), `cd packages/modkit && npm run report:check`.
- Your browser checks with stubbed model replies, through each flow in point 3, with After Hours on and
  then off.

## Report
Write `docs/mods/after-hours-briefs/review-report.md` and commit only that file (one signed commit on
`mod/after-hours`, pushed to `origin`). In it:
- **Findings**, most severe first. Each: severity (blocker / should fix / minor), file and line, what goes
  wrong, and the concrete steps or state that make it happen. Only what you verified or can show; mark
  anything you suspect but could not show as "unverified".
- **Checks run**, with their results.
- **Not covered**: what you could not test (for example, real model replies).

No fixes in this round: each finding becomes its own brief afterwards.
