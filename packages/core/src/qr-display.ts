import * as fs from "node:fs/promises";
import * as path from "node:path";

import QRCode from "qrcode";
import qrcodeTerminal from "qrcode-terminal";

export const DEFAULT_LOCAL_QR_FILE = "openwx-login-qrcode.png";

export type BuiltInQRDisplay = "terminal" | "local-file" | "url-only";

export interface QRDisplayProvider {
  display(qrcodeUrl: string): Promise<void>;
}

export interface QRDisplayLogger {
  log(message: string): void;
}

export interface TerminalQRGenerator {
  generate(
    text: string,
    options: {
      small?: boolean;
    },
    callback: (qrcode: string) => void
  ): void;
}

export interface LocalFileQRCodeRenderer {
  toFile(filePath: string, text: string): Promise<void>;
}

export interface TerminalQRDisplayOptions {
  readonly generator?: TerminalQRGenerator;
  readonly logger?: QRDisplayLogger;
  readonly small?: boolean;
}

export interface LocalFileQRDisplayOptions {
  readonly outputPath?: string;
  readonly renderer?: LocalFileQRCodeRenderer;
  readonly logger?: QRDisplayLogger;
}

export interface UrlOnlyQRDisplayOptions {
  readonly logger?: QRDisplayLogger;
}

const defaultLogger: QRDisplayLogger = {
  log(message: string) {
    console.log(message);
  }
};

function isQRDisplayProvider(value: unknown): value is QRDisplayProvider {
  return (
    typeof value === "object" &&
    value !== null &&
    "display" in value &&
    typeof value.display === "function"
  );
}

export function createTerminalQRDisplayProvider(
  options: TerminalQRDisplayOptions = {}
): QRDisplayProvider {
  const generator = options.generator ?? qrcodeTerminal;
  const logger = options.logger ?? defaultLogger;
  const small = options.small ?? true;

  return {
    async display(qrcodeUrl: string): Promise<void> {
      const rendered = await new Promise<string>((resolve, reject) => {
        try {
          generator.generate(qrcodeUrl, { small }, (output) => resolve(output));
        } catch (error) {
          reject(error);
        }
      });

      logger.log(rendered);
      logger.log(`WeChat login QR URL: ${qrcodeUrl}`);
    }
  };
}

export function createLocalFileQRDisplayProvider(
  options: LocalFileQRDisplayOptions = {}
): QRDisplayProvider {
  const outputPath = path.resolve(options.outputPath ?? DEFAULT_LOCAL_QR_FILE);
  const renderer = options.renderer ?? QRCode;
  const logger = options.logger ?? defaultLogger;

  return {
    async display(qrcodeUrl: string): Promise<void> {
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await renderer.toFile(outputPath, qrcodeUrl);
      logger.log(`WeChat login QR saved to ${outputPath}`);
      logger.log(`WeChat login QR URL: ${qrcodeUrl}`);
    }
  };
}

export function createUrlOnlyQRDisplayProvider(
  options: UrlOnlyQRDisplayOptions = {}
): QRDisplayProvider {
  const logger = options.logger ?? defaultLogger;

  return {
    async display(qrcodeUrl: string): Promise<void> {
      logger.log(`WeChat login QR URL: ${qrcodeUrl}`);
    }
  };
}

export function resolveQRDisplayProvider(
  provider: QRDisplayProvider | BuiltInQRDisplay = "terminal"
): QRDisplayProvider {
  if (isQRDisplayProvider(provider)) {
    return provider;
  }

  switch (provider) {
    case "terminal":
      return createTerminalQRDisplayProvider();
    case "local-file":
      return createLocalFileQRDisplayProvider();
    case "url-only":
      return createUrlOnlyQRDisplayProvider();
    default:
      throw new Error(`Unsupported QR display provider: ${String(provider)}`);
  }
}
