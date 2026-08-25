export interface RegionNameForms {
  slug: string;
  /** Compatibility display alias; SEO generation must use the explicit grammatical form. */
  readonly city: string;
  cityNominative: string;
  cityGenitive: string;
  cityDative: string;
  cityAccusative: string;
  cityInstrumental: string;
  cityPrepositional: string;
  regionNominative: string;
  regionGenitive: string;
  regionDative: string;
  regionInstrumental: string;
  regionPrepositional: string;
}

type RegionNameFormsInput = Omit<RegionNameForms, 'city'>;
const forms = (value: RegionNameFormsInput): RegionNameForms => ({ ...value, city: value.cityNominative });

export const regions: RegionNameForms[] = [
  forms({ slug: 'almaty', cityNominative: 'Алматы', cityGenitive: 'Алматы', cityDative: 'Алматы', cityAccusative: 'Алматы', cityInstrumental: 'Алматы', cityPrepositional: 'Алматы', regionNominative: 'Алматинская область', regionGenitive: 'Алматинской области', regionDative: 'Алматинской области', regionInstrumental: 'Алматинской областью', regionPrepositional: 'Алматинской области' }),
  forms({ slug: 'astana', cityNominative: 'Астана', cityGenitive: 'Астаны', cityDative: 'Астане', cityAccusative: 'Астану', cityInstrumental: 'Астаной', cityPrepositional: 'Астане', regionNominative: 'Акмолинская область', regionGenitive: 'Акмолинской области', regionDative: 'Акмолинской области', regionInstrumental: 'Акмолинской областью', regionPrepositional: 'Акмолинской области' }),
  forms({ slug: 'shymkent', cityNominative: 'Шымкент', cityGenitive: 'Шымкента', cityDative: 'Шымкенту', cityAccusative: 'Шымкент', cityInstrumental: 'Шымкентом', cityPrepositional: 'Шымкенте', regionNominative: 'Туркестанская область', regionGenitive: 'Туркестанской области', regionDative: 'Туркестанской области', regionInstrumental: 'Туркестанской областью', regionPrepositional: 'Туркестанской области' }),
  forms({ slug: 'taraz', cityNominative: 'Тараз', cityGenitive: 'Тараза', cityDative: 'Таразу', cityAccusative: 'Тараз', cityInstrumental: 'Таразом', cityPrepositional: 'Таразе', regionNominative: 'Жамбылская область', regionGenitive: 'Жамбылской области', regionDative: 'Жамбылской области', regionInstrumental: 'Жамбылской областью', regionPrepositional: 'Жамбылской области' }),
  forms({ slug: 'turkestan', cityNominative: 'Туркестан', cityGenitive: 'Туркестана', cityDative: 'Туркестану', cityAccusative: 'Туркестан', cityInstrumental: 'Туркестаном', cityPrepositional: 'Туркестане', regionNominative: 'Туркестанская область', regionGenitive: 'Туркестанской области', regionDative: 'Туркестанской области', regionInstrumental: 'Туркестанской областью', regionPrepositional: 'Туркестанской области' }),
  forms({ slug: 'kyzylorda', cityNominative: 'Кызылорда', cityGenitive: 'Кызылорды', cityDative: 'Кызылорде', cityAccusative: 'Кызылорду', cityInstrumental: 'Кызылордой', cityPrepositional: 'Кызылорде', regionNominative: 'Кызылординская область', regionGenitive: 'Кызылординской области', regionDative: 'Кызылординской области', regionInstrumental: 'Кызылординской областью', regionPrepositional: 'Кызылординской области' }),
  forms({ slug: 'aktobe', cityNominative: 'Актобе', cityGenitive: 'Актобе', cityDative: 'Актобе', cityAccusative: 'Актобе', cityInstrumental: 'Актобе', cityPrepositional: 'Актобе', regionNominative: 'Актюбинская область', regionGenitive: 'Актюбинской области', regionDative: 'Актюбинской области', regionInstrumental: 'Актюбинской областью', regionPrepositional: 'Актюбинской области' }),
  forms({ slug: 'atyrau', cityNominative: 'Атырау', cityGenitive: 'Атырау', cityDative: 'Атырау', cityAccusative: 'Атырау', cityInstrumental: 'Атырау', cityPrepositional: 'Атырау', regionNominative: 'Атырауская область', regionGenitive: 'Атырауской области', regionDative: 'Атырауской области', regionInstrumental: 'Атырауской областью', regionPrepositional: 'Атырауской области' }),
  forms({ slug: 'karaganda', cityNominative: 'Караганда', cityGenitive: 'Караганды', cityDative: 'Караганде', cityAccusative: 'Караганду', cityInstrumental: 'Карагандой', cityPrepositional: 'Караганде', regionNominative: 'Карагандинская область', regionGenitive: 'Карагандинской области', regionDative: 'Карагандинской области', regionInstrumental: 'Карагандинской областью', regionPrepositional: 'Карагандинской области' }),
  forms({ slug: 'pavlodar', cityNominative: 'Павлодар', cityGenitive: 'Павлодара', cityDative: 'Павлодару', cityAccusative: 'Павлодар', cityInstrumental: 'Павлодаром', cityPrepositional: 'Павлодаре', regionNominative: 'Павлодарская область', regionGenitive: 'Павлодарской области', regionDative: 'Павлодарской области', regionInstrumental: 'Павлодарской областью', regionPrepositional: 'Павлодарской области' }),
  forms({ slug: 'ust-kamenogorsk', cityNominative: 'Усть-Каменогорск', cityGenitive: 'Усть-Каменогорска', cityDative: 'Усть-Каменогорску', cityAccusative: 'Усть-Каменогорск', cityInstrumental: 'Усть-Каменогорском', cityPrepositional: 'Усть-Каменогорске', regionNominative: 'Восточно-Казахстанская область', regionGenitive: 'Восточно-Казахстанской области', regionDative: 'Восточно-Казахстанской области', regionInstrumental: 'Восточно-Казахстанской областью', regionPrepositional: 'Восточно-Казахстанской области' }),
  forms({ slug: 'kostanay', cityNominative: 'Костанай', cityGenitive: 'Костаная', cityDative: 'Костанаю', cityAccusative: 'Костанай', cityInstrumental: 'Костанаем', cityPrepositional: 'Костанае', regionNominative: 'Костанайская область', regionGenitive: 'Костанайской области', regionDative: 'Костанайской области', regionInstrumental: 'Костанайской областью', regionPrepositional: 'Костанайской области' }),
  forms({ slug: 'aktau', cityNominative: 'Актау', cityGenitive: 'Актау', cityDative: 'Актау', cityAccusative: 'Актау', cityInstrumental: 'Актау', cityPrepositional: 'Актау', regionNominative: 'Мангистауская область', regionGenitive: 'Мангистауской области', regionDative: 'Мангистауской области', regionInstrumental: 'Мангистауской областью', regionPrepositional: 'Мангистауской области' }),
  forms({ slug: 'petropavlovsk', cityNominative: 'Петропавловск', cityGenitive: 'Петропавловска', cityDative: 'Петропавловску', cityAccusative: 'Петропавловск', cityInstrumental: 'Петропавловском', cityPrepositional: 'Петропавловске', regionNominative: 'Северо-Казахстанская область', regionGenitive: 'Северо-Казахстанской области', regionDative: 'Северо-Казахстанской области', regionInstrumental: 'Северо-Казахстанской областью', regionPrepositional: 'Северо-Казахстанской области' }),
  forms({ slug: 'oral', cityNominative: 'Уральск', cityGenitive: 'Уральска', cityDative: 'Уральску', cityAccusative: 'Уральск', cityInstrumental: 'Уральском', cityPrepositional: 'Уральске', regionNominative: 'Западно-Казахстанская область', regionGenitive: 'Западно-Казахстанской области', regionDative: 'Западно-Казахстанской области', regionInstrumental: 'Западно-Казахстанской областью', regionPrepositional: 'Западно-Казахстанской области' }),
  forms({ slug: 'kokshetau', cityNominative: 'Кокшетау', cityGenitive: 'Кокшетау', cityDative: 'Кокшетау', cityAccusative: 'Кокшетау', cityInstrumental: 'Кокшетау', cityPrepositional: 'Кокшетау', regionNominative: 'Акмолинская область', regionGenitive: 'Акмолинской области', regionDative: 'Акмолинской области', regionInstrumental: 'Акмолинской областью', regionPrepositional: 'Акмолинской области' }),
  forms({ slug: 'taldykorgan', cityNominative: 'Талдыкорган', cityGenitive: 'Талдыкоргана', cityDative: 'Талдыкоргану', cityAccusative: 'Талдыкорган', cityInstrumental: 'Талдыкорганом', cityPrepositional: 'Талдыкоргане', regionNominative: 'область Жетісу', regionGenitive: 'области Жетісу', regionDative: 'области Жетісу', regionInstrumental: 'областью Жетісу', regionPrepositional: 'области Жетісу' }),
  forms({ slug: 'semey', cityNominative: 'Семей', cityGenitive: 'Семея', cityDative: 'Семею', cityAccusative: 'Семей', cityInstrumental: 'Семеем', cityPrepositional: 'Семее', regionNominative: 'область Абай', regionGenitive: 'области Абай', regionDative: 'области Абай', regionInstrumental: 'областью Абай', regionPrepositional: 'области Абай' }),
];

export const regionNameMap = new Map(regions.map((region) => [region.slug, region]));
