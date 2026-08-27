import { useEffect, useRef, useState } from 'react'
import {
  deleteConfigurationCatalog,
  getConfigurationCatalog,
  uploadConfigurationCatalog,
  type ConfigurationCatalogSummary,
} from '../lib/configurationCatalogApi'
import { buildCatalogViewModel, type CatalogPanelState } from './configurationCatalogViewModel'

export default function ConfigurationCatalogPanel() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<CatalogPanelState>({ status: 'loading', summary: null, error: null })
  const view = buildCatalogViewModel(state)

  useEffect(() => {
    let active = true
    getConfigurationCatalog()
      .then(({ summary }) => {
        if (active) setState({ status: summary ? 'loaded' : 'empty', summary, error: null })
      })
      .catch((error) => {
        if (active) setState({ status: 'empty', summary: null, error: error instanceof Error ? error.message : 'Не удалось получить данные' })
      })
    return () => { active = false }
  }, [])

  const upload = async (file: File) => {
    const previousSummary = state.summary
    setState({ status: 'loading', summary: previousSummary, error: null })
    try {
      const { summary } = await uploadConfigurationCatalog(file)
      setState({ status: summary ? 'loaded' : 'empty', summary, error: null })
    } catch (error) {
      setState({
        status: previousSummary ? 'loaded' : 'empty',
        summary: previousSummary,
        error: error instanceof Error ? error.message : 'Не удалось загрузить данные',
      })
    }
  }

  const remove = async () => {
    if (!window.confirm('Удалить загруженную структуру конфигурации?')) return
    const previousSummary: ConfigurationCatalogSummary | null = state.summary
    setState({ status: 'loading', summary: previousSummary, error: null })
    try {
      await deleteConfigurationCatalog()
      setState({ status: 'empty', summary: null, error: null })
    } catch (error) {
      setState({ status: 'loaded', summary: previousSummary, error: error instanceof Error ? error.message : 'Не удалось удалить данные' })
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className={`text-sm font-semibold ${state.status === 'loaded' ? 'text-emerald-700' : 'text-slate-700'}`}>
            {view.title}
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-900">Структура локальной конфигурации</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            В конфигураторе выберите «Конфигурация → Выгрузить конфигурацию в файлы», затем упакуйте полученный каталог в ZIP.
          </p>
        </div>
        {view.canDelete && (
          <button onClick={() => void remove()} className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50">
            Удалить данные
          </button>
        )}
      </div>

      {view.error && <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{view.error}</p>}

      {view.details.length > 0 && (
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {view.details.map((detail) => <div key={detail} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{detail}</div>)}
        </div>
      )}

      <div
        className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          const file = event.dataTransfer.files?.[0]
          if (file && view.canUpload) void upload(file)
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          disabled={!view.canUpload}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void upload(file)
            event.currentTarget.value = ''
          }}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={!view.canUpload}
          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-slate-300"
        >
          {state.summary ? 'Заменить данные' : 'Загрузить ZIP'}
        </button>
        <p className="mt-2 text-xs text-slate-500">ZIP до 5 ГиБ — можно выбрать или перетащить сюда</p>
      </div>
    </section>
  )
}
