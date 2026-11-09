import { createHash } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import {
  assertStoryRecall,
  formatStoryRecall,
  storySlot,
  storyWords,
  type StoryRecall,
  type StoryRecallRequest,
  type StoryRecord
} from '../../shared/storyMemory'

/** This connection contains a single save snapshot, never a union of playthrough branches. */
export function recallFromSqlite(db: DatabaseSync, payload: StoryRecallRequest): StoryRecall {
  assertStoryRecall(payload)
  const version = db.prepare('PRAGMA user_version').get()?.user_version
  if (version !== 0 && version !== 1) throw Error('Unsupported story-memory index version.')
  db.exec(`PRAGMA journal_mode=DELETE;
    CREATE TABLE IF NOT EXISTS snapshot (id INTEGER PRIMARY KEY CHECK(id=1), fingerprint TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, kind TEXT NOT NULL, slot INTEGER NOT NULL, search TEXT NOT NULL, data TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS subjects (id TEXT NOT NULL, character TEXT NOT NULL, PRIMARY KEY(id,character));
    CREATE INDEX IF NOT EXISTS recent ON records(kind,slot DESC,id);
    CREATE INDEX IF NOT EXISTS subject_lookup ON subjects(character,id);
    PRAGMA user_version=1;`)
  const fingerprint = createHash('sha256')
    .update(JSON.stringify([payload.playthroughId, payload.records]))
    .digest('hex')
  if (
    db.prepare('SELECT fingerprint FROM snapshot WHERE id=1').get()?.fingerprint !== fingerprint
  ) {
    db.exec('BEGIN IMMEDIATE')
    try {
      db.exec('DELETE FROM records; DELETE FROM subjects;')
      const insert = db.prepare('INSERT INTO records VALUES(?,?,?,?,?)'),
        link = db.prepare('INSERT OR IGNORE INTO subjects VALUES(?,?)')
      for (const r of payload.records) {
        insert.run(r.id, r.kind, storySlot(r.date, r.time), r.text.toLowerCase(), JSON.stringify(r))
        for (const id of new Set(r.subjects)) link.run(r.id, id)
      }
      db.prepare('INSERT OR REPLACE INTO snapshot VALUES(1,?)').run(fingerprint)
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }
  // Only candidates reach the shared selector; SQLite and the fallback use identical ranking.
  const rows = new Map<string, StoryRecord>()
  const add = (values: Record<string, unknown>[]): void => {
    for (const value of values) {
      const r = JSON.parse(String(value.data)) as StoryRecord
      rows.set(r.id, r)
    }
  }
  add(db.prepare("SELECT data FROM records WHERE kind='fact'").all())
  if (payload.cast.length)
    for (const id of payload.cast)
      add(
        db
          .prepare(
            "SELECT r.data FROM records r JOIN subjects s ON s.id=r.id WHERE r.kind='encounter' AND s.character=? ORDER BY r.slot DESC,r.id LIMIT 2"
          )
          .all(id)
      )
  else
    add(
      db
        .prepare("SELECT data FROM records WHERE kind='encounter' ORDER BY slot DESC,id LIMIT 2")
        .all()
    )
  const words = storyWords(payload.query)
  if (words.length) {
    const score = words.map(() => '(instr(r.search,?)>0)').join('+')
    const subjects = payload.cast.length
      ? ` AND EXISTS(SELECT 1 FROM subjects s WHERE s.id=r.id AND s.character IN (${payload.cast.map(() => '?').join(',')}))`
      : ''
    add(
      db
        .prepare(
          `SELECT r.data,(${score}) AS relevance FROM records r WHERE r.kind='encounter'${subjects} ORDER BY relevance DESC,r.slot DESC,r.id LIMIT 3`
        )
        .all(...words, ...payload.cast)
    )
  }
  return { ...formatStoryRecall(payload, [...rows.values()]), engine: 'SQLite' }
}
