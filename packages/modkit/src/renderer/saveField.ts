import { useSyncExternalStore } from 'react'
import { modById, type ModSlice, type Result } from '../bridge/shared'
import type { ManualSaveOffer } from '../bridge/renderer'
import type { TermCarryContext } from '../shared/modCarry'
import { declaredHooksNow, refusedAsForeign } from './attribution'

/**
 * A mod's own data in a save, kept under the mod's id in the save's `ex`, and on the records
 * inside it. Core never reads inside a slice: it writes each one back as read, and only the mod
 * that registered the field turns it into a value. Every value is plain JSON.
 */

/** A record that can carry mods' slices: the save, a character, a memory, a message, a post. */
export interface ModDataRecord {
  /** The mods' slices on the record, by mod id. */
  ex?: Record<string, ModSlice>
}

/** What a mod keeps in the save: its value's empty state, how it is read, and what the next semester gets. */
export interface SaveFieldSpec<T> {
  /** The value while the save holds nothing for the mod. */
  empty: T
  /**
   * The mod's own old top-level save keys, read once into `normalize` and then removed. Without
   * a `normalize` to read them they are left in the save as they are.
   */
  legacy?: readonly string[]
  /**
   * The mod's value from what the save holds: `stored` is its slice's data as read (undefined
   * where none), `legacy` the old keys as read, `from` the mod version that wrote the slice, or
   * null for a legacy or pre-kit one. Pure; a throw leaves the save's data as it was and the mod
   * at `empty` for this game. Without it, the value is the stored data, or `empty`.
   */
  normalize?: (stored: unknown, legacy: Readonly<Record<string, unknown>>, from: string | null) => T
  /** What the next semester starts with, given this one's value; undefined, or no `carry`, starts it empty. */
  carry?: (value: T, context: TermCarryContext) => T | undefined
}

/** A mod's live value in the game being played, from {@link saveField}. */
export interface SaveFieldHandle<T> {
  /** The live value, or `empty`. */
  read(): T
  /** The live value, for a component: it renders again when the value changes. */
  use(): T
  /** Replaces the value in memory; it goes out with the next save of any kind. */
  set(next: T): void
  /** Writes `next` to disk at a safe point, and takes it into the game once it is there: {@link writeModField}. */
  write(next: T, options?: { expect?: T }): Promise<Result<null>>
}

/** What a mod keeps on one kind of record: its value's empty state, and how it is read. */
export interface RecordFieldSpec<T> {
  /** The value while the record holds nothing for the mod. */
  empty: T
  /** The mod's own old keys on the record, read into `normalize` and removed by `with`. */
  legacy?: readonly string[]
  /** As {@link SaveFieldSpec.normalize}, for one record. */
  normalize?: (stored: unknown, legacy: Readonly<Record<string, unknown>>, from: string | null) => T
}

/** A live record in the game being played: one of her texts, one of her posts, or a comment under one. */
export type RecordRef =
  | { kind: 'message'; charId: string; messageId: string }
  | { kind: 'post'; charId: string; postId: string }
  | { kind: 'comment'; charId: string; postId: string; commentId: string }

/** How a write to a live record is fenced. */
export interface RecordWriteOptions {
  /**
   * The game the change was worked out in, from `currentRun()` when the work began: refused as
   * `MOD_WRITE_STALE` once that game has been left, as by a load or a return to the title.
   */
  run?: object
}

/** A mod's reader and writer for one kind of record, from {@link recordField}. */
export interface RecordFieldHandle<T> {
  /** The mod's value on `record`, or `empty`. Pure. */
  read(record: ModDataRecord): T
  /** A new record holding `next` as the mod's slice, without the legacy keys. Pure. */
  with<R extends ModDataRecord>(record: R, next: T): R
  /**
   * `next` as the mod's slice on the live record `ref` names, as `with` makes it: the record's
   * own fields and every other mod's slice stay as they are. In memory; it goes out with the next
   * save of any kind, or now with `saveChanges`. A refusal changes nothing and comes back as the
   * result's error, never as a throw: `MOD_WRITE_OFF`, `MOD_WRITE_NO_GAME`, `MOD_WRITE_STALE`,
   * `MOD_WRITE_GONE` (no such record, as when it was deleted), or `MOD_WRITE_FOREIGN`.
   */
  set(ref: RecordRef, next: T, options?: RecordWriteOptions): Result<null>
  /**
   * `set`, with the value worked out from the record's current one: `change` is handed it as
   * `read` makes it, and undefined leaves the record as it is.
   */
  update(ref: RecordRef, change: (current: T) => T | undefined, options?: RecordWriteOptions): Result<null>
}

