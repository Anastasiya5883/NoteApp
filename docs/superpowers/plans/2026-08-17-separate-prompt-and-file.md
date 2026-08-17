# Separate Prompt and File Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep uploaded file contents out of the visible prompt field while letting a supported prompt command restrict contradiction results to critical items.

**Architecture:** A small pure `analysisInput` module owns the prompt/file state transitions and converts the prompt into analyzer options. `App` stores that state, passes only the prompt to `InputStep`, analyzes hidden file contents when present, and sends the same source text to history. `analyzeText` accepts an optional contradiction filter without changing its default behavior.

**Tech Stack:** React 18, TypeScript 5.6, Node test runner with `tsx`, Vite 6.

## Global Constraints

- The textarea must contain only the user's prompt and must never be populated from an uploaded file.
- Successfully loaded file text remains the analysis source and history source while the file is selected.
- Without a file, the prompt remains analyzable as a standalone requirements document.
- The supported command is a case-insensitive phrase containing the words equivalent to «только критические противоречия».
- Unknown or empty prompts retain the complete analysis result and never produce an error.
- Do not concatenate the prompt with the file contents.
- Do not add the prompt to the persisted history schema.
- Add no new runtime dependencies.

---

## File Structure

- Create `src/lib/analysisInput.ts`: pure state transitions, prompt parsing, and selection of the source text to analyze.
- Create `src/lib/analysisInput.test.ts`: focused tests for prompt parsing and prompt/file separation.
- Modify `src/lib/analyzer.ts`: optional contradiction filtering while preserving the current default.
- Modify `src/lib/analyzer.test.ts`: analyzer-level regression tests for critical-only and default modes.
- Modify `src/App.tsx`: use independent prompt/file state and save the actual analyzed source text.
- Modify `src/components/InputStep.tsx`: present the prompt-only field and allow analysis when either a prompt or a loaded file exists.
- Create `src/components/InputStep.test.ts`: server-rendered regression test for the prompt-only component contract.

### Task 1: Add an optional critical-only analyzer mode

**Files:**
- Modify: `src/lib/analyzer.ts:5-55,517-555`
- Modify: `src/lib/analyzer.test.ts`

**Interfaces:**
- Consumes: `ContradictionSeverity` and `findContradictions(text: string)` from `src/lib/contradictions.ts`.
- Produces: `AnalysisOptions` with `contradictionSeverity?: ContradictionSeverity`, and `analyzeText(text: string, options?: AnalysisOptions): AnalysisResult`.

- [ ] **Step 1: Write failing analyzer tests**

Append to `src/lib/analyzer.test.ts`:

```ts
test('keeps only critical contradictions when requested', () => {
  const result = analyzeText(
    [
      'Поле «Скидка» обязательное.',
      'Поле «Скидка» необязательное.',
      'Срок хранения архива 30 дней.',
      'Срок хранения архива 90 дней.',
    ].join(' '),
    { contradictionSeverity: 'critical' },
  )

  assert.equal(result.contradictions.length, 1)
  assert.equal(result.contradictions[0].severity, 'critical')
})

test('keeps all contradictions when no filter is provided', () => {
  const result = analyzeText([
    'Поле «Скидка» обязательное.',
    'Поле «Скидка» необязательное.',
    'Срок хранения архива 30 дней.',
    'Срок хранения архива 90 дней.',
  ].join(' '))

  assert.deepEqual(
    result.contradictions.map((item) => item.severity),
    ['critical', 'warning'],
  )
})
```

- [ ] **Step 2: Run the analyzer tests and verify RED**

Run:

```bash
pnpm exec tsx --test src/lib/analyzer.test.ts
```

Expected: TypeScript/test execution fails because `analyzeText` accepts only one argument and no filtering exists.

- [ ] **Step 3: Add the minimal analyzer option**

In `src/lib/analyzer.ts`, import `ContradictionSeverity` and define the public option:

```ts
import {
  findContradictions,
  type Contradiction,
  type ContradictionSeverity,
} from './contradictions'

export interface AnalysisOptions {
  contradictionSeverity?: ContradictionSeverity
}
```

Change the entry-point signature from:

```ts
export function analyzeText(text: string): AnalysisResult {
```

to:

```ts
export function analyzeText(text: string, options: AnalysisOptions = {}): AnalysisResult {
```

Replace:

```ts
const contradictions = findContradictions(normalized)
```

with:

```ts
const contradictions = findContradictions(normalized).filter(
  (item) => !options.contradictionSeverity || item.severity === options.contradictionSeverity,
)
```

Do not filter gaps, recommendations, entities, attributes, or sections.

- [ ] **Step 4: Run focused and full tests and verify GREEN**

Run:

