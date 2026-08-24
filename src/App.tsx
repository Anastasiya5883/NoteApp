import { useState, useCallback } from 'react'
import Header from './components/Header'
import InputStep from './components/InputStep'
import AnalyzingStep from './components/AnalyzingStep'
import ResultsStep from './components/ResultsStep'
import LoginPage from './components/LoginPage'
import ProfilePage from './components/ProfilePage'
import { useAuth } from './context/AuthContext'
import { analyzeText, type AnalysisMode, type AnalysisResult } from './lib/analyzer'
import { saveHistoryEntry, type HistoryDetail } from './lib/history'
import { getConfigurationCatalog } from './lib/configurationCatalogApi'

type Step = 'input' | 'analyzing' | 'results'
type View = 'assistant' | 'profile'

export default function App() {
  const { isAuthenticated, isLoading, username } = useAuth()
  const [view, setView] = useState<View>('assistant')
  const [step, setStep] = useState<Step>('input')
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [mode, setMode] = useState<AnalysisMode>('attributes')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [analysisWarning, setAnalysisWarning] = useState<string | null>(null)

  const handleAnalyze = useCallback(() => {
    if (!text.trim()) return
    const sourceText = text
    const sourceFileName = fileName
    setSaveError(null)
    setAnalysisWarning(null)
    setStep('analyzing')
    setTimeout(async () => {
      let localCatalog = null
      if (mode === 'attributes') {
        try {
          localCatalog = (await getConfigurationCatalog()).catalog
        } catch {
          setAnalysisWarning('Не удалось получить локальную структуру. Проверка выполнена только по неполному справочному каталогу ERP.')
        }
      }
      const res = analyzeText(sourceText, mode, localCatalog)
      setResult(res)
      setStep('results')
      if (sourceFileName) {
        void saveHistoryEntry(sourceFileName, sourceText, res).catch((error) => {
          const message = error instanceof Error ? error.message : 'Не удалось сохранить анализ'
          setSaveError(`Результат готов, но не сохранён в истории: ${message}`)
        })
      }
    }, 2600)
  }, [fileName, mode, text])

  const handleReset = useCallback(() => {
    setView('assistant')
    setStep('input')
    setText('')
    setFileName(null)
    setResult(null)
    setSaveError(null)
    setAnalysisWarning(null)
    setMode('attributes')
  }, [])

  const handleFileLoaded = useCallback((name: string, content: string) => {
    setFileName(name)
    setText(content)
    setSaveError(null)
    setAnalysisWarning(null)
  }, [])

  const handleUseSample = useCallback((sampleText: string) => {
    setFileName(null)
    setText(sampleText)
    setSaveError(null)
    setAnalysisWarning(null)
  }, [])

  const handleOpenHistory = useCallback((entry: HistoryDetail) => {
    setText(entry.sourceText)
    setFileName(null)
    setResult(entry.result)
    setMode(entry.result.mode)
    setSaveError(null)
    setAnalysisWarning(null)
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
            text={text}
            setText={setText}
            fileName={fileName}
            onFileLoaded={handleFileLoaded}
            onUseSample={handleUseSample}
            onAnalyze={handleAnalyze}
            mode={mode}
            onModeChange={setMode}
          />
        )}

        {view === 'assistant' && step === 'analyzing' && <AnalyzingStep mode={mode} />}

        {view === 'assistant' && step === 'results' && result && (
          <ResultsStep result={result} onReset={handleReset} saveError={saveError} analysisWarning={analysisWarning} />
        )}
      </main>

      <footer className="border-t border-slate-100 py-6 text-center text-xs text-slate-400">
        ТЗ-Ассистент · Прототип · Эвристический анализ на клиенте
      </footer>
    </div>
  )
}
