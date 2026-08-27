import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { networkInterfaces, tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';

function findNonLoopbackAddress() {
  for (const interfaces of Object.values(networkInterfaces())) {
    for (const address of interfaces ?? []) {
      if (address.family === 'IPv4' && !address.internal) {
        return address.address;
      }
    }
  }
  throw new Error('Для проверки контейнерного интерфейса нужен нелокальный IPv4-адрес');
}

async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.equal(typeof address, 'object');
  const port = address.port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitForResponse(url, child, output) {
  const deadline = Date.now() + 10_000;
  let lastError;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Сервер завершился с кодом ${child.exitCode}:\n${output.value}`);
    }
    try {
      return await fetch(url);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  throw lastError;
}

test('контейнер использует отдельный volume для временных загрузок', async () => {
  const [dockerfile, compose] = await Promise.all([
    readFile('Dockerfile', 'utf8'),
    readFile('compose.yaml', 'utf8'),
  ]);

  assert.match(dockerfile, /UPLOAD_TMP_DIR=\/app\/tmp\/config-uploads/);
  assert.match(compose, /app-upload-tmp:\/app\/tmp\/config-uploads/);
});

test('сервер доступен через внешний интерфейс контейнера', async () => {
  const hostAddress = findNonLoopbackAddress();
  const port = await reservePort();
  const dataDirectory = await mkdtemp(join(tmpdir(), 'noteapp-docker-test-'));
  const output = { value: '' };
  const child = spawn(process.execPath, ['server-dist/index.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      HOST: '0.0.0.0',
      PORT: String(port),
      DATABASE_PATH: join(dataDirectory, 'app.db'),
      UPLOAD_TMP_DIR: join(dataDirectory, 'uploads'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => { output.value += chunk; });
  child.stderr.on('data', (chunk) => { output.value += chunk; });

  try {
    const response = await waitForResponse(`http://${hostAddress}:${port}/`, child, output);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<html/i);

    const assetPath = html.match(/<script[^>]+src="([^"]+)"/)?.[1];
    assert.ok(assetPath);
    const assetResponse = await fetch(`http://${hostAddress}:${port}${assetPath}`);
    assert.equal(assetResponse.status, 200);
    const asset = await assetResponse.text();
    assert.match(asset, /ZIP до 5 ГиБ/);
    assert.doesNotMatch(asset, /ZIP до 10 ГБ/);
  } finally {
    child.kill();
    await new Promise((resolve) => child.once('exit', resolve));
    await rm(dataDirectory, { recursive: true, force: true });
  }
});
