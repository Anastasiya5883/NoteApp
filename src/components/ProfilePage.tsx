import { useCallback, useEffect, useState } from 'react'
import {
  deleteHistoryEntry,
  getHistoryEntries,
  getHistoryEntry,
  type HistoryDetail,
  type HistorySummary,
} from '../lib/history'

interface ProfilePageProps {
  username: string
  onOpenEntry: (entry: HistoryDetail) => void
  onNewAnalysis: () => void
}

const formatDate = (timestamp: number) => new Intl.DateTimeFormat('ru-RU', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(timestamp))

export default function ProfilePage({ username, onOpenEntry, onNewAnalysis }: ProfilePageProps) {
  const [entries, setEntries] = useState<HistorySummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [openingId, setOpeningId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadEntries = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setEntries(await getHistoryEntries())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить историю')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadEntries()
  }, [loadEntries])

  const handleOpen = async (id: number) => {
    setOpeningId(id)
    setError(null)
    try {
      onOpenEntry(await getHistoryEntry(id))
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : 'Не удалось открыть запись')
    } finally {
      setOpeningId(null)
    }
  }

  const handleDelete = async (entry: HistorySummary) => {
    if (!window.confirm(`Удалить «${entry.fileName}» из истории?`)) return
    setDeletingId(entry.id)
    setError(null)
    try {
      await deleteHistoryEntry(entry.id)
      setEntries((current) => current.filter((item) => item.id !== entry.id))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Не удалось удалить запись')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-12 pt-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-indigo-600">Личный кабинет</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{username}</h1>
          <p className="mt-2 text-sm text-slate-500">История загруженных и проанализированных файлов</p>
        </div>
        <button
          onClick={onNewAnalysis}
          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-indigo-700"
        >
          Новый анализ
        </button>
      </div>

      {error && (
        <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span>{error}</span>
          <button onClick={() => void loadEntries()} className="font-semibold underline">Повторить</button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" aria-label="Загрузка истории" />
        </div>
      ) : entries.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <div className="text-4xl">📄</div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">История пока пуста</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Загрузите файл .txt или .md и запустите анализ — результат появится здесь.
          </p>
          <button onClick={onNewAnalysis} className="mt-5 text-sm font-semibold text-indigo-600 hover:text-indigo-700">
            Перейти к загрузке
          </button>
        </div>
      ) : (
        <div className="mt-8 grid gap-4">
          {entries.map((entry) => {
            const isOpening = openingId === entry.id
            const isDeleting = deletingId === entry.id
            return (
              <article key={entry.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-slate-900">{entry.fileName}</h2>
                    <span className="mt-2 inline-block rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                      {entry.mode === 'contradictions' ? 'Проверка противоречий' : 'Подбор реквизитов 1С'}
                    </span>
                    <p className="mt-1 text-xs text-slate-500">{formatDate(entry.createdAt)}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => void handleOpen(entry.id)}
                      disabled={isOpening || isDeleting}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {isOpening ? 'Открываем…' : 'Открыть'}
                    </button>
                    <button
                      onClick={() => void handleDelete(entry)}
                      disabled={isOpening || isDeleting}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                    >
                      {isDeleting ? 'Удаляем…' : 'Удалить'}
                    </button>
                  </div>
                </div>
                <div className={`mt-4 grid grid-cols-2 gap-2 text-xs ${entry.mode === 'attributes' ? 'sm:grid-cols-5' : ''}`}>
                  <Stat label="Слов" value={entry.stats.words} />
                  {entry.mode === 'contradictions' ? (
                    <Stat label="Противоречий" value={entry.stats.contradictions} />
                  ) : (
                    <>
                      <Stat label="Объектов" value={entry.stats.entities} />
                      <Stat label="Реквизитов" value={entry.stats.attributes} />
                      <Stat label="Разделов" value={entry.stats.sections} />
                      <Stat label="Пробелов" value={entry.stats.gaps} />
                    </>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
      <span className="font-bold text-slate-900">{value}</span> {label.toLowerCase()}
    </div>
  )
}
