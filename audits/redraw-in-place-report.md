# Photo Feature 1.9.0: a redraw replaces the picture in place

## Branch and scope

Repository: `naudh1r/venus-university`. Implementation branch: `mod/photo-1.9.0-redraw-in-place`, based on `mod/photo-feature-kit` at `d5056cf0971c118eb667502d1a1d370acd7bf6fb`.

Implementation commit: `ccfe27f813fb4f2b365e80e0ebaa31d0449dd8fd` — **Photo Feature 1.9.0: replace redrawn pictures in place**.

Both task commits use `Naudh1r <102735014+naudh1r@users.noreply.github.com>` as author and committer, without co-author trailers. Photo remains at unreleased 1.9.0. Changes are restricted to Photo source, Photo tests, its documentation and its MOD_FILES inventory. No core or kit changes, guide changes, rebase, force push, PR or organization writes.

Only the implementation branch is pushed. This report is committed locally on `notes/standalone-mods`, under `audits/`, to honor the instruction to push only the feature branch.

## Replacement and crash recovery

The renderer reserves a random throwaway name with `reserve-redraw`. The existing render and optional WebP encoding finish under that name. Main's `replace` operation requires that reservation and a readable, complete sidecar. It holds the destination as an in-flight photo until replacement settles. The saved `file` string never changes, including numbered names, legacy names and names whose physical PNG/WebP fallback differs from their extension.

`photoSwap.ts` serializes reads/recovery and writes for the same photo. The two files cannot be committed with one filesystem rename. The ordering is:

1. Read the original image formats and sidecar as bytes for rollback.
2. Atomically write a hidden, versioned `.redraw-<stem>.json` recovery journal. It names the temporary render, the destination image format, the SHA-256 digest of the new image, the new sidecar, and the old sidecar as base64 bytes.
3. Atomically write the whole replacement image under the original photo's stem, using the repository's `writeAtomicBytes` helper and its rename retry behavior.
4. Atomically write the matching sidecar under that stem.
5. Remove the other physical image format with `dropPhotoTwins`.
6. Remove the temporary image formats and sidecar, then remove the journal.

| Interruption | Files left and recovery |
|---|---|
| During temporary rendering or before the journal lands | Original image and sidecar remain. A restarted launch sweep removes the unreferenced temporary render. |
| Journal written, image not replaced | The original image does not match the new digest. Recovery restores the old sidecar and removes the temporary files and journal. |
| Image replaced, sidecar not replaced | The new image is whole. The journal supplies its matching new sidecar before any Photo image or info read is served. |
| Sidecar replaced, old image twin still present | Recovery keeps the matching new sidecar and removes the old format before serving the image. |
| Pair committed, cleanup interrupted | Recovery repeats temporary cleanup and removes the journal. |
| Failure or cancellation during replacement | Main restores original bytes. It restores existing old images before removing a newly introduced format, so a crash during rollback does not create a gap with neither image present. The journal reconciles the sidecar after a restart. |

Recovery runs before image/sidecar reads and during the sweep. Readers wait for a running swap. A refused or cancelled operation rolls back and the renderer drops the temporary name. A timed-out render cannot commit. Loading another game cancels unfinished redraws, and a stale run, changed record identity, disabled generation or superseding attempt is checked before replacement. The render timeout stops before the disk commit, preventing a late timeout from reporting a committed picture as failed.

The failure reason and old-orientation behavior remain. Temporary reservations persist across rendering and encoding until replacement/drop, so a background sweep cannot mistake them for orphans. `dropPhoto` remains conservative about saved references. The entire retirement watcher, replacement-drop option and retire tests are removed.

A redraw writes no message or post record and requests no save. New-photo arrival still writes its record and uses its existing save/recovery path. No redraw-only data was found solely in the save: prompts, seed, orientation, LoRA and duo method already live in the sidecar, and replacement keeps that sidecar with the image. Rebuild remains an inspection-only operation until a redraw lands.

## Screen refresh

`photoRevision.ts` holds one renderer revision per stable photo URL. After successful replacement, every subscribed view receives a new `?v=N` image address. The post, DM, gallery and already-open lightbox use that shared revision. The info dialog also subscribes and rereads metadata if the picture changes while it is open.

Photo's protocol resolves `URL.pathname`, so the query never becomes part of the disk filename. The running-app tests exercise actual protocol requests with revision queries. Orientation caching strips the query, retaining one orientation per photo identity. Requested orientation remains transient until success, and loaded image dimensions recover orientation after restarting.

## Orphan sweep and names

