import { createScaffoldModule, type ScaffoldModule } from "./types.js";
import { resolveQRDisplayProvider, type QRDisplayProvider } from "./qr-display.js";
import { normalizeAccountId, type Store } from "./store.js";

export const AUTH_DEFAULT_BASE_URL = "https://ilinkai.weixin.qq.com";
export const AUTH_BOT_TYPE = "3";
export const DEFAULT_QR_POLL_INTERVAL_MS = 3_000;
export const DEFAULT_QR_REQUEST_TIMEOUT_MS = 35_000;
export const DEFAULT_QR_REFRESH_LIMIT = 3;
export const DEFAULT_LOGIN_TIMEOUT_MS = 480_000;

const LOGIN_QR_PATHS = [
  `/cgi-bin/ilink/ilink_bot/get_bot_qrcode?bot_type=${AUTH_BOT_TYPE}`,
  `/ilink/bot/get_bot_qrcode?bot_type=${AUTH_BOT_TYPE}`
] as const;

export interface AuthScaffold {
  readonly packageName: "@openwx/core";
  readonly botType: "3";
  readonly status: ScaffoldModule["status"];
  readonly notes: readonly string[];
}

export interface LoginQRCode {
  readonly sessionKey: string;
  readonly qrcodeUrl: string;
}

export type LoginStatus = "waiting" | "scanned" | "confirmed" | "expired";

export interface ScanResult {
  readonly status: LoginStatus;
  readonly token?: string;
  readonly accountId?: string;
  readonly userId?: string;
  readonly baseUrl?: string;
}

export interface LoginResult {
  readonly token: string;
  readonly accountId: string;
  readonly userId: string;
  readonly baseUrl: string;
  readonly savedAt: string;
}

export interface AuthRequestOptions {
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

export interface WaitForScanOptions extends AuthRequestOptions {
  readonly pollIntervalMs?: number;
  readonly totalTimeoutMs?: number;
  readonly now?: () => number;
  readonly sleep?: (durationMs: number) => Promise<void>;
  readonly onStatusChange?: (status: LoginStatus) => void;
}

export interface LoginOptions extends WaitForScanOptions {
  readonly qrDisplay?: QRDisplayProvider;
  readonly store?: Store;
  readonly maxRefreshes?: number;
}

interface HttpError extends Error {
  status?: number;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function defaultSleep(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function timeoutError(totalTimeoutMs: number): Error {
  return new Error(`QR login timed out after ${totalTimeoutMs}ms.`);
}

function ensureString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`iLink auth response is missing "${fieldName}".`);
  }

  return value;
}

function resolveFetch(fetchImpl?: typeof fetch): typeof fetch {
  if (fetchImpl) {
    return fetchImpl;
  }

  return fetch;
}

function buildStatusPaths(sessionKey: string): readonly string[] {
  const encodedSessionKey = encodeURIComponent(sessionKey);

  return [
    `/cgi-bin/ilink/ilink_bot/get_qrcode_status?session_key=${encodedSessionKey}&bot_type=${AUTH_BOT_TYPE}`,
    `/ilink/bot/get_qrcode_status?qrcode=${encodedSessionKey}`
  ] as const;
}

function isRetryableFallbackError(error: unknown): error is HttpError {
  return error instanceof Error && "status" in error && [400, 404, 405].includes(Number(error.status));
}

async function fetchAuthJson<T>(
  paths: readonly string[],
  options: AuthRequestOptions & {
    readonly headers?: Record<string, string>;
  } = {}
): Promise<T> {
  let lastError: unknown;

  for (const [index, endpointPath] of paths.entries()) {
    try {
      return await fetchAuthJsonOnce<T>(endpointPath, options);
    } catch (error) {
      lastError = error;

      if (!isRetryableFallbackError(error) || index === paths.length - 1) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("iLink auth request failed.");
}

async function fetchAuthJsonOnce<T>(
  endpointPath: string,
  options: AuthRequestOptions & {
    readonly headers?: Record<string, string>;
  } = {}
): Promise<T> {
  const baseUrl = trimTrailingSlash(options.baseUrl ?? AUTH_DEFAULT_BASE_URL);
  const timeoutMs = options.timeoutMs ?? DEFAULT_QR_REQUEST_TIMEOUT_MS;
  const fetchImpl = resolveFetch(options.fetchImpl);
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(new DOMException(`Request timed out after ${timeoutMs}ms`, "AbortError")),
    timeoutMs
  );

  const onAbort = () =>
    controller.abort(options.signal?.reason ?? new DOMException("Aborted", "AbortError"));

  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort(options.signal.reason ?? new DOMException("Aborted", "AbortError"));
    } else {
      options.signal.addEventListener("abort", onAbort, { once: true });
    }
  }

  try {
    const response = await fetchImpl(new URL(endpointPath, `${baseUrl}/`).toString(), {
      method: "GET",
      ...(options.headers ? { headers: options.headers } : {}),
      signal: controller.signal
    });

    if (!response.ok) {
      const error = new Error(
        `iLink auth request failed with status ${response.status}: ${await response.text()}`
      ) as HttpError;
      error.status = response.status;
      throw error;
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutId);
    if (options.signal) {
      options.signal.removeEventListener("abort", onAbort);
    }
  }
}

function normalizeStatus(payload: Record<string, unknown>): LoginStatus {
  const rawStatus = payload.status;

  if (rawStatus === undefined && ("bot_token" in payload || "token" in payload)) {
    return "confirmed";
  }

  switch (rawStatus) {
    case 0:
    case "0":
    case "wait":
    case "waiting":
      return "waiting";
    case 1:
    case "1":
    case "scaned":
    case "scanned":
      return "scanned";
    case 2:
    case "2":
    case "confirmed":
      return "confirmed";
    case 3:
    case "3":
    case "expired":
      return "expired";
    default:
      if (typeof rawStatus === "string" && rawStatus.toLowerCase().includes("expire")) {
        return "expired";
      }

      throw new Error(`Unsupported QR login status: ${String(rawStatus)}`);
  }
}

