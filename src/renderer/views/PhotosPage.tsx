import { useEffect, useState, type JSX } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { pictureKeySet } from '@shared/settingsRules'
import { formatShortGameDate, slotHalf } from '../prompts/gameDate'
import { ConfirmModal } from '../components/ConfirmModal'
import { DeadNote } from '../components/DeadNote'
import { DeleteX } from '../components/DeleteX'
import { PhotoFailedModal } from '../components/PhotoFailedModal'
import { useBunnyboardStore } from '../stores/bunnyboardStore'
import { useGameStore } from '../stores/gameStore'
import { useSettingsStore } from '../stores/settingsStore'
import {
  firstPhotoFailure,
  newPhotoDraft,
  photoDraftOf,
  usePhotoStore,
  type GalleryPhoto,
  type PhotoDraft
} from '../stores/photoStore'
import { CreatePhotoModal } from './CreatePhotoModal'
import { PhotoProgressModal } from './PhotoProgressModal'
import { PhotoViewerModal } from './PhotoViewerModal'
import { dealt, gestures, quietLift, quietPress, slideInQuick, spin } from './motion'
import { PlusIcon } from './screenIcons'
import '../vu_styles/Photos.css'

export interface PhotosPageProps {
  theme: 'day' | 'night'
}

/** The grid dealing itself in, on the tab pages' own clock. Module scope. */
const GRID_DEAL = dealt(0, 0.03)

/** One photo cell: the thumbnail, and a hover-revealed ✕ that removes it. */
function PhotoCell({
  photo,
  onOpen,
  onDelete
}: {
  photo: GalleryPhoto
  onOpen: () => void
  onDelete: () => void
}): JSX.Element {
  const [hovered, setHovered] = useState(false)
  return (
    <motion.li
      className="vu-gallery-item vu-gallery-item--removable"
      variants={slideInQuick}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
    >
      <motion.button
        className="vu-gallery-cell"
        type="button"
        aria-label="Open photo"
        {...gestures(false, quietLift, quietPress)}
        onClick={onOpen}
      >
        {photo.thumbUrl && <img className="vu-gallery-img" src={photo.thumbUrl} alt="" />}
      </motion.button>
      <DeleteX className="vu-x vu-gallery-x" hovered={hovered} label="Delete this photo" onDelete={onDelete} />
      <span className="vu-gallery-caption">
        {photo.meta ? `${formatShortGameDate(photo.meta.date)} · ${slotHalf(photo.meta.time)}` : ' '}
      </span>
    </motion.li>
  )
}

/**
 * The Bunnyboard's Photos tab: the "+" that opens Create Photo, a cell per job still being
 * drawn, and the playthrough's photos newest first.
 */
