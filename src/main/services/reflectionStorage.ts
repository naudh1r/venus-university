import { mkdir, readFile, readdir, rename, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { assertSafeCharId } from '@vx/modkit/shared'
import { ECHO_ART_ID } from '../../shared/echo'
import { assertReflectionStage, reflectionStageOf, type ReflectionStage } from '@shared/reflectionPortrait'
import { imageTypeOf } from '@vx/modkit/shared'
import { getDataPath } from '../paths'

/** Optional JSON extension: no new ZIP paths or changes to the stock character schema. */
export interface PortableReflection { version: 1; image: string | null; stage: ReflectionStage }
const folder = (): string => join(getDataPath(), 'echoes', 'reflections')
function file(charId: string): string { assertSafeCharId(charId); return join(folder(), `${charId}.portable.json`) }
async function optional(path: string): Promise<unknown | null> {
 try { return JSON.parse(await readFile(path, 'utf8')) }
 catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error }
}
export function validatePortableReflection(value: unknown): PortableReflection {
 const v = value as PortableReflection | null
 if (!v || v.version !== 1) throw Error('Invalid reflection backup.')
 assertReflectionStage(v.stage)
 if (v.image !== null) {
  if (typeof v.image !== 'string' || v.image.length > 28_000_000 || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(v.image)) throw Error('Invalid reflection image.')
  const bytes = Buffer.from(v.image.slice(v.image.indexOf(',') + 1), 'base64')
  if (bytes.length > 20 * 1024 * 1024 || imageTypeOf(bytes) !== 'image/png') throw Error('Invalid reflection image.')
 }
 return { version: 1, image: v.image, stage: reflectionStageOf(v.stage) }
}
/** Imports/backups must work even with the mod off; only generation is gated. */
export async function readPortableReflection(charId: string): Promise<PortableReflection | null> {
 const current = await optional(file(charId))
 if (current !== null) return validatePortableReflection(current)
 const pointer = await optional(join(folder(), `${charId}.json`)) as { art?: unknown } | null
 const stage = await optional(join(folder(), `${charId}.stage.json`))
 if (!pointer && !stage) return null
 let image: string | null = null
 if (pointer) {
  if (typeof pointer.art !== 'string' || !ECHO_ART_ID.test(pointer.art)) throw Error('Invalid reflection artwork reference.')
  const bytes = await readFile(join(getDataPath(), 'echoes', 'art', `${pointer.art}.png`))
  image = `data:image/png;base64,${bytes.toString('base64')}`
 }
 return validatePortableReflection({ version: 1, image, stage: reflectionStageOf(stage) })
}
export async function writePortableReflection(charId: string, value: unknown): Promise<void> {
 const destination = file(charId), data = validatePortableReflection(value), temp = `${destination}.${randomUUID()}.tmp`
 await mkdir(folder(), { recursive: true })
 try { await writeFile(temp, JSON.stringify(data), { flag: 'wx' }); await rename(temp, destination) }
 finally { await rm(temp, { force: true }) }
}
export async function removePortableReflection(charId: string): Promise<void> { await rm(file(charId), { force: true }) }
export async function backupReflections(): Promise<Record<string, PortableReflection>> {
 let names: string[]
 try { names = await readdir(folder()) } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}; throw error }
 const ids = new Set(names.filter(n => n.endsWith('.json')).map(n => n.replace(/(?:\.portable|\.stage)?\.json$/, '')))
 const result: Record<string, PortableReflection> = {}
 for (const id of ids) { const data = await readPortableReflection(id); if (data) result[id] = data }
 return result
}
export function prepareReflectionRestore(value: unknown): () => Promise<void> {
 if (value === undefined) return async () => {}
 if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid reflection backup list.')
 const entries = Object.entries(value).map(([id, data]) => { assertSafeCharId(id); return [id, validatePortableReflection(data)] as const })
 return async () => { for (const [id, data] of entries) await writePortableReflection(id, data) }
}
