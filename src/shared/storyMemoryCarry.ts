import { normalizeStoryMemory, storySnapshot, type StoryFact, type StoryMemory } from './storyMemory'
import { registerTermCarry } from '@vx/modkit/shared'
import type { TermCarryContext, GameSave } from '@vx/modkit/shared'

declare module './modCarry' { interface ModCarryFields { exStoryMemory?: StoryMemory } }

export function carryStoryMemory(save: GameSave, context: TermCarryContext): StoryMemory | undefined {
  const { term, back, characters } = context
  const result: { exStoryMemory?: StoryMemory } = {}
  // Recaps live here, not in the next semester's active history. Originals, corrections and
  // hidden flags stay separate so the memory editor can still undo a player's correction.
  if (save.exStoryMemory || Object.keys(save.history ?? {}).length) {
    const old = normalizeStoryMemory(save.exStoryMemory)
    const raw = storySnapshot({
      playthroughId: '0',
      date: save.date,
      time: save.time,
      history: save.history ?? {},
      characters,
      exStoryMemory: { ...old, facts: [], edits: {}, hidden: [], encounterEdits: {} }
    })!
    const mapped = new Map(
      old.facts.map((f) => [f.id, f.origin ? f.id : `term:${term}:${f.id}`])
    )
    for (const r of raw.records) mapped.set(r.id, r.origin ? r.id : `term:${term}:${r.id}`)
    const idOf = (id: string): string => mapped.get(id) ?? id
    const move = (f: StoryFact): StoryFact => {
      const { batch: _batch, ...rest } = f
      return {
        ...rest,
        id: idOf(f.id),
        date: f.date - back,
        origin: f.origin ?? { term, day: f.date },
        supersedes: f.supersedes.map(idOf)
      }
    }
    const memory: StoryMemory = {
      ...old,
      facts: old.facts
        .filter((f) => f.date < save.date || (f.date === save.date && f.time <= save.time))
        .map(move),
      edits: Object.fromEntries(
        Object.entries(old.edits).map(([id, f]) => [idOf(id), move(f)])
      ),
      hidden: old.hidden.map(idOf),
      encounterSubjects: {}, // Archived recaps carry their participants directly.
      encounterEdits: Object.fromEntries(
        Object.entries(old.encounterEdits)
          .filter(([id]) => mapped.has(id))
          .map(([id, edit]) => [idOf(id), { ...edit }])
      ),
      pastEncounters: raw.records.map((r) => ({
        id: idOf(r.id),
        date: r.date - back,
        time: r.time,
        text: r.text,
        subjects: r.subjects,
        origin: r.origin ?? { term, day: r.date }
      })),
      names: raw.names
    }
    result.exStoryMemory = normalizeStoryMemory(memory)
  }
  return result.exStoryMemory
}

registerTermCarry('exStoryMemory', carryStoryMemory)
