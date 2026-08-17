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

const ABBREVIATION_BEFORE_PERIOD = /(?:^|\s)(?:руб|шт)$/iu

function splitSentences(text: string): string[] {
  const sentences: string[] = []
  let start = 0
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (!'.!?'.includes(character)) continue
    if (index + 1 < text.length && !/\s/u.test(text[index + 1])) continue

    const abbreviationStart = Math.max(start, index - 4)
    if (character === '.' && ABBREVIATION_BEFORE_PERIOD.test(text.slice(abbreviationStart, index))) {
      let nextIndex = index + 1
      while (nextIndex < text.length && /\s/u.test(text[nextIndex])) nextIndex += 1
      const nextCharacter = text[nextIndex]
      if (nextCharacter && !/\p{Lu}/u.test(nextCharacter)) continue
    }

    const sentence = text.slice(start, index + 1).trim()
    if (sentence) sentences.push(sentence)
    start = index + 1
  }

  const remainder = text.slice(start).trim()
  if (remainder) sentences.push(remainder)
  return sentences
}

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
const NUMERIC_BOUND_MARKER = /(?:^|[\s(,;:])(?:не\s+(?:более|менее|больше|меньше)|до|от|(?:как\s+)?(?:минимум|максимум)|минимальн(?:ый|ая|ое|ые|ого|ой|ую|ых|ым|ыми)?|максимальн(?:ый|ая|ое|ые|ого|ой|ую|ых|ым|ыми)?)(?=$|[\s),.;:!?])/iu
const NUMERIC_RANGE = /\d+(?:[.,]\d+)?\s*[-–—]\s*\d+(?:[.,]\d+)?/u

interface PositionedContradiction extends Contradiction { firstIndex: number; secondIndex: number }
function canonicalPairKey(category: ContradictionCategory, quotes: [string, string]): string {
  const ordered = quotes[0] <= quotes[1] ? quotes : [quotes[1], quotes[0]]
  return `${category}\u0000${ordered[0]}\u0000${ordered[1]}`
}

function stableId(category: ContradictionCategory, quotes: [string, string]): string {
  const input = canonicalPairKey(category, quotes)
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) { hash ^= input.charCodeAt(index); hash = Math.imul(hash, 0x01000193) }
  return `contradiction-${category}-${(hash >>> 0).toString(16)}`
}

function groupUniqueAssertions<T extends { key: string }>(
  assertions: T[],
  equivalenceKey: (assertion: T) => string,
): T[][] {
  const groups = new Map<string, Map<string, T>>()
  for (const assertion of assertions) {
    let group = groups.get(assertion.key)
    if (!group) {
      group = new Map<string, T>()
      groups.set(assertion.key, group)
    }
    const identity = equivalenceKey(assertion)
    if (!group.has(identity)) group.set(identity, assertion)
  }
  return [...groups.values()].map((group) => [...group.values()])
}

function addUniqueResult(
  results: Map<string, PositionedContradiction>,
  result: PositionedContradiction,
): void {
  const key = canonicalPairKey(result.category, result.quotes)
  if (!results.has(key)) results.set(key, result)
}

function findLogicalContradictions(sentences: string[]): PositionedContradiction[] {
  const groups = groupUniqueAssertions(extractLogicalAssertions(sentences), (assertion) => assertion.polarity)
  const results = new Map<string, PositionedContradiction>()
  for (const assertions of groups) {
    for (let first = 0; first < assertions.length; first += 1) {
      for (let second = first + 1; second < assertions.length; second += 1) {
        const left = assertions[first]
        const right = assertions[second]
        if (left.polarity === right.polarity) continue
        const ordered = left.index <= right.index ? [left, right] : [right, left]
        const quotes: [string, string] = [ordered[0].quote, ordered[1].quote]
        addUniqueResult(results, {
          id: stableId('logical', quotes),
          category: 'logical',
          severity: 'critical',
          title: 'Взаимоисключающие требования',
          explanation: `Для одного предмета одновременно заданы противоположные требования (${left.label}).`,
          quotes,
          firstIndex: ordered[0].index,
          secondIndex: ordered[1].index,
        })
      }
    }
  }
  return [...results.values()]
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
function normalizeUnit(raw: string): string | null { return UNIT_GROUPS.find((unit) => new RegExp(`^(?:${unit.pattern})$`, 'iu').test(raw))?.normalized ?? null }
function extractNumericAssertions(sentences: string[]): NumericAssertion[] {
  const assertions: NumericAssertion[] = []
  sentences.forEach((quote, index) => {
    if (NUMERIC_BOUND_MARKER.test(quote) || NUMERIC_RANGE.test(quote)) return
    for (const match of quote.matchAll(NUMBER_WITH_UNIT)) {
      const unit = normalizeUnit(match[2]); if (!unit) continue
      const value = Number(match[1].replace(',', '.')); if (!Number.isFinite(value)) continue
      const context = normalizeKey(quote, new RegExp(escapeRegExp(match[0]), 'iu')); if (context.split(' ').length < 2) continue
      assertions.push({ key: `${unit}:${context}`, value, displayValue: match[0], quote, index })
    }
  })
  return assertions
}
function findNumericContradictions(sentences: string[]): PositionedContradiction[] {
  const groups = groupUniqueAssertions(extractNumericAssertions(sentences), (assertion) => String(assertion.value))
  const results = new Map<string, PositionedContradiction>()
  for (const assertions of groups) {
    for (let first = 0; first < assertions.length; first += 1) {
      for (let second = first + 1; second < assertions.length; second += 1) {
        const left = assertions[first]
        const right = assertions[second]
        if (left.value === right.value) continue
        const ordered = left.index <= right.index ? [left, right] : [right, left]
        const quotes: [string, string] = [ordered[0].quote, ordered[1].quote]
        const finalPunctuation = ordered[1].displayValue.endsWith('.') ? '' : '.'
        addUniqueResult(results, {
          id: stableId('numeric', quotes),
          category: 'numeric',
          severity: 'warning',
          title: 'Разные значения одного параметра',
          explanation: `Для одного параметра указаны разные значения: ${ordered[0].displayValue} и ${ordered[1].displayValue}${finalPunctuation}`,
          quotes,
          firstIndex: ordered[0].index,
          secondIndex: ordered[1].index,
        })
      }
    }
  }
  return [...results.values()]
}
function finalize(results: PositionedContradiction[]): Contradiction[] {
  return results.sort((left, right) => left.firstIndex - right.firstIndex || left.secondIndex - right.secondIndex).map(({ firstIndex: _first, secondIndex: _second, ...item }) => item)
}
export function findContradictions(text: string): Contradiction[] {
  const sentences = splitSentences(text)
  return finalize([...findLogicalContradictions(sentences), ...findNumericContradictions(sentences)])
}
