import { useMemo, useRef, useState, type CSSProperties, type JSX } from 'react'
import { motion } from 'motion/react'
import { hashString } from '@shared/hash'
import { shownComments, type PostComment } from '@shared/postComments'
import { fullNameOf } from '@shared/types'
import { isFeedContact } from '../stores/feedView'
import { profileUrl, useSpriteVersion } from '../stores/characterStore'
import { useGameStore } from '../stores/gameStore'
import { leavePlayerComment } from '../stores/feedThreads'
import { epilogueOf } from '../stores/textingLoop'
import type { CommentViewProps } from '../stores/commentHandoff'
import { gestures, quietLift, quietPress } from '../views/motion'
import '../vu_styles/PopList.css'
import '../vu_styles/PostComments.css'
import '../vu_styles/FeedComments.css'

/**
 * What people said under one post, as much of it as has arrived, each reply nested under the
 * comment it answers. On a contact's post the reader can comment on the post or answer a comment
 * left on it, and she answers him at the next slot.
 *
 * A roster girl wears her own profile picture; a stranger's face is her emoji on a hue hashed
 * off the handle, so she is the same colour every time she comments.
 */
export function FeedThread({
  comments,
  charId: posterId,
  postId,
  stranger
}: CommentViewProps): JSX.Element | null {
  // Only under a contact's own post, and never once the epilogue has closed the phone's talk.
  const epilogue = useGameStore(epilogueOf)
  const canComment = Boolean(posterId && postId && !stranger && !epilogue)
  const date = useGameStore((s) => s.date)
  const time = useGameStore((s) => s.time)
  // Where the well is open: under the post, under one comment's thread, or nowhere.
  const [open, setOpen] = useState<'post' | PostComment | null>(null)
  const said = shownComments(comments, date, time)
  if (said.length === 0 && !canComment) return null

  // One level of nesting: a reply to a reply sits under the comment its chain started from.
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

  // Only somebody else's comment on the post itself takes a reply; the replies under it do not.
  const row = (comment: PostComment, root: boolean): JSX.Element => (
    <CommentRow
      key={comment.id}
      comment={comment}
      poster={Boolean(posterId) && comment.charId === posterId}
      onReply={canComment && root && !comment.player ? () => setOpen(comment) : undefined}
    />
  )

  const field = (replyTo: PostComment | null): JSX.Element | null =>
    canComment && posterId && postId ? (
      <CommentField
        posterId={posterId}
        replyTo={replyTo}
        onCancel={() => setOpen(null)}
        onSend={(text, tags) => {
          leavePlayerComment(posterId, postId, text, replyTo?.id, tags)
          setOpen(null)
        }}
      />
    ) : null

  return (
    <div className="vu-bb-thread">
      {said.length > 0 && (
        <ul className="vu-bb-comments">
          {roots.map((root) => (
            <li className="vu-bb-comment-group" key={root.id}>
              {row(root, true)}
              {(repliesTo.has(root.id) || open === root) && (
                <ul className="vu-bb-comments vu-bb-comments--replies">
                  {repliesTo.get(root.id)?.map((one) => <li key={one.id}>{row(one, false)}</li>)}
                  {open === root && <li>{field(root)}</li>}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      {open === 'post'
        ? field(null)
        : canComment && (
            <motion.button
              type="button"
              className="vu-bb-comment-reply vu-bb-comment-open"
              {...gestures(false, quietLift, quietPress)}
              onClick={() => setOpen('post')}
            >
              Comment
            </motion.button>
          )}
    </div>
  )
}

/** One comment: a face, the handle running into what was said, and Reply where he may answer. */
function CommentRow({
  comment,
  poster,
  onReply
}: {
  comment: PostComment
  poster: boolean
  onReply?: () => void
}): JSX.Element {
  return (
    <div className="vu-bb-comment">
      {comment.charId ? (
        <RosterFace charId={comment.charId} />
      ) : comment.player ? (
        <span className="vu-bb-comment-face vu-bb-comment-face--player" aria-hidden>
          you
        </span>
      ) : (
        <span
          className="vu-bb-comment-face"
          style={{ '--vu-face-hue': hashString(comment.handle) % 360 } as CSSProperties}
          aria-hidden
        >
          {comment.emoji}
        </span>
      )}
      <span className="vu-bb-comment-said">
        <span className="vu-bb-comment-who">
          {comment.player ? 'you' : `@${comment.handle}`}
        </span>
        {poster && <span className="vu-bb-comment-tag">author</span>}{' '}
        {comment.text.split(/(@[\w.]+)/).map((part, i) =>
          i % 2 === 1 ? (
            <span key={i} className="vu-bb-comment-mention">
              {part}
            </span>
          ) : (
            part
          )
        )}
        {onReply && (
          <motion.button
            type="button"
            className="vu-bb-comment-reply"
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

/** A roster girl's profile picture in the disc a stranger's emoji sits in. */
function RosterFace({ charId }: { charId: string }): JSX.Element {
  const version = useSpriteVersion(charId)
  return (
    <span className="vu-bb-comment-face vu-bb-comment-face--roster" aria-hidden>
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
  onCancel: () => void
  onSend: (text: string, tags: string[]) => void
}): JSX.Element {
  const [draft, setDraft] = useState('')
  const [caret, setCaret] = useState(0)
  const [active, setActive] = useState(0)
  const [picked, setPicked] = useState<Taggable[]>([])
  const [dismissed, setDismissed] = useState(false)
  const input = useRef<HTMLInputElement>(null)
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
    // A tag counts only while its handle is still in the words being sent.
    const tags = picked
      .filter((one) => new RegExp(`(^|\\s)@${one.handle.replace(/\./g, '\\.')}(?![\\w.])`).test(draft))
      .map((one) => one.charId)
    onSend(draft, tags)
    setDraft('')
    setPicked([])
  }

  return (
    <div className="vu-bb-comment-compose">
      <div className="vu-bb-comment-replying">
        <span>{replyTo ? `Replying to @${replyTo.handle}` : 'Commenting on the post'}</span>
        <motion.button
          type="button"
          className="vu-bb-comment-reply"
          {...gestures(false, quietLift, quietPress)}
          onClick={onCancel}
        >
          Cancel
        </motion.button>
      </div>
      <input
        ref={input}
        autoFocus
        className="vu-input vu-bb-comment-input"
        value={draft}
        autoComplete="off"
        role="combobox"
        aria-expanded={listing}
        aria-autocomplete="list"
        aria-label={replyTo ? 'Reply' : 'Comment'}
        placeholder={replyTo ? 'Write a reply…' : 'Add a comment… @ to tag a friend'}
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
            // Closes the list, or the well once no list is open, rather than the phone behind it.
            e.stopPropagation()
            if (listing) setDismissed(true)
            else onCancel()
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
                <span className="vu-bb-comment-who">@{one.handle}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
