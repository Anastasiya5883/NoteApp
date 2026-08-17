# Contradiction Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить в локальный анализ ТЗ точную проверку очевидных логических и числовых противоречий, показать их в интерфейсе и Markdown-экспорте и сохранить совместимость со старой историей.

**Architecture:** Новый чистый модуль `contradictions.ts` преобразует предложения в строгие нормализованные утверждения и сравнивает только утверждения с одинаковым ключом. `analyzer.ts` включает результат в `AnalysisResult`; UI и экспорт только отображают готовые данные, а граница чтения истории нормализует старые записи без нового поля.

**Tech Stack:** TypeScript 5.6, React 18, Node.js test runner через `node --import tsx --test`, Vite 6.

## Global Constraints

- Анализ выполняется локально без AI-моделей, серверных API и новых внешних зависимостей.
- Приоритет — минимизация ложных срабатываний; неоднозначные формулировки пропускаются.
- Поддерживаются строгие логические пары: обязательное/необязательное, разрешить/запретить, показывать/не показывать, создавать/не создавать.
- Числовой конфликт требует одинакового нормализованного контекста и единицы, но разных значений.
- Каждое противоречие содержит стабильный идентификатор, категорию, важность, объяснение и две дословные цитаты.
- Старые результаты истории без `contradictions` открываются с пустым массивом.

---

## File Structure

- Create `src/lib/contradictions.ts`: типы, нормализация утверждений, строгие логические и числовые правила, устранение дублей.
- Create `src/lib/contradictions.test.ts`: поведенческие тесты детектора, включая отрицательные случаи.
- Modify `src/lib/analyzer.ts`: добавить `contradictions` в публичную модель и результат `analyzeText`.
- Create `src/lib/analyzer.test.ts`: интеграционный тест точки входа анализатора.
- Modify `src/lib/exporter.ts`: добавить Markdown-раздел противоречий.
- Create `src/lib/exporter.test.ts`: проверить экспорт найденных конфликтов и пустого состояния.
- Modify `src/lib/history.ts`: нормализовать старые ответы API без `contradictions`.
- Create `src/lib/history.test.ts`: проверить совместимость старой истории.
- Modify `server/index.ts`: требовать массив `contradictions` при сохранении нового результата.
- Modify `src/components/ResultsStep.tsx`: показать счётчик, пустое состояние и карточки конфликтов.
- Modify `src/components/AnalyzingStep.tsx`: показать новую стадию анализа.

### Task 1: Строгий детектор противоречий

**Files:**
- Create: `src/lib/contradictions.ts`
- Create: `src/lib/contradictions.test.ts`

**Interfaces:**
- Consumes: исходный текст ТЗ как `string`.
- Produces: `findContradictions(text: string): Contradiction[]`, `ContradictionCategory`, `ContradictionSeverity`, `Contradiction`.

- [ ] **Step 1: Написать падающие тесты логических конфликтов**

Создать `src/lib/contradictions.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { findContradictions } from './contradictions'

test('finds an explicit logical contradiction for the same subject', () => {
  const result = findContradictions(
    'Поле «Скидка» обязательное. Поле «Скидка» необязательное.',
  )

  assert.equal(result.length, 1)
  assert.equal(result[0].category, 'logical')
  assert.deepEqual(result[0].quotes, [
    'Поле «Скидка» обязательное.',
    'Поле «Скидка» необязательное.',
  ])
})

test('does not compare opposite rules for different subjects', () => {
  const result = findContradictions(
    'Поле «Скидка» обязательное. Поле «Комментарий» необязательное.',
  )

  assert.deepEqual(result, [])
})

test('does not report repeated equivalent requirements', () => {
  const result = findContradictions(
    'Показывать кнопку «Печать». Показывать кнопку «Печать».',
  )

  assert.deepEqual(result, [])
})
```

- [ ] **Step 2: Запустить логические тесты и подтвердить RED**

Run: `pnpm exec tsx --test src/lib/contradictions.test.ts`

Expected: FAIL с `ERR_MODULE_NOT_FOUND` для `./contradictions`, потому что детектор ещё не создан.

- [ ] **Step 3: Реализовать минимальный логический детектор**

Создать `src/lib/contradictions.ts` с публичными типами и таблицей строгих правил:

