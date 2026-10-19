# Installer

Builds the Venus Extracurriculars installer: a no-exe zip and a small setup wizard that put a
build of this repository into an **official** Venus University folder, and take it out again.
Players need only the official game from itch.io; nothing else is installed.

Adapted from the setup of naudh1r's Photo Feature mod
(https://github.com/naudh1r/venus-university, AGPL-3.0-only), with thanks.

## How it works

- `patch.mjs` does the work. It runs on the game's own exe: Venus University is an Electron app,
  and with `ELECTRON_RUN_AS_NODE=1` its exe is a plain Node.js, so no Node.js ships with it.
- The game's code is `resources/app.asar`. Install backs it up, swaps in the build's code and
  adds the files its mods bring, and writes `resources/venus-extracurriculars.json`. Uninstall
  puts the backup back.
- Before changing anything, install checks the game is the official version the build was made
  for: the version in `resources/build-manifest.json`, and the hash of every file it replaces or
  removes. A game that still has Continuing Semesters or Photo Feature installed on its own is
  told to uninstall it first; both are in the build.
- If the game's code changes underneath (an official update), the install is already gone: its
  backup is deleted rather than restored over the new code.
- `Setup.cs` is the wizard, plain C# for the .NET Framework that comes with Windows. It carries
  `patch.mjs` and its payload zipped inside, checked against a SHA-256 before it runs.
  `Setup.exe install|uninstall "<game folder>"` works without the window.

## What goes in the download

The build compares two `out` folders, the official release's and this build's:

- every code file (`.js`, `.css`, `.html`) that differs or is new goes in;
- every file that only this build has goes in: a mod's own assets, such as City Life's
  backgrounds (each mod documents where its assets come from in `docs/mods/`);
- a file of the official game's that differs or is gone and is **not** code stops the build.
  None of Venus Dev's art, music or characters can end up in the download.

## The no-exe download

`Venus-Extracurriculars-<version>-no-exe.zip` is the same `patch.mjs` and payload with two small
launchers, `Install.cmd` and `Uninstall.cmd`, in place of the wizard. This is the download to
offer: antivirus tools flag an unsigned exe that unpacks a zip and rewrites another program's
files, which is exactly what the wizard does. Everything in the zip can be read before it runs.

## Building a release

Only for a game version Venus Dev has released himself, on itch.io.

1. **The official `out`**, taken out of the shipped game:
   `npx @electron/asar extract "<game>/resources/app.asar" official`, then use `official/out`.
   Its files are the hashes a player's game is checked against, so they must come from the
   release itself.
2. **This build's `out`**: `npx electron-vite build` on `main`, at the commit being released.
3. In this folder:

   ```
   npm install
   node build.mjs --base <official out> --build <build out> --game-version 0.4.0 \
     --manifest "<game>/resources/build-manifest.json"
   ```

   The manifest lists every file of the release with its hash. Files a mod keeps beside the code,
   in `resources/assets` (Photo Feature's photo workflow), are found against it and installed and
   removed with the build; one of the game's own that differs stops the build.

   The build's name and version come from `BUILD` in `src/shared/mods.ts`
   (`--build-version` overrides the version).

The wizard is compiled on Windows with the C# compiler that comes with Windows. Built anywhere
else, `dist/` gets `build-setup.cmd`: copy `dist/` to a Windows PC and double-click it. The exe
is not signed, so SmartScreen warns about an unknown publisher the first time.

`npm test` runs the patch against a small stand-in for the game, with no game needed: install and
uninstall round trip, an install whose marker cannot be written or renamed rolled back, a file
already where an added one goes set aside and put back, and code changed by something else since
the install left alone, backup and all.

Then install, play and uninstall on a clean copy of the official game before publishing.
