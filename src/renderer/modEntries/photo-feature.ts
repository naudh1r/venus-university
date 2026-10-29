import { PHOTO_FEATURE } from '@shared/mods'
import { reachOf, rollAudienceLikes } from '../../shared/postAudience'
import { postIsOut } from '../../shared/heldPosts'
import {
  photoLines,
  photoStub,
  PHOTO_SCHEMA_FIELDS,
  PHOTO_SCHEMA_REQUIRED,
  postCommentLines,
  postPhotoLines,
  posterPhotoLines,
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
import {
  feedFriendFor,
  feedFriendLines,
  fileGroupPhoto,
  withGroupPhotoRequest
} from '../stores/photoGroup'
import { useGameStore } from '../stores/gameStore'
import { registerTermFiles } from '@vx/modkit/shared'
import { ownsPostComments, registerHooks } from '@vx/modkit/renderer'
import { BODY_EDITOR_FIELD, writeBody } from '../views/bodyFields'
import { PhotoComments, PhotoPostPicture } from '../components/PhotoPostSpots'
import { MessagePhotoAttachment, PhotoLightboxHost } from '../components/PhotoBubble'
import { GalleryPanel, galleryShown, PostPhotoExtra } from '../views/ContactGallery'

/**
 * Photo Feature, plugged into the game through its hooks. Everything it adds to the game's own
 * files is here; the game only asks. The mods store skips it while it is off.
 */
registerHooks(PHOTO_FEATURE, {
  // A picture opened at full size, over the phone.
  phoneOverlay: PhotoLightboxHost,
  // Her picture in a bubble of its own after a message's words.
  messageAttachment: MessagePhotoAttachment,
  // The photo pill beside a post's like on her contact page.
  contactPostExtra: PostPhotoExtra,
  // Her gallery, as a tab beside Profile on her contact page.
  contactTab: { id: 'gallery', label: 'Gallery', Panel: GalleryPanel, shown: galleryShown },
  // Her body, as a field in the character editor.
  editorField: BODY_EDITOR_FIELD,
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
    // A girl texting first may send a picture with it, under the same gate as her replies.
    'slot-reach-outs': {
      lines: ({ character, info, date }) =>
        photoLines(
          character,
          info,
          { date, canRenderImages: canSendPhotos(), noNsfwImages: noExplicitPhotos() },
          'reachOut'
        ),
      fields: () => PHOTO_SCHEMA_FIELDS,
      required: () => PHOTO_SCHEMA_REQUIRED
    },
    'slot-posts': {
      // The replies are asked for only while Photo Feature is the mod drawing them.
      lines: () => [
        ...postPhotoLines(canSendPhotos()),
        ...(ownsPostComments(PHOTO_FEATURE) ? postCommentLines(true) : [])
      ],
      fields: () =>
        ownsPostComments(PHOTO_FEATURE)
          ? POST_PHOTO_SCHEMA_FIELD
          : { image: POST_PHOTO_SCHEMA_FIELD.image },
      required: () => (ownsPostComments(PHOTO_FEATURE) ? POST_PHOTO_SCHEMA_REQUIRED : ['image'])
    },
    // What each poster owns, for a post whose picture has her in it.
    'slot-poster': {
      lines: ({ character, date, time }) => [
        ...posterPhotoLines(character, canSendPhotos()),
        ...feedFriendLines(character, date, time)
      ]
    },
    character: {
      lines: () => bodyBriefLines(),
      fields: () => bodySchemaFields(),
      required: () => bodySchemaRequired()
    }
  },

  // Two of the scene's girls in a group photo, written by the scene's first call.
  requests: { scene: (request, { cast }) => withGroupPhotoRequest(request, cast) },
  afterSceneReply: (ctx) => fileGroupPhoto(ctx),

  dmHistoryNote: (message) =>
    photoStub(
      message,
      (text) => text,
      (charId) => useGameStore.getState().characters[charId]?.firstName
    ),

  // Only Photo writes draft ex; the character builder combines the mods' writes by plain spread.
  characterFromDraft: (draft, { baseAppearance }) =>
    writeBody(bodyOfDraft(draft.body as DraftBody | undefined, baseAppearance)),

  // Her picture, if she offered one and the save will have it. Left to finish on its own: a
  // render is half a minute, and her words have already landed.
  afterDmReply: ({ charId, character, reply }) => void sendPhoto(charId, character, reply),

  // The same for a girl texting first, read off her entry in the slot's opening: a custom
  // endpoint's JSON is not held to the schema, so each field is taken only as the type it should
  // be.
  afterReachOut: ({ charId, character, reply }) =>
    void sendPhoto(charId, character, {
      sendPhoto: reply.sendPhoto === true,
      photoPrompt: typeof reply.photoPrompt === 'string' ? reply.photoPrompt : '',
      ...(typeof reply.photoTier === 'string' ? { photoTier: reply.photoTier } : {})
    }),

  // The slot's held feed pictures, now that he is busy with something: they draw under the scene
  // and the posts are waiting on the feed when he is free again.
  playerActs: () => startHeldPostPhoto(),

  // A picture whose render outlived the save that asked for it: found on disk, or given up on.
  gameEntered: () => void settlePendingPhotos(),

  fileFeedPost: async (filing, { nudge }) => {
    const reply = filing.reply as { image?: string; groupWith?: unknown; comments?: unknown }
    // Awaited: the picture's name has to be in the post the slot save is about to write down.
    const shot = await preparePostPhoto(
      filing.charId,
      reply.image,
      // A group photo's friend, set by the mod itself on the post it added, or the friend rolled
      // for her picture as the opening was written.
      typeof reply.groupWith === 'string' ? reply.groupWith : feedFriendFor(filing.charId)
    )
    // Another mod drawing the replies has filed its own already.
    const comments = ownsPostComments(PHOTO_FEATURE)
      ? rollComments(filing.charId, reply.comments as string[] | undefined, shot?.shot.tier)
      : (filing.post.comments ?? [])
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

  postVisible: postIsOut,
  postOutAt: (post) => post.photo?.outAt,

  // Strangers' replies under a post, while no mod ahead of it in the list draws them instead.
  postComments: { View: PhotoComments },

  // Her picture under the post's text.
  postPicture: PhotoPostPicture
})

// A continued semester carries her threads and feed into a new playthrough; the pictures on them
// are files in the old one's folder, copied across as they are, PNG or WebP. Like the carried
// fields this runs with the mod off too, so switching it off at the wrong time loses nothing.
registerTermFiles(PHOTO_FEATURE, async ({ from, to }) => {
  const result = await window.api.photo.carry(from, to)
  if (!result.ok) throw Error(result.error.message)
})