```bash
pnpm exec tsx --test src/lib/analyzer.test.ts src/lib/contradictions.test.ts
pnpm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit the analyzer mode**

```bash
git add src/lib/analyzer.ts src/lib/analyzer.test.ts
git commit -m "feat: filter contradictions by severity"
```

### Task 2: Model prompt and file contents independently

**Files:**
- Create: `src/lib/analysisInput.ts`
- Create: `src/lib/analysisInput.test.ts`

**Interfaces:**
- Consumes: `AnalysisOptions` from `src/lib/analyzer.ts`.
- Produces: `AnalysisInputState`, `createAnalysisInput()`, `setAnalysisPrompt(state, prompt)`, `setAnalysisFile(state, fileName, fileContent)`, `setAnalysisSample(state, text)`, and `prepareAnalysisInput(state)`.

- [ ] **Step 1: Write failing state and prompt-parser tests**

Create `src/lib/analysisInput.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createAnalysisInput,
  prepareAnalysisInput,
  setAnalysisFile,
  setAnalysisPrompt,
  setAnalysisSample,
} from './analysisInput'

test('loading a file preserves the visible prompt and keeps file text separate', () => {
  const prompted = setAnalysisPrompt(createAnalysisInput(), 'Найди только критические противоречия')
  const loaded = setAnalysisFile(prompted, 'requirements.txt', 'Текст требований из файла.')

  assert.equal(loaded.prompt, 'Найди только критические противоречия')
  assert.equal(loaded.fileContent, 'Текст требований из файла.')
})

test('prepares hidden file contents and critical-only options for analysis', () => {
  const state = setAnalysisFile(
    setAnalysisPrompt(createAnalysisInput(), 'ТОЛЬКО критические противоречия, пожалуйста'),
    'requirements.txt',
    'Текст требований из файла.',
  )

  assert.deepEqual(prepareAnalysisInput(state), {
    sourceText: 'Текст требований из файла.',
    fileName: 'requirements.txt',
    options: { contradictionSeverity: 'critical' },
  })
})

test('uses the prompt as requirements text when no file is loaded', () => {
  const state = setAnalysisPrompt(createAnalysisInput(), 'Требуется создать новый отчёт.')

  assert.deepEqual(prepareAnalysisInput(state), {
    sourceText: 'Требуется создать новый отчёт.',
    fileName: null,
    options: {},
  })
})

test('unknown prompt keeps full analysis mode', () => {
  const state = setAnalysisFile(
    setAnalysisPrompt(createAnalysisInput(), 'Проверь документ внимательно'),
    'requirements.txt',
    'Текст требований.',
  )

  assert.deepEqual(prepareAnalysisInput(state).options, {})
})

test('selecting a sample clears the loaded file', () => {
  const loaded = setAnalysisFile(createAnalysisInput(), 'requirements.txt', 'Текст файла.')
  const sampled = setAnalysisSample(loaded, 'Текст примера.')

  assert.deepEqual(sampled, {
    prompt: 'Текст примера.',
    fileName: null,
    fileContent: null,
  })
})
```

- [ ] **Step 2: Run the new test and verify RED**

Run:

```bash
pnpm exec tsx --test src/lib/analysisInput.test.ts
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `./analysisInput`.

- [ ] **Step 3: Implement the pure input model**

Create `src/lib/analysisInput.ts`:

```ts
import type { AnalysisOptions } from './analyzer'

export interface AnalysisInputState {
  prompt: string
  fileName: string | null
  fileContent: string | null
}

export interface PreparedAnalysisInput {
  sourceText: string
  fileName: string | null
  options: AnalysisOptions
}

export function createAnalysisInput(): AnalysisInputState {
  return { prompt: '', fileName: null, fileContent: null }
}

export function setAnalysisPrompt(
  state: AnalysisInputState,
  prompt: string,
): AnalysisInputState {
  return { ...state, prompt }
}

export function setAnalysisFile(
  state: AnalysisInputState,
  fileName: string,
  fileContent: string,
): AnalysisInputState {
  return { ...state, fileName, fileContent }
}

export function setAnalysisSample(
  state: AnalysisInputState,
  prompt: string,
): AnalysisInputState {
  return { prompt, fileName: null, fileContent: null }
}

function optionsFromPrompt(prompt: string): AnalysisOptions {
  const normalized = prompt.toLocaleLowerCase('ru-RU')
  const criticalOnly = normalized.includes('только')
    && normalized.includes('критическ')
    && normalized.includes('противореч')
  return criticalOnly ? { contradictionSeverity: 'critical' } : {}
}

export function prepareAnalysisInput(state: AnalysisInputState): PreparedAnalysisInput {
  return {
    sourceText: state.fileContent ?? state.prompt,
    fileName: state.fileName,
    options: state.fileContent === null ? {} : optionsFromPrompt(state.prompt),
  }
}
```

The `state.fileContent === null` condition preserves the established manual-input behavior: without a file, the textarea content is requirements text rather than a command.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
pnpm exec tsx --test src/lib/analysisInput.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit the independent input model**

```bash
git add src/lib/analysisInput.ts src/lib/analysisInput.test.ts
git commit -m "feat: separate prompt from file contents"
```

### Task 3: Connect the independent input model to the React flow

**Files:**
- Modify: `src/App.tsx:1-75,99-112`
- Modify: `src/components/InputStep.tsx:5-22,82-91,120-137,157-165`
- Create: `src/components/InputStep.test.ts`

