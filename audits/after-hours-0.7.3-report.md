# After Hours 0.7.3 meet-up audit

| Branch | Commit |
| --- | --- |
| `naudh1r-core` | `35048959a6f152165644f30a3526f914fbedd86c` |
| `mod/after-hours-kit`, core merge | `7a679804bab6be6ac0f605705275cf6b833ce62d` |
| `mod/after-hours-kit`, 0.7.3 | `f00a85bec571310ac19bddf09d8f034fe8385967` |

## Core and kit

| File | Change and default |
| --- | --- |
| `src/renderer/stores/textingLoop.ts` | An agreed reader-initiated meet-up runs `ownMeetupAsks` before arming. A true answer gets a `mine` footer without marking an invitation or sending the BunnyBot tip. No dismisses the footer quietly. A reader text after No marks `followedUp`. Yes arms the meet-up with the existing “Sure” response. Without an opt-in, reader verdicts still arm directly and contact invitations still use their own bookkeeping. |
| `src/shared/types.ts` | `Conversation.pendingHangout` accepts optional `mine` and `followedUp` markers. The save reader has no literal flag check for this nested object. Native contact saves use the same shape as before. |
| `src/renderer/prompts/textingPrompt.ts` | An own footer does not turn the last DM into a contact invitation in the prompt. Native invitations keep their existing treatment. |
| `src/renderer/stores/gameLoop.ts` | The boundary sends `ownMeetupsLapsed` to `slotSettled`. It is empty in a game that has no player-owned footers. |
| `src/renderer/mods/readers.ts` and `src/renderer/stores/gameStore.ts` | `noteInThread` appends a quiet system message with zero unread increment. An explicit stamp is preserved even while the chat clock holds a night. It runs only on a mod call. |
| `src/renderer/stores/slotActions.ts` and `src/renderer/views/BunnyboardModal.tsx` | Phone Yes asks `warnBeforeMeetup`. With opt-in, the current class, assessment or shift is read on the landing's rules. The existing confirmation modal lets Cancel leave the footer open or Meet anyway accept it. Without opt-in, Yes goes through directly. Landing actions do not call the warning. |
| `packages/modkit/src`, `packages/modkit/api`, `MODDING.md` | Both renderer hooks are registered as `any`. The writer and context are exposed in the kit, with an Unreleased changelog entry, API reports and contract coverage. The kit remains 0.7.0. |

`applyCast` in `loop/promptState.ts` calls the native contact invitation sweep when the scene starts. That sweep skips `mine` footers, including when it clears a reminder for an unrelated stood-up plan. The own footer remains in the saved conversation until `crossSlotBoundary` in `gameLoop.ts:3463`. There, `expireOwnMeetups` reads the footer before clearing it and only records a lapse if the reader left it unanswered or dismissed it without sending a follow-up, and the character was outside the closing cast. The list goes to the hook before the clock moves and the boundary saves. When resuming an ending without the loop's closing cast, the lapse check uses the saved cast IDs.

After Hours enables both hooks whenever the mod is on. It writes the disliked memory through `addMemory`. For a phone meeting or a landing plan with an answered reminder, the thread marker and closing cast identify the lead. A current event matches the opening action by title or description, and its cast attendees are included in the note. The place comes from the kit's location catalogs. After Hours declares version 0.7.3 and targets game 0.9.2.

## Player-facing strings

- Own footer: “Meet up with {Name}?” · “No” / “Yes”
- Accepting: “Sure” · “Begin hangout”
- Lapsed memory: “you asked to meet up and then changed your mind”
- Thread: “You met up with {Name} at {place}.” or “You met up with {Name}.” For example, “You met up with Celest and Isabelle at the Agora.”

| Commitment | Title | Body |
| --- | --- | --- |
| Class | Skip {class name}? | Meeting {Name} now means missing your class. |
| Assessment | Miss your {class name} {final / midterm / showcase}? | Meeting {Name} now means skipping it. |
| Shift | Miss your shift at {workplace}? | A missed shift is a strike. You have {n} of 3. |
| Third strike | Miss your shift at {workplace}? | It would be your third strike, and you would lose the job. |

All warnings use “Cancel” and “Meet anyway”.

## Checks

| Check | Core | After Hours |
| --- | --- | --- |
| Clean install | `npm ci` installed 434 packages from the lock. | Same lock hash and clean dependency tree. |
| Typecheck | Pass | Pass |
| Kit report check | Pass after regenerating reports | Pass |
| Unit suite | 2,847 passed, 4 skipped, 61 failed | 2,866 passed, 4 skipped, 61 failed |
| Desktop build | Pass | Pass |

The suites on both branches reported 60 archive failures in backup, backup preflight, backup parts, character transfer and character transfer parts. The clean Linux install left the bundled 7-Zip binary without execute permission. After enabling it in the temporary install, all 79 tests in the five affected files passed on the merged branch. The other failure on each branch was the known Linux `getComfyOutputFilePath` assertion in `test/mainServices.test.ts:182`. The focused core and kit run passed all 195 tests. The mod boundary allowlist did not change.

The builds used a sparse checkout without bundled character archives to fit the workspace. Verification covered the bookkeeping and builds. The phone modal and live meeting flow were not clicked through. A reloaded ending can have an empty native `closingCast`. After Hours follows the hook's cast requirement for the thread note, so that ending does not produce a note even when the saved scene has a phone marker. Group attendees are only included when the plan can be identified from the available starting action.
