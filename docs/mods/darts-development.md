# Maintaining the Darts pack

`mod/mini-game-darts` is based on Extracurriculars `core` and includes the Mini-games
framework dependency, its core scene hooks, and the Darts pack. It is a runnable
build with no other game packs or unrelated mods bundled.

Update from `core`; never merge the combined `main` build into this maintenance
branch. Framework files retain upstream authorship and should be kept aligned with
upstream. The place resolver uses core locations; the combined main build also
checks optional City Life location availability.

## Validate

```sh
npm install
npm run typecheck
npx vitest run test/darts.test.ts test/minigame*.test.ts
npm run build
npm run dev
```

Enable Mini-games in Mods. The Darts pack follows the framework dependency switch.
Its content switch defaults on; the framework defaults off, matching upstream.

## Submit changes

Create a temporary `integrate/darts` branch from the latest Extracurriculars `main`
and merge the maintenance branch there. Resolve combined-build conflicts there,
retaining upstream's other mods and optional location checks. Open PRs from the
integration branch to upstream `main`.

Artwork licensing remains beside the assets in `src/assets/darts/LICENSE.md` and
in the player guide. The separate licence PR is unchanged.
