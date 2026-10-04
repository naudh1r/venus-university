> [!IMPORTANT]
> **This is an unofficial, modified version of Venus University.** It is not made or supported by
> Venus Dev. The official game is on itch.io, linked below.
>
> Please don't report problems with this version to Venus Dev. They may come from the changes here.
>
> ### What this branch adds
>
> - **Photos.** Characters can send you a photo in DMs and post photos to the feed. How far a
>   photo goes depends on your relationship and your content settings. To turn photos off, use
>   **No DM and feed photos** in Settings → Content.
>
>   She remembers the photos she sent you in DMs and what was in them. Feed photos work like the
>   game's own feed posts: once posted, she doesn't remember them, and liking one counts toward
>   her affection like any other post.
> - **Body details.** An optional build, chest, hips and backside for each character, so her body
>   looks the same in sprites, CGs and photos. Off by default. The switch is in Character Manage.
>   With it on, a character you create gets them from the start, and you can set them in the
>   editor of any character of your own. The default characters can't be edited, so duplicate one
>   first and give the copy her body details.
>
> ### Backups and character exports
>
> - **Back up game data** keeps everything the official backup keeps, plus the photo settings,
>   your own characters' body details and which texts carried a photo. Her DM and feed photos go
>   in a second file next to the backup, `<backup name>.photos.zip`. Keep the two files together,
>   under the same name.
> - **Restore from backup** brings her photos back when that second file is next to the backup.
>   Without it the restore still works, and those photos show "Image failed to generate" with a
>   Reroll button.
> - A game without this mod can restore the same backup. It ignores the photos file.
> - **Exporting a character** carries her body details. Her photos belong to a playthrough, not
>   to her, so they aren't in the export.
>
> ### Requirements for photos
>
> Photos are drawn by the game's own local ComfyUI. There is no cloud option.
>
> - **Use the same models as the official game:**
>   - checkpoint `novaAnimeXL_ilV190.safetensors`
>   - LoRA `usnrStyle.safetensors`
>   - upscaler `RealESRGAN_x4plus_anime_6B.pth`
>   - face model `segm/Anzhc Face seg 640 v2 y8n.pt`
>
>   Another checkpoint may still work, but outfits, bodies and poses will look off.
> - **ComfyUI starts by itself** the first time a photo is drawn, so the first photo of a session
>   takes longer. To avoid that wait, start it early from Character Manage.
> - If ComfyUI can't start, for example because a model is missing, characters still send photos,
>   but they fail to draw. You'll see "Image failed to generate" with a Reroll button.
> - If you don't want to run ComfyUI, turn on **No DM and feed photos** and characters won't
>   send any.
>
> ### Installing
>
> New install:
>
> ```
> git clone -b photo-feature https://github.com/naudh1r/venus-university.git
> ```
>
> If you already have Venus Dev's version, add this one next to it. Your characters and saves stay
> where they are. Commit or stash your own changes first.
>
> ```
> git remote add naudh1r https://github.com/naudh1r/venus-university.git
> git fetch naudh1r
> git checkout -b photo-feature naudh1r/photo-feature
> ```
>
> Then follow Venus Dev's setup steps below. Run `git pull` on this branch to get updates, and
> `git checkout main` to go back to the official version.
>
> This version is based on Venus Dev's mirror at commit `ec8f7ce`, Venus University 0.3.0. It
> doesn't update by itself when a new official version comes out. If you've already updated to a newer official version,
> switching to this one takes you back to an older version, and newer saves may not load.
>
> ### Licences
>
> The code is AGPL-3.0-only (`LICENSE`). Images, audio and video are © Venus Dev, all rights
> reserved (`LICENSE-ASSETS.md`). They're included only so the game builds from source.
>
> Venus Dev's own README follows, unchanged.

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
