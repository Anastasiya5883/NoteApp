import type { CatalogSummary, ConfigurationCatalog } from './configurationCatalogTypes'

export interface ConfigurationCatalogSummary extends CatalogSummary {
  sourceFileName: string
  configurationName: string
  configurationSynonym: string | null
  configurationVersion: string | null
  uploadedAt: number
}

export interface ConfigurationCatalogResponse {
  catalog: ConfigurationCatalog | null
  summary: ConfigurationCatalogSummary | null
}

export class ConfigurationCatalogApiError extends Error {}

async function request(options?: RequestInit): Promise<ConfigurationCatalogResponse | void> {
  let response: Response
  try {
    response = await fetch('/api/configuration-catalog', {
      ...options,
      credentials: 'same-origin',
    })
  } catch {
    throw new ConfigurationCatalogApiError('Сервер недоступен. Попробуйте ещё раз')
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string }
    throw new ConfigurationCatalogApiError(body.error || 'Не удалось выполнить запрос')
  }
  if (response.status === 204) return
  return response.json() as Promise<ConfigurationCatalogResponse>
}

export async function getConfigurationCatalog(): Promise<ConfigurationCatalogResponse> {
  return request() as Promise<ConfigurationCatalogResponse>
}

export async function uploadConfigurationCatalog(file: File): Promise<ConfigurationCatalogResponse> {
  const formData = new FormData()
  formData.append('file', file)
  return request({ method: 'PUT', body: formData }) as Promise<ConfigurationCatalogResponse>
}

export async function deleteConfigurationCatalog(): Promise<void> {
  await request({ method: 'DELETE' })
}
