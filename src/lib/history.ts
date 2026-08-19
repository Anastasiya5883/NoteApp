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

export function normalizeHistoryResult(result: Omit<AnalysisResult, 'mode' | 'contradictions'> & Partial<Pick<AnalysisResult, 'mode' | 'contradictions'>>): AnalysisResult {
  return {
    ...result,
    mode: result.mode === 'contradictions' ? 'contradictions' : 'attributes',
    contradictions: Array.isArray(result.contradictions) ? result.contradictions.filter(isContradiction) : [],
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
