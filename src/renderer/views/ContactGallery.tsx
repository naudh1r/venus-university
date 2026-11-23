import { motion } from 'motion/react'
import { Fragment, useEffect, useState, type JSX } from 'react'
import { postIsOut } from '../../shared/heldPosts'
import { useRevisedPhotoUrl } from '../stores/photoRevision'
import { photoUrl } from '../../shared/photoFiles'
import type { ChatPhoto } from '../../shared/photoTypes'
import type { SocialPost, TimeSlot } from '@vx/modkit/shared'
import { PhotoInfoButton, PhotoRedrawFailure } from '../components/PhotoInfo'
import { photoRedrawKey, usePhotoRedraw, usePhotoRedrawReason, usePhotoRedrawOrientation } from '../stores/photoRedraw'
import { redrawMessagePhoto } from '../stores/photoTurn'
import { redrawPostPhoto } from '../stores/photoPost'
import { PhotoWait, openShot } from '../components/PhotoBubble'
import {
  newestFirst,
  Card,
  gestures,
  Locked,
  modIsOn,
  quietLift,
  quietPress,
  type ContactTabProps,
  EyeIcon,
  EyeOffIcon
} from '@vx/modkit/renderer'
import { useExplicitBlocked, usePhotosVisible } from '../stores/photoSwitchHooks'
import { useCharacter, useGameFacts, useConversation, useFeed } from '@vx/modkit/renderer'
import { messagePhoto, postPhoto } from '../stores/photoRecords'
import { photosVisible } from '../../shared/photoSwitches'
import { loadedPhotoOrientation, useExpectedPhotoOrientation, usePhotoOrientation } from '../stores/photoOrientation'
import '../vu_styles/ContactGallery.css'

/** A tile's hover: a 4% lift stays inside the grid's 16px gaps, for portrait and wide tiles alike. */
const TILE_LIFT = { ...quietLift, scale: 1.04 }

/**
 * Her gallery: every picture of her, the ones she sent on the thread and the ones she posted on
 * the feed, newest first, each marked with where it came from.
 *
 * The tab strip comes with it. `ContactPage` had no tabs before this feature — the page was one
 * reading of her — so the strip is the gallery's own, and the hook on that page is four lines:
 * a call to {@link useContactGallery}, its `tabs` in the header, and its `panel` in place of the
 * profile cards while the gallery is the one being read.
 */

/** Where a picture in her gallery was sent: on the thread, or on the feed. */
type ShotSource = 'dm' | 'feed'

interface GalleryShot {
  id: string
  photo: ChatPhoto
  itemId: string
  file: string
  from: ShotSource
  date: number
  time: TimeSlot
}

/** Which of her pictures the gallery is showing: all of them, or one source's. */
type ShotFilter = 'all' | ShotSource

const SHOT_FILTERS: readonly { key: ShotFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'dm', label: 'DM' },
  { key: 'feed', label: 'Feed' }
]

/**
 * A named picture keeps its tile while it is drawn or after a failure. Held posts are still
 * excluded by the feed visibility rule before reaching this grid.
 */
function namedPhoto(photo: ChatPhoto | null | undefined): photo is ChatPhoto & { file: string } {
  return Boolean(photo?.file)
}

/**
 * One picture in her gallery. An explicit one opens covered, the same rule the thread's own
 * bubble follows and for the same reason — a grid is more exposed than a thread, not less.
 */
