export interface RegionNameForms {
  slug: string;
  city: string;
  regionNominative: string;
  regionGenitive: string;
  regionPrepositional: string;
  cityGenitive?: string;
  cityPrepositional?: string;
}

export const regions: RegionNameForms[] = [
  { slug: 'almaty', city: 'Алматы', regionNominative: 'Алматы и Алматинская область', regionGenitive: 'Алматы и Алматинской области', regionPrepositional: 'Алматы и Алматинской области', cityGenitive: 'Алматы', cityPrepositional: 'Алматы' },
  { slug: 'astana', city: 'Астана', regionNominative: 'Астана и Акмолинская область', regionGenitive: 'Астаны и Акмолинской области', regionPrepositional: 'Астане и Акмолинской области', cityGenitive: 'Астаны', cityPrepositional: 'Астане' },
  { slug: 'shymkent', city: 'Шымкент', regionNominative: 'Шымкент и Туркестанская область', regionGenitive: 'Шымкента и Туркестанской области', regionPrepositional: 'Шымкенте и Туркестанской области', cityGenitive: 'Шымкента', cityPrepositional: 'Шымкенте' },
  { slug: 'taraz', city: 'Тараз', regionNominative: 'Тараз и Жамбылская область', regionGenitive: 'Тараза и Жамбылской области', regionPrepositional: 'Таразе и Жамбылской области', cityGenitive: 'Тараза', cityPrepositional: 'Таразе' },
  { slug: 'turkestan', city: 'Туркестан', regionNominative: 'Туркестан и Туркестанская область', regionGenitive: 'Туркестана и Туркестанской области', regionPrepositional: 'Туркестане и Туркестанской области', cityGenitive: 'Туркестана', cityPrepositional: 'Туркестане' },
  { slug: 'kyzylorda', city: 'Кызылорда', regionNominative: 'Кызылорда и Кызылординская область', regionGenitive: 'Кызылорды и Кызылординской области', regionPrepositional: 'Кызылорде и Кызылординской области', cityGenitive: 'Кызылорды', cityPrepositional: 'Кызылорде' },
  { slug: 'aktobe', city: 'Актобе', regionNominative: 'Актобе и Актюбинская область', regionGenitive: 'Актобе и Актюбинской области', regionPrepositional: 'Актобе и Актюбинской области', cityGenitive: 'Актобе', cityPrepositional: 'Актобе' },
  { slug: 'atyrau', city: 'Атырау', regionNominative: 'Атырау и Атырауская область', regionGenitive: 'Атырау и Атырауской области', regionPrepositional: 'Атырау и Атырауской области', cityGenitive: 'Атырау', cityPrepositional: 'Атырау' },
  { slug: 'karaganda', city: 'Караганда', regionNominative: 'Караганда и Карагандинская область', regionGenitive: 'Караганды и Карагандинской области', regionPrepositional: 'Караганде и Карагандинской области', cityGenitive: 'Караганды', cityPrepositional: 'Караганде' },
  { slug: 'pavlodar', city: 'Павлодар', regionNominative: 'Павлодар и Павлодарская область', regionGenitive: 'Павлодара и Павлодарской области', regionPrepositional: 'Павлодаре и Павлодарской области', cityGenitive: 'Павлодара', cityPrepositional: 'Павлодаре' },
  { slug: 'ust-kamenogorsk', city: 'Усть-Каменогорск', regionNominative: 'Усть-Каменогорск и Восточно-Казахстанская область', regionGenitive: 'Усть-Каменогорска и Восточно-Казахстанской области', regionPrepositional: 'Усть-Каменогорске и Восточно-Казахстанской области', cityGenitive: 'Усть-Каменогорска', cityPrepositional: 'Усть-Каменогорске' },
  { slug: 'kostanay', city: 'Костанай', regionNominative: 'Костанай и Костанайская область', regionGenitive: 'Костаная и Костанайской области', regionPrepositional: 'Костанае и Костанайской области', cityGenitive: 'Костаная', cityPrepositional: 'Костанае' },
  { slug: 'aktau', city: 'Актау', regionNominative: 'Актау и Мангистауская область', regionGenitive: 'Актау и Мангистауской области', regionPrepositional: 'Актау и Мангистауской области', cityGenitive: 'Актау', cityPrepositional: 'Актау' },
  { slug: 'petropavlovsk', city: 'Петропавловск', regionNominative: 'Петропавловск и Северо-Казахстанская область', regionGenitive: 'Петропавловска и Северо-Казахстанской области', regionPrepositional: 'Петропавловске и Северо-Казахстанской области', cityGenitive: 'Петропавловска', cityPrepositional: 'Петропавловске' },
  { slug: 'oral', city: 'Уральск', regionNominative: 'Уральск и Западно-Казахстанская область', regionGenitive: 'Уральска и Западно-Казахстанской области', regionPrepositional: 'Уральске и Западно-Казахстанской области', cityGenitive: 'Уральска', cityPrepositional: 'Уральске' },
  { slug: 'kokshetau', city: 'Кокшетау', regionNominative: 'Кокшетау и Акмолинская область', regionGenitive: 'Кокшетау и Акмолинской области', regionPrepositional: 'Кокшетау и Акмолинской области', cityGenitive: 'Кокшетау', cityPrepositional: 'Кокшетау' },
  { slug: 'taldykorgan', city: 'Талдыкорган', regionNominative: 'Талдыкорган и область Жетісу', regionGenitive: 'Талдыкоргана и области Жетісу', regionPrepositional: 'Талдыкоргане и области Жетісу', cityGenitive: 'Талдыкоргана', cityPrepositional: 'Талдыкоргане' },
  { slug: 'semey', city: 'Семей', regionNominative: 'Семей и область Абай', regionGenitive: 'Семея и области Абай', regionPrepositional: 'Семее и области Абай', cityGenitive: 'Семея', cityPrepositional: 'Семее' },
];
