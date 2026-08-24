# 1C Configurator Metadata Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a user-scoped ZIP/XML metadata catalog, display its status in a new profile tab, and check requested 1C objects and attributes against local metadata and a clearly labelled ERP 2.6.1.16 reference catalog.

**Architecture:** Parse and normalize standard 1C Configurator XML exports on the Express server, persist one atomic catalog per user in SQLite, and expose authenticated GET/PUT/DELETE endpoints. The React client fetches the catalog for profile status and attribute analysis; a pure matcher combines local metadata, the limited ERP reference catalog, and the existing heuristic analysis without treating reference data as authoritative.

**Tech Stack:** TypeScript, React 18, Express 5, Node SQLite, `multer`, `yauzl`, `fast-xml-parser`, Node test runner, `fflate` test fixtures.

**Spec:** `docs/superpowers/specs/2026-08-19-1c-configurator-metadata-design.md`

## Global Constraints

- Accept only `.zip` uploads produced from standard 1C Configurator XML exports.
- ZIP size limit is 50 MiB, expanded XML limit is 250 MiB, and entry-count limit is 50,000.
- Reject absolute paths, drive-prefixed paths, `..` segments, encrypted entries, malformed XML, and archives without a unique supported `Configuration.xml` root.
- Do not persist the source ZIP, BSL modules, forms, layouts, roles, commands, or infobase records.
- Keep exactly one current catalog per user and preserve the previous catalog when replacement parsing fails.
- Local metadata is authoritative over the limited ERP reference catalog.
- UI copy must call bundled ERP data a “справочный каталог”, never a complete base configuration.
- Preserve all unrelated and pre-existing uncommitted changes in the working tree; stage only files belonging to each task.

---

### Task 1: Shared metadata model and ERP reference catalog

**Files:**
- Create: `src/lib/configurationCatalogTypes.ts`
- Create: `src/lib/erp26116Reference.ts`
- Create: `src/lib/metadataMatcher.ts`
- Test: `src/lib/metadataMatcher.test.ts`
- Modify: `src/lib/analyzer.ts`

**Interfaces:**
- Produces: `ConfigurationCatalog`, `ConfigurationObject`, `ConfigurationAttribute`, `ConfigurationTablePart`, `CatalogSummary`, `MetadataCheck`, and `MatchStatus`.
- Produces: `ERP_26116_REFERENCE: ConfigurationCatalog` with `catalogKind: 'erp-reference'`.
- Produces: `matchAnalysisMetadata(entities, attributes, localCatalog): MetadataCheck[]`.
- Changes: `AnalysisResult` gains `metadataChecks: MetadataCheck[]` and `catalogContext: { localUploadedAt: number | null; erpReferenceVersion: '2.6.1.16' }`.

- [ ] **Step 1: Write failing matcher tests**

Add tests that use a minimal local catalog and assert the following real behavior:

```ts
test('local exact object and attribute match wins over ERP reference', () => {
  const checks = matchAnalysisMetadata(
    [{ name: 'Номенклатура', type: 'Справочник', confidence: 'высокая', context: 'Добавить Артикул в Номенклатуру.', count: 1 }],
    [{ name: 'Артикул', context: 'Добавить Артикул в Номенклатуру.', count: 1 }],
    localCatalog,
  )
  assert.equal(checks[0].status, 'local-exact')
  assert.equal(checks[0].matchedAttribute, 'Артикул')
  assert.equal(checks[0].source, 'local')
})

test('missing local attribute is not promoted to exact by ERP reference', () => {
  const checks = matchAnalysisMetadata(
    [{ name: 'Номенклатура', type: 'Справочник', confidence: 'высокая', context: 'Добавить ЦветУпаковки.', count: 1 }],
    [{ name: 'ЦветУпаковки', context: 'Добавить ЦветУпаковки.', count: 1 }],
    localCatalog,
  )
  assert.equal(checks[0].status, 'missing')
  assert.match(checks[0].note, /локальной конфигурации/)
})

test('ERP reference is used when no local catalog is loaded', () => {
  const checks = matchAnalysisMetadata(entities, attributes, null)
  assert.equal(checks[0].source, 'erp-reference')
  assert.equal(checks[0].status, 'erp-reference-exact')
})
```

