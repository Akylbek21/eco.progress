import registry from '../src/data/seoRegistry.generated.json' with { type: 'json' };

const reasonFor = (entry) => {
  if (entry.path === '/employees') return 'team-page';
  if (entry.path === '/ses-proverka-proizvodstvennyy-kontrol') return 'special-page-awaiting-specialist-review';
  if (entry.type === 'article' || entry.reviewStatus) return 'article-awaiting-specialist-review';
  if (/^\/news\//.test(entry.path)) return 'article-awaiting-specialist-review';
  return 'service-city-awaiting-commercial-review';
};

const noindexPages = registry
  .filter((entry) => entry.robots === 'noindex,follow')
  .map((entry) => ({ path: entry.path, reason: reasonFor(entry) }))
  .sort((left, right) => left.path.localeCompare(right.path, 'ru'));

const counts = Object.entries(Object.groupBy(noindexPages, (entry) => entry.reason))
  .map(([reason, entries]) => `${reason}: ${entries.length}`)
  .join(', ');

console.log(`# noindex,follow: ${noindexPages.length}`);
console.log(`# ${counts}`);
for (const entry of noindexPages) console.log(`${entry.path}\t${entry.reason}`);
