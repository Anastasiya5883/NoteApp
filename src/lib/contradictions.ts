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
  { label: 'обязательность', positive: /обязательн(?:ое|ая|ый|ые|о)?/i, negative: /необязательн(?:ое|ая|ый|ые|о)?/i },
  { label: 'разрешение', positive: /разреш(?:ить|ено|ается|ать)/i, negative: /запрещ(?:ено|ается|ать)|запретить/i },
  { label: 'отображение', positive: /показывать/i, negative: /не\s+показывать/i },
  { label: 'создание', positive: /создавать/i, negative: /не\s+создавать/i },
] as const

const splitSentences = (text: string): string[] =>
  text.split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean)

const normalizeKey = (sentence: string, marker: RegExp): string =>
  sentence.toLocaleLowerCase('ru-RU').replace(marker, ' ').replace(/[«»"“”.,!?;:()]/g, ' ').replace(/\s+/g, ' ').trim()

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
      assertions.push({ key: `${rule.label}:${key}`, polarity: negative ? 'negative' : 'positive', quote, index, label: rule.label })
      break
    }
  })
  return assertions
}

interface NumericAssertion { key: string; value: number; displayValue: string; quote: string; index: number }
const UNIT_GROUPS: Array<{ normalized: string; pattern: string }> = [
  { normalized: 'day', pattern: 'д(?:ень|ня|ней)|сут(?:ки|ок)' },
  { normalized: 'hour', pattern: 'час(?:а|ов)?' },
  { normalized: 'minute', pattern: 'минут(?:а|ы)?' },
  { normalized: 'second', pattern: 'секунд(?:а|ы)?' },
  { normalized: 'piece', pattern: 'шт(?:ук(?:а|и)?)?\\.?' },
  { normalized: 'ruble', pattern: 'руб(?:ль|ля|лей)?\\.?|₽' },
  { normalized: 'percent', pattern: '%|процент(?:а|ов)?' },
]
const NUMBER_WITH_UNIT = new RegExp(`\\b(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_GROUPS.map((unit) => unit.pattern).join('|')})(?=$|\\s|[.,;:!?])`, 'giu')

interface PositionedContradiction extends Contradiction { firstIndex: number; secondIndex: number }
function stableId(category: ContradictionCategory, quotes: [string, string]): string {
  const input = `${category}\u0000${quotes[0]}\u0000${quotes[1]}`
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) { hash ^= input.charCodeAt(index); hash = Math.imul(hash, 0x01000193) }
  return `contradiction-${category}-${(hash >>> 0).toString(16)}`
}

function findLogicalContradictions(sentences: string[]): PositionedContradiction[] {
  const assertions = extractLogicalAssertions(sentences)
  const results: PositionedContradiction[] = []
  for (let first = 0; first < assertions.length; first += 1) for (let second = first + 1; second < assertions.length; second += 1) {
    const left = assertions[first]; const right = assertions[second]
    if (left.key !== right.key || left.polarity === right.polarity) continue
    const quotes: [string, string] = [left.quote, right.quote]
    results.push({ id: stableId('logical', quotes), category: 'logical', severity: 'critical', title: 'Взаимоисключающие требования', explanation: `Для одного предмета одновременно заданы противоположные требования (${left.label}).`, quotes, firstIndex: left.index, secondIndex: right.index })
  }
  return results
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
function normalizeUnit(raw: string): string | null { return UNIT_GROUPS.find((unit) => new RegExp(`^(?:${unit.pattern})$`, 'iu').test(raw))?.normalized ?? null }
function extractNumericAssertions(sentences: string[]): NumericAssertion[] {
  const assertions: NumericAssertion[] = []
  sentences.forEach((quote, index) => { for (const match of quote.matchAll(NUMBER_WITH_UNIT)) {
    const unit = normalizeUnit(match[2]); if (!unit) continue
    const value = Number(match[1].replace(',', '.')); if (!Number.isFinite(value)) continue
    const context = normalizeKey(quote, new RegExp(escapeRegExp(match[0]), 'iu')); if (context.split(' ').length < 2) continue
    assertions.push({ key: `${unit}:${context}`, value, displayValue: match[0], quote, index })
  } })
  return assertions
}
function findNumericContradictions(sentences: string[]): PositionedContradiction[] {
  const assertions = extractNumericAssertions(sentences); const results: PositionedContradiction[] = []
  for (let first = 0; first < assertions.length; first += 1) for (let second = first + 1; second < assertions.length; second += 1) {
    const left = assertions[first]; const right = assertions[second]; if (left.key !== right.key || left.value === right.value) continue
    const quotes: [string, string] = [left.quote, right.quote]
    results.push({ id: stableId('numeric', quotes), category: 'numeric', severity: 'warning', title: 'Разные значения одного параметра', explanation: `Для одного параметра указаны разные значения: ${left.displayValue} и ${right.displayValue}.`, quotes, firstIndex: left.index, secondIndex: right.index })
  }
  return results
}
function finalize(results: PositionedContradiction[]): Contradiction[] {
  const seen = new Set<string>()
  return results.sort((left, right) => left.firstIndex - right.firstIndex || left.secondIndex - right.secondIndex).filter((item) => { const key = `${item.category}\u0000${item.quotes[0]}\u0000${item.quotes[1]}`; if (seen.has(key)) return false; seen.add(key); return true }).map(({ firstIndex: _first, secondIndex: _second, ...item }) => item)
}
export function findContradictions(text: string): Contradiction[] {
  const sentences = splitSentences(text)
  return finalize([...findLogicalContradictions(sentences), ...findNumericContradictions(sentences)])
}
