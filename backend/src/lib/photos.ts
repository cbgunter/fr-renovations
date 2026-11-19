import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { PhotoSlot } from '@frr/shared';

export { PHOTO_SLOTS, isPhotoSlot, type PhotoSlot } from '@frr/shared';

/** Uploaded photos are cached for 5 minutes so a replacement shows up quickly. */
export const PHOTO_CACHE_CONTROL = 'public, max-age=300';

export interface PhotoStorage {
  uploadUrl(slot: PhotoSlot): Promise<string>;
  /** slot -> last-modified ISO for slots that have a photo */
  list(): Promise<Record<string, string>>;
}

export class S3PhotoStorage implements PhotoStorage {
  private s3 = new S3Client({});
  constructor(private bucket: string) {}

  uploadUrl(slot: PhotoSlot) {
    return getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: `photos/${slot}.webp`,
        ContentType: 'image/webp',
        CacheControl: PHOTO_CACHE_CONTROL,
      }),
      { expiresIn: 600 },
    );
  }

  async list() {
    const r = await this.s3.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: 'photos/' }));
    const out: Record<string, string> = {};
    for (const o of r.Contents ?? []) {
      const m = /^photos\/([a-z]+)\.webp$/.exec(o.Key ?? '');
      if (m && o.LastModified) out[m[1]] = o.LastModified.toISOString();
    }
    return out;
  }
}

export class MemoryPhotoStorage implements PhotoStorage {
  async uploadUrl(slot: PhotoSlot) {
    return `https://example.invalid/upload/${slot}`;
  }
  async list() {
    return {};
  }
}
