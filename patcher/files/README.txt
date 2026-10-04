Venus University Photo Feature (unofficial mod)
================================================

This is an unofficial mod. It is not made or supported by Venus Dev.
Please don't report problems with it to Venus Dev.

What it adds
------------
- Characters can send you photos in DMs and post photos to the feed.
  She remembers the photos she sent you in DMs. Feed photos work like
  the game's own feed posts: once posted, she doesn't remember them, and
  liking one counts toward her affection like any other post.
- Body details: an optional build, chest, hips and backside per character.
  Switch them on in Character Manage. A character you create gets them
  from the start; the default characters can't be edited, so duplicate
  one and give the copy her body details.
- Both can be turned off in the game's settings.

The setup contains only code. It does not include any of the game's
images, music or characters. You need the official game from itch.io.
Nothing else needs installing: the setup runs on the game's own exe.

Requirements
------------
- Venus University 0.3.0, the official Windows build from itch.io.
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

The setup checks that your game is the official version before changing
anything, and keeps a backup of the original game code.

Without the setup exe
---------------------
Some antivirus programs flag the setup exe, because it is unsigned and
patches another program's files. The "no-exe" zip does the same job with
two plain scripts you can read in Notepad first:
1. Close the game and back up your saves.
2. Unzip it anywhere.
3. Double-click Install.cmd. When it asks for the game, drag your
   Venus University folder into its window (or paste the folder's path)
   and press Enter. If you unzipped it inside the game folder, it finds
   the game by itself.
Uninstall.cmd takes it out again, the same way.

Backups
-------
"Back up game data" also writes a second file next to the backup,
"<backup name>.photos.zip", with her DM and feed photos. Keep the two
files together, under the same name. "Restore from backup" brings the
photos back when that file is next to the backup; without it, the
restore still works and those photos offer a Reroll. A game without the
mod can restore the same backup and ignores the photos file.

Exporting a character carries her body details, but not her photos:
those belong to a playthrough.

Keep the game from updating
---------------------------
An official game update replaces the modded code, so the mod is gone
afterwards. While you want to keep the mod:
- In Settings, untick "Ask to update on launch".
- Don't click "Update to vX" on the main menu.

Uninstall
---------
Close the game, run the setup exe, choose the same folder and click
Uninstall. It puts the original game code back, so the game is exactly
the official version again. Your saves and characters are not touched.

Updates
-------
If the game does update, the mod is gone and your saves are fine. Don't
run an older setup's Uninstall then: wait for a version of this mod made
for the new game version and install it. It clears what the old one left
behind.

Source code: https://github.com/naudh1r/venus-university/tree/photo-feature
