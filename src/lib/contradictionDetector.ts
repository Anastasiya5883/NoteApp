export type ContradictionCategory = 'logical' | 'numeric'

export interface Contradiction {
  id: string
  category: ContradictionCategory
  severity: 'warning'
  title: string
  description: string
  quotes: [string, string]
}

interface LogicalStatement {
  subject: string
  scope: string
  family: string
  polarity: boolean
  quote: string
  index: number
}

interface NumericStatement {
  subject: string
  value: number
  unit: string
  quote: string
  index: number
}

const LOGICAL_PATTERNS: Array<{ family: string; polarity: boolean; pattern: RegExp }> = [
  { family: 'required', polarity: false, pattern: /(?:необязатель[\p{L}]*|не\s+обязатель[\p{L}]*)/iu },
  { family: 'required', polarity: true, pattern: /обязатель[\p{L}]*/iu },
  { family: 'visible', polarity: false, pattern: /не\s+(?:показывать|отображать|выводить)/iu },
  { family: 'visible', polarity: true, pattern: /(?:показывать|отображать|выводить)/iu },
  { family: 'created', polarity: false, pattern: /не\s+(?:создавать|формировать)/iu },
  { family: 'created', polarity: true, pattern: /(?:создавать|формировать)/iu },
  { family: 'allowed', polarity: false, pattern: /(?:запретить|запрещено|нельзя)/iu },
  { family: 'allowed', polarity: true, pattern: /(?:разрешить|разрешено|можно)/iu },
]

const UNIT_PATTERN = '(?:дн(?:ей|я|ь)?|час(?:ов|а)?|минут(?:ы|а)?|секунд(?:ы|а)?|мб|мегабайт(?:а|ов)?|гб|гигабайт(?:а|ов)?|%|процент(?:а|ов)?)'

function splitSentences(text: string): Array<{ quote: string; index: number }> {
  const sentences: Array<{ quote: string; index: number }> = []
  const pattern = /[^.!?\n]+(?:[.!?]+|$)/g
  for (const match of text.matchAll(pattern)) {
    const quote = match[0].trim()
    if (quote) sentences.push({ quote, index: match.index ?? 0 })
  }
  return sentences
}

function quotedSubject(sentence: string): string | null {
  const match = sentence.match(/[\u00ab\"]([^\u00bb\"]+)[\u00bb\"]/) 
  return match ? match[1].trim().toLocaleLowerCase('ru-RU') : null
}

function logicalSubject(sentence: string, pattern: RegExp): string | null {
  const quoted = quotedSubject(sentence)
  if (quoted) return quoted
  const normalized = sentence
    .toLocaleLowerCase('ru-RU')
    .replace(pattern, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
  return normalized.length >= 3 ? normalized : null
}

function logicalScope(sentence: string): string {
  const lower = sentence.toLocaleLowerCase('ru-RU')
  const scopes: string[] = []
  const location = lower.match(/(?:в|на)\s+((?:форме|форму|карточке|карточку|списке|список|отч[её]те|этапе|интерфейсе)(?:\s+\p{L}+)*)/iu)
  if (location) scopes.push(location[1])
  const role = lower.match(/для\s+(?!заполнения)(\p{L}+)/iu)
  if (role) scopes.push(`для ${role[1]}`)
  return scopes.join('|')
}

function normalizeUnit(unit: string): string {
  const lower = unit.toLocaleLowerCase('ru-RU')
  if (lower.startsWith('дн')) return 'день'
  if (lower.startsWith('час')) return 'час'
  if (lower.startsWith('минут')) return 'минута'
  if (lower.startsWith('секунд')) return 'секунда'
  if (lower === 'мб' || lower.startsWith('мегабайт')) return 'мб'
  if (lower === 'гб' || lower.startsWith('гигабайт')) return 'гб'
  return '%'
}

function numericStatement(sentence: string, index: number): NumericStatement | null {
  const pattern = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_PATTERN})`, 'i')
  const match = sentence.match(pattern)
  if (!match) return null
  const subject = sentence
    .toLocaleLowerCase('ru-RU')
    .replace(pattern, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
  if (subject.length < 3) return null
  return {
    subject,
    value: Number(match[1].replace(',', '.')),
    unit: normalizeUnit(match[2]),
    quote: sentence,
    index,
  }
}

export function detectContradictions(text: string): Contradiction[] {
  const logical: LogicalStatement[] = []
  const numeric: NumericStatement[] = []

  for (const sentence of splitSentences(text)) {
    for (const definition of LOGICAL_PATTERNS) {
      if (!definition.pattern.test(sentence.quote)) continue
      const subject = logicalSubject(sentence.quote, definition.pattern)
      if (subject) {
        logical.push({
          subject,
          scope: logicalScope(sentence.quote),
          family: definition.family,
          polarity: definition.polarity,
          quote: sentence.quote,
          index: sentence.index,
        })
      }
      break
    }
    const number = numericStatement(sentence.quote, sentence.index)
    if (number) numeric.push(number)
  }

  const found: Array<Contradiction & { index: number }> = []
  const seen = new Set<string>()

  for (let left = 0; left < logical.length; left += 1) {
    for (let right = left + 1; right < logical.length; right += 1) {
      const a = logical[left]
      const b = logical[right]
      if (a.subject !== b.subject || a.family !== b.family || a.polarity === b.polarity) continue
      if ((a.scope || b.scope) && a.scope !== b.scope) continue
      const key = `logical:${a.index}:${b.index}`
      if (seen.has(key)) continue
      seen.add(key)
      found.push({
        id: key,
        category: 'logical',
        severity: 'warning',
        title: 'Противоположные требования',
        description: 'Один и тот же элемент описан взаимоисключающими правилами.',
        quotes: [a.quote, b.quote],
        index: a.index,
      })
    }
  }

  for (let left = 0; left < numeric.length; left += 1) {
    for (let right = left + 1; right < numeric.length; right += 1) {
      const a = numeric[left]
      const b = numeric[right]
      if (a.subject !== b.subject || a.unit !== b.unit || a.value === b.value) continue
      const key = `numeric:${a.index}:${b.index}`
      if (seen.has(key)) continue
      seen.add(key)
      found.push({
        id: key,
        category: 'numeric',
        severity: 'warning',
        title: 'Разные числовые значения',
        description: `Для одного и того же требования указаны значения ${a.value} и ${b.value} ${a.unit}.`,
        quotes: [a.quote, b.quote],
        index: a.index,
      })
    }
  }

  return found.sort((a, b) => a.index - b.index).map(({ index: _index, ...item }) => item)
}
