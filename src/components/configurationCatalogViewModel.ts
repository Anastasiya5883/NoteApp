import type { ConfigurationCatalogSummary } from '../lib/configurationCatalogApi'

export interface CatalogPanelState {
  status: 'loading' | 'empty' | 'loaded'
  summary: ConfigurationCatalogSummary | null
  error: string | null
}

export function buildCatalogViewModel(state: CatalogPanelState) {
  if (state.status === 'loading') {
    return {
      title: 'Загрузка и обработка…',
      details: [] as string[],
      canUpload: false,
      canDelete: false,
      isBusy: true,
      error: state.error,
    }
  }

  if (state.status === 'loaded' && state.summary) {
    const date = new Intl.DateTimeFormat('ru-RU', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Novosibirsk',
    }).format(new Date(state.summary.uploadedAt))
    return {
      title: 'Данные загружены',
      details: [
        state.summary.configurationSynonym || state.summary.configurationName,
        `Версия: ${state.summary.configurationVersion || 'не указана'}`,
        `Файл: ${state.summary.sourceFileName}`,
        `Загружено: ${date}`,
        `${state.summary.objectCount} объектов · ${state.summary.attributeCount} реквизитов · ${state.summary.tablePartCount} табличных частей`,
      ],
      canUpload: true,
      canDelete: true,
      isBusy: false,
      error: state.error,
    }
  }

  return {
    title: 'Данные не загружены',
    details: [] as string[],
    canUpload: true,
    canDelete: false,
    isBusy: false,
    error: state.error,
  }
}
