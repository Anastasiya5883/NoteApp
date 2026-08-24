import assert from 'node:assert/strict'
import test from 'node:test'
import { deflateRawSync } from 'node:zlib'
import { extractTextFromFile, FileReadError, MAX_FILE_SIZE } from './fileReader'

const PDF_FIXTURE = 'JVBERi0xLjMKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9CYXNlRm9udCAvSGVsdmV0aWNhIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMSAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL0NvbnRlbnRzIDggMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUuMjc1NiA4NDEuODg5OCBdIC9QYXJlbnQgNyAwIFIgL1Jlc291cmNlcyA8PAovRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKNCAwIG9iago8PAovQ29udGVudHMgOSAwIFIgL01lZGlhQm94IFsgMCAwIDU5NS4yNzU2IDg0MS44ODk4IF0gL1BhcmVudCA3IDAgUiAvUmVzb3VyY2VzIDw8Ci9Gb250IDEgMCBSIC9Qcm9jU2V0IFsgL1BERiAvVGV4dCAvSW1hZ2VCIC9JbWFnZUMgL0ltYWdlSSBdCj4+IC9Sb3RhdGUgMCAvVHJhbnMgPDwKCj4+IAogIC9UeXBlIC9QYWdlCj4+CmVuZG9iago1IDAgb2JqCjw8Ci9QYWdlTW9kZSAvVXNlTm9uZSAvUGFnZXMgNyAwIFIgL1R5cGUgL0NhdGFsb2cKPj4KZW5kb2JqCjYgMCBvYmoKPDwKL0F1dGhvciAoYW5vbnltb3VzKSAvQ3JlYXRpb25EYXRlIChEOjIwMjYwODE3MTA1NzAwKzA3JzAwJykgL0NyZWF0b3IgKGFub255bW91cykgL0tleXdvcmRzICgpIC9Nb2REYXRlIChEOjIwMjYwODE3MTA1NzAwKzA3JzAwJykgL1Byb2R1Y2VyIChSZXBvcnRMYWIgUERGIExpYnJhcnkgLSBcKG9wZW5zb3VyY2VcKSkgCiAgL1N1YmplY3QgKHVuc3BlY2lmaWVkKSAvVGl0bGUgKHVudGl0bGVkKSAvVHJhcHBlZCAvRmFsc2UKPj4KZW5kb2JqCjcgMCBvYmoKPDwKL0NvdW50IDIgL0tpZHMgWyAzIDAgUiA0IDAgUiBdIC9UeXBlIC9QYWdlcwo+PgplbmRvYmoKOCAwIG9iago8PAovRmlsdGVyIFsgL0FTQ0lJODVEZWNvZGUgL0ZsYXRlRGVjb2RlIF0gL0xlbmd0aCAxMDAKPj4Kc3RyZWFtCkdhcFFoMEU9RiwwVVxIM1RccE5ZVF5RS2s/dGM+SVAsO1cjVTFeMjNpaFBFTV8/Q1c0S0lTaTwhWzdgI09CX3F1XCcxVCsmcXRxVW9NZVA9Tz1aKHMvV2BqNi9jYlUkJyFNfj5lbmRzdHJlYW0KZW5kb2JqCjkgMCBvYmoKPDwKL0ZpbHRlciBbIC9BU0NJSTg1RGVjb2RlIC9GbGF0ZURlY29kZSBdIC9MZW5ndGggMTAxCj4+CnN0cmVhbQpHYXBRaDBFPUYsMFVcSDNUXHBOWVReUUtrP3RjPklQLDtXI1UxXjIzaWhQRU1fP0NXNEtJU2k8IVs3YCNPQl9zS2k3LWljXUctJ09gOlIjJ0tvZGo+JjFydUkiWUtjXy5NRHB+PmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDEwCjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDA2MSAwMDAwMCBuIAowMDAwMDAwMDkyIDAwMDAwIG4gCjAwMDAwMDAxOTkgMDAwMDAgbiAKMDAwMDAwMDQwMiAwMDAwMCBuIAowMDAwMDAwNjA1IDAwMDAwIG4gCjAwMDAwMDA2NzMgMDAwMDAgbiAKMDAwMDAwMDkzNCAwMDAwMCBuIAowMDAwMDAwOTk5IDAwMDAwIG4gCjAwMDAwMDExODkgMDAwMDAgbiAKdHJhaWxlcgo8PAovSUQgCls8NjY2ZGQ3ZTAyMjQ3YmZmNGM4OTg3MjhlM2NjZDhjNjk+PDY2NmRkN2UwMjI0N2JmZjRjODk4NzI4ZTNjY2Q4YzY5Pl0KJSBSZXBvcnRMYWIgZ2VuZXJhdGVkIFBERiBkb2N1bWVudCAtLSBkaWdlc3QgKG9wZW5zb3VyY2UpCgovSW5mbyA2IDAgUgovUm9vdCA1IDAgUgovU2l6ZSAxMAo+PgpzdGFydHhyZWYKMTM4MAolJUVPRgo='
const DOCX_FIXTURE = 'UEsDBBQAAAAIACBXEV1LIhR40wAAAIsBAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbH2QvVLDMAzHX8WbB65WYGDoJekArMDQF9A5SuLDX2e5pX37Km3pwBVG6f/xk91uDsGrPRV2KXb60TR607fbYyZWokTu9FxrXgOwnSkgm5QpijKmErDKWCbIaL9wInhqmmewKVaKdVWXDt23rzTizlf1dpD1hVLIs1YvF+PC6jTm7J3FKjrs4/CLsroSjCTPHp5d5gcxaLhLWJS/Adfchzy7uIHUJ5b6jkFc8J3KAEOyuyBJ83/NnTvTODpLt/zSlkuyxOziFLy5KQFd/Lkfzt/dnwBQSwMEFAAAAAgAIFcRXRF/t7KVAAAABwEAAAsAAABfcmVscy8ucmVsc43Puw7CMAwF0F/J5q1OGRhQ0y4sXRE/ECVuU9E85ITX35OBgSIGRl9fHcvd8PCruBHnJQYFbSNh6LsTrbrUILslZVEbIStwpaQDYjaOvM5NTBTqZorsdakjz5i0ueiZcCflHvnTgK0pRquAR9uCOD8T/WPHaVoMHaO5egrlx4mvRpU1z1QU3CNbtO+4qSxg3+Hmxf4FUEsDBBQAAAAIACBXEV1FHckUpQAAAAkBAAARAAAAd29yZC9kb2N1bWVudC54bWxtj7sOwjAMRX8lW7a6MDBUfQywd2FgdVPTVspLTqDw9zQtCAmx3Cs/zpVdNg+jxZ04TM5WcpflsqnLueiduhmyUSxjG4q5kmOMvgAIaiSDIXOe7DK7OjYYl5IHmB33np2iECY7GA37PD+AwcnKFNm5/pncJ+EksT61x4vwyDgw+rGE1EvKq66bsdOrbYT6TThjp0ko0voPDRsBGw7vMPjcAt8/6xdQSwECFAAUAAAACAAgVxFdSyIUeNMAAACLAQAAEwAAAAAAAAAAAAAAgAEAAAAAW0NvbnRlbnRfVHlwZXNdLnhtbFBLAQIUABQAAAAIACBXEV0Rf7eylQAAAAcBAAALAAAAAAAAAAAAAACAAQQBAABfcmVscy8ucmVsc1BLAQIUABQAAAAIACBXEV1FHckUpQAAAAkBAAARAAAAAAAAAAAAAACAAcIBAAB3b3JkL2RvY3VtZW50LnhtbFBLBQYAAAAAAwADALkAAACWAgAAAAA='