```ts
export type ContradictionCategory = 'logical' | 'numeric'
export type ContradictionSeverity = 'critical' | 'warning'

export interface Contradiction {
  id: string
  category: ContradictionCategory
  severity: ContradictionSeverity
  title: string
  explanation: string
  quotes: [string, string]
}

interface LogicalAssertion {
  key: string
  polarity: 'positive' | 'negative'
  quote: string
  index: number
  label: string
}

const LOGICAL_RULES = [
  {
    label: 'обязательность',
    positive: /обязательн(?:ое|ая|ый|ые|о)?/i,
    negative: /необязательн(?:ое|ая|ый|ые|о)?/i,
  },
  {
    label: 'разрешение',
    positive: /разреш(?:ить|ено|ается|ать)/i,
    negative: /запрещ(?:ено|ается|ать)|запретить/i,
  },
  {
    label: 'отображение',
    positive: /показывать/i,
    negative: /не\s+показывать/i,
  },
  {
    label: 'создание',
    positive: /создавать/i,
    negative: /не\s+создавать/i,
  },
] as const

const splitSentences = (text: string): string[] =>
  text.split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean)

const normalizeKey = (sentence: string, marker: RegExp): string =>
  sentence
    .toLocaleLowerCase('ru-RU')
    .replace(marker, ' ')
    .replace(/[«»"“”.,!?;:()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

function extractLogicalAssertions(sentences: string[]): LogicalAssertion[] {
  const assertions: LogicalAssertion[] = []
  sentences.forEach((quote, index) => {
    for (const rule of LOGICAL_RULES) {
      const negative = rule.negative.test(quote)
      const positive = !negative && rule.positive.test(quote)
      if (!negative && !positive) continue
      const marker = negative ? rule.negative : rule.positive
      const key = normalizeKey(quote, marker)
      if (key.split(' ').length < 2) continue
      assertions.push({
        key: `${rule.label}:${key}`,
        polarity: negative ? 'negative' : 'positive',
        quote,
        index,
        label: rule.label,
      })
      break
    }
  })
  return assertions
}
```

Добавить внутренние функции построения детерминированного ID из `category + quotes`, сравнения утверждений одного ключа и публичную `findContradictions`. Логический результат имеет `severity: 'critical'`, заголовок `Взаимоисключающие требования`, объяснение `Для одного предмета одновременно заданы противоположные требования (${label}).` и сохраняет цитаты в порядке текста.

Использовать следующую реализацию:

```ts
interface PositionedContradiction extends Contradiction {
  firstIndex: number
  secondIndex: number
}

function stableId(category: ContradictionCategory, quotes: [string, string]): string {
  const input = `${category}\u0000${quotes[0]}\u0000${quotes[1]}`
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `contradiction-${category}-${(hash >>> 0).toString(16)}`
}

function findLogicalContradictions(sentences: string[]): PositionedContradiction[] {
  const assertions = extractLogicalAssertions(sentences)
  const results: PositionedContradiction[] = []
  for (let first = 0; first < assertions.length; first += 1) {
    for (let second = first + 1; second < assertions.length; second += 1) {
      const left = assertions[first]
      const right = assertions[second]
      if (left.key !== right.key || left.polarity === right.polarity) continue
      const quotes: [string, string] = [left.quote, right.quote]
      results.push({
        id: stableId('logical', quotes),
        category: 'logical',
        severity: 'critical',
        title: 'Взаимоисключающие требования',
        explanation: `Для одного предмета одновременно заданы противоположные требования (${left.label}).`,
        quotes,
        firstIndex: left.index,
        secondIndex: right.index,
      })
    }
  }
  return results
}

function finalize(results: PositionedContradiction[]): Contradiction[] {
  const seen = new Set<string>()
  return results
    .sort((left, right) => left.firstIndex - right.firstIndex || left.secondIndex - right.secondIndex)
    .filter((item) => {
      const key = `${item.category}\u0000${item.quotes[0]}\u0000${item.quotes[1]}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map(({ firstIndex: _first, secondIndex: _second, ...item }) => item)
}

export function findContradictions(text: string): Contradiction[] {
  return finalize(findLogicalContradictions(splitSentences(text)))
}
```

- [ ] **Step 4: Запустить логические тесты и подтвердить GREEN**

Run: `pnpm exec tsx --test src/lib/contradictions.test.ts`

Expected: PASS для трёх тестов.

- [ ] **Step 5: Написать падающие тесты числовых конфликтов, дублей и порядка**

Дополнить `src/lib/contradictions.test.ts`:

```ts
test('finds different numeric values for the same parameter and unit', () => {
  const result = findContradictions(
    'Хранить журнал 30 дней. Хранить журнал 60 дней.',
  )

  assert.equal(result.length, 1)
  assert.equal(result[0].category, 'numeric')
  assert.match(result[0].explanation, /30.*60/)
})

