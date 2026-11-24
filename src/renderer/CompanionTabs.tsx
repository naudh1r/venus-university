import type { JSX } from 'react'

/** Small, keyboard-accessible tabs; panels stay mounted so drafts survive a tab change. */
export function CompanionTabs<T extends string>({ id, label, tabs, active, onChange }: {
  id: string; label: string; tabs: readonly { id: T; label: string }[]; active: T; onChange: (value: T) => void
}): JSX.Element {
  return <div className="companion-tabs" role="tablist" aria-label={label}>
    {tabs.map((tab, index) => <button key={tab.id} id={`${id}-tab-${tab.id}`} role="tab"
      aria-selected={active === tab.id} aria-controls={`${id}-panel-${tab.id}`} tabIndex={active === tab.id ? 0 : -1}
      onClick={() => onChange(tab.id)} onKeyDown={event => {
        const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
        if (next < 0) return
        event.preventDefault(); onChange(tabs[next].id)
        document.getElementById(`${id}-tab-${tabs[next].id}`)?.focus()
      }}>{tab.label}</button>)}
  </div>
}
