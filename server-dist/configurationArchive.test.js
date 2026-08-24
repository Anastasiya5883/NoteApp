import assert from 'node:assert/strict';
import test from 'node:test';
import { strToU8, zipSync } from 'fflate';
import { readConfigurationArchive } from './configurationArchive.js';
import { catalogXml, configurationXml } from './testFixtures/configurationXml.js';
function archive(entries) {
    return Buffer.from(zipSync(Object.fromEntries(Object.entries(entries).map(([path, value]) => [path, typeof value === 'string' ? strToU8(value) : value]))));
}
async function rejectsWithCode(promise, code) {
    await assert.rejects(promise, (error) => error instanceof Error && 'code' in error && error.code === code);
}
function setFirstEntryEncryptionFlag(input) {
    const output = Buffer.from(input);
    let localPatched = false;
    let centralPatched = false;
    for (let offset = 0; offset <= output.length - 10; offset += 1) {
        const signature = output.readUInt32LE(offset);
        if (signature === 0x04034b50 && !localPatched) {
            output.writeUInt16LE(output.readUInt16LE(offset + 6) | 0x1, offset + 6);
            localPatched = true;
        }
        if (signature === 0x02014b50 && !centralPatched) {
            output.writeUInt16LE(output.readUInt16LE(offset + 8) | 0x1, offset + 8);
            centralPatched = true;
        }
    }
    assert.equal(localPatched, true);
    assert.equal(centralPatched, true);
    return output;
}
test('reads Configuration.xml from the archive root and discards non-metadata payloads', async () => {
    const result = await readConfigurationArchive(archive({
        'Configuration.xml': configurationXml,
        'Catalogs/Номенклатура.xml': catalogXml,
        'Catalogs/Номенклатура/Ext/ManagerModule.bsl': 'not XML',
        'Catalogs/Номенклатура/Forms/Form.xml': '<broken',
        'Layouts/picture.bin': new Uint8Array([0, 1, 2, 3]),
    }), 'root.zip');
    assert.equal(result.configurationName, 'TradeManagement');
    assert.deepEqual(result.objects.map(({ kind, name }) => [kind, name]), [['Catalog', 'Номенклатура']]);
});
test('does not import metadata from an unrelated wrapper when configuration is at the archive root', async () => {
    const result = await readConfigurationArchive(archive({
        'Configuration.xml': configurationXml,
        'Extra/Catalogs/Injected.xml': catalogXml,
    }), 'root-with-extra.zip');
    assert.deepEqual(result.objects, []);
});
test('reads an export nested under exactly one wrapper directory', async () => {
    const result = await readConfigurationArchive(archive({
        'TradeExport/Configuration.xml': configurationXml,
        'TradeExport/Catalogs/Номенклатура.xml': catalogXml,
    }), 'wrapped.zip');
    assert.equal(result.configurationName, 'TradeManagement');
    assert.equal(result.objects[0].name, 'Номенклатура');
});
test('rejects two candidate configuration roots', async () => {
    await rejectsWithCode(readConfigurationArchive(archive({
        'First/Configuration.xml': configurationXml,
        'Second/Configuration.xml': configurationXml,
    }), 'ambiguous.zip'), 'ambiguous-root');
});
test('rejects an archive without Configuration.xml', async () => {
    await rejectsWithCode(readConfigurationArchive(archive({
        'Catalogs/Номенклатура.xml': catalogXml,
    }), 'missing.zip'), 'configuration-not-found');
});
for (const unsafePath of ['../Configuration.xml', '/Configuration.xml', 'C:/Configuration.xml']) {
    test(`rejects unsafe entry path ${unsafePath}`, async () => {
        await rejectsWithCode(readConfigurationArchive(archive({
            [unsafePath]: configurationXml,
        }), 'unsafe.zip'), 'unsafe-path');
    });
}
test('counts every archive entry against the injected file-count limit', async () => {
    await rejectsWithCode(readConfigurationArchive(archive({
        'Configuration.xml': configurationXml,
        'readme.txt': 'ignored but counted',
    }), 'many.zip', { maxEntries: 1 }), 'too-many-files');
});
test('rejects declared or streamed bytes over the injected expanded-byte limit', async () => {
    await rejectsWithCode(readConfigurationArchive(archive({
        'Configuration.xml': configurationXml,
    }), 'expanded.zip', { maxExpandedBytes: 10 }), 'expanded-too-large');
});
test('rejects a directory entry with non-zero payload instead of bypassing expanded-byte accounting', async () => {
    await rejectsWithCode(readConfigurationArchive(archive({
        'payload/': 'x'.repeat(64),
        'Configuration.xml': configurationXml,
    }), 'directory-payload.zip', {
        maxExpandedBytes: Buffer.byteLength(configurationXml) + 1,
    }), 'invalid-archive');
});
test('rejects the input buffer over the injected compressed archive limit', async () => {
    const input = archive({ 'Configuration.xml': configurationXml });
    await rejectsWithCode(readConfigurationArchive(input, 'large.zip', {
        maxArchiveBytes: input.length - 1,
    }), 'archive-too-large');
});
test('rejects a damaged ZIP', async () => {
    await rejectsWithCode(readConfigurationArchive(Buffer.from('not a zip'), 'damaged.zip'), 'invalid-archive');
});
test('rejects an encrypted entry before opening its stream', async () => {
    const encrypted = setFirstEntryEncryptionFlag(archive({ 'Configuration.xml': configurationXml }));
    await rejectsWithCode(readConfigurationArchive(encrypted, 'encrypted.zip'), 'invalid-archive');
});
