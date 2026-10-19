# Maintaining the Darts pack

`mod/mini-game-darts` is based on Extracurriculars `core`. Its changes contain only
the Darts pack, its assets, guide and rules tests. Update it from `core` only; never
merge the combined `main` build into this branch. No other game packs are bundled.

## Required framework

Darts requires the `mini-games` framework. Current `core` (`16da338`) does not
contain that framework, so this branch alone is not a complete runnable build.
It intentionally does not copy the framework or its bundled games into the pack.

Use a framework that includes the additions shipped with Darts in Extracurriculars
0.3.0: `MiniGameDef.skillAxes`, `MiniGameDef.resultBrief`, opponent ability biases,
expression-aware `GamePlay.speak`, `useEffectsGain`, per-game screen styling and
the shared/renderer mini-game kits. The framework owns scene integration, dialogue,
input layout and location resolution. Those files are not maintained by this pack.

## Test the rules on the clean mod branch

```sh
npx vitest run test/darts.test.ts
```

The rules are self-contained and can be tested without the renderer framework.
A full typecheck, build or game launch needs the framework to be present.

## Test or submit a combined build

Start a temporary integration branch from the latest Extracurriculars `main`, which
contains the released framework, then merge the mod branch into that integration:

```sh
git fetch extracurricular
git switch -c integrate/darts extracurricular/main
git merge mod/mini-game-darts
npm run typecheck
npm run build
```

Resolve any conflicts on the integration branch. Open the PR from that branch to
upstream `main`; after merge, the integration branch can be removed. Keep the mod
branch based on `core`. When `core` eventually contains the framework API, the same
pack can build there directly without copying another mod into this branch.

The artwork licence files are part of this pack. The separately submitted licence
PR is not changed by creating or maintaining this branch.