test('ignores equal values and different units or parameters', () => {
  assert.deepEqual(findContradictions('Хранить журнал 30 дней. Хранить журнал 30 дней.'), [])
  assert.deepEqual(findContradictions('Хранить журнал 30 дней. Хранить журнал 30 часов.'), [])
  assert.deepEqual(findContradictions('Хранить журнал 30 дней. Блокировать заказ через 60 дней.'), [])
})

test('deduplicates pairs and preserves first-conflict order', () => {
  const result = findContradictions(
    [
      'Хранить журнал 30 дней.',
      'Поле «Скидка» обязательное.',
      'Хранить журнал 60 дней.',
      'Поле «Скидка» необязательное.',
      'Хранить журнал 60 дней.',
    ].join(' '),
  )

  assert.deepEqual(result.map((item) => item.category), ['numeric', 'logical'])
  assert.equal(result.length, 2)
  assert.equal(result[0].id, findContradictions(
    'Хранить журнал 30 дней. Хранить журнал 60 дней.',
  )[0].id)
})
```

- [ ] **Step 6: Запустить новые тесты и подтвердить RED**

Run: `pnpm exec tsx --test src/lib/contradictions.test.ts`

Expected: логические тесты PASS, числовой тест FAIL с пустым массивом.

- [ ] **Step 7: Реализовать минимальную числовую проверку и общую дедупликацию**

В `src/lib/contradictions.ts` добавить строгий разбор числа и единицы:

```ts
interface NumericAssertion {
  key: string
  value: number
  displayValue: string
  quote: string
  index: number
}

const UNIT_GROUPS: Array<{ normalized: string; pattern: string }> = [
  { normalized: 'day', pattern: 'д(?:ень|ня|ней)|сут(?:ки|ок)' },
  { normalized: 'hour', pattern: 'час(?:а|ов)?' },
  { normalized: 'minute', pattern: 'минут(?:а|ы)?' },
  { normalized: 'second', pattern: 'секунд(?:а|ы)?' },
  { normalized: 'piece', pattern: 'шт(?:ук(?:а|и)?)?\\.?' },
  { normalized: 'ruble', pattern: 'руб(?:ль|ля|лей)?\\.?|₽' },
  { normalized: 'percent', pattern: '%|процент(?:а|ов)?' },
]

const NUMBER_WITH_UNIT = new RegExp(
  `\\b(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_GROUPS.map((unit) => unit.pattern).join('|')})(?=$|\\s|[.,;:!?])`,
  'giu',
)
```

Для каждого совпадения нормализовать единицу через `UNIT_GROUPS`, удалить число с единицей из нормализованного контекста и построить ключ из нормализованной единицы и оставшегося текста. Сравнивать только одинаковые ключи с разными числовыми значениями. Числовой результат имеет `severity: 'warning'`, заголовок `Разные значения одного параметра` и объяснение `Для одного параметра указаны разные значения: ${first.displayValue} и ${second.displayValue}.`.

Объединить логические и числовые пары, отсортировать по индексу первого конфликтующего требования, затем второго, и удалить дубли по `category + quotes`. Для стабильного ID применить детерминированный строковый hash (например FNV-1a) к тому же ключу, без случайных значений и времени.

Реализовать числовую часть и заменить публичную функцию следующим кодом:

```ts
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function normalizeUnit(raw: string): string | null {
  return UNIT_GROUPS.find((unit) => new RegExp(`^(?:${unit.pattern})$`, 'iu').test(raw))?.normalized ?? null
}

function extractNumericAssertions(sentences: string[]): NumericAssertion[] {
  const assertions: NumericAssertion[] = []
  sentences.forEach((quote, index) => {
    for (const match of quote.matchAll(NUMBER_WITH_UNIT)) {
      const unit = normalizeUnit(match[2])
      if (!unit) continue
      const value = Number(match[1].replace(',', '.'))
      if (!Number.isFinite(value)) continue
      const context = normalizeKey(quote, new RegExp(escapeRegExp(match[0]), 'iu'))
      if (context.split(' ').length < 2) continue
      assertions.push({
        key: `${unit}:${context}`,
        value,
        displayValue: match[0],
        quote,
        index,
      })
    }
  })
  return assertions
}

