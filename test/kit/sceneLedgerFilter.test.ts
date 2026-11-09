import { expect, it } from 'vitest'
import { filterSceneLedger, registerHooks, setHookRules } from '../../packages/modkit/src/renderer/hooks'
import type { LedgerResponse } from '@shared/types'
it('filters actual ledger rows without exposing mutable native values',()=>{
  setHookRules({isOn:()=>true,order:()=>0})
  registerHooks('ledger-filter-test',{keepSceneLedgerEntry:entry=>{
    expect(Object.isFrozen(entry)).toBe(true)
    expect(Object.isFrozen(entry.value)).toBe(true)
    return entry.kind!=='event'
  }})
  const ledger={memories:[],events:[{title:'A fixture event',charIds:['a']}],acts:[]} as unknown as LedgerResponse
  const before=structuredClone(ledger)
  const filtered=filterSceneLedger(ledger)
  expect(filtered.events).toEqual([])
  expect(ledger).toEqual(before)
})

