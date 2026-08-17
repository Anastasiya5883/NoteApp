import assert from 'node:assert/strict'
import test from 'node:test'
import { startAnalysisRun } from './analysisRun'

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds))

test('cancelling before the delay prevents analysis, result delivery, and persistence', async () => {
  let analysisCalls = 0
  let resultCalls = 0
  let saveCalls = 0

  const cancel = startAnalysisRun({
    delayMs: 10,
    analyze: () => {
      analysisCalls += 1
      return 'result'
    },
    onResult: () => {
      resultCalls += 1
    },
    save: async () => {
      saveCalls += 1
    },
  })

  cancel()
  await wait(30)

  assert.deepEqual(
    { analysisCalls, resultCalls, saveCalls },
    { analysisCalls: 0, resultCalls: 0, saveCalls: 0 },
  )
})

test('cancelling an in-flight persistence aborts it without reporting a stale error', async () => {
  let signal: AbortSignal | undefined
  let releaseSave: (() => void) | undefined
  let saveStartedResolve: (() => void) | undefined
  let saveErrors = 0
  const saveStarted = new Promise<void>((resolve) => {
    saveStartedResolve = resolve
  })

  const cancel = startAnalysisRun({
    delayMs: 0,
    analyze: () => 'result',
    onResult: () => undefined,
    save: async (_result, nextSignal) => {
      signal = nextSignal
      saveStartedResolve?.()
      await new Promise<void>((resolve) => {
        releaseSave = resolve
      })
    },
    onSaveError: () => {
      saveErrors += 1
    },
  })

  await saveStarted
  cancel()
  assert.equal(signal?.aborted, true)

  releaseSave?.()
  await wait(0)
  assert.equal(saveErrors, 0)
})
