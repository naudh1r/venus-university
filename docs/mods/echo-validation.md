# Echo validation — 2026-10-14

## Current source review follow-up

After refreshing #53 from main fc72480: **2,591 passing tests, one existing skip across 221 files**, all three typechecks, eight installer tests, and desktop/browser production builds pass. Echo and Breaking Through the Silence default off; background preparation requires separate opt-in. The actual panel/worker blocked-download check confirms a visible retryable error, unchanged previous artwork and zero paid image requests. Three unchanged music files now use the generic community folder from #61. See [review QA](../qa-echo-review-2026-10-14.md) for scope and evidence.

## Earlier first-pass combined checkout (historical)

The Echo integration branch was merged with main at 494fb91aa72d504e83d8e31a2d4851239fe5fc26 before the current changes were applied. This includes Incoming Texts and the merged Story Memory Light option. The local experiment checkout was not published wholesale.

- All three TypeScript checks passed (node, web/renderer and tests).
- Full Windows Vitest suite: **2,426 passed, one existing skip, 187 files** with two workers.
- Installer suite: **8 passed**, with all three community music files in the build/test allowlists.
- Desktop and browser production builds passed. Both include all 22 dungeon backgrounds. The browser emits all three MP3s; desktop release packaging supplies them as external assets through the installer allowlist.
- Source regression coverage includes link/entry gates, private Talk limits, aspect hints, first-person whisper filtering and safe placement, rewind/save guards, Unheard Soul character/backup transfers, and soundtrack preview restoration/title toggling.

These checks used an isolated source checkout without the official character ZIPs. They are not a fresh end-to-end installation run or a new live judgment test. No paid model requests were made for this publication update. Earlier local visual/install checks remain historical evidence; the current changes still need broader playtesting and release-machine verification.

## DOTS QA follow-up

All five reported findings have source fixes and targeted verification:

- Early cancellation: register desktop Echo/Unheard Soul and browser Echo jobs before awaiting settings; check cancellation again before the provider and before publishing artwork. Regressions cover pending settings, ownership, overlapping jobs, preparation cancellation and retry after failure.
- Semester cutoff: refuse a new link and unused background preparation when no playable night remains after the scene. The last daytime scene and already-linked final-night entry remain valid.
- Exit checkpoint: retain the paid link's head-pain dialogue and unread-line position when quitting/switching saves; a failed save keeps the old checkpoint and full spirit.
- Bundled notices: static in-game text dialogs replace blocked file links. An isolated offline Chromium/Edge fixture verified exact bundled contents, day/night themes, no popup, focus restoration, and Escape closing only the notice. This is a component UI check, not an installed-game launch; desktop navigation restrictions are unchanged.
- Accumulated artwork: desktop and browser tests export/restore 4,097 finished images. The separate 4,096-image rejection is removed; IDs, duplicate/collision protection, PNG limits and whole-archive import bounds remain. No artwork is automatically deleted.

The supplied Linux run had one existing failure at `test/mainServices.test.ts:177`: its Windows absolute-path spelling is interpreted differently by native `node:path.resolve` on Linux. The test and implementation are unchanged between community `main` at `494fb91` and the reviewed PR head `9a9f3ab`. This establishes a **Venus Extracurriculars main-branch baseline**, not a verified defect on Venus Dev's current upstream branch. This follow-up was tested on Windows and does not claim a new green Linux run.

## Earlier portability checks

Before the dungeon update, local segmentation ran without ComfyUI; a browser smoke check covered Echo upload/read/download/reload; desktop/browser backup tests covered immutable image IDs and old backups. A packaged copy launched with its native bridge and separate asset notices. Those results do not claim browser parity for the newer desktop-only Unheard Soul editor/portable extension.

## Small live-model check

This was explicitly capped and used **11 text requests and one image request**, with
fictional adult profiles only. No personal save histories or character records were sent.

Text model: `gemini-3.6-flash`.

| Fictional profile | Opening | Supportive answer | Hostile answer / instruction injection |
| --- | --- | --- | --- |
| Independent student wary of being controlled | Valid three thoughts grounded in supplied history | Accepted | Rejected |
| Musician worried that mistakes cost acceptance | Valid three thoughts grounded in supplied history | Accepted | Rejected |
| Overworked organizer afraid to set limits | Valid three thoughts grounded in supplied history | Accepted | Rejected |

The first profile completed all three rounds and earned a valid, individualized growth
tag with three reframes. Reactions retained boundaries and did not assert a permanent
cure. Opening requests took roughly 3.3–3.6 seconds; answer judgments took roughly
1.4–2.9 seconds in this sample. Prepared openings still depend on the actual provider,
network and context size. Some feedback remained more formal than everyday dialogue.

Image model: `gemini-3.1-flash-image`. One original fantasy creature was generated,
segmented locally, read through the native API and exported as a transparent PNG.
Visual inspection found a coherent creature with retained light/dark details and no
caption text. This single result does not guarantee future image quality.


## Remaining release checks and limits

The bounded live sample above predates the newer dungeon Talk/one-time hint flow. It does not certify their tone, model consistency or ability balance. Broader profiles/providers and a fresh clean-machine installer pass remain release checks.

First cutout needs roughly 100 MB of downloadable model/runtime data. Optional local Megaten generation needs ComfyUI, compatible hardware and separate original-host model downloads. Download bounds/hash checks/reuse/cancellation are covered; a new multi-gigabyte download was not repeated. Browser custom image endpoints need compatible CORS.

Ordinary Echo artwork works on desktop and browser and travels in whole-game backups. Loose save JSON does not embed images or recovery originals; there is no separate single-playthrough exporter. Custom Unheard Soul images/staging and their optional portable character extension currently use desktop IPC. The browser uses the inverted normal portrait, and does not promise round-tripping that new extension.

See [Echoes](echo.md), [Breaking Through the Silence](reckoning.md) and [asset notices](echo-asset-licenses.md).
