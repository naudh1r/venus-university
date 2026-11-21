# naudh1r's mods for Venus University

Installable releases of Photo Feature, Bunnyfeeds, Emoji Extended and After Hours, and the
catalogue the game's mods browser reads them from. They run on `naudh1r-core`.

| Mod | Release | What it does |
|---|---|---|
| Photo Feature | 1.8.0 | Characters send photos in their DMs and post them on their feeds, drawn by ComfyUI |
| Bunnyfeeds | 1.1.7 | Comments under their posts, and replies to yours |
| Emoji Extended | 1.0.0 | Every emoji on the phone, and big emoji in texts |
| After Hours | 0.7.0 | A Busy status, and a night in your room to text before you sleep |

## Installing

On `naudh1r-core`, open **Mods → Browse**. Each mod has a page with its description, what it
needs and its changelog.

1. **Install** downloads the mod's release and checks it against the hash in the catalogue. A
   file that doesn't match is refused, and nothing is written.
2. Photo Feature asks first, since part of it runs outside the game window.
3. Restart, then switch the mod on under **Installed**.

When a newer release is listed, its page shows **Update**. The version you had stays on disk.

## The modkit

A mod reaches the game only through `@vx/modkit`, the kit the game carries: readers for the
game's state, hooks into its prompts and screens, writes to the save, and its own slice of every
record. No game file is in a mod's release, so a mod keeps working while the game's own code
changes underneath it, as long as the kit still has what it uses.

An installed mod lives in `data/mods/<id>/<version>/`:

| File | What it is |
|---|---|
| `vxmod.json` | The manifest: id, name, version, the kit it needs, and every hook and kit function it uses |
| `renderer.js` | The mod's code in the game window |
| `style.css` | Its styles, where it has any |
| `main.js` | Its code outside the window, where it has any (Photo Feature does) |

The game refuses a mod whose manifest leaves out something it uses, or that needs a kit the game
doesn't have. `data/mods/installed.json` records each install: where it came from, its hash and
whether its `main.js` was approved.

## naudh1r-core

The game these releases are built for: the org's `core`, plus Venus Dev's latest game, After
Hours' hooks, a few fixes and the mods browser. Its kit is **0.8.1**, ahead of the org's 0.7.0, and moves ahead again
whenever the org's does. Every release asks for the kit it was built on or newer, so a newer core
keeps running them.

## Branches

| Branch | What it holds |
|---|---|
| `naudh1r-core` | The game and the kit, with no mods |
| `mod/photo-feature-kit` | `naudh1r-core` + Photo Feature |
| `mod/bunnyfeeds-kit` | `naudh1r-core` + Bunnyfeeds |
| `mod/emoji-extended-kit` | `naudh1r-core` + Emoji Extended |
| `mod/after-hours-kit` | `naudh1r-core` + After Hours |
| `notes/standalone-mods` | This page, the catalogue and the releases |

Each mod's `-kit` branch is where it is changed and tested. A change meant for the org's `main`
or `core` is carried to a new branch from there, one commit at a time.

## Releasing

1. Make the change on the mod's `-kit` branch, and bump its version in
   `src/shared/modEntries/<id>.ts`: the last digit for a fix, the middle for a new feature, the
   first for a change older saves can't go back from.
2. Add the version's section at the top of the changelog in `docs/mods/<id>.md`.
3. Build the release from a checkout of that branch, and zip what it writes as
   `releases/<id>-<version>.zip`:

   ```
   node vxbuild.mjs <repo> <id> <out folder>
   ```

   [`vxbuild.mjs`](vxbuild.mjs) writes the manifest from the mod's definition and the code it
   bundles, and asks for the kit it builds against or newer. With `OWN_GLOBS` set to the mod's
   file globs, it lists any game file that ended up in the bundle, which should be none.
4. Add the release to [`catalog.json`](catalog.json) with its sha256 and changelog.

A released version is never rebuilt: a change is a new version, with its own zip and hash.

## The catalogue

[`catalog.json`](catalog.json) lists each mod with its releases, newest first. A release names
its zip, sha256, the kit and game it needs, whether it has a `main.js`, and its changes. A mod
can also have a `cover` and up to eight `screenshots`, which its page in Browse shows.

## Covers and screenshots

Each mod's art is in its own folder, and [`catalog.mjs`](catalog.mjs) lists it in the catalogue:

```
art/<id>/cover.webp
art/<id>/screenshots/01-dm-photo.webp
art/<id>/screenshots/02-feed-post.webp
art/<id>/screenshots/captions.txt
```

- **Cover:** 16:9, about 1600x900, with what matters in the middle third from top to bottom,
  since a mod's page shows it cut to a thin strip.
- **Screenshots:** 16:9, at most eight, shown in file-name order.
- **Captions:** optional, one `file name: caption` per line in `captions.txt`.
- Each image is WebP, PNG or JPEG, and at most 1 MB.

To add or remove one, change the files, then run `node catalog.mjs` here and push.
