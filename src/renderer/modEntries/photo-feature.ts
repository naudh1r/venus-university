import { PHOTO_FEATURE } from '@shared/mods'
import { reachOf, rollAudienceLikes } from '@shared/postAudience'
import { postIsOut } from '@shared/heldPosts'
import {
  photoLines,
  photoStub,
  PHOTO_SCHEMA_FIELDS,
  PHOTO_SCHEMA_REQUIRED,
  postCommentLines,
  postPhotoLines,
  POST_PHOTO_SCHEMA_FIELD,
  POST_PHOTO_SCHEMA_REQUIRED
} from '../prompts/photoBrief'
import {
  bodyBriefLines,
  bodyOfDraft,
  bodySchemaFields,
  bodySchemaRequired,
  type DraftBody
} from '../prompts/bodyBrief'
import { canSendPhotos, noExplicitPhotos } from '../stores/localPhotoStore'
import { postLikes, rollComments, strangerLikes } from '../stores/photoComments'
import { holdPostPhoto, preparePostPhoto, startHeldPostPhoto } from '../stores/photoPost'
import { settlePendingPhotos } from '../stores/photoRecovery'
import { sendPhoto } from '../stores/photoTurn'
import { useGameStore } from '../stores/gameStore'
import { registerHooks } from '../mods/hooks'

/**
 * Photo Feature, plugged into the game through its hooks. Everything it adds to the game's own
 * files is here; the game only asks. The mods store skips it while it is off.
 */
registerHooks(PHOTO_FEATURE, {
  prompts: {
    dm: {
      // What she may photograph is settled from the save before she is asked anything.
      lines: ({ character, info, state }) =>
        photoLines(character, info, {
          ...state,
          canRenderImages: canSendPhotos(),
          noNsfwImages: noExplicitPhotos()
        }),
      fields: () => PHOTO_SCHEMA_FIELDS,
      required: () => PHOTO_SCHEMA_REQUIRED
    },
    'slot-posts': {
      lines: () => [...postPhotoLines(canSendPhotos()), ...postCommentLines(true)],
      fields: () => POST_PHOTO_SCHEMA_FIELD,
      required: () => POST_PHOTO_SCHEMA_REQUIRED
    },
    character: {
      lines: () => bodyBriefLines(),
      fields: () => bodySchemaFields(),
      required: () => bodySchemaRequired()
    }
  },

  dmHistoryNote: (message) => photoStub(message, (text) => text),

  characterFromDraft: (draft, { baseAppearance }) => ({
    body: bodyOfDraft(draft.body as DraftBody | undefined, baseAppearance)
  }),

  // Her picture, if she offered one and the save will have it. Left to finish on its own: a
  // render is half a minute, and her words have already landed.
  afterDmReply: ({ charId, character, reply }) => void sendPhoto(charId, character, reply),

  // The slot's held feed pictures, now that he is busy with something: they draw under the scene
  // and the posts are waiting on the feed when he is free again.
  playerActs: () => startHeldPostPhoto(),

  // A picture whose render outlived the save that asked for it: found on disk, or given up on.
  gameEntered: () => void settlePendingPhotos(),

  fileFeedPost: async (filing, { nudge }) => {
    const reply = filing.reply as { image?: string; comments?: string[] }
    // Awaited: the picture's name has to be in the post the slot save is about to write down.
    const shot = await preparePostPhoto(filing.charId, reply.image)
    const comments = rollComments(filing.charId, reply.comments, shot?.shot.tier)
    filing.post = {
      ...filing.post,
      likes: postLikes(filing.charId, shot?.shot.tier),
      // Left off entirely where nobody answered, rather than an empty array in every post.
      ...(comments.length > 0 ? { comments } : {})
    }
    if (!shot) return
    // A post she took a picture for is filed held, and comes out once the picture exists.
    holdPostPhoto(filing.charId, filing.post, shot, nudge)
    filing.held = true
    filing.featured = true
  },

  postLikes: (ask) => {
    if (ask.kind === 'ending') return postLikes(ask.author)
    if (ask.kind === 'stranger') return strangerLikes(ask.author)
    const playthroughId = ask.playthroughId ?? useGameStore.getState().playthroughId
    return rollAudienceLikes({
      reach: reachOf(playthroughId, ask.author, ask.character),
      friends: ask.friends,
      photoTier: 'none'
    })
  },

  postVisible: postIsOut
})
