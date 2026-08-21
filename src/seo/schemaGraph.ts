type SchemaNode = Record<string, unknown>;

const typeId: Record<string, string> = {
  Organization: '#organization',
  WebSite: '#website',
  WebPage: '#webpage',
  Service: '#service',
  Article: '#article',
  BreadcrumbList: '#breadcrumb',
  FAQPage: '#faq',
};

const withoutContext = (node: SchemaNode): SchemaNode => {
  const { '@context': _context, ...rest } = node;
  return rest;
};

export const createSchemaGraph = (
  schema: SchemaNode | SchemaNode[] | undefined,
  canonical: string,
): { '@context': 'https://schema.org'; '@graph': SchemaNode[] } => {
  const origin = new URL(canonical).origin;
  const input = (Array.isArray(schema) ? schema : schema ? [schema] : []).map(withoutContext);
  let personIndex = 0;
  const graph = input.map((node) => {
    const type = typeof node['@type'] === 'string' ? node['@type'] : '';
    const id = typeof node['@id'] === 'string'
      ? node['@id']
      : type === 'Person'
        ? `${canonical}${++personIndex === 1 ? '#person' : `#person-${personIndex}`}`
        : typeId[type]
          ? `${canonical}${typeId[type]}`
          : undefined;
    return id ? { ...node, '@id': id } : node;
  });

  const organizationId = `${origin}/#organization`;
  const websiteId = `${origin}/#website`;
  const webpageId = `${canonical}#webpage`;
  if (!graph.some((node) => node['@type'] === 'Organization')) {
    graph.unshift({ '@type': 'Organization', '@id': organizationId, name: 'ECOPROGRESS GROUP', url: origin });
  } else {
    const organization = graph.find((node) => node['@type'] === 'Organization');
    if (organization) organization['@id'] = organizationId;
  }
  if (!graph.some((node) => node['@type'] === 'WebSite')) {
    graph.push({ '@type': 'WebSite', '@id': websiteId, name: 'ECOPROGRESS', url: origin, publisher: { '@id': organizationId } });
  } else {
    const website = graph.find((node) => node['@type'] === 'WebSite');
    if (website) website['@id'] = websiteId;
  }
  if (!graph.some((node) => node['@type'] === 'WebPage')) {
    graph.push({ '@type': 'WebPage', '@id': webpageId, url: canonical, isPartOf: { '@id': websiteId } });
  }

  for (const node of graph) {
    if (node['@type'] === 'Article') {
      node.mainEntityOfPage = { '@id': webpageId };
      node.publisher = { '@id': organizationId };
    }
    if (node['@type'] === 'Service') node.provider = { '@id': organizationId };
  }

  return { '@context': 'https://schema.org', '@graph': graph };
};
