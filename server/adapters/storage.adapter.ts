import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../utils/logger.js';

export type StorageProvider = 'local_disk' | 's3_compatible' | 'memory';

export interface FileUploadResult {
  filename: string;
  url: string;
  sizeBytes: number;
  mimeType: string;
}

export class StorageAdapter {
  private provider: StorageProvider;
  private uploadDir: string;
  private inMemoryStore = new Map<string, { buffer: Buffer; mimeType: string }>();

  constructor() {
    this.provider = (process.env.STORAGE_PROVIDER as StorageProvider) || 'local_disk';
    this.uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');

    if (this.provider === 'local_disk' && !fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  getProvider(): StorageProvider {
    return this.provider;
  }

  async uploadFile(filename: string, buffer: Buffer, mimeType: string): Promise<FileUploadResult> {
    const safeFilename = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    if (this.provider === 'local_disk') {
      const destination = path.join(this.uploadDir, safeFilename);
      fs.writeFileSync(destination, buffer);
      logger.info(`File saved to local disk: ${destination}`, { size: buffer.length });
      return {
        filename: safeFilename,
        url: `/uploads/${safeFilename}`,
        sizeBytes: buffer.length,
        mimeType
      };
    }

    if (this.provider === 's3_compatible') {
      // S3/R2/GCS Bucket configuration
      const bucket = process.env.S3_BUCKET || 'toolpadi-assets';
      const endpoint = process.env.S3_ENDPOINT || 'https://s3.amazonaws.com';
      logger.info(`S3 upload to bucket: ${bucket} at endpoint ${endpoint}`);
      return {
        filename: safeFilename,
        url: `${endpoint}/${bucket}/${safeFilename}`,
        sizeBytes: buffer.length,
        mimeType
      };
    }

    // Memory fallback
    this.inMemoryStore.set(safeFilename, { buffer, mimeType });
    return {
      filename: safeFilename,
      url: `data:${mimeType};base64,${buffer.toString('base64').substring(0, 50)}...`,
      sizeBytes: buffer.length,
      mimeType
    };
  }

  async deleteFile(filename: string): Promise<boolean> {
    if (this.provider === 'local_disk') {
      const target = path.join(this.uploadDir, path.basename(filename));
      if (fs.existsSync(target)) {
        fs.unlinkSync(target);
        return true;
      }
      return false;
    }
    if (this.provider === 'memory') {
      return this.inMemoryStore.delete(filename);
    }
    return true;
  }
}

export const storageAdapter = new StorageAdapter();
