import type { AnalysisResult } from './analyzer'

export interface HistoryStats {
  words: number
  entities: number
  attributes: number
  sections: number
  gaps: number
}

export interface HistorySummary {
  id: number
  fileName: string
  createdAt: number
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
  } catch (error) {
    if (options?.signal?.aborted) throw error
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
  signal?: AbortSignal,
): Promise<HistorySummary> {
  const response = await request<{ entry: HistorySummary }>('/api/history', {
    method: 'POST',
    body: JSON.stringify({ fileName, sourceText, result }),
    signal,
  })
  return response.entry
}

export async function getHistoryEntries(): Promise<HistorySummary[]> {
  const response = await request<{ entries: HistorySummary[] }>('/api/history')
  return response.entries
}

export async function getHistoryEntry(id: number): Promise<HistoryDetail> {
  const response = await request<{ entry: HistoryDetail }>(`/api/history/${id}`)
  return response.entry
}

export async function deleteHistoryEntry(id: number): Promise<void> {
  await request<void>(`/api/history/${id}`, { method: 'DELETE' })
}