On game entry, Photo starts a background sweep. Main also starts one background pass per launch over every numeric playthrough folder, even when no game is loaded. Neither launch nor loading awaits the pass. Overlapping sweeps for one playthrough share work.

A sweep awaits `movePhotoFiles`, then reads every root JSON checkpoint/record and every replay before removing anything. Any unreadable save or replay aborts deletion. It enumerates only Photo's current and legacy per-character folders and only accepted PNG, WebP and sidecar names. It keeps files named by any save/replay, reserved names and in-flight renders, protecting both formats and the sidecar together. Links and folders reached through links are excluded. Physical WebP twins of old PNG-only legacy identities remain recognizable. Unrelated files and the native camera roll are untouched. The sweep counts actual removed files and logs one summary line per successful playthrough pass.

New names are exactly ten lowercase letters/digits, drawn from `crypto.randomBytes`. Bytes above 251 are rejected to keep the 36-character alphabet unbiased. Disk images, sidecars, current save names, other checkpoint/replay names and live reservations all protect the same stem. A clash draws again, including simultaneous reservations. `kind`, `PhotoKind`, `isPhotoKind`, `photoSlug`, `photoFileName`, `nextPhotoIndex` and `photoIndexOf` have no remaining consumer and are removed. No consumer decoded a kind from a filename. The numbered and legacy patterns remain accepted everywhere, alongside the fixed-length random pattern.

A core save-deleted hook would allow immediate cleanup after deleting a picture's last save. That would be a useful follow-up. It was not added because this task is Photo-only. The launch sweep covers deleted-save leftovers without that hook.

## Checks

| Check | Result |
|---|---|
| `npm run typecheck` | Passed node, web and test TypeScript projects. |
| `npm test` | 3,364 passed, four skipped, one failed, 3,369 total. File totals: 241 passed, three skipped, one failed, 245 total. The sole failure is the permitted Linux `getComfyOutputFilePath` path-refusal assertion in `test/mainServices.test.ts`. |
| Focused Photo/file/boundary tests | 75 passed across four files, including successful replacement, failed/cancelled/timed-out/overtaken renders, byte-preserving rollback, crash recovery, image twins, random clashes, migration ordering, unreadable records and orphan protection. |
| Final focused redraw and boundary rerun | 55 passed across two files before the final versioned-journal rerun above. |
| `npm run build` | Passed main, preload and renderer builds. |
| `npm run build:web` | Passed. |
| `xvfb-run -a npm run test:electron` | 42 checks passed across six scenarios, with both requested content settings enabled. |
| `xvfb-run -a node test/e2e/photoRedraw.e2e.mjs` | 15 checks passed on the final build. DM/post/gallery/lightbox refresh, updated info, one image plus one sidecar per photo, unchanged saved records, older record restoration, stray cleanup, restart without a new save, and deleted-save cleanup while retaining another save's photo. |
| Direct boundary scan | Zero mod-import rows and zero game-import rows. No allowlist edits. |
| `git diff --check` | Passed. |

An earlier full run overlapped expensive asset builds and timed out the existing relationship property test. That test passed on an isolated rerun, and the subsequent full suite has only the permitted Linux failure. Dependency installation initially left Electron absent and the archive helper non-executable. After repairing those environment issues, the unrelated failures disappeared.

## Test method and limits

The Photo app test launches Electron with the real Photo components, stores, IPC, image protocol, replacement and sweep services. Only `renderPhoto` is replaced by a Vite test plugin that writes simple colored PNGs and sidecars in an isolated temporary playthrough. No ComfyUI service or billable API is used. Both `noNsfwImages` and `lessNsfwText` are enabled.

The focused app harness mounts the real DM, post, gallery and lightbox components. It restores older photo records directly and deletes the only naming save file on disk before restarting. **Not exercised:** navigating the native Load Game or Delete Save buttons with a complete gameplay save. Those core flows are unchanged. This distinction is explicit rather than claiming full gameplay UI automation.

The Electron mod smoke suite runs via `xvfb-run -a npm run test:electron`, with a temporary Node preloader setting both content flags in its isolated settings files and adding `--no-sandbox` for the container. No core test file is edited. Xvfb was extracted into `/tmp`, Electron installed with the configured proxy, and the checkout's archive helper executable permission repaired. These environment repairs are outside the task commits.

Persistent filesystem failures that also prevent rollback or journal recovery cannot be repaired while the disk refuses writes. The journal is retained on an unsuccessful rollback so later reads can reconcile the files, and the failure remains visible.
