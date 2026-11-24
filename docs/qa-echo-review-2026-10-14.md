# Echo source review follow-up — October 14, 2026

## Review changes

- [Community audio #61](https://github.com/venus-extracurriculars/build/pull/61) adds one installer folder rule plus safe desktop/browser audio loading. #53 merges its branch and moves the three licensed tracks into assets/sound/community/reckoning/. Audio bytes, attribution and permission are unchanged; no per-track installer list remains.
- Echo 0.14.1 and Breaking Through the Silence 0.7.12 ship off by default. Their displayed versions no longer contain -local. Background question preparation is also off until explicitly enabled; glitch effects keep their existing default. Existing explicit saved switch choices still win.
- The Echo description, provider help and option hint disclose the first-use background-removal model download. Both desktop and browser initialization failures explain the roughly 100 MB download from staticimgly.com, connection/retry steps, preservation of previous artwork and absence of a paid image request.
- writeEcho and writeReckoningChange in the shared save loop now use normal statement/argument formatting without changing their persistence or ownership guards.
- scripts/syncPublic.mjs and test/syncPublic.test.ts match main. Community audio does not require changes to Venus Dev's private mirror tooling.

## Integration

Main fc7248047a8af03728ef41a928a2bbf6f256f7cf includes merged #58 → #60 and #57. #53 merges that main, retaining Echo artwork/Unheard Soul preflight alongside the soundtrack restore path. A maintainer then merged #61 into main at 05733525fc03a39cadfe3eb3b5a9642e90e1b849. Merging that result into #53 changed ancestry only: the complete tree was identical. All prerequisites are now in main; #53 remains a draft. No PR was merged by this agent.

## Validation

- All three typechecks pass. Full Windows suite: **2,591 passed, one existing skip, 221 files**. Feature-on fixtures now explicitly enable their mods. A lifecycle regression proves that enabling Reckoning alone makes no background request; enabling preparation then makes one request without spending spirit or writing a save.
- Desktop and browser production builds pass. All three MP3s are emitted in the browser build; desktop runtime accepts their new community paths. Track hashes match their prior committed bytes. Bundled music notices use the new paths.
- Eight installer tests pass, covering nested generic audio names, stock-asset protection, pre-existing file preservation and uninstall restoration. The independent #61 branch passes all typechecks, 2,125 tests (one skip, 166 files), both production builds and the same installer suite.
- An isolated headless Edge check rendered the actual EchoPanel with its real segmentation worker and a mocked image API boundary. External requests to staticimgly.com were blocked. Two attempts showed the actionable error, left the existing image unchanged, re-enabled generation and made zero paid requests. This checks the panel/browser failure path; desktop service regressions separately cover preparation failure and retry.

No installed game, private save or API key was accessed. This is source/build/component verification, not a clean-machine release installation, fresh Linux run or live narrative-quality test.
