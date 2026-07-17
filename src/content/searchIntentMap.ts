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
    canonicalArticle: '/news/kakie-shtrafy-za-ekologiyu-v-kazakhstane',
    supportingLanding: '/shtrafy-za-ekologiyu-kazakhstan',
  },
} as const;