function binaryFile(base64: string, name: string, type: string): File {
  return new File([Buffer.from(base64, 'base64')], name, { type })
}

function docxWithDeclaredXmlSize(size: number): File {
  const bytes = Buffer.from(DOCX_FIXTURE, 'base64')
  for (let offset = 0; offset <= bytes.length - 46; offset += 1) {
    if (bytes.readUInt32LE(offset) !== 0x02014b50) continue
    const nameLength = bytes.readUInt16LE(offset + 28)
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString('utf8')
    if (name === 'word/document.xml') {
      bytes.writeUInt32LE(size, offset + 24)
      break
    }
  }
  return new File([bytes], 'oversized.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

function docxWithUnderstatedXmlSize(actualSize: number): File {
  const name = Buffer.from('word/document.xml')
  const compressed = deflateRawSync(Buffer.alloc(actualSize, 0x78))
  const local = Buffer.alloc(30 + name.length)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(20, 4)
  local.writeUInt16LE(8, 8)
  local.writeUInt32LE(compressed.length, 18)
  local.writeUInt32LE(1, 22)
  local.writeUInt16LE(name.length, 26)
  name.copy(local, 30)

  const centralOffset = local.length + compressed.length
  const central = Buffer.alloc(46 + name.length)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt16LE(20, 4)
  central.writeUInt16LE(20, 6)
  central.writeUInt16LE(8, 10)
  central.writeUInt32LE(compressed.length, 20)
  central.writeUInt32LE(1, 24)
  central.writeUInt16LE(name.length, 28)
  name.copy(central, 46)

  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(1, 8)
  eocd.writeUInt16LE(1, 10)
  eocd.writeUInt32LE(central.length, 12)
  eocd.writeUInt32LE(centralOffset, 16)

  return new File([local, compressed, central, eocd], 'understated.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

async function expectFileError(file: File, code: FileReadError['code']): Promise<void> {
  await assert.rejects(
    extractTextFromFile(file),
    (error: unknown) => error instanceof FileReadError && error.code === code,
  )
}

test('reads text formats without changing their content', async () => {
  const file = new File(['Строка 1\nСтрока 2'], 'requirements.md', { type: 'text/markdown' })

  assert.equal(await extractTextFromFile(file), 'Строка 1\nСтрока 2')
})

test('extracts paragraphs and table cells from DOCX', async () => {
  const file = binaryFile(DOCX_FIXTURE, 'requirements.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')

  assert.equal(await extractTextFromFile(file), 'DOCX paragraph\n\nTable cell')
})

test('uses a streaming DOCX fallback when DecompressionStream is unavailable', async (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'DecompressionStream')
  Object.defineProperty(globalThis, 'DecompressionStream', {
    configurable: true,
    value: undefined,
  })
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'DecompressionStream', descriptor)
    else delete (globalThis as { DecompressionStream?: unknown }).DecompressionStream
  })
  const file = binaryFile(DOCX_FIXTURE, 'requirements.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')

  assert.equal(await extractTextFromFile(file), 'DOCX paragraph\n\nTable cell')
})

