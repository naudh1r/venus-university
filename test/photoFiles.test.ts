import { describe, expect, it } from 'vitest'
import {
  isPhotoFile,
  nextPhotoIndex,
  photoFileName,
  photoIndexOf,
  photoSlug,
  photoUrl
} from '../src/shared/photoFiles'

describe('photoFileName', () => {
  it('names a picture after the girl, the thread and which one it is', () => {
    expect(photoFileName('risa', 'bunnyboard', 1)).toBe('risa_bunnyboard_001.png')
    expect(photoFileName('risa', 'chat', 12)).toBe('risa_chat_012.png')
  })

  it('mints a name the protocol will serve', () => {
    expect(isPhotoFile(photoFileName('risa', 'bunnyboard', 1))).toBe(true)
    expect(isPhotoFile(photoFileName('risa', 'chat', 999))).toBe(true)
  })

  /** A save from before the rename still points at these, and the pictures are still there. */
  it('still reads the names it used to mint', () => {
    expect(isPhotoFile('photo_1790092329373_a1b2c3d4.png')).toBe(true)
  })

  it('refuses anything it did not mint', () => {
    expect(isPhotoFile('../secrets.png')).toBe(false)
    expect(isPhotoFile('photo_1790092329373_A1B2C3D4.png')).toBe(false)
    expect(isPhotoFile('sprite_1790092329373_a1b2c3d4.png')).toBe(false)
    expect(isPhotoFile('risa_diary_001.png')).toBe(false)
    expect(isPhotoFile('Risa_chat_001.png')).toBe(false)
    expect(isPhotoFile('risa_chat_1.png')).toBe(false)
  })
})

describe('photoSlug', () => {
  it('is her first name, as a filename', () => {
    expect(photoSlug('Risa', 'fc585bfd-7')).toBe('risa')
    expect(photoSlug('Maddy Katherine', 'x')).toBe('maddykatherine')
  })

  /** A name with nothing a filename can keep still has to produce one. */
  it('falls back to her id where her name leaves nothing', () => {
    expect(photoSlug('???', 'FC585BFD-760f')).toBe('fc585bfd')
    expect(photoSlug('', 'abc12345-9')).toBe('abc12345')
  })
})

describe('nextPhotoIndex', () => {
  it('starts at one in an empty folder', () => {
    expect(nextPhotoIndex([], 'risa', 'chat')).toBe(1)
  })

  it('counts past the highest one taken, not the number of them', () => {
    const taken = ['risa_chat_001.png', 'risa_chat_004.png', 'risa_chat_002.png']
    expect(nextPhotoIndex(taken, 'risa', 'chat')).toBe(5)
  })

  /** Her Bunnyboard pictures and her chat pictures count separately, as do the other girls'. */
  it('counts the pictures of one girl and one kind, and no others', () => {
    const taken = [
      'risa_chat_007.png',
      'risa_bunnyboard_002.png',
      'maddy_bunnyboard_009.png',
      'photo_1790092329373_a1b2c3d4.png'
    ]
    expect(nextPhotoIndex(taken, 'risa', 'bunnyboard')).toBe(3)
    expect(nextPhotoIndex(taken, 'risa', 'chat')).toBe(8)
    expect(nextPhotoIndex(taken, 'ines', 'chat')).toBe(1)
  })
})

describe('photoIndexOf', () => {
  it('reads the counter back out of a name', () => {
    expect(photoIndexOf('risa_chat_012.png', 'risa', 'chat')).toBe(12)
  })

  it('answers null for a name belonging to somebody or something else', () => {
    expect(photoIndexOf('risa_chat_012.png', 'risa', 'bunnyboard')).toBe(null)
    expect(photoIndexOf('maddy_chat_012.png', 'risa', 'chat')).toBe(null)
    expect(photoIndexOf('photo_1790092329373_a1b2c3d4.png', 'risa', 'chat')).toBe(null)
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
    expect(host).toBe('photos')
    expect(() => new URL(`http://${host}/x`)).not.toThrow()
  })

  it('carries the playthrough, the character and the file in the path', () => {
    expect(new URL(url).pathname).toBe(
      '/1790092788936/79dd2743-3541-4172-9ac9-c42c485aa5cc/photo_1_a1b2c3d4.png'
    )
  })
})
