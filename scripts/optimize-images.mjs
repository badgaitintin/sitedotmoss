/**
 * optimize-images.mjs
 * Pre-process images and generate lightweight animated WebPs and static assets.
 */
import sharp from 'sharp';
import { stat, mkdir } from 'fs/promises';
import { join } from 'path';

const PUBLIC = './public';
const OUT_DIR = './public/optimized';

await mkdir(OUT_DIR, { recursive: true });

console.log('Starting image optimization...\n');

// 1. Animated background WebPs (preserves animation, drastically reduces GIF/WebP sizes)
const animTasks = [
  {
    name: 'frutigif_1 → animated WebP (index, cv)',
    input: join(PUBLIC, 'frutigif_1.webp'),
    output: join(OUT_DIR, 'anim_bg_1.webp'),
    width: 400,
    quality: 65,
  },
  {
    name: 'frutigif_2 → animated WebP (AboutModal)',
    input: join(PUBLIC, 'frutigif_2.gif'),
    output: join(OUT_DIR, 'anim_bg_2.webp'),
    width: 450,
    quality: 65,
  },
  {
    name: 'frutigif_3 → animated WebP (nextwbc)',
    input: join(PUBLIC, 'frutigif_3.gif'),
    output: join(OUT_DIR, 'anim_bg_3.webp'),
    width: 450,
    quality: 65,
  },
];

for (const task of animTasks) {
  try {
    const inputStat = await stat(task.input);
    const inputKB = (inputStat.size / 1024).toFixed(1);

    await sharp(task.input, { animated: true })
      .resize(task.width)
      .webp({ quality: task.quality, effort: 4 })
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

// 2. Static images
const staticTasks = [
  {
    name: 'IMG_1405.PNG → optimized WebP (About Me photo)',
    input: join(PUBLIC, 'IMG_1405.PNG'),
    output: join(OUT_DIR, 'profile_photo.webp'),
    width: 600,
    quality: 80,
  },
  {
    name: 'raptor_wbc_00001.jpeg → optimized',
    input: join(PUBLIC, 'raptor_wbc_00001.jpeg'),
    output: join(OUT_DIR, 'raptor_wbc.webp'),
    width: 400,
    quality: 75,
  },
];

for (const task of staticTasks) {
  try {
    const inputStat = await stat(task.input);
    const inputKB = (inputStat.size / 1024).toFixed(1);

    await sharp(task.input, { animated: false })
      .resize(task.width, null, { fit: 'inside', withoutEnlargement: true })
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

console.log('All image optimization complete!');