function findNumericContradictions(sentences: string[]): PositionedContradiction[] {
  const assertions = extractNumericAssertions(sentences)
  const results: PositionedContradiction[] = []
  for (let first = 0; first < assertions.length; first += 1) {
    for (let second = first + 1; second < assertions.length; second += 1) {
      const left = assertions[first]
      const right = assertions[second]
      if (left.key !== right.key || left.value === right.value) continue
      const quotes: [string, string] = [left.quote, right.quote]
      results.push({
        id: stableId('numeric', quotes),
        category: 'numeric',
        severity: 'warning',
        title: 'Разные значения одного параметра',
        explanation: `Для одного параметра указаны разные значения: ${left.displayValue} и ${right.displayValue}.`,
        quotes,
        firstIndex: left.index,
        secondIndex: right.index,
      })
    }
  }
  return results
}

export function findContradictions(text: string): Contradiction[] {
  const sentences = splitSentences(text)
  return finalize([
    ...findLogicalContradictions(sentences),
    ...findNumericContradictions(sentences),
  ])
}
```

- [ ] **Step 8: Запустить тесты детектора и подтвердить GREEN**

Run: `pnpm exec tsx --test src/lib/contradictions.test.ts`

Expected: PASS для всех тестов детектора, без предупреждений.

- [ ] **Step 9: Зафиксировать детектор**

```bash
git add src/lib/contradictions.ts src/lib/contradictions.test.ts
git commit -m "feat: detect explicit requirement contradictions"
```

### Task 2: Интеграция с анализатором и Markdown-экспортом

**Files:**
- Modify: `src/lib/analyzer.ts:1-58,514-550`
- Create: `src/lib/analyzer.test.ts`
- Modify: `src/lib/exporter.ts:1-55`
- Create: `src/lib/exporter.test.ts`

**Interfaces:**
- Consumes: `findContradictions(text: string): Contradiction[]` из Task 1.
- Produces: обязательное `AnalysisResult.contradictions: Contradiction[]`; Markdown-раздел `## Противоречия в требованиях`.

- [ ] **Step 1: Написать падающий интеграционный тест анализатора**

Создать `src/lib/analyzer.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeText } from './analyzer'

test('includes contradictions in the complete analysis result', () => {
  const result = analyzeText(
    'Поле «Скидка» обязательное. Поле «Скидка» необязательное.',
  )

  assert.equal(result.contradictions.length, 1)
  assert.equal(result.contradictions[0].category, 'logical')
})
```

- [ ] **Step 2: Запустить интеграционный тест и подтвердить RED**

Run: `pnpm exec tsx --test src/lib/analyzer.test.ts`

Expected: FAIL, потому что `AnalysisResult` ещё не возвращает `contradictions`.

- [ ] **Step 3: Подключить детектор к `analyzeText`**

В начале `src/lib/analyzer.ts` импортировать тип и функцию:

```ts
import { findContradictions, type Contradiction } from './contradictions'
```

Расширить `AnalysisResult`:

```ts
export interface AnalysisResult {
  words: number
  entities: FoundEntity[]
  attributes: FoundAttribute[]
  sections: FoundSection[]
  contradictions: Contradiction[]
  gaps: Gap[]
  recommendations: Recommendation[]
}
```

В `analyzeText` вычислить `const contradictions = findContradictions(normalized)` и вернуть его между `sections` и `gaps`.

- [ ] **Step 4: Запустить интеграционный тест и подтвердить GREEN**

Run: `pnpm exec tsx --test src/lib/analyzer.test.ts`

Expected: PASS.

- [ ] **Step 5: Написать падающие тесты Markdown-экспорта**

Создать `src/lib/exporter.test.ts` с фабрикой полного результата:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import type { AnalysisResult } from './analyzer'
import { buildMarkdown } from './exporter'

const baseResult = (): AnalysisResult => ({
  words: 12,
  entities: [],
  attributes: [],
  sections: [],
  contradictions: [],
  gaps: [],
  recommendations: [],
})

