import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import nock from "nock";
import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from "vitest";

import { encryptAesEcb } from "../src/crypto.js";
import {
  buildCdnDownloadUrl,
  buildCdnUploadUrl,
  createMediaScaffold,
  downloadMedia,
  parseCdnResponseHeader,
  uploadMedia
} from "../src/media.js";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5W9s8AAAAASUVORK5CYII=",
  "base64"
);

describe("media helpers", () => {
  beforeAll(() => {
    nock.disableNetConnect();
    nock.enableNetConnect((host) => host.startsWith("127.0.0.1") || host.startsWith("localhost"));
  });

  afterAll(() => {
    nock.enableNetConnect();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  it("exposes all supported media kinds", () => {
    expect(createMediaScaffold().supportedMedia).toStrictEqual([
      "image",
      "video",
      "file",
      "voice"
    ]);
  });

  it("builds CDN upload and download URLs", () => {
    expect(buildCdnUploadUrl("https://cdn.example.com/c2c", "upload-token", "file-key")).toBe(
      "https://cdn.example.com/c2c/upload?encrypted_query_param=upload-token&filekey=file-key"
    );

    expect(
      buildCdnDownloadUrl("https://cdn.example.com/c2c", {
        encrypt_query_param: "download-token"
      })
    ).toBe("https://cdn.example.com/c2c/download?encrypted_query_param=download-token");

    expect(
      buildCdnDownloadUrl(
        "https://cdn.example.com/c2c",
        {
          cdn_url: "cdn-file-id",
          file_type: 3
        },
        "file"
      )
    ).toBe("https://cdn.example.com/c2c/getmedia?fileid=cdn-file-id&file_type=3");
  });

  it("parses direct and AES-wrapped CDN response headers", () => {
    const key = Buffer.from("0123456789abcdef");

    expect(parseCdnResponseHeader("download-token", key)).toStrictEqual({
      raw: "download-token",
      encryptQueryParam: "download-token"
    });

    const encryptedHeader = encryptAesEcb(
      Buffer.from(JSON.stringify({ encrypt_query_param: "download-token", file_size: 123 })),
      key
    ).toString("base64");

    expect(parseCdnResponseHeader(encryptedHeader, key)).toStrictEqual({
      raw: encryptedHeader,
      encryptQueryParam: "download-token",
      fileSize: 123
    });
  });

  it("uploads media through getuploadurl and the CDN", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "openwx-media-"));
    const filePath = join(tempDir, "pixel.png");
    const rawKey = Buffer.from("00112233445566778899aabbccddeeff", "hex");

    try {
      await writeFile(filePath, PNG_1X1);

      nock("https://ilinkai.weixin.qq.com")
        .post("/ilink/bot/getuploadurl", (body) => {
          expect(body).toMatchObject({
            filekey: "fixed-file-key",
            media_type: 1,
            to_user_id: "user@im.wechat",
            rawsize: PNG_1X1.length,
            rawfilemd5: "48e67abc9731b88c20de2ecfcd0ecfb7",
            filesize: 80,
            no_need_thumb: true,
            aeskey: rawKey.toString("hex")
          });
          return true;
        })
        .reply(200, {
          ret: 0,
          upload_param: "upload-token"
        });

      const uploadScope = nock("https://cdn.example.com")
        .post("/c2c/upload", (body) => {
          const payload =
            typeof body === "string"
              ? /^[0-9a-f]+$/i.test(body)
                ? Buffer.from(body, "hex")
                : Buffer.from(body)
              : body instanceof Uint8Array
                ? Buffer.from(body)
                : Buffer.from(String(body));
          expect(payload.length).toBe(80);
          return true;
        })
        .query({
          encrypted_query_param: "upload-token",
          filekey: "fixed-file-key"
        })
        .reply(200, "", {
          "x-encrypted-param": "download-token"
        });

      const result = await uploadMedia({
        filePath,
        to: "user@im.wechat",
        type: "image",
        fileKey: "fixed-file-key",
        randomBytes: () => rawKey,
        cdnBaseUrl: "https://cdn.example.com/c2c",
        apiFetch: (endpoint, body) => {
          expect(endpoint).toBe("getuploadurl");
          return fetch("https://ilinkai.weixin.qq.com/ilink/bot/getuploadurl", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
          }).then((response) => response.json());
        }
      });

      expect(uploadScope.isDone()).toBe(true);
      expect(result).toStrictEqual({
        fileKey: "fixed-file-key",
        mediaType: "image",
        fileSize: PNG_1X1.length,
        encryptedFileSize: 80,
        md5: "48e67abc9731b88c20de2ecfcd0ecfb7",
        aesKeyHex: rawKey.toString("hex"),
        aesKey: Buffer.from(rawKey.toString("hex"), "ascii").toString("base64"),
        rawHeader: "download-token",
        media: {
          aes_key: Buffer.from(rawKey.toString("hex"), "ascii").toString("base64"),
          encrypt_type: 1,
          file_size: PNG_1X1.length,
          file_type: "image",
          encrypt_query_param: "download-token"
        }
      });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("retries CDN uploads for retryable failures", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "openwx-media-retry-"));
    const filePath = join(tempDir, "pixel.png");
    let attempts = 0;

    try {
      await writeFile(filePath, PNG_1X1);

      nock("https://ilinkai.weixin.qq.com")
        .post("/ilink/bot/getuploadurl")
        .reply(200, {
          ret: 0,
          upload_param: "upload-token"
        });

      nock("https://cdn.example.com")
        .post("/c2c/upload")
        .query(true)
        .times(3)
        .reply(() => {
          attempts += 1;
          if (attempts < 3) {
            return [500, "retry"];
          }

          return [
            200,
            "",
            {
              "x-encrypted-param": "download-token"
            }
          ];
        });

      const result = await uploadMedia({
        filePath,
        to: "user@im.wechat",
        type: "file",
        randomBytes: () => Buffer.from("fedcba9876543210"),
        cdnBaseUrl: "https://cdn.example.com/c2c",
        apiFetch: (_endpoint, body) =>
          fetch("https://ilinkai.weixin.qq.com/ilink/bot/getuploadurl", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
          }).then((response) => response.json())
      });

      expect(attempts).toBe(3);
      expect(result.media.encrypt_query_param).toBe("download-token");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("downloads and decrypts media payloads", async () => {
    const rawKey = Buffer.from("0123456789abcdef");
    const plaintext = Buffer.from("hello from cdn");
    const ciphertext = encryptAesEcb(plaintext, rawKey);

    nock("https://cdn.example.com")
      .get("/c2c/download")
      .query({
        encrypted_query_param: "download-token"
      })
      .reply(200, ciphertext);

    const decrypted = await downloadMedia({
      cdnBaseUrl: "https://cdn.example.com/c2c",
      media: {
        encrypt_query_param: "download-token",
        aes_key: Buffer.from(rawKey.toString("hex"), "ascii").toString("base64"),
        file_size: plaintext.length
      }
    });

    expect(decrypted).toStrictEqual(plaintext);
  });
});
