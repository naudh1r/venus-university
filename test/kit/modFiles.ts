import type { ModSet } from './boundaryScan'

/**
 * Each in-repo mod's files beyond its entries, by id: globs from the repo's root, and the mods it
 * requires where its entry does not say. The boundary test holds every file listed here to the
 * kit, and keeps the game's own files from importing them. On `core` there are no mods and this
 * is empty; on `main` each author lists their own mod's files, and a mod has moved out when its
 * entry here is gone.
 */
export const MOD_FILES: Record<string, ModSet> = {
  'photo-feature': {
    globs: [
      'src/shared/photo{Body,Definition,Draft,Duo,Files,Framing,Gate,Gender,Loader,Pose,Prompt,Switches,Types,Wardrobe,Words}.ts',
      'src/shared/characterBody.ts',
      'src/shared/heldPosts.ts',
      'src/shared/postAudience.ts',
      'src/main/photo*.ts',
      'src/main/modEntries/photo-feature.ts',
      'src/main/bodySetting.ts',
      'src/main/localPhotoBackup.ts',
      'src/main/services/localPhotoService.ts',
      'assets/workflows/characterPhoto.json',
      'assets/workflows/characterPhotoDuo.json',
      'src/renderer/components/PhotoBubble.tsx',
      'src/renderer/components/PhotoInfo.tsx',
      'src/renderer/stores/photoRedraw.ts',
      'src/renderer/vu_styles/PhotoInfo.css',
      'src/renderer/components/PhotoPostSpots.tsx',
      'src/renderer/stores/localPhotoStore.ts',
      'src/renderer/stores/photo{Comments,Game,Group,Invoke,Post,Records,Recovery,SwitchHooks,TipDelivery,Turn,Webp}.ts',
      'src/renderer/views/ContactGallery.tsx',
      'src/renderer/views/bodyFields.tsx',
      'src/renderer/views/bodyDrafts.ts',
      'src/renderer/prompts/photoBrief.ts',
      'src/renderer/prompts/photoTips.ts',
      'src/renderer/prompts/bodyBrief.ts',
      'src/renderer/vu_styles/PhotoBubble.css',
      'src/renderer/vu_styles/PostComments.css',
      'src/renderer/vu_styles/ContactGallery.css',
      'src/renderer/vu_styles/BodyFields.css'
    ]
  },
  bunnyfeeds: {
    globs: [
      'src/shared/bunnyfeeds*.ts',
      'src/renderer/components/Bunnyfeeds*',
      'src/renderer/prompts/bunnyfeedsPrompt.ts',
      'src/renderer/stores/bunnyfeeds*',
      'src/renderer/vu_styles/Bunnyfeeds.css'
    ]
  }
}
