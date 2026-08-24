const SUPPORTED_HISTORY_FILE_PATTERN = /\.(txt|md|markdown|pdf|docx)$/i;
export function isSupportedHistoryFileName(fileName) {
    return SUPPORTED_HISTORY_FILE_PATTERN.test(fileName);
}
