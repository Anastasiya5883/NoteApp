import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const databasePath = resolve(process.env.DATABASE_PATH || 'server/data/app.db')
mkdirSync(dirname(databasePath), { recursive: true })

export const db = new DatabaseSync(databasePath)

db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    username_normalized TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

  CREATE TABLE IF NOT EXISTS file_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    source_text TEXT NOT NULL,
    analysis_json TEXT NOT NULL,
    word_count INTEGER NOT NULL,
    entity_count INTEGER NOT NULL,
    attribute_count INTEGER NOT NULL,
    section_count INTEGER NOT NULL,
    gap_count INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS file_history_user_created_idx
    ON file_history(user_id, created_at DESC);
`)

export interface UserRecord {
  id: number
  username: string
  password_hash: string
  password_salt: string
}

export function normalizeUsername(username: string): string {
  return username.trim().toLocaleLowerCase('ru-RU')
}

export function findUserByUsername(username: string): UserRecord | undefined {
  return db.prepare(`
    SELECT id, username, password_hash, password_salt
    FROM users
    WHERE username_normalized = ?
  `).get(normalizeUsername(username)) as UserRecord | undefined
}

export function createUser(username: string, passwordHash: string, passwordSalt: string): UserRecord {
  const trimmedUsername = username.trim()
  const result = db.prepare(`
    INSERT INTO users (username, username_normalized, password_hash, password_salt, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(trimmedUsername, normalizeUsername(trimmedUsername), passwordHash, passwordSalt, Date.now())

  return {
    id: Number(result.lastInsertRowid),
    username: trimmedUsername,
    password_hash: passwordHash,
    password_salt: passwordSalt,
  }
}

export function createSession(tokenHash: string, userId: number, expiresAt: number): void {
  db.prepare(`
    INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(tokenHash, userId, expiresAt, Date.now())
}

export function findUserBySession(tokenHash: string): Pick<UserRecord, 'id' | 'username'> | undefined {
  return db.prepare(`
    SELECT users.id, users.username
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).get(tokenHash, Date.now()) as Pick<UserRecord, 'id' | 'username'> | undefined
}

export function deleteSession(tokenHash: string): void {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash)
}

export function deleteExpiredSessions(): void {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now())
}

export interface HistorySummaryRecord {
  id: number
  file_name: string
  word_count: number
  entity_count: number
  attribute_count: number
  section_count: number
  gap_count: number
  created_at: number
}

export interface HistoryDetailRecord extends HistorySummaryRecord {
  source_text: string
  analysis_json: string
}

interface HistoryCounts {
  words: number
  entities: number
  attributes: number
  sections: number
  gaps: number
}

export function createHistoryEntry(
  userId: number,
  fileName: string,
  sourceText: string,
  analysisJson: string,
  counts: HistoryCounts,
): HistoryDetailRecord {
  const createdAt = Date.now()
  const result = db.prepare(`
    INSERT INTO file_history (
      user_id, file_name, source_text, analysis_json, word_count,
      entity_count, attribute_count, section_count, gap_count, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    fileName,
    sourceText,
    analysisJson,
    counts.words,
    counts.entities,
    counts.attributes,
    counts.sections,
    counts.gaps,
    createdAt,
  )

  return {
    id: Number(result.lastInsertRowid),
    file_name: fileName,
    source_text: sourceText,
    analysis_json: analysisJson,
    word_count: counts.words,
    entity_count: counts.entities,
    attribute_count: counts.attributes,
    section_count: counts.sections,
    gap_count: counts.gaps,
    created_at: createdAt,
  }
}

export function listHistoryEntries(userId: number): HistorySummaryRecord[] {
  return db.prepare(`
    SELECT id, file_name, word_count, entity_count, attribute_count,
      section_count, gap_count, created_at
    FROM file_history
    WHERE user_id = ?
    ORDER BY created_at DESC, id DESC
  `).all(userId) as unknown as HistorySummaryRecord[]
}

export function findHistoryEntry(userId: number, id: number): HistoryDetailRecord | undefined {
  return db.prepare(`
    SELECT id, file_name, source_text, analysis_json, word_count, entity_count,
      attribute_count, section_count, gap_count, created_at
    FROM file_history
    WHERE id = ? AND user_id = ?
  `).get(id, userId) as HistoryDetailRecord | undefined
}

export function deleteHistoryEntry(userId: number, id: number): boolean {
  const result = db.prepare('DELETE FROM file_history WHERE id = ? AND user_id = ?').run(id, userId)
  return result.changes > 0
}
