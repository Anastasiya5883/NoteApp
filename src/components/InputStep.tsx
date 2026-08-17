import { useEffect, useRef, useState } from 'react'
import { extractTextFromFile, FileReadError } from '../lib/fileReader'
import { SAMPLES } from '../lib/samples'

interface InputStepProps {
  text: string
  setText: (t: string) => void
  fileName: string | null
  onFileLoaded: (fileName: string, content: string) => void
  onUseSample: (text: string) => void
  onAnalyze: () => void
}

export default function InputStep({ text, setText, fileName, onFileLoaded, onUseSample, onAnalyze }: InputStepProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const readGenerationRef = useRef(0)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [isReading, setIsReading] = useState(false)
  const words = text.trim() ? text.trim().split(/\s+/).length : 0

  useEffect(() => () => {
    readGenerationRef.current += 1
  }, [])

  const handleFile = async (file: File) => {
    const readGeneration = ++readGenerationRef.current
    setError(null)
    setIsReading(true)
    try {
      const content = await extractTextFromFile(file)
      if (readGeneration !== readGenerationRef.current) return
      onFileLoaded(file.name, content)
    } catch (readError) {
      if (readGeneration !== readGenerationRef.current) return
      setError(
        readError instanceof FileReadError
          ? readError.message
          : 'Не удалось прочитать файл. Попробуйте выбрать другой файл.',
      )
    } finally {
      if (readGeneration === readGenerationRef.current) setIsReading(false)
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (isReading) return
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-10">
      <div className="pt-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          AI-помощник для подготовки{' '}
          <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
            технических требований
          </span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-slate-600">
          Загрузите ТЗ бизнес-аналитика и получите список найденных объектов, реквизитов, разделов
          конфигурации и вопросов, которые нужно уточнить для передачи задачи разработчику.
        </p>
      </div>

      <div
        className={`mt-8 rounded-2xl border p-4 shadow-sm transition-colors ${
          dragging ? 'border-indigo-400 bg-indigo-50/60' : 'border-slate-200 bg-white'
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          if (isReading) return
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        aria-busy={isReading}
      >
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setError(null)
          }}
          placeholder="Вставьте текст технического задания или описание задачи. Например: «Требуется доработать документ...»"
          rows={12}
          disabled={isReading}
          className="h-64 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:cursor-wait disabled:opacity-70"
        />

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={isReading}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                <path d="M12 12v9" />
                <path d="m16 16-4-4-4 4" />
              </svg>
              {isReading ? 'Читаем файл…' : 'Загрузить файл'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.md,.markdown,.pdf,.docx"
              disabled={isReading}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
                e.currentTarget.value = ''
              }}
            />
            <span className="text-xs text-slate-400">
              или перетащите файл (.txt, .md, .pdf, .docx; до 2 МБ)
            </span>
          </div>
          <span className="text-xs font-medium text-slate-500">{words} слов</span>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {error}
          </p>
        )}

        {fileName && (
          <p className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
            Текущий файл для истории: <span className="font-semibold">{fileName}</span>
          </p>
        )}
      </div>

      <div className="mt-6">
        <p className="mb-2 text-sm font-medium text-slate-600">Попробовать на примере:</p>
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map((s) => (
            <button
              key={s.title}
              disabled={isReading}
              onClick={() => onUseSample(s.text)}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-wait disabled:opacity-60"
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 flex justify-center">
        <button
          onClick={onAnalyze}
          disabled={isReading || !text.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
          Проанализировать ТЗ
        </button>
      </div>
    </div>
  )
}
