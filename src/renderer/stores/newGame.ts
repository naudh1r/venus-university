import type { Character, Enrollment, PlaythroughRecord, SemesterHandoff } from '@shared/types'

/** A semester on disk with its cast resolved — what the registrar is reopened on. */
export interface StagedEnrollment {
  playthroughId: string
  enrollment: Enrollment
  characters: Character[]
}

let staged: StagedEnrollment | null = null

/** Hands New Game the enrollment the screen it is about to raise stands on. */
export function stageEnrollment(next: StagedEnrollment): void {
  staged = next
}

/** What is staged, left where it is: a `useState` initializer runs twice under StrictMode. */
export function stagedEnrollment(): StagedEnrollment | null {
  return staged
}

/** Drops what was staged, once the screen holding it has mounted. */
export function clearStagedEnrollment(): void {
  staged = null
}

/**
 * A Continue on its way to the next semester's roster screen: the playthrough, its record as the
 * ending read it, the semester that just ended, and what that ending handed on.
 */
export interface Continuation {
  playthroughId: string
  record: PlaythroughRecord
  /** The semester that just ended; undefined for the first. */
  from: string | undefined
  /** The slot save the ending stands on, which tells one ending of a semester from another. */
  ending: string | null
  handoff: SemesterHandoff
}

let continuation: Continuation | null = null

/** Hands the next semester's roster screen the Continue it is about to be raised for. */
export function stageContinuation(next: Continuation): void {
  continuation = next
}

/** What is staged, left where it is: a `useState` initializer runs twice under StrictMode. */
export function stagedContinuation(): Continuation | null {
  return continuation
}

/** Drops the staged Continue, once the screen holding it has mounted. */
export function clearStagedContinuation(): void {
  continuation = null
}