/** What a record write puts on the record: the mod's slice, and the legacy keys it takes off. */
export interface RecordChange {
  slice: ModSlice
  drop: readonly string[]
}

/** Where a record field's writes go: core's game store, bound at its load. */
export interface RecordWrites {
  /**
   * Finds the live record `ref` names and hands it to `change`; what that answers goes on the
   * record, and undefined leaves it. Never throws.
   */
  update: (
    modId: string,
    ref: RecordRef,
    change: (record: Readonly<ModDataRecord>) => RecordChange | undefined,
    options: RecordWriteOptions
  ) => Result<null>
}

/** Where the live values are kept: core's game store, bound at its load. */
export interface SaveFieldStore {
  /** The value of each mod that has one this game, by id. */
  values: () => Readonly<Record<string, unknown>>
  set: (modId: string, value: unknown) => void
  subscribe: (onChange: () => void) => () => void
}

const fields = new Map<string, SaveFieldSpec<unknown>>()

let store: SaveFieldStore | null = null

let recordWrites: RecordWrites | null = null

/** Hands the handles the game store; null takes it away again. */
export function bindSaveFieldStore(next: SaveFieldStore | null): void {
  store = next
}

/** Hands the record fields the game store's records; null takes them away again. */
export function bindRecordWrites(next: RecordWrites | null): void {
  recordWrites = next
}

/** Every mod's registered save field this session, by id, whether the mod is on or off. */
export function saveFields(): ReadonlyMap<string, SaveFieldSpec<unknown>> {
  return fields
}

/** The version a slice the mod writes is stamped with; `0.0.0` for a mod `MODS` does not list. */
function versionOf(modId: string): string {
  return modById(modId)?.version ?? '0.0.0'
}

/** The slice `record` holds for `modId`, or undefined. */
function sliceOf(record: ModDataRecord, modId: string): ModSlice | undefined {
  const ex = record.ex
  return ex && typeof ex === 'object' && Object.hasOwn(ex, modId) ? ex[modId] : undefined
}

/** The legacy keys of `spec` that `record` holds, as read; none where there is no `normalize` to read them. */
function legacyOf(record: object, spec: RecordFieldSpec<unknown>): Record<string, unknown> {
  const keys = spec.normalize ? spec.legacy : undefined
  return Object.fromEntries(
    (keys ?? []).filter((key) => Object.hasOwn(record, key)).map((key) => [key, (record as Record<string, unknown>)[key]])
  )
}

/**
 * The mod's value from its slice and its legacy keys. Both go in as copies, so a `normalize` that
 * changes what it was handed, or a mod that later changes the value it returned, never changes
 * the data as read.
 */
function normalized<T>(spec: RecordFieldSpec<T>, stored: ModSlice | undefined, legacy: Record<string, unknown>): T {
  const data: unknown = structuredClone((stored as Partial<ModSlice> | null | undefined)?.data)
  if (!spec.normalize) return (data ?? spec.empty) as T
  const from = typeof stored?.v === 'string' ? stored.v : null
  return spec.normalize(data, structuredClone(legacy), from)
}

/** What a mod writes: its value, copied, under its version. */
function sliceFor(modId: string, value: unknown): ModSlice {
  return { v: versionOf(modId), data: structuredClone(value) }
}

/** A handle for a refused registration: it reads `empty` and writes nothing. */
function inertHandle<T>(empty: T): SaveFieldHandle<T> {
  const write = async (): Promise<Result<null>> => failed('MOD_WRITE_FOREIGN', 'That save field was refused.')
  return { read: () => empty, use: () => empty, set: () => {}, write }
}

/**
 * A mod's data in the save, registered once from its own files. Read on every load for as long
 * as the mod is registered, on or off, so a mod switched off finds its data where it left it.
 * During an installed mod's import, a field under another id is refused, as is a second field
 * under one id (which throws for an in-repo mod, whose bug it is); a refused field reads `empty`.
 */
