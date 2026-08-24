import type { FoundAttribute, FoundEntity } from './analyzer'
import type {
  ConfigurationAttribute,
  ConfigurationCatalog,
  ConfigurationObject,
  MetadataCheck,
} from './configurationCatalogTypes'
import { ERP_26116_REFERENCE } from './erp26116Reference'

const SIMILARITY_THRESHOLD = 0.86

interface ObjectMatch {
  object: ConfigurationObject
  exact: boolean
}

interface AttributeMatch {
  attribute: ConfigurationAttribute
  path: string
  exact: boolean
}

export function normalizeMetadataName(value: string): string {
  return value
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/[\s_-]/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
}

function levenshtein(left: string, right: string): number {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let previous = row[0]
    row[0] = leftIndex
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const current = row[rightIndex]
      row[rightIndex] = Math.min(
        row[rightIndex] + 1,
        row[rightIndex - 1] + 1,
        previous + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      )
      previous = current
    }
  }
  return row[right.length]
}

function similarity(left: string, right: string): number {
  if (!left && !right) return 1
  if (!left || !right) return 0
  return 1 - levenshtein(left, right) / Math.max(left.length, right.length)
}

function namesOf(item: { name: string; synonym: string | null }): string[] {
  return [item.name, item.synonym].filter((name): name is string => Boolean(name))
}

function bestNameMatch<T extends { name: string; synonym: string | null }>(
  requestedName: string,
  candidates: T[],
): { item: T; exact: boolean } | null {
  const normalizedRequested = normalizeMetadataName(requestedName)
  for (const candidate of candidates) {
    if (namesOf(candidate).some((name) => normalizeMetadataName(name) === normalizedRequested)) {
      return { item: candidate, exact: true }
    }
  }

  let best: { item: T; score: number } | null = null
  for (const candidate of candidates) {
    for (const name of namesOf(candidate)) {
      const score = similarity(normalizedRequested, normalizeMetadataName(name))
      if (!best || score > best.score) best = { item: candidate, score }
    }
  }
  return best && best.score >= SIMILARITY_THRESHOLD ? { item: best.item, exact: false } : null
}

function findObject(catalog: ConfigurationCatalog, requestedName: string): ObjectMatch | null {
  const matched = bestNameMatch(requestedName, catalog.objects)
  return matched ? { object: matched.item, exact: matched.exact } : null
}

function findAttribute(object: ConfigurationObject, requestedName: string): AttributeMatch | null {
  const direct = bestNameMatch(requestedName, object.attributes)
  const tablePartCandidates = object.tableParts.flatMap((part) =>
    part.attributes.map((attribute) => ({
      attribute,
      name: `${part.name}.${attribute.name}`,
      synonym: part.synonym && attribute.synonym
        ? `${part.synonym}.${attribute.synonym}`
        : part.synonym
          ? `${part.synonym}.${attribute.name}`
          : attribute.synonym
            ? `${part.name}.${attribute.synonym}`
            : null,
      path: `${object.name}.${part.name}.${attribute.name}`,
    })),
  )
  const tablePart = bestNameMatch(requestedName, tablePartCandidates)

  if (!direct && !tablePart) return null
  if (direct && (!tablePart || direct.exact || !tablePart.exact)) {
    return { attribute: direct.item, path: direct.item.name, exact: direct.exact }
  }
  return {
    attribute: tablePart!.item.attribute,
    path: tablePart!.item.path,
    exact: tablePart!.exact,
  }
}

function contextsAssociate(entity: FoundEntity, attribute: FoundAttribute): boolean {
  const entityContext = normalizeMetadataName(entity.context)
  const attributeContext = normalizeMetadataName(attribute.context)
  return Boolean(entityContext && attributeContext)
    && (entityContext === attributeContext
      || entityContext.includes(attributeContext)
      || attributeContext.includes(entityContext))
}

function status(source: ConfigurationCatalog['catalogKind'], exact: boolean): MetadataCheck['status'] {
  return source === 'local'
    ? exact ? 'local-exact' : 'local-similar'
    : exact ? 'erp-reference-exact' : 'erp-reference-similar'
}

function missingCheck(
  entity: FoundEntity,
  requestedAttribute: FoundAttribute | null,
  objectMatch: ObjectMatch | null,
  catalog: ConfigurationCatalog,
): MetadataCheck {
  const target = requestedAttribute ? `Реквизит «${requestedAttribute.name}»` : `Объект «${entity.name}»`
  const sourceLabel = catalog.catalogKind === 'local'
    ? 'локальной конфигурации'
    : 'неполном справочном каталоге ERP'
  return {
    requestedObject: entity.name,
    requestedAttribute: requestedAttribute?.name ?? null,
    status: 'missing',
    matchedObject: objectMatch?.object.name ?? null,
    matchedAttribute: null,
    source: objectMatch && catalog.catalogKind === 'local' ? 'local' : null,
    note: `${target} не найден в ${sourceLabel}.`,
  }
}

function matchCheck(
  entity: FoundEntity,
  requestedAttribute: FoundAttribute | null,
  catalog: ConfigurationCatalog,
): MetadataCheck {
  const objectMatch = findObject(catalog, entity.name)
  if (!objectMatch) return missingCheck(entity, requestedAttribute, null, catalog)

  if (!requestedAttribute) {
    return {
      requestedObject: entity.name,
      requestedAttribute: null,
      status: status(catalog.catalogKind, objectMatch.exact),
      matchedObject: objectMatch.object.name,
      matchedAttribute: null,
      source: catalog.catalogKind,
      note: objectMatch.exact ? 'Объект найден по точному совпадению.' : 'Найдено похожее имя объекта; проверьте соответствие.',
    }
  }

  const attributeMatch = findAttribute(objectMatch.object, requestedAttribute.name)
  if (!attributeMatch) return missingCheck(entity, requestedAttribute, objectMatch, catalog)

  return {
    requestedObject: entity.name,
    requestedAttribute: requestedAttribute.name,
    status: status(catalog.catalogKind, objectMatch.exact && attributeMatch.exact),
    matchedObject: objectMatch.object.name,
    matchedAttribute: attributeMatch.path,
    source: catalog.catalogKind,
    note: objectMatch.exact && attributeMatch.exact
      ? 'Объект и реквизит найдены по точному совпадению.'
      : 'Найдено похожее имя; проверьте соответствие.',
  }
}

export function matchAnalysisMetadata(
  entities: FoundEntity[],
  attributes: FoundAttribute[],
  localCatalog: ConfigurationCatalog | null,
): MetadataCheck[] {
  const catalog = localCatalog ?? ERP_26116_REFERENCE
  return entities.flatMap((entity) => {
    const associated = entities.length === 1
      ? attributes
      : attributes.filter((attribute) => contextsAssociate(entity, attribute))
    return associated.length > 0
      ? associated.map((attribute) => matchCheck(entity, attribute, catalog))
      : [matchCheck(entity, null, catalog)]
  })
}
