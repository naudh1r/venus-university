import { useEffect, useState, type CSSProperties, type JSX } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { CatalogMod, CatalogRelease } from '@shared/modCatalog'
import { SelectField } from '../components/SelectField'
import { ConfirmModal } from '../components/ConfirmModal'
import { gestures, lift, press, cardLift } from './motion'

/** Kept mounted while tabs change so an install and its result stay visible. */
export function ModsBrowse({
  theme,
  active,
  selectedId,
  setSelectedId
}: {
  theme: 'day' | 'night'
  active: boolean
  selectedId: string | null
  setSelectedId: (id: string | null) => void
}): JSX.Element {
  const [mods, setMods] = useState<CatalogMod[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [version, setVersion] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState<{ mod: CatalogMod; release: CatalogRelease } | null>(null)
  const [restart, setRestart] = useState(false)
  const [operationId, setOperationId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  async function load(): Promise<void> {
    setLoading(true)
    setError('')
    try {
      const result = await window.api.mods.catalog()
      if (result.ok) {
        setMods(result.data)
        setLoaded(true)
      } else setError(result.error.message)
    } catch {
      setError('Could not fetch the mod catalogue.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    if (active && !loaded && !loading && !error) void load()
  }, [active, loaded, loading, error])
  const selected = mods.find((mod) => mod.id === selectedId)
  const release = selected?.releases.find((r) => r.version === version) ?? selected?.releases[0]
  const action = (mod: CatalogMod, r: CatalogRelease): string =>
    r.incompatible
      ? 'Not compatible'
      : mod.installedVersion === r.version
        ? 'Installed'
        : mod.installedVersion
          ? `Update to ${r.version}`
          : 'Install'

  async function install(mod: CatalogMod, r: CatalogRelease, approved: boolean): Promise<void> {
    setAsking(null)
    setOperationId(mod.id)
    setBusy(true)
    setNotice('Downloading and checking the release…')
    try {
      const result = await window.api.mods.installRelease(mod.id, r.version, approved)
      if (!result.ok) {
        setNotice(result.error.message)
        return
      }
      const refreshed = await window.api.mods.catalogInstalled()
      if (refreshed.ok) setMods(refreshed.data)
      else
        setMods((all) =>
          all.map((one) => (one.id === mod.id ? { ...one, installedVersion: r.version } : one))
        )
      setNotice(
        `${mod.name} ${r.version} is installed. Applies at the next start; its switch starts at the mod's default.`
      )
      setRestart(true)
    } catch {
      setNotice('The install failed. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="vu-mods-browse" hidden={!active}>
        {loading && (
          <p className="vu-mods-blurb" role="status">
            Reading the catalogue…
          </p>
        )}
        {error && (
          <div className="vu-mods-note" role="status">
            {error}{' '}
            <motion.button
              className="vu-btn vu-btn--quiet"
              disabled={loading}
              {...gestures(loading, lift, press)}
              onClick={() => void load()}
            >
              Try again
            </motion.button>
          </div>
        )}
        {loaded && !loading && !error && mods.length === 0 && (
          <p className="vu-mods-blurb">There are no mods in this catalogue.</p>
        )}
        {mods.length > 0 && !selected && (
          <div className="vu-mods-store-grid" aria-label="Mod catalogue">
            {mods.map((mod) => {
              const latest = mod.releases[0]
              const sticker = latest.incompatible
                ? 'Not compatible'
                : mod.installedVersion === latest.version
                  ? 'Installed'
                  : mod.installedVersion
                    ? 'Update'
                    : null
              return (
                <motion.button
                  key={mod.id}
                  id={`mods-browse-${mod.id}`}
                  className="vu-mods-store-tile"
                  {...gestures(false, cardLift, press)}
                  onClick={() => {
                    setSelectedId(mod.id)
                    setVersion(null)
                  }}
                >
                  <div className="vu-mods-store-cover-wrap">
                    <Cover mod={mod} place={mods.indexOf(mod)} />
                    {sticker && (
                      <span
                        className={`vu-sticker${sticker === 'Update' ? ' vu-sticker--accent' : ''}`}
                      >
                        {sticker}
                      </span>
                    )}
                  </div>
                  <div className="vu-mods-store-caption">
                    <span className="vu-mods-name">{mod.name}</span>
                    <span className="vu-mods-meta">by {mod.author}</span>
                    <p className="vu-mods-blurb vu-mods-store-excerpt">{mod.blurb}</p>
                  </div>
                </motion.button>
              )
            })}
          </div>
        )}
        {selected && release && (
          <div className="vu-mods-store-page">
            <motion.button
              className="vu-btn vu-btn--quiet"
              {...gestures(false, lift, press)}
              onClick={() => setSelectedId(null)}
            >
              ← All mods
            </motion.button>
            <div className="vu-mods-store-scroll">
              <Cover mod={selected} place={mods.indexOf(selected)} banner />
              <header className="vu-mods-store-header">
                <div>
                  <h3 className="vu-mods-detail-name">{selected.name}</h3>
                  <p className="vu-mods-about">
                    by {selected.author} · {release.version}
                  </p>
                </div>
                <div className="vu-mods-store-action">
                  <motion.button
                    id="mods-install"
                    className={
                      selected.installedVersion === release.version
                        ? 'vu-btn vu-btn--quiet'
                        : 'vu-btn vu-btn--primary vu-paper vu-btn--panel'
                    }
                    disabled={
                      busy ||
                      !!release.incompatible ||
                      selected.installedVersion === release.version
                    }
                    {...gestures(
                      busy ||
                        !!release.incompatible ||
                        selected.installedVersion === release.version,
                      lift,
                      press
                    )}
                    onClick={() =>
                      release.main
                        ? setAsking({ mod: selected, release })
                        : void install(selected, release, false)
                    }
                  >
                    {busy ? 'Installing…' : action(selected, release)}
                  </motion.button>
                  {release.incompatible && <p className="vu-mods-about">{release.incompatible}</p>}
                  {notice && operationId === selected.id && (
                    <p className="vu-mods-about" role="status">
                      {notice}
                    </p>
                  )}
                </div>
              </header>
              {restart && operationId === selected.id && (
                <div className="vu-mods-note">
                  <p>Save any game in progress before restarting.</p>
                  <div className="vu-foot">
                    <motion.button
                      className="vu-btn vu-btn--quiet"
                      {...gestures(false, lift, press)}
                      onClick={() => setRestart(false)}
                    >
                      Later
                    </motion.button>
                    <motion.button
                      className="vu-btn vu-btn--primary vu-paper vu-btn--panel"
                      {...gestures(false, lift, press)}
                      onClick={() => {
                        void window.api.mods.restart().then((r) => {
                          if (!r.ok) setNotice(r.error.message)
                        })
                      }}
                    >
                      Restart now
                    </motion.button>
                  </div>
                </div>
              )}
              <section>
                <h4 className="vu-mods-label">About</h4>
                <p className="vu-mods-blurb">{selected.blurb}</p>
              </section>
              <section>
                <h4 className="vu-mods-label">What it needs</h4>
                <p className="vu-mods-about">
                  Kit {release.kit}
                  {release.game ? ` · game ${release.game} (advisory)` : ''}
                </p>
                {release.main && (
                  <p className="vu-mods-blurb">
                    Runs code on your computer, outside the game window.
                  </p>
                )}
                <a className="vu-link" href={selected.source} target="_blank" rel="noreferrer">
                  Source
                </a>
              </section>
              <details className="vu-disc">
                <summary className="vu-disc-summary">Older versions</summary>
                <div className="vu-disc-body">
                  <SelectField
                    id="mods-release"
                    label="Release"
                    value={release.version}
                    disabled={busy}
                    onChange={setVersion}
                    options={selected.releases.map((r) => ({ value: r.version, label: r.version }))}
                  />
                </div>
              </details>
              <section>
                <h4 className="vu-mods-label">Changelog</h4>
                {selected.changelog.map((r, i) => (
                  <div key={i}>
                    <h5 className="vu-mods-about">
                      {r.version}
                      {selected.installedVersion === r.version ? ' · installed' : ''}
                    </h5>
                    <ul className="vu-mods-changes">
                      {r.changes.map((line, j) => (
                        <li key={j}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            </div>
          </div>
        )}
      </div>
      <AnimatePresence>
        {asking && (
          <ConfirmModal
            key="catalog-approve"
            id="mods-install-approval"
            theme={theme}
            title={`Install ${asking.mod.name}?`}
            message={`${asking.mod.name} runs code on your computer, outside the game window. Install it?`}
            confirmText="Install"
            cancelText="Cancel"
            onCancel={() => setAsking(null)}
            onConfirm={() => void install(asking.mod, asking.release, true)}
          />
        )}
      </AnimatePresence>
    </>
  )
}

function Cover({ mod, place, banner = false }: { mod: CatalogMod; place: number; banner?: boolean }): JSX.Element {
  const [failed, setFailed] = useState(false)
  const seed = [...mod.id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0)
  // Without art, a mod's cover is its initials on the calendar's tones in turn, so neighbours differ.
  const tone = COVER_TONES[Math.max(place, 0) % COVER_TONES.length]
  return (
    <div
      className={`vu-mods-store-cover${banner ? ' vu-mods-store-cover--banner' : ''}`}
      style={
        {
          '--cover-tone': `var(${tone})`,
          '--cover-angle': `${seed % 360}deg`
        } as CSSProperties
      }
    >
      {mod.coverData && !failed ? (
        <img src={mod.coverData} alt="" onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden="true">{initialsOf(mod.name)}</span>
      )}
    </div>
  )
}

/** The tones a cover without art is drawn in. */
const COVER_TONES = [
  '--vu-cat-plans-tone',
  '--vu-cat-occasion-tone',
  '--vu-cat-class-tone',
  '--vu-cat-work-tone'
] as const

/** A name's initials for its cover: "Photo Feature" is PF, "Bunnyfeeds" is B. */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => [...word][0].toUpperCase())
    .join('')
}