Include separate tests for `ё/е`, whitespace and underscore normalization, synonym matching, high-threshold similar matching, table-part paths, one-entity attribute association, and same-sentence association when several entities exist.

- [ ] **Step 2: Run the matcher test and verify RED**

Run: `node --import tsx --test src/lib/metadataMatcher.test.ts`

Expected: FAIL because `configurationCatalogTypes.ts` and `metadataMatcher.ts` do not exist.

- [ ] **Step 3: Add the shared types and limited ERP catalog**

Define `MetadataObjectKind` for Catalog, Document, InformationRegister, AccumulationRegister, AccountingRegister, CalculationRegister, Report, DataProcessor, Enum, Constant, and BusinessProcess. Include `catalogKind: 'local' | 'erp-reference'` on the catalog.

Seed the reference catalog with the small, explicit set used by current analyzer scenarios:

```ts
const objects = [
  catalog('Номенклатура', ['Наименование', 'Артикул', 'ВидНоменклатуры', 'ЕдиницаИзмерения']),
  catalog('Контрагенты', ['Наименование', 'ИНН', 'КПП', 'Партнер']),
  catalog('Партнеры', ['Наименование', 'НаименованиеПолное', 'ОсновнойМенеджер']),
  catalog('Организации', ['Наименование', 'ИНН', 'КПП']),
  catalog('Склады', ['Наименование']),
  document('ЗаказКлиента', ['Дата', 'Номер', 'Партнер', 'Контрагент', 'Организация', 'Склад', 'Менеджер', 'Комментарий'], {
    Товары: ['Номенклатура', 'Количество', 'Цена', 'Сумма'],
  }),
  document('РеализацияТоваровУслуг', ['Дата', 'Номер', 'Партнер', 'Контрагент', 'Организация', 'Склад', 'Комментарий'], {
    Товары: ['Номенклатура', 'Количество', 'Цена', 'Сумма'],
  }),
]
```

Set `configurationName` to `ERPReference`, synonym to `Справочный каталог 1С:ERP`, and version to `2.6.1.16`. Add a source note stating that the list is partial.

- [ ] **Step 4: Implement the matcher minimally**

Normalize with lower-case Russian locale, `ё → е`, removal of spaces/underscores/hyphens, and Unicode letter/digit filtering. Exact matches use name or synonym. Similar matches require normalized Levenshtein similarity `>= 0.86`; never mark them exact.

Associate attributes to an entity when their normalized `context` strings are equal or one contains the other. If analysis has exactly one entity, associate all attributes with it. For unmatched entities emit an object-only check with `requestedAttribute: null`.

When a local catalog exists, search it only for authoritative status. ERP may be mentioned in `note`, but must not change a local miss to an ERP exact status. Without local data, search `ERP_26116_REFERENCE`.

- [ ] **Step 5: Add result fields to the analyzer and verify GREEN**

Change the signature to:

```ts
export function analyzeText(
  text: string,
  mode: AnalysisMode = 'attributes',
  localCatalog: ConfigurationCatalog | null = null,
): AnalysisResult
```

Populate empty checks for contradiction mode and matcher checks for attribute mode. Run:

