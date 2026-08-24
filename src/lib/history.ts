import type { AnalysisMode, AnalysisResult } from './analyzer'
import type { Contradiction } from './contradictionDetector'

export interface HistoryStats {
  words: number
  entities: number
  attributes: number
  sections: number
  gaps: number
  contradictions: number
}

export interface HistorySummary {
  id: number
  fileName: string
  createdAt: number
  mode: AnalysisMode
  stats: HistoryStats
}

export interface HistoryDetail extends HistorySummary {
  sourceText: string
  result: AnalysisResult
}

interface ErrorResponse {
  error?: string
}

export class HistoryApiError extends Error {}

function isContradiction(value: unknown): value is Contradiction {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string'
    && (item.category === 'logical' || item.category === 'numeric')
    && item.severity === 'warning'
    && typeof item.title === 'string'
    && typeof item.description === 'string'
    && Array.isArray(item.quotes)
    && item.quotes.length === 2
    && item.quotes.every((quote) => typeof quote === 'string')
}

function isMetadataCheck(value: unknown): value is AnalysisResult['metadataChecks'][number] {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.requestedObject === 'string'
    && (typeof item.requestedAttribute === 'string' || item.requestedAttribute === null)
    && ['local-exact', 'local-similar', 'erp-reference-exact', 'erp-reference-similar', 'missing'].includes(String(item.status))
    && (item.source === 'local' || item.source === 'erp-reference' || item.source === null)
    && typeof item.note === 'string'
}

type StoredAnalysisResult = Omit<AnalysisResult, 'mode' | 'contradictions' | 'metadataChecks' | 'catalogContext'>
  & Partial<Pick<AnalysisResult, 'mode' | 'contradictions' | 'metadataChecks' | 'catalogContext'>>

export function normalizeHistoryResult(result: StoredAnalysisResult): AnalysisResult {
  return {
    ...result,
    mode: result.mode === 'contradictions' ? 'contradictions' : 'attributes',
    contradictions: Array.isArray(result.contradictions) ? result.contradictions.filter(isContradiction) : [],
    metadataChecks: Array.isArray(result.metadataChecks) ? result.metadataChecks.filter(isMetadataCheck) : [],
    catalogContext: result.catalogContext && typeof result.catalogContext.localUploadedAt === 'number'
      ? result.catalogContext
      : { localUploadedAt: null, erpReferenceVersion: '2.6.1.16' },
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...options,
      credentials: 'same-origin',
      headers: options?.body
        ? { 'Content-Type': 'application/json', ...options.headers }
        : options?.headers,
    })
  } catch {
    throw new HistoryApiError('Сервер недоступен. Попробуйте ещё раз')
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ErrorResponse
    throw new HistoryApiError(body.error || 'Не удалось выполнить запрос')
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export async function saveHistoryEntry(
  fileName: string,
  sourceText: string,
  result: AnalysisResult,
): Promise<HistorySummary> {
  const response = await request<{ entry: HistorySummary }>('/api/history', {
    method: 'POST',
    body: JSON.stringify({ fileName, sourceText, result }),
  })
  return response.entry
}

export async function getHistoryEntries(): Promise<HistorySummary[]> {
  const response = await request<{ entries: HistorySummary[] }>('/api/history')
  return response.entries.map((entry) => ({
    ...entry,
    mode: entry.mode === 'contradictions' ? 'contradictions' : 'attributes',
    stats: { ...entry.stats, contradictions: entry.stats.contradictions ?? 0 },
  }))
}

export async function getHistoryEntry(id: number): Promise<HistoryDetail> {
  const response = await request<{ entry: HistoryDetail }>(`/api/history/${id}`)
  return {
    ...response.entry,
    mode: response.entry.mode === 'contradictions' ? 'contradictions' : 'attributes',
    stats: { ...response.entry.stats, contradictions: response.entry.stats.contradictions ?? 0 },
    result: normalizeHistoryResult(response.entry.result),
  }
}

export async function deleteHistoryEntry(id: number): Promise<void> {
  await request<void>(`/api/history/${id}`, { method: 'DELETE' })
}
