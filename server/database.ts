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

  CREATE TABLE IF NOT EXISTS configuration_catalogs (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    source_file_name TEXT NOT NULL,
    configuration_name TEXT NOT NULL,
    configuration_synonym TEXT,
    configuration_version TEXT,
    catalog_json TEXT NOT NULL,
    object_count INTEGER NOT NULL,
    attribute_count INTEGER NOT NULL,
    table_part_count INTEGER NOT NULL,
    uploaded_at INTEGER NOT NULL
  );
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
  analysis_json: string
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
    SELECT id, file_name, analysis_json, word_count, entity_count, attribute_count,
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

export interface ConfigurationCatalogRecord {
  user_id: number
  source_file_name: string
  configuration_name: string
  configuration_synonym: string | null
  configuration_version: string | null
  catalog_json: string
  object_count: number
  attribute_count: number
  table_part_count: number
  uploaded_at: number
}

export interface ConfigurationCatalogCounts {
  objects: number
  attributes: number
  tableParts: number
}

interface ConfigurationCatalogMetadata {
  configurationName: string
  configurationSynonym: string | null
  configurationVersion: string | null
}

function readConfigurationCatalogMetadata(catalogJson: string): ConfigurationCatalogMetadata {
  const parsed: unknown = JSON.parse(catalogJson)
  if (!parsed || typeof parsed !== 'object') {
    throw new TypeError('Catalog JSON must contain configuration metadata')
  }

  const metadata = parsed as Partial<ConfigurationCatalogMetadata>
  if (typeof metadata.configurationName !== 'string' || !metadata.configurationName) {
    throw new TypeError('Catalog JSON must include a configuration name')
  }

  return {
    configurationName: metadata.configurationName,
    configurationSynonym: typeof metadata.configurationSynonym === 'string'
      ? metadata.configurationSynonym
      : null,
    configurationVersion: typeof metadata.configurationVersion === 'string'
      ? metadata.configurationVersion
      : null,
  }
}

export function findConfigurationCatalog(userId: number): ConfigurationCatalogRecord | undefined {
  const record = db.prepare(`
    SELECT user_id, source_file_name, configuration_name, configuration_synonym,
      configuration_version, catalog_json, object_count, attribute_count, table_part_count, uploaded_at
    FROM configuration_catalogs
    WHERE user_id = ?
  `).get(userId) as ConfigurationCatalogRecord | undefined
  return record ? { ...record } : undefined
}

export function replaceConfigurationCatalog(
  userId: number,
  sourceFileName: string,
  catalogJson: string,
  counts: ConfigurationCatalogCounts,
  uploadedAt: number,
): ConfigurationCatalogRecord {
  const metadata = readConfigurationCatalogMetadata(catalogJson)
  db.prepare(`
    INSERT INTO configuration_catalogs (
      user_id, source_file_name, configuration_name, configuration_synonym, configuration_version,
      catalog_json, object_count, attribute_count, table_part_count, uploaded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      source_file_name = excluded.source_file_name,
      configuration_name = excluded.configuration_name,
      configuration_synonym = excluded.configuration_synonym,
      configuration_version = excluded.configuration_version,
      catalog_json = excluded.catalog_json,
      object_count = excluded.object_count,
      attribute_count = excluded.attribute_count,
      table_part_count = excluded.table_part_count,
      uploaded_at = excluded.uploaded_at
  `).run(
    userId,
    sourceFileName,
    metadata.configurationName,
    metadata.configurationSynonym,
    metadata.configurationVersion,
    catalogJson,
    counts.objects,
    counts.attributes,
    counts.tableParts,
    uploadedAt,
  )

  const record = findConfigurationCatalog(userId)
  if (!record) throw new Error('Unable to store configuration catalog')
  return record
}

export function deleteConfigurationCatalog(userId: number): boolean {
  return db.prepare('DELETE FROM configuration_catalogs WHERE user_id = ?').run(userId).changes > 0
}
