export interface StoredAnalysisResult {
  words: number
  entities: unknown[]
  attributes: unknown[]
  sections: unknown[]
  contradictions: unknown[]
  gaps: unknown[]
  recommendations: unknown[]
}

export function isAnalysisResult(value: unknown): value is StoredAnalysisResult {
  if (!value || typeof value !== 'object') return false
  const result = value as Record<string, unknown>
  return Number.isFinite(result.words)
    && Array.isArray(result.entities)
    && Array.isArray(result.attributes)
    && Array.isArray(result.sections)
    && Array.isArray(result.contradictions)
    && Array.isArray(result.gaps)
    && Array.isArray(result.recommendations)
}
