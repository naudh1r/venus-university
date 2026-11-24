/** The Story Assistant mod's id. */
export const STORY_ASSISTANT = 'story-assistant'

/** The most characters a question to the assistant takes. */
export const ASSISTANT_QUESTION_LIMIT = 400

/** The most ways forward one reply offers; more are dropped. */
export const ASSISTANT_SUGGESTIONS_MAX = 4

/** The most characters one suggestion's action keeps, which is what the box it fills takes. */
export const ASSISTANT_ACTION_LIMIT = 600

/** The most characters the player's own prompt takes. */
export const ASSISTANT_PROMPT_LIMIT = 20000

/** The option that reads the scene at every decision point without being asked. */
export const ASSISTANT_POPUP = 'popup'

/** The two options of the choices group: exactly four ways forward, or as many as fit. */
export const ASSISTANT_CHOICES = { four: 'choices-four', fit: 'choices-fit' } as const

/** How many ways forward a read is asked for. */
export type ChoiceCount = 'four' | 'fit'

/** The player's own prompt as kept: a blank or oversized one is none, and the shipped one stands. */
export function cleanAssistantPrompt(raw: unknown): string | undefined {
  const prompt = typeof raw === 'string' ? raw.trim() : ''
  return prompt && prompt.length <= ASSISTANT_PROMPT_LIMIT ? prompt : undefined
}

/** One way forward: a few words naming it, and the turn it would send. */
interface AssistantSuggestion {
  label: string
  action: string
}

/** What the assistant says about the scene, and the ways forward it offers. */
export interface StoryAssistantReply {
  commentary: string
  suggestions: AssistantSuggestion[]
}

/** A trimmed string, or '' for anything that is not one. */
function textOf(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * The reply as the panel shows it: blank and malformed suggestions dropped, repeats folded, the
 * rest capped; null when nothing is left to show.
 */
export function storyAssistantReplyOf(raw: unknown): StoryAssistantReply | null {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const commentary = textOf(record.commentary)
  const seen = new Set<string>()
  const suggestions: AssistantSuggestion[] = []
  for (const item of Array.isArray(record.suggestions) ? record.suggestions : []) {
    const entry = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    const action = textOf(entry.action).slice(0, ASSISTANT_ACTION_LIMIT)
    if (!action || seen.has(action)) continue
    seen.add(action)
    suggestions.push({ label: textOf(entry.label) || action, action })
    if (suggestions.length === ASSISTANT_SUGGESTIONS_MAX) break
  }
  if (!commentary && suggestions.length === 0) return null
  return { commentary, suggestions }
}
