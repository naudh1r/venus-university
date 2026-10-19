# Venus Extracurriculars

An unofficial, fan-made community build of [Venus University](https://venus-dev.itch.io/venus-university),
Venus Dev's single-player AI-driven dating sim. It brings several community mods into one game,
and each one can be switched on or off from **Mods** on the main menu.

This is not Venus Dev's repository, and he is not responsible for anything in it. Please report
problems with this build to us, not to him. The official game is on itch.io:
**https://venus-dev.itch.io/venus-university**

## Playing

The build installs over the official Windows release of the game: download it from itch first,
then run the installer from this build's release. Uninstalling puts the official game back.
Install over the official game only: uninstall any other mod first.

Every mod in the build is listed on the **Mods** screen with its author, and can be turned on or
off there. The mods' own guides are in [`docs/mods/`](docs/mods/).

## Branches

- `core`: the game from Venus Dev's public repository, plus the mod system, with no mods.
- `mod/<name>`: one mod, built on `core`, looked after by its author.
- `integrate/<name>`: a mod merged with `main`, where conflicts with the other mods are settled.
- `main`: what players get, `core` with every mod.

Each mod belongs to its author. Anyone in the organization can merge, as long as someone other
than the author does. [`MODDING.md`](MODDING.md) explains how a mod plugs in, and how to open a
pull request here rather than on Venus Dev's repository.

## Following the game

`core` follows Venus Dev's public repository, and nothing built on a version of the game goes out
before he has released that version himself.

## Running from source

These steps are Venus Dev's, from his repository; they hold here too.

- Some files are not in the repository. The default characters in `assets/characters` are
  zipped, so their NSFW images can't be previewed on GitHub: every zip unpacks to
  `assets/characters/<id>/`, so from `assets/characters`,
  `for z in *.zip; do unzip -q "$z"; done` (or extract each one in place with your archiver).
  The music tracks (`assets/sound/music`, `assets/sound/ambient_music`) are not included either:
  `assets/sound/README.md` says how to get them.
- `npm run dev` then starts with the backgrounds, the sound effects and the pre-generated
  characters. Character generation should work: the pose manifest and openpose skeletons under
  `assets/pose` are included.
- An external API is required to play. API keys are stored in `data/settings.json`, encrypted at
  rest with Windows DPAPI (Electron's `safeStorage`); where DPAPI is unavailable it falls back to
  storing the key as plain text in the same file.

Requires Node 22.

```
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

## Licence

- Code is licensed under AGPL-3.0-only, as Venus Dev's is: see `LICENSE`.
- Image, audio and video files are all rights reserved: see `LICENSE-ASSETS.md`.
- If you spot a security issue, please read `SECURITY.md` before reporting it.

## Thanks

To Venus Dev, for the game and for publishing its source.
