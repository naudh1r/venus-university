import { describe, expect, it } from 'vitest'
import { isPhotoFile, isWebpPhoto, photoUrl, pngPhotoOf } from '../src/shared/photoFiles'

describe('photo names', () => {
  it.each(['k3f9x2ab7q.png', 'k3f9x2ab7q.webp', 'risa_chat_003.png', 'risa_bunnyboard_123456.webp', 'photo_1790092329373_a1b2c3d4.png'])('accepts %s', name => {
    expect(isPhotoFile(name)).toBe(true)
    expect(isWebpPhoto(name)).toBe(name.endsWith('.webp'))
    expect(pngPhotoOf(name)).toMatch(/\.png$/)
  })
  it.each(['abcdefghi.png', 'abcdefghijk.png', 'Abcdefghij.png', 'abcdefghi_.png', '../abcdefghij.png', 'abcdefghij.gif', 'abcdefghij.png\n', 'risa_chat_1.png', 'risa_diary_001.png', 'photo_1_A1B2C3D4.png', 'abcdefghij.json'])('refuses %s', name => {
    expect(isPhotoFile(name)).toBe(false)
  })
})

describe('photoUrl', () => {
  const url = photoUrl('1790092788936', '79dd2743-3541-4172-9ac9-c42c485aa5cc', 'photo_1_a1b2c3d4.png')

  /**
   * The bug this guards: a `standard` scheme has its host canonicalized like a web host, and
   * a save id is all digits — read as an IPv4 address, overflowed, and refused before any
   * request is made. Chromium's parser is stricter than Node's for a scheme it knows, so the
   * check is made against `http:`, which Node canonicalizes the same way.
   */
  it('keeps the numeric save id out of the host', () => {
    const host = new URL(url).hostname
    expect(host).toBe('photo-feature')
    expect(() => new URL(`http://${host}/x`)).not.toThrow()
  })

  it('carries the playthrough, the character and the file in the path', () => {
    expect(new URL(url).pathname).toBe(
      '/@/photos/1790092788936/79dd2743-3541-4172-9ac9-c42c485aa5cc/photo_1_a1b2c3d4.png'
    )
  })
})