`node --import tsx --test src/lib/metadataMatcher.test.ts src/lib/analyzer.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```powershell
git add src/lib/configurationCatalogTypes.ts src/lib/erp26116Reference.ts src/lib/metadataMatcher.ts src/lib/metadataMatcher.test.ts src/lib/analyzer.ts src/lib/analyzer.test.ts
git commit -m "feat: match 1c metadata references"
```

---

### Task 2: Safe ZIP/XML parser for Configurator exports

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `server/configurationCatalogTypes.ts`
- Create: `server/configurationArchive.ts`
- Create: `server/configurationXml.ts`
- Create: `server/configurationArchive.test.ts`
- Create: `server/configurationXml.test.ts`
- Create: `server/testFixtures/configurationXml.ts`

**Interfaces:**
- Produces: server-side `ConfigurationCatalog`, `ConfigurationObject`, `ConfigurationAttribute`, and `ConfigurationTablePart` with the same serialized field names defined for the client in Task 1; server code does not import from `src` so `tsconfig.server.json` keeps `rootDir: "server"`.
- Produces: `readConfigurationArchive(buffer, sourceFileName): Promise<ConfigurationCatalog>`.
- Produces: `parseConfigurationXml(files, sourceFileName): ConfigurationCatalog`.
- Produces errors with codes `invalid-archive`, `archive-too-large`, `expanded-too-large`, `too-many-files`, `unsafe-path`, `configuration-not-found`, `ambiguous-root`, and `invalid-xml`.

- [ ] **Step 1: Install parser dependencies**

Run: `pnpm add fast-xml-parser multer yauzl && pnpm add -D @types/multer @types/yauzl`

Expected: `package.json` and `pnpm-lock.yaml` contain the five packages.

- [ ] **Step 2: Write failing XML parser tests**

Create realistic minimal namespaced XML fixtures for:

- `Configuration.xml` with name, synonym and version;
- `Catalogs/Номенклатура.xml` with `Артикул` and a `Единицы` table part;
- document metadata;
- all four register kinds with dimensions/resources/attributes;
- report, data processor, enum, constant and business process.

Assert exact normalized output, including attribute roles and table-part paths. Also assert malformed XML yields `invalid-xml`.

- [ ] **Step 3: Run XML parser tests and verify RED**

Run: `node --import tsx --test server/configurationXml.test.ts`

Expected: FAIL because `parseConfigurationXml` is missing.

- [ ] **Step 4: Implement XML parsing and verify GREEN**

Use `XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, trimValues: true })`. Add focused helpers `asArray`, `readText`, `readSynonym`, `readAttributes`, and `readTableParts`. Map 1C XML object tags to `MetadataObjectKind`. Ignore unknown object types and all non-metadata XML.

Run: `node --import tsx --test server/configurationXml.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing archive safety tests**

Build ZIP buffers with `fflate.zipSync` and test:

- `Configuration.xml` in root;
- a single wrapper directory;
- rejection of two candidate roots;
- rejection of `../Configuration.xml`, `/Configuration.xml`, and `C:/Configuration.xml`;
- file-count limit using an injected lower test limit;
- expanded-byte limit using an injected lower test limit;
- damaged ZIP;
- encrypted-entry rejection using a small binary fixture with the ZIP encryption flag set.

- [ ] **Step 6: Run archive tests and verify RED**

Run: `node --import tsx --test server/configurationArchive.test.ts`

Expected: FAIL because `readConfigurationArchive` is missing.

- [ ] **Step 7: Implement bounded lazy ZIP reading and verify GREEN**

Use `yauzl.fromBuffer` with `{ lazyEntries: true, validateEntrySizes: true }`. Validate each path before opening it, count every entry, reject encrypted entries from `generalPurposeBitFlag`, and sum both declared and actually streamed bytes. Retain only `.xml` buffers under the accepted root; never retain `.bsl` or unrelated binary files. Close the ZIP on first error.

Expose optional internal limits for tests while production defaults remain exactly 50 MiB / 250 MiB / 50,000.

