/**
 * Image Optimization Script for React Native
 * Compresses JPG/PNG images
 * Run with: node scripts/optimize-images.mjs
 */

import sharp from 'sharp';
import { readdir, stat } from 'fs/promises';
import { join, extname, basename } from 'path';

const QUALITY = 80;
const MAX_WIDTH = 1920; // For backgrounds
const ICON_MAX_SIZE = 1024; // For app icons

async function getFiles(dir) {
  const files = [];
  try {
    const items = await readdir(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = join(dir, item.name);
      if (item.isDirectory()) {
        files.push(...await getFiles(fullPath));
      } else if (/\.(jpg|jpeg|png)$/i.test(item.name)) {
        files.push(fullPath);
      }
    }
  } catch (e) {
    // Directory doesn't exist
  }
  return files;
}

async function optimizeImage(filePath) {
  const ext = extname(filePath).toLowerCase();
  const name = basename(filePath);
  const stats = await stat(filePath);
  const originalSize = stats.size;

  // Skip small files (under 50KB)
  if (originalSize < 50 * 1024) {
    console.log(`⏭️  Skipping ${name} (already small: ${(originalSize / 1024).toFixed(0)}KB)`);
    return { skipped: true };
  }

  try {
    const image = sharp(filePath);
    const metadata = await image.metadata();

    // Determine max width based on file type
    const isIcon = name.includes('icon') || name.includes('splash');
    const maxWidth = isIcon ? ICON_MAX_SIZE : MAX_WIDTH;

    let pipeline = image;
    if (metadata.width && metadata.width > maxWidth) {
      pipeline = pipeline.resize(maxWidth, null, { withoutEnlargement: true });
    }

    // Optimize based on format
    if (ext === '.png') {
      await pipeline
        .png({ quality: QUALITY, compressionLevel: 9 })
        .toFile(filePath + '.tmp');
    } else {
      await pipeline
        .jpeg({ quality: QUALITY, mozjpeg: true })
        .toFile(filePath + '.tmp');
    }

    const newStats = await stat(filePath + '.tmp');
    const newSize = newStats.size;
    const savings = ((originalSize - newSize) / originalSize * 100).toFixed(1);

    if (newSize < originalSize) {
      const { rename, unlink } = await import('fs/promises');
      await unlink(filePath);
      await rename(filePath + '.tmp', filePath);
      console.log(`✅ ${name}: ${(originalSize / 1024 / 1024).toFixed(1)}MB → ${(newSize / 1024 / 1024).toFixed(1)}MB (${savings}% smaller)`);
      return { originalSize, newSize, savings: originalSize - newSize };
    } else {
      const { unlink } = await import('fs/promises');
      await unlink(filePath + '.tmp');
      console.log(`⏭️  ${name}: Already optimized`);
      return { skipped: true };
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return { error: true };
  }
}

async function main() {
  console.log('🖼️  Starting image optimization for delta-mobile...\n');

  const assetsDir = join(process.cwd(), 'assets');
  const files = await getFiles(assetsDir);

  console.log(`Found ${files.length} images to process\n`);

  let totalOriginal = 0;
  let totalNew = 0;
  let optimized = 0;

  for (const file of files) {
    const result = await optimizeImage(file);
    if (result.savings) {
      totalOriginal += result.originalSize;
      totalNew += result.newSize;
      optimized++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   Optimized: ${optimized} images`);
  if (totalOriginal > 0) {
    console.log(`   Total saved: ${((totalOriginal - totalNew) / 1024 / 1024).toFixed(1)}MB`);
    console.log(`   Reduction: ${((totalOriginal - totalNew) / totalOriginal * 100).toFixed(1)}%`);
  }
}

main().catch(console.error);
