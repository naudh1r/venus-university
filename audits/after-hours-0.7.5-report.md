# After Hours 0.7.5 — not everyone stays up at night

| Branch | Commit |
| --- | --- |
| `naudh1r-core` | `fc2d931c` — hold sleep replies for the morning landing |
| `mod/after-hours-kit` | `4bd551ff` — merge core, then `09274187` — let contacts sleep through the night |

## Core changes

| Files | Change |
| --- | --- |
| `packages/modkit/src/renderer/hooks.ts`, `src/shared/hookTable.ts` and `src/host/renderer.ts` under the kit | Registers the renderer `any` hook `asleepNow({ charId })`. Core's `contactAsleep` asks it only during a late-night hold. The kit stays at 0.7.0. |
| `src/renderer/views/BunnyboardModal.tsx`, `src/renderer/vu_styles/Bunnyboard.css`, `tokens.css` | Adds an idle light beside the chat name, in the thread header and wherever the contact card uses the same presence. The header changes **Online** to **Idle** and keeps place text. The idle token is `#a18a22` by day and `#ded06b` by night. The composer stays open with the sleep placeholder, below the epilogue, scene and block checks. |
| `src/renderer/stores/textingLoop.ts`, `src/renderer/prompts/textingPrompt.ts` | A text to an idle contact starts a background reply immediately. A second text after the first reply is written replaces the held reply and includes the earlier messages. A saved unfinished turn resumes with the same reason. Prompt hooks receive `asleep: true`. |
| `src/shared/chatVisibility.ts`, `src/shared/types.ts`, `src/shared/saveRules.ts`, `src/renderer/stores/gameStore.ts` | Saves the opened chat clock's `night` phase. Sleep replies and any accompanying contact messages inherit the held morning's stamp and `afterNight: true`. The thread projection and unread delivery both use the same visibility rule. The projection cache distinguishes night and morning even when their numeric slots match. |
| `MODDING.md`, kit Unreleased changelog and API reports, `test/kit/contract.test.ts` | Documents and verifies the hook alongside the existing kit surface. |

With no enabled mod answering true, the phone and reply behavior stay as before. The adjacent pronoun corrections apply independently.

## Delivery and filing

The reply's `until` is the late-night interlude's `to`, the next morning. Both the night and the morning open on that numeric chat slot, so comparing dates alone would reveal the reply on the night landing. The sleep hold and its messages check the opened phase as well. The new visibility test proves the hold and the reply stay hidden during that night, appear when the morning opens, and are visible on a later night. An ordinary busy reply due on that same morning can still arrive when the night opens. The existing receipt calculation gives two grey ticks while the written reply is hidden and two blue ticks when it shows.

The player's text keeps its `late: true` stamp and is available to the night ledger. The reply has the morning stamp and is eligible for the morning ledger. Neither ledger changes.

The direct slot invitation delivery skips sleeping contacts before adding a pending invitation. Ordinary and advice reach-outs skip them before sending or recording an advice question. The shared contact delivery used by reach-outs, breakup texts, spring-break notices and Homecoming notices also skips them. The normal opening calls these after the hold releases. Bot and system deliveries are separate.

## After Hours

The mod ships as 0.7.5 for game 0.9.2. It records the evening's closing cast before the boundary save, using the saved cast when an ending is resumed. When the night opens it reads `relationshipTagOf` and fixes the sleepers for the whole night. The roll is seeded by date and character key. The evening-cast rate is 80% awake. Friend, Best Friend, BFF and Lover use 60% awake. Other contacts use 50% awake. The pure tests exercise repeatability, all three rates and cast precedence. The mod answers the hook only during its own night with both **The night** and **Not everyone stays up** enabled.

## Strings and pronouns

- Status and light label: “Idle”. A contact's existing location text stays in the header.
- Idle composer: “{Name} is away or asleep right now. {They} will reply later.”
- Held reply composer: “{Name} will reply to you when {they} {are/is} available.”
- Option: “Not everyone stays up”.
- Hint: “At night, some people have gone to sleep. Their light is yellow, and they reply in the morning.”

The composer uses `pronounsOf` for the idle and held placeholders. The core commitment and shared-class prompt lines use the contact's pronouns and the reader's chosen forms. After Hours uses the kit's contact pronouns in its sleeping, busy, night and morning-return prompts. Room enum keys are save and schema identifiers.

## Checks

| Check | Core | After Hours |
| --- | --- | --- |
| `npm ci` | 434 packages installed | Same unchanged lockfile and clean dependency tree |
| `npm run typecheck` | Pass | Pass |
| Kit API | `npm install`, `npm run report` and `npm run report:check` passed | `npm run report:check` passed |
| `npm test` | 2,914 passed, 1 failed, 4 skipped | 2,935 passed, 1 failed, 4 skipped |
| `npm run build` | Pass | Pass |

Both suite runs used the locally installed Electron binary and the archive helper. The failure was the known Linux `getComfyOutputFilePath` case in `test/mainServices.test.ts`. No archive-helper tests failed. The build used the sparse checkout without bundled character archives. The boundary allowlist gained zero rows.

The visibility and receipt checks were automated. A live model-backed night conversation and the light colors on a running phone were not reviewed.