test('exports contradiction explanation and both source quotes', () => {
  const result = baseResult()
  result.contradictions.push({
    id: 'contradiction-logical-1',
    category: 'logical',
    severity: 'critical',
    title: 'Взаимоисключающие требования',
    explanation: 'Для одного предмета заданы противоположные требования.',
    quotes: ['Поле «Скидка» обязательное.', 'Поле «Скидка» необязательное.'],
  })

  const markdown = buildMarkdown(result)
  assert.match(markdown, /## Противоречия в требованиях/)
  assert.match(markdown, /Поле «Скидка» обязательное\./)
  assert.match(markdown, /Поле «Скидка» необязательное\./)
})

test('exports an explicit empty state when no contradictions exist', () => {
  assert.match(buildMarkdown(baseResult()), /Явных противоречий не выявлено/)
})
```

- [ ] **Step 6: Запустить тесты экспорта и подтвердить RED**

Run: `pnpm exec tsx --test src/lib/exporter.test.ts`

Expected: FAIL, раздел противоречий отсутствует.

- [ ] **Step 7: Добавить раздел в `buildMarkdown`**

После раздела затронутых конфигураций и перед пробелами добавить:

```ts
lines.push('', '## Противоречия в требованиях')
if (result.contradictions.length === 0) {
  lines.push('', 'Явных противоречий не выявлено.')
} else {
  for (const contradiction of result.contradictions) {
    const category = contradiction.category === 'logical' ? 'логическое' : 'числовое'
    lines.push('', `### ${contradiction.title} (${category})`)
    lines.push('', contradiction.explanation)
    lines.push('', `> **Фрагмент 1:** ${contradiction.quotes[0]}`)
    lines.push('', `> **Фрагмент 2:** ${contradiction.quotes[1]}`)
  }
}
```

- [ ] **Step 8: Запустить тесты анализатора и экспорта**

Run: `pnpm exec tsx --test src/lib/contradictions.test.ts src/lib/analyzer.test.ts src/lib/exporter.test.ts`

Expected: PASS для всех тестов.

- [ ] **Step 9: Зафиксировать интеграцию и экспорт**

```bash
git add src/lib/analyzer.ts src/lib/analyzer.test.ts src/lib/exporter.ts src/lib/exporter.test.ts
git commit -m "feat: include contradictions in analysis reports"
```

### Task 3: Совместимость истории и серверная валидация

**Files:**
- Modify: `src/lib/history.ts:23-72`
- Create: `src/lib/history.test.ts`
- Create: `server/analysisValidation.ts`
- Create: `server/analysisValidation.test.ts`
- Modify: `server/index.ts:152-168`

**Interfaces:**
- Consumes: JSON результата анализа от `/api/history/:id`, где старые записи могут не иметь `contradictions`.
- Produces: `normalizeHistoryResult(value: AnalysisResult | Omit<AnalysisResult, 'contradictions'>): AnalysisResult`; новые POST-запросы принимаются только с массивом `contradictions`.

- [ ] **Step 1: Написать падающий тест совместимости старой истории**

Создать `src/lib/history.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import type { AnalysisResult } from './analyzer'
import { normalizeHistoryResult } from './history'

test('adds an empty contradictions array to legacy history results', () => {
  const legacy = {
    words: 1,
    entities: [],
    attributes: [],
    sections: [],
    gaps: [],
    recommendations: [],
  }

  assert.deepEqual(normalizeHistoryResult(legacy).contradictions, [])
})

test('preserves contradictions already stored in history', () => {
  const current: AnalysisResult = {
    words: 1,
    entities: [],
    attributes: [],
    sections: [],
    contradictions: [{
      id: 'contradiction-logical-1',
      category: 'logical',
      severity: 'critical',
      title: 'Взаимоисключающие требования',
      explanation: 'Конфликт.',
      quotes: ['Первое.', 'Второе.'],
    }],
    gaps: [],
    recommendations: [],
  }

  assert.strictEqual(normalizeHistoryResult(current), current)
})
```

- [ ] **Step 2: Запустить тест и подтвердить RED**

Run: `pnpm exec tsx --test src/lib/history.test.ts`

Expected: FAIL, экспорт `normalizeHistoryResult` отсутствует.

- [ ] **Step 3: Нормализовать результат на границе API**

В `src/lib/history.ts` добавить:

```ts
type LegacyAnalysisResult = Omit<AnalysisResult, 'contradictions'> & {
  contradictions?: AnalysisResult['contradictions']
}

export function normalizeHistoryResult(result: LegacyAnalysisResult): AnalysisResult {
  if (Array.isArray(result.contradictions)) return result as AnalysisResult
  return { ...result, contradictions: [] }
}
```

В `getHistoryEntry` получить ответ, заменить `response.entry.result` на `normalizeHistoryResult(response.entry.result as LegacyAnalysisResult)` и вернуть нормализованную запись.

- [ ] **Step 4: Написать падающий тест серверной валидации**

Создать `server/analysisValidation.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { isAnalysisResult } from './analysisValidation.js'

const validResult = {
  words: 1,
  entities: [],
  attributes: [],
  sections: [],
  contradictions: [],
  gaps: [],
  recommendations: [],
}

test('accepts current analysis results with contradictions', () => {
  assert.equal(isAnalysisResult(validResult), true)
})

test('rejects new history submissions without contradictions', () => {
  const { contradictions: _contradictions, ...legacyResult } = validResult
  assert.equal(isAnalysisResult(legacyResult), false)
})
```

- [ ] **Step 5: Запустить серверный тест и подтвердить RED**

Run: `pnpm exec tsx --test server/analysisValidation.test.ts`

Expected: FAIL с `ERR_MODULE_NOT_FOUND` для `./analysisValidation.js`.

- [ ] **Step 6: Выделить и усилить серверную валидацию новых результатов**

Создать `server/analysisValidation.ts`:

```ts
export interface StoredAnalysisResult {
  words: number
  entities: unknown[]
  attributes: unknown[]
  sections: unknown[]
  contradictions: unknown[]
  gaps: unknown[]
  recommendations: unknown[]
}

export function isAnalysisResult(value: unknown): value is StoredAnalysisResult {
  if (!value || typeof value !== 'object') return false
  const result = value as Record<string, unknown>
  return Number.isFinite(result.words)
    && Array.isArray(result.entities)
    && Array.isArray(result.attributes)
    && Array.isArray(result.sections)
    && Array.isArray(result.contradictions)
    && Array.isArray(result.gaps)
    && Array.isArray(result.recommendations)
}
```

Удалить локальную `isAnalysisResult` из `server/index.ts` и импортировать её как `import { isAnalysisResult } from './analysisValidation.js'`. Миграция SQLite не нужна: полный JSON уже хранится в `analysis_json`, а статистика истории не меняется.

- [ ] **Step 7: Запустить тесты совместимости и серверную проверку типов**

Run: `pnpm exec tsx --test src/lib/history.test.ts server/analysisValidation.test.ts`

Expected: PASS.

Run: `pnpm exec tsc -p tsconfig.server.json --noEmit`

Expected: PASS без диагностик.

- [ ] **Step 8: Зафиксировать совместимость истории**

```bash
git add src/lib/history.ts src/lib/history.test.ts server/analysisValidation.ts server/analysisValidation.test.ts server/index.ts
git commit -m "fix: preserve legacy analysis history"
```

### Task 4: Отображение противоречий в интерфейсе

**Files:**
- Modify: `src/components/ResultsStep.tsx:1-175,276-312`
- Modify: `src/components/AnalyzingStep.tsx:3-9`
- Create: `src/components/analysisResults.test.ts`

**Interfaces:**
- Consumes: `AnalysisResult['contradictions']` из Task 2.
- Produces: счётчик «Противоречий», секция карточек или пустое состояние, стадия «Проверка противоречий».

- [ ] **Step 1: Написать падающий тест отображения результата и стадии анализа**

Создать `src/components/analysisResults.test.ts`:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { AnalysisResult } from '../lib/analyzer'
import AnalyzingStep from './AnalyzingStep'
import ResultsStep from './ResultsStep'

const result: AnalysisResult = {
  words: 10,
  entities: [],
  attributes: [],
  sections: [],
  contradictions: [{
    id: 'contradiction-logical-1',
    category: 'logical',
    severity: 'critical',
    title: 'Взаимоисключающие требования',
    explanation: 'Для одного предмета заданы противоположные требования.',
    quotes: ['Поле обязательно.', 'Поле необязательно.'],
  }],
  gaps: [],
  recommendations: [],
}

test('renders contradiction count, explanation and both quotes', () => {
  const html = renderToStaticMarkup(createElement(ResultsStep, { result, onReset() {} }))
  assert.match(html, /Противоречий/)
  assert.match(html, /Взаимоисключающие требования/)
  assert.match(html, /Поле обязательно\./)
  assert.match(html, /Поле необязательно\./)
})

test('shows contradiction checking as an analysis stage', () => {
  const html = renderToStaticMarkup(createElement(AnalyzingStep))
  assert.match(html, /Проверка противоречий/)
})
```

- [ ] **Step 2: Запустить UI-тест и подтвердить RED**

Run: `pnpm exec tsx --test src/components/analysisResults.test.ts`

Expected: FAIL, потому что счётчик/карточки и новая стадия ещё не отображаются.

- [ ] **Step 3: Добавить изолированный компонент списка противоречий**

В `src/components/ResultsStep.tsx` перед `GapCards` добавить:

```tsx
function ContradictionCards({
  contradictions,
}: {
  contradictions: AnalysisResult['contradictions']
}) {
  if (contradictions.length === 0) {
    return (
      <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-4 text-sm font-medium text-green-700">
        Явных противоречий не выявлено.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {contradictions.map((item) => (
        <article key={item.id} className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
            {item.category === 'logical' ? 'Логическое противоречие' : 'Числовое противоречие'}
          </p>
          <h4 className="mt-1 font-semibold text-slate-900">{item.title}</h4>
          <p className="mt-1 text-sm text-slate-700">{item.explanation}</p>
          <blockquote className="mt-3 border-l-2 border-rose-300 pl-3 text-sm text-slate-700">
            {item.quotes[0]}
          </blockquote>
          <blockquote className="mt-2 border-l-2 border-rose-300 pl-3 text-sm text-slate-700">
            {item.quotes[1]}
          </blockquote>
        </article>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Добавить статистику и секцию результата**

Изменить сетку статистики на `sm:grid-cols-3 lg:grid-cols-6`, добавить карточку:

```tsx
<StatCard
  label="Противоречий"
  value={result.contradictions.length}
  color="border-rose-200 bg-rose-50"
/>
```

Перед секцией «Пробелы и вопросы для уточнения» добавить:

```tsx
<section className="mb-8">
  <h3 className="mb-3 text-lg font-semibold text-slate-800">Противоречия в требованиях</h3>
  <ContradictionCards contradictions={result.contradictions} />
</section>
```

- [ ] **Step 5: Обновить отображаемые стадии анализа**

В `src/components/AnalyzingStep.tsx` вставить строку `'Проверка противоречий'` после `'Выделение реквизитов'` и перед `'Проверка пробелов в требованиях'`.

- [ ] **Step 6: Запустить UI-тест и production-сборку**

Run: `pnpm exec tsx --test src/components/analysisResults.test.ts`

Expected: PASS для обоих UI-тестов.

Run: `pnpm run build`

Expected: клиентская и серверная TypeScript-проверки и Vite build завершаются успешно, без ошибок.

- [ ] **Step 7: Зафиксировать интерфейс**

```bash
git add src/components/ResultsStep.tsx src/components/AnalyzingStep.tsx src/components/analysisResults.test.ts
git commit -m "feat: show contradictions in analysis results"
```

### Task 5: Полная проверка поведения

**Files:**
- Verify only; production-файлы не изменять без нового падающего регрессионного теста.

**Interfaces:**
- Consumes: все результаты Tasks 1–4.
- Produces: подтверждение прохождения тестов, сборки и ручных сценариев.

- [ ] **Step 1: Запустить полный набор автоматических тестов**

Run: `pnpm test`

Expected: все существующие и новые тесты PASS; процесс завершается с кодом 0 без ошибок и предупреждений.

- [ ] **Step 2: Запустить production-сборку**

Run: `pnpm run build`

Expected: `tsc`, Vite и серверная компиляция завершаются с кодом 0.

- [ ] **Step 3: Выполнить ручную проверку ключевых сценариев**

Запустить приложение командой `pnpm dev` и проверить:

1. `Поле «Скидка» обязательное. Поле «Скидка» необязательное.` — одна логическая карточка с двумя цитатами.
2. `Хранить журнал 30 дней. Хранить журнал 60 дней.` — одна числовая карточка.
3. `Поле «Скидка» обязательное. Поле «Комментарий» необязательное.` — зелёное пустое состояние.
4. Скачанный/скопированный Markdown содержит тот же набор конфликтов.
5. Старая запись истории без поля `contradictions`, если она доступна в локальной базе, открывается без ошибки и показывает пустое состояние.

- [ ] **Step 4: Проверить чистоту целевого diff**

Run: `git diff --check`

Expected: нет ошибок пробелов.

Run: `git status --short`

Expected: только ожидаемые изменения задачи; существующие несвязанные пользовательские файлы не добавлены и не изменены.
