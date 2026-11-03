# Proposal: `invoke` handlers and routes for built-in mods

## Why

#227 gave mods `invoke` handlers, and mods already have routes under `vxmod://<id>/@/…` (`protocols`). Both are read only from a **loaded mod's `main.js`**: `requireCandidates` in `src/main/mods/loader.ts` builds the `invokes` and `routes` maps, and `ModInvocations.replace` and the served session take them from there.

A built-in mod has no `main.js`, so it can't use either. Photo Feature is the case in hand. Its desktop side still needs core-owned wiring that only Photo uses:
- `registerPhotoIpc(handle)` in `src/main/ipc.ts`, plus `src/preload/photoApi.ts` and `src/web/photoBridge.ts` for its seven `comfy:*` channels
- `playimg://` (`photoProtocol.ts`, installed in `src/main/index.ts`, privileged in `imageProtocols.ts`, allowed in `index.html`'s `img-src`)

With handlers and routes available to built-ins, all of that goes, and Photo's main side looks exactly as it will once Photo is installed instead of built in.

## Proposal

**One core-owned table of built-in mods' main entries, fed through the same checks as an installed `main.js`.**

- **Where:** `src/main/modEntries/<id>.ts`, beside the existing `src/shared/modEntries` and `src/renderer/modEntries`. Each exports what a `main.js` would: `{ invoke?, protocols? }`.
- **Listed in one place:** for example `src/main/modEntries/index.ts`, as `src/renderer/modEntries` is today. Only ids already in `MODS` are accepted.
- **The same validation:** the loader runs each built-in entry through the existing `invokesOf` and `routesOf`. Built-ins get the same name rules, no schemes of their own, no routes named twice, and the same `invoke` declaration check, read from the built-in mod's own `ModDef` rather than a manifest.
- **The same registries:** the results go into the same `invokes` and `routes` maps the loader already hands `ModInvocations.replace` and the served session. Nothing new on the window side: `invoke(modId, …)` and `vxmod://<id>/@/…` just work for the built-in id.
- **"Loaded" for a built-in:**
  - A built-in mod counts as loaded from start. On/off stays the handler's call, as #227 settled.
  - If its entry fails validation or throws on load, it's marked failed like an installed mod. Its handlers and routes are dropped, and the rest of the game runs.
- **No id clash:** an installed mod can't take a built-in's id, which already holds for `MODS`. And a built-in's table entry is never replaced by an installed `main.js`.

**What doesn't change:**
- Trust: built-ins are reviewed code in the repo, the same as today.
- The kit API: mods still export `invoke` and `protocols`, and nothing new is exported.
- Installed mods: their path is untouched.

## What it lets Photo remove

Once this is in `core` and `main`, Photo's own PR on `main`:
- moves its seven `comfy:*` channels to `invoke` handlers in `src/main/modEntries/photo-feature.ts`, and its window side to the kit's `invoke(...)`
- serves images from a route, `vxmod://photo-feature/@/photos/<pid>/<charId>/<file>`
- deletes `photoApi.ts`, `photoBridge.ts`, `photoProtocol.ts` and their lines in `ipc.ts`, `preload/index.ts`, `web/bridge.ts`, `index.ts`, `imageProtocols.ts` and `index.html`

Old saves need nothing: they store file names, not URLs. Bunnyfeeds or any other built-in could use the same table later.

## Size

- The table and its wiring into the loader
- Built-ins counted as loaded
- Tests: a built-in's handler is callable, its route served, a bad entry fails only that mod, and ownership checks hold (a handler only answers for its own id)
- MODDING: one paragraph for in-repo mod authors
- Kit API: none

## Questions

1. **Placement:** is `src/main/modEntries/` right, or would you rather built-ins ship a real `main.js` loaded from an in-repo folder through the existing path?
2. **The declaration check:** for built-ins, read `invoke` from the `ModDef`, or skip it, since the code is reviewed in-repo?
3. **Failure:** should a built-in whose main entry fails be switched off entirely, as an installed mod is, or keep its window side running without handlers?