export function saveField<T>(modId: string, spec: SaveFieldSpec<T>): SaveFieldHandle<T> {
  if (refusedAsForeign(modId, 'a save field')) return inertHandle(spec.empty)
  if (fields.has(modId)) {
    const message = `registered a second save field for \`${modId}\``
    const declared = declaredHooksNow()
    if (!declared?.declared(modId)) throw new Error(`[mods] ${modId}: ${message}`)
    declared.onRefused(modId, message)
    return inertHandle(spec.empty)
  }
  fields.set(modId, spec as SaveFieldSpec<unknown>)

  const read = (): T => {
    const values = store?.values()
    return values && Object.hasOwn(values, modId) ? (values[modId] as T) : spec.empty
  }
  const subscribe = (onChange: () => void): (() => void) => store?.subscribe(onChange) ?? (() => {})
  return {
    read,
    use: () => useSyncExternalStore(subscribe, read, read),
    set: (next) => {
      if (!store) throw new Error(`[mods] ${modId}: its save field was set before the game store was loaded`)
      store.set(modId, next)
    },
    write: (next, options) => writeModField(modId, next, options)
  }
}

/**
 * A mod's data on one kind of record inside the save (a character, a memory, a message, a post,
 * a comment), read and written by the mod itself wherever it has the record in hand, and set on a
 * live text, post or comment by its `set` and `update`. During an installed mod's import, a field
 * under another id is refused: it reads `empty`, `with` changes nothing, and a write is refused.
 */
export function recordField<T>(modId: string, spec: RecordFieldSpec<T>): RecordFieldHandle<T> {
  const refused = refusedAsForeign(modId, 'a record field')
  const drop = (spec.normalize ? spec.legacy : undefined) ?? []
  const read = (record: ModDataRecord): T => {
    if (refused) return spec.empty
    const stored = sliceOf(record, modId)
    const legacy = legacyOf(record, spec)
    if (stored === undefined && Object.keys(legacy).length === 0) return spec.empty
    return normalized(spec, stored, legacy)
  }
  const update = (ref: RecordRef, change: (current: T) => T | undefined, options: RecordWriteOptions = {}): Result<null> => {
    if (refused) return failed('MOD_WRITE_FOREIGN', 'That record field was refused.')
    if (!recordWrites) return failed('MOD_WRITE_NO_GAME', 'There is no game to write into.')
    return recordWrites.update(
      modId,
      ref,
      (record) => {
        const next = change(read(record))
        return next === undefined ? undefined : { slice: sliceFor(modId, next), drop }
      },
      options
    )
  }
  return {
    read,
    with: <R extends ModDataRecord>(record: R, next: T): R => {
      if (refused) return record
      const copy = { ...record } as Record<string, unknown>
      for (const key of drop) delete copy[key]
      copy.ex = { ...record.ex, [modId]: sliceFor(modId, next) }
      return copy as R
    },
    set: (ref, next, options) => update(ref, () => next, options),
    update
  }
}

/** What a load makes of the save's mod data: each registered mod's value, and the legacy keys it took. */
export interface ReadModSlices {
  values: Record<string, unknown>
  /** The legacy keys a mod read into its value, which the save no longer needs. */
  consumed: string[]
}

/**
 * Every registered save field's value from `save`. A mod the save holds nothing for has no value;
 * one whose `normalize` throws has none either, and `onFailed` is told, its data left as read.
 */
export function readModSlices(save: ModDataRecord, onFailed: (modId: string, error: unknown) => void): ReadModSlices {
  const values: Record<string, unknown> = {}
  const consumed: string[] = []
  for (const [modId, spec] of fields) {
    const stored = sliceOf(save, modId)
    const legacy = legacyOf(save, spec)
    if (stored === undefined && Object.keys(legacy).length === 0) continue
    try {
      values[modId] = normalized(spec, stored, legacy)
      consumed.push(...Object.keys(legacy))
    } catch (error) {
      onFailed(modId, error)
    }
  }
  return { values, consumed }
}

/**
 * The save's `ex`: every slice as read, with each mod that has a value writing it on top under its
 * version. A value that cannot be copied is reported and its slice is left as read.
 */
