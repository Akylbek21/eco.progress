export const articleSlugAliases: Record<string, string> = {
  'kakie-shtrafy-za-ekologiyu-v-kazakhstane': 'shtrafy-za-ekologicheskie-narusheniya',
  'komu-nuzhen-proizvodstvennyy-kontrol-ses': 'chto-takoe-proizvodstvennyy-ekologicheskiy-kontrol',
  'kak-poluchit-razreshenie-na-emissii': 'ekologicheskie-dokumenty-too-kazakhstan',
  'chto-takoe-pasport-othodov': 'dokumenty-peredachi-othodov',
  'kakie-dokumenty-proveryaet-ses': 'podgotovka-k-ekologicheskoy-proverke',
  'ekologicheskoe-soprovozhdenie-biznesa': 'chto-sdavat-po-ekologii-kazhdyy-god',
};

export const normalizeArticleSlug = (slug: string) => articleSlugAliases[slug] ?? slug;
