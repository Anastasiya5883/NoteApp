# Large Configuration ZIP Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Accept configuration ZIP files up to 5 GiB on one Docker server without buffering the complete archive in Node.js memory.

**Architecture:** Multer spools the multipart file to a dedicated temporary-volume path. The archive reader opens that path lazily with `yauzl`, reads only relevant metadata entries, and the route deletes the temporary file before responding.

**Tech Stack:** TypeScript, Express 5, Multer 2, yauzl 3, Node test runner, Docker Compose

**Spec:** `docs/superpowers/specs/2026-08-27-large-configuration-upload-design.md`

## Global Constraints

- Maximum compressed upload: 5 GiB.
- Preserve 50,000-entry and 250 MiB retained-metadata limits.
- Preserve authentication, tenant isolation, API response shapes, and atomic catalog replacement.
- Add no dependencies.
- Keep temporary uploads separate from the SQLite volume and remove them on every completed request path.

---

### Task 1: File-backed archive reader

**Files:**
- Modify: `server/configurationArchive.ts`
- Test: `server/configurationArchive.test.ts`

**Interfaces:**
- Produces: `readConfigurationArchiveFile(filePath: string, sourceFileName: string, overrides?: Partial<ConfigurationArchiveLimits>): Promise<ConfigurationCatalog>`
- Preserves: `readConfigurationArchive(buffer: Buffer, sourceFileName: string, overrides?): Promise<ConfigurationCatalog>` for focused unit fixtures.

- [ ] **Step 1: Write the failing file-path test**

Create a temporary ZIP file, call the new API, and assert the configuration name:

```ts
test('reads a configuration archive from a file without a caller buffer', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'lovarus-archive-file-'))
  const path = join(directory, 'configuration.zip')
  writeFileSync(path, archive({ 'Configuration.xml': configurationXml }))
  try {
    const result = await readConfigurationArchiveFile(path, 'configuration.zip')
    assert.equal(result.configurationName, 'TradeManagement')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
```

- [ ] **Step 2: Verify RED**

Run: `node --import tsx --test server/configurationArchive.test.ts`

Expected: FAIL because `readConfigurationArchiveFile` is not exported.

- [ ] **Step 3: Implement the path opener and shared lazy reader**

Import `open` from `yauzl` and `stat` from `node:fs/promises`. Refactor ZIP event processing to accept an opened `ZipFile`; use `fromBuffer` for existing tests and `open(filePath, options, callback)` for production. Before opening the file, reject `stat.size > maxArchiveBytes` with `archive-too-large`.

Skip irrelevant non-directory entries with `zipFile.readEntry()` without opening their streams. Continue validating every path, encryption flag, and entry count; apply expanded-byte accounting only to metadata entries whose streams are opened.

- [ ] **Step 4: Verify GREEN**

Run: `node --import tsx --test server/configurationArchive.test.ts`

Expected: all archive tests PASS.

---

### Task 2: Disk-backed upload boundary and cleanup

**Files:**
- Modify: `server/configurationCatalogRoutes.ts`
- Test: `server/configurationCatalogRoutes.test.ts`

**Interfaces:**
- Produces: `createCatalogUploadHandler(options?: { maxArchiveBytes?: number; uploadDirectory?: string }): RequestHandler`
- Consumes: `readConfigurationArchiveFile(...)` from Task 1.

- [ ] **Step 1: Write failing upload-boundary tests**

Add a small Express test app using `createCatalogUploadHandler({ maxArchiveBytes: 1024, uploadDirectory })`. Assert a 1,025-byte upload returns `413` and leaves the directory empty. Update catalog route tests to set `UPLOAD_TMP_DIR` to the suite temporary directory and assert valid and invalid imports leave no files.

```ts
await request(app).put('/upload')
  .attach('file', Buffer.alloc(1025), { filename: 'oversize.zip' })
  .expect(413)
assert.deepEqual(readdirSync(uploadDirectory), [])
```

- [ ] **Step 2: Verify RED**

Run: `node --import tsx --test server/configurationCatalogRoutes.test.ts`

Expected: FAIL because the handler factory is missing and current production flow uses `file.buffer`.

- [ ] **Step 3: Implement disk storage, 5 GiB default, and cleanup**

Use `multer({ dest: uploadDirectory, limits: { fileSize: maxArchiveBytes } })`. Default the directory to `UPLOAD_TMP_DIR` or `join(tmpdir(), 'lovarus-configuration-uploads')`, and default the size to `5 * 1024 ** 3`.

Call `readConfigurationArchiveFile(file.path, file.originalname)`. Remove `file.path` before sending success or validation-error responses; preserve `413`, generic `400`, and generic `500` behavior. Keep `.single('file')` and filename validation unchanged.

- [ ] **Step 4: Add one in-process active-upload guard**

Create a route-local middleware that permits one active catalog PUT per app instance, releases on response `finish`/`close`, and returns `429` for a concurrent request. Do not affect GET or DELETE.

- [ ] **Step 5: Verify GREEN**

Run: `node --import tsx --test server/configurationCatalogRoutes.test.ts server/configurationArchive.test.ts`

Expected: all focused tests PASS and temporary directories are empty after each request.

---

### Task 3: Docker storage and UI contract

**Files:**
- Modify: `Dockerfile`
- Modify: `compose.yaml`
- Modify: `src/components/ConfigurationCatalogPanel.tsx`
- Test: `tests/container-runtime.test.mjs`

- [ ] **Step 1: Write the failing container assertions**

Assert Compose mounts `app-upload-tmp:/app/tmp/config-uploads` and Dockerfile sets `UPLOAD_TMP_DIR=/app/tmp/config-uploads`.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/container-runtime.test.mjs`

Expected: FAIL because the upload volume and environment are absent.

- [ ] **Step 3: Implement Docker and UI changes**

Create `/app/tmp/config-uploads` owned by `node`, set `UPLOAD_TMP_DIR`, mount a separate named volume, declare that volume, and change UI copy from `10 ГБ` to `5 ГиБ`.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/container-runtime.test.mjs`

Expected: PASS.

---

### Task 4: Final focused verification

- [ ] **Step 1: Inspect only the scoped diff**

Run: `git diff -- server/configurationArchive.ts server/configurationArchive.test.ts server/configurationCatalogRoutes.ts server/configurationCatalogRoutes.test.ts Dockerfile compose.yaml src/components/ConfigurationCatalogPanel.tsx tests/container-runtime.test.mjs`

- [ ] **Step 2: Run focused security and compatibility checks**

Run: `node --import tsx --test server/configurationCatalogRoutes.test.ts server/configurationArchive.test.ts`

Run: `node --test tests/container-runtime.test.mjs`

Run: `pnpm exec tsc -p tsconfig.server.json --noEmit`

- [ ] **Step 3: Run the owning test suite**

Run: `pnpm test`

Expected: all commands PASS; over-limit input returns `413`, valid catalog import still succeeds, invalid ZIP remains `400`, and temporary upload files are removed.