**Interfaces:**
- Consumes: all exports from `src/lib/analysisInput.ts` and `analyzeText(text, options)` from Task 1.
- Produces: a prompt-only `InputStep` contract with `prompt`, `setPrompt`, and `canAnalyze`, while preserving `onFileLoaded(fileName, content)`.

- [ ] **Step 1: Add a failing prompt-only component test**

Create `src/components/InputStep.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import InputStep from './InputStep'

test('renders only the prompt when a file is selected', () => {
  const html = renderToStaticMarkup(createElement(InputStep, {
    prompt: 'Найди только критические противоречия',
    setPrompt() {},
    fileName: 'requirements.txt',
    canAnalyze: true,
    onFileLoaded() {},
    onUseSample() {},
    onAnalyze() {},
  }))

  assert.match(html, /Найди только критические противоречия/)
  assert.match(html, /requirements\.txt/)
  assert.doesNotMatch(html, /Текст требований из файла/)
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm exec tsx --test src/components/InputStep.test.ts
```

Expected: FAIL with a `TypeError` when the current component attempts to call `trim()` on its missing `text` prop. This proves the new prompt-only contract is not implemented yet.

- [ ] **Step 3: Replace the three loose App values with `AnalysisInputState`**

In `src/App.tsx`, import the input functions and replace `text`/`fileName` state:

```ts
import {
  createAnalysisInput,
  prepareAnalysisInput,
  setAnalysisFile,
  setAnalysisPrompt,
  setAnalysisSample,
} from './lib/analysisInput'

const [input, setInput] = useState(createAnalysisInput)
```

Update `handleAnalyze` so it snapshots the prepared input before the timeout:

```ts
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
```

Update state transitions:

```ts
// handleReset
setInput(createAnalysisInput())

// handleFileLoaded
setInput((current) => setAnalysisFile(current, name, content))

// handleUseSample
setInput((current) => setAnalysisSample(current, sampleText))

// handleOpenHistory
setInput(createAnalysisInput())
```

For `handleOpenHistory`, keep the existing stored result and do not re-run analysis.

- [ ] **Step 4: Make `InputStep` explicitly prompt-only**

Change its props and bindings:

```ts
interface InputStepProps {
  prompt: string
  setPrompt: (prompt: string) => void
  fileName: string | null
  canAnalyze: boolean
  onFileLoaded: (fileName: string, content: string) => void
  onUseSample: (text: string) => void
  onAnalyze: () => void
}
```

Use `prompt` as the textarea value, call `setPrompt` on change, and calculate the displayed count from `prompt`. Replace the placeholder with:

```tsx
placeholder="Напишите, как проанализировать ТЗ. Например: «Найди только критические противоречия»"
```

Replace the button condition with:

```tsx
disabled={isReading || !canAnalyze}
```

Pass these props from `App`:

```tsx
<InputStep
  prompt={input.prompt}
  setPrompt={(prompt) => setInput((current) => setAnalysisPrompt(current, prompt))}
  fileName={input.fileName}
  canAnalyze={Boolean(input.fileContent?.trim() || input.prompt.trim())}
  onFileLoaded={handleFileLoaded}
  onUseSample={handleUseSample}
  onAnalyze={handleAnalyze}
/>
```

- [ ] **Step 5: Run tests and type/build verification**

Run:

```bash
pnpm exec tsx --test src/components/InputStep.test.ts src/lib/analysisInput.test.ts src/lib/analyzer.test.ts
pnpm test
pnpm build
```

Expected: all tests pass; TypeScript and Vite production build complete successfully. The existing Vite chunk-size warning is acceptable.

- [ ] **Step 6: Commit the React integration**

```bash
git add src/App.tsx src/components/InputStep.tsx src/components/InputStep.test.ts
git commit -m "feat: keep uploaded text out of prompt field"
```

### Task 4: Verify the complete browser workflow

**Files:**
- No production file changes expected.

**Interfaces:**
- Consumes: the completed React flow and local API server.
- Produces: manual evidence that the visible UI and persisted history match the specification.

- [ ] **Step 1: Start or reuse the local application**

Run:

```bash
pnpm dev
```

Open `http://127.0.0.1:5173/` and sign in with an existing local test account.

- [ ] **Step 2: Verify prompt/file separation**

Enter `Найди только критические противоречия`, upload a supported text file containing one logical critical contradiction and one numeric warning contradiction, and verify:

- the textarea still contains exactly the prompt;
- the file name appears below the field;
- the uploaded requirements text does not appear in the textarea;
- the Analyze button is enabled.

- [ ] **Step 3: Verify filtering and history source**

Run the analysis and verify:

- only the critical contradiction is shown;
- no save-error banner appears;
- the new history entry uses the uploaded file name;
- opening the history entry shows results derived from the file, not from the prompt.

- [ ] **Step 4: Verify reset and full-analysis fallback**

Reset the form, upload the same file without entering a prompt, and verify both critical and warning contradictions appear. Reset again and verify the prompt, file name, and file selection are cleared.

- [ ] **Step 5: Run final repository checks**

Run:

```bash
pnpm test
pnpm build
git status --short
```

Expected: all tests and the build pass; the worktree is clean except for intentional plan checklist updates, if any.