export function writeModSlices(read: Readonly<Record<string, ModSlice>>, values: Readonly<Record<string, unknown>>): Record<string, ModSlice> {
  const ex: Record<string, ModSlice> = { ...read }
  for (const [modId, value] of Object.entries(values)) {
    try {
      ex[modId] = sliceFor(modId, value)
    } catch (error) {
      console.error(`[mods] ${modId}: its save data could not be written; it is kept as it was`, error)
    }
  }
  return ex
}

/**
 * What the next semester's first save starts with: each mod that has a value carries what its
 * `carry` makes of it, and starts empty without one; a slice no mod read this game (its mod not
 * registered, or its data unreadable) is carried as read. A `carry` that throws is reported and
 * its value is carried as it stands.
 */
export function carryModSlices(
  read: Readonly<Record<string, ModSlice>>,
  values: Readonly<Record<string, unknown>>,
  context: TermCarryContext
): Record<string, ModSlice> {
  const ex: Record<string, ModSlice> = {}
  for (const [modId, slice] of Object.entries(read)) {
    if (!Object.hasOwn(values, modId)) ex[modId] = slice
  }
  for (const [modId, value] of Object.entries(values)) {
    const carry = fields.get(modId)?.carry
    if (!carry) continue
    try {
      const next = carry(value, context)
      if (next !== undefined) ex[modId] = sliceFor(modId, next)
    } catch (error) {
      console.error(`[mods] ${modId}: its save data could not be carried; it is carried as it was`, error)
      ex[modId] = sliceFor(modId, value)
    }
  }
  return ex
}

/** Where a mod's writes to its save data go: core's write lane, bound at its load. */
export interface ModWrites {
  /** Writes each id's next value, the caller's own and those of the mods it requires, at a safe point. */
  write: (
    modId: string,
    next: Readonly<Record<string, unknown>>,
    options?: { expect?: Readonly<Record<string, unknown>> }
  ) => Promise<Result<null>>
  /** Whether a save can be taken now, has to wait for the loop to settle, or never can. */
  safePoint: () => ManualSaveOffer
  /** Calls back whenever what {@link ModWrites.safePoint} answers may have moved. */
  subscribe: (onChange: () => void) => () => void
}

let modWrites: ModWrites | null = null

/** Hands the mods core's write lane; null takes it away again. */
export function bindModWrites(next: ModWrites | null): void {
  modWrites = next
}

function failed(code: string, message: string): Result<null> {
  return { ok: false, error: { code, message } }
}

/**
 * Writes `next` as the mod's own save data, and as the data of mods its `requires` lists, in one
 * save: at a point a save can be taken at, behind every save already on its way, and into the
 * live game only once it is on disk. `expect` is, per id, the value the edit was made from; the
 * write is refused once that is no longer the live value. A refusal writes nothing and changes
 * nothing, and comes back as the result's error, never as a throw: `MOD_WRITE_WAIT` (not a safe
 * point), `MOD_WRITE_STALE`, `MOD_WRITE_OFF`, `MOD_WRITE_FOREIGN`, `MOD_WRITE_NO_GAME`, or the
 * disk's own error.
 */
export async function writeModFields(
  modId: string,
  next: Readonly<Record<string, unknown>>,
  options?: { expect?: Readonly<Record<string, unknown>> }
): Promise<Result<null>> {
  if (!modWrites) return failed('MOD_WRITE_NO_GAME', 'There is no game to save into.')
  return modWrites.write(modId, next, options)
}

/** {@link writeModFields} for the mod's own data alone; `expect` is the value it edited from. */
export function writeModField<T>(modId: string, next: T, options?: { expect?: T }): Promise<Result<null>> {
  const expect = options && Object.hasOwn(options, 'expect') ? { expect: { [modId]: options.expect } } : undefined
  return writeModFields(modId, { [modId]: next }, expect)
}

/** Whether a save, and so a {@link writeModFields}, can be taken now (`open`), has to wait, or never can. */
export function safePoint(): ManualSaveOffer {
  return modWrites?.safePoint() ?? 'none'
}

const subscribeSafePoint = (onChange: () => void): (() => void) => modWrites?.subscribe(onChange) ?? (() => {})

/** {@link safePoint}, for a component: it renders again when the answer moves. */
export function useSafePoint(): ManualSaveOffer {
  return useSyncExternalStore(subscribeSafePoint, safePoint, safePoint)
}
