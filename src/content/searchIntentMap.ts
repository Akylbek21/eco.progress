export const searchIntentMap = {
  environmentalDesign: {
    commercial: '/services/environmental-design',
    category: '/services/ecological-documents',
    regionalPattern: '/ekologicheskoe-proektirovanie-:city',
  },
  waste: {
    commercial: '/services/waste-management',
    logistics: '/services/waste-transportation',
    recycling: '/services/waste-recycling',
    regional: '/utilizaciya-othodov-shymkent',
  },
  penalties: {
    canonicalArticle: '/news/shtrafy-za-ekologicheskie-narusheniya',
    supportingLanding: '/shtrafy-za-ekologiyu-kazakhstan',
  },
} as const;
