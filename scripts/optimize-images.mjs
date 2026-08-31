import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const outputDir = path.join(publicDir, 'media');
const manifestPath = path.join(root, 'src', 'data', 'responsiveImages.generated.json');
const widths = [480, 768, 1024, 1280, 1920];
const sources = {
  'cottonbro.jpg': 'ekologicheskoe-proektirovanie',
  'edward.jpg': 'laboratornye-izmereniya',
  'jose.jpg': 'vyvoz-othodov',
  'pexels-enginakyurt.jpg': 'ekologicheskiy-monitoring',
  'pexels-jan-van.jpg': 'otbor-prob-vody',
  'para.jpg': 'ecoprogress-og-cover',
  'ekologicheskoe-soprovozhdenie.jpg': 'ekologicheskoe-soprovozhdenie',
  'utilizacija-othodov-3.jpg': 'utilizaciya-othodov',
  'poligon-tbo-2.jpg': 'poligon-tbo',
};

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(path.join(outputDir, 'social'), { recursive: true });

let generated = 0;
for (const [fileName, outputName] of Object.entries(sources)) {
  const sourcePath = path.join(publicDir, fileName);
  if (!fs.existsSync(sourcePath)) continue;
  await sharp(sourcePath).metadata();
  for (const width of widths) {
    const pipeline = sharp(sourcePath).rotate().resize({ width, withoutEnlargement: true });
    await pipeline.clone().jpeg({ quality: 76, progressive: true }).toFile(path.join(outputDir, `${outputName}-${width}.jpg`));
    await pipeline.clone().webp({ quality: 72 }).toFile(path.join(outputDir, `${outputName}-${width}.webp`));
    await pipeline.clone().avif({ quality: 50, effort: 4 }).toFile(path.join(outputDir, `${outputName}-${width}.avif`));
    generated += 3;
  }
}

await sharp(path.join(publicDir, 'og-cover.jpg'))
  .rotate()
  .resize(1200, 630, { fit: 'cover', position: 'attention' })
  .jpeg({ quality: 78, progressive: true })
  .toFile(path.join(outputDir, 'social', 'ecoprogress-og-1200x630.jpg'));
generated += 1;

const manifest = {};
for (const fileName of fs.readdirSync(outputDir)) {
  const match = fileName.match(/^(.+)-(\d+)\.(avif|webp|jpg)$/);
  if (!match) continue;
  const [, name, width, extension] = match;
  manifest[name] ||= { avif: [], webp: [], jpg: [] };
  manifest[name][extension].push(Number(width));
}
for (const variants of Object.values(manifest)) {
  for (const extension of ['avif', 'webp', 'jpg']) {
    variants[extension].sort((left, right) => left - right);
  }
}
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`Generated ${generated} responsive assets and indexed ${Object.keys(manifest).length} image families.`);
