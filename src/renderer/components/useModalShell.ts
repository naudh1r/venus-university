import { useEffect, useRef, useState, type MouseEvent, type MouseEventHandler } from 'react'
import { useIsPresent, type AnimationDefinition } from 'motion/react'

import { useAudioStore } from '../stores/audioStore'
import { useCrossingStore } from '../stores/crossingStore'
import { typingIn } from './useWindowKeydown'

/** What a modal needs to mount itself: the portal host, and the dimming's handlers. */
export interface ModalShell {
  /** `null` until the host is resolved, which is one render — portal nothing before that. */
  host: HTMLElement | null
  overlayProps: {
    onMouseDown: MouseEventHandler<HTMLElement>
    onClick: MouseEventHandler<HTMLElement>
    /** The whole veil, while it is leaving: no clicks, no focus, no keys. */
    inert: boolean
  }
  /**
   * Spread on the motion element that carries the primary button, where a modal hands the shell
   * a `primary`: its landing arms Enter and Space, and the controls inside it are the modal's own.
   */
  primaryProps: {
    ref: (node: HTMLElement | null) => void
    onAnimationComplete: (definition: AnimationDefinition) => void
  }
}

/**
 * Every open shell and every layer inside one, oldest first: Escape and a right-click are
 * answered by the last one alone. Module scope because the stack spans components — a modal
 * opened over another is a different tree, and only the two of them together know which is on
 * top.
 */
const openShells: object[] = []

/**
 * Takes the top of that stack for as long as the caller holds the teardown, and hands Escape
 * and a right-click to `answer` only while nothing has been pushed over it. A right-click in a
 * field keeps its own menu; anywhere else the native one never opens. Enter and Space go to
 * `primary`, where there is one, on the same terms. Captured, so a screen's own listener on the
 * bubble does not also fire; whether the event is stopped is the answer's to say.
 */
function topmostDismiss(
  answer: (event: Event) => void,
  primary?: (event: KeyboardEvent) => void
): () => void {
  const token = {}
  openShells.push(token)
  const onTop = (): boolean => openShells[openShells.length - 1] === token
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!onTop()) return
    if (event.key === 'Escape') answer(event)
    else if (primary && (event.key === 'Enter' || event.key === ' ')) primary(event)
  }
  const onContextMenu = (event: Event): void => {
    if (!onTop() || typingIn(event)) return
    event.preventDefault()
    answer(event)
  }
  window.addEventListener('keydown', onKeyDown, true)
  window.addEventListener('contextmenu', onContextMenu, true)
  return () => {
    window.removeEventListener('keydown', onKeyDown, true)
    window.removeEventListener('contextmenu', onContextMenu, true)
    openShells.splice(openShells.indexOf(token), 1)
  }
}

/**
 * A layer inside a modal — a menu, a box being typed in — that takes Escape and a right-click
 * ahead of the shell under it, since a later listener on the same target and phase cannot
 * otherwise win against the shell's capture listener. A right-click's press moves no focus while
 * the layer stands, so a box it guards is not blurred away before the right-click reaches it.
 */
export function useDismissLayer(onDismiss: () => void, active: boolean): void {
  // Read at the event rather than closed over, so the listener is registered once.
  const dismiss = useRef(onDismiss)
  dismiss.current = onDismiss

  useEffect(() => {
    if (!active) return
    const holdFocus = (event: globalThis.MouseEvent): void => {
      if (event.button !== 0) event.preventDefault()
    }
    window.addEventListener('mousedown', holdFocus, true)
    const release = topmostDismiss((event) => {
      event.stopPropagation()
      dismiss.current()
    })
    return () => {
      window.removeEventListener('mousedown', holdFocus, true)
      release()
    }
  }, [active])
}

/** A control that a focused Enter or Space presses on its own. */
const PRESSABLE = 'button, a[href], [role="button"]'

/**
 * The portal host, the outside-click rule, Escape and a right-click, and the sounds a panel
 * arrives and leaves on; styling stays in `vu_styles`. `sound` is the pair it plays — `'phone'`
 * for the Bunnyboard, and `'none'` for a screen whose own sting is the sound of its arrival.
 * `primary` is what Enter and Space answer with, for a modal that takes them.
 */
