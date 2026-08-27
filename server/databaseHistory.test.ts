import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'lovarus-history-'))
const databasePath = join(temporaryDirectory, 'history.db')
process.env.DATABASE_PATH = databasePath

const seedDatabase = new DatabaseSync(databasePath)
seedDatabase.exec(`
  CREATE TABLE file_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    file_name TEXT NOT NULL,
    source_text TEXT NOT NULL,
    analysis_json TEXT NOT NULL,
    word_count INTEGER NOT NULL,
    entity_count INTEGER NOT NULL,
    attribute_count INTEGER NOT NULL,
    section_count INTEGER NOT NULL,
    gap_count INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )
`)
const seedHistory = seedDatabase.prepare(`
  INSERT INTO file_history (
    user_id, file_name, source_text, analysis_json, word_count,
    entity_count, attribute_count, section_count, gap_count, created_at
  ) VALUES (999, ?, 'text', '{}', 1, 0, 0, 0, 0, ?)
`)
for (let index = 0; index <= 100; index += 1) {
  seedHistory.run(`seed-${index}.txt`, index)
}
seedDatabase.close()

const database = await import('./database.js')

after(() => {
  database.db.close()
  rmSync(temporaryDirectory, { recursive: true, force: true, maxRetries: 3 })
})

const counts = { words: 1, entities: 0, attributes: 0, sections: 0, gaps: 0 }

test('prunes pre-existing history beyond the newest 100 entries', () => {
  const entries = database.listHistoryEntries(999)
  assert.equal(entries.length, 100)
  assert.equal(entries[0].file_name, 'seed-100.txt')
  assert.equal(entries.at(-1)?.file_name, 'seed-1.txt')
})

test('keeps only the 100 newest history entries for each user', () => {
  const userA = database.createUser('history-a', 'hash-a', 'salt-a')
  const userB = database.createUser('history-b', 'hash-b', 'salt-b')
  const first = database.createHistoryEntry(userA.id, 'file-0.txt', 'text', '{}', counts)
  database.createHistoryEntry(userB.id, 'other-user.txt', 'text', '{}', counts)

  for (let index = 1; index <= 100; index += 1) {
    database.createHistoryEntry(userA.id, `file-${index}.txt`, 'text', '{}', counts)
  }

  const entries = database.listHistoryEntries(userA.id)
  assert.equal(entries.length, 100)
  assert.equal(entries[0].file_name, 'file-100.txt')
  assert.equal(entries.at(-1)?.file_name, 'file-1.txt')
  assert.equal(database.findHistoryEntry(userA.id, first.id), undefined)
  assert.equal(database.listHistoryEntries(userB.id).length, 1)
})
