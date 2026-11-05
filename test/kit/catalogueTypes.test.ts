import { expectTypeOf, it } from 'vitest'
import type { JobDef, LocationDef } from '@vx/modkit/shared'
import type { JobDef as NativeJob } from '../../src/shared/jobs'
import type { LocationDef as NativeLocation } from '../../src/shared/locations'

it('exposes the native catalogue definitions without narrowing their shapes', () => {
  expectTypeOf<JobDef>().toEqualTypeOf<NativeJob>()
  expectTypeOf<LocationDef>().toEqualTypeOf<NativeLocation>()
})
