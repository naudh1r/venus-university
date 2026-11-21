# Kit 0.8.3 and Photo Feature 1.9.0: option requirements

## Commits and scope

Repository: `naudh1r/venus-university`. All commits use author and committer `Naudh1r <102735014+naudh1r@users.noreply.github.com>`, without co-author trailers. Default signing was used as requested.

- `hooks/option-requires` starts at `fork/naudh1r-core`, `e127302a`.
- Kit implementation: `cbc481aea0a9b6e25304fbc376465c3e8511e652`, **Kit 0.8.3: let an option require another option without changing stored choices**.
- `mod/photo-1.9.0-requires` starts at `fork/mod/photo-feature-kit`, `14171b33`.
- Merge of the kit branch: `4151e421bf911c84038c451ce70dd43df2883c63`, **Photo Feature 1.9.0: merge kit 0.8.3 option requirements**.
- Photo implementation: `776ded3b0a3383291fa16517111610ee22b68588`, **Photo Feature 1.9.0: require duo for ppm and choose its method on Rebuild**.

Only these named implementation branches and `notes/standalone-mods` are push destinations. This report is committed only on `notes/standalone-mods`. Its existing local report commit is retained. No rebase, force push, PR or organization write is involved. Photo stays at 1.9.0. README.md, DESIGN_GUIDE.md, UI_STYLE_GUIDE.md and TESTING_PLAN.md are unchanged. No screenshots are added to any commit in this task.

## Dependency rule and validation

`ModOption.requires` names another option in the same mod. Shared `optionOn` follows the required option chain and checks each option's stored value or default. Main and renderer readers delegate to that shared rule. Turning a requirement off never writes the dependent's stored value. Both saved true and saved false survive an off/on cycle.

**Resolved brief correction:** the user explicitly clarified that the mod-off line was a mistake. The mod switch and option switches remain independent. A requirement depends only on the required option, including when the mod itself is off.

`packages/modkit/src/shared/optionRules.ts` supplies one validator to the built-in ModDef registration and installed-mod manifest parser. It rejects a missing target, self-reference, a grouped dependent, a grouped target, and cycles, with reasons. It also rejects a non-string requirement in manifests. Chains of ungrouped options are supported. Group combinations are rejected rather than assigning dependency semantics to radio choices. Runtime reads fail closed for missing targets and cycles.

Kit version, lockfile, shared version constant, changelog, MODDING.md and the shared API report are updated to 0.8.3. This adds a field, not a hook, so the hook since table needs no new row.

## Mods screen

The dependent switch uses the existing native disabled state and existing disabled opacity of 0.45. Its checked state comes from the effective reader. Native disabled prevents activation and keyboard focus. Its optionControls component is not mounted while its requirement is unmet.

Wording drafts compared the existing screen's short notes with “Requires {label}.”, “Turn on {label} first.” and “Needs {label}.”. The last was selected because it names the dependency directly, uses the screen's existing “needs” vocabulary and does not imply that the saved choice was discarded. The note appears under the hint only while blocked. Photo displays **Needs Two in one photo (experimental).** using the actual required label. New player-facing additions contain no semicolons. No tests assert note text, labels, CSS or layout.

## Photo method and prompt preservation

The ppm option now has `requires: 'duo'`. Audited the shared photoSwitches binding, main entry binding, renderer photoSwitchHooks, main photoPpmState/ppmInUse, and useExpectedPhotoOrientation. Their bindings already use the kit's effective option reader. photoPpmState returns off before pack probing while the effective ppm option is off. The dependency therefore reaches both processes without separate switch rules.

For a photo of two, explicit `photoInfo(..., rebuild = true)` chooses ppm when ppmInUse is yes or try and area when it is no. It retains the saved seed and requested or saved orientation. Without Rebuild, recorded prompts and method return unchanged, even with a different requested orientation. Inspection does not rewrite the sidecar.

PhotoInfo stores the rebuilt response in info. Its redraw passes the fields plus `info.couple ?? 'area'`, making an area choice explicit even when the saved photo used ppm. The orientation button now uses that same redraw path with the new orientation. It no longer calls Rebuild internally, so manually edited positive, negative, left and right fields survive an orientation change. The existing render/save path records ppm as couple: ppm and area by omission. Existing unmanaged-ComfyUI try behavior and COMFY_NODES_MISSING fallback remain covered by the Photo suites.

## Checks

| Check | hooks/option-requires | mod/photo-1.9.0-requires |
|---|---|---|
| npm run typecheck | PASS | PASS |
| npm test | 2,726 passed, 4 skipped, 1 permitted failure | 3,347 passed, 4 skipped, 1 permitted failure |
| Test files | 219 passed, 3 skipped, 1 failed | 240 passed, 3 skipped, 1 failed |
| Focused suites | 72 passed in 5 files | 570 passed in 17 files |
| npm run build | PASS | PASS |
| npm run build:web | PASS | PASS |
| Kit report:check | PASS | PASS |
| npm run test:electron under xvfb-run | PASS, 42 checks across 6 scenarios | PASS, 42 checks across 6 scenarios |
| git diff --check | PASS | PASS |

The sole full-suite failure on each branch is the permitted Linux `getComfyOutputFilePath` case in test/mainServices.test.ts, “refuses every name that lands anywhere else, and refuses it permanently”. It was also confirmed on the untouched base during the preceding work. No other tests failed.

The Electron runner used noNsfwImages and lessNsfwText both true. Its temporary settings-source changes were restored before committing. Electron used a temporary no-sandbox launcher and user-local Xvfb/config/cache directories. The kit API report was regenerated and checked. Full Photo testing includes the existing import-boundary suites. No allowlist entries were added.

Reader tests cover dependency chains, default values, stored true and false preservation, mod-switch independence, main persistence and renderer reads. Manifest tests cover every refusal above. Photo tests cover installed and unmanaged ppm, missing and invalid pack states, ppm/duo off, migrating saved area to ppm on Rebuild, migrating saved ppm to area when unavailable, and retaining edited prompts and saved methods without Rebuild across both orientations.

## Running-app inspection and screenshots

The built Electron app used its real Mods screen, settings persistence, Photo handlers and missing-pack state. No ComfyUI installation or image generation was performed. Both safe settings were true. The captures and observations are outside the repository at `/workspace/scratch/option-requires/`:

- `ppm-on-before.jpg`: duo on, ppm on, control visible.
- `duo-off-ppm-disabled.jpg`: duo off, ppm effectively off and disabled, opacity 0.45, controls count zero. Stored ppm remains true. Main ppm state is off.
- `duo-on-ppm-restored.jpg`: duo back on, ppm on and enabled, opacity 1, control visible again. Stored ppm remains true. Main ppm state is missing because no pack is installed.
- `observations.json`: saved switches, effective state and control observations for all three stages.

Both requested screenshots were visually inspected and are supplied in the reply. They are native Electron captures, 1919 by 1079 pixels, and are not committed. Runtime verification establishes the dependency behavior and control restoration. Rendering behavior is verified through service and pure-function tests, not a live ComfyUI run.

## Remaining uncertainty

None in the requested dependency semantics after the user's explicit correction. The permitted platform-specific path failure remains. Live ComfyUI output was outside this dependency/UI check.
