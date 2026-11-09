import { createElement, lazy, Suspense } from 'react'
import { registerHooks, type ScreenSlotProps } from '@vx/modkit/renderer'
import { TEXT_REGENERATION_MOD } from '../../shared/textRegeneration'

// The screen contribution loads the existing control only when a conversation draws it.
const TextRegenerate = lazy(() => import('../components/TextRegenerate')
  .then(module => ({ default: module.TextRegenerate })))

function ConversationTools(props: ScreenSlotProps['conversationFoot']): ReturnType<typeof createElement> {
  return createElement(Suspense, { fallback: null }, createElement(TextRegenerate, props))
}

registerHooks(TEXT_REGENERATION_MOD, { conversationFoot: ConversationTools })
