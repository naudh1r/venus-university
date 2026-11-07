/** Plain catalogue values crossing the mods IPC boundary. */
export interface CatalogRelease {
  version: string
  url: string
  sha256: string
  kit: string
  game?: string
  main: boolean
  reviewed: boolean
  released: string
  changes: string[]
  incompatible: string | null
}
export interface CatalogMod {
  id: string
  name: string
  author: string
  blurb: string
  source: string
  cover?: string
  coverData?: string
  changelog: { version: string; changes: string[] }[]
  releases: CatalogRelease[]
  installedVersion: string | null
}
