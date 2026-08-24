import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import request from 'supertest';
import { catalogXml, configurationXml } from './testFixtures/configurationXml.js';
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'lovarus-catalog-routes-'));
process.env.DATABASE_PATH = join(temporaryDirectory, 'catalog-routes.db');
const { createApp } = await import('./app.js');
const database = await import('./database.js');
const anonymous = request(createApp());
const userA = request.agent(createApp());
const userB = request.agent(createApp());
function archive(entries) {
    return Buffer.from(zipSync(Object.fromEntries(Object.entries(entries).map(([path, value]) => [path, strToU8(value)]))));
}
const validArchive = archive({
    'Configuration.xml': configurationXml,
    'Catalogs/Номенклатура.xml': catalogXml,
});
before(async () => {
    const suffix = `${process.pid}-${Date.now()}`;
    await userA.post('/api/auth/register')
        .send({ username: `catalog-a-${suffix}`, password: 'secret-a' })
        .expect(201);
    await userB.post('/api/auth/register')
        .send({ username: `catalog-b-${suffix}`, password: 'secret-b' })
        .expect(201);
});
after(() => {
    database.db.close();
    rmSync(temporaryDirectory, { recursive: true, force: true, maxRetries: 3 });
});
test('requires authentication for every configuration catalog operation', async () => {
    await anonymous.get('/api/configuration-catalog').expect(401);
    await anonymous.put('/api/configuration-catalog')
        .attach('file', validArchive, { filename: 'configuration.zip' })
        .expect(401);
    await anonymous.delete('/api/configuration-catalog').expect(401);
});
test('returns an empty catalog for an authenticated user without an upload', async () => {
    const response = await userA.get('/api/configuration-catalog').expect(200);
    assert.deepEqual(response.body, { catalog: null, summary: null });
});
test('rejects missing, non-ZIP, and overlong upload filenames', async () => {
    await userA.put('/api/configuration-catalog').expect(400);
    await userA.put('/api/configuration-catalog')
        .attach('other', validArchive, { filename: 'configuration.zip' })
        .expect(400);
    await userA.put('/api/configuration-catalog')
        .attach('file', validArchive, { filename: 'configuration.xml' })
        .expect(400);
    await userA.put('/api/configuration-catalog')
        .attach('file', validArchive, { filename: `${'a'.repeat(252)}.zip` })
        .expect(400);
});
test('rejects an upload larger than 50 MiB', async () => {
    await userA.put('/api/configuration-catalog')
        .attach('file', Buffer.alloc(50 * 1024 * 1024 + 1), { filename: 'oversize.zip' })
        .expect(413);
});
test('stores a parsed catalog and returns complete details and counts', async () => {
    const response = await userA.put('/api/configuration-catalog')
        .attach('file', validArchive, { filename: 'trade.ZIP' })
        .expect(200);
    assert.equal(response.body.catalog.catalogKind, 'local');
    assert.equal(response.body.catalog.configurationName, 'TradeManagement');
    assert.equal(response.body.catalog.configurationSynonym, 'Управление торговлей');
    assert.equal(response.body.catalog.configurationVersion, '11.5.20.100');
    assert.equal(response.body.catalog.sourceFileName, 'trade.ZIP');
    assert.equal(typeof response.body.catalog.uploadedAt, 'number');
    assert.deepEqual(response.body.catalog.objects.map((object) => ([object.kind, object.name])), [['Catalog', 'Номенклатура']]);
    assert.deepEqual(response.body.summary, {
        sourceFileName: 'trade.ZIP',
        configurationName: 'TradeManagement',
        configurationSynonym: 'Управление торговлей',
        configurationVersion: '11.5.20.100',
        uploadedAt: response.body.catalog.uploadedAt,
        objectCount: 1,
        attributeCount: 2,
        tablePartCount: 1,
    });
    const stored = await userA.get('/api/configuration-catalog').expect(200);
    assert.deepEqual(stored.body, response.body);
});
test('isolates configuration catalogs between users', async () => {
    const response = await userB.get('/api/configuration-catalog').expect(200);
    assert.deepEqual(response.body, { catalog: null, summary: null });
});
test('keeps the previous catalog when replacement archive validation fails', async () => {
    const invalid = await userA.put('/api/configuration-catalog')
        .attach('file', Buffer.from('not a ZIP archive'), { filename: 'replacement.zip' })
        .expect(400);
    assert.equal(typeof invalid.body.error, 'string');
    assert.match(invalid.body.error, /архив|zip|конфигурац/i);
    assert.doesNotMatch(invalid.body.error, /Configuration\.xml|server[\\/]|<MetaDataObject/i);
    const response = await userA.get('/api/configuration-catalog').expect(200);
    assert.equal(response.body.catalog.configurationName, 'TradeManagement');
    assert.equal(response.body.summary.sourceFileName, 'trade.ZIP');
});
test('deletes the catalog idempotently', async () => {
    await userA.delete('/api/configuration-catalog').expect(204);
    await userA.delete('/api/configuration-catalog').expect(204);
    const response = await userA.get('/api/configuration-catalog').expect(200);
    assert.deepEqual(response.body, { catalog: null, summary: null });
});
