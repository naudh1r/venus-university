# Setup wizard

Builds `Venus-Photo-Feature-Setup-<version>.exe`, a small setup wizard that installs the photo
feature into an **official** Venus University folder and uninstalls it again. It contains only
code: none of the game's images, music or characters. Players need only the official game from
itch.io and nothing else installed.

## How it works

- `Setup.cs` is the wizard: one window to pick the game folder, then Install or Uninstall. It is
  plain C# for the .NET Framework that comes with Windows 10 and 11.
- `patch.mjs` does the work. It is zipped inside the exe together with the files it installs,
  and checked against a SHA-256 before it runs.
- It runs on the game's own exe. Venus University is an Electron app, and with
  `ELECTRON_RUN_AS_NODE=1` its exe is a plain Node.js, so no Node.js ships with the mod.

`Setup.exe install "<game folder>"` and `Setup.exe uninstall "<game folder>"` do the same
without the window.

## What it changes in the game folder

- `resources/app.asar`: the few code files the feature changes are swapped for the mod's.
  Everything else inside stays the official one.
- `resources/assets/workflows/characterPhoto.json`: added.
- A backup of the original `app.asar` (and `app.asar.unpacked`), and `resources/photo-mod.json`,
  which uninstall uses to put everything back.

Before changing anything, install checks the game is the official version the mod was built for:
the version in `resources/build-manifest.json`, and the hash of every code file it replaces.

## Building a new version

You need two builds of the game's code (`npx electron-vite build`, keep each `out` folder):

1. **The official release.** Venus University 0.3.0 was built from the dev's commit `ec8f7ce`
   (0.2.0 from `da160f8`). Check that the result matches the shipped `app.asar` before using it
   as the base.
2. **The photo feature on that same commit,** so the mod adds the feature and nothing else.

Then, in this folder:

```
npm install
node build.mjs --base <official out> --mod <photo feature out> \
  --workflow <photo feature checkout>/assets/workflows/characterPhoto.json \
  --game-version 0.3.0 --mod-version 1.1.0
```

The wizard is always compiled on Windows, with the C# compiler that comes with Windows. An exe
compiled elsewhere (Mono's `mcs`, for example) works, but Windows Defender blocks it.

- **On Windows**, `build.mjs` compiles it straight away.
- **Anywhere else**, it leaves `build-setup.cmd` in `dist/` with the payload and the wizard's
  source. Copy `dist/` to a Windows PC and double-click `build-setup.cmd`.

The result is the setup exe, `SHA256.txt` and the player `README.txt`, plus
`Venus-Photo-Feature-<version>-no-exe.zip`: the same patch without the wizard, for players whose
antivirus flags the unsigned exe. Its `Install.cmd` and `Uninstall.cmd` run `patch.mjs` with the
game's own exe, as the wizard does. The build stops if
anything other than code differs between the two builds, so no asset can end up in it. The
payload zip is reproducible: the same inputs always give the same file.

The exe is not signed, so Windows SmartScreen warns about an unknown publisher the first time.

When the official game updates, rebuild against the new release's commit and bump
`--game-version`: the setup refuses any other game version.
