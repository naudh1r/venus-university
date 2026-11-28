import { useEffect, useState, type JSX } from 'react'
import { compatibilityWarning } from '@shared/modCompatibility'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  BUILD,
  missingRequirement,
  MODS,
  modsOn,
  optionOn,
  switchedOn,
  type ModDef,
  type ModSwitches
} from '@shared/mods'
import { isBuiltInRow, sessionRow, type ModSessionEntry } from '@shared/modSession'
import { ConfirmModal } from '../components/ConfirmModal'
import { useModalShell } from '../components/useModalShell'
import { TitleTab } from '../components/TitleTab'
import { modDetail, optionControl, optionPreview } from '../mods/hooks'
import { SlotBoundary } from '../mods/ModSlot'
import { isWebBuild } from '../platform'
import { ModsBrowse } from './ModsBrowse'
import { ModsRestartOffer } from './ModsRestartOffer'
import type { InstalledModRemoval } from '@shared/modCatalog'
import { ModsAuthorsFold } from './ModsAuthorsFold'
import { notRunningLine, useModSessionStore } from '../stores/modSessionStore'
import { useModsStore } from '../stores/modsStore'
import { useUiStore } from '../stores/uiStore'
import { gestures, lift, press, panelUnderTab, veilIn } from './motion'
import '../vu_styles/Mods.css'

/** What a mod's row says of it, and the colour that goes with the word. */
type Standing = 'on' | 'off' | 'needs'

function standingOf(switches: ModSwitches, mod: ModDef, running: boolean): { kind: Standing; text: string } {
  if (!running) return { kind: 'needs', text: 'not running' }
  if (!switchedOn(switches, mod.id)) return { kind: 'off', text: 'off' }
  const missing = missingRequirement(switches, mod.id)
  // A mod that needs something this build lacks names itself; there is nothing else to name.
  if (missing) return { kind: 'needs', text: missing.id === mod.id ? 'unavailable' : `needs ${missing.name}` }
  return { kind: 'on', text: 'on' }
}

/** When a mod's switch takes effect, in the two words the legend explains. */
function scopeWords(mod: ModDef): string {
  return mod.scope === 'playthrough' ? 'per playthrough' : 'any time'
}

/** Where a mod came from, in a word for its tag. */
function originWords(session: ModSessionEntry | undefined): string {
  // A built-in with a main entry has a session row too.
  if (!session || isBuiltInRow(session)) return 'built in'
  return session.dev ? 'from folder' : 'installed'
}

/** The folder's own name, which is what a row has room for. */
function folderName(folder: string): string {
  return folder.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? folder
}

interface SwitchProps {
  id: string
  label: string
  on: boolean
  disabled?: boolean
  onChange: (on: boolean) => void
}

/** A yes-or-no switch: a real button that says which way it stands. */
function Switch({ id, label, on, disabled = false, onChange }: SwitchProps): JSX.Element {
  return (
    <button
      id={id}
      className="vu-mods-switch"
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
    >
      <span className="vu-mods-switch-track">
        <span className="vu-mods-switch-knob" />
      </span>
    </button>
  )
}

export interface ModsModalProps {
  /** Drawn by whatever opened this — a portal inherits neither palette nor state rules. */
  theme: 'day' | 'night'
  /** Given by a screen that holds this itself, a game or a break; absent on the Main Menu. */
  onClose?: () => void
  /** Opened over a game in progress, which a per-playthrough switch does not reach. */
  inGame?: boolean
  /**
   * Asked before a change is made: what it would do to the screen underneath right now, where
   * that is something he could not take back. Null, or absent, and the change is simply made.
   */
  warn?: (change: ModChange) => ModWarning | null
}

/** One switch about to move: a mod's own where `optionId` is null, else one of its options. */
export interface ModChange {
  modId: string
  optionId: string | null
  on: boolean
}

/** What he is asked before a change that costs something at once. */
export interface ModWarning {
  title: string
  message: string
  confirmText: string
}

/**
 * The list of the community mods in this build: which are on, who wrote each, and each one's
 * own options. Every change is written as it is made. Opened from the Main Menu, and from the
 * menu of a game or a break.
 */
