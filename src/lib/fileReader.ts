export const MAX_FILE_SIZE = 2 * 1024 * 1024
const MAX_DOCX_XML_SIZE = 8 * 1024 * 1024

export type FileReadErrorCode =
  | 'unsupported-format'
  | 'file-too-large'
  | 'content-too-large'
  | 'empty-content'
  | 'password-protected'
  | 'invalid-file'

const ERROR_MESSAGES: Record<FileReadErrorCode, string> = {
  'unsupported-format': 'Поддерживаются файлы .txt, .md, .markdown, .pdf и .docx.',
  'file-too-large': 'Размер файла не должен превышать 2 МБ.',
  'content-too-large': 'Извлечённый текст превышает допустимый размер 2 МБ.',
  'empty-content': 'В файле не найден текст. Сканированные PDF без текстового слоя не поддерживаются.',
  'password-protected': 'PDF защищён паролем. Загрузите файл без защиты.',
  'invalid-file': 'Не удалось прочитать файл. Возможно, он повреждён или имеет неверный формат.',
}

export class FileReadError extends Error {
  constructor(public readonly code: FileReadErrorCode, cause?: unknown) {
    super(ERROR_MESSAGES[code], cause === undefined ? undefined : { cause })
    this.name = 'FileReadError'
  }
}

const TEXT_EXTENSIONS = new Set(['txt', 'md', 'markdown'])
const SUPPORTED_EXTENSIONS = new Set([...TEXT_EXTENSIONS, 'pdf', 'docx'])

function getExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.')
  return dotIndex === -1 ? '' : fileName.slice(dotIndex + 1).toLowerCase()
}

async function extractPdfText(file: File): Promise<string> {
  const { getDocument, GlobalWorkerOptions, VerbosityLevel } = await import(
    'pdfjs-dist/legacy/build/pdf.mjs'
  )
  if (typeof window !== 'undefined') {
    const { default: pdfWorkerUrl } = await import(
      'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
    )
    GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  }
  const loadingTask = getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    useSystemFonts: true,
    verbosity: VerbosityLevel.ERRORS,
  })
  try {
    const pdf = await loadingTask.promise
    const pages: string[] = []
    let extractedBytes = 0
    const encoder = new TextEncoder()
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      try {
        const reader = page.streamTextContent().getReader()
        const pageParts: string[] = []
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            for (const item of value.items) {
              if (!item || typeof item !== 'object' || !('str' in item)) continue
              const { str, hasEOL } = item as { str: unknown; hasEOL?: unknown }
              if (typeof str !== 'string') continue
              const part = `${str}${hasEOL ? '\n' : ' '}`
              extractedBytes += encoder.encode(part).byteLength
              if (extractedBytes > MAX_FILE_SIZE) {
                await reader.cancel()
                throw new FileReadError('content-too-large')
              }
              pageParts.push(part)
            }
          }
        } finally {
          reader.releaseLock()
        }
        const pageText = pageParts
          .join('')
          .replace(/[ \t]+\n/g, '\n')
          .replace(/[ \t]{2,}/g, ' ')
          .trim()
        if (pageText) {
          if (pages.length > 0) extractedBytes += 2
          if (extractedBytes > MAX_FILE_SIZE) throw new FileReadError('content-too-large')
          pages.push(pageText)
        }
      } finally {
        page.cleanup()
      }
    }
    return pages.join('\n\n')
  } finally {
    await loadingTask.destroy().catch(() => undefined)
  }
}

