import { EventEmitter } from "node:events";
import { writeFile } from "node:fs/promises";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MessageContext } from "@openwx/bot";

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn()
}));

vi.mock("node:child_process", () => ({
  spawn: spawnMock
}));

describe("createHandler", () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls Codex exec with an output file and stores conversation history", async () => {
    const prompts: string[] = [];
    spawnMock
      .mockImplementationOnce((command, args) => createSuccessfulChild(command, args, prompts, "第一轮回复"))
      .mockImplementationOnce((command, args) => createSuccessfulChild(command, args, prompts, "第二轮回复"));

    const { createHandler } = await import("../src/index.js");
    const handler = createHandler({
      cliPath: "/custom/codex",
      model: "gpt-5-codex",
      systemPrompt: "请始终使用纯文本",
      cwd: "/tmp/workspace",
      sandbox: "read-only"
    });

    await expect(handler(createContext({ userId: "user-a", text: "你好" }))).resolves.toBe("第一轮回复");
    await expect(handler(createContext({ userId: "user-a", text: "继续" }))).resolves.toBe("第二轮回复");

    expect(spawnMock).toHaveBeenCalledTimes(2);
    const [command, args, options] = spawnMock.mock.calls[0] as [string, string[], { cwd: string }];
    expect(command).toBe("/custom/codex");
    expect(args).toContain("exec");
    expect(args).toContain("--output-last-message");
    expect(args).toContain("--sandbox");
    expect(args).toContain("read-only");
    expect(args).toContain("--model");
    expect(args).toContain("gpt-5-codex");
    expect(options.cwd).toBe("/tmp/workspace");
    expect(prompts[0]).toContain("请始终使用纯文本");
    expect(prompts[1]).toContain("助手: 第一轮回复");
  });

  it("returns fallback text when the subprocess times out", async () => {
    const child = createPendingChild();
    spawnMock.mockReturnValue(child);

    const { FALLBACK_TEXT, createHandler } = await import("../src/index.js");
    const handler = createHandler({
      cliPath: "/custom/codex",
      timeout: 10
    });

    await expect(handler(createContext({ text: "timeout" }))).resolves.toBe(FALLBACK_TEXT);
    expect(child.kill).toHaveBeenCalledWith("SIGKILL");
  }, 1_000);

  it("exposes a connector factory compatible with hub runtime", async () => {
    const prompts: string[] = [];
    spawnMock.mockImplementationOnce((command, args) =>
      createSuccessfulChild(command, args, prompts, "连接器回复")
    );

    const { createCodexConnector } = await import("../src/index.js");
    const connector = createCodexConnector({
      cliPath: "/custom/codex",
      systemPrompt: "请始终使用纯文本"
    });

    await expect(
      connector.handle({
        conversationId: "conversation-a",
        text: "请总结一下",
        media: {
          type: "file",
          filePath: "/tmp/report.pdf",
          mimeType: "application/pdf"
        }
      })
    ).resolves.toStrictEqual({
      text: "连接器回复"
    });

    expect(prompts[0]).toContain("收到一个文件消息 (report.pdf)");
  });
});

function createContext(overrides: Partial<MessageContext>): MessageContext {
  return {
    message: { from_user_id: "user-1@im.wechat" },
    userId: "user-1@im.wechat",
    client: {} as never,
    reply: vi.fn(async () => undefined),
    replyImage: vi.fn(async () => undefined),
    replyFile: vi.fn(async () => undefined),
    text: "",
    ...overrides
  } as MessageContext;
}

function createSuccessfulChild(
  _command: string,
  args: string[],
  prompts: string[],
  output: string
) {
  const child = createPendingChild();
  const outputIndex = args.indexOf("--output-last-message");
  const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : undefined;

  child.stdin.end.mockImplementation((input?: string) => {
    prompts.push(String(input ?? ""));
    queueMicrotask(async () => {
      if (outputPath) {
        await writeFile(outputPath, output);
      }
      child.emit("close", 0);
    });
  });

  return child;
}

function createPendingChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdin: { end: ReturnType<typeof vi.fn> };
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
  };

  child.stdin = {
    end: vi.fn()
  };
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  return child;
}
