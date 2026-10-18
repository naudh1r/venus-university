import { useEffect, useMemo, useRef, useState, type CSSProperties, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'
import { motion } from 'motion/react'
import { hashString } from '@shared/hash'
import { shownComments, type PostComment } from '@shared/postComments'
import { fullNameOf } from '@shared/types'
import { isFeedContact } from '../stores/feedView'
import { profileUrl, useSpriteVersion } from '../stores/characterStore'
import { useGameStore } from '../stores/gameStore'
import { leavePlayerComment } from '../stores/bunnyfeedsThreads'
import { epilogueOf, sceneActiveOf } from '../stores/textingLoop'
import type { PostCommentsProps } from '../mods/hooks'
import { fadeIn, gestures, lift, press, quietLift, quietPress } from '../views/motion'
import { CloseIcon, HeartIcon } from '../views/screenIcons'
import { formatShortGameDate, slotHalf } from '../prompts/gameDate'
import { PostPicture } from './PostSpots'
import { armFeedThreads } from '../stores/bunnyfeedsThreads'
import { takeCommented } from '../stores/bunnyfeedsVisit'
import { useBunnyboardStore } from '../stores/bunnyboardStore'
import '../vu_styles/PopList.css'
import '../vu_styles/Bunnyfeeds.css'

/** The post whose full view is open, if any; one at a time across the whole feed. */
const usePostView = create<{
  open: { charId: string; postId: string } | null
  show: (open: { charId: string; postId: string } | null) => void
}>((set) => ({ open: null, show: (open) => set({ open }) }))

// The phone closing takes the post view with it, so it is not waiting there next time.
useBunnyboardStore.subscribe((state, before) => {
  if (before.open && !state.open) usePostView.getState().show(null)
})

/** A thread's comments as drawn: the ones on the post, and under each the replies to its chain. */
function grouped(said: readonly PostComment[]): {
  roots: PostComment[]
  repliesTo: Map<string, PostComment[]>
} {
  const byId = new Map(said.map((one) => [one.id, one]))
  const rootOf = (one: PostComment): string => {
    let at = one
    for (let hops = 0; at.replyTo && byId.has(at.replyTo) && hops < said.length; hops++) {
      at = byId.get(at.replyTo) as PostComment
    }
    return at.id
  }
  const roots = said.filter((one) => !one.replyTo || !byId.has(one.replyTo))
  const repliesTo = new Map<string, PostComment[]>()
  for (const one of said) {
    if (!one.replyTo || !byId.has(one.replyTo)) continue
    const root = rootOf(one)
    repliesTo.set(root, [...(repliesTo.get(root) ?? []), one])
  }
  return { roots, repliesTo }
}

/** The comments that have arrived under a post, read off the clock. */
function useShown(comments: readonly PostComment[]): PostComment[] {
  const date = useGameStore((s) => s.date)
  const time = useGameStore((s) => s.time)
  return shownComments(comments, date, time)
}

/** Whether he may write under this post: a contact's own, outside the epilogue and any scene. */
function useCanComment({ charId, postId, stranger }: PostCommentsProps): boolean {
  const epilogue = useGameStore(epilogueOf)
  // Closed exactly when texting is, so the phone answers the same everywhere.
  const sceneActive = useGameStore(sceneActiveOf)
  return Boolean(charId && postId && !stranger && !epilogue && !sceneActive)
}

/**
 * In the feed: one comment, his own if he left one and else the newest, and the way into the
 * post's full view. The rest of the thread is read there.
 */
export function FeedPreview(props: PostCommentsProps): JSX.Element | null {
  const said = useShown(props.comments)
  const show = usePostView((s) => s.show)
  if (said.length === 0 || !props.charId || !props.postId) return null
  const { roots, repliesTo } = grouped(said)
  const preview = [...roots].reverse().find((one) => one.player) ?? roots[roots.length - 1]
  const replies = repliesTo.get(preview.id)?.length ?? 0
  const open = (): void => show({ charId: props.charId ?? '', postId: props.postId ?? '' })

  return (
    <div className="vu-bb-thread">
      {said.length > 1 && (
        <motion.button
          type="button"
          className="vu-bf-comment-reply vu-bf-comment-open"
          {...gestures(false, quietLift, quietPress)}
          onClick={open}
        >
          View all {said.length} comments
        </motion.button>
      )}
      <CommentRow comment={preview} />
      {replies > 0 && (
        <motion.button
          type="button"
          className="vu-bf-comment-reply vu-bf-comment-more"
          {...gestures(false, quietLift, quietPress)}
          onClick={open}
        >
          ↳ {replies === 1 ? '1 reply' : `${replies} replies`}
        </motion.button>
      )}
    </div>
  )
}

/** Beside the like: the comment count, which opens the post's full view, and that view. */
export function CommentPill(props: PostCommentsProps): JSX.Element | null {
  const said = useShown(props.comments)
  const canComment = useCanComment(props)
  const open = usePostView((s) => s.open)
  const show = usePostView((s) => s.show)
  const { charId, postId } = props
  if (!charId || !postId || (said.length === 0 && !canComment)) return null
  const isOpen = open?.charId === charId && open.postId === postId

  return (
    <>
      <motion.button
        type="button"
        className="vu-bb-like"
        aria-label="Comments"
        {...gestures(false, quietLift, quietPress)}
        onClick={() => show({ charId, postId })}
      >
        <BubbleIcon />
        {said.length}
      </motion.button>
      {isOpen && <PostView {...props} charId={charId} postId={postId} />}
    </>
  )
}

/** The speech bubble the comment count wears, drawn like the heart beside it. */
function BubbleIcon(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M4 5h16v11H9l-5 4z" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * One post and its whole thread, popped up over the whole screen as a photo is. Closing it ends the visit as
 * closing the phone does: whatever he wrote while it was open is sent to be answered.
 */
function PostView(props: PostCommentsProps & { charId: string; postId: string }): JSX.Element | null {
  const { charId, postId } = props
  const show = usePostView((s) => s.show)
  const character = useGameStore((s) => s.characters[charId])
  const handle = useGameStore((s) => s.charInfo[charId]?.handle)
  const post = useGameStore((s) => s.charInfo[charId]?.feed?.find((one) => one.id === postId))
  const season = useGameStore((s) => s.calendar.season)
  const canComment = useCanComment(props)
  const sceneActive = useGameStore(sceneActiveOf)
  // Over the whole screen, as a photo opens: the phone's veil is the layer it lies on.
  const veil = document.querySelector('.vu-bb')?.parentElement
  if (!veil || !character || !post) return null

  const commented = (post.comments ?? []).some((one) => one.player && !one.replyTo)

  const close = (): void => {
    show(null)
    if (takeCommented()) void armFeedThreads('next')
  }

  return createPortal(
    <motion.div
      className="vu-bb-postveil"
      variants={fadeIn(0, 0.18)}
      initial="hidden"
      animate="shown"
      onClick={close}
    >
    <div
      className="vu-bb-postview"
      role="dialog"
      aria-label={`${character.firstName}'s post`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return
        // The view goes, not the phone behind it.
        e.stopPropagation()
        close()
      }}
    >
      <div className="vu-bb-postview-head">
        <span className="vu-bb-postview-title">{character.firstName}&apos;s post</span>
        <motion.button
          type="button"
          className="vu-circle vu-bb-postview-close"
          aria-label="Close post"
          {...gestures(false, quietLift, quietPress)}
          onClick={close}
        >
          <CloseIcon />
        </motion.button>
      </div>
      <div className="vu-bb-postview-body">
        <div className="vu-bb-postview-who">
          <RosterFace charId={charId} />
          <div>
            <div className="vu-bb-postview-name">{fullNameOf(character)}</div>
            <div className="vu-bb-postview-meta">
              {handle && <span>@{handle} · </span>}
              {formatShortGameDate(post.date, season)} · {slotHalf(post.time)}
            </div>
          </div>
        </div>
        <p className="vu-bb-post-text">{post.text}</p>
        <PostPicture charId={charId} postId={postId} />
        <div className="vu-bb-post-actions">
          <motion.button
            className={`vu-bb-like${post.liked ? ' vu-bb-like--on' : ''}`}
            type="button"
            aria-pressed={Boolean(post.liked)}
            {...gestures(false, quietLift, quietPress)}
            onClick={() => useGameStore.getState().toggleFeedLike(charId, postId)}
          >
            <HeartIcon />
            {post.likes + (post.liked ? 1 : 0)}
          </motion.button>
        </div>
        <Thread comments={post.comments ?? []} posterId={charId} postId={postId} canComment={canComment} />
      </div>
      {!canComment && sceneActive && !props.stranger && (
        <div className="vu-bb-postview-foot">
          <input
            className="vu-input vu-bf-comment-input"
            disabled
            aria-label="Comment"
            placeholder="You should probably focus on what's in front of you."
          />
        </div>
      )}
      {canComment && (
        <div className="vu-bb-postview-foot">
          {/* One comment on the post itself; the conversation carries on in its thread. */}
          {commented ? (
            <input
              className="vu-input vu-bf-comment-input"
              disabled
              aria-label="Comment"
              placeholder="You've commented on this post. Reply in its thread to keep going."
            />
          ) : (
            <CommentField
              posterId={charId}
              replyTo={null}
              onSend={(text, tags) => leavePlayerComment(charId, postId, text, undefined, tags)}
            />
          )}
        </div>
      )}
    </div>
    </motion.div>,
    veil
  )
}

/**
 * The whole thread in the post view. Replies sit folded under each comment until opened, his own
 * comments' open from the start; Reply, his own comments' included, opens a well under its replies.
 */
function Thread({
  comments,
  posterId,
  postId,
  canComment
}: {
  comments: readonly PostComment[]
  posterId: string
  postId: string
  canComment: boolean
}): JSX.Element | null {
  const said = useShown(comments)
  // The thread a reply goes under, and the comment whose author it opens addressed to.
  const [replying, setReplying] = useState<{ root: PostComment; to: PostComment } | null>(null)
  const [unfolded, setUnfolded] = useState<ReadonlySet<string>>(new Set())
  if (said.length === 0) return null
  const { roots, repliesTo } = grouped(said)
  const byId = new Map(said.map((one) => [one.id, one]))
  const reader = useReaderHandle()
  // Whom a reply answers, named by the game off its target: his own carry the @ he typed.
  const toOf = (one: PostComment): string | undefined => {
    const target = one.player || !one.replyTo ? undefined : byId.get(one.replyTo)
    return target ? (target.player ? reader : `@${target.handle}`) : undefined
  }

  return (
    <ul className="vu-bf-comments">
      {roots.map((root) => {
        const replies = repliesTo.get(root.id) ?? []
        const answering = replying?.root === root
        const open = root.player || unfolded.has(root.id) || answering
        return (
          <li className="vu-bf-comment-group" key={root.id}>
            <CommentRow
              comment={root}
              onReply={canComment ? () => setReplying({ root, to: root }) : undefined}
            />
            {replies.length > 0 && !open && (
              <motion.button
                type="button"
                className="vu-bf-comment-reply vu-bf-comment-more"
                {...gestures(false, quietLift, quietPress)}
                onClick={() => setUnfolded(new Set([...unfolded, root.id]))}
              >
                ⌄ View {replies.length === 1 ? '1 reply' : `${replies.length} replies`}
              </motion.button>
            )}
            {open && (replies.length > 0 || answering) && (
              <ul className="vu-bf-comments vu-bf-comments--replies">
                {replies.map((one) => (
                  <li key={one.id}>
                    <CommentRow
                      comment={one}
                      to={toOf(one)}
                      onReply={
                        canComment && !one.player
                          ? () => setReplying({ root, to: one })
                          : undefined
                      }
                    />
                  </li>
                ))}
                {replying && answering && (
                  <li>
                    <CommentField
                      key={replying.to.id}
                      posterId={posterId}
                      replyTo={replying.to}
                      onCancel={() => setReplying(null)}
                      onSend={(text, tags) => {
                        leavePlayerComment(posterId, postId, text, root.id, tags)
                        setReplying(null)
                      }}
                    />
                  </li>
                )}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** One comment: a face, the handle running into what was said, and Reply where he may answer. */
function CommentRow({
  comment,
  to,
  onReply
}: {
  comment: PostComment
  /** Whom it answers, leading the line. */
  to?: string
  onReply?: () => void
}): JSX.Element {
  const reader = useReaderHandle()
  return (
    <div className="vu-bf-comment">
      {comment.charId ? (
        <RosterFace charId={comment.charId} />
      ) : comment.player ? (
        <PlayerFace />
      ) : (
        <span
          className="vu-bf-comment-face"
          style={{ '--vu-face-hue': hashString(comment.handle) % 360 } as CSSProperties}
          aria-hidden
        >
          {comment.emoji}
        </span>
      )}
      <span className="vu-bf-comment-said">
        <span className="vu-bf-comment-who vu-bf-comment-who--over">
          {comment.player ? reader : `@${comment.handle}`}
        </span>
        {to && <span className="vu-bf-comment-mention">{to} </span>}
        {comment.text.split(/(@[\w.]+)/).map((part, i) =>
          i % 2 === 1 ? (
            <span key={i} className="vu-bf-comment-mention">
              {part}
            </span>
          ) : (
            part
          )
        )}
        {onReply && (
          <motion.button
            type="button"
            className="vu-bf-comment-reply"
            {...gestures(false, quietLift, quietPress)}
            onClick={onReply}
          >
            Reply
          </motion.button>
        )}
      </span>
    </div>
  )
}

/** The reader on the feed, who has no handle: his first name in one. */
function useReaderHandle(): string {
  const first = useGameStore((s) => s.playerFirstName)
  const handle = first.toLowerCase().replace(/[^\w.]/g, '')
  return handle ? `@${handle}` : 'you'
}

/** The reader's own picture from his Profile tab, or the word "you" while he has none. */
function PlayerFace(): JSX.Element {
  const picture = useGameStore((s) => s.profilePicture)
  return picture ? (
    <span className="vu-bf-comment-face vu-bf-comment-face--roster" aria-hidden>
      <img src={picture} alt="" />
    </span>
  ) : (
    <span className="vu-bf-comment-face vu-bf-comment-face--player" aria-hidden>
      you
    </span>
  )
}

/** A roster girl's profile picture in the disc a stranger's emoji sits in. */
function RosterFace({ charId }: { charId: string }): JSX.Element {
  const version = useSpriteVersion(charId)
  return (
    <span className="vu-bf-comment-face vu-bf-comment-face--roster" aria-hidden>
      <img src={profileUrl(charId, version)} alt="" />
    </span>
  )
}

/** A contact the reader can tag: who she is and the handle her tag is typed as. */
interface Taggable {
  charId: string
  name: string
  handle: string
}

/** The @word being typed at the caret, if any: where it starts and what follows the @. */
function mentionAt(text: string, caret: number): { start: number; query: string } | null {
  const match = /(^|\s)@([\w.]*)$/.exec(text.slice(0, caret))
  return match ? { start: caret - match[2].length - 1, query: match[2].toLowerCase() } : null
}

/**
 * The one-line well under a thread: a comment on the post, or an answer to the one picked.
 * Typing @ lists his contacts under it, and a tag picked from there goes out with the comment.
 */
function CommentField({
  posterId,
  replyTo,
  onCancel,
  onSend
}: {
  posterId: string
  replyTo: PostComment | null
  /** Closes a reply's well; the post view's own well has none. */
  onCancel?: () => void
  onSend: (text: string, tags: string[]) => void
}): JSX.Element {
  // A reply to somebody else opens addressed to her, the way a feed's Reply does.
  const opening = replyTo && !replyTo.player ? `@${replyTo.handle} ` : ''
  const [draft, setDraft] = useState(opening)
  const [caret, setCaret] = useState(opening.length)
  const [active, setActive] = useState(0)
  const [picked, setPicked] = useState<Taggable[]>([])
  const [dismissed, setDismissed] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  // The caret starts after the handle a reply opened with, so he types straight on.
  useEffect(() => {
    input.current?.setSelectionRange(opening.length, opening.length)
  }, [opening])
  const chars = useGameStore((s) => s.chars)
  const characters = useGameStore((s) => s.characters)
  const charInfo = useGameStore((s) => s.charInfo)

  // Every contact but the poster, who answers him anyway.
  const taggable = useMemo<Taggable[]>(
    () =>
      chars.flatMap((charId) => {
        const character = characters[charId]
        const info = charInfo[charId]
        if (charId === posterId || !character || !isFeedContact(info)) return []
        return [
          {
            charId,
            name: fullNameOf(character),
            handle: info?.handle ?? character.firstName.toLowerCase()
          }
        ]
      }),
    [chars, characters, charInfo, posterId]
  )

  const mention = mentionAt(draft, caret)
  const rows = mention
    ? taggable.filter(
        (one) =>
          one.handle.toLowerCase().startsWith(mention.query) ||
          one.name.toLowerCase().split(' ').some((word) => word.startsWith(mention.query))
      )
    : []
  const listing = !dismissed && rows.length > 0

  const pick = (one: Taggable): void => {
    if (!mention) return
    const before = `${draft.slice(0, mention.start)}@${one.handle} `
    setDraft(before + draft.slice(caret))
    setPicked((list) => (list.some((p) => p.charId === one.charId) ? list : [...list, one]))
    setActive(0)
    setCaret(before.length)
    requestAnimationFrame(() => input.current?.setSelectionRange(before.length, before.length))
  }

  const send = (): void => {
    if (!draft.trim()) return
    // The contact a reply opened addressed to counts as tagged, as one picked from the list does.
    const opened = taggable.find((one) => one.charId === replyTo?.charId)
    const chosen = opened && !picked.includes(opened) ? [...picked, opened] : picked
    // A tag counts only while its handle is still in the words being sent.
    const tags = chosen
      .filter((one) => new RegExp(`(^|\\s)@${one.handle.replace(/\./g, '\\.')}(?![\\w.])`).test(draft))
      .map((one) => one.charId)
    onSend(draft, tags)
    setDraft('')
    setPicked([])
  }

  return (
    <div className="vu-bf-comment-compose">
      {replyTo && (
        <div className="vu-bf-comment-replying">
          <span>{replyTo.player ? 'Adding to your thread' : `Replying to @${replyTo.handle}`}</span>
          {onCancel && (
            <motion.button
              type="button"
              className="vu-bf-comment-reply"
              {...gestures(false, quietLift, quietPress)}
              onClick={onCancel}
            >
              Cancel
            </motion.button>
          )}
        </div>
      )}
      <div className="vu-bf-comment-row">
        <input
          ref={input}
          autoFocus={Boolean(replyTo)}
          className="vu-input vu-bf-comment-input"
          value={draft}
          autoComplete="off"
          role="combobox"
          aria-expanded={listing}
          aria-autocomplete="list"
          aria-label={replyTo ? 'Reply' : 'Comment'}
          placeholder={replyTo ? 'Write a reply…' : 'Write a comment… @ to tag a friend'}
          onChange={(e) => {
            setDraft(e.target.value)
            setCaret(e.target.selectionStart ?? e.target.value.length)
            setActive(0)
            setDismissed(false)
          }}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
          onKeyDown={(e) => {
            if (listing && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
              e.preventDefault()
              const step = e.key === 'ArrowDown' ? 1 : rows.length - 1
              setActive((at) => (at + step) % rows.length)
              return
            }
            if (e.key === 'Escape') {
              // Closes the list, then a reply's well; past those it is the post view's to close.
              if (listing) setDismissed(true)
              else if (onCancel) onCancel()
              else return
              e.stopPropagation()
              return
            }
            if (e.key !== 'Enter' && !(listing && e.key === 'Tab')) return
            // Keep the window-level Enter handler from advancing the scene under the phone.
            e.stopPropagation()
            e.preventDefault()
            if (listing) pick(rows[Math.min(active, rows.length - 1)])
            else send()
          }}
        />
        {/* Enter sends too; this is the way for whoever reaches for the mouse. */}
        <motion.button
          type="button"
          className="vu-btn vu-btn--primary vu-btn--panel vu-paper vu-bf-comment-send"
          disabled={!draft.trim()}
          {...gestures(!draft.trim(), lift, press)}
          onClick={send}
        >
          Send
        </motion.button>
      </div>
      {listing && (
        <div className="vu-pop vu-bb-mention-pop" onMouseDown={(e) => e.preventDefault()}>
          <div className="vu-pop-list" role="listbox">
            {rows.map((one, index) => (
              <button
                key={one.charId}
                type="button"
                role="option"
                aria-selected={index === active}
                className={`vu-pop-option vu-bb-mention${index === active ? ' vu-pop-option--on' : ''}`}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(one)}
              >
                <RosterFace charId={one.charId} />
                <span>{one.name}</span>
                <span className="vu-bf-comment-who">@{one.handle}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