export function ModsModal({ theme, onClose, inGame = false, warn }: ModsModalProps): JSX.Element | null {
  const [browseModId, setBrowseModId] = useState<string | null>(null)
  const [tab, setTab] = useState<'installed' | 'browse'>('installed')
  const closeModal = useUiStore((s) => s.closeModal)
  const close = onClose ?? ((): void => closeModal('mods'))
  const [asking, setAsking] = useState<{ change: ModChange; warning: ModWarning } | null>(null)

  /** Makes a change, or asks first where the screen underneath says it costs something. */
  function request(change: ModChange): void {
    const existing = warn?.(change) ?? null
    const mod = MODS.find((entry) => entry.id === change.modId)
    const compatibility = change.on && change.optionId === null && mod
      ? compatibilityWarning(mod, __APP_VERSION__) : null
    const warning = compatibility
      ? { title: 'Compatibility unconfirmed', message: [compatibility, existing?.message].filter(Boolean).join('\n\n'), confirmText: existing?.confirmText ?? 'Enable anyway' }
      : existing
    if (warning) setAsking({ change, warning })
    else apply(change)
  }

  function apply(change: ModChange): void {
    if (change.optionId === null) void setMod(change.modId, change.on)
    else void setOption(change.modId, change.optionId, change.on)
  }
  const switches = useModsStore((s) => s.switches)
  const setMod = useModsStore((s) => s.setMod)
  const setOption = useModsStore((s) => s.setOption)
  const table = useModSessionStore((s) => s.table)
  const shiftStart = useModSessionStore((s) => s.shiftStart)
  const running = useModSessionStore((s) => s.running)
  const dataNotes = useModSessionStore((s) => s.dataNotes)
  // A library has no switch and no row; the mods that need it name it on theirs.
  const [removals, setRemovals] = useState<InstalledModRemoval[]>([])
  const [uninstalling, setUninstalling] = useState<string | null>(null)
  const [uninstallAsk, setUninstallAsk] = useState<{ id: string; name: string; dependents: string[] } | null>(null)
  const [uninstallError, setUninstallError] = useState('')
  const [restartForRemoval, setRestartForRemoval] = useState(false)

  async function refreshRemoval(): Promise<void> {
    try {
      const result = await window.api.mods.removalStatus()
      if (result.ok) {
        setRemovals((current) => result.data.map((row) => ({
          ...row,
          pending: row.pending || current.some((one) => one.id === row.id && one.pending)
        })))
      } else setUninstallError(result.error.message)
    } catch {
      setUninstallError('Could not read installed mods.')
    }
  }

  useEffect(() => {
    if (!isWebBuild()) void refreshRemoval()
  }, [table])

  const removalOf = (id: string) => removals.find((row) => row.id === id)
  const removalPending = (id: string) => removalOf(id)?.pending === true

  async function uninstall(id: string): Promise<void> {
    setUninstallAsk(null)
    setUninstalling(id)
    setUninstallError('')
    try {
      const result = await window.api.mods.uninstall(id)
      if (!result.ok) {
        setUninstallError(result.error.message)
        return
      }
      setRemovals((rows) => rows.map((row) => row.id === id ? { ...row, pending: true } : row))
      setRestartForRemoval(true)
    } catch {
      setUninstallError('Could not uninstall the mod. Try again.')
    } finally {
      setUninstalling(null)
    }
  }

  function removalAction(id: string, name: string, busy = false): JSX.Element | null {
    const removal = removalOf(id)
    if (!removal || table.mods.some((row) => row.id === id && row.dev)) return null
    if (removal.pending) {
      return (
        <div className="vu-mods-note">
          <p role="status">Will be removed on restart.</p>
          {!restartForRemoval && (
            <motion.button type="button" className="vu-btn vu-btn--quiet"
              {...gestures(false, lift, press)} onClick={() => setRestartForRemoval(true)}>
              Restart…
            </motion.button>
          )}
        </div>
      )
    }
    const disabled = busy || uninstalling !== null
    return (
      <motion.button type="button" className="vu-btn vu-btn--quiet" disabled={disabled}
        {...gestures(disabled, lift, press)}
        onClick={() => setUninstallAsk({ id, name, dependents: removal.dependents })}>
        Uninstall
      </motion.button>
    )
  }

  const listed = MODS.filter((mod) => !mod.library)
  // A folder whose manifest could not be read has no entry in the list: it gets a row of its own, by folder.
  const unreadable = table.mods.filter((mod) => mod.def === null)
  // Libraries, new installs and a folder still waiting on cleanup can have no switch row.
  const recordedOnly = removals.filter(({ id }) =>
    !listed.some((mod) => mod.id === id) && !unreadable.some((mod) => mod.id === id) &&
    !table.mods.some((mod) => mod.id === id && mod.dev)
  )
  const sessionOf = (id: string): ModSessionEntry | undefined => sessionRow(table, id)
  const [selectedId, setSelectedId] = useState(listed[0]?.id ?? null)

  const { host, overlayProps } = useModalShell(() => {
    if (tab === 'browse' && browseModId) setBrowseModId(null)
    else close()
  })
  if (!host) return null

  const selected = listed.find((mod) => mod.id === selectedId) ?? null
  const selectedSession = selected ? sessionOf(selected.id) : undefined
  const missing = selected ? missingRequirement(switches, selected.id) : null
  const count = modsOn(switches, listed).length
  // A mod's own page, where one of the mods that are on has one for it.
  const Detail = selected ? modDetail(selected) : undefined

  return createPortal(
    <motion.div
      className="vu-veil"
      data-theme={theme}
      variants={veilIn}
      initial="hidden"
      animate="shown"
      exit="gone"
      {...overlayProps}
    >
      <motion.div
        id="mods-modal"
        className="vu-sheet vu-mods vu-paper"
        role="dialog"
        aria-modal="true"
        aria-label="Mods"
        variants={panelUnderTab}
      >
        <TitleTab>Mods</TitleTab>

        <header className="vu-mods-head">
          <div>
            <h2 className="vu-mods-build">{BUILD.name}</h2>
            <p className="vu-mods-about">
              version {BUILD.version} · unofficial community mods · not made or supported by Venus
              Dev
            </p>
          </div>
          <span id="mods-count" className="vu-mods-count">
            {count} of {listed.length} on
          </span>
        </header>

        {!isWebBuild() && <div className="vu-mods-tabs" role="tablist" aria-label="Mods">
          {(['installed', 'browse'] as const).map((name) => <motion.button key={name} id={`mods-tab-${name}`}
            role="tab" aria-selected={tab === name} className="vu-btn vu-btn--quiet"
            {...gestures(false, lift, press)} onClick={() => setTab(name)}>{name === 'installed' ? 'Installed' : 'Browse'}</motion.button>)}
        </div>}
        {!isWebBuild() && <ModsBrowse theme={theme} active={tab === 'browse'} selectedId={browseModId}
          setSelectedId={setBrowseModId} removalPending={removalPending}
          removalAction={removalAction} refreshRemoval={refreshRemoval} />}
        {uninstallError && <p className="vu-mods-note" role="status">{uninstallError}</p>}
        {restartForRemoval && (
          <ModsRestartOffer onLater={() => setRestartForRemoval(false)} onError={setUninstallError} />
        )}
        <div className="vu-mods-installed" hidden={tab !== 'installed'}>
        <div className="vu-mods-panes">
          {listed.length === 0 && unreadable.length === 0 && recordedOnly.length === 0 && (
            <p id="mods-none" className="vu-mods-blurb">
              This build carries no mods yet. It is the game as released, with this screen ready
              for them.
            </p>
          )}
          <ul className="vu-mods-list">
            {listed.map((mod) => {
              const session = sessionOf(mod.id)
              const isRunning = running(mod.id)
              const standing = standingOf(switches, mod, isRunning)
              return (
                <li key={mod.id} className="vu-mods-row" data-selected={mod.id === selectedId}>
                  <button
                    id={`mods-pick-${mod.id}`}
                    className="vu-mods-pick"
                    type="button"
                    aria-pressed={mod.id === selectedId}
                    onClick={() => setSelectedId(mod.id)}
                  >
                    <span className="vu-mods-name">{mod.name}</span>
                    <span className="vu-mods-meta">
                      {mod.author} · {scopeWords(mod)}
                      {session?.dev ? ` · from folder ${folderName(session.folder)}` : ''}
                    </span>
                    {session && !isRunning && (
                      <span className="vu-mods-row-line" data-kind="needs">
                        Not running this session: {notRunningLine(session, table, shiftStart)}
                      </span>
                    )}
                    {session && isRunning && session.warnings.length > 0 && (
                      <span className="vu-mods-row-line">{session.warnings.join(' · ')}</span>
                    )}
                    {removalPending(mod.id) && <span className="vu-mods-row-line">Will be removed on restart.</span>}
                    {dataNotes[mod.id] && <span className="vu-mods-row-line">{dataNotes[mod.id]}</span>}
                  </button>
                  <span className="vu-mods-standing" data-kind={standing.kind}>
                    {standing.text}
                  </span>
                  <Switch
                    id={`mods-switch-${mod.id}`}
                    label={`${mod.name}, ${standing.text}`}
                    on={switchedOn(switches, mod.id)}
                    disabled={!isRunning}
                    onChange={(on) => {
                      setSelectedId(mod.id)
                      request({ modId: mod.id, optionId: null, on })
                    }}
                  />
                </li>
              )
            })}
            {recordedOnly.map(({ id }) => {
              const name = sessionOf(id)?.manifest?.name ?? id
              return (
                <li key={id} className="vu-mods-row">
                  <span className="vu-mods-pick">
                    <span className="vu-mods-name">{name}</span>
                    <span className="vu-mods-meta">installed folder</span>
                  </span>
                  {removalAction(id, name)}
                </li>
              )
            })}
            {unreadable.map((mod) => (
              <li key={`unreadable-${mod.folder}`} className="vu-mods-row" data-kind="unreadable">
                <span className="vu-mods-pick">
                  <span className="vu-mods-name">{folderName(mod.folder)}</span>
                  <span className="vu-mods-meta">{mod.dev ? 'developer folder' : 'installed folder'}</span>
                  <span className="vu-mods-row-line" data-kind="needs">
                    Not running this session: {mod.message}
                  </span>
                </span>
                {removalAction(mod.id, folderName(mod.folder))}
              </li>
            ))}
          </ul>

          {selected && (
            <section className="vu-mods-detail" aria-live="polite">
              <div>
                <h3 className="vu-mods-detail-name">{selected.name}</h3>
                <p className="vu-mods-about">
                  by {selected.author} · version {selected.version}
                </p>
              </div>
              <p className="vu-mods-note">
                Supports Venus University: {selected.game ?? 'not declared'} · running {__APP_VERSION__}
              </p>
              {compatibilityWarning(selected, __APP_VERSION__) && (
                <p className="vu-mods-note" data-kind="needs" role="status">
                  {compatibilityWarning(selected, __APP_VERSION__)}
                </p>
              )}
              <p className="vu-mods-blurb">{selected.blurb}</p>
              <p className="vu-mods-tags">
                <span className="vu-mods-tag">{originWords(selectedSession)}</span>
                <span className="vu-mods-tag">{scopeWords(selected)}</span>
                {selectedSession?.manifest && <span className="vu-mods-tag">kit {selectedSession.manifest.kit}</span>}
              </p>
              {selectedSession?.manifest && (
                <p className="vu-mods-about" data-cursor="text">
                  {selectedSession.dev ? selectedSession.folder : selectedSession.manifest.source}
                </p>
              )}
              {removalAction(selected.id, selected.name)}
              {selected.offNote && <p className="vu-mods-note">{selected.offNote}</p>}
              {selectedSession && !running(selected.id) && (
                <p className="vu-mods-note" data-kind="needs">
                  Not running this session: {notRunningLine(selectedSession, table, shiftStart)}. Its switch stays
                  where you left it, and what it saved is kept.
                </p>
              )}
              {selectedSession?.warnings.map((warning) => (
                <p key={warning} className="vu-mods-note">
                  {warning}
                </p>
              ))}
              {inGame && selected.scope === 'playthrough' && (
                <p className="vu-mods-note" data-kind="needs">
                  Set when a playthrough starts. A change here leaves the game you are in as it is.
                </p>
              )}
              {missing && missing.id !== selected.id && (
                <p className="vu-mods-note" data-kind="needs">
                  Needs {missing.name}. Switch that on first.
                </p>
              )}

              <hr className="vu-rule" />
              {Detail && (
                <Detail
                  key={selected.id}
                  mod={selected}
                  Switch={Switch}
                  optionOn={(optionId) => optionOn(switches, selected.id, optionId)}
                  setOption={(optionId, on) => request({ modId: selected.id, optionId, on })}
                />
              )}
              {!Detail && <h4 className="vu-mods-label">Options</h4>}
              {Detail ? null : selected.options?.length ? (
                <ul className="vu-mods-options">
                  {selected.options.map((option, index, all) => {
                    if (!option.group) {
                      const Control = optionControl(selected.id, option.id)
                      return (
                        <li key={option.id} className="vu-mods-option">
                          <span className="vu-mods-option-text">
                            <span className="vu-mods-option-label">{option.label}</span>
                            <span className="vu-mods-option-hint">{option.hint}</span>
                            {Control && (
                              <span className="vu-mods-option-control">
                                <SlotBoundary slot="optionControls" modId={selected.id}>
                                  <Control
                                    optionId={option.id}
                                    on={optionOn(switches, selected.id, option.id)}
                                  />
                                </SlotBoundary>
                              </span>
                            )}
                          </span>
                          <Switch
                            id={`mods-option-${selected.id}-${option.id}`}
                            label={option.label}
                            on={optionOn(switches, selected.id, option.id)}
                            onChange={(on) => request({ modId: selected.id, optionId: option.id, on })}
                          />
                        </li>
                      )
                    }
                    // A group is drawn once, where its first option stands, with all of them.
                    if (all.findIndex((o) => o.group === option.group) !== index) return null
                    const group = selected.optionGroups?.find((g) => g.id === option.group)
                    const members = all.filter((o) => o.group === option.group)
                    const Preview = optionPreview(selected.id, option.group)
                    return (
                      <li key={`group-${option.group}`} className="vu-mods-option vu-mods-group">
                        <span className="vu-mods-option-text">
                          <span className="vu-mods-option-label">{group?.label ?? option.group}</span>
                          {group?.hint && <span className="vu-mods-option-hint">{group.hint}</span>}
                        </span>
                        <ul className="vu-mods-group-list">
                          {members.map((member) => (
                            <li key={member.id} className="vu-mods-group-row">
                              <span className="vu-mods-group-label">{member.label}</span>
                              <Switch
                                id={`mods-option-${selected.id}-${member.id}`}
                                label={member.label}
                                on={optionOn(switches, selected.id, member.id)}
                                onChange={(on) =>
                                  request({ modId: selected.id, optionId: member.id, on })
                                }
                              />
                            </li>
                          ))}
                        </ul>
                        {Preview && (
                          <div className="vu-mods-group-preview">
                            <Preview
                              optionId={
                                members.find((member) => optionOn(switches, selected.id, member.id))
                                  ?.id ?? null
                              }
                            />
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="vu-mods-option-hint">This mod has no options.</p>
              )}
            </section>
          )}
        </div>

        <div className="vu-mods-legend">
          <p>
            <b>any time</b> · can be switched on or off whenever you like.
          </p>
          <p>
            <b>per playthrough</b> · set when a playthrough starts. A change applies to new
            playthroughs.
          </p>
        </div>

        {/* The browser build installs nothing, so it has no folders to load from. */}
        {!isWebBuild() && <ModsAuthorsFold />}
        </div>

        <div className="vu-foot">
          <motion.button
            id="mods-close"
            className="vu-btn vu-btn--primary vu-paper vu-btn--panel"
            type="button"
            {...gestures(false, lift, press)}
            onClick={close}
          >
            Close
          </motion.button>
        </div>
      </motion.div>

      <AnimatePresence>
        {asking && (
          <ConfirmModal
            key="mods-warning"
            id="mods-warning"
            theme={theme}
            title={asking.warning.title}
            message={asking.warning.message}
            confirmText={asking.warning.confirmText}
            cancelText="Cancel"
            onConfirm={() => {
              apply(asking.change)
              setAsking(null)
            }}
            onCancel={() => setAsking(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {uninstallAsk && (
          <ConfirmModal
            key="uninstall"
            id="mods-uninstall-confirm"
            theme={theme}
            title={`Uninstall ${uninstallAsk.name}?`}
            message={[
              'Its files are removed after a restart. What it saved in your games stays, and comes back if you install it again.',
              ...(uninstallAsk.dependents.length
                ? [`These mods require it and will stop loading: ${uninstallAsk.dependents.join(', ')}.`]
                : [])
            ]}
            confirmText="Uninstall"
            cancelText="Cancel"
            onCancel={() => setUninstallAsk(null)}
            onConfirm={() => void uninstall(uninstallAsk.id)}
          />
        )}
      </AnimatePresence>
    </motion.div>,
    host
  )
}
