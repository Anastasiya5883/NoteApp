import type {
  ConfigurationAttribute,
  ConfigurationCatalog,
  ConfigurationObject,
  ConfigurationTablePart,
} from './configurationCatalogTypes'

const attribute = (name: string): ConfigurationAttribute => ({
  name,
  synonym: null,
  typeDescription: null,
  role: 'attribute',
})

const tablePart = (name: string, attributes: string[]): ConfigurationTablePart => ({
  name,
  synonym: null,
  attributes: attributes.map(attribute),
})

const catalog = (name: string, attributes: string[]): ConfigurationObject => ({
  kind: 'Catalog',
  name,
  synonym: null,
  attributes: attributes.map(attribute),
  tableParts: [],
})

const document = (
  name: string,
  attributes: string[],
  tableParts: Record<string, string[]>,
): ConfigurationObject => ({
  kind: 'Document',
  name,
  synonym: null,
  attributes: attributes.map(attribute),
  tableParts: Object.entries(tableParts).map(([tablePartName, tablePartAttributes]) =>
    tablePart(tablePartName, tablePartAttributes),
  ),
})

export const ERP_26116_REFERENCE: ConfigurationCatalog = {
  catalogKind: 'erp-reference',
  configurationName: 'ERPReference',
  configurationSynonym: 'Справочный каталог 1С:ERP',
  configurationVersion: '2.6.1.16',
  sourceFileName: 'ERP_2.6.1.16_reference',
  uploadedAt: 0,
  sourceNote: 'Неполный справочный каталог распространённых объектов 1С:ERP 2.6.1.16.',
  objects: [
    catalog('Номенклатура', ['Наименование', 'Артикул', 'ВидНоменклатуры', 'ЕдиницаИзмерения']),
    catalog('Контрагенты', ['Наименование', 'ИНН', 'КПП', 'Партнер']),
    catalog('Партнеры', ['Наименование', 'НаименованиеПолное', 'ОсновнойМенеджер']),
    catalog('Организации', ['Наименование', 'ИНН', 'КПП']),
    catalog('Склады', ['Наименование']),
    document('ЗаказКлиента', ['Дата', 'Номер', 'Партнер', 'Контрагент', 'Организация', 'Склад', 'Менеджер', 'Комментарий'], {
      Товары: ['Номенклатура', 'Количество', 'Цена', 'Сумма'],
    }),
    document('РеализацияТоваровУслуг', ['Дата', 'Номер', 'Партнер', 'Контрагент', 'Организация', 'Склад', 'Комментарий'], {
      Товары: ['Номенклатура', 'Количество', 'Цена', 'Сумма'],
    }),
  ],
}
