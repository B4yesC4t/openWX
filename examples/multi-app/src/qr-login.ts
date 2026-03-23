import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

import {
  createLocalFileQRDisplayProvider,
  type QRDisplayLogger,
  type QRDisplayProvider
} from "@openwx/core";

export interface LoginQrDisplayOptions {
  readonly outputPath?: string;
  readonly logger?: QRDisplayLogger;
  readonly opener?: (targetPath: string) => Promise<void>;
}

const defaultLogger: QRDisplayLogger = {
  log(message: string) {
    console.log(message);
  }
};

export function resolveDefaultLoginQrPath(): string {
  return path.join(os.homedir(), ".openwx", "openwx-login-qrcode.png");
}

export function createLoginQrDisplayProvider(
  options: LoginQrDisplayOptions = {}
): QRDisplayProvider {
  const outputPath = path.resolve(options.outputPath ?? resolveDefaultLoginQrPath());
  const logger = options.logger ?? defaultLogger;
  const fileProvider = createLocalFileQRDisplayProvider({
    outputPath,
    logger
  });
  const openQrImage = options.opener ?? openPathWithDefaultApp;

  return {
    async display(qrcodeUrl: string): Promise<void> {
      await fileProvider.display(qrcodeUrl);

      try {
        await openQrImage(outputPath);
        logger.log(`WeChat login QR opened in the default image viewer: ${outputPath}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.log(`Failed to open QR image automatically: ${message}`);
      }
    }
  };
}

export async function openPathWithDefaultApp(targetPath: string): Promise<void> {
  const [command, args] = resolveOpenCommand(targetPath);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: "ignore"
    });

    child.on("error", reject);
    child.unref();
    resolve();
  });
}

function resolveOpenCommand(targetPath: string): [string, string[]] {
  switch (process.platform) {
    case "darwin":
      return ["open", [targetPath]];
    case "win32":
      return ["cmd", ["/c", "start", "", targetPath]];
    default:
      return ["xdg-open", [targetPath]];
  }
}
