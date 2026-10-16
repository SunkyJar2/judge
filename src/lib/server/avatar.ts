import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const MEDIA_DIR = path.resolve(process.env.STORAGE_DIR || './storage', 'media');

export async function processAvatar(userId: string, buffer: Buffer): Promise<string> {
  if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
  }

  const filename = `avatar_${userId}.webp`;
  const targetPath = path.join(MEDIA_DIR, filename);

  await sharp(buffer)
    .resize(512, 512, { fit: 'cover' })
    .webp({ quality: 85 })
    .toFile(targetPath);

  return `/api/media/${filename}`;
}

export async function processForumImage(imageIndex: number, buffer: Buffer): Promise<string> {
  if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
  }

  const id = crypto.randomUUID();
  const filename = `forum_${id}_${imageIndex}.webp`;
  const targetPath = path.join(MEDIA_DIR, filename);

  await sharp(buffer)
    .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(targetPath);

  return `/api/media/${filename}`;
}

