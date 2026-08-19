import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'lovarus-catalog-'))
const databasePath = join(temporaryDirectory, 'catalog.db')
process.env.DATABASE_PATH = databasePath

const database = await import('./database.js')

after(() => {
  database.db.close()
  rmSync(temporaryDirectory, { recursive: true, force: true, maxRetries: 3 })
})

test('stores one current catalog per user without crossing user boundaries', () => {
  const userA = database.createUser('catalog-a', 'hash-a', 'salt-a')
  const userB = database.createUser('catalog-b', 'hash-b', 'salt-b')
  const firstCatalog = JSON.stringify({
    configurationName: 'TradeManagement',
    configurationSynonym: 'Управление торговлей',
    configurationVersion: '11.5.20.100',
    objects: [{ attributes: [], tableParts: [] }],
  })
  const replacementCatalog = JSON.stringify({
    configurationName: 'RetailManagement',
    configurationSynonym: 'Розница',
    configurationVersion: '3.0.1',
    objects: [{ attributes: [], tableParts: [] }, { attributes: [], tableParts: [] }],
  })

  assert.equal(database.findConfigurationCatalog(userA.id), undefined)
  assert.equal(database.findConfigurationCatalog(userB.id), undefined)

  const firstRecord = database.replaceConfigurationCatalog(
    userA.id,
    'trade.zip',
    firstCatalog,
    { objects: 1, attributes: 3, tableParts: 1 },
    1_700_000_000_000,
  )

  assert.deepEqual(firstRecord, {
    user_id: userA.id,
    source_file_name: 'trade.zip',
    configuration_name: 'TradeManagement',
    configuration_synonym: 'Управление торговлей',
    configuration_version: '11.5.20.100',
    catalog_json: firstCatalog,
    object_count: 1,
    attribute_count: 3,
    table_part_count: 1,
    uploaded_at: 1_700_000_000_000,
  })
  assert.equal(database.findConfigurationCatalog(userB.id), undefined)

  const replacementRecord = database.replaceConfigurationCatalog(
    userA.id,
    'retail.zip',
    replacementCatalog,
    { objects: 2, attributes: 7, tableParts: 4 },
    1_800_000_000_000,
  )

  assert.deepEqual(replacementRecord, {
    user_id: userA.id,
    source_file_name: 'retail.zip',
    configuration_name: 'RetailManagement',
    configuration_synonym: 'Розница',
    configuration_version: '3.0.1',
    catalog_json: replacementCatalog,
    object_count: 2,
    attribute_count: 7,
    table_part_count: 4,
    uploaded_at: 1_800_000_000_000,
  })
  assert.deepEqual(database.findConfigurationCatalog(userA.id), replacementRecord)
  const count = database.db.prepare(
    'SELECT COUNT(*) AS count FROM configuration_catalogs WHERE user_id = ?',
  ).get(userA.id) as { count: number }
  assert.equal(count.count, 1)
  assert.equal(database.findConfigurationCatalog(userB.id), undefined)

  const userBCatalog = database.replaceConfigurationCatalog(
    userB.id,
    'trade.zip',
    firstCatalog,
    { objects: 1, attributes: 3, tableParts: 1 },
    1_700_000_000_000,
  )
  assert.equal(database.deleteConfigurationCatalog(userA.id), true)
  assert.equal(database.findConfigurationCatalog(userA.id), undefined)
  assert.equal(database.deleteConfigurationCatalog(userA.id), false)
  assert.deepEqual(database.findConfigurationCatalog(userB.id), userBCatalog)
  database.db.prepare('DELETE FROM users WHERE id = ?').run(userB.id)
  assert.equal(database.findConfigurationCatalog(userB.id), undefined)
})