test('extracts every PDF page and separates pages with a blank line', async () => {
  const file = binaryFile(PDF_FIXTURE, 'requirements.pdf', 'application/pdf')

  assert.equal(await extractTextFromFile(file), 'First page\n\nSecond page')
})

test('rejects legacy Word files as unsupported', async () => {
  await expectFileError(new File(['content'], 'requirements.doc'), 'unsupported-format')
})

test('rejects source files larger than 2 MB', async () => {
  await expectFileError(new File([new Uint8Array(MAX_FILE_SIZE + 1)], 'requirements.txt'), 'file-too-large')
})

test('rejects extracted UTF-8 text larger than 2 MB', async () => {
  const file = new File(['я'.repeat(MAX_FILE_SIZE / 2 + 1)], 'requirements.txt')
  Object.defineProperty(file, 'size', { value: 1 })

  await expectFileError(file, 'content-too-large')
})

test('rejects DOCX archives whose XML payload exceeds the parsing budget', async () => {
  await expectFileError(docxWithDeclaredXmlSize(8 * 1024 * 1024 + 1), 'content-too-large')
})

test('rejects DOCX archives that understate their actual inflated XML size', async () => {
  await expectFileError(docxWithUnderstatedXmlSize(8 * 1024 * 1024 + 1), 'content-too-large')
})

test('rejects an understated DOCX through the streaming fallback', async (t) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'DecompressionStream')
  Object.defineProperty(globalThis, 'DecompressionStream', {
    configurable: true,
    value: undefined,
  })
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'DecompressionStream', descriptor)
    else delete (globalThis as { DecompressionStream?: unknown }).DecompressionStream
  })

  await expectFileError(docxWithUnderstatedXmlSize(8 * 1024 * 1024 + 1), 'content-too-large')
})

test('rejects supported files with no extractable text', async () => {
  await expectFileError(new File(['  \n'], 'requirements.txt'), 'empty-content')
})

test('reports malformed PDF and DOCX files separately from unsupported formats', async () => {
  await expectFileError(new File(['broken'], 'requirements.pdf'), 'invalid-file')
  await expectFileError(new File(['broken'], 'requirements.docx'), 'invalid-file')
})
