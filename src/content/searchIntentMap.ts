export const searchIntentMap = {
  environmentalDesign: {
    commercial: '/services/environmental-design',
    category: '/services/ecological-documents',
    regionalPattern: '/roos-:city',
  },
  waste: {
    commercial: '/services/waste-management',
    logistics: '/services/waste-transportation',
    recycling: '/services/waste-recycling',
    regional: '/utilizaciya-othodov-shymkent',
  },
  penalties: {
    canonicalArticle: '/news/shtrafy-za-ekologicheskie-narusheniya',
    supportingLanding: '/news/shtrafy-za-ekologicheskie-narusheniya',
  },
} as const;
