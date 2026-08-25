import {
  buildOrganizationSchema,
  buildWebPageSchema,
  buildWebSiteSchema,
  entityIds,
} from './entityBuilders.ts';

type SchemaNode = Record<string, unknown>;

const withoutContext = (node: SchemaNode): SchemaNode => {
  const { '@context': _context, ...rest } = node;
  return rest;
};

export const createSchemaGraph = (
  schema: SchemaNode | SchemaNode[] | undefined,
  canonical: string,
): { '@context': 'https://schema.org'; '@graph': SchemaNode[] } => {
  const ids = entityIds(canonical);
  const input = (Array.isArray(schema) ? schema : schema ? [schema] : []).map(withoutContext);
  let personIndex = 0;
  const graph = input.map((node) => {
    const type = typeof node['@type'] === 'string' ? node['@type'] : '';
    const id = typeof node['@id'] === 'string'
      ? node['@id']
      : type === 'Person'
        ? `${canonical}${++personIndex === 1 ? '#person' : `#person-${personIndex}`}`
        : type === 'Organization' ? ids.organization
          : type === 'WebSite' ? ids.website
            : type === 'WebPage' ? ids.webpage
              : type === 'Service' ? ids.service
                : type === 'Article' ? ids.article
                  : type === 'BreadcrumbList' ? ids.breadcrumb
                    : type === 'FAQPage' ? `${canonical}#faq`
                      : undefined;
    return id ? { ...node, '@id': id } : node;
  });

  const organizationId = ids.organization;
  const websiteId = ids.website;
  const webpageId = ids.webpage;
  if (!graph.some((node) => node['@type'] === 'Organization')) {
    graph.unshift(withoutContext(buildOrganizationSchema()));
  } else {
    const organization = graph.find((node) => node['@type'] === 'Organization');
    if (organization) organization['@id'] = organizationId;
  }
  if (!graph.some((node) => node['@type'] === 'WebSite')) {
    graph.push(withoutContext(buildWebSiteSchema()));
  } else {
    const website = graph.find((node) => node['@type'] === 'WebSite');
    if (website) website['@id'] = websiteId;
  }
  if (!graph.some((node) => node['@type'] === 'WebPage')) {
    graph.push(withoutContext(buildWebPageSchema({ canonical, name: canonical })));
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