function Shot({
  charId,
  playthroughId,
  file,
  photo,
  itemId,
  from
}: {
  charId: string
  playthroughId: string | null
  file: string
  photo: ChatPhoto
  itemId: string
  from: ShotSource
}): JSX.Element | null {
  const tier = photo.tier
  const character = useCharacter(charId)
  const friend = useCharacter(photo.with ?? '')
  const key = photoRedrawKey(playthroughId, charId, file)
  const redraw = usePhotoRedraw(key)
  const refusal = usePhotoRedrawReason(key)
  const requested = usePhotoRedrawOrientation(key)
  const src = useRevisedPhotoUrl(playthroughId ? photoUrl(playthroughId, charId, file) : null)
  const loaded = usePhotoOrientation(src)
  const expected = useExpectedPhotoOrientation(photo, src)
  const orientation = (redraw === 'drawing' ? requested : undefined) ?? loaded ?? expected
  const [opened, setShown] = useState(tier !== 'explicit')
  // An undressed picture while they are forbidden stays covered, and cannot be opened.
  const explicitBlocked = useExplicitBlocked()
  const locked = tier === 'explicit' && explicitBlocked
  const shown = opened && !locked
  // A picture the save names but the folder does not hold — one a save brought along without
  // its pictures — is left out of the grid rather than drawn as an empty frame.
  const [missing, setMissing] = useState(false)
  useEffect(() => { setMissing(false) }, [src])
  if (!playthroughId) return <li className="vu-gallery-item" />
  if (missing) return null

  return (
    <motion.li
      className={`vu-gallery-item vu-contact-shot-item${orientation === 'wide' ? ' vu-contact-shot-item--wide' : ''}`}
      {...gestures(locked, TILE_LIFT, quietPress)}
    >
      {redraw === 'drawing' || photo.pending ? (
        <div className="vu-contact-shot-wait">
          <PhotoWait orientation={orientation} />
        </div>
      ) : photo.failed ? (
        <div className="vu-contact-shot-wait">
          <div className={`vu-bb-photo vu-bb-photo--failed${orientation === 'wide' ? ' vu-bb-photo--wide' : ''}`}>
            The photo never came through.
          </div>
        </div>
      ) : (
        <button
          className="vu-gallery-cell vu-contact-shot"
          type="button"
          disabled={locked}
          title={locked ? 'Explicit photos are switched off' : undefined}
          onClick={() => (shown ? openShot(src!) : setShown(true))}
        >
          {/* Covered the way the thread covers it: the picture itself, blurred past reading. */}
          <img
            className={`vu-gallery-img${shown ? '' : ' vu-contact-shot-img--veiled'}`}
            src={src!}
            alt=""
            decoding="async"
            onLoad={(event) => loadedPhotoOrientation(event.currentTarget)}
            onError={() => setMissing(true)}
          />
        </button>
      )}
      <span className="vu-contact-shot-from">{from === 'dm' ? 'DM' : 'Feed'}</span>
      {/* The thread's own eye, so an explicit one can be covered again once seen. Beside the cell
          rather than in it, since a button cannot sit inside another. */}
      {redraw !== 'drawing' && !photo.pending && !photo.failed && tier === 'explicit' && !locked && (
        <button
          type="button"
          className={`vu-bb-photo-eye vu-contact-shot-eye${shown ? '' : ' vu-bb-photo-eye--covered'}`}
          aria-pressed={!shown}
          aria-label={shown ? 'Cover the photo' : 'Uncover the photo'}
          title={shown ? 'Cover the photo' : 'Uncover the photo'}
          onPointerDownCapture={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            setShown(!shown)
          }}
        >
          {shown ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
        </button>
      )}
      {shown && !photo.pending && !photo.failed && character && (!photo.with || friend) && (
        <PhotoInfoButton
          playthroughId={playthroughId}
          character={character}
          friend={friend}
          photo={{ ...photo, file }}
          redrawing={redraw === 'drawing'}
          onRedraw={(options) => {
            if (from === 'dm') void redrawMessagePhoto(charId, itemId, options)
            else void redrawPostPhoto(charId, itemId, options)
          }}
        />
      )}
      <PhotoRedrawFailure failed={redraw === 'failed'} reason={refusal} />
    </motion.li>
  )
}

/**
 * The gallery for one contact's page, as the three things that page has to draw.
 *
 * The grid's own classes — `vu-gallery-grid`, `-item`, `-cell`, `-img`, `-empty` — are the app's
 * existing ones from `base.css`, so nothing about the grid itself is ported: only what a
 * photograph adds to a cell, which is the covering.
 */
