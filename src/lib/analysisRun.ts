export interface AnalysisRunOptions<T> {
  delayMs: number
  analyze: () => T
  onResult: (result: T) => void
  save?: (result: T, signal: AbortSignal) => Promise<void>
  onSaveError?: (error: unknown) => void
}

export function startAnalysisRun<T>(options: AnalysisRunOptions<T>): () => void {
  const controller = new AbortController()
  let isActive = true
  const timer = setTimeout(() => {
    if (!isActive) return
    const result = options.analyze()
    if (!isActive) return
    options.onResult(result)
    if (options.save) {
      void options.save(result, controller.signal).catch((error) => {
        if (isActive && !controller.signal.aborted) options.onSaveError?.(error)
      })
    }
  }, options.delayMs)

  return () => {
    if (!isActive) return
    isActive = false
    clearTimeout(timer)
    controller.abort()
  }
}
