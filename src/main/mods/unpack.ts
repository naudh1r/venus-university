import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join, resolve, sep } from 'path'
import { unzipSync } from 'fflate'
import { MAX_ZIP_BYTES, MAX_ZIP_ENTRIES, isWindowsDeviceName } from '@shared/zipRules'
import { INACTIVE_RELEASE } from './layout'

const MANIFEST_LIMIT = 2 * 1024 * 1024

/** Reads only the root manifest into memory before anything is unpacked. */
export function releaseManifest(zip: Uint8Array): unknown {
  let found = false
  const files = unzipSync(zip, { filter: ({ name, originalSize }) => {
    if (name !== 'vxmod.json') return false
    if (found || originalSize > MANIFEST_LIMIT) throw new Error('Invalid release manifest entry.')
    found = true
    return true
  } })
  if (!files['vxmod.json']) throw new Error('Missing release manifest.')
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(files['vxmod.json']))
}

/**
 * Unpacks a release zip as it came into one folder: what the installer will do under
 * `data/mods/<id>/<version>/`, written here once so the loader's tests lay a fixture out exactly
 * as an install does. An entry that would land outside the folder refuses the whole zip before
 * anything is written.
 */
export function unpackRelease(zip: Uint8Array, folder: string): void {
  const names = new Set<string>()
  let bytes = 0
  const files = unzipSync(zip, { filter: ({ name, originalSize }) => {
    const key = name.replace(/\/$/, '').toLowerCase()
    const segments = key.split('/')
    if (key.startsWith('/') || segments.includes('..')) {
      throw new Error(`the zip names a file outside its folder: ${name}`)
    }
    if (segments.some((segment) => !segment || segment === '.'
        || /[\\:<>"|?*\x00-\x1f]|[. ]$/.test(segment) || isWindowsDeviceName(segment))
        || segments[0] === INACTIVE_RELEASE || names.has(key)) {
      throw new Error(`the zip names a file that is not a plain path: ${name}`)
    }
    names.add(key)
    bytes += originalSize
    if (names.size > MAX_ZIP_ENTRIES || bytes > MAX_ZIP_BYTES) throw new Error('The release archive exceeds its unpacking limit.')
    return true
  } })
  const root = resolve(folder)
  const planned: [string, Uint8Array][] = []
  for (const [name, bytes] of Object.entries(files)) {
    // A folder entry has nothing to write; its files make it.
    if (name.endsWith('/')) continue
    if (name.includes('\\') || name.includes('\0') || /^[A-Za-z]:/.test(name)) {
      throw new Error(`the zip names a file that is not a plain path: ${name}`)
    }
    const target = resolve(root, name)
    if (target !== root && !target.startsWith(root + sep)) {
      throw new Error(`the zip names a file outside its folder: ${name}`)
    }
    planned.push([target, bytes])
  }
  for (const [target, bytes] of planned) {
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, bytes)
  }
  mkdirSync(join(root), { recursive: true })
}
