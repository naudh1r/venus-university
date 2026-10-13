import { STORY_CATEGORIES, lightStoryFacts, type StorySnapshot, type StoryMemoryMode } from '@shared/storyMemory'
import type { StructuredRequest } from '@shared/types'

/** Extends the existing ledger call, so extraction makes no additional model request. */
export function withStoryExtraction(
  request: StructuredRequest,
  snapshot: StorySnapshot | undefined,
  keys: readonly string[],
  options: { mode?: StoryMemoryMode; cast?: readonly string[] } = {}
): StructuredRequest {
  if (!snapshot) return request
  const who = { type: 'string', enum: ['reader', ...keys] },
    text = { type: 'string' }
  const schema = request.schema.schema
  const light = options.mode === 'light'
  const sceneAt = request.user.lastIndexOf('SCENE SO FAR')
  // Match the actual scene, never the static ledger instructions or unrelated roster blocks.
  const scene = sceneAt >= 0 ? request.user.slice(sceneAt) : ''
  const candidates = light ? lightStoryFacts(snapshot.records, options.cast ?? [], scene) : snapshot.records
  let referenceSize = 2 // The JSON array delimiters.
  const facts = candidates
    .filter((r) => r.kind === 'fact')
    .slice(0, 80)
    .map(({ id, subject, category, timeline, certainty, text, manual }) => ({
      id,
      subject,
      name: snapshot.names[subject],
      category,
      timeline,
      certainty,
      text,
      manual
    }))
    .filter((fact) => {
      const size = JSON.stringify(fact).length + 1
      if (referenceSize + size > (light ? 2500 : 6500)) return false
      referenceSize += size
      return true
    })
  return {
    ...request,
    schema: {
      ...request.schema,
      schema: {
        ...schema,
        properties: {
          ...(schema.properties as Record<string, unknown>),
          exStoryFacts: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: [
                'subject',
                'category',
                'text',
                'timeline',
                'certainty',
                'claimant',
                'knownBy',
                'public',
                'evidence',
                'supersedes'
              ],
              properties: {
                subject: who,
                category: { type: 'string', enum: [...STORY_CATEGORIES] },
                text,
                timeline: { type: 'string', enum: ['current', 'alternate', 'unspecified'] },
                certainty: { type: 'string', enum: ['event', 'claim'] },
                claimant: { type: 'string', enum: ['none', 'reader', ...keys] },
                knownBy: { type: 'array', items: who },
                public: { type: 'boolean' },
                evidence: text,
                supersedes: { type: 'array', items: text }
              }
            }
          }
        },
        required: [...(schema.required as string[]), 'exStoryFacts']
      }
    },
    user:
      request.user +
      '\n\nLASTING STORY FACTS\nReturn exStoryFacts: at most 8 NEW lasting developments from this scene, or []. Separate these from affection reactions. Preserve important promises, revealed secrets, completed changes and established roles. Do not repeat unchanged facts or scenery. Quote 12–600 exact characters from ONE generated dialogue/narration line as evidence, never from a player action alone. An attempted action is not a successful outcome. A promise proves only that it was made. Character statements about reality are claims with a claimant, not verified events. An event uses claimant none. knownBy contains ONLY reader/cast keys who witnessed or explicitly learned it; subjects do not automatically know, [] means narrator-only. public is false unless explicitly public. timeline means when this fact applies: current, alternate or unspecified; do not invent time travel. An explicit later change may supersede only an earlier matching subject/category/timeline/certainty id. Never supersede a player correction. Existing facts (internal ids, with names; use character keys for new rows):\n' +
      JSON.stringify(facts)
  }
}