Run: `node --import tsx --test server/configurationArchive.test.ts server/configurationXml.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit Task 2**

```powershell
git add package.json pnpm-lock.yaml server/configurationCatalogTypes.ts server/configurationArchive.ts server/configurationXml.ts server/configurationArchive.test.ts server/configurationXml.test.ts server/testFixtures/configurationXml.ts
git commit -m "feat: parse 1c configurator archives"
```

---

### Task 3: User-scoped catalog persistence

**Files:**
- Modify: `server/database.ts`
- Create: `server/databaseCatalog.test.ts`

**Interfaces:**
- Produces: `ConfigurationCatalogRecord`.
- Produces: `findConfigurationCatalog(userId): ConfigurationCatalogRecord | undefined`.
- Produces: `replaceConfigurationCatalog(userId, sourceFileName, catalogJson, counts, uploadedAt): ConfigurationCatalogRecord`.
- Produces: `deleteConfigurationCatalog(userId): boolean`.

- [ ] **Step 1: Write failing database tests**

Before dynamically importing `database.ts`, point `DATABASE_PATH` to a unique temporary `.db`. Create two users and assert:

- initially neither has a catalog;
- replacing user A’s catalog does not affect user B;
- replacing user A leaves one row and changes all metadata atomically;
- deleting user A’s catalog does not delete user B’s;
- deleting a user cascades to the catalog row.

- [ ] **Step 2: Run database tests and verify RED**

Run: `node --import tsx --test server/databaseCatalog.test.ts`

Expected: FAIL because catalog functions and table do not exist.

- [ ] **Step 3: Add schema and persistence functions**

Add:

```sql
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
```

Use one `INSERT ... ON CONFLICT(user_id) DO UPDATE` statement for atomic replacement.

- [ ] **Step 4: Run database tests and verify GREEN**

Run: `node --import tsx --test server/databaseCatalog.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```powershell
git add server/database.ts server/databaseCatalog.test.ts
git commit -m "feat: store user configuration catalogs"
```

---

### Task 4: Authenticated catalog API

**Files:**
- Create: `server/app.ts`
- Modify: `server/index.ts`
- Create: `server/app.test.ts`
- Create: `server/configurationCatalogRoutes.ts`
- Create: `server/configurationCatalogRoutes.test.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `readConfigurationArchive`, database catalog functions, and existing session middleware behavior.
- Produces: `createApp(): Express` without opening a listener.
- Produces: authenticated `GET`, `PUT`, and `DELETE /api/configuration-catalog`.
- `PUT` consumes multipart field `file` and returns `{ catalog, summary }`.

- [ ] **Step 1: Install the HTTP test dependency**

Run: `pnpm add -D supertest @types/supertest`

Expected: `package.json` and `pnpm-lock.yaml` contain both development dependencies.

- [ ] **Step 2: Write and run a failing app-factory test**

Add `server/app.test.ts` that imports `createApp`, calls it, and asserts an unauthenticated `GET /api/history` returns 401 while `GET /api/not-found` returns 404. Run:

`node --import tsx --test server/app.test.ts`

Expected: FAIL because `server/app.ts` does not exist.

- [ ] **Step 3: Extract the Express app without behavior changes**

Move middleware, auth/history routes, static serving and error middleware from `server/index.ts` into `server/app.ts`. Keep only:

```ts
import { createApp } from './app.js'

