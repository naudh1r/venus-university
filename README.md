# Standalone test: Photo Feature, Bunnyfeeds and Emoji Extended as installed mods on `core`

I built three of my mods as installed releases and ran them on a plain `core` build, to see whether "kit-only" holds outside the repo before anyone builds `vxmod build` or the installer. Short version: it holds, the loader did its job, and the test turned up a few things the build tool will need to handle.

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

## Suggestions

- **`vxmod build`:** generate `vxmod.json` from the `ModDef`, derive `hooks` from what the bundles actually use, and refuse to build when a game file ends up in the bundle. The throwaway script does most of that: [`vxbuild.mjs`](vxbuild.mjs), if it's a useful start.
- **The installer:** `unpack.ts` already does the safe unpack; what's missing is writing `installed.json` (hash, source, approval).
- **A reverse check:** a test that no game file imports a mod's file, to catch case 1 before it ships.

Happy to help with any of these.