/** Her gallery, as a tab beside Profile on her contact page. */
export function GalleryPanel({ charId, isContact }: ContactTabProps): JSX.Element {
  const [filter, setFilter] = useState<ShotFilter>('all')
  const visible = usePhotosVisible()
  const playthroughId = useGameFacts().playthroughId
  const conversation = useConversation(charId)
  const feed = useFeed(charId)

  const messages = conversation?.messages ?? []

  // The thread's newest first, then merged with her posts by the slot each was sent in. The sort
  // is stable, so two pictures from one slot keep the order they arrived in.
  const sent: GalleryShot[] = [...messages].reverse().flatMap((message) => {
    const photo = messagePhoto.read(message)
    return namedPhoto(photo)
      ? [
          {
            id: message.id,
            itemId: message.id,
            photo,
            file: photo.file,
            from: 'dm' as const,
            date: message.date,
            time: message.time
          }
        ]
      : []
  })
  const posted: GalleryShot[] = (feed ?? []).filter(postIsOut).flatMap((post) => {
    const photo = postPhoto.read(post)
    return namedPhoto(photo)
      ? [
          {
            id: `post:${post.id}`,
            itemId: post.id,
            photo,
            file: photo.file,
            from: 'feed' as const,
            date: post.date,
            time: post.time
          }
        ]
      : []
  })
  // One tile per picture: an older bubble can point at the same file as a newer one, when a
  // save carried over without its pictures let the name be given out again. The newest is the
  // one the picture was drawn for.
  const seen = new Set<string>()
  const photos = [...sent, ...posted].sort(newestFirst).filter((shot) => {
    if (seen.has(shot.file)) return false
    seen.add(shot.file)
    return true
  })
  const shown = filter === 'all' ? photos : photos.filter((shot) => shot.from === filter)

  return (
    <Card
      className="vu-contact-card--gallery"
      label={isContact ? `Gallery · ${photos.length}` : 'Gallery'}
    >
      {!isContact ? (
        <Locked>??? — Unlocked after adding</Locked>
      ) : !visible ? null : photos.length === 0 ? (
        <p className="vu-contact-empty">No photos yet.</p>
      ) : (
        <>
          {/* Same voice as the page's own two tabs: type, with the one being read in accent. */}
          <div className="vu-contact-tabs vu-contact-shot-filter">
            {SHOT_FILTERS.map(({ key, label }, index) => (
              <Fragment key={key}>
                {index > 0 && <span className="vu-contact-tabs-slash">/</span>}
                <motion.button
                  className={`vu-contact-tab${filter === key ? ' vu-contact-tab--on' : ''}`}
                  type="button"
                  aria-pressed={filter === key}
                  {...gestures(false, quietLift, quietPress)}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </motion.button>
              </Fragment>
            ))}
          </div>
          {shown.length === 0 ? (
            <p className="vu-contact-empty">
              {filter === 'dm' ? 'No photos in DMs yet.' : 'No photos on this feed yet.'}
            </p>
          ) : (
            <div className="vu-contact-shot-grid">
              <ul className="vu-gallery-grid vu-contact-shots">
                {shown.map((shot) => (
                  <Shot
                    key={shot.id}
                    charId={charId}
                    playthroughId={playthroughId}
                    file={shot.file}
                    photo={shot.photo}
                    itemId={shot.itemId}
                    from={shot.from}
                  />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Card>
  )
}

/**
 * The way to a post's picture from the feed list on her profile, which is text only: a small pill
 * beside the post's date that opens the picture at full size. Nothing for a post without one, or
 * one whose render has not landed.
 */
export function PostPhotoLink({
  charId,
  photo
}: {
  charId: string
  photo: ChatPhoto | null | undefined
}): JSX.Element | null {
  const playthroughId = useGameFacts().playthroughId
  const visible = usePhotosVisible()
  const src = useRevisedPhotoUrl(playthroughId && photo?.file ? photoUrl(playthroughId, charId, photo.file) : null)
  if (!visible || !src) return null
  return (
    <motion.button
      className="vu-contact-like vu-contact-photo"
      type="button"
      aria-label="Open the photo"
      {...gestures(false, quietLift, quietPress)}
      onClick={() => openShot(src)}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <circle cx="9" cy="10" r="1.6" />
        <path d="M21 16l-5-5-8 8" />
      </svg>
      Photo
    </motion.button>
  )
}

/** Whether her gallery's tab stands on her page: while the mod's photos show, or Echo's do. */
export function galleryShown(): boolean {
  return photosVisible() || modIsOn('echo')
}

/** The photo pill beside a post's like on her contact page, after a space. */
export function PostPhotoExtra({ charId, post }: { charId: string; post: SocialPost }): JSX.Element | null {
  const photo = postPhoto.read(post)
  if (!photo?.file) return null
  return (
    <>
      {' '}
      <PostPhotoLink charId={charId} photo={photo} />
    </>
  )
}
