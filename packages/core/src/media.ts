import * as crypto from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

import {
  aesEcbPaddedSize,
  decryptAesEcb,
  encryptAesEcb,
  parseAesKey
} from "./crypto.js";
import {
  MediaType,
  UploadMediaType,
  createScaffoldModule,
  type CDNMedia,
  type GetUploadUrlReq,
  type GetUploadUrlResp,
  type MediaTypeValue,
  type ScaffoldModule,
  type UploadMediaTypeValue,
  type UploadResult
} from "./types.js";

const DEFAULT_CDN_BASE_URL = "https://novac2c.cdn.weixin.qq.com/c2c";
const DEFAULT_UPLOAD_RETRIES = 3;
const JPEG_START_OF_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf
]);

type ApiFetch = <TResponse, TBody extends object = Record<string, unknown>>(
  endpoint: string,
  body: TBody
) => Promise<TResponse>;

export interface MediaScaffold {
  readonly packageName: "@openwx/core";
  readonly supportedMedia: readonly ["image", "video", "file", "voice"];
  readonly status: ScaffoldModule["status"];
  readonly notes: readonly string[];
}

export interface UploadMediaOptions {
  readonly filePath: string;
  readonly to: string;
  readonly type: MediaTypeValue;
  readonly apiFetch: ApiFetch;
  readonly cdnBaseUrl?: string;
  readonly fetchImpl?: typeof fetch;
  readonly maxRetries?: number;
  readonly randomBytes?: (size: number) => Buffer;
  readonly fileKey?: string;
}

export interface DownloadMediaOptions {
  readonly media: CDNMedia;
  readonly cdnBaseUrl?: string;
  readonly fetchImpl?: typeof fetch;
  readonly type?: MediaTypeValue;
}

export interface ParsedCdnHeader {
  readonly raw: string;
  readonly encryptQueryParam?: string;
  readonly cdnUrl?: string;
  readonly fileId?: string;
  readonly encryptType?: number;
  readonly fileSize?: number;
  readonly fileType?: string | number;
}

export interface ImageDimensions {
  readonly width: number;
  readonly height: number;
}

