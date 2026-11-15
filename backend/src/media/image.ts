import sharp from 'sharp';
import { fileTypeFromBuffer } from 'file-type';
import { badRequest } from '../lib/errors.js';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif']);

sharp.cache(false);
sharp.concurrency(1);

export interface ProcessedImage {
  data: Buffer;
  mime: 'image/webp';
  width: number;
  height: number;
  /** Tiny blurred preview as a data URL, shown while the full image loads. */
  preview: string;
}

async function assertImage(buf: Buffer) {
  const type = await fileTypeFromBuffer(buf);
  if (!type || !IMAGE_TYPES.has(type.mime)) {
    throw badRequest('unsupported_image', 'Please send a JPG, PNG, WebP, GIF or HEIC image.');
  }
  return type.mime;
}

/**
 * Re-encodes every upload. This strips EXIF (GPS location, camera serials), applies the
 * EXIF rotation, caps dimensions, and guarantees what we store is a clean WebP rather than
 * whatever bytes the client sent.
 */
export async function processChatImage(buf: Buffer): Promise<ProcessedImage> {
  const mime = await assertImage(buf);
  const animated = mime === 'image/gif' || mime === 'image/webp';
  try {
    const input = sharp(buf, { animated, limitInputPixels: 50_000_000, failOn: 'error' });
    const { data, info } = await input
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    const height = info.pageHeight ?? info.height;
    const previewBuf = await sharp(buf, { animated: false, limitInputPixels: 50_000_000 })
      .rotate()
      .resize({ width: 24, height: 24, fit: 'inside' })
      .blur(1.2)
      .webp({ quality: 40 })
      .toBuffer();

    return {
      data,
      mime: 'image/webp',
      width: info.width,
      height,
      preview: `data:image/webp;base64,${previewBuf.toString('base64')}`,
    };
  } catch {
    throw badRequest('invalid_image', 'That image could not be read.');
  }
}

export async function processAvatar(buf: Buffer): Promise<Buffer> {
  await assertImage(buf);
  try {
    return await sharp(buf, { animated: false, limitInputPixels: 50_000_000, failOn: 'error' })
      .rotate()
      .resize(320, 320, { fit: 'cover', position: 'attention' })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw badRequest('invalid_image', 'That image could not be read.');
  }
}