export function useModalShell(
  onClose: () => void,
  sound: 'panel' | 'phone' | 'none' = 'panel',
  primary?: () => void
): ModalShell {
  const [host, setHost] = useState<HTMLElement | null>(null)
  const pressedOverlay = useRef(false)
  // Read at the event rather than closed over, so the listener is registered once.
  const close = useRef(onClose)
  close.current = onClose
  const answer = useRef(primary)
  answer.current = primary
  // The element carrying the primary, and whether it has landed.
  const primaryHolder = useRef<HTMLElement | null>(null)
  const armed = useRef(false)

  /**
   * **A modal that is leaving answers nothing**. Its exit keeps it mounted for the length
   * of the fade, and a second Escape there runs `onClose` again — which for a one-way confirm
   * *is* the confirm. `true` outside any `AnimatePresence`, so an un-wrapped caller is unchanged.
   */
  const present = useIsPresent()
  const leaving = useRef(false)
  leaving.current = !present

  useEffect(() => {
    setHost(document.getElementById('modal-root') ?? document.body)
  }, [])

  /**
   * A sound of its own on open and close. Both are guarded against the double mount: open by a
   * ref, close by a microtask that lets an immediate re-setup cancel the teardown that queued it.
   */
  const opened = useRef(false)
  const closed = useRef(false)
  const going = useRef(false)

  useEffect(() => {
    if (opened.current) return
    opened.current = true
    if (sound !== 'none') useAudioStore.getState().play(sound === 'phone' ? 'phone_open' : 'ui_open')
  }, [sound])

  useEffect(() => {
    going.current = false
    const playClose = (): void => {
      if (closed.current) return
      closed.current = true
      if (useCrossingStore.getState().phase !== 'idle') return
      if (sound !== 'none')
        useAudioStore.getState().play(sound === 'phone' ? 'phone_close' : 'ui_close')
    }
    if (!present) playClose()
    return () => {
      going.current = true
      queueMicrotask(() => {
        if (going.current) playClose()
      })
    }
  }, [present, sound])

  /**
   * Escape and a right-click run the same handler as an outside click, so a modal that ignores
   * one ignores all three; Enter and Space run `primary`, where the modal gave one. Captured and
   * stopped, so the Game View's own listeners do not also fire.
   */
  useEffect(
    () =>
      topmostDismiss(
        (event) => {
          if (leaving.current) return
          event.stopPropagation()
          close.current()
        },
        (event) => {
          if (!answer.current || leaving.current) return
          if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return
          if (event.isComposing) return
          // The modal's own field keeps both keys, and its own button presses itself — stopped
          // only so the screen behind cannot cancel that press.
          const target = event.target
          if (target instanceof Element && primaryHolder.current?.contains(target)) {
            if (typingIn(event)) return
            if (target.closest(PRESSABLE)) {
              event.stopPropagation()
              return
            }
          }
          // Anywhere else — the paper, the stage's well behind the veil — the key is the
          // modal's. A held key and one pressed while the primary is still arriving are
          // swallowed, so a key mashed through the lines before never answers a screen unseen.
          event.preventDefault()
          event.stopPropagation()
          if (event.repeat || !armed.current) return
          answer.current()
        }
      ),
    []
  )

  /**
   * Records whether the press began on the dimming: a `click` fires on the common ancestor of
   * press and release, so a drag out of a field would otherwise close the modal. React bubbles
   * clicks through the *component* tree, so a modal portalled over this one has its click land
   * here too — harmless only because of the target test.
   */
  function handleOverlayMouseDown(e: MouseEvent<HTMLElement>): void {
    pressedOverlay.current = e.target === e.currentTarget
  }

  function handleOverlayClick(e: MouseEvent<HTMLElement>): void {
    const outside = pressedOverlay.current && e.target === e.currentTarget
    pressedOverlay.current = false
    if (outside) onClose()
  }

  return {
    host,
    overlayProps: {
      onMouseDown: handleOverlayMouseDown,
      onClick: handleOverlayClick,
      inert: !present
    },
    primaryProps: {
      ref: (node) => {
        primaryHolder.current = node
      },
      onAnimationComplete: (definition) => {
        if (definition === 'shown') armed.current = true
      }
    }
  }
}
