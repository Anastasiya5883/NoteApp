# Large configuration ZIP upload

## Goal

Safely accept configuration ZIP files up to 5 GiB on the existing single Docker server without buffering the complete archive in Node.js memory.

## Design

- Replace Multer `memoryStorage` with `diskStorage` targeting `UPLOAD_TMP_DIR` (default `/app/tmp/config-uploads`).
- Keep the multipart field, authentication, filename validation, response payloads, and atomic catalog replacement unchanged.
- Enforce a 5 GiB compressed-upload limit at Multer before parsing; return the existing `413` response when exceeded.
- Change the production archive reader to accept a file path and open it through `yauzl.open` with lazy entries.
- Skip irrelevant ZIP entries without opening their streams. Preserve path, encryption, entry-count, expanded-byte, XML, and ambiguous-root checks for relevant entries.
- Delete the temporary file in `finally` after success or failure. Multer remains responsible for partial-file cleanup when upload parsing fails.
- Create and own the upload directory in the Docker image and mount a separate named volume there so large temporary files do not share the SQLite data volume.
- Keep existing dependencies; `multer` and `yauzl` already provide the required APIs.

## Errors and resource controls

- Oversized upload: `413` with the existing generic Russian size message.
- Missing/wrong field, bad filename, invalid ZIP, or invalid configuration: existing generic `400` responses.
- Unexpected filesystem/parser failure: existing generic `500` handling.
- Maximum compressed archive: 5 GiB. Existing maximum of 50,000 ZIP entries and 250 MiB of retained expanded metadata remains.
- Temporary files are removed for both successful and rejected archive processing.

## Tests

- Add a focused file-path archive-reader test using a temporary ZIP.
- Add a route regression test with an injected small upload limit proving an over-limit multipart body returns `413` without entering archive validation.
- Verify successful and invalid uploads leave no temporary file.
- Run only catalog route/archive tests first, then the server TypeScript build check and owning test suite.

## Compatibility

The browser continues sending `FormData` field `file`; GET/PUT/DELETE API contracts, tenant isolation, stored catalog format, and supported ZIP layouts remain unchanged. The UI advertises a 5 GiB limit.
