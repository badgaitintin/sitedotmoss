/**
 * optimize-backgrounds.mjs
 * Pre-blur and resize background images to eliminate CSS filter: blur() at runtime.
 * Uses sharp (available via Astro dependency).
 */
import sharp from 'sharp';
import { stat, mkdir } from 'fs/promises';
import { join } from 'path';

const PUBLIC = './public';
const OUT_DIR = './public/optimized';

await mkdir(OUT_DIR, { recursive: true });

const tasks = [
  {
    name: 'frutigif_1 → pre-blurred background (index, cv)',
    input: join(PUBLIC, 'frutigif_1.webp'),
    output: join(OUT_DIR, 'bg_blurred_1.webp'),
    width: 800,
    blur: 30,
    quality: 60,
  },
  {
    name: 'frutigif_3 → pre-blurred background (nextwbc)',
    input: join(PUBLIC, 'frutigif_3.gif'),
    output: join(OUT_DIR, 'bg_blurred_3.webp'),
    width: 800,
    blur: 15,
    quality: 60,
  },
  {
    name: 'frutigif_2 → pre-blurred background (AboutModal)',
    input: join(PUBLIC, 'frutigif_2.gif'),
    output: join(OUT_DIR, 'bg_blurred_2.webp'),
    width: 800,
    blur: 15,
    quality: 60,
  },
  {
    name: 'IMG_1405.PNG → optimized WebP (About Me tile + modal)',
    input: join(PUBLIC, 'IMG_1405.PNG'),
    output: join(OUT_DIR, 'profile_photo.webp'),
    width: 600,
    blur: 0,
    quality: 80,
  },
  {
    name: 'raptor_wbc_00001.jpeg → optimized',
    input: join(PUBLIC, 'raptor_wbc_00001.jpeg'),
    output: join(OUT_DIR, 'raptor_wbc.webp'),
    width: 400,
    blur: 0,
    quality: 75,
  },
];

console.log('Starting image optimization...\n');

for (const task of tasks) {
  try {
    const inputStat = await stat(task.input);
    const inputKB = (inputStat.size / 1024).toFixed(1);

    let pipeline = sharp(task.input, { animated: false })
      .resize(task.width, null, { fit: 'inside', withoutEnlargement: true });

    if (task.blur > 0) {
      pipeline = pipeline.blur(task.blur);
    }

    await pipeline
      .webp({ quality: task.quality, effort: 6 })
      .toFile(task.output);

    const outputStat = await stat(task.output);
    const outputKB = (outputStat.size / 1024).toFixed(1);
    const savings = ((1 - outputStat.size / inputStat.size) * 100).toFixed(1);

    console.log(`OK ${task.name}`);
    console.log(`   ${inputKB} KB -> ${outputKB} KB (${savings}% smaller)\n`);
  } catch (err) {
    console.error(`FAIL ${task.name}: ${err.message}\n`);
  }
}

console.log('\nLarge files in public/ that may be unused:');
const candidates = ['gr1.png', 'gr2.png', 'gr3.png', 'gr4.png', 'gr5.png', 'gr6.png',
  'frutiger-aero-wallpaper-i-whipped-up-in-a-few-hours-hoping-v0-jcaq7gsamypc1.webp',
  'Kanye West - On Sight [Visualizer].mp4',
  '3d_grid_sentence_classifier_v13.ipynb'];

for (const f of candidates) {
  try {
    const s = await stat(join(PUBLIC, f));
    console.log(`   WARNING: ${f} -- ${(s.size / 1024 / 1024).toFixed(2)} MB`);
  } catch {}
}

console.log('\nDone! Optimized files saved to public/optimized/');
