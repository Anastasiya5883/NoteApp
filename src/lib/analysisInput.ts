import type { AnalysisOptions } from './analyzer'

export interface AnalysisInputState {
  prompt: string
  fileName: string | null
  fileContent: string | null
}

export interface PreparedAnalysisInput {
  sourceText: string
  fileName: string | null
  options: AnalysisOptions
}

export function createAnalysisInput(): AnalysisInputState {
  return { prompt: '', fileName: null, fileContent: null }
}

export function setAnalysisPrompt(state: AnalysisInputState, prompt: string): AnalysisInputState {
  return { ...state, prompt }
}

export function setAnalysisFile(
  state: AnalysisInputState,
  fileName: string,
  fileContent: string,
): AnalysisInputState {
  return { ...state, fileName, fileContent }
}

export function setAnalysisSample(state: AnalysisInputState, prompt: string): AnalysisInputState {
  return { prompt, fileName: null, fileContent: null }
}

export function prepareAnalysisInput(state: AnalysisInputState): PreparedAnalysisInput {
  const hasFile = state.fileContent !== null
  const normalized = state.prompt.toLocaleLowerCase('ru-RU')
  const criticalOnly = normalized.includes('только')
    && normalized.includes('критическ')
    && normalized.includes('противореч')

  return {
    sourceText: hasFile ? state.fileContent : state.prompt,
    fileName: hasFile ? state.fileName : null,
    options: hasFile && criticalOnly ? { contradictionSeverity: 'critical' } : {},
  }
}
