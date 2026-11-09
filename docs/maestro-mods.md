# Maestro's mods: player guide and feature index

This guide describes the Maestro modules in this source branch. The base game's version,
the community build's version and each mod's version are separate numbers. For supported
game versions and installation, follow the selected [VE release's instructions](https://github.com/venus-extracurriculars/build/releases).
Do not apply the old Maestro 1.x compiled-archive package to this source build.

Open **Mods** on the main menu. The left list selects a mod; its switch enables it and the
right pane shows its options. An **any time** switch applies during play. A **per playthrough**
switch is recorded when starting a game; changing the menu choice does not rebuild an existing
playthrough. Defaults below mean an untouched configuration, not a promise to reset saved choices.

## Maestro modules

| Mod | Default | Scope | Required mods | What it adds / where to find it |
| --- | --- | --- | --- | --- |
| [Breakthrough](mods/breakthrough.md) | On | Any time | None | Per-character spirit, a one-response scene action and saved outcome continuity. Scene panel. |
| [Character Dynamics](mods/character-dynamics.md) | Off | Per playthrough | None | Starting personality tendencies and reasoned relationship backgrounds. New-game setup and profile Backstory. |
| [City Life locations](mods/city-life.md) | On | Per playthrough | None | Lucky Strike Lanes, Starlight Roller Rink, Purr & Pour Cat Café and Dance Studio. Native map/schedules. |
| [City Life jobs](mods/city-life.md) | On | Per playthrough | City Life locations | Player and NPC jobs at four venues. Dance Instructor requires Dancer III, Good Body and Good Heart. Native job board/schedules. |
| [Custom soundtracks](mods/custom-soundtracks.md) | On | Any time | None | Local MP3/OGG/WAV replacements for thirteen music cues, preview, looping and cleanup. Settings. |
| [Echo](mods/echo.md) | Off | Any time | None for Echo itself | Twenty-two aspects, affinity, creatures, artwork and an Echoes panel. Optional abilities additionally need Breakthrough. |
| [Meanwhile conversations](mods/meanwhile-conversations.md) | On | Any time | None | Read-only dramatizations of native two-NPC encounters. Bunnyboard → Meanwhile. |
| [Plot Twist](mods/plot-twist.md) | On | Any time | None | An ongoing direction for future scenes, saved per timeline. Game menu. |
| [Breaking Through the Silence](mods/reckoning.md) | Off | Any time | Breakthrough | A private Unheard Soul encounter, three questions and persistent character growth. Echo adds aspect-specific presentation and a hint. |
| [Story Memory](mods/story-memory.md) | On | Any time | None | Editable durable facts, bounded recall and an optional local SQLite index. Game menu → Story Memory. |
| [Text Regeneration](mods/text-regeneration.md) | On | Any time | None | Regenerate the latest eligible whole text reply. Bunnyboard chat. |
| [The Hare & Quill](mods/venus-whisper.md) | On | Any time | None | Weekly gossip, comments, witnessed clues and a privately discoverable author. Bunnyboard → Hare & Quill. |
| [Campus Talents](mods/campus-talents.md) | Off | Any time | None for the framework | Six skill trees, Bond Points, abilities and Personal Growth. Skill trees button. |
| [Starting Challenge](mods/starting-challenge.md) | Off | Per playthrough | None | Independent negative starting tiers using native stat selectors. New Game and Quickstart. |
| [Godlike Standards](mods/godlike-standards.md) | On | Any time | None | Opt-in gold Godlike trait requiring all three Godly stats before a new romance. Character editor. |

The shared build also includes other authors' modules. Their names, authors and options are
shown in Mods; they are not claimed as Maestro's work by this guide. See the individual guides
and the repository's credits for their ownership.

## Six skill trees

Enable **Campus Talents** in Mods, then use **Skill trees** beside Echoes during a scene or
between scenes. It ships off by default. There are **43 skills**: six numerical skills and one special ability in each tree, plus the shared Personal Growth ability:

- **Charm:** the earlier affection, group, texting and gifting skills, plus Leave Them Wanting More. Existing purchases retain their ranks.
- **Heart:** extra Heart stat points from eligible activities, class, work and successful accepted invitations, plus recovery below zero and the weekly Silver Lining scene ability. Show Up grants +1/+2 Heart once per day after a positive meeting.
- **Brain:** eligible Brain training, class gains, project work and assessment scores.
- **Body:** eligible Body training, PE/work gains and player cold resistance/severity.
- **Money:** wages, shift streaks, shop discounts, a savings pocket and limited weekly interest.
- **Echoes:** matching/neutral/competing affinity, spirit gains and lower Echo ability costs.

Positive relationship gains earn a separate **Bond Point** wallet; spending it never subtracts
affection. Existing saves receive one initial grant from positive current affection. Thereafter
newly settled liked/loved memories have base rewards of 1/2 BP. Average player stats scale
these rewards through 300% at −100, 260% at −60, 150% at −30, 125% at −15, 100% at zero and 50% at +100, with fractional
BP saved. Native stat gains and full listed skill bonuses do not scale with these rewards. Charm/Echo affection bonuses do not multiply BP. Purchases, savings and rewards are saved, survive reload and carry into a new semester.

Charm, Heart, Brain, Body and Money work without Echo, Breakthrough or Story Memory. Echoes affinity
skills need Echo; spirit skills also need Breakthrough. Missing dependencies disable the relevant
skills rather than the whole tree framework. All rank prices, prerequisites, caps and exclusions
are in [Campus Talents](mods/campus-talents.md). Prices are paid separately for each rank.

The six special abilities are Silver Lining,
Leave Them Wanting More, Eureka!, Dancer, Eye for Value and Borrowed Voice. Scene abilities
add context to the normal story request; they do not create background AI calls.

Personal Growth appears in the Skill trees header. Unlock it for 60 BP after maxing one
second-row stat skill. It buys actual Brain/Body/Heart up to 100: recovery 10 BP, new progress
25 BP below 60 and 40 BP from 60 onward. Six purchases per week total; at most two are new progress.
Recovery is limited to recorded semester-break losses and also decreases through ordinary
training. Old saves start tracking discounts at the next break. Decay is unchanged.

## Where the negative starting tiers are

These are **not inside the Skill trees screen**.

1. Return to the **main menu → Mods**.
2. Select **Starting Challenge** in the left list and switch it on.
3. Start **New Game** or **Quickstart**.
4. On the name screen, use the normal −/+ controls for **each stat separately**. Below −15
   there are four choices: **−30, −60, −80 and −100**. Setup rows show rank titles without numbers.
   In stat displays, −80 is **Life’s Punchline** and −100 is **Peaked in the Womb**.

Untouched stats remain Unremarkable (0). Mix any normal and challenge tiers; each stat saves
its own floor. For example, Brain −30, Body −60 and Heart 0 retain floors −30, −60 and −15.
Regular gains recover the stats. It is off by default, independent of Campus Talents and applies
only when starting a playthrough. Loading an existing save will not subtract stats or apply a
new penalty. A build must include this mod for the extra starting choices to appear.

Negative Brain still affects the native grade formula. With Brain and Heart at −30, perfect
exam/project work scores 20% before perks; at −60, −80 or −100 it scores 0%. At zero in both, perfect work
scores 50%. Brain assessment skills add at most nine percentage points, so recovery matters.
Failing an assessment lowers its grade/GPA and can affect academic reputation; it does not by
itself expel the player or delete the playthrough. See [Starting Challenge](mods/starting-challenge.md).

## What changed since the older installer documentation

- Mods now integrate into shared TypeScript source and discovered entries/hooks, instead of
  being explained as one compiled JavaScript patch installer. They have independent switches
  and explicit dependencies. Story Memory and Breakthrough are separate systems.
- Native character notes, playthrough names, scene creation/replays and 0.5.0 semesters must be
  preserved. There is no extra Playthrough Renaming module in this catalog. Native starting
  stat choices remain available; Starting Challenge extends the choices below them.
- Meanwhile now uses the game's existing NPC encounters. It does not inject a second daily
  pair event. The optional spectator dialogue does not grant the player knowledge of it.
- The Hare & Quill replaces the earlier newsletter name in the UI, while its stable internal
  ID remains `venus-whisper`. Lady Harewood is the byline, not a fixed character identity.
- Echo, Character Dynamics and Breaking Through the Silence add their own guides, state,
  artwork handling and save safeguards. PNG, JPEG and WebP artwork use a shared decoder.
- 0.5.0 uses native New Game+ and semester records. Carry adapters retain appropriate mod data;
  native names, semester identity and graduate rosters are respected.
- Story Memory now documents Standard and optional Light recall, evidence validation and
  SQLite fallback. Custom soundtracks includes the three Unheard Soul encounter cues.
- Venus Phone is a separate LAN companion with text/photo sync, newer-save confirmation,
  0.5.0 semester guards, provider choices and experimental local speech/transcription.
- Six skill trees, independent harder starts and the opt-in Godlike trait have their own
  guides and switches. The Dance Studio extends the existing City Life locations and jobs.
- Native editable lorebooks coexist with Story Memory: the book describes the world, while
  memories recall what happened. City Life entries retain edits, and normal and regenerated
  texts use the current book. Scene Creator offers Starting Challenge's extra ranks too.

## Privacy, support and development

Source exports should contain code and documentation, not a player's save folder, chats,
characters, settings, API keys, SQLite files, voice recordings or model downloads. Runtime
memory uses local storage, but selected context still goes to the configured AI provider during
generation. A local ComfyUI image option does not make text generation local.

Use copied saves when testing. Keep the whole game data folder and personal assets backed up
before changing builds. A source mod's optional fields are not a blanket guarantee that every
historic patched save can migrate to every later base-game schema.

For code ownership, state flows, save safety and extension points, read the
[technical guide](maestro-technical-guide.md), [shared mod framework](../MODDING.md) and
[talent-pack guide](mods/talent-packs.md).

Support [Venus University's official release](https://venus-dev.itch.io/venus-university) and
[Venus Dev](https://ko-fi.com/venusdev). Report community-mod problems to the community project,
not to Venus Dev. Code and assets have different terms: retain [LICENSE](../LICENSE),
[LICENSE-ASSETS.md](../LICENSE-ASSETS.md) and the mod-specific asset notices.
