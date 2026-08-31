# SEO and CMS publication contract

The Vite application uses rebuild-on-publish. The backend must call the
deployment provider's authenticated build hook after an entity enters
`PUBLISHED`, or after an already published entity changes.

Publication flow:

1. Save and validate the entity in the backend.
2. Change its status to `PUBLISHED`.
3. Call the private frontend deployment webhook.
4. The deployment runs `npm ci`, `npm run build:seo`.
5. The build loads the current content snapshot, generates the unified SEO
   registry, sitemap and route HTML, runs tests/audit, then deploys atomically.
6. A failed audit must keep the previous production version active.

Expected public API entity:

```json
{
  "slug": "string",
  "title": "string",
  "seoTitle": "string",
  "seoDescription": "string",
  "canonicalUrl": "string",
  "status": "DRAFT | REVIEW | PUBLISHED",
  "publishedAt": "ISO_DATE",
  "updatedAt": "ISO_DATE",
  "author": {
    "name": "string",
    "role": "string",
    "profileUrl": "string"
  },
  "reviewer": {
    "name": "string",
    "role": "string",
    "reviewedAt": "ISO_DATE"
  },
  "mainImage": {
    "url": "absolute HTTPS URL",
    "alt": "string",
    "width": 1200,
    "height": 630
  },
  "robots": "index,follow"
}
```

Only `PUBLISHED` entities with a non-empty title, description, body, canonical,
image alt, author and valid dates may enter the sitemap. Legal or regulatory
articles additionally require a named reviewer and `reviewedAt`; otherwise
their generated route remains `noindex,follow`.

The backend must return `updatedAt` unchanged until content actually changes.
It must not produce canonical hosts other than `https://ecoprogress.kz`, query
parameters, fragments, `www`, or trailing slashes.

Required deployment secrets:

- `FRONTEND_BUILD_HOOK_URL` — stored only on the backend.
- `VITE_API_URL` — public API base path, normally `/api`.
- `SEO_CONTENT_API_URL` — build-only endpoint returning `{ experts, cases, articleReviews }` (or the same object under `data`).
- `SEO_CONTENT_API_TOKEN` — optional bearer token for the private build-time endpoint.
- `VITE_COMPANY_EMAIL`, `VITE_COMPANY_STREET`, `VITE_COMPANY_POSTAL_CODE` —
  confirmed organization data.

`npm run build` first runs `seo:content:sync`. With `SEO_CONTENT_API_URL` configured,
the build downloads the current article review decisions and confirmed cases before generating the SEO registry,
sitemap and prerendered HTML. Without the endpoint it retains the committed fail-closed
snapshots, so no article or case can become indexable accidentally. Invalid or duplicate CMS
records fail the build before the previous snapshots are overwritten.

`articleReviews` contains only review decisions confirmed in the CMS. The DTO uses
`articleSlug`, `expertId`, `status`, `reviewedAt` and `updatedAt`. Backend `APPROVED`
is normalized to `approved` only when `expertId` and a valid `reviewedAt` are present.
The expert must also resolve to a complete public expert profile. Static article copy
remains `requires-specialist-review` until that record arrives; frontend code and a
manually edited robots field cannot promote it.

The backend workflow is `DRAFT -> REQUIRES_REVIEW -> APPROVED`. Approval must persist
the authenticated specialist as `expertId`, set `reviewedAt`, publish the updated public
snapshot and trigger the frontend build hook. The generated registry then sets
`robots=index,follow` and includes the article in `sitemap.xml` in the same deployment.

## Confirmed case workflow

Cases use `DRAFT -> REQUIRES_REVIEW -> APPROVED -> PUBLISHED`. A case is eligible for
SSR, schema and sitemap only when `published=true`, `reviewStatus=APPROVED`, `publishedAt`
and `reviewedAt` are valid, and both `expertId` and `reviewerId` resolve to public VERIFIED
experts. The CMS record must include the task, initial data, performed stages, result,
duration, completion date, applicable regulations and an explicit client anonymity choice.
It must also provide at least one structured, verified project metric as
`metrics: [{ "label": "Источники", "value": "17" }]`; metrics are rendered as facts,
not inferred from marketing copy.

The build stores eligible records in `src/data/caseStudies.generated.json`. Runtime API
responses pass through the same normalizer and publication predicate. Drafts and incomplete
published records cannot be promoted by frontend flags; an invalid published record fails
the build and leaves the currently deployed version active. Once a case passes validation,
its `/cases/{slug}` route is prerendered and automatically enters the unified SEO registry
and sitemap. Client names may be omitted only when `clientAnonymous=true`.
