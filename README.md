> [!IMPORTANT]
> **This is an unofficial, modified version of Venus University.** It is not made, endorsed or
> supported by Venus Dev. The official game is on itch.io, linked below.
>
> - **Please do not report problems with this version to Venus Dev** — neither by email nor in the
>   game's community. Anything you find here may have been caused by the changes below.
> - **Modified by naudh1r, September 2026**, from Venus Dev's public mirror at commit `b56a990`.
>   The full list of changes is this branch's commit history.
> - **What it adds**, each with its own switch in Settings:
>   - *Photos* — characters can text you a picture, or post one to the feed, rendered on your own
>     machine by the local ComfyUI. Some can be explicit, depending on your relationship and your
>     content settings. On by default wherever ComfyUI can render; switch it off for a
>     text-only playthrough.
>   - *Strict schema fields* — for OpenAI-compatible endpoints that do not enforce a JSON schema.
>     Off by default; shown under Generation only when a custom endpoint is selected.
> - **Licences are unchanged.** The code, including these changes, is AGPL-3.0-only (`LICENSE`).
>   Images, audio and video remain © Venus Dev, all rights reserved (`LICENSE-ASSETS.md`); they
>   are here only so the game builds from source.
>
> ### Installing this version
>
> Starting fresh:
>
> ```
> git clone https://github.com/naudh1r/venus-university.git
> ```
>
> Already have Venus Dev's version cloned? Add this one beside it and switch to it — your unzipped
> characters and your saves stay where they are. Commit or stash any changes of your own first.
>
> ```
> git remote add naudh1r https://github.com/naudh1r/venus-university.git
> git fetch naudh1r
> git checkout -b naudh1r naudh1r/main
> ```
>
> Then set it up as Venus Dev's instructions below describe. Later, `git pull` on that branch picks
> up changes to this version, and `git checkout main` takes you back to his.
>
> **This version follows Venus Dev's releases by hand, not automatically.** It is built on his mirror
> at `b56a990` and keeps working as it is when he publishes something newer; it just does not have
> his new changes until they are merged in here. If you have already updated to a newer release of
> his, switching to this version takes you back to an older one, and a save made on his newer
> version may not load in it.
>
> Venus Dev's own README follows, unedited.

# Venus University

Venus University is a single-player AI-driven dating sim available for web and desktop (via Electron).

The supported way to play is the itch.io page:
**https://venus-dev.itch.io/venus-university**

This is a read-only snapshot mirror of my private development repository. I am not accepting PRs or issues at the moment, if you have feedback or suggestions, please send me an email (listed on the itch.io page above) or make a bug report in the community.

## What's missing

- `assets/characters` — default characters are zipped so you can\'t preview their NSFW images on GitHub. Unzip them before use.
- `assets/sound/music` and `assets/sound/ambient_music` — check `assets/sound/README.md` on how to obtain
- `.github/` — the private repository's CI configuration.
- `build/itch-page/` — the store page's pictures.
- `private/` — the supporters ledger.

and probably some other things. If they're not here, I probably excluded them for some reason or other.

## Running from this repo

- Unzip the cast first. Every zip unpacks to `assets/characters/<id>/`, so from `assets/characters`:
  `for z in *.zip; do unzip -q "$z"; done` (or extract each one in place with your archiver).
- `npm run dev` then starts with the backgrounds, the sound effects and the pre-generated characters; only the music
  tracks are missing. Character generation should work: the pose manifest and openpose skeletons under `assets/pose`
  are included.
- An external API is required to play. API keys are stored in `data/settings.json`, encrypted at rest
  with Windows DPAPI (Electron's `safeStorage`); where DPAPI is unavailable it falls back to
  storing the key as plain text in the same file.
- The browser build (`npm run build:web`) is untested from this repo.

## Building

Requires Node 22.

```
npm ci
npm run typecheck
npm test
npm run build
npm run dev
```

## Verifying a release

Releases are Windows zips distributed on itch.io. To compare a release against this source:

1. Extract the shipped app: `npx @electron/asar extract app.asar out-shipped` (from inside the
   release zip's `resources` folder).
2. Build the matching tagged snapshot from this repository:
   `git checkout vX.Y.Z && npm ci && npm run build`.
3. Compare the built `out/main` and `out/preload` (which bundle no art) with the shipped copies.

The two builds won't be byte identical since it's missing the music.

## Licence

- Code is licensed under AGPL-3.0-only — see `LICENSE`.
- Image, audio and video files are all rights reserved — see `LICENSE-ASSETS.md`.
- If you spot security issues, please read `SECURITY.md` before reporting
