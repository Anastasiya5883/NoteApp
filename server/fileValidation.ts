const SUPPORTED_HISTORY_FILE_PATTERN = /\.(txt|md|markdown|pdf|docx)$/i

export function isSupportedHistoryFileName(fileName: string): boolean {
  return SUPPORTED_HISTORY_FILE_PATTERN.test(fileName)
}
