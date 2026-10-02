Venus University Photo Feature (unofficial mod)
================================================

This is an unofficial mod. It is not made or supported by Venus Dev.
Please don't report problems with it to Venus Dev.

What it adds
------------
- Characters can send you photos in DMs and post photos to the feed.
- Body details: an optional build, chest, hips and backside per character.
- Both can be turned off in the game's settings.

The setup contains only code. It does not include any of the game's
images, music or characters. You need the official game from itch.io.
Nothing else needs installing: the setup runs on the game's own exe.

Requirements
------------
- Venus University 0.2.0, the official Windows build from itch.io.
- No other mod that changes the game's code. This mod is not compatible
  with them, and the setup refuses a game that already has one.
- The game's local ComfyUI, with the same models the official game uses.
  Photos are drawn by it, and there is no cloud option.
- ComfyUI starts by itself the first time a photo is drawn, so the first
  photo of a session takes longer. To avoid that wait, start it early from
  Character Manage. If it can't start, for example because a model is
  missing, photos show "Image failed to generate" with a Reroll button.

Install
-------
1. Close the game.
2. Back up your saves (the "data" folder next to Venus University.exe).
3. Run the setup exe. If Windows warns that it is from an unknown
   publisher, click "More info", then "Run anyway".
4. Choose your Venus University folder (the one with
   "Venus University.exe" in it). If the setup sits in that folder, it
   finds it by itself.
5. Click Install.

The setup checks that your game is the official 0.2.0 before changing
anything, and keeps a backup of the original game code.

Uninstall
---------
Close the game, run the setup exe, choose the same folder and click
Uninstall. It puts the original game code back, so the game is exactly
the official version again. Your saves and characters are not touched.

Updates
-------
If you accept an official update in the game, it replaces the modded code
and the mod is gone. Uninstall and wait for a version of this mod made for
the new game version.

Source code: https://github.com/naudh1r/venus-university/tree/photo-feature
