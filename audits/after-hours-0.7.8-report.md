# After Hours 0.7.8 — idle at home on weekends

| Branch | Commit |
| --- | --- |
| `naudh1r-core` | `a49e3e75` — hold idle contacts' replies to the next landing |
| `mod/after-hours-kit` | `c6d14284` — merge core, then `b8fe2ea4` — let contacts go idle at home on weekends |

## Core changes

| Files | Behavior |
| --- | --- |
| `packages/modkit/src/renderer/hooks.ts`, kit API reports, `MODDING.md`, Unreleased changelog and contract test | Keeps the existing `asleepNow` hook name, registration and `any` result. Supplies the current slot on queries and a shared home-contact snapshot at ordinary openings. The kit stays at 0.7.0. |
| `src/renderer/stores/gameLoop.ts`, `textingLoop.ts` | Prepares the home-contact snapshot after settling the opening's NPC placement and before opening the chat clock or delivering contact texts. Presence, the sender and all existing sleep delivery checks ask the same hook in both daytime and night. |
| `src/renderer/prompts/gameDate.ts`, `textingPrompt.ts`, `src/shared/types.ts`, `saveRules.ts` | A daytime idle reply uses `nextSlot` and saves the original sending half in `heldReply.away`. A resumed reply sends that half in `state.away`. Night replies retain `asleep` and their existing wait through the hold. A daytime reply skips the special shared-class delay. Both idle reasons keep the immediate held-reply call and skip the hangout classifier. |
| `src/renderer/views/BunnyboardModal.tsx` | The existing Idle header, composer placeholder and yellow lamp use the generalized hook. Lights in Chats still follow their own switch. |

With no mod answering true, core never marks a contact idle, changes a reply's hold, or suppresses a delivery.

## Weekend eligibility and delivery order

The opening uses `weekendSaturdayOf` for the game's Saturday and Sunday. The home list starts from the `knownWhereabouts` **told** route, so it includes known, unblocked contacts with a number. It keeps only `room` rows and excludes anyone in another contact's room, on a shift (`charJobNow`), or with a plan in this slot (`plannedWith`, reading both live events and incoming opening events). Away and sick rows are already distinct on the map. Bots are outside its roster. After Hours excludes the saved stay-over partner on the morning named by `stayOver.morning`, then rolls each remaining contact at 40% idle using date, half and character key. The mod save field fixes the list for that slot.

Both the skipped-night and completed-night paths go through `beginSlot`. After a completed night, `finishInterlude` clears the hold and calls `beginSlot(true, ready)`. A reloaded paid morning uses the same path. A skipped night enters the normal opening path. `prepareContactIdle(opening.events)` runs before `openChatSlot` on both paths, ahead of invitations and reach-outs. A temporary Vitest smoke fixture exercised the two Sunday opening paths with stubbed map rows and opening replies. On both, idle invitations and reach-outs were suppressed while an awake contact's reach-out arrived. On the stay-over path the partner's invitation still landed even though the partner's seed would otherwise mark them idle. The fixture was removed after the check.

The guard covers slot invitations (including reminders), ordinary and advice reach-outs, breakup texts, spring-break notices and Homecoming notices. The adventure map and texting ledger use their existing rules. The due-slot test covers a Saturday morning reply at the evening landing and a Saturday evening reply at whichever landing opens next, the held night or Sunday morning. The existing sleep test also verifies that a reply to a night text still waits for morning.

## Player-facing strings

- Option: “Not everyone answers right away”.
- Hint: “At night and on weekends, some people at home are asleep or away from their phone. Their light is yellow, and they reply later.”
- Header for an idle contact at a known dorm: “Idle · At {dorm}”.
- Composer: “{Name} is away or asleep right now. {They} will reply later.”

The option retains the `night-sleep` ID. Daytime idle works with **The night** off. The model receives a separate pronoun-aware prompt about catching up later. The morning copy allows sleeping in, and the evening copy offers other activities first with a nap as a possibility.

## Checks

| Check | Core | After Hours |
| --- | --- | --- |
| `npm ci` | 434 packages installed | Same lockfile and clean dependency tree |
| `npm run typecheck` | Pass | Pass |
| Kit API | `npm install`, `npm run report` and `npm run report:check` passed | Pass |
| `npm test` | 2,918 passed, 1 failed, 4 skipped | 2,941 passed, 1 failed, 4 skipped |
| `npm run build` | Pass | Pass |

Focused run with the temporary opening fixture and the committed rules tests passed all 37 tests. Full suites used the local Electron binary and archive helper. The known Linux `getComfyOutputFilePath` failure is in `test/mainServices.test.ts`. The boundary allowlist gained zero rows. No release zip was built.

The opening and delivery logic was exercised with fixtures. Live model wording and visual playback in the Electron app remain unverified.