export function PhotosPage({ theme }: PhotosPageProps): JSX.Element {
  const playthroughId = useGameStore((s) => s.playthroughId)
  const settings = useSettingsStore((s) => s.settings)

  const gallery = usePhotoStore((s) => s.gallery)
  const jobs = usePhotoStore((s) => s.jobs)
  const watching = usePhotoStore((s) => s.watching)
  const landed = usePhotoStore((s) => s.landed)
  const composing = usePhotoStore((s) => s.composing)
  const failures = usePhotoStore((s) => s.failures)
  const loadGallery = usePhotoStore((s) => s.loadGallery)
  const dropGallery = usePhotoStore((s) => s.dropGallery)
  const watch = usePhotoStore((s) => s.watch)
  const setComposing = usePhotoStore((s) => s.setComposing)
  const clearLanded = usePhotoStore((s) => s.clearLanded)
  const deletePhoto = usePhotoStore((s) => s.deletePhoto)
  const retry = usePhotoStore((s) => s.retry)
  const editFailure = usePhotoStore((s) => s.edit)
  const dismissFailure = usePhotoStore((s) => s.dismiss)

  const armedHangout = useBunnyboardStore((s) => s.armedHangout)
  const locked = useBunnyboardStore((s) => s.locked)

  /** The draft Create Photo is open on, or null while it is shut. */
  const [creating, setCreating] = useState<PhotoDraft | null>(null)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<GalleryPhoto | null>(null)

  useEffect(() => {
    if (!playthroughId) return
    void loadGallery(playthroughId)
    return () => dropGallery()
  }, [playthroughId])

  // Sends the watched job to the background rather than dropping it — closing the phone is not
  // stopping the job, only leaving the screen that shows it.
  useEffect(
    () => () => {
      const state = usePhotoStore.getState()
      const job = state.jobs.find((entry) => entry.jobId === state.watching)
      if (job && job.playthroughId === playthroughId) state.watch(null)
    },
    [playthroughId]
  )

  useEffect(() => {
    if (composing) {
      if (playthroughId) setCreating(photoDraftOf(playthroughId))
      setComposing(false)
    }
  }, [composing])

  const photos = gallery?.playthroughId === playthroughId ? gallery.photos : []

  useEffect(() => {
    if (landed && photos.some((photo) => photo.photoId === landed)) {
      setViewingId(landed)
      clearLanded()
    }
  }, [landed, photos])

  const jobsHere = jobs.filter((job) => job.playthroughId === playthroughId)
  const watchingJob = jobs.find((job) => job.jobId === watching)
  const generatingShown = watchingJob?.playthroughId === playthroughId

  const dead = !settings || !pictureKeySet(settings)

  const noOwnModalUp = creating === null && !generatingShown && viewingId === null && !deleting
  const failure =
    noOwnModalUp && !armedHangout && !locked ? firstPhotoFailure(failures, playthroughId) : null

  return (
    <div className="vu-bb-page">
      <div className="vu-title vu-bb-title">
        <h2 className="vu-title-text">Photos</h2>
      </div>

      <div className="vu-bb-scroll">
        <div className="vu-bb-section">Photos · {photos.length}</div>
        <motion.ul className="vu-gallery-grid vu-photos-grid" variants={GRID_DEAL} initial="hidden" animate="shown">
          <motion.li className="vu-gallery-item" variants={slideInQuick}>
            <DeadNote note={dead ? 'Requires Image API key' : null}>
              <motion.button
                id="photos-create"
                className="vu-gallery-cell vu-gallery-cell--empty vu-photos-new"
                type="button"
                aria-label="Create photo"
                disabled={dead}
                {...gestures(dead, quietLift, quietPress)}
                onClick={() => {
                  if (playthroughId) setCreating(newPhotoDraft(playthroughId))
                }}
              >
                <PlusIcon size={40} />
              </motion.button>
            </DeadNote>
            <span className="vu-gallery-caption">{' '}</span>
          </motion.li>

          {jobsHere.map((job) => (
            <motion.li key={job.jobId} className="vu-gallery-item" variants={slideInQuick}>
              <button
                className="vu-gallery-cell vu-photos-developing"
                type="button"
                aria-label="Open the photo being developed"
                onClick={() => watch(job.jobId)}
              >
                <motion.span className="vu-ring vu-photos-developing-ring" animate={spin} />
                <span className="vu-photos-developing-word">DEVELOPING</span>
              </button>
              <span className="vu-gallery-caption">{' '}</span>
            </motion.li>
          ))}

          {photos.map((photo) => (
            <PhotoCell
              key={photo.photoId}
              photo={photo}
              onOpen={() => setViewingId(photo.photoId)}
              onDelete={() => setDeleting(photo)}
            />
          ))}
        </motion.ul>
      </div>

      {/* Create, its Generating modal and the viewer a watched photo lands in follow one another,
          so they share one presence in wait mode and the next never arrives over the last. */}
      <AnimatePresence propagate mode="wait">
        {playthroughId && creating !== null ? (
          <CreatePhotoModal
            key="create-photo"
            theme={theme}
            playthroughId={playthroughId}
            initialDraft={creating}
            onClose={() => setCreating(null)}
          />
        ) : generatingShown && watchingJob ? (
          <PhotoProgressModal
            key="photo-progress"
            theme={theme}
            jobId={watchingJob.jobId}
            startedAt={watchingJob.startedAt}
          />
        ) : playthroughId && viewingId ? (
          <PhotoViewerModal
            key="photo-viewer"
            theme={theme}
            playthroughId={playthroughId}
            photoId={viewingId}
            photos={photos}
            onClose={() => setViewingId(null)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence propagate>
        {playthroughId && deleting && (
          <ConfirmModal
            key="photo-delete"
            id="photo-delete-confirm"
            theme={theme}
            title="Delete this photo?"
            message="The photo is permanently deleted."
            confirmText="Delete photo"
            onCancel={() => setDeleting(null)}
            onConfirm={() => {
              void deletePhoto(playthroughId, deleting.photoId)
              setDeleting(null)
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence propagate>
        {playthroughId && failure && (
          <PhotoFailedModal
            key={failure.job.jobId}
            id={`photo-failed-${failure.job.jobId}`}
            theme={theme}
            failure={failure}
            onRetry={() => retry(failure, true)}
            onEdit={() => editFailure(failure)}
            onDismiss={() => dismissFailure(failure)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
