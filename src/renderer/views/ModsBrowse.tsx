import { useEffect, useState, type JSX } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { CatalogMod, CatalogRelease } from '@shared/modCatalog'
import { SelectField } from '../components/SelectField'
import { ConfirmModal } from '../components/ConfirmModal'
import { gestures, lift, press, rowLift, rowPress } from './motion'

/** Kept mounted while tabs change so an install and its result stay visible. */
export function ModsBrowse({
  theme,
  active
}: {
  theme: 'day' | 'night'
  active: boolean
}): JSX.Element {
  const [mods, setMods] = useState<CatalogMod[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [version, setVersion] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState<{ mod: CatalogMod; release: CatalogRelease } | null>(null)
  const [restart, setRestart] = useState(false)
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
  const selected = mods.find((mod) => mod.id === selectedId) ?? mods[0]
  const release = selected?.releases.find((r) => r.version === version) ?? selected?.releases[0]
  const action = (mod: CatalogMod, r: CatalogRelease): string =>
    r.incompatible
      ? 'Not compatible'
      : mod.installedVersion === r.version
        ? `Installed · ${r.version}`
        : mod.installedVersion
          ? `Update to ${r.version}`
          : 'Install'

  async function install(mod: CatalogMod, r: CatalogRelease, approved: boolean): Promise<void> {
    setAsking(null)
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
        {mods.length > 0 && (
          <div className="vu-mods-panes">
            <div className="vu-mods-catalog-grid" aria-label="Mod catalogue">
              {mods.map((mod) => (
                <motion.button
                  key={mod.id}
                  id={`mods-browse-${mod.id}`}
                  className="vu-mods-catalog-tile"
                  aria-pressed={selected?.id === mod.id}
                  data-selected={selected?.id === mod.id}
                  {...gestures(false, rowLift, rowPress)}
                  onClick={() => {
                    setSelectedId(mod.id)
                    setVersion(null)
                  }}
                >
                  <span className="vu-mods-name">{mod.name}</span>
                  <span className="vu-mods-meta">
                    by {mod.author} · {mod.releases[0].version}
                  </span>
                  <span className="vu-mods-blurb vu-mods-catalog-excerpt">{mod.blurb}</span>
                  <span className="vu-mods-tag">{action(mod, mod.releases[0])}</span>
                </motion.button>
              ))}
            </div>
            {selected && release && (
              <section className="vu-mods-detail" aria-label="Catalogue details">
                <div>
                  <h3 className="vu-mods-detail-name">{selected.name}</h3>
                  <p className="vu-mods-about">
                    by {selected.author} · latest {selected.releases[0].version}
                  </p>
                </div>
                <p className="vu-mods-blurb">{selected.blurb}</p>
                <a
                  className="vu-mods-about"
                  href={selected.source}
                  target="_blank"
                  rel="noreferrer"
                >
                  Source · {selected.source}
                </a>
                <p className="vu-mods-tags">
                  <span className="vu-mods-tag">kit {release.kit}</span>
                  {release.game && (
                    <span className="vu-mods-tag">game {release.game} (advisory)</span>
                  )}
                </p>
                {release.main && (
                  <p className="vu-mods-note">
                    Runs code on your computer, outside the game window.
                  </p>
                )}
                {release.incompatible && <p className="vu-mods-note">{release.incompatible}</p>}
                <SelectField
                  id="mods-release"
                  label="Release"
                  value={release.version}
                  disabled={busy}
                  onChange={setVersion}
                  options={selected.releases.map((r) => ({ value: r.version, label: r.version }))}
                />
                <motion.button
                  id="mods-install"
                  className="vu-btn vu-btn--primary vu-paper vu-btn--panel"
                  disabled={
                    busy || !!release.incompatible || selected.installedVersion === release.version
                  }
                  {...gestures(
                    busy || !!release.incompatible || selected.installedVersion === release.version,
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
                <hr className="vu-rule" />
                <h4 className="vu-mods-label">Changelog</h4>
                {selected.releases.map((r) => (
                  <div key={r.version}>
                    <p className="vu-mods-about">
                      {r.version} · {r.released}
                    </p>
                    <ul className="vu-mods-changes">
                      {r.changes.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            )}
          </div>
        )}
        {notice && (
          <p className="vu-mods-note" role="status">
            {notice}
          </p>
        )}
        {restart && (
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
        )}
        {restart && <p className="vu-mods-about">Save any game in progress before restarting.</p>}
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