function parseLoginQRCodeResponse(payload: Record<string, unknown>): LoginQRCode {
  return {
    sessionKey: ensureString(payload.session_key ?? payload.qrcode, "session_key"),
    qrcodeUrl: ensureString(payload.qrcode_url ?? payload.qrcode_img_content, "qrcode_url")
  };
}

function parseScanResult(payload: Record<string, unknown>, fallbackBaseUrl: string): ScanResult {
  const status = normalizeStatus(payload);

  if (status !== "confirmed") {
    return { status };
  }

  return {
    status,
    token: ensureString(payload.token ?? payload.bot_token, "token"),
    accountId: ensureString(payload.account_id ?? payload.ilink_bot_id, "account_id"),
    userId: ensureString(payload.user_id ?? payload.ilink_user_id, "user_id"),
    baseUrl: trimTrailingSlash(
      ensureString(payload.base_url ?? payload.baseurl ?? fallbackBaseUrl, "base_url")
    )
  };
}

export function createAuthScaffold(): AuthScaffold {
  const module = createScaffoldModule("@openwx/core", [
    "QR login flow is implemented with refresh and timeout handling.",
    "Bot type is fixed to 3 by protocol requirements."
  ]);

  return {
    packageName: "@openwx/core",
    botType: "3",
    status: module.status,
    notes: module.notes
  };
}

export async function getLoginQRCode(options: AuthRequestOptions = {}): Promise<LoginQRCode> {
  const response = await fetchAuthJson<Record<string, unknown>>(LOGIN_QR_PATHS, {
    ...options,
    timeoutMs: options.timeoutMs ?? 15_000
  });

  return parseLoginQRCodeResponse(response);
}

export async function waitForScan(
  sessionKey: string,
  options: WaitForScanOptions = {}
): Promise<ScanResult> {
  const baseUrl = trimTrailingSlash(options.baseUrl ?? AUTH_DEFAULT_BASE_URL);
  const totalTimeoutMs = options.totalTimeoutMs ?? DEFAULT_LOGIN_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_QR_POLL_INTERVAL_MS;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const startedAt = now();
  let lastStatus: LoginStatus | undefined;

  while (true) {
    const elapsedMs = now() - startedAt;
    const remainingMs = totalTimeoutMs - elapsedMs;

    if (remainingMs <= 0) {
      throw timeoutError(totalTimeoutMs);
    }

    let result: ScanResult;
    try {
      const response = await fetchAuthJson<Record<string, unknown>>(buildStatusPaths(sessionKey), {
        ...options,
        baseUrl,
        timeoutMs: Math.min(options.timeoutMs ?? DEFAULT_QR_REQUEST_TIMEOUT_MS, remainingMs),
        headers: {
          "iLink-App-ClientVersion": "1"
        }
      });
      result = parseScanResult(response, baseUrl);
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== "AbortError") {
        throw error;
      }

      if (options.signal?.aborted) {
        throw error;
      }

      result = { status: "waiting" };
    }

    if (result.status !== lastStatus) {
      options.onStatusChange?.(result.status);
      lastStatus = result.status;
    }

    if (result.status === "confirmed" || result.status === "expired") {
      return result;
    }

    await sleep(Math.min(pollIntervalMs, remainingMs));
  }
}

export async function login(options: LoginOptions = {}): Promise<LoginResult> {
  const baseUrl = trimTrailingSlash(options.baseUrl ?? AUTH_DEFAULT_BASE_URL);
  const totalTimeoutMs = options.totalTimeoutMs ?? DEFAULT_LOGIN_TIMEOUT_MS;
  const maxRefreshes = options.maxRefreshes ?? DEFAULT_QR_REFRESH_LIMIT;
  const now = options.now ?? Date.now;
  const qrDisplay = resolveQRDisplayProvider(options.qrDisplay);
  const startedAt = now();
  let refreshCount = 0;

  while (true) {
    const elapsedMs = now() - startedAt;
    const remainingMs = totalTimeoutMs - elapsedMs;

    if (remainingMs <= 0) {
      throw timeoutError(totalTimeoutMs);
    }

    const qrcode = await getLoginQRCode({
      ...options,
      baseUrl,
      timeoutMs: Math.min(options.timeoutMs ?? 15_000, remainingMs)
    });

    await qrDisplay.display(qrcode.qrcodeUrl);

    const scanResult = await waitForScan(qrcode.sessionKey, {
      ...options,
      baseUrl,
      totalTimeoutMs: remainingMs
    });

    if (scanResult.status === "confirmed") {
      const accountId = normalizeAccountId(
        ensureString(scanResult.accountId, "accountId")
      );
      const result: LoginResult = {
        token: ensureString(scanResult.token, "token"),
        accountId,
        userId: ensureString(scanResult.userId, "userId"),
        baseUrl: trimTrailingSlash(ensureString(scanResult.baseUrl, "baseUrl")),
        savedAt: new Date(now()).toISOString()
      };

      options.store?.saveAccount(accountId, {
        token: result.token,
        baseUrl: result.baseUrl,
        userId: result.userId,
        savedAt: result.savedAt
      });

      return result;
    }

    refreshCount += 1;
    if (refreshCount >= maxRefreshes) {
      throw new Error(`QR code expired ${refreshCount} times without confirmation.`);
    }
  }
}
