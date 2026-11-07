# Standalone test: Photo Feature, Bunnyfeeds and Emoji Extended as installed mods on `core`

I built three of my mods as installed releases and ran them on a plain `core` build, to see whether "kit-only" holds outside the repo before anyone builds `vxmod build` or the installer. Short version: it holds, the loader did its job, and the test turned up a few things the build tool will need to handle.

## Verdict

**Kit-only works:** three mods run as installed releases on plain `core`, with no game code in their bundles. **What's missing before mods can ship as installs is tooling, not the kit:**
- a `vxmod build` that generates `vxmod.json`, the `hooks` list above all, from the code
- the installer that writes `installed.json`

Without the build tool, every author writes the hooks list by hand, and a missing name only shows when that feature is first used.

## What I did

- **Base:** `core` + #281 (`addMemory`'s `replacingUnmarked`, which Bunnyfeeds needs). No mods built in.
- **Mods:** Emoji Extended 1.0.0, Bunnyfeeds 1.1.4 (#284's branch), Photo Feature 1.7.1 (#283's branch).
- **Build:** a throwaway esbuild script standing in for `vxmod build`:
  - `renderer.js`: one ES module, with `react`, `react/jsx-runtime`, `react-dom`, `motion/react` and the kit left external, as `MODDING.md` describes
  - `style.css`, from the CSS the mod imports
  - `main.js` (Photo only): one CommonJS file, the main entry's `{ invoke, protocols }` as `module.exports`
  - `vxmod.json`, generated from the mod's `ModDef`
- **Install:** each unzipped into `data/mods/<id>/<version>/`, with a hand-written `installed.json` approving Photo's `main.js` in place of the installer.

## Results

| Mod | Game files in the bundle | Result |
|---|---|---|
| Emoji Extended | none | ✅ runs |
| Bunnyfeeds | none | ✅ runs |
| Photo Feature | only `EchoPanel` (its one allowlist row, waiting on Echo's own tab), stubbed for the test | ✅ runs; `main.js` requires only the kit, `electron` and Node's own modules |

Checked in game: DM photos with early render, feed photos solo and duo, comments and replies, emoji in DMs and comments, memory announcements on and off, backup export and import, older saves, and Photo's body field. Older saves' feed memories are replaced through `replacingUnmarked`, one per girl, with her other memories untouched.

The allowlist told the truth: what it said was left is exactly what kept the bundles from being self-contained.

## What it found

1. **A dependency the allowlist can't see: core calling a mod.** Photo's options were handed to it by the game (`setPhotoSwitches(photoSwitchesOf(…))` in `modsStore.ts` and `modsService.ts`). On `core` nothing did, so every option stayed at its default; the body field never showed. Fixed in #283 (d32132cd): Photo reads them with `sharedModOn` and each side's `modOptionOn`. The scan only looks at mods importing the game, so this direction only showed up when installed. Echo's `setEchoBonusEnabled`, in the same function, is the same pattern.
2. **The manifest's `hooks` list is the hard part.** The loader refuses a mod that registers or uses something its manifest doesn't declare, which is right, but it took several rounds to get the lists complete:
   - Bunnyfeeds was missing 5 prompt hooks (`prompts.scene`, `prompts.dm`, …).
   - Photo was missing 9 hooks plus 18 main-side kit names.

   The main-side ones are checked when they're first used, not at start: Photo started fine and then failed on backup import (`shared:SAFE_NUMERIC_ID is not declared`). In-repo `ModDef.hooks` was never complete, since the built-in path doesn't enforce it, so `vxmod build` needs to derive the list from the code, renderer and main both, rather than trust `ModDef.hooks`.
3. **`source` is required** in `vxmod.json` and has no counterpart in `ModDef`. The first start refused Emoji Extended for it.
4. **The manifest repeats the `ModDef`:** name, version, blurb, options, `offNote`. Generating one from the other keeps them in step.
5. **Small:** `sharedModOn`'s doc comment says main has no binding, but `modsService.ts` binds it, and Photo's fix relies on that.

## Try it

The three releases I tested are in [`releases/`](releases), with an `installed.json` standing in for the installer. They're test builds only:
- Photo's `EchoPanel` is stubbed out, since Echo isn't on `core`.
- `installed.json` approves Photo's `main.js` by hand. Without it, Photo needs `allowUnreviewedMain: true` in `settings.json`.
- Bunnyfeeds needs #281 (`replacingUnmarked`), so until #281 is in `core`, use `core` with #281 merged in.

In PowerShell, from a checkout of `core` with #281 (this folder's zips downloaded into `$z`):

```powershell
npm install
npm --prefix packages/modkit install
# if `npm run dev` says "Electron uninstall": node node_modules\electron\install.js

$z = "$HOME\Downloads"
New-Item -ItemType Directory -Force data\mods | Out-Null
Expand-Archive "$z\emoji-extended-1.0.0.zip" data\mods\emoji-extended\1.0.0 -Force
Expand-Archive "$z\bunnyfeeds-1.1.4.zip"     data\mods\bunnyfeeds\1.1.4 -Force
Expand-Archive "$z\photo-feature-1.7.1.zip"  data\mods\photo-feature\1.7.1 -Force
Copy-Item "$z\installed.json" data\mods\installed.json

npm run dev
```

Then switch the three on under **Mods**. Copy `settings.json` from another checkout first if you want your AI key and ComfyUI setup.

## Suggestions

- **`vxmod build`:** generate `vxmod.json` from the `ModDef`, derive `hooks` from what the bundles actually use, and refuse to build when a game file ends up in the bundle. The throwaway script does most of that: [`vxbuild.mjs`](vxbuild.mjs), if it's a useful start.
- **The installer:** `unpack.ts` already does the safe unpack; what's missing is writing `installed.json` (hash, source, approval).
- **A reverse check:** a test that no game file imports a mod's file, to catch case 1 before it ships.

The build here was only a test build to see whether the mods hold up, not a proposal for how `vxmod build` should work. If you have other ideas for any of this, go with them; happy to help either way. Feel free to use these three mods to experiment with, for `vxmod build`, the installer or anything else.
