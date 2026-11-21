# Photo Feature 1.9.0: wide photo layout

## Branches and scope

- Fork: `https://github.com/naudh1r/venus-university.git`.
- Implementation branch: `mod/photo-1.9.0-layout`, based on `fork/mod/photo-feature-kit` at `f620f9ea57de7642ece583d63d305ea2bc50d040`.
- Implementation commit: `cb6cfd0455a41f41aac0cccd3653734f31dce5a2` ([commit](https://github.com/naudh1r/venus-university/commit/cb6cfd0455a41f41aac0cccd3653734f31dce5a2)).
- Author: `Naudh1r <102735014+naudh1r@users.noreply.github.com>`; no co-author lines.
- Photo remains 1.9.0. Only Photo-owned renderer files, its documentation/captures, and its `MOD_FILES` entry change. Shared Lightbox, its CSS, core, kit, the four protected guides/files and version declarations are unchanged. No PR was created.
- This report is committed separately, only as `audits/photo-1.9.0-layout-report.md` on `notes/standalone-mods`.
- **Instruction choice:** “Push only that branch” is applied literally: only the implementation branch is pushed. The notes branch/report commit is local, available in the separate notes worktree.

## Requested changes

1. **Post and DM size — updated by the follow-up request.** Wide photos keep the current portrait height rather than using twice the width. In `src/renderer/vu_styles/PhotoBubble.css`, a post uses the height of a 330px-wide 832×1216 portrait (about 482.31 stage pixels); a DM uses the height of its 280px-wide portrait (about 409.23). The resulting 1216×832 wide widths are about 704.91 and 598.11, bounded by the card/thread. Both dimensions shrink together if available width is smaller. Portrait sizing is unchanged. `photoOrientation.ts` shares dimensions learned from image loads across Photo's views; a requested redraw shape is available before the next image loads. The DM's wide bubble is allowed past the native text bubble's 440px cap, within its thread.
2. **Full view.** `PhotoLightboxHost` in `src/renderer/components/PhotoBubble.tsx` wraps the existing Lightbox with Photo classes and learns an uncached image's orientation on load capture. Photo's CSS raises only the wide image's cap from 760px to `min(1520px, 100%)`. Existing height constraints and intrinsic aspect ratio apply. A 1216px source can display at its natural width; the 1520px cap does not force upscaling. Portraits use the existing shared rules. Neither `Lightbox.tsx` nor `Lightbox.css` changes.
3. **Gallery.** `src/renderer/views/ContactGallery.tsx` and `src/renderer/vu_styles/ContactGallery.css` use a named orientation, without the old `wide` React state or `vu-contact-shot-img--wide`. Portraits remain whole in 2:3 cells. Wide items span two columns at the same row height and use centred cover cropping. Dense flow backfills the last-column slot. A Photo-owned container immediately around the grid supplies the actual content width, excluding scrollbar space. Container queries reduce the grid to two columns and then one, with wide spans capped by the column count. Gallery clicks open the whole source through Photo's viewer. The artificial covered tile remains covered under `noNsfwImages`; FEED/DM source labels, filters and the one-photo-per-file count remain present.
4. **Waiting and failure frames.** `src/renderer/stores/photoRedraw.ts` adds an orientation to a redraw's transient state, synchronously with reserving the attempt. Both switches therefore change the frame immediately, before name reservation/render completion. Successful replacements seed the orientation cache before the saved attachment changes. Failure retains the old image and its old cached dimensions. `PhotoBubble.tsx` and `ContactGallery.tsx` use that state for frame shape and the same size rules as the final image. Named first-draw and failed photos retain a gallery tile and source label. First duos use wide once `ppmState` says installed. Plain redraws from the info panel already supply the current recorded orientation.

`docs/mods/photo-feature.md` adds player-facing 1.9.0 bullets and describes the renderer behaviour. `test/kit/modFiles.ts` adds Photo's new `photoOrientation.ts` module to Photo's existing entry. No layout/CSS tests were added.

## Validation

| Check | Result |
|---|---|
| `npm run typecheck` | PASS: node, web and test projects |
| `npm test` | 3,316 passed, 4 skipped, 1 permitted Linux failure; 240 test files passed, 3 skipped, 1 failed |
| Sole failing test | `test/mainServices.test.ts`, `getComfyOutputFilePath > refuses every name that lands anywhere else, and refuses it permanently` |
| Focused existing boundary/redraw suites | PASS: 23 tests in 2 files |
| Direct import-boundary scan | 0 mod-to-core rows; 0 core-to-mod rows; no allowlist additions |
| `npm run build` | PASS |
| `npm run build:web` | PASS |
| `npm run test:electron` under `xvfb-run` | PASS: 42 checks, 0 failures, all 6 scenarios |
| `git diff --check` | PASS |

The Electron runner used temporary settings with both `noNsfwImages: true` and `lessNsfwText: true`; its source was restored afterwards and is absent from the implementation diff. The runner required a temporary wrapper adding `--no-sandbox`, writable XDG config/cache directories, and a user-local Xvfb extracted under `/tmp`. Electron's release binary was downloaded with curl and verified against the release SHA-256 list because the Node installer could not fetch through this environment. The bundled `7za` needed its execute bit restored in `node_modules`. Initial attempts before these environment repairs are not the final check results above.

## Screenshots and visual inspection

Captures are in the implementation commit under `docs/mods/photo-1.9.0-layout/`. They use Electron's native `BrowserWindow.capturePage()` to avoid Playwright's incorrect capture bounds after Electron stage zoom. `usual-*` is the ordinary 1920×1080 window (native captures in this Xvfb session are 1919×1079); `narrow-*` is 1280×960. These are running Electron app captures, with safe synthetic 1216×832 and 832×1216 pictures and the real feed, thread, contact gallery, info-panel controls and Lightbox.

The fixture used a temporary copy of the older Quickstart save and a character unpacked from this checkout. A temporary IPC wrapper held and completed synthetic generation requests, answered installed for the ppm probe, and disabled fixture-file deletion so repeated scenarios could reuse their images. It exercised the real redraw and switch controls without ComfyUI or a model call. None of that fixture, mock or harness is shipped. No changes were made to a player's data.

For each `usual` and `narrow` prefix:

| Subject | Filename suffixes (`.jpg`) |
|---|---|
| Feed sizes | `feed-wide`, `feed-portrait` |
| Whole pictures in full view | `full-wide`, `full-portrait`, `gallery-full-wide` |
| Mixed gallery, dense backfill, covered tile | `gallery`, `gallery-wide-row` |
| Same wide photo waiting and finished | `feed-wide-wait`, `feed-wide-landed`, `gallery-wide-wait`, `gallery-wide-landed` |
| Switch starts and failure restoration | `switch-to-wide-feed`, `switch-to-wide-gallery`, `switch-to-portrait-feed`, `switch-to-portrait-gallery`, `switch-failed-old-portrait`, `switch-failed-old-wide` |
| First duo and failed frames | `first-duo-feed-wait`, `first-duo-gallery-wait`, `first-duo-feed-failed`, `first-duo-gallery-failed` |
| Night theme | `night-feed`, `night-gallery` |
| DM sizes and matching wait/arrival | `dm-wide`, `dm-portrait`, `dm-wide-wait`, `dm-wide-landed` |
| DM switches and failed restoration | `dm-switch-to-wide`, `dm-switch-to-portrait`, `dm-failed-old-portrait`, `dm-failed-old-wide` |

Supplemental `constrained-gallery-360.jpg` and `constrained-gallery-200.jpg` temporarily constrain the real gallery's scroll container to inspect the two-column and one-column fallbacks. `measurements.json` records observations from the ordinary feed, full view and grid; these are capture notes, not automated layout tests. The grid screenshot starts with three portraits followed by a wide item; the covered portrait backfills the fourth column, while the wide item starts on the next row. Scrolling the grid also shows the DM label.

Visually inspected the ordinary and narrow frames, wide/portrait post and DM images, both full-view orientations, mixed gallery and backfill, waiting/landed pairs, switch frames, failure restoration, first-draw/failed frames, night colours and constrained grids. All 64 JPEG captures are committed, totalling 7,456,421 bytes; the largest is 160,868 bytes.

Observed feed widths were 704.90 and 329.99 stage pixels at both window sizes. For the 1216×832 wide photo, that gives the portrait's 482.3px height. DMs measured 598.10×409.22 for wide and 279.99×409.21 for portrait, with only subpixel rounding between the heights; the narrow window has the same stage-unit dimensions. Ordinary gallery columns are about 229.8px and rows 344.7px, exactly 2:3 within rounding. Narrow gallery columns are about 162.42px with 243.63px rows. Wide tiles occupy two such columns plus the gap and share the row height. The constrained 200px container produces one column, with wide items fitting that column.

[All captures at the implementation commit](https://github.com/naudh1r/venus-university/tree/cb6cfd0455a41f41aac0cccd3653734f31dce5a2/docs/mods/photo-1.9.0-layout). Representative files:

- [Post, wide](https://github.com/naudh1r/venus-university/blob/cb6cfd0455a41f41aac0cccd3653734f31dce5a2/docs/mods/photo-1.9.0-layout/usual-feed-wide.jpg)
- [DM, wide](https://github.com/naudh1r/venus-university/blob/cb6cfd0455a41f41aac0cccd3653734f31dce5a2/docs/mods/photo-1.9.0-layout/usual-dm-wide.jpg)
- [Narrow mixed gallery](https://github.com/naudh1r/venus-university/blob/cb6cfd0455a41f41aac0cccd3653734f31dce5a2/docs/mods/photo-1.9.0-layout/narrow-gallery.jpg)
- [Post waiting frame](https://github.com/naudh1r/venus-university/blob/cb6cfd0455a41f41aac0cccd3653734f31dce5a2/docs/mods/photo-1.9.0-layout/usual-feed-wide-wait.jpg)
- [Gallery waiting frame](https://github.com/naudh1r/venus-university/blob/cb6cfd0455a41f41aac0cccd3653734f31dce5a2/docs/mods/photo-1.9.0-layout/usual-gallery-wide-wait.jpg)
- [One-column fallback](https://github.com/naudh1r/venus-university/blob/cb6cfd0455a41f41aac0cccd3653734f31dce5a2/docs/mods/photo-1.9.0-layout/constrained-gallery-200.jpg)

## Choices and limits

- **Unknown first orientation:** an unmanaged ComfyUI may try ppm and fall back to portrait. Its frame remains portrait until image dimensions are known. A ppm probe which is still pending or fails also leaves portrait. Installed ppm is queried when the frame mounts and can then update it to wide. This cannot predict a server changing its node installation after the probe.
- **Gallery count:** pending/failed named attachments now keep their tiles and count alongside landed photos; held feed posts remain excluded by the existing `postIsOut` rule. Repeated attachment references still deduplicate by file.
- **Available width:** keeping the portrait height is the target, subject to preserving the image ratio and fitting the post/thread. The gallery's deliberate centre crop does not affect the full-size source.
- **Generation:** this verifies layout and redraw transitions with synthetic images, not the quality or availability of a real ComfyUI render.
