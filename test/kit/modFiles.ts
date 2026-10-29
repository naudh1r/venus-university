import type { ModSet } from './boundaryScan'

/**
 * Each in-repo mod's files beyond its two entries, by id: globs from the repo's root, and the mods
 * it requires where its entry does not say. The boundary test holds every file listed here to the
 * kit. On `core` there are no mods and this is empty; on `main` each author lists their own mod's
 * files, and a mod has moved out when its entry here is gone.
 *
 * A file two mods share is listed under the one the other requires (City Life), or split by what
 * each entry registers (the [MK] packs' games).
 */
export const MOD_FILES: Record<string, ModSet> = {
  breakthrough: {
    globs: [
      'src/shared/breakthrough*.ts',
      'src/renderer/stores/breakthrough*',
      'src/renderer/prompts/breakthrough*',
      'src/renderer/views/Breakthrough*',
      'src/renderer/vu_styles/Breakthrough.css'
    ]
  },
  bunnyfeeds: {
    globs: [
      'src/shared/bunnyfeeds*.ts',
      'src/renderer/components/Bunnyfeeds*',
      'src/renderer/stores/bunnyfeeds*',
      'src/renderer/vu_styles/Bunnyfeeds.css'
    ]
  },
  'campus-talents': {
    globs: [
      'src/shared/talent*.ts',
      'src/shared/campusTalents.ts',
      'src/shared/talentPacks/**',
      'src/renderer/views/Talent*',
      'src/renderer/assets/talents/**',
      'src/renderer/vu_styles/Talents.css'
    ]
  },
  'character-dynamics': {
    globs: [
      'src/shared/characterDynamics*.ts',
      'src/shared/continuedModSetup.ts',
      'src/renderer/views/CharacterDynamics*',
      'src/renderer/vu_styles/CharacterDynamics.css',
      'src/renderer/vu_styles/CharacterDynamicsBackstory.css'
    ]
  },
  // Its entry names the mod it requires through a constant, which the scan does not read.
  'city-life-jobs': { globs: [], requires: ['city-life-locations'] },
  'city-life-locations': {
    globs: [
      'src/shared/cityLife.ts',
      'src/shared/cityLifeCatalog.ts',
      'src/renderer/prompts/cityLifeLore.ts',
      'assets/bg/interior/dance_studio_*',
      'assets/bg_thumbs/interior/dance_studio_*'
    ]
  },
  'custom-soundtracks': {
    globs: [
      'src/shared/soundtrack*.ts',
      'src/main/services/soundtrackService.ts',
      'src/main/services/soundtrackBackup.ts',
      'src/renderer/stores/soundtrack*',
      'src/renderer/views/SoundtracksModal.tsx',
      'src/renderer/views/SoundtrackSettings.tsx',
      'src/renderer/vu_styles/Soundtracks.css'
    ]
  },
  echo: {
    globs: [
      'src/shared/echo*.ts',
      'src/main/services/echo*',
      'src/main/services/reflection*',
      'src/renderer/art/echoCutout*',
      'src/renderer/echoCutout.html',
      'src/renderer/stores/echoAssignments.ts',
      'src/renderer/views/EchoPanel.tsx',
      'src/renderer/vu_styles/Echo.css',
      'assets/echo-public/**',
      'assets/workflows/echoCutout.py',
      'assets/workflows/echoMegaten.json',
      'assets/workflows/reflectionPortrait.json'
    ]
  },
  'emoji-extended': {
    globs: [
      'src/renderer/components/Emoji*',
      'src/renderer/components/emojiData.json',
      'src/renderer/stores/emojiPrefs.ts',
      'src/renderer/vu_styles/EmojiPicker.css',
      'src/renderer/vu_styles/EmojiText.css'
    ]
  },
  'godlike-standards': { globs: ['src/shared/romanceRequirements.ts'] },
  'meanwhile-conversations': {
    globs: [
      'src/shared/meanwhile*.ts',
      'src/renderer/stores/meanwhile*',
      'src/renderer/prompts/meanwhile*',
      'src/renderer/views/Meanwhile*',
      'src/renderer/views/meanwhileImages.ts',
      'src/renderer/vu_styles/Meanwhile.css'
    ]
  },
  'mini-games': {
    globs: [
      'src/renderer/minigames/*',
      'src/shared/minigames.ts',
      'src/shared/minigameKit.ts',
      'src/shared/minigameScene.ts',
      'src/shared/minigameTraining.ts',
      'src/shared/minigameCards.ts'
    ]
  },
  'morrowkiln-arcade-games': {
    globs: [
      'src/renderer/minigames/games/{AirHockey,Paradiso,Pool,Bowling,SkeeBall,HoopShot,WhackABun,ClawMachine}.tsx',
      'src/shared/minigameEntries/{air-hockey,paradiso,pool,bowling,skee-ball,hoop-shot,whack-a-bun,claw-machine}.ts',
      'src/shared/minigameRules/{airHockey,paradiso,pool,bowling,skeeBall,hoopShot,whackABun,clawMachine}.ts'
    ],
    requires: ['mini-games']
  },
  'morrowkiln-card-games': {
    globs: [
      'src/renderer/minigames/games/{HighLow,Blackjack,Poker,CatPairs}.tsx',
      'src/shared/minigameEntries/{high-low,blackjack,poker,cat-pairs}.ts',
      'src/shared/minigameRules/{highLow,blackjack,poker,catPairs}.ts'
    ],
    requires: ['mini-games']
  },
  'morrowkiln-party-games': {
    globs: [
      'src/renderer/minigames/games/{BeerPong,TruthOrDare}.tsx',
      'src/shared/minigameEntries/{beer-pong,truth-or-dare}.ts',
      'src/shared/minigameRules/{beerPong,truthOrDare}.ts'
    ],
    requires: ['mini-games']
  },
  'morrowkiln-sports': {
    globs: [
      'src/renderer/minigames/games/{FootRace,SwimRace,RollerDerby}.tsx',
      'src/shared/minigameEntries/{foot-race,swim-race,roller-derby}.ts',
      'src/shared/minigameRules/{footRace,swimRace,rollerDerby}.ts'
    ],
    requires: ['mini-games']
  },
  'naudh1r-darts': {
    globs: [
      'src/renderer/minigames/games/Darts*',
      'src/renderer/minigames/games/darts*',
      'src/shared/minigameEntries/darts.ts',
      'src/shared/minigameRules/darts.ts',
      'src/renderer/vu_styles/Darts.css',
      'src/assets/darts/**'
    ],
    requires: ['mini-games']
  },
  'photo-feature': {
    globs: [
      'src/shared/photo{Body,Duo,Files,Framing,Gate,Loader,Pose,Prompt,Switches,Types,Wardrobe,Words}.ts',
      'src/shared/characterBody.ts',
      'src/shared/heldPosts.ts',
      'src/shared/postAudience.ts',
      'src/main/photo*.ts',
      'src/main/bodySetting.ts',
      'src/main/localPhotoBackup.ts',
      'src/main/services/localPhotoService.ts',
      'src/preload/photoApi.ts',
      'src/renderer/stores/photo{Comments,Group,Post,Recovery,SwitchHooks,TipDelivery,Turn,Webp}.ts',
      'src/renderer/views/ContactGallery.tsx',
      'src/renderer/views/bodyFields.tsx',
      'src/renderer/views/bodyDrafts.ts',
      'src/renderer/prompts/photoBrief.ts',
      'src/renderer/prompts/bodyBrief.ts',
      'src/renderer/vu_styles/PhotoBubble.css',
      'src/renderer/vu_styles/ContactGallery.css',
      'src/renderer/vu_styles/BodyFields.css'
    ]
  },
  'plot-twist': {
    globs: ['src/shared/plotTwist*.ts', 'src/renderer/prompts/plotTwist.ts', 'src/renderer/stores/plotTwist.ts', 'src/renderer/views/PlotTwistModal.tsx', 'src/renderer/views/PlotTwistEntry.tsx', 'src/renderer/vu_styles/PlotTwist.css']
  },
  'prompt-studio': {
    globs: [
      'src/shared/presets/**',
      'src/main/services/presetsService.ts',
      'src/main/services/studioBackupService.ts',
      'src/main/services/studioPromptsService.ts',
      'src/renderer/prompts/promptBlocks.ts',
      'src/renderer/stores/promptStudioStore.ts',
      'src/renderer/views/PromptStudio*'
    ]
  },
  reckoning: {
    globs: [
      'src/shared/reckoning*.ts',
      'src/renderer/stores/reckoning*',
      'src/renderer/views/Reckoning*',
      'src/renderer/vu_styles/Reckoning.css',
      'src/renderer/vu_styles/ReckoningDungeon.css',
      'assets/sound/community/reckoning/**'
    ]
  },
  'starting-challenge': { globs: ['src/shared/startingChallenge.ts'] },
  'story-memory': {
    globs: [
      'src/shared/storyMemory*.ts',
      'src/main/services/storyMemory*',
      'src/renderer/stores/storyMemory.ts',
      'src/renderer/views/StoryMemoryModal.tsx',
      'src/renderer/views/StoryMemoryEntry.tsx',
      'src/renderer/vu_styles/StoryMemory.css'
    ]
  },
  'text-regeneration': {
    globs: ['src/shared/textRegeneration.ts', 'src/renderer/components/TextRegenerate.tsx', 'src/renderer/vu_styles/TextRegenerate.css']
  },
  'venus-whisper': {
    globs: [
      'src/shared/venusWhisper.ts',
      'src/shared/whisper*.ts',
      'src/renderer/stores/venusWhisper*',
      'src/renderer/stores/whisper*',
      'src/renderer/views/VenusWhisperModal.tsx',
      'src/renderer/mods/venusWhisper.tsx',
      'src/renderer/vu_styles/VenusWhisper.css'
    ]
  }
}
