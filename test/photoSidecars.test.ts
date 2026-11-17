import { describe, expect, it } from 'vitest'
import { isPhotoFile, isPhotoSidecar, nextPhotoIndex, photoSidecarOf } from '../src/shared/photoFiles'

describe('photo sidecar names', () => {
  it('shares a stem with current PNG/WebP pictures and legacy pictures', () => {
    for (const file of ['risa_chat_001.png', 'risa_chat_001.webp', 'risa_bunnyboard_123456.webp', 'photo_1790092329373_a1b2c3d4.png']) {
      const sidecar = photoSidecarOf(file)
      expect(isPhotoSidecar(sidecar)).toBe(true)
      expect(photoSidecarOf(sidecar.replace(/\.json$/, '.png'))).toBe(sidecar)
      expect(isPhotoFile(sidecar)).toBe(false)
      expect(isPhotoSidecar(file)).toBe(false)
    }
  })

  it('refuses JSON names outside the picture vocabulary', () => {
    for (const name of ['../risa_chat_001.json', 'risa_chat_1.json', 'risa_diary_001.json', 'Risa_chat_001.json', 'photo_1_A1B2C3D4.json', 'settings.json', 'risa_chat_001.json.png']) {
      expect(isPhotoSidecar(name)).toBe(false)
      expect(isPhotoFile(name)).toBe(false)
    }
  })

  it('reserves past pictures alone, ignoring sidecars even with a higher counter', () => {
    expect(nextPhotoIndex(['risa_chat_003.webp', 'risa_chat_099.json', 'risa_bunnyboard_100.png'], 'risa', 'chat')).toBe(4)
    expect(nextPhotoIndex(['risa_chat_099.json'], 'risa', 'chat')).toBe(1)
  })
})
