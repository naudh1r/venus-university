import { PHOTO_FEATURE } from '@shared/mods'
import type { ChatPhoto } from '@shared/photoTypes'
import type { PostComment } from '@shared/postComments'
import { MessagePhotoBubble, PhotoLightboxHost, PostPhoto } from '../components/PhotoBubble'
import { PostComments } from '../components/PostComments'
import { registerHooks } from './hooks'

/** What Photo Feature draws into the game's screens, through their slots. */
registerHooks(PHOTO_FEATURE, {
  screens: {
    // A picture is its own message, the way a phone sends one: her words in one bubble and the
    // photograph in the next, rather than a snapshot pasted under a sentence.
    'dm-message': ({ message }) =>
      message.photo && message.sender !== 'system' ? (
        <MessagePhotoBubble photo={message.photo} sender={message.sender} messageId={message.id} />
      ) : null,

    'feed-post': ({ charId, post }) => {
      // The row's shape is the feed's own; the picture and the replies are this mod's fields on it.
      const { photo, comments } = post as { photo?: ChatPhoto; comments?: PostComment[] }
      return (
        <>
          {photo && charId && post.id && (
            <div className="vu-bb-post-shot">
              <PostPhoto charId={charId} postId={post.id} photo={photo} />
            </div>
          )}
          {comments && <PostComments comments={comments} />}
        </>
      )
    },

    // The picture opened full size, over the whole Bunnyboard.
    'bunnyboard-overlay': PhotoLightboxHost
  }
})