async function getInflatedSize(
  compressedData: Uint8Array,
  compressionMethod: number,
  remainingBudget: number,
): Promise<number> {
  if (compressionMethod === 0) {
    if (compressedData.byteLength > remainingBudget) throw new FileReadError('content-too-large')
    return compressedData.byteLength
  }
  if (compressionMethod !== 8) {
    throw new Error(`Unsupported DOCX compression method: ${compressionMethod}`)
  }

  let decompressor: DecompressionStream | null = null
  if (typeof DecompressionStream === 'function') {
    try {
      decompressor = new DecompressionStream('deflate-raw' as CompressionFormat)
    } catch {
      decompressor = null
    }
  }

  if (decompressor) {
    const reader = new Blob([compressedData]).stream().pipeThrough(decompressor).getReader()
    let size = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) return size
        size += value.byteLength
        if (size > remainingBudget) {
          await reader.cancel()
          throw new FileReadError('content-too-large')
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  const { AsyncInflate } = await import('fflate')
  return new Promise<number>((resolve, reject) => {
    const inputChunkSize = 1024
    let inputOffset = 0
    let size = 0
    let settled = false
    const inflater = new AsyncInflate((error, chunk, final) => {
      if (settled) return
      if (error) {
        settled = true
        inflater.terminate()
        reject(error)
        return
      }
      size += chunk.byteLength
      if (size > remainingBudget) {
        settled = true
        inflater.terminate()
        reject(new FileReadError('content-too-large'))
      } else if (final) {
        settled = true
        resolve(size)
      }
    })
    const pushNextChunk = () => {
      if (settled) return
      const end = Math.min(inputOffset + inputChunkSize, compressedData.byteLength)
      const final = end === compressedData.byteLength
      const chunk = compressedData.slice(inputOffset, end)
      inputOffset = end
      try {
        inflater.push(chunk, final)
      } catch (error) {
        settled = true
        inflater.terminate()
        reject(error)
      }
    }
    inflater.ondrain = pushNextChunk
    try {
      pushNextChunk()
    } catch (error) {
      settled = true
      inflater.terminate()
      reject(error)
    }
  })
}

async function validateDocxArchive(arrayBuffer: ArrayBuffer): Promise<void> {
  const view = new DataView(arrayBuffer)
  const minimumEocdSize = 22
  const maximumCommentSize = 0xffff
  let eocdOffset = -1

  for (
    let offset = view.byteLength - minimumEocdSize;
    offset >= Math.max(0, view.byteLength - minimumEocdSize - maximumCommentSize);
    offset -= 1
  ) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocdOffset = offset
      break
    }
  }
  if (eocdOffset === -1) throw new Error('DOCX central directory was not found')

  const entryCount = view.getUint16(eocdOffset + 10, true)
  let offset = view.getUint32(eocdOffset + 16, true)
  let xmlSize = 0
  const decoder = new TextDecoder()

  for (let entry = 0; entry < entryCount; entry += 1) {
    if (offset + 46 > view.byteLength || view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error('DOCX central directory is invalid')
    }
    const uncompressedSize = view.getUint32(offset + 24, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const compressionMethod = view.getUint16(offset + 10, true)
    const flags = view.getUint16(offset + 8, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const nameStart = offset + 46
    const nextOffset = nameStart + nameLength + extraLength + commentLength
    if (nextOffset > view.byteLength) throw new Error('DOCX central directory is truncated')

    const name = decoder.decode(new Uint8Array(arrayBuffer, nameStart, nameLength)).toLowerCase()
    if (name.endsWith('.xml') || name.endsWith('.rels')) {
      if (uncompressedSize === 0xffffffff || compressedSize === 0xffffffff) {
        throw new FileReadError('content-too-large')
      }
      if ((flags & 0x1) !== 0) throw new Error('Encrypted DOCX entries are not supported')
      if (xmlSize + uncompressedSize > MAX_DOCX_XML_SIZE) {
        throw new FileReadError('content-too-large')
      }

      const localOffset = view.getUint32(offset + 42, true)
      if (localOffset === 0xffffffff || localOffset + 30 > view.byteLength) {
        throw new Error('DOCX local file header is invalid')
      }
      if (view.getUint32(localOffset, true) !== 0x04034b50) {
        throw new Error('DOCX local file header was not found')
      }
      const localNameLength = view.getUint16(localOffset + 26, true)
      const localExtraLength = view.getUint16(localOffset + 28, true)
      const dataStart = localOffset + 30 + localNameLength + localExtraLength
      const dataEnd = dataStart + compressedSize
      if (dataEnd > view.byteLength) throw new Error('DOCX entry data is truncated')

      const actualEntrySize = await getInflatedSize(
        new Uint8Array(arrayBuffer, dataStart, compressedSize),
        compressionMethod,
        MAX_DOCX_XML_SIZE - xmlSize,
      )
      xmlSize += actualEntrySize
    }
    offset = nextOffset
  }
}

async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  await validateDocxArchive(arrayBuffer)
  const { default: mammoth } = await import('mammoth/mammoth.browser.js')
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value.trim()
}

function isPasswordError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.name === 'PasswordException' || /password/i.test(error.message)
}

function validateExtractedText(text: string): string {
  if (!text.trim()) throw new FileReadError('empty-content')
  if (new TextEncoder().encode(text).byteLength > MAX_FILE_SIZE) {
    throw new FileReadError('content-too-large')
  }
  return text
}

export async function extractTextFromFile(file: File): Promise<string> {
  const extension = getExtension(file.name)
  if (!SUPPORTED_EXTENSIONS.has(extension)) throw new FileReadError('unsupported-format')
  if (file.size > MAX_FILE_SIZE) throw new FileReadError('file-too-large')

  try {
    let text: string
    if (TEXT_EXTENSIONS.has(extension)) {
      text = await file.text()
    } else if (extension === 'pdf') {
      text = await extractPdfText(file)
    } else {
      text = await extractDocxText(file)
    }
    return validateExtractedText(text)
  } catch (error) {
    if (error instanceof FileReadError) throw error
    if (extension === 'pdf' && isPasswordError(error)) {
      throw new FileReadError('password-protected', error)
    }
    throw new FileReadError('invalid-file', error)
  }
}
