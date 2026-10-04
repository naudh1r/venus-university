import type { JSX, ReactNode } from 'react'
import { isPermanent, truncate } from '@shared/errors'
import { useSettingsStore } from '../stores/settingsStore'
import type { PhotoFailure } from '../stores/photoStore'
import { ConfirmModal } from './ConfirmModal'

/** The words a model said instead of drawing, out of an empty reply's detail; null for a raw body. */
function modelWords(detail: string | undefined): string | null {
  const words = (detail ?? '').replace(/^finishReason=\S+\s*/, '').trim()
  return words && !/^[{[]/.test(words) ? words : null
}

/** What the panel says, by the error's own code — the write-only branch answered first. */
function messageFor(failure: PhotoFailure, apiProvider: string | undefined): ReactNode {
  const { error, bytes } = failure
  if (bytes) {
    return `The photo was made, but it couldn't be saved. ${error.message} Retry saves it again without making a new one.`
  }
  switch (error.code) {
    case 'LLM_BLOCKED': {
      // The vendor's reason is the one part of its sentence worth keeping.
      const reason = /\(([^)]+)\)/.exec(error.message)?.[1]
      return `The image model refused this photo${reason ? ` (${reason})` : ''}. Try a different prompt, outfit or expression.`
    }
    case 'LLM_EMPTY': {
      const said = modelWords(error.detail)
      return said
        ? `The model answered without a photo, which usually means it declined the prompt. It said: “${truncate(said, 300)}”`
        : 'The model answered without a photo, which usually means it declined the prompt.'
    }
    case 'LLM_RATE_LIMITED':
      return apiProvider !== 'openai'
        ? 'Google is limiting image requests on this key. Image generation needs billing set up on your Gemini API key; if it has billing, wait a minute and retry.'
        : 'The image endpoint is limiting requests. Wait a minute and retry.'
    case 'LLM_CREDITS_DEPLETED':
      return `${error.message} Once you've added credits, Retry sends the same request.`
    case 'LLM_NETWORK':
    case 'LLM_HTTP':
    case 'LLM_OVERLOADED':
      return "The image service didn't answer. It may be busy; try again in a moment."
    case 'PHOTO_TIMEOUT':
      return 'The image model took longer than five minutes. If it finished after the app stopped waiting, it may still have been charged.'
    default:
      return error.message
  }
}

export interface PhotoFailedModalProps {
  id: string
  theme: 'day' | 'night'
  failure: PhotoFailure
  onRetry: () => void
  onDismiss: () => void
  /** Opens Create Photo on the failed draft; absent where there is no way back to it. */
  onEdit?: () => void
}

/**
 * A photo that did not arrive, or arrived and could not be kept — built on {@link ConfirmModal}
 * the way {@link LlmFailureModal} is.
 */
export function PhotoFailedModal({
  id,
  theme,
  failure,
  onRetry,
  onDismiss,
  onEdit
}: PhotoFailedModalProps): JSX.Element {
  const apiProvider = useSettingsStore((s) => s.settings?.apiProvider)
  const title = failure.bytes ? "Couldn't save the photo" : "Couldn't create the photo"
  const message = messageFor(failure, apiProvider)
  const retryable = Boolean(failure.bytes) || !isPermanent(failure.error)

  if (retryable) {
    return (
      <ConfirmModal
        id={id}
        theme={theme}
        title={title}
        message={message}
        confirmText="Retry"
        cancelText="Dismiss"
        // A picture already made is kept by Retry; starting over from the form would pay again.
        extraText={onEdit && !failure.bytes ? 'Edit prompt' : undefined}
        onExtra={onEdit && !failure.bytes ? onEdit : undefined}
        onConfirm={onRetry}
        onCancel={onDismiss}
      />
    )
  }

  if (onEdit) {
    return (
      <ConfirmModal
        id={id}
        theme={theme}
        title={title}
        message={message}
        confirmText="Edit prompt"
        cancelText="Dismiss"
        onConfirm={onEdit}
        onCancel={onDismiss}
      />
    )
  }

  return (
    <ConfirmModal
      id={id}
      theme={theme}
      title={title}
      message={message}
      confirmText="Got it"
      onConfirm={onDismiss}
    />
  )
}
