import type { Manifest, ModSource, SourceRelease } from '@vx/modkit/host/shared'

export function sourceManifest(id = 'hello-mod', version = '1.0.0', over: Partial<Manifest> = {}): Manifest {
  return { manifest: 1, id, version, name: id, author: 'Tester', blurb: 'A test mod.',
    source: `https://github.com/test/${id}`, kit: '>=0.7.0', hooks: [], main: false,
    scope: 'anytime', defaultOn: false, ...over }
}
export function sourceRelease(id = 'hello-mod', version = '1.0.0', over: Partial<Manifest> = {}): SourceRelease & { sha256: string } {
  return { version, zip: `https://example.com/${id}-${version}.zip`, sha256: 'a'.repeat(64), size: 100,
    manifest: sourceManifest(id, version, over) }
}
export function sourceList(...releases: SourceRelease[]): ModSource {
  const ids = [...new Set(releases.map(release => release.manifest.id))]
  return { source: 1, name: 'Test source', mods: ids.map(id => ({ id, repo: `https://github.com/test/${id}`,
    releases: releases.filter(release => release.manifest.id === id) })) }
}
