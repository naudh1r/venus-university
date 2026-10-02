import { motion } from 'motion/react'
import { Fragment, useState, type JSX } from 'react'
import { postIsOut } from '@shared/heldPosts'
import { photoUrl } from '@shared/photoFiles'
import type { ChatPhoto } from '@shared/photoTypes'
import type { TimeSlot } from '@shared/types'
import { openShot } from '../components/PhotoBubble'
import { newestFirst } from '../stores/feedRolls'
import { useGameStore } from '../stores/gameStore'
import { Card, Locked } from './ContactPage'
import { gestures, quietLift, quietPress } from './motion'
import { EyeIcon, EyeOffIcon } from './screenIcons'
import '../vu_styles/ContactGallery.css'

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

/** The two readings of her the page offers once she has pictures to show. */
type ContactTab = 'profile' | 'gallery'

const CONTACT_TABS: readonly { key: ContactTab; label: string }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'gallery', label: 'Gallery' }
]

/** What the page needs from the gallery: the strip, the panel, and which reading is open. */
export interface ContactGallery {
  /** The tab strip, drawn under her name. */
  tabs: JSX.Element
  /** True while the gallery is the reading being shown; the page draws its own cards otherwise. */
  showing: boolean
  /** The gallery itself, drawn in the profile cards' place. */
  panel: JSX.Element
}

/**
 * One picture in her gallery. An explicit one opens covered, the same rule the thread's own
 * bubble follows and for the same reason — a grid is more exposed than a thread, not less.
 */
function Shot({
  charId,
  playthroughId,
  file,
  tier,
  from
}: {
  charId: string
  playthroughId: string | null
  file: string
  tier: string
  from: ShotSource
}): JSX.Element {
  const [shown, setShown] = useState(tier !== 'explicit')
  if (!playthroughId) return <li className="vu-gallery-item" />

  const src = photoUrl(playthroughId, charId, file)
  return (
    <li className="vu-gallery-item vu-contact-shot-item">
      <motion.button
        className={`vu-gallery-cell vu-contact-shot${shown ? '' : ' vu-contact-shot--covered'}`}
        type="button"
        {...gestures(false, quietLift, quietPress)}
        onClick={() => (shown ? openShot(src) : setShown(true))}
      >
        {shown ? (
          <img className="vu-gallery-img" src={src} alt="" decoding="async" />
        ) : (
          <span className="vu-gallery-empty">TAP TO SEE</span>
        )}
        <span className="vu-contact-shot-from">{from === 'dm' ? 'DM' : 'Feed'}</span>
      </motion.button>
      {/* The thread's own eye, so an explicit one can be covered again once seen. Beside the cell
          rather than in it, since a button cannot sit inside another. */}
      {tier === 'explicit' && (
        <button
          type="button"
          className={`vu-bb-photo-eye vu-contact-shot-eye${shown ? '' : ' vu-bb-photo-eye--covered'}`}
          aria-pressed={!shown}
          aria-label={shown ? 'Cover the photo' : 'Uncover the photo'}
          title={shown ? 'Cover the photo' : 'Uncover the photo'}
          onClick={() => setShown(!shown)}
        >
          {shown ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
        </button>
      )}
    </li>
  )
}

/**
 * The gallery for one contact's page, as the three things that page has to draw.
 *
 * The grid's own classes — `vu-gallery-grid`, `-item`, `-cell`, `-img`, `-empty` — are the app's
 * existing ones from `base.css`, so nothing about the grid itself is ported: only what a
 * photograph adds to a cell, which is the covering.
 */
export function useContactGallery({
  charId,
  isContact
}: {
  charId: string
  isContact: boolean
}): ContactGallery {
  const [tab, setTab] = useState<ContactTab>('profile')
  const [filter, setFilter] = useState<ShotFilter>('all')
  const playthroughId = useGameStore((s) => s.playthroughId)
  const conversation = useGameStore((s) => s.bunnyboard.conversations[charId])
  const feed = useGameStore((s) => s.charInfo[charId]?.feed)

  // The thread's newest first, then merged with her posts by the slot each was sent in. The sort
  // is stable, so two pictures from one slot keep the order they arrived in.
  const sent: GalleryShot[] = [...(conversation?.messages ?? [])].reverse().flatMap((message) =>
    message.photo?.file
      ? [
          {
            id: message.id,
            photo: message.photo,
            file: message.photo.file,
            from: 'dm' as const,
            date: message.date,
            time: message.time
          }
        ]
      : []
  )
  const posted: GalleryShot[] = (feed ?? []).filter(postIsOut).flatMap((post) =>
    post.photo?.file
      ? [
          {
            id: `post:${post.id}`,
            photo: post.photo,
            file: post.photo.file,
            from: 'feed' as const,
            date: post.date,
            time: post.time
          }
        ]
      : []
  )
  const photos = [...sent, ...posted].sort(newestFirst)
  const shown = filter === 'all' ? photos : photos.filter((shot) => shot.from === filter)

  /* Two readings of the same girl, named the way every section on this page is named: the one
     being read in accent, the other quiet. No pill and no underline — this screen holds one boxed
     thing per card, and a third surface would make it a pile. */
  const tabs = (
    <div className="vu-contact-tabs">
      {CONTACT_TABS.map(({ key, label }, index) => (
        <Fragment key={key}>
          {index > 0 && <span className="vu-contact-tabs-slash">/</span>}
          <motion.button
            className={`vu-contact-tab${tab === key ? ' vu-contact-tab--on' : ''}`}
            type="button"
            aria-pressed={tab === key}
            {...gestures(false, quietLift, quietPress)}
            onClick={() => setTab(key)}
          >
            {label}
          </motion.button>
        </Fragment>
      ))}
    </div>
  )

  const panel = (
    <Card
      className="vu-contact-card--gallery"
      label={isContact ? `Gallery · ${photos.length}` : 'Gallery'}
    >
      {!isContact ? (
        <Locked>??? — Unlocked after adding</Locked>
      ) : photos.length === 0 ? (
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
              {filter === 'dm' ? 'No photos in DMs yet.' : 'No photos on her feed yet.'}
            </p>
          ) : (
            <ul className="vu-gallery-grid vu-contact-shots">
              {shown.map((shot) => (
                <Shot
                  key={shot.id}
                  charId={charId}
                  playthroughId={playthroughId}
                  file={shot.file}
                  tier={shot.photo.tier}
                  from={shot.from}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  )

  return { tabs, showing: tab === 'gallery', panel }
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
  photo: ChatPhoto | undefined
}): JSX.Element | null {
  const playthroughId = useGameStore((s) => s.playthroughId)
  if (!playthroughId || !photo?.file) return null
  const src = photoUrl(playthroughId, charId, photo.file)
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
