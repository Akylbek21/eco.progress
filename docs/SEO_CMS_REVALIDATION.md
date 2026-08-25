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

`npm run build` first runs `seo:content:sync`. A build without the endpoint may
reuse a previously generated non-empty snapshot. An empty snapshot, incomplete
CMS records, or a sitemap drop beyond the committed baseline threshold fails the
build and must keep the previous production deployment active. Docker deployment
requires `SEO_CONTENT_API_URL` explicitly and passes it only to the build stage.

`articleReviews` contains only review decisions confirmed in the CMS. Each item has
`slug`, `reviewStatus`, and, for backend `APPROVED` (normalized to `approved`), mandatory `authorSlug`, `reviewerSlug`
and `lastReviewedAt`. Both slugs must reference complete expert profiles from the
same response. Static article copy remains `requires-specialist-review` until that
record arrives; the frontend never promotes it based on a name or job title alone.
