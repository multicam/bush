/**
 * Bush Platform - S3-Compatible Storage Provider
 *
 * Implements IStorageProvider using AWS SDK v3.
 * Supports: AWS S3, Cloudflare R2, MinIO, Backblaze B2.
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  CopyObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  type _Object,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type {
  IStorageProvider,
  StorageProviderType,
  PresignedUrlOperation,
  PresignedUrlResult,
  MultipartUploadInit,
  MultipartPartUrl,
  MultipartPart,
  StorageObject,
  ListObjectsResult,
  StorageConfig,
} from "./types.js";

/**
 * S3-compatible storage provider implementation
 */
export class S3StorageProvider implements IStorageProvider {
  readonly providerType: StorageProviderType;
  private client: S3Client;
  private bucket: string;

  constructor(config: StorageConfig) {
    this.providerType = config.provider;
    this.bucket = config.bucket;

    // Configure S3 client
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      // Force path-style for MinIO and other non-AWS providers
      forcePathStyle: config.forcePathStyle ?? !!config.endpoint,
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Try to list objects with max keys = 1 to verify connectivity
      await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          MaxKeys: 1,
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  async getPresignedUrl(
    key: string,
    operation: PresignedUrlOperation,
    expiresIn = 3600
  ): Promise<PresignedUrlResult> {
    const command =
      operation === "put"
        ? new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
          })
        : new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
          });

    const url = await getSignedUrl(this.client, command, { expiresIn });

    return {
      url,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      key,
    };
  }

  async initMultipartUpload(key: string): Promise<MultipartUploadInit> {
    const response = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );

    if (!response.UploadId) {
      throw new Error("Failed to initiate multipart upload: no upload ID returned");
    }

    return {
      uploadId: response.UploadId,
      key,
    };
  }

  async getMultipartPartUrls(
    key: string,
    uploadId: string,
    partCount: number
  ): Promise<MultipartPartUrl[]> {
    const urls: MultipartPartUrl[] = [];

    for (let partNumber = 1; partNumber <= partCount; partNumber++) {
      const command = new UploadPartCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      });

      const url = await getSignedUrl(this.client, command, { expiresIn: 3600 });
      urls.push({ partNumber, url });
    }

    return urls;
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: MultipartPart[]
  ): Promise<void> {
    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map((p) => ({
            PartNumber: p.partNumber,
            ETag: p.etag,
          })),
        },
      })
    );
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await this.client.send(
      new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
      })
    );
  }

  async headObject(key: string): Promise<StorageObject | null> {
    try {
      const response = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );

      return {
        key,
        size: response.ContentLength ?? 0,
        etag: response.ETag?.replace(/"/g, "") ?? "",
        lastModified: response.LastModified ?? new Date(),
        contentType: response.ContentType ?? "application/octet-stream",
      };
    } catch {
      // Object doesn't exist
      return null;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
  }

  async deleteObjects(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    // S3 allows max 1000 objects per delete request
    const chunks: string[][] = [];
    for (let i = 0; i < keys.length; i += 1000) {
      chunks.push(keys.slice(i, i + 1000));
    }

    for (const chunk of chunks) {
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: {
            Objects: chunk.map((key) => ({ Key: key })),
            Quiet: true,
          },
        })
      );
    }
  }

  async copyObject(sourceKey: string, destKey: string): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${sourceKey}`,
        Key: destKey,
      })
    );
  }

  async listObjects(prefix: string, maxKeys = 1000): Promise<ListObjectsResult> {
    const response = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: maxKeys,
      })
    );

    const objects: StorageObject[] = (response.Contents ?? []).map(
      (obj: _Object) => ({
        key: obj.Key ?? "",
        size: obj.Size ?? 0,
        etag: obj.ETag?.replace(/"/g, "") ?? "",
        lastModified: obj.LastModified ?? new Date(),
        contentType: "application/octet-stream", // Not returned by list
      })
    );

    return {
      objects,
      nextCursor: response.NextContinuationToken,
      isTruncated: response.IsTruncated ?? false,
    };
  }

  async getObject(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );

    if (!response.Body) {
      throw new Error(`Object not found: ${key}`);
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    const stream = response.Body as NodeJS.ReadableStream;

    for await (const chunk of stream) {
      chunks.push(chunk as Uint8Array);
    }

    return Buffer.concat(chunks);
  }

  async putObject(
    key: string,
    body: Buffer | ReadableStream,
    contentType = "application/octet-stream"
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
  }
}
