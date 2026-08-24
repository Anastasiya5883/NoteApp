const metadataNamespace = 'http://v8.1c.ru/8.3/MDClasses'
const coreNamespace = 'http://v8.1c.ru/8.1/data/core'
const xsiNamespace = 'http://www.w3.org/2001/XMLSchema-instance'
const xsNamespace = 'http://www.w3.org/2001/XMLSchema'

function synonym(value: string): string {
  return `<Synonym><v8:item><v8:lang>ru</v8:lang><v8:content>${value}</v8:content></v8:item></Synonym>`
}

function type(value: string): string {
  return `<Type><v8:Type>${value}</v8:Type></Type>`
}

function field(tag: 'Attribute' | 'Dimension' | 'Resource', name: string, title: string, fieldType: string): string {
  return `<${tag} uuid="00000000-0000-0000-0000-000000000001"><Properties><Name>${name}</Name>${synonym(title)}${type(fieldType)}</Properties></${tag}>`
}

function metadataObject(tag: string, name: string, title: string, children = ''): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<MetaDataObject xmlns="${metadataNamespace}" xmlns:v8="${coreNamespace}" xmlns:xsi="${xsiNamespace}" xmlns:xs="${xsNamespace}">
  <${tag} uuid="00000000-0000-0000-0000-000000000002">
    <Properties><Name>${name}</Name>${synonym(title)}</Properties>
    <ChildObjects>${children}</ChildObjects>
  </${tag}>
</MetaDataObject>`
}

export const configurationXml = `<?xml version="1.0" encoding="UTF-8"?>
<MetaDataObject xmlns="${metadataNamespace}" xmlns:v8="${coreNamespace}">
  <Configuration uuid="00000000-0000-0000-0000-000000000000">
    <Properties>
      <Name>TradeManagement</Name>
      ${synonym('Управление торговлей')}
      <Version>11.5.20.100</Version>
    </Properties>
  </Configuration>
</MetaDataObject>`

export const catalogXml = metadataObject(
  'Catalog',
  'Номенклатура',
  'Номенклатура',
  `${field('Attribute', 'Артикул', 'Артикул', 'xs:string')}
   <TabularSection uuid="00000000-0000-0000-0000-000000000003">
     <Properties><Name>Единицы</Name>${synonym('Единицы измерения')}</Properties>
     <ChildObjects>${field('Attribute', 'Коэффициент', 'Коэффициент', 'xs:decimal')}</ChildObjects>
   </TabularSection>`,
)

export const documentXml = metadataObject(
  'Document',
  'ЗаказКлиента',
  'Заказ клиента',
  field('Attribute', 'Комментарий', 'Комментарий', 'xs:string'),
)

export const registerXml = {
  InformationRegister: metadataObject(
    'InformationRegister',
    'ЦеныНоменклатуры',
    'Цены номенклатуры',
    `${field('Dimension', 'Номенклатура', 'Номенклатура', 'cfg:CatalogRef.Номенклатура')}${field('Resource', 'Цена', 'Цена', 'xs:decimal')}${field('Attribute', 'Валюта', 'Валюта', 'cfg:CatalogRef.Валюты')}`,
  ),
  AccumulationRegister: metadataObject(
    'AccumulationRegister',
    'ТоварыНаСкладах',
    'Товары на складах',
    `${field('Dimension', 'Склад', 'Склад', 'cfg:CatalogRef.Склады')}${field('Resource', 'Количество', 'Количество', 'xs:decimal')}${field('Attribute', 'Качество', 'Качество', 'xs:string')}`,
  ),
  AccountingRegister: metadataObject(
    'AccountingRegister',
    'Хозрасчетный',
    'Хозрасчетный',
    `${field('Dimension', 'Организация', 'Организация', 'cfg:CatalogRef.Организации')}${field('Resource', 'Сумма', 'Сумма', 'xs:decimal')}${field('Attribute', 'Содержание', 'Содержание', 'xs:string')}`,
  ),
  CalculationRegister: metadataObject(
    'CalculationRegister',
    'Начисления',
    'Начисления',
    `${field('Dimension', 'Сотрудник', 'Сотрудник', 'cfg:CatalogRef.Сотрудники')}${field('Resource', 'Результат', 'Результат', 'xs:decimal')}${field('Attribute', 'Комментарий', 'Комментарий', 'xs:string')}`,
  ),
} as const

export const simpleObjectXml = {
  Report: metadataObject('Report', 'ВаловаяПрибыль', 'Валовая прибыль'),
  DataProcessor: metadataObject('DataProcessor', 'ЗагрузкаЦен', 'Загрузка цен'),
  Enum: metadataObject('Enum', 'СтатусыЗаказов', 'Статусы заказов'),
  Constant: metadataObject('Constant', 'ОсновнаяВалюта', 'Основная валюта'),
  BusinessProcess: metadataObject('BusinessProcess', 'СогласованиеЗаказа', 'Согласование заказа'),
} as const
