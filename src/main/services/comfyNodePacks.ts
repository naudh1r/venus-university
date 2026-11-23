import { appError } from '@shared/errors'
import { PINNED_NODES, type NodePack } from '@shared/setupManifest'

/** A pinned custom-node pack a mod contributes, in the same terms as core's own. */
export interface ComfyNodePack {
  /** Lower-case dash id, unique among the mod's own packs. */
  id: string
  label: string
  owner: string
  repo: string
  /** Folder name created under `ComfyUI/custom_nodes`. */
  dirName: string
  /** The full 40-character commit the archive is cut from. */
  sha: string
  /** Exact archive size in bytes. */
  bytes: number
  /** Full SHA256 of the archive, checked before anything is extracted. */
  sha256: string
  /** Top-level import names its pip dependencies provide. */
  modules: readonly string[]
  /** The node classes the mod's graphs take from this pack. */
  classes: readonly string[]
}

/** A registered pack as the installer reads it, with the mod that owns it. */
export interface RegisteredNodePack extends NodePack {
  readonly modId: string
}

const PACK_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const GITHUB_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/
const MODULE_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/
const CLASS_NAME = /^\S(?:.{0,198}\S)?$/

const packs = new Map<string, RegisteredNodePack>()

/** The map key one mod's pack is kept under. */
function keyOf(modId: string, packId: string): string {
  return `${modId}\n${packId}`
}

/** True when `value` is an array of distinct strings that each match `rule`. */
function namesMatching(value: unknown, rule: RegExp): value is string[] {
  return Array.isArray(value) && value.every((name) => typeof name === 'string' && rule.test(name)) &&
    new Set(value).size === value.length
}

/** The pack's fields copied and checked, or the reason it is refused. */
function checkedPack(pack: ComfyNodePack): NodePack {
  const invalid: (detail: string) => never = (detail) => {
    throw appError('COMFY_NODE_PACK_INVALID', 'A ComfyUI node pack is not pinned correctly.', detail)
  }
  if (!pack || typeof pack !== 'object') invalid('The pack must be an object.')
  const { id, label, owner, repo, dirName, sha, bytes, sha256, modules, classes } = pack
  if (typeof id !== 'string' || !PACK_ID.test(id) || id.length > 64) invalid('id must be a lower-case dash id.')
  if (typeof label !== 'string' || !label.trim() || label.length > 120) invalid(`${id}: label must be a short text.`)
  for (const [field, value] of [['owner', owner], ['repo', repo], ['dirName', dirName]] as const) {
    if (typeof value !== 'string' || !GITHUB_NAME.test(value) || /^\.+$/.test(value) || value.endsWith('.')) {
      invalid(`${id}: ${field} must be a plain folder-safe name.`)
    }
  }
  if (typeof sha !== 'string' || !/^[0-9a-f]{40}$/.test(sha)) invalid(`${id}: sha must be a full 40-character commit.`)
  if (typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes <= 0) invalid(`${id}: bytes must be the archive's exact size.`)
  if (typeof sha256 !== 'string' || !/^[0-9a-fA-F]{64}$/.test(sha256)) invalid(`${id}: sha256 must be the archive's full SHA256.`)
  if (!namesMatching(modules, MODULE_NAME)) invalid(`${id}: modules must be distinct Python import names.`)
  if (!namesMatching(classes, CLASS_NAME) || !classes.length) invalid(`${id}: classes must name the node classes it provides.`)
  return {
    id, label: label.trim(), owner, repo, dirName, sha, bytes, sha256,
    modules: Object.freeze([...modules]), classes: Object.freeze([...classes])
  }
}

/**
 * Registers a mod's pinned custom-node pack for the managed install to fetch on demand. Refuses a
 * malformed pin, a second pack under the same id, and a folder name core or another pack already
 * uses (compared without case, as Windows does). The owner removes it when deactivated.
 */
export function registerComfyNodePack(modId: string, pack: ComfyNodePack): () => void {
  if (typeof modId !== 'string' || !modId.trim() || modId !== modId.trim()) {
    throw appError('COMFY_NODE_PACK_INVALID', 'A ComfyUI node pack needs an owner.')
  }
  const checked = checkedPack(pack)
  const key = keyOf(modId, checked.id)
  if (packs.has(key)) {
    throw appError('COMFY_NODE_PACK_DUPLICATE', `${modId} already registered the node pack ${checked.id}.`)
  }
  const folder = checked.dirName.toLowerCase()
  const taken = [...PINNED_NODES, ...packs.values()].find((node) => node.dirName.toLowerCase() === folder)
  if (taken) {
    throw appError(
      'COMFY_NODE_PACK_DUPLICATE',
      `${modId}'s node pack ${checked.id} would install into a folder already in use.`,
      `${checked.dirName} is ${'modId' in taken ? `${taken.modId}'s` : "core's"} ${taken.label}.`
    )
  }
  const entry: RegisteredNodePack = Object.freeze({ ...checked, modId })
  packs.set(key, entry)
  return () => { if (packs.get(key) === entry) packs.delete(key) }
}

/** One mod's registered pack, refused when that mod registered none under the id. */
export function registeredNodePack(modId: string, packId: string): RegisteredNodePack {
  const pack = typeof modId === 'string' && typeof packId === 'string' ? packs.get(keyOf(modId, packId)) : undefined
  if (!pack) {
    throw appError('COMFY_NODE_PACK_UNKNOWN', `${String(modId)} registered no ComfyUI node pack ${String(packId)}.`)
  }
  return pack
}

/** Every registered pack, in registration order. */
export function registeredNodePacks(): readonly RegisteredNodePack[] {
  return [...packs.values()]
}
