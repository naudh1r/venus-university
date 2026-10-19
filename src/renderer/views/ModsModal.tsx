import { useState, type JSX } from 'react'
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
import { ConfirmModal } from '../components/ConfirmModal'
import { useModalShell } from '../components/useModalShell'
import { TitleTab } from '../components/TitleTab'
import { modDetail } from '../mods/hooks'
import { useModsStore } from '../stores/modsStore'
import { useUiStore } from '../stores/uiStore'
import { gestures, lift, panelUnderTab, press, veilIn } from './motion'
import '../vu_styles/Mods.css'

/** What a mod's row says of it, and the colour that goes with the word. */
type Standing = 'on' | 'off' | 'needs'

function standingOf(switches: ModSwitches, mod: ModDef): { kind: Standing; text: string } {
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
  const closeModal = useUiStore((s) => s.closeModal)
  const close = onClose ?? ((): void => closeModal('mods'))
  const [asking, setAsking] = useState<{ change: ModChange; warning: ModWarning } | null>(null)

  /** Makes a change, or asks first where the screen underneath says it costs something. */
  function request(change: ModChange): void {
    const warning = warn?.(change) ?? null
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
  const [selectedId, setSelectedId] = useState(MODS[0]?.id ?? null)

  const { host, overlayProps } = useModalShell(close)
  if (!host) return null

  const selected = MODS.find((mod) => mod.id === selectedId) ?? null
  const missing = selected ? missingRequirement(switches, selected.id) : null
  const count = modsOn(switches).length
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
            {count} of {MODS.length} on
          </span>
        </header>

        <div className="vu-mods-panes">
          {MODS.length === 0 && (
            <p id="mods-none" className="vu-mods-blurb">
              This build carries no mods yet. It is the game as released, with this screen ready
              for them.
            </p>
          )}
          <ul className="vu-mods-list">
            {MODS.map((mod) => {
              const standing = standingOf(switches, mod)
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
                    </span>
                  </button>
                  <span className="vu-mods-standing" data-kind={standing.kind}>
                    {standing.text}
                  </span>
                  <Switch
                    id={`mods-switch-${mod.id}`}
                    label={`${mod.name}, ${standing.text}`}
                    on={switchedOn(switches, mod.id)}
                    onChange={(on) => {
                      setSelectedId(mod.id)
                      request({ modId: mod.id, optionId: null, on })
                    }}
                  />
                </li>
              )
            })}
          </ul>

          {selected && (
            <section className="vu-mods-detail" aria-live="polite">
              <div>
                <h3 className="vu-mods-detail-name">{selected.name}</h3>
                <p className="vu-mods-about">
                  by {selected.author} · version {selected.version}
                </p>
              </div>
              <p className="vu-mods-blurb">{selected.blurb}</p>
              <p className="vu-mods-tags">
                <span className="vu-mods-tag">installed</span>
                <span className="vu-mods-tag">{scopeWords(selected)}</span>
              </p>
              {selected.offNote && <p className="vu-mods-note">{selected.offNote}</p>}
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
                      return (
                        <li key={option.id} className="vu-mods-option">
                          <span className="vu-mods-option-text">
                            <span className="vu-mods-option-label">{option.label}</span>
                            <span className="vu-mods-option-hint">{option.hint}</span>
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
    </motion.div>,
    host
  )
}