const port = Number(process.env.PORT) || 3001
createApp().listen(port, '127.0.0.1', () => {
  console.log(`API доступен на http://127.0.0.1:${port}`)
})
```

Run: `npm test && npm run build`

Expected: existing tests and build PASS before new route work.

- [ ] **Step 4: Write failing route tests**

With a temporary DB and `supertest.agent(createApp())`, register two users and assert:

- unauthenticated GET/PUT/DELETE return 401;
- authenticated empty GET returns `{ catalog: null, summary: null }`;
- non-ZIP filename and missing multipart file return 400;
- oversize upload returns 413;
- valid ZIP PUT returns configuration details and counts;
- user B cannot see user A’s catalog;
- invalid replacement returns 400 and a following GET still returns the previous catalog;
- DELETE returns 204 and subsequent GET is empty.

- [ ] **Step 5: Run route tests and verify RED**

Run: `node --import tsx --test server/configurationCatalogRoutes.test.ts`

Expected: FAIL with route-not-found responses.

- [ ] **Step 6: Implement routes and error mapping**

Use in-memory multer storage with `limits.fileSize = 50 * 1024 * 1024` and `.single('file')`. Validate `.zip` case-insensitively and file-name length `<= 255`. Parse fully before calling `replaceConfigurationCatalog`. Map archive validation errors to 400, multer size errors to 413, authentication to 401, and unexpected failures to the existing generic 500 response.

GET returns the complete catalog needed by client-side matching plus a summary. DELETE is idempotent and returns 204 whether or not a row existed.

- [ ] **Step 7: Run route tests and all server tests**

Run: `node --import tsx --test server/configurationCatalogRoutes.test.ts server/*.test.ts`

Expected: PASS with no open-handle warnings.

- [ ] **Step 8: Commit Task 4**

```powershell
git add package.json pnpm-lock.yaml server/app.ts server/app.test.ts server/index.ts server/configurationCatalogRoutes.ts server/configurationCatalogRoutes.test.ts
git commit -m "feat: expose configuration catalog API"
```

---

### Task 5: Profile tab and upload status UI

**Files:**
- Create: `src/lib/configurationCatalogApi.ts`
- Create: `src/lib/configurationCatalogApi.test.ts`
- Create: `src/components/ConfigurationCatalogPanel.tsx`
- Create: `src/components/configurationCatalogViewModel.ts`
- Create: `src/components/configurationCatalogViewModel.test.ts`
- Modify: `src/components/ProfilePage.tsx`

**Interfaces:**
- Produces: `getConfigurationCatalog`, `uploadConfigurationCatalog(file)`, and `deleteConfigurationCatalog`.
- Produces: `buildCatalogViewModel(state)` for deterministic empty/loading/loaded/error copy and action availability.
- `ProfilePage` retains existing props and adds internal tab state `'history' | 'configuration'`.

- [ ] **Step 1: Write failing API-client tests**

Stub `globalThis.fetch` and assert credentials, methods and bodies. Specifically verify `uploadConfigurationCatalog` uses `FormData` and does not set a manual `Content-Type`, while GET and DELETE use same-origin credentials and Russian server errors are preserved.

- [ ] **Step 2: Write failing view-model tests**

Assert exact visible labels and actions:

- empty: `Данные не загружены`, upload enabled;
- loading: `Загрузка и обработка…`, actions disabled;
- loaded: `Данные загружены`, version/date/counts visible, replace/delete enabled;
- replacement error with existing catalog: old loaded details remain visible and error appears.

- [ ] **Step 3: Run client tests and verify RED**

Run: `node --import tsx --test src/lib/configurationCatalogApi.test.ts src/components/configurationCatalogViewModel.test.ts`

Expected: FAIL because modules do not exist.

- [ ] **Step 4: Implement API client and view model**

Use the same defensive error parsing pattern as `src/lib/history.ts`. Return `{ catalog, summary }` from GET/PUT and `void` from DELETE. Format dates with `ru-RU` in the view model or component.

- [ ] **Step 5: Implement panel and profile tabs**

Keep history loading lazy to the history tab. The configuration tab loads its state on first activation, accepts drag/drop or file picker with `accept=".zip,application/zip"`, confirms deletion, and preserves the current loaded state on failed replacement. Include the instruction:

`В конфигураторе выберите «Конфигурация → Выгрузить конфигурацию в файлы», затем упакуйте полученный каталог в ZIP.`

- [ ] **Step 6: Run client tests and build**

Run: `node --import tsx --test src/lib/configurationCatalogApi.test.ts src/components/configurationCatalogViewModel.test.ts && npm run build`

Expected: PASS; TypeScript reports no component or FormData errors.

- [ ] **Step 7: Commit Task 5**

```powershell
git add src/lib/configurationCatalogApi.ts src/lib/configurationCatalogApi.test.ts src/components/ConfigurationCatalogPanel.tsx src/components/configurationCatalogViewModel.ts src/components/configurationCatalogViewModel.test.ts src/components/ProfilePage.tsx
git commit -m "feat: add configurator data profile tab"
```

---

### Task 6: Analysis integration, results display, and history compatibility

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/ResultsStep.tsx`
- Modify: `src/lib/history.ts`
- Modify: `src/lib/history.test.ts`
- Modify: `src/lib/exporter.ts`
- Modify: `src/lib/exporter.test.ts`
- Modify: `server/app.ts`

**Interfaces:**
- Consumes: `getConfigurationCatalog()` and the new optional third parameter of `analyzeText`.
- Displays: `AnalysisResult.metadataChecks` and catalog-context freshness.
- Preserves: legacy history rows without metadata fields normalize to empty checks and null local timestamp.

- [ ] **Step 1: Write failing compatibility and export tests**

Extend `history.test.ts` so a legacy result normalizes to:

```ts
assert.deepEqual(result.metadataChecks, [])
assert.deepEqual(result.catalogContext, {
  localUploadedAt: null,
  erpReferenceVersion: '2.6.1.16',
})
```

Extend `exporter.test.ts` to assert the Markdown export contains `## Проверка по конфигурации`, status/source labels, and the warning `Справочный каталог неполный` when local data is absent.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --import tsx --test src/lib/history.test.ts src/lib/exporter.test.ts`

Expected: FAIL because compatibility defaults and export section are absent.

- [ ] **Step 3: Integrate catalog loading into analysis**

Make `handleAnalyze` async inside the existing delayed analysis flow. For attribute mode, request the current catalog once and pass it to `analyzeText`. If the catalog request fails, continue with `null`, complete analysis, and show a non-blocking warning that only the incomplete ERP reference was used. Contradiction mode must not fetch metadata.

- [ ] **Step 4: Render configuration checks**

Add a results card with status badges:

- green: exact local;
- amber: similar local or any ERP-reference result;
- rose: missing;
- neutral explanatory banner when no local catalog was loaded.

Show paths such as `ЗаказКлиента.Товары.Номенклатура`, source text, note, and local upload date.

- [ ] **Step 5: Update history validation and backward normalization**

Allow `metadataChecks` and `catalogContext` in server result validation while accepting legacy rows where both are absent. Update `normalizeHistoryResult` to filter malformed checks rather than trusting persisted JSON.

- [ ] **Step 6: Update Markdown export and verify GREEN**

Render the same source distinction in exported Markdown. Run:

`node --import tsx --test src/lib/history.test.ts src/lib/exporter.test.ts src/lib/analyzer.test.ts src/lib/metadataMatcher.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit Task 6**

```powershell
git add src/App.tsx src/components/ResultsStep.tsx src/lib/history.ts src/lib/history.test.ts src/lib/exporter.ts src/lib/exporter.test.ts server/app.ts
git commit -m "feat: check analysis against 1c catalogs"
```

---

### Task 7: Full verification and documentation polish

**Files:**
- Create: `docs/1c-configurator-import.md`

**Interfaces:**
- Documents the exact export/upload steps, limits, source priority, and the incomplete nature of ERP reference data.

- [ ] **Step 1: Add operator-facing usage documentation**

Document:

1. Export with `Конфигурация → Выгрузить конфигурацию в файлы`.
2. ZIP the export directory without modifying files.
3. Upload in `Личный кабинет → Информация из локального конфигуратора`.
4. Re-upload after configuration updates.
5. Local data is authoritative; ERP 2.6.1.16 bundled data is a partial reference only.

- [ ] **Step 2: Run the complete automated test suite**

Run: `npm test`

Expected: all client and server tests PASS with zero failures.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: client and server TypeScript checks and Vite build PASS.

- [ ] **Step 4: Perform a focused manual smoke test**

Run: `npm run dev`

Verify in the browser:

- register/login;
- empty configuration tab;
- upload a valid fixture ZIP;
- loaded status and counters;
- run an attribute analysis with exact and missing fields;
- open saved history and export results;
- failed replacement preserves old data;
- delete returns to empty state.

- [ ] **Step 5: Inspect scope and diff hygiene**

Run:

```powershell
git status --short
git diff --check
git diff --stat
```

Expected: no whitespace errors, no generated DB/ZIP/dist files staged, and unrelated pre-existing changes remain untouched.

- [ ] **Step 6: Commit Task 7**

```powershell
git add docs/1c-configurator-import.md
git commit -m "docs: explain 1c metadata import"
```
