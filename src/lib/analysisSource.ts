export function composeAnalysisSource(fileContent: string, additionalInfo: string): string {
  return [fileContent, additionalInfo].filter((part) => part.trim()).join('\n\n')
}
