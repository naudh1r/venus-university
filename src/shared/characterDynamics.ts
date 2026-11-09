/** Per-playthrough story choices; never edits a reusable character or her native traits. */
export const CHARACTER_DYNAMICS_MOD = 'character-dynamics'
export const DYNAMICS_REASON_LIMIT = 1200

export const STARTING_RELATIONSHIPS = [
  { id: 'ex-girlfriend', name: 'Ex-girlfriend', hint: 'How did the relationship end?', direction: 'They dated before this playthrough and separated. Their present relationship can develop differently.' },
  { id: 'resentful', name: 'Resentful', hint: 'What happened to upset her?', direction: 'She began with a grievance against the reader. Trust and subsequent events can change how she feels.' },
  { id: 'rival', name: 'Rival', hint: 'What are they competing over?', direction: 'They began as rivals over the stated goal. Competition need not prevent affection or cooperation.' },
  { id: 'antagonist', name: 'Antagonist', hint: 'Which of her goals conflicts with yours?', direction: 'Her initial goals conflicted with the reader\'s. Give her understandable motives, not constant hostility.' }
] as const

export const PERSONALITY_NUDGES = [
  { id: "adventurous", name: "Adventurous", hint: "A little more willing to try an unfamiliar experience." },
  { id: "affectionate", name: "Affectionate", hint: "A little warmer with people she trusts, respecting their boundaries." },
  { id: "ambitious", name: "Ambitious", hint: "A little more motivated to pursue the goals she already cares about." },
  { id: "analytical", name: "Analytical", hint: "A little more inclined to break a problem into understandable pieces." },
  { id: "blunt", name: "Blunt", hint: "A little more plainspoken, while still capable of tact and kindness." },
  { id: "cautious", name: "Cautious", hint: "A little more likely to weigh a risk before taking the next step." },
  { id: "cheerful", name: "Cheerful", hint: "A little more inclined to find everyday reasons to smile." },
  { id: "competitive", name: "Competitive", hint: "A little more drawn to friendly challenges." },
  { id: "curious", name: "Curious", hint: "A little more eager to ask questions and explore an interesting idea." },
  { id: "deadpan", name: "Deadpan", hint: "A little more likely to deliver a joke with a straight face." },
  { id: "dependable", name: "Dependable", hint: "A little more attentive to following through on her commitments." },
  { id: "dramatic", name: "Dramatic", hint: "A little more theatrical about everyday victories and setbacks." },
  { id: "dreamy", name: "Dreamy", hint: "A little more prone to imaginative what-ifs and pleasant daydreams." },
  { id: "easily-flustered", name: "Easily flustered", hint: "A little more bashful when attention catches her off guard." },
  { id: "easygoing", name: "Easygoing", hint: "A little more willing to shrug off minor inconveniences." },
  { id: "empathetic", name: "Empathetic", hint: "A little more inclined to consider another person's perspective." },
  { id: "flirtatious", name: "Flirtatious", hint: "A little more playful with romantic interest when it is welcome." },
  { id: "generous", name: "Generous", hint: "A little more willing to share her time or resources when she can." },
  { id: "goofy", name: "Goofy", hint: "A little more comfortable being silly and laughing at herself." },
  { id: "guarded", name: "Guarded", hint: "A little slower to share personal feelings." },
  { id: "headstrong", name: "Headstrong", hint: "A little firmer in her convictions." },
  { id: "humble", name: "Humble", hint: "A little more comfortable acknowledging her limits and giving others credit." },
  { id: "idealistic", name: "Idealistic", hint: "A little more guided by hopes and principles." },
  { id: "impulsive", name: "Impulsive", hint: "A little more likely to act on a feeling." },
  { id: "meticulous", name: "Meticulous", hint: "A little more particular about preparation and small details." },
  { id: "mischievous", name: "Mischievous", hint: "A little more inclined toward playful teasing." },
  { id: "observant", name: "Observant", hint: "A little more attentive to details she can actually notice." },
  { id: "patient", name: "Patient", hint: "A little more willing to give people and problems time." },
  { id: "philosophical", name: "Philosophical", hint: "A little more drawn to thoughtful questions about everyday life." },
  { id: "practical", name: "Practical", hint: "A little more drawn to workable solutions and useful next steps." },
  { id: "prickly", name: "Prickly", hint: "A little quicker to bristle, with room to soften." },
  { id: "protective", name: "Protective", hint: "A little quicker to look out for someone without deciding for them." },
  { id: "proud", name: "Proud", hint: "A little more protective of her dignity and pleased by earned achievements." },
  { id: "pun-loving", name: "Pun-loving", hint: "A little more tempted by a wonderfully terrible pun." },
  { id: "rebellious", name: "Rebellious", hint: "A little more inclined to question expectations and find her own way." },
  { id: "reserved", name: "Reserved", hint: "A little more expressive through small gestures." },
  { id: "resourceful", name: "Resourceful", hint: "A little more inclined to improvise a solution with what is available." },
  { id: "romantic", name: "Romantic", hint: "A little more moved by thoughtful gestures and meaningful moments." },
  { id: "self-assured", name: "Self-assured", hint: "A little more direct and willing to initiate." },
  { id: "sentimental", name: "Sentimental", hint: "A little more attached to keepsakes and shared memories." },
  { id: "skeptical", name: "Skeptical", hint: "A little more likely to ask for reasons before accepting a claim." },
  { id: "sleepy", name: "Sleepy", hint: "A little more fond of slow mornings, cozy rests and drowsy humor, while staying engaged when it matters." },
  { id: "social-butterfly", name: "Social butterfly", hint: "A little more eager to start conversations and include people." },
  { id: "spontaneous", name: "Spontaneous", hint: "A little more inclined to suggest an unplanned treat or change of plans." },
  { id: "stoic", name: "Stoic", hint: "A little more composed under pressure, without lacking feelings." },
  { id: "superstitious", name: "Superstitious", hint: "A little more fond of lucky rituals and reading coincidences as signs." },
  { id: "tenacious", name: "Tenacious", hint: "A little more persistent through setbacks, while respecting other people's boundaries." },
  { id: "tenderhearted", name: "Tenderhearted", hint: "A little more attentive to hurt feelings." },
  { id: "whimsical", name: "Whimsical", hint: "A little more drawn to fanciful ideas and small, unexpected delights." },
  { id: "witty", name: "Witty", hint: "A little quicker with clever comebacks and wordplay." }
] as const

