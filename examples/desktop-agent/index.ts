import "dotenv/config";
import path from "node:path";

import { createBot } from "@openwx/bot";

import {
  assertHasAllowedUsers,
  isAllowedUser,
  parseAllowedUsers,
  requiresConfirmation,
  resolveListPath
} from "./src/security.js";
import { captureScreenshot, listDirectory, runShellCommand } from "./src/system.js";

const allowedUsers = parseAllowedUsers(process.env.OPENWX_ALLOWED_USERS);
const agentRoot = path.resolve(process.env.OPENWX_AGENT_ROOT ?? process.cwd());
const pendingConfirmations = new Map<string, string>();
const token = process.env.OPENWX_TOKEN?.trim();

assertHasAllowedUsers(allowedUsers);

const bot = createBot({
  ...(token ? { token } : {}),
  autoTyping: true,
  commands: {
    "/ls": async (ctx) => {
      if (!isAllowedUser(ctx.userId, allowedUsers)) {
        return undefined;
      }

      return runSafely(async () => {
        const targetPath = resolveListPath(agentRoot, ctx.args[0]);
        return await listDirectory(targetPath);
      });
    },
    "/screenshot": async (ctx) => {
      if (!isAllowedUser(ctx.userId, allowedUsers)) {
        return undefined;
      }

      return runSafely(async () => ({ text: "当前桌面截图。", image: await captureScreenshot() }));
    },
    "/exec": async (ctx) => {
      if (!isAllowedUser(ctx.userId, allowedUsers)) {
        return undefined;
      }

      const command = ctx.args.join(" ").trim();
      if (!command) {
        return "用法: /exec <command>";
      }

      // Ask for explicit confirmation before risky commands. / 危险命令必须二次确认后才执行。
      if (requiresConfirmation(command)) {
        pendingConfirmations.set(ctx.userId, command);
        return `危险命令待确认，请发送 /confirm 执行: ${command}`;
      }

      return runSafely(async () => formatCommandOutput(await runShellCommand(command, agentRoot)));
    },
    "/confirm": async (ctx) => {
      if (!isAllowedUser(ctx.userId, allowedUsers)) {
        return undefined;
      }

      const command = pendingConfirmations.get(ctx.userId);
      if (!command) {
        return "当前没有待确认的危险命令。";
      }

      pendingConfirmations.delete(ctx.userId);
      return runSafely(async () => formatCommandOutput(await runShellCommand(command, agentRoot)));
    }
  },
  onMessage: async (ctx) => {
    // Ignore non-whitelisted users entirely. / 非白名单用户直接忽略，不执行本地操作。
    if (!isAllowedUser(ctx.userId, allowedUsers)) {
      return undefined;
    }

    return "可用命令: /ls [path], /screenshot, /exec <command>, /confirm";
  }
});

await bot.start();

function formatCommandOutput(output: string): string {
  return output || "命令执行完成，无输出。";
}

async function runSafely<T>(task: () => Promise<T>): Promise<T | string> {
  try {
    return await task();
  } catch (error) {
    return `执行失败: ${toErrorMessage(error)}`;
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
