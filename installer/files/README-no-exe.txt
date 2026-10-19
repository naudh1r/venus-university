{{NAME}} {{VERSION}} (unofficial) - no-exe version
=================================================================

This is an unofficial, community-made build of Venus University with
several mods in it. It is not made or supported by Venus Dev.
Please don't report problems with it to Venus Dev.

This package does the same as the setup exe, without an exe. Everything in
it can be read before running it:

  Install.cmd, Uninstall.cmd   start the patch on the game's own exe
  patch.mjs                    the patch itself (bundled JavaScript)
  payload/                     the files it installs, and expected.json:
                               the hashes it checks first

It contains only code and the art the mods themselves add: none of the
game's own images, music or characters. You need the official Venus
University {{GAME_VERSION}} for Windows from itch.io.

Install
-------
1. Close the game.
2. Back up your saves (the "data" folder next to Venus University.exe).
3. If you have Continuing Semesters or Photo Feature installed on its own,
   uninstall it first: both are included here.
4. Extract this whole zip. If you extract it inside your game folder, the
   scripts find the game by themselves.
5. Double-click Install.cmd. If it asks, paste the path of your game
   folder (the one with "Venus University.exe" in it).

It checks that your game is the official {{GAME_VERSION}} before changing anything,
keeps a backup of the game code as it found it, and refuses a game with a
mod in it.

Every mod has its own switch: open Mods on the main menu to see what is
included and to turn any of them on or off.

Uninstall
---------
Close the game and double-click Uninstall.cmd. It puts the game code back
exactly as it was before the install. Your saves and characters are not
touched.

Some mods write things the official game does not understand (a semester
continued with Continuing Semesters, for example). Saves like that may not
load in the official game after uninstalling; your other saves are fine.

Updates
-------
If you accept an official update in the game, it replaces the modded code
and the mods are gone. Uninstall and wait for a version of this build made
for the new game version.

Credits
-------
Venus Dev, for the game and for publishing its source.
Each mod's author is named on the Mods screen.
The patch is adapted from naudh1r's Photo Feature mod.

Source code: https://github.com/venus-extracurriculars/build
