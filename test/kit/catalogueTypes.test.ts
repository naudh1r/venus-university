import { expectTypeOf, it } from 'vitest'
import type { BackgroundSets, JobDef, LocationDef } from '@vx/modkit/shared'
import type { BackgroundSets as NativeBackgrounds } from '../../src/shared/types'
import type { JobDef as NativeJob } from '../../src/shared/jobs'
import type { LocationDef as NativeLocation } from '../../src/shared/locations'

it('exposes the native catalogue definitions without narrowing their shapes', () => {
  expectTypeOf<JobDef>().toEqualTypeOf<NativeJob>()
  expectTypeOf<LocationDef>().toEqualTypeOf<NativeLocation>()
  expectTypeOf<BackgroundSets>().toEqualTypeOf<NativeBackgrounds>()
})