export type StartingRelationship = typeof STARTING_RELATIONSHIPS[number]['id']
export type PersonalityNudge = typeof PERSONALITY_NUDGES[number]['id']

export interface GrowthTag { id: string; name: string; description: string; reframes: string[] }
export function growthTagOf(value: unknown): GrowthTag | undefined {
  if(!value||typeof value!=='object')return undefined
  const v=value as Record<string,unknown>
  if(typeof v.id!=='string'||!v.id||v.id.length>160||typeof v.name!=='string'||!v.name.trim()||v.name.length>80||
    typeof v.description!=='string'||!v.description.trim()||v.description.length>700||!Array.isArray(v.reframes)||v.reframes.length!==3||
    v.reframes.some(s=>typeof s!=='string'||!s.trim()||s.length>500))return undefined
  return {id:v.id,name:v.name,description:v.description,reframes:[...v.reframes] as string[]}
}
export interface CharacterDynamic {
  growth?: GrowthTag
  relationship?: { kind: string; reason: string }
  traits: string[]
}

export interface CharacterDynamics {
  version: 1
  characters: Record<string, CharacterDynamic>
}

export const emptyCharacterDynamics = (): CharacterDynamics => ({ version: 1, characters: {} })

/** Read-only aliases for saves and enrollments produced by the prerelease build. */
interface StoredDynamicsFields {
  exCharacterDynamics?: CharacterDynamics
  exCharacterDynamicsEnabled?: boolean
  characterDynamics?: CharacterDynamics
  characterDynamicsEnabled?: boolean
}

/** New writes use only exCharacterDynamics; loading never rewrites the source file. */
export function readCharacterDynamics(owner?: object): CharacterDynamics | undefined {
  const fields = owner as StoredDynamicsFields | undefined
  const value = fields?.exCharacterDynamics ?? fields?.characterDynamics
  return value ? structuredClone(value) : undefined
}

/** Explicit false must win over an older true value when an enrollment is resumed. */
export function readCharacterDynamicsEnabled(owner?: object): boolean {
  const fields = owner as StoredDynamicsFields | undefined
  return (fields?.exCharacterDynamicsEnabled ?? fields?.characterDynamicsEnabled) === true
}

/** Read known fields defensively; the original save object is retained separately, unchanged. */
export function dynamicFor(data: CharacterDynamics | undefined, charId: string): CharacterDynamic {
  const entry = data?.version === 1 ? data.characters?.[charId] : undefined
  const traits = Array.isArray(entry?.traits)
    ? [...new Set(entry.traits.filter(id => PERSONALITY_NUDGES.some(tag => tag.id === id)))]
    : []
  const relationship = entry?.relationship
  return {
    traits,
    ...(growthTagOf(entry?.growth)?{growth:growthTagOf(entry?.growth)}:{}),
    ...(STARTING_RELATIONSHIPS.some(tag => tag.id === relationship?.kind) &&
      typeof relationship?.reason === 'string'
      ? { relationship: { kind: relationship.kind, reason: relationship.reason } }
      : {})
  }
}

/** A selected relationship cannot be committed with a blank or oversized explanation. */
export function invalidDynamicsReasons(data: CharacterDynamics, editable: readonly string[]): string[] {
  return editable.filter(id => {
    const relationship = dynamicFor(data, id).relationship
    return relationship && (!relationship.reason.trim() || relationship.reason.length > DYNAMICS_REASON_LIMIT)
  })
}

/** Keep inherited girls byte-for-byte in meaning; only the offered new girls can be edited. */
export function settleCharacterDynamics(
  draft: CharacterDynamics,
  editable: readonly string[],
  inherited?: CharacterDynamics
): CharacterDynamics {
  if (invalidDynamicsReasons(draft, editable).length > 0) throw new Error('A starting relationship needs an explanation.')
  const characters = structuredClone(inherited?.characters ?? {})
  for (const id of editable) {
    const entry = dynamicFor(draft, id)
    const relationship = entry.relationship
      ? { ...entry.relationship, reason: entry.relationship.reason.trim() }
      : undefined
    delete characters[id]
    if (relationship || entry.traits.length > 0 || entry.growth) {
      characters[id] = { traits: entry.traits, ...(relationship ? { relationship } : {}), ...(entry.growth?{growth:entry.growth}:{}) }
    }
  }
  return { version: 1, characters }
}

/** The setup establishes acquaintance only. No affection, contact access, or milestones. */
export function dynamicsKnowsReader(data: CharacterDynamics | undefined, charId: string): boolean {
  return Boolean(dynamicFor(data, charId).relationship?.reason.trim())
}