export interface ProbeVideoDurationOptions {
  readonly ffprobePath?: string;
  readonly execFileImpl?: typeof execFileCallback;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function resolveFetch(fetchImpl?: typeof fetch): typeof fetch {
  return fetchImpl ?? fetch;
}

function resolveMediaType(type: MediaTypeValue): UploadMediaTypeValue {
  switch (type) {
    case MediaType.IMAGE:
      return UploadMediaType.IMAGE;
    case MediaType.VIDEO:
      return UploadMediaType.VIDEO;
    case MediaType.FILE:
      return UploadMediaType.FILE;
    case MediaType.VOICE:
      return UploadMediaType.VOICE;
    default:
      throw new Error(`Unsupported media type: ${String(type)}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function isLikelyBase64(value: string): boolean {
  const normalized = value.replace(/\s+/g, "");
  return normalized.length > 0 && normalized.length % 4 === 0 && /^[A-Za-z0-9+/]+=*$/.test(normalized);
}

function maybeDecryptHeaderValue(headerValue: string, key: Buffer): string | undefined {
  if (!isLikelyBase64(headerValue)) {
    return undefined;
  }

  const decoded = Buffer.from(headerValue, "base64");
  if (decoded.length === 0 || decoded.length % 16 !== 0) {
    return undefined;
  }

  try {
    return decryptAesEcb(decoded, key).toString("utf8").trim();
  } catch {
    return undefined;
  }
}

function parseStructuredPayload(raw: string): ParsedCdnHeader | undefined {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (!isRecord(parsed)) {
        return undefined;
      }

      const encryptQueryParam =
        typeof parsed.encrypt_query_param === "string"
          ? parsed.encrypt_query_param
          : typeof parsed.download_param === "string"
            ? parsed.download_param
            : undefined;
      const cdnUrl =
        typeof parsed.cdn_url === "string"
          ? parsed.cdn_url
          : typeof parsed.fileid === "string"
            ? parsed.fileid
            : undefined;
      const fileId =
        typeof parsed.file_id === "string"
          ? parsed.file_id
          : typeof parsed.fileid === "string"
            ? parsed.fileid
            : undefined;
      const encryptType = toNumber(parsed.encrypt_type);
      const fileSize = toNumber(parsed.file_size);
      const fileType =
        typeof parsed.file_type === "string" || typeof parsed.file_type === "number"
          ? parsed.file_type
          : undefined;

      if (
        encryptQueryParam === undefined &&
        cdnUrl === undefined &&
        fileId === undefined &&
        encryptType === undefined &&
        fileSize === undefined &&
        fileType === undefined
      ) {
        return undefined;
      }

      return {
        raw: trimmed,
        ...(encryptQueryParam !== undefined ? { encryptQueryParam } : {}),
        ...(cdnUrl !== undefined ? { cdnUrl } : {}),
        ...(fileId !== undefined ? { fileId } : {}),
        ...(encryptType !== undefined ? { encryptType } : {}),
        ...(fileSize !== undefined ? { fileSize } : {}),
        ...(fileType !== undefined ? { fileType } : {})
      };
    } catch {
      return undefined;
    }
  }

  if (trimmed.includes("=") || trimmed.includes("&")) {
    const params = new URLSearchParams(trimmed);
    const encryptQueryParam = params.get("encrypt_query_param") ?? params.get("download_param");
    const cdnUrl = params.get("cdn_url");
    const fileId = params.get("file_id") ?? params.get("fileid");
    const encryptType = toNumber(params.get("encrypt_type"));
    const fileSize = toNumber(params.get("file_size"));
    const fileType = params.get("file_type");

    if (
      encryptQueryParam === null &&
      cdnUrl === null &&
      fileId === null &&
      encryptType === undefined &&
      fileSize === undefined &&
      fileType === null
    ) {
      return undefined;
    }

    return {
      raw: trimmed,
      ...(encryptQueryParam !== null ? { encryptQueryParam } : {}),
      ...(cdnUrl !== null ? { cdnUrl } : {}),
      ...(fileId !== null ? { fileId } : {}),
      ...(encryptType !== undefined ? { encryptType } : {}),
      ...(fileSize !== undefined ? { fileSize } : {}),
      ...(fileType !== null ? { fileType } : {})
    };
  }

  return undefined;
}

async function uploadCiphertextToCdn(
  url: string,
  ciphertext: Buffer,
  fetchImpl: typeof fetch,
  maxRetries: number
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream"
        },
        body: ciphertext
      });

      if (response.ok) {
        return response;
      }

      const responseText = await response.text();
      const error = new Error(
        `CDN upload failed with status ${response.status}: ${responseText || response.statusText}`
      );

      if (response.status >= 400 && response.status < 500) {
        throw error;
      }

      lastError = error;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("CDN upload failed.");
}

function parsePngDimensions(buffer: Buffer): ImageDimensions | undefined {
  if (
    buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20)
    };
  }

  return undefined;
}

function parseGifDimensions(buffer: Buffer): ImageDimensions | undefined {
  const signature = buffer.subarray(0, 6).toString("ascii");
  if (buffer.length >= 10 && (signature === "GIF87a" || signature === "GIF89a")) {
    return {
      width: buffer.readUInt16LE(6),
      height: buffer.readUInt16LE(8)
    };
  }

  return undefined;
}

function parseWebpDimensions(buffer: Buffer): ImageDimensions | undefined {
  if (
    buffer.length < 30 ||
    buffer.subarray(0, 4).toString("ascii") !== "RIFF" ||
    buffer.subarray(8, 12).toString("ascii") !== "WEBP"
  ) {
    return undefined;
  }

  const chunkType = buffer.subarray(12, 16).toString("ascii");
  if (chunkType === "VP8X" && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3)
    };
  }

  if (chunkType === "VP8 " && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff
    };
  }

  if (chunkType === "VP8L" && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1
    };
  }

  return undefined;
}

function parseJpegDimensions(buffer: Buffer): ImageDimensions | undefined {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return undefined;
  }

  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    if (marker === undefined) {
      break;
    }
    if (marker === 0xd9 || marker === 0xda) {
      break;
    }

    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2 || offset + 2 + segmentLength > buffer.length) {
      break;
    }

    if (JPEG_START_OF_FRAME_MARKERS.has(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7)
      };
    }

    offset += 2 + segmentLength;
  }

  return undefined;
}

function parseImageDimensions(buffer: Buffer): ImageDimensions {
  const parsed =
    parsePngDimensions(buffer) ??
    parseGifDimensions(buffer) ??
    parseJpegDimensions(buffer) ??
    parseWebpDimensions(buffer);

  if (!parsed) {
    throw new Error("Unsupported image format for dimension extraction.");
  }

  return parsed;
}

function encodeAesKeyForPayload(key: Buffer): string {
  return Buffer.from(key.toString("hex"), "ascii").toString("base64");
}

/**
 * Convert CDN upload response headers into the normalized media reference used by the SDK.
 */
export function parseCdnResponseHeader(headerValue: string, key: Buffer): ParsedCdnHeader {
  const normalized = headerValue.trim();
  if (normalized.length === 0) {
    throw new Error("CDN response header x-encrypted-param is empty.");
  }

  const decrypted = maybeDecryptHeaderValue(normalized, key);
  if (decrypted) {
    const structured = parseStructuredPayload(decrypted);
    return structured
      ? {
          ...structured,
          raw: normalized
        }
      : {
      raw: normalized,
      encryptQueryParam: decrypted
        };
  }

  const structured = parseStructuredPayload(normalized);
  return structured
    ? {
        ...structured,
        raw: normalized
      }
    : {
    raw: normalized,
    encryptQueryParam: normalized
      };
}

/**
 * Build the `getuploadurl` request body from file metadata and the generated AES key.
 */
export function buildGetUploadUrlRequest(options: {
  readonly fileKey: string;
  readonly to: string;
  readonly type: MediaTypeValue;
  readonly fileSize: number;
  readonly encryptedFileSize: number;
  readonly md5: string;
  readonly aesKeyHex: string;
}): GetUploadUrlReq {
  return {
    filekey: options.fileKey,
    media_type: resolveMediaType(options.type),
    to_user_id: options.to,
    rawsize: options.fileSize,
    rawfilemd5: options.md5,
    filesize: options.encryptedFileSize,
    no_need_thumb: true,
    aeskey: options.aesKeyHex
  };
}

/**
 * Build the CDN upload URL from the iLink-issued upload token and file key.
 */
export function buildCdnUploadUrl(
  cdnBaseUrl: string,
  uploadParam: string,
  fileKey: string
): string {
  const base = trimTrailingSlash(cdnBaseUrl);
  return `${base}/upload?encrypted_query_param=${encodeURIComponent(uploadParam)}&filekey=${encodeURIComponent(fileKey)}`;
}

/**
 * Build a CDN download URL from either the repo-spec `encrypt_query_param` or the ticket's
 * alternate `cdn_url/fileid` style payload.
 */
export function buildCdnDownloadUrl(
  cdnBaseUrl: string,
  media: CDNMedia,
  type?: MediaTypeValue
): string {
  const base = trimTrailingSlash(cdnBaseUrl);
  if (media.encrypt_query_param) {
    return `${base}/download?encrypted_query_param=${encodeURIComponent(media.encrypt_query_param)}`;
  }

  const fileId = media.cdn_url ?? media.file_id;
  const fileType = media.file_type ?? (type ? resolveMediaType(type) : undefined);

  if (!fileId || fileType === undefined) {
    throw new Error("CDN media is missing download parameters.");
  }

  return `${base}/getmedia?fileid=${encodeURIComponent(fileId)}&file_type=${encodeURIComponent(String(fileType))}`;
}

/**
 * Upload a media file via `getuploadurl` and the Tencent CDN.
 */
export async function uploadMedia(options: UploadMediaOptions): Promise<UploadResult> {
  const fetchImpl = resolveFetch(options.fetchImpl);
  const cdnBaseUrl = trimTrailingSlash(options.cdnBaseUrl ?? DEFAULT_CDN_BASE_URL);
  const randomBytes = options.randomBytes ?? crypto.randomBytes;
  const maxRetries = options.maxRetries ?? DEFAULT_UPLOAD_RETRIES;
  const fileBuffer = await readFile(options.filePath);
  const md5 = crypto.createHash("md5").update(fileBuffer).digest("hex");
  const rawKey = randomBytes(16);
  const aesKeyHex = rawKey.toString("hex");
  const aesKey = encodeAesKeyForPayload(rawKey);
  const fileKey = options.fileKey ?? crypto.randomBytes(16).toString("hex");
  const encryptedFileSize = aesEcbPaddedSize(fileBuffer.length);
  const request = buildGetUploadUrlRequest({
    fileKey,
    to: options.to,
    type: options.type,
    fileSize: fileBuffer.length,
    encryptedFileSize,
    md5,
    aesKeyHex
  });
  const response = await options.apiFetch<GetUploadUrlResp, GetUploadUrlReq>("getuploadurl", request);
  if (!response.upload_param) {
    throw new Error("getuploadurl did not return upload_param.");
  }

  const ciphertext = encryptAesEcb(fileBuffer, rawKey);
  const uploadResponse = await uploadCiphertextToCdn(
    buildCdnUploadUrl(cdnBaseUrl, response.upload_param, fileKey),
    ciphertext,
    fetchImpl,
    maxRetries
  );
  const headerValue = uploadResponse.headers.get("x-encrypted-param");
  if (!headerValue) {
    throw new Error("CDN upload response is missing x-encrypted-param.");
  }

  const parsedHeader = parseCdnResponseHeader(headerValue, rawKey);
  const media: CDNMedia = {
    aes_key: aesKey,
    encrypt_type: parsedHeader.encryptType ?? 1,
    file_size: parsedHeader.fileSize ?? fileBuffer.length,
    file_type: parsedHeader.fileType ?? options.type,
    ...(parsedHeader.encryptQueryParam !== undefined
      ? { encrypt_query_param: parsedHeader.encryptQueryParam }
      : {}),
    ...(parsedHeader.cdnUrl !== undefined ? { cdn_url: parsedHeader.cdnUrl } : {}),
    ...(parsedHeader.fileId !== undefined ? { file_id: parsedHeader.fileId } : {})
  };

  return {
    fileKey,
    mediaType: options.type,
    fileSize: fileBuffer.length,
    encryptedFileSize,
    md5,
    aesKeyHex,
    aesKey,
    rawHeader: headerValue,
    media
  };
}

/**
 * Download and decrypt CDN media content.
 */
export async function downloadMedia(options: DownloadMediaOptions): Promise<Buffer> {
  if (!options.media.aes_key) {
    throw new Error("CDN media is missing aes_key.");
  }

  const fetchImpl = resolveFetch(options.fetchImpl);
  const response = await fetchImpl(
    buildCdnDownloadUrl(options.cdnBaseUrl ?? DEFAULT_CDN_BASE_URL, options.media, options.type)
  );

  if (!response.ok) {
    throw new Error(`CDN download failed with status ${response.status}: ${response.statusText}`);
  }

  const ciphertext = Buffer.from(await response.arrayBuffer());
  const plaintext = decryptAesEcb(ciphertext, parseAesKey(options.media.aes_key));
  if (options.media.file_size === undefined) {
    return plaintext;
  }

  return plaintext.subarray(0, options.media.file_size);
}

/**
 * Read width and height from a local image file using built-in format parsers.
 */
export async function readImageDimensions(filePath: string): Promise<ImageDimensions> {
  return parseImageDimensions(await readFile(filePath));
}

/**
 * Best-effort video duration probing via `ffprobe`.
 */
export async function probeVideoDuration(
  filePath: string,
  options: ProbeVideoDurationOptions = {}
): Promise<number | undefined> {
  const ffprobePath = options.ffprobePath ?? "ffprobe";
  const execFile = promisify(options.execFileImpl ?? execFileCallback);

  try {
    const { stdout } = await execFile(ffprobePath, [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath
    ]);
    const durationSeconds = Number(String(stdout).trim());
    if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
      return undefined;
    }

    return Math.round(durationSeconds * 1000);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }

    return undefined;
  }
}

export function createMediaScaffold(): MediaScaffold {
  const module = createScaffoldModule("@openwx/core", [
    "Media transport uses AES-128-ECB.",
    "CDN upload/download helpers support protocol and fallback ticket formats."
  ]);

  return {
    packageName: "@openwx/core",
    supportedMedia: ["image", "video", "file", "voice"],
    status: module.status,
    notes: module.notes
  };
}
