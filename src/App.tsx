import { useState, useCallback } from 'react'
import Header from './components/Header'
import InputStep from './components/InputStep'
import AnalyzingStep from './components/AnalyzingStep'
import ResultsStep from './components/ResultsStep'
import LoginPage from './components/LoginPage'
import ProfilePage from './components/ProfilePage'
import { useAuth } from './context/AuthContext'
import { analyzeText, type AnalysisResult } from './lib/analyzer'
import {
  createAnalysisInput,
  prepareAnalysisInput,
  setAnalysisFile,
  setAnalysisPrompt,
  setAnalysisSample,
} from './lib/analysisInput'
import { saveHistoryEntry, type HistoryDetail } from './lib/history'

type Step = 'input' | 'analyzing' | 'results'
type View = 'assistant' | 'profile'

export default function App() {
  const { isAuthenticated, isLoading, username } = useAuth()
  const [view, setView] = useState<View>('assistant')
  const [step, setStep] = useState<Step>('input')
  const [input, setInput] = useState(createAnalysisInput)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleAnalyze = useCallback(() => {
    const prepared = prepareAnalysisInput(input)
    if (!prepared.sourceText.trim()) return
    setSaveError(null)
    setStep('analyzing')
    setTimeout(() => {
      const res = analyzeText(prepared.sourceText, prepared.options)
      setResult(res)
      setStep('results')
      if (prepared.fileName) {
        void saveHistoryEntry(prepared.fileName, prepared.sourceText, res).catch((error) => {
          const message = error instanceof Error ? error.message : 'Не удалось сохранить анализ'
          setSaveError(`Результат готов, но не сохранён в истории: ${message}`)
        })
      }
    }, 2600)
  }, [input])

  const handleReset = useCallback(() => {
    setView('assistant')
    setStep('input')
    setInput(createAnalysisInput())
    setResult(null)
    setSaveError(null)
  }, [])

  const handleFileLoaded = useCallback((name: string, content: string) => {
    setInput((current) => setAnalysisFile(current, name, content))
    setSaveError(null)
  }, [])

  const handleUseSample = useCallback((sampleText: string) => {
    setInput((current) => setAnalysisSample(current, sampleText))
    setSaveError(null)
  }, [])

  const handleOpenHistory = useCallback((entry: HistoryDetail) => {
    setInput(createAnalysisInput())
    setResult(entry.result)
    setSaveError(null)
    setStep('results')
    setView('assistant')
  }, [])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-white">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" aria-label="Проверка авторизации" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Header
        onReset={step !== 'input' ? handleReset : undefined}
        onOpenProfile={() => setView('profile')}
        onOpenAssistant={() => setView('assistant')}
        isProfileOpen={view === 'profile'}
      />

      <main className="mx-auto w-full">
        {view === 'profile' && username && (
          <ProfilePage
            username={username}
            onOpenEntry={handleOpenHistory}
            onNewAnalysis={handleReset}
          />
        )}

        {view === 'assistant' && step === 'input' && (
          <InputStep
            prompt={input.prompt}
            setPrompt={(prompt) => setInput((current) => setAnalysisPrompt(current, prompt))}
            fileName={input.fileName}
            canAnalyze={Boolean(input.fileContent?.trim() || input.prompt.trim())}
            onFileLoaded={handleFileLoaded}
            onUseSample={handleUseSample}
            onAnalyze={handleAnalyze}
          />
        )}

        {view === 'assistant' && step === 'analyzing' && <AnalyzingStep />}

        {view === 'assistant' && step === 'results' && result && (
          <ResultsStep result={result} onReset={handleReset} saveError={saveError} />
        )}
      </main>

      <footer className="border-t border-slate-100 py-6 text-center text-xs text-slate-400">
        ТЗ-Ассистент · Прототип · Эвристический анализ на клиенте
      </footer>
    </div>
  )
}
